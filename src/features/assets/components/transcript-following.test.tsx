import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import type { AssetSummary } from '../model/types';
import {
  resolveTranscriptScrollTop,
  SelectedAssetTranscriptPanel,
} from './selected-asset-transcript-panel';

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

/** The dedicated transcript viewport: 300px tall, so the edge threshold is 45px. */
const VIEWPORT_RECT = rect(0, 300);
const VISIBLE_ROW = rect(100, 150);
const NEAR_BOTTOM_ROW = rect(280, 340);
const NEAR_TOP_ROW = rect(10, 60);

function installSynchronousFrames() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
}

function installRowGeometry(targetRow: () => DOMRect) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function getRect(this: HTMLElement) {
      if (this.classList.contains('transcript-list--scrollable')) return VIEWPORT_RECT;
      if (
        this.classList.contains('transcript-list__item--playing') ||
        this.classList.contains('transcript-list__item--active')
      ) {
        return targetRow();
      }
      return rect(0, 0);
    },
  );
}

/**
 * Stubs the rendered transcript viewport's scroll metrics and container scroll API, plus the
 * document-level scrolling that must never move.
 */
function installViewport(overrides: {
  scrollTop?: number;
  scrollHeight?: number;
  clientHeight?: number;
  withScrollTo?: boolean;
} = {}) {
  const viewport = screen.getByRole('list', { name: 'Video transcript' });
  const scrollHeight = overrides.scrollHeight ?? 1_200;
  const clientHeight = overrides.clientHeight ?? 300;
  let scrollTop = overrides.scrollTop ?? 400;

  Object.defineProperty(viewport, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (next: number) => {
      scrollTop = next;
    },
  });
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, get: () => clientHeight });

  const scrollTo = vi.fn();
  if (overrides.withScrollTo !== false) {
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
  }

  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const documentScrollTop = document.documentElement.scrollTop;
  const windowScrollY = window.scrollY;

  return {
    viewport,
    scrollTo,
    scrollIntoView,
    windowScrollTo,
    readScrollTop: () => scrollTop,
    expectDocumentUnmoved() {
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(windowScrollTo).not.toHaveBeenCalled();
      expect(window.scrollY).toBe(windowScrollY);
      expect(document.documentElement.scrollTop).toBe(documentScrollTop);
    },
  };
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce })));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('transcript viewport scroll resolution', () => {
  const viewport = { scrollTop: 400, scrollHeight: 1_200, clientHeight: 300 };

  it('returns no target for a comfortably visible row unless alignment is forced', () => {
    expect(resolveTranscriptScrollTop(VISIBLE_ROW, VIEWPORT_RECT, viewport, false)).toBeNull();
    expect(resolveTranscriptScrollTop(VISIBLE_ROW, VIEWPORT_RECT, viewport, true)).toBe(375);
  });

  it('centers a row that sits at either viewport edge', () => {
    expect(resolveTranscriptScrollTop(NEAR_BOTTOM_ROW, VIEWPORT_RECT, viewport, false)).toBe(560);
    expect(resolveTranscriptScrollTop(NEAR_TOP_ROW, VIEWPORT_RECT, viewport, false)).toBe(285);
  });

  it('clamps the target to the scrollable range at the top and at the bottom', () => {
    expect(resolveTranscriptScrollTop(
      NEAR_TOP_ROW,
      VIEWPORT_RECT,
      { ...viewport, scrollTop: 20 },
      false,
    )).toBe(0);

    expect(resolveTranscriptScrollTop(
      NEAR_BOTTOM_ROW,
      VIEWPORT_RECT,
      { ...viewport, scrollTop: 880 },
      false,
    )).toBe(900);
  });

  it('returns no target when a forced alignment would not move the viewport', () => {
    expect(resolveTranscriptScrollTop(rect(120, 180), VIEWPORT_RECT, viewport, true)).toBeNull();
  });
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

  it('scrolls only the transcript viewport for an offscreen active row', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );

    expect(scrolling.scrollTo).toHaveBeenCalledTimes(1);
    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: 'smooth' });
    scrolling.expectDocumentUnmoved();
  });

  it('falls back to viewport scrollTop when the container scroll API is unavailable', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 400, withScrollTo: false });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );

    expect(scrolling.readScrollTop()).toBe(560);
    scrolling.expectDocumentUnmoved();
  });

  it('clamps to the top of the transcript viewport for a near-top row', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_TOP_ROW);
    stubReducedMotion(false);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 20 });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );

    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scrolling.expectDocumentUnmoved();
  });

  it('clamps to the bottom of the transcript viewport for a near-bottom row', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 880 });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );

    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' });
    scrolling.expectDocumentUnmoved();
  });

  it('does not scroll a comfortably visible active row', () => {
    installSynchronousFrames();
    installRowGeometry(() => VISIBLE_ROW);
    stubReducedMotion(false);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );

    expect(scrolling.scrollTo).not.toHaveBeenCalled();
    expect(scrolling.readScrollTop()).toBe(400);
    scrolling.expectDocumentUnmoved();
  });

  it('respects reduced motion and the restrained smooth default', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(true);
    const view = renderTranscript();
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-0" />,
    );
    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: 'auto' });

    scrolling.scrollTo.mockClear();
    stubReducedMotion(false);
    view.rerender(
      <SelectedAssetTranscriptPanel {...view.props} activePlaybackRowId="id:row-1" />,
    );
    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: 'smooth' });
    scrolling.expectDocumentUnmoved();
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

  it('ignores active changes while suspended and resumes by aligning the viewport once', async () => {
    const user = userEvent.setup();
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const onResumeFollowing = vi.fn();
    const view = renderTranscript({
      activePlaybackRowId: 'id:row-0',
      followMode: 'suspended-by-user',
      onResumeFollowing,
    });
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        followMode="suspended-by-user"
        activePlaybackRowId="id:row-1"
      />,
    );
    expect(scrolling.scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Resume following' }));

    expect(onResumeFollowing).toHaveBeenCalledTimes(1);
    expect(scrolling.scrollTo).toHaveBeenCalledTimes(1);
    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: 'smooth' });
    expect(screen.getByRole('list', { name: 'Video transcript' })).toHaveFocus();
    scrolling.expectDocumentUnmoved();
  });

  it('does not scroll a hidden mobile transcript and aligns when the following view returns', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const view = renderTranscript({ transcriptViewVisible: false });
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-1"
        followMode="following"
        transcriptViewVisible={false}
      />,
    );
    expect(scrolling.scrollTo).not.toHaveBeenCalled();

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        activePlaybackRowId="id:row-1"
        followMode="following"
        transcriptViewVisible
      />,
    );
    expect(scrolling.scrollTo).toHaveBeenCalledTimes(1);

    scrolling.scrollTo.mockClear();
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
    expect(scrolling.scrollTo).not.toHaveBeenCalled();
    scrolling.expectDocumentUnmoved();
  });

  it('aligns a search/citation focused row inside the viewport and keeps focus on it', () => {
    installSynchronousFrames();
    installRowGeometry(() => NEAR_BOTTOM_ROW);
    stubReducedMotion(false);
    const view = renderTranscript({ focusedTranscriptSource: 'search' });
    const scrolling = installViewport({ scrollTop: 400 });

    view.rerender(
      <SelectedAssetTranscriptPanel
        {...view.props}
        focusedTranscriptSource="search"
        focusedTranscriptRowId="row-1"
        activePlaybackRowId="id:row-1"
      />,
    );

    expect(scrolling.scrollTo).toHaveBeenCalledWith({ top: 560, behavior: 'smooth' });
    const focusedRow = screen.getByLabelText('Selected transcript moment, currently playing');
    expect(focusedRow).toHaveFocus();
    expect(focusedRow).toHaveTextContent('Search match');
    expect(focusedRow).toHaveTextContent('Playing');
    scrolling.expectDocumentUnmoved();
  });
});
