import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import type { AssetSummary } from '../model/types';
import { SelectedAssetTranscriptPanel } from './selected-asset-transcript-panel';

const asset: AssetSummary = {
  assetId: 'asset-youtube',
  title: 'Causal ordering',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  sourceType: 'YOUTUBE',
  youtubeVideoId: 'video-1',
  sourceUrl: 'https://www.youtube.com/watch?v=video-1',
  createdAt: '2026-07-28T00:00:00Z',
};

const rows: TranscriptRow[] = [
  {
    id: 'row-0',
    videoId: asset.assetId,
    segmentIndex: 0,
    startMs: 0,
    endMs: 1_000,
    text: 'Opening segment.',
    createdAt: null,
  },
  {
    id: 'row-1',
    videoId: asset.assetId,
    segmentIndex: 1,
    startMs: 1_000,
    endMs: 2_000,
    text: 'Focused playback segment.',
    createdAt: null,
  },
];

function renderTranscript(
  overrides: Partial<ComponentProps<typeof SelectedAssetTranscriptPanel>> = {},
) {
  const props: ComponentProps<typeof SelectedAssetTranscriptPanel> = {
    asset,
    workspaceName: 'Distributed Systems',
    resolvedAssetStatus: 'SEARCHABLE',
    transcriptRows: rows,
    transcriptError: null,
    transcriptLoading: false,
    onPlaySegment: vi.fn(),
    ...overrides,
  };
  const view = render(<SelectedAssetTranscriptPanel {...props} />);
  return { ...view, props };
}

function rect(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom,
    left: 0,
    right: 400,
    width: 400,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

function installSynchronousFrames() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('controlled transcript following', () => {
  it('shows playback and search/citation focus as distinct coexisting meanings', () => {
    renderTranscript({
      focusedTranscriptRowId: 'row-1',
      focusedTranscriptSource: 'assistant',
      activePlaybackRowId: 'id:row-1',
      transcriptViewVisible: false,
    });

    const activeRow = screen.getByLabelText(
      'Selected transcript moment, currently playing',
    );
    expect(activeRow).toHaveClass('transcript-list__item--active');
    expect(activeRow).toHaveClass('transcript-list__item--playing');
    expect(activeRow).toHaveAttribute('aria-current', 'time');
    expect(activeRow).toHaveTextContent('Playing');
    expect(activeRow).toHaveTextContent('Citation');
  });

  it('scrolls an offscreen active row, avoids a visible row, and respects reduced motion', () => {
    installSynchronousFrames();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    let activeRowVisible = false;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains('transcript-list--scrollable')) return rect(0, 300);
      if (this.classList.contains('transcript-list__item--playing')) {
        return activeRowVisible ? rect(100, 150) : rect(280, 340);
      }
      return rect(0, 0);
    });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));

    const view = renderTranscript({
      activePlaybackRowId: 'id:row-0',
      followMode: 'following',
    });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    scrollIntoView.mockClear();
    activeRowVisible = true;
    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-1"
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    activeRowVisible = false;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-0"
      />,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'nearest',
    });
  });

  it('suspends for wheel, touch, keyboard navigation, scrollbar drag, and text selection', () => {
    const onSuspendFollowing = vi.fn();
    renderTranscript({ onSuspendFollowing });
    const viewport = screen.getByRole('list', { name: 'Video transcript' });

    fireEvent.wheel(viewport);
    fireEvent.touchStart(viewport);
    fireEvent.keyDown(viewport, { key: 'PageDown' });

    Object.defineProperty(viewport, 'offsetWidth', { configurable: true, value: 400 });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 380 });
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect(0, 300));
    fireEvent.pointerDown(viewport, { clientX: 395 });

    const textNode = screen.getByText('Opening segment.').firstChild;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      anchorNode: textNode,
      focusNode: textNode,
    } as Selection);
    fireEvent.mouseUp(viewport);

    expect(onSuspendFollowing).toHaveBeenCalledTimes(5);
  });

  it('ignores active changes while suspended and resumes by scrolling once with predictable focus', async () => {
    const user = userEvent.setup();
    installSynchronousFrames();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      return this.classList.contains('transcript-list--scrollable')
        ? rect(0, 300)
        : rect(280, 340);
    });
    const onResumeFollowing = vi.fn();
    const view = renderTranscript({
      activePlaybackRowId: 'id:row-0',
      followMode: 'suspended-by-user',
      onResumeFollowing,
    });

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        followMode="suspended-by-user"
        activePlaybackRowId="id:row-1"
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Resume following' }));

    expect(onResumeFollowing).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('list', { name: 'Video transcript' })).toHaveFocus();
  });

  it('does not scroll a hidden mobile transcript and aligns when the following view returns', () => {
    installSynchronousFrames();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      return this.classList.contains('transcript-list--scrollable')
        ? rect(0, 300)
        : rect(280, 340);
    });
    const onSuspendFollowing = vi.fn();
    const view = renderTranscript({
      activePlaybackRowId: 'id:row-1',
      followMode: 'following',
      transcriptViewVisible: false,
      onSuspendFollowing,
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-1"
        transcriptViewVisible
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(onSuspendFollowing).not.toHaveBeenCalled();

    scrollIntoView.mockClear();
    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-0"
        followMode="suspended-by-user"
        transcriptViewVisible={false}
      />,
    );
    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-0"
        followMode="suspended-by-user"
        transcriptViewVisible
      />,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
