import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import { AssetDetailScreen } from './detail-screen';
import type { AssetSummary } from './model/types';
import {
  resetYouTubeIframeApiLoaderForTests,
  type YouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerOptions,
} from './player/youtube-iframe-api';

type MockPlayer = Omit<
  YouTubePlayerInstance,
  'getCurrentTime' | 'getPlayerState' | 'pauseVideo' | 'cueVideoById'
> & {
  options: YouTubePlayerOptions;
  getCurrentTime: ReturnType<typeof vi.fn>;
  getPlayerState: ReturnType<typeof vi.fn>;
  pauseVideo: ReturnType<typeof vi.fn>;
  cueVideoById: ReturnType<typeof vi.fn>;
};

const transcriptRows: TranscriptRow[] = [
  {
    id: 'row-0',
    videoId: 'asset-youtube',
    segmentIndex: 0,
    startMs: 0,
    endMs: 900,
    text: 'The introduction starts at zero.',
    createdAt: null,
  },
  {
    id: 'row-1',
    videoId: 'asset-youtube',
    segmentIndex: 1,
    startMs: 4_250,
    endMs: 7_000,
    text: 'This segment explains causal ordering.',
    createdAt: null,
  },
  {
    id: 'legacy-row',
    videoId: 'asset-youtube',
    segmentIndex: 2,
    startMs: null,
    endMs: null,
    text: 'This legacy segment has no timing.',
    createdAt: null,
  },
  {
    id: 'partial-row',
    videoId: 'asset-youtube',
    segmentIndex: 3,
    startMs: 8_000,
    endMs: null,
    text: 'This segment has incomplete timing.',
    createdAt: null,
  },
];

const youtubeAsset: AssetSummary = {
  assetId: 'asset-youtube',
  title: 'Causal ordering',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  sourceType: 'YOUTUBE',
  youtubeVideoId: 'abc_DEF-123',
  sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
  createdAt: '2026-07-28T00:00:00Z',
};

function installPlayerApi() {
  const players: MockPlayer[] = [];
  const Player = vi.fn(function Player(element: HTMLElement, options: YouTubePlayerOptions) {
    const iframe = document.createElement('iframe');
    element.replaceWith(iframe);
    const player: MockPlayer = {
      options,
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      cueVideoById: vi.fn(),
      destroy: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getPlayerState: vi.fn(() => -1),
      getIframe: () => iframe,
    };
    players.push(player);
    return player;
  });
  window.YT = { Player } as unknown as YouTubeIframeApi;
  return { Player, players };
}

/**
 * Gives every element the same fixed geometry and records which elements were scrolled into
 * view, so "bring the player on screen" can be observed in an environment without layout.
 */
function stubViewportGeometry(bounds: { top: number; bottom: number }) {
  const scrolledInto: { element: HTMLElement; options: unknown }[] = [];

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value(this: HTMLElement, options: unknown) {
      scrolledInto.push({ element: this, options });
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...bounds,
      left: 0,
      right: 640,
      width: 640,
      height: bounds.bottom - bounds.top,
      x: 0,
      y: bounds.top,
      toJSON: () => ({}),
    }),
  });

  return scrolledInto;
}

function renderStudy(overrides: Partial<ComponentProps<typeof AssetDetailScreen>> = {}) {
  const props: ComponentProps<typeof AssetDetailScreen> = {
    workspaceName: 'Distributed Systems',
    asset: youtubeAsset,
    successNotice: null,
    resolvedAssetStatus: 'SEARCHABLE',
    statusError: null,
    transcriptRows,
    transcriptError: null,
    transcriptLoading: false,
    indexError: null,
    isIndexing: false,
    retryError: null,
    isRetrying: false,
    isRenaming: false,
    isDeleting: false,
    renameError: null,
    activeQuery: null,
    searchError: null,
    isSearching: false,
    contextError: null,
    isContextLoading: false,
    selectedSearchResult: null,
    focusedTranscriptRowId: null,
    studyContextError: null,
    isStudyContextLoading: false,
    searchResetToken: 0,
    onIndex: vi.fn(),
    onRetryProcessing: vi.fn(),
    onRename: vi.fn(),
    onResetRename: vi.fn(),
    onDelete: vi.fn(),
    onSearchWithinAsset: vi.fn(),
    onSelectSearchResult: vi.fn(),
    onOpenTranscriptMoment: vi.fn(),
    onOpenLibrary: vi.fn(),
    ...overrides,
  };
  const view = render(<AssetDetailScreen {...props} />);
  return { ...view, props };
}

