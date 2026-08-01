import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import { AssetDetailScreen } from './detail-screen';
import type { AssetPlaybackProgress, AssetSummary } from './model/types';
import {
  resetYouTubeIframeApiLoaderForTests,
  type YouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerOptions,
} from './player/youtube-iframe-api';

type MockPlayer = Omit<YouTubePlayerInstance, 'getCurrentTime' | 'getPlayerState'> & {
  options: YouTubePlayerOptions;
  getCurrentTime: ReturnType<typeof vi.fn>;
  getPlayerState: ReturnType<typeof vi.fn>;
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

const uploadAsset: AssetSummary = {
  assetId: 'asset-upload',
  title: 'Uploaded lecture',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  sourceType: 'UPLOAD',
  youtubeVideoId: null,
  sourceUrl: null,
  createdAt: '2026-07-28T00:00:00Z',
};

function progressFor(
  assetId: string,
  overrides: Partial<AssetPlaybackProgress> = {},
): AssetPlaybackProgress {
  return {
    assetId,
    positionMs: 65_000,
    completed: false,
    updatedAt: '2026-07-29T10:00:00Z',
    ...overrides,
  };
}

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

function stubUploadMedia() {
  const video = screen.getByLabelText('Uploaded video: Uploaded lecture');
  if (!(video instanceof HTMLVideoElement)) throw new Error('Expected a native video element');

  let currentTime = 0;
  let paused = true;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (next: number) => {
      currentTime = next;
    },
  });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
  Object.defineProperty(video, 'ended', { configurable: true, get: () => false });
  const play = vi.fn(() => {
    paused = false;
    return Promise.resolve();
  });
  Object.defineProperty(video, 'play', { configurable: true, value: play });

  return { video, play, readCurrentTime: () => currentTime };
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
});

describe('Study resume offer visibility', () => {
  it('offers an explicit resume with the formatted position and never seeks automatically', async () => {
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 65_000 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    expect(screen.getByRole('heading', { name: 'Continue watching' })).toBeInTheDocument();
    expect(screen.getByText('You stopped at 01:05.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume from 01:05' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start from beginning' })).toBeInTheDocument();
    expect(players[0].seekTo).not.toHaveBeenCalled();
    expect(players[0].playVideo).not.toHaveBeenCalled();
  });

  it('offers nothing for absent, zero or completed progress', () => {
    const view = renderStudy();
    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        playbackProgress={progressFor('asset-youtube', { positionMs: 0 })}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        playbackProgress={progressFor('asset-youtube', { positionMs: 65_000, completed: true })}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume from/i })).not.toBeInTheDocument();
  });

  it('ignores progress that belongs to a different Asset', () => {
    renderStudy({ playbackProgress: progressFor('asset-other', { positionMs: 65_000 }) });

    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();
  });

  it('offers nothing when Upload playback is unavailable in bearer mode', () => {
    vi.stubEnv('VITE_AUTHENTICATION_MODE', 'keycloak_jwt');
    const { container } = renderStudy({
      asset: uploadAsset,
      playbackProgress: progressFor('asset-upload', { positionMs: 65_000 }),
    });

    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('Upload playback is not available in this authentication mode yet.'))
      .toBeInTheDocument();
  });

  it('removes the offer after a player error and keeps the transcript readable', async () => {
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 65_000 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });
    expect(screen.getByRole('button', { name: 'Resume from 01:05' })).toBeInTheDocument();

    players[0].options.events.onError();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Resume from 01:05' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('drops a stale offer when Study switches to another Asset', async () => {
    const { players } = installPlayerApi();
    const view = renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 65_000 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Resume from 01:05' })).toBeInTheDocument();

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        asset={uploadAsset}
        playbackProgress={progressFor('asset-youtube', { positionMs: 65_000 })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Resume from 01:05' })).not.toBeInTheDocument();
  });

  it('withdraws the offer once the learner starts playback themselves', async () => {
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 65_000 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(1);
    players[0].options.events.onReady({ target: players[0] });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Resume from 01:05' })).not.toBeInTheDocument();
    });
  });
});

