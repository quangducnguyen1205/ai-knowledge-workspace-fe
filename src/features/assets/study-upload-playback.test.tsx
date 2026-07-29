import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import { AssetDetailScreen } from './detail-screen';
import type { AssetSummary } from './model/types';

const transcriptRows: TranscriptRow[] = [
  {
    id: 'row-0',
    videoId: 'asset-upload',
    segmentIndex: 0,
    startMs: 0,
    endMs: 900,
    text: 'The introduction starts at zero.',
    createdAt: null,
  },
  {
    id: 'row-1',
    videoId: 'asset-upload',
    segmentIndex: 1,
    startMs: 4_250,
    endMs: 7_000,
    text: 'This segment explains causal ordering.',
    createdAt: null,
  },
  {
    id: 'row-2',
    videoId: 'asset-upload',
    segmentIndex: 2,
    startMs: 12_000,
    endMs: 15_000,
    text: 'This segment closes the lecture.',
    createdAt: null,
  },
];

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

function renderStudy(overrides: Partial<ComponentProps<typeof AssetDetailScreen>> = {}) {
  const props: ComponentProps<typeof AssetDetailScreen> = {
    workspaceName: 'Distributed Systems',
    asset: uploadAsset,
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

type MediaElementStub = {
  play: ReturnType<typeof vi.fn>;
  setPaused(paused: boolean): void;
  setCurrentTime(seconds: number): void;
  readCurrentTime(): number;
};

function stubUploadMedia(): { video: HTMLVideoElement; media: MediaElementStub } {
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

  return {
    video,
    media: {
      play,
      setPaused: (next) => {
        paused = next;
      },
      setCurrentTime: (next) => {
        currentTime = next;
      },
      readCurrentTime: () => currentTime,
    },
  };
}

beforeEach(() => {
  vi.stubEnv('VITE_AUTHENTICATION_MODE', 'legacy_session');
  // jsdom has no layout engine; Study follow behavior is verified in transcript-following.
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('Study Upload playback source selection', () => {
  it('renders the authorized Spring media source without storage identity', () => {
    renderStudy();
    const { video } = stubUploadMedia();

    expect(video).toHaveAttribute('src', '/api/assets/asset-upload/media');
    expect(document.body.innerHTML).not.toMatch(/minio|bucket|objectKey|presigned|:9000/i);
    expect(screen.queryByTitle(/youtube/i)).not.toBeInTheDocument();
  });

  it('renders Upload media while the Asset is still processing or failed', () => {
    const view = renderStudy({
      resolvedAssetStatus: 'PROCESSING',
      transcriptRows: [],
    });

    expect(screen.getByLabelText('Uploaded video player for Uploaded lecture')).toBeInTheDocument();

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        resolvedAssetStatus="FAILED"
        transcriptRows={[]}
      />,
    );

    expect(screen.getByLabelText('Uploaded video player for Uploaded lecture')).toBeInTheDocument();
  });

  it('renders bounded fallback copy and no media element in bearer mode', () => {
    vi.stubEnv('VITE_AUTHENTICATION_MODE', 'keycloak_jwt');
    const { container } = renderStudy();

    expect(screen.getByText('Upload playback is not available in this authentication mode yet.'))
      .toBeInTheDocument();
    expect(container.querySelector('video')).toBeNull();
    expect(screen.queryByRole('button', { name: /play transcript segment/i }))
      .not.toBeInTheDocument();
    expect(screen.getByText('The introduction starts at zero.')).toBeInTheDocument();
  });

  it('removes the Upload player and clears playback state when the Asset changes', async () => {
    const view = renderStudy();
    const { video, media } = stubUploadMedia();
    fireEvent.loadedMetadata(video);
    media.setPaused(false);
    media.setCurrentTime(4.5);
    fireEvent.playing(video);
    expect(await screen.findByLabelText('Currently playing transcript segment'))
      .toHaveTextContent('This segment explains causal ordering.');

    view.rerender(
      <AssetDetailScreen
        {...view.props}
        asset={{
          ...uploadAsset,
          assetId: 'asset-youtube',
          sourceType: 'YOUTUBE',
          youtubeVideoId: 'abc_DEF-123',
          sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByLabelText('Uploaded video player for Uploaded lecture'))
        .not.toBeInTheDocument();
    });
    expect(document.querySelector('video')).toBeNull();
    expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
  });
});

describe('Study Upload playback synchronization', () => {
  it('seeks and plays from an explicit transcript action while keeping focus stable', async () => {
    const user = userEvent.setup();
    renderStudy();
    const { video, media } = stubUploadMedia();
    fireEvent.loadedMetadata(video);

    const action = screen.getByRole('button', { name: 'Play transcript segment from 00:04' });
    await user.click(action);

    expect(media.readCurrentTime()).toBe(4.25);
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(action).toHaveFocus();
    expect(screen.getByLabelText('Currently playing transcript segment')).toHaveTextContent(
      'This segment explains causal ordering.',
    );
  });

  it('applies only the latest pre-metadata transcript action once metadata arrives', async () => {
    const user = userEvent.setup();
    renderStudy();
    const { video, media } = stubUploadMedia();

    await user.click(screen.getByRole('button', { name: 'Play transcript segment from 00:00' }));
    await user.click(screen.getByRole('button', { name: 'Play transcript segment from 00:04' }));
    expect(media.play).not.toHaveBeenCalled();

    fireEvent.loadedMetadata(video);

    expect(media.readCurrentTime()).toBe(4.25);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('resolves canonical active rows for forward jumps, backward seeks and timing gaps', async () => {
    renderStudy();
    const { video, media } = stubUploadMedia();
    fireEvent.loadedMetadata(video);
    const stableFocus = screen.getByRole('button', { name: 'Play transcript segment from 00:00' });
    stableFocus.focus();

    media.setPaused(false);
    media.setCurrentTime(12.5);
    fireEvent.timeUpdate(video);
    expect(await screen.findByLabelText('Currently playing transcript segment'))
      .toHaveTextContent('This segment closes the lecture.');
    expect(stableFocus).toHaveFocus();

    media.setCurrentTime(0.25);
    fireEvent.seeked(video);
    await waitFor(() => {
      expect(screen.getByLabelText('Currently playing transcript segment'))
        .toHaveTextContent('The introduction starts at zero.');
    });

    media.setCurrentTime(9);
    fireEvent.timeUpdate(video);
    await waitFor(() => {
      expect(screen.queryByLabelText('Currently playing transcript segment'))
        .not.toBeInTheDocument();
    });
    expect(stableFocus).toHaveFocus();
  });

  it('suspends following on manual reading and restores it from Resume or Play segment', async () => {
    const user = userEvent.setup();
    renderStudy();
    const { video, media } = stubUploadMedia();
    fireEvent.loadedMetadata(video);
    media.setPaused(false);
    media.setCurrentTime(4.5);
    fireEvent.playing(video);
    expect(await screen.findByLabelText('Currently playing transcript segment')).toBeInTheDocument();

    fireEvent.wheel(screen.getByRole('list', { name: 'Video transcript' }));
    const resume = screen.getByRole('button', { name: 'Resume following' });
    expect(resume).toBeInTheDocument();

    await user.click(resume);
    expect(screen.queryByRole('button', { name: 'Resume following' })).not.toBeInTheDocument();

    fireEvent.wheel(screen.getByRole('list', { name: 'Video transcript' }));
    expect(screen.getByRole('button', { name: 'Resume following' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play transcript segment from 00:00' }));
    expect(screen.queryByRole('button', { name: 'Resume following' })).not.toBeInTheDocument();
  });

  it('keeps the paused status text separate from the Resume following control', () => {
    renderStudy();
    const { video } = stubUploadMedia();
    fireEvent.loadedMetadata(video);
    fireEvent.wheel(screen.getByRole('list', { name: 'Video transcript' }));

    const status = screen.getByText('Transcript following is paused.');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).not.toHaveTextContent('Resume following');
    expect(status.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Resume following' })).toBeInTheDocument();
  });
});

describe('Study Upload playback error safety', () => {
  it('keeps transcript, retry and search usable after a media error', async () => {
    const user = userEvent.setup();
    const onRetryProcessing = vi.fn();
    renderStudy({
      resolvedAssetStatus: 'FAILED',
      statusResponse: {
        assetId: uploadAsset.assetId,
        processingJobId: 'job-1',
        assetStatus: 'FAILED',
        processingJobStatus: 'FAILED',
        failureCode: 'PROCESSING_FAILED',
      },
      focusedTranscriptRowId: 'row-0',
      focusedTranscriptSource: 'assistant',
      onRetryProcessing,
    });
    const { video, media } = stubUploadMedia();
    fireEvent.loadedMetadata(video);
    media.setPaused(false);
    media.setCurrentTime(4.5);
    fireEvent.playing(video);
    expect(await screen.findByLabelText('Currently playing transcript segment')).toBeInTheDocument();

    await act(async () => {
      fireEvent.error(video);
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The uploaded video could not be played.');
    expect(alert).toHaveTextContent('You can keep reading the transcript.');
    expect(alert).not.toHaveTextContent(/MEDIA_ERR|minio|bucket|http|stack|status/i);
    expect(screen.queryByLabelText('Currently playing transcript segment')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(
      'The introduction starts at zero.',
    );
    expect(screen.getByText('This segment explains causal ordering.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Details' }));
    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    expect(onRetryProcessing).toHaveBeenCalledTimes(1);
  });
});