beforeEach(() => {
  vi.stubEnv('VITE_AUTHENTICATION_MODE', 'legacy_session');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  resetYouTubeIframeApiLoaderForTests();
  Reflect.deleteProperty(window, 'YT');
  Reflect.deleteProperty(window, 'onYouTubeIframeAPIReady');
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect');
});

describe('Study YouTube player and transcript seek', () => {
  it('renders exact-source player and accessible controls only for fully timestamped rows', async () => {
    const user = userEvent.setup();
    const { Player, players } = installPlayerApi();
    renderStudy();

    await waitFor(() => expect(Player).toHaveBeenCalledTimes(1));
    expect(Player.mock.calls[0]?.[1].videoId).toBe('abc_DEF-123');
    expect(screen.getByRole('button', { name: 'Play transcript segment from 00:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play transcript segment from 00:04' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /play transcript segment/i })).toHaveLength(2);
    expect(screen.getByText('This legacy segment has no timing.')).toBeInTheDocument();
    expect(screen.getByText('This segment has incomplete timing.')).toBeInTheDocument();

    const secondSegment = screen.getByRole('button', {
      name: 'Play transcript segment from 00:04',
    });
    await user.click(secondSegment);
    expect(secondSegment).toHaveFocus();
    expect(players[0].seekTo).not.toHaveBeenCalled();

    players[0].options.events.onReady({ target: players[0] });

    expect(players[0].seekTo).toHaveBeenCalledWith(4.25, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(secondSegment).toHaveFocus();
  });

  it('supports keyboard playback from 00:00 without changing selected transcript context', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({ focusedTranscriptRowId: 'row-1' });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Resume following' })).toBeInTheDocument();

    const action = screen.getByRole('button', {
      name: 'Play transcript segment from 00:00',
    });
    action.focus();
    await user.keyboard('{Enter}');

    expect(players[0].seekTo).toHaveBeenCalledWith(0, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(action).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Resume following' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'The introduction starts at zero.',
    );
  });

  it('positions the player at the selected moment, stays paused, and offers explicit playback', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({ focusedTranscriptRowId: 'row-1', focusedTranscriptSource: 'search' });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    // Selecting a moment prepares its exact timestamp and never starts playing on its own.
    expect(players[0].cueVideoById).toHaveBeenCalledWith({
      videoId: 'abc_DEF-123',
      startSeconds: 4.25,
    });
    expect(players[0].playVideo).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();

    const playMoment = screen.getByRole('button', { name: 'Play from 00:04' });
    await user.click(playMoment);

    expect(players[0].seekTo).toHaveBeenCalledWith(4.25, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
  });

  it('withdraws moment playback once the player reports an error', async () => {
    const { players } = installPlayerApi();
    renderStudy({ focusedTranscriptRowId: 'row-1', focusedTranscriptSource: 'search' });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    expect(screen.getByRole('button', { name: 'Play from 00:04' })).toBeInTheDocument();

    players[0].options.events.onError();

    // A control that cannot play anything must not stay offered, and nothing may be commanded.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.queryByRole('button', { name: /play from/i })).not.toBeInTheDocument();
    expect(players[0].seekTo).not.toHaveBeenCalled();
    expect(players[0].playVideo).not.toHaveBeenCalled();
  });

  it('offers no moment playback for a selected row the transcript cannot time', async () => {
    const { players } = installPlayerApi();
    renderStudy({ focusedTranscriptRowId: 'legacy-row', focusedTranscriptSource: 'search' });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    expect(screen.queryByRole('button', { name: /play from/i })).not.toBeInTheDocument();
    expect(players[0].cueVideoById).not.toHaveBeenCalled();
    expect(players[0].seekTo).not.toHaveBeenCalled();
    expect(players[0].playVideo).not.toHaveBeenCalled();
  });

  it('leaves ordinary Viewer navigation without a selected moment untouched', async () => {
    const { players } = installPlayerApi();
    const scrolledInto = stubViewportGeometry({ top: -400, bottom: -100 });
    renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    expect(screen.queryByRole('button', { name: /play from/i })).not.toBeInTheDocument();
    expect(players[0].cueVideoById).not.toHaveBeenCalled();
    expect(players[0].seekTo).not.toHaveBeenCalled();
    expect(players[0].playVideo).not.toHaveBeenCalled();
    expect(scrolledInto).toHaveLength(0);
  });

  it('brings an off-screen player into view for a selected moment, and leaves a visible one alone', async () => {
    const { players } = installPlayerApi();
    const scrolledOffScreen = stubViewportGeometry({ top: -400, bottom: -100 });
    renderStudy({ focusedTranscriptRowId: 'row-1', focusedTranscriptSource: 'search' });
    await waitFor(() => expect(players).toHaveLength(1));

    expect(scrolledOffScreen).toHaveLength(1);
    expect(scrolledOffScreen[0].element).toHaveAttribute(
      'aria-label',
      'YouTube player for Causal ordering',
    );
    expect(scrolledOffScreen[0].options).toEqual({ block: 'center', behavior: 'instant' });

    cleanup();
    const scrolledOnScreen = stubViewportGeometry({ top: 24, bottom: 480 });
    renderStudy({ focusedTranscriptRowId: 'row-1', focusedTranscriptSource: 'search' });
    await waitFor(() => expect(players).toHaveLength(2));

    expect(scrolledOnScreen).toHaveLength(0);
  });

  it('maps observed playback directly to active rows without moving keyboard focus', async () => {
    const { players } = installPlayerApi();
    renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));
    const stableFocus = screen.getByRole('button', {
      name: 'Play transcript segment from 00:00',
    });
    stableFocus.focus();

    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(4.5);
    players[0].options.events.onReady({ target: players[0] });

    expect(await screen.findByLabelText('Currently playing transcript segment'))
      .toHaveTextContent('This segment explains causal ordering.');
    expect(stableFocus).toHaveFocus();

    players[0].getCurrentTime.mockReturnValue(0.25);
    players[0].options.events.onStateChange({ target: players[0], data: 1 });
    await waitFor(() => {
      expect(screen.getByLabelText('Currently playing transcript segment'))
        .toHaveTextContent('The introduction starts at zero.');
    });
    expect(stableFocus).toHaveFocus();

    players[0].getCurrentTime.mockReturnValue(20);
    players[0].options.events.onStateChange({ target: players[0], data: 1 });
    await waitFor(() => {
      expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
    });
  });

  it('clears playback-active identity when refreshed transcript timing is no longer eligible', async () => {
    const { players } = installPlayerApi();
    const view = renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(4.5);
    players[0].options.events.onReady({ target: players[0] });
    expect(await screen.findByLabelText('Currently playing transcript segment'))
      .toHaveTextContent('This segment explains causal ordering.');

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        transcriptRows={transcriptRows.map((row) => (
          row.id === 'row-1' ? { ...row, endMs: null } : row
        ))}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
    });
  });

  it('suspends on manual transcript reading and explicit Play segment restores following', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));
    const viewport = screen.getByRole('list', { name: 'Video transcript' });

    fireEvent.wheel(viewport);
    expect(screen.getByRole('button', { name: 'Resume following' })).toBeInTheDocument();

    const playAction = screen.getByRole('button', {
      name: 'Play transcript segment from 00:04',
    });
    await user.click(playAction);

    expect(screen.queryByRole('button', { name: 'Resume following' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
    expect(playAction).toHaveFocus();
  });

  it('renders exactly one source-appropriate player for an upload Asset', () => {
    const { Player } = installPlayerApi();
    renderStudy({
      asset: {
        ...youtubeAsset,
        assetId: 'asset-upload',
        sourceType: 'UPLOAD',
        youtubeVideoId: null,
        sourceUrl: null,
      },
    });

    expect(Player).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/youtube player for/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Uploaded video player for Causal ordering')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /play transcript segment/i })).toHaveLength(2);
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('destroys the YouTube player and mounts only the Upload player on source change', async () => {
    const { players } = installPlayerApi();
    const view = renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(4.5);
    players[0].options.events.onReady({ target: players[0] });
    expect(await screen.findByLabelText('Currently playing transcript segment'))
      .toHaveTextContent('This segment explains causal ordering.');

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        asset={{
          ...youtubeAsset,
          assetId: 'asset-upload',
          sourceType: 'UPLOAD',
          youtubeVideoId: null,
          sourceUrl: null,
        }}
      />,
    );

    expect(players[0].destroy).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/youtube player for/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Uploaded video player for Causal ordering')).toBeInTheDocument();
    expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('keeps transcript and Study tabs usable after a provider error', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({
      focusedTranscriptRowId: 'row-0',
      focusedTranscriptSource: 'assistant',
    });
    await waitFor(() => expect(players).toHaveLength(1));

    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(4.5);
    players[0].options.events.onReady({ target: players[0] });
    expect(await screen.findByLabelText('Currently playing transcript segment')).toBeInTheDocument();

    players[0].options.events.onError();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.getByText('This segment explains causal ordering.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(
      'The introduction starts at zero.',
    );
    await user.click(screen.getByRole('tab', { name: 'Details' }));
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
  });
});
