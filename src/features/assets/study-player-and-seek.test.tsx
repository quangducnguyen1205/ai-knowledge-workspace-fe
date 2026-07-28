import type { ComponentProps } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import { AssetDetailScreen } from './detail-screen';
import type { AssetSummary } from './model/types';
import {
  resetYouTubeIframeApiLoaderForTests,
  type YouTubeIframeApi,
  type YouTubePlayerInstance,
  type YouTubePlayerOptions,
} from './player/youtube-iframe-api';

type MockPlayer = YouTubePlayerInstance & {
  options: YouTubePlayerOptions;
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
      destroy: vi.fn(),
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

afterEach(() => {
  cleanup();
  resetYouTubeIframeApiLoaderForTests();
  Reflect.deleteProperty(window, 'YT');
  Reflect.deleteProperty(window, 'onYouTubeIframeAPIReady');
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

    const action = screen.getByRole('button', {
      name: 'Play transcript segment from 00:00',
    });
    action.focus();
    await user.keyboard('{Enter}');

    expect(players[0].seekTo).toHaveBeenCalledWith(0, true);
    expect(players[0].playVideo).toHaveBeenCalledTimes(1);
    expect(action).toHaveFocus();
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
  });

  it('keeps upload Study transcript-first with no player or playback controls', () => {
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
    expect(screen.queryByRole('button', { name: /play transcript segment/i })).not.toBeInTheDocument();
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('destroys the YouTube player and removes seek controls when Study switches to an upload Asset', async () => {
    const { players } = installPlayerApi();
    const view = renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));

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
    expect(screen.queryByRole('button', { name: /play transcript segment/i })).not.toBeInTheDocument();
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('keeps transcript and Study tabs usable after a provider error', async () => {
    const user = userEvent.setup();
    const { players } = installPlayerApi();
    renderStudy();
    await waitFor(() => expect(players).toHaveLength(1));

    players[0].options.events.onError();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The YouTube player could not be loaded.',
    );
    expect(screen.getByText('This segment explains causal ordering.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Details' }));
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument();
  });
});