describe('Study resume actions', () => {
  it('seeks to the exact saved position, plays, and keeps focus in the media region', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 4_500 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    await user.click(screen.getByRole('button', { name: 'Resume from 00:04' }));

    expect(players[0].seekTo).toHaveBeenCalledWith(4.5, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /resume from/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('YouTube player for Causal ordering')).toHaveFocus();
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
  });

  it('starts from the beginning and enables transcript following', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 65_000 }) });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });
    fireEvent.wheel(screen.getByRole('list', { name: 'Video transcript' }));
    expect(screen.getByRole('button', { name: 'Resume following' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start from beginning' }));

    expect(players[0].seekTo).toHaveBeenCalledWith(0, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Resume following' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'The introduction starts at zero.',
    );
  });

  it('applies a resume requested before the player is ready exactly once', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: progressFor('asset-youtube', { positionMs: 4_500 }) });
    await waitFor(() => expect(players).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Resume from 00:04' }));
    expect(players[0].seekTo).not.toHaveBeenCalled();

    players[0].options.events.onReady({ target: players[0] });
    players[0].options.events.onReady({ target: players[0] });

    expect(players[0].seekTo).toHaveBeenCalledTimes(1);
    expect(players[0].seekTo).toHaveBeenCalledWith(4.5, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
  });

  it('resumes native Upload playback through the shared player handle', async () => {
    const user = userEvent.setup();
    renderStudy({
      asset: uploadAsset,
      playbackProgress: progressFor('asset-upload', { positionMs: 4_500 }),
    });
    const media = stubUploadMedia();
    fireEvent.loadedMetadata(media.video);

    await user.click(screen.getByRole('button', { name: 'Resume from 00:04' }));

    expect(media.readCurrentTime()).toBe(4.5);
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Uploaded video player for Uploaded lecture')).toHaveFocus();
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
  });
});

describe('Study playback observation and save feedback', () => {
  it('forwards every neutral snapshot to the progress owner without provider detail', async () => {
    const onObservePlayback = vi.fn();
    const { players } = installPlayerApi();
    renderStudy({ onObservePlayback });
    await waitFor(() => expect(players).toHaveLength(1));

    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(4.5);
    players[0].options.events.onReady({ target: players[0] });

    expect(onObservePlayback).toHaveBeenCalledWith({ state: 'playing', positionMs: 4_500 });
    for (const [snapshot] of onObservePlayback.mock.calls) {
      expect(Object.keys(snapshot).sort()).toEqual(['positionMs', 'state']);
    }
  });

  it('observes playback for progress even when the transcript has no timing', async () => {
    const onObservePlayback = vi.fn();
    const { players } = installPlayerApi();
    renderStudy({
      onObservePlayback,
      transcriptRows: [{ ...transcriptRows[0], startMs: null, endMs: null }],
    });
    await waitFor(() => expect(players).toHaveLength(1));

    players[0].getPlayerState.mockReturnValue(1);
    players[0].getCurrentTime.mockReturnValue(2);
    players[0].options.events.onReady({ target: players[0] });

    expect(onObservePlayback).toHaveBeenCalledWith({ state: 'playing', positionMs: 2_000 });
  });

  it('shows restrained save-failure copy that does not announce or block playback', async () => {
    const { players } = installPlayerApi();
    renderStudy({ playbackProgressSaveFailed: true });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    const note = screen.getByText('Your playback position could not be saved.');
    expect(note).toBeInTheDocument();
    expect(note).not.toHaveAttribute('role');
    expect(note).not.toHaveAttribute('aria-live');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('YouTube player for Causal ordering')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /play transcript segment/i })).toHaveLength(2);
  });

  it('keeps Study usable when progress loading failed and nothing was returned', async () => {
    const { players } = installPlayerApi();
    renderStudy({ playbackProgress: undefined });
    await waitFor(() => expect(players).toHaveLength(1));
    players[0].options.events.onReady({ target: players[0] });

    expect(screen.queryByRole('heading', { name: 'Continue watching' })).not.toBeInTheDocument();
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /play transcript segment/i })).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument();
  });
});
