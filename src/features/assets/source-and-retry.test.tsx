import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import { AssetList } from './components/asset-list';
import { AssetProcessingRetryAction } from './components/asset-processing-retry-action';
import { AssetSourceDetails } from './components/asset-source-details';
import { getAssetFailureCopy } from './model/error-copy';
import type { AssetRecordResponse, AssetSummary } from './model/types';

const uploadAsset: AssetSummary = {
  assetId: 'asset-upload',
  title: 'Uploaded lecture',
  assetStatus: 'FAILED',
  workspaceId: 'workspace-1',
  sourceType: 'UPLOAD',
  youtubeVideoId: null,
  sourceUrl: null,
  createdAt: '2026-07-27T00:00:00Z',
};

const youtubeAsset: AssetSummary = {
  ...uploadAsset,
  assetId: 'asset-youtube',
  title: 'YouTube lecture',
  sourceType: 'YOUTUBE',
  youtubeVideoId: 'abc_DEF-123',
  sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
};

function renderList(assets: AssetSummary[]) {
  render(
    <AssetList
      assets={assets}
      selectedAssetId={null}
      successNotice={null}
      assetsError={null}
      deleteError={null}
      renameError={null}
      deleteBusy={false}
      deletingAssetId={null}
      renameBusy={false}
      renamingAssetId={null}
      assetsLoading={false}
      onSelectAsset={vi.fn()}
      onDeleteAsset={vi.fn()}
      onRenameAsset={vi.fn()}
    />,
  );
}

afterEach(() => cleanup());

describe('source-aware asset rendering', () => {
  it('shows small textual Upload and YouTube indicators on library rows', () => {
    renderList([uploadAsset, youtubeAsset]);

    expect(screen.getByText('Uploaded lecture').closest('.video-row__open')).toHaveTextContent('Upload');
    expect(screen.getByText('YouTube lecture').closest('.video-row__open')).toHaveTextContent('YouTube');
  });

  it('shows canonical YouTube source fields as a safe external link without upload metadata', () => {
    const youtubeRecord: AssetRecordResponse = {
      id: youtubeAsset.assetId,
      originalFilename: null,
      title: youtubeAsset.title,
      status: youtubeAsset.assetStatus,
      workspaceId: youtubeAsset.workspaceId,
      sourceType: 'YOUTUBE',
      youtubeVideoId: youtubeAsset.youtubeVideoId,
      sourceUrl: youtubeAsset.sourceUrl,
      contentType: null,
      sizeBytes: null,
      createdAt: youtubeAsset.createdAt,
      updatedAt: youtubeAsset.createdAt,
    };

    const { container } = render(
      <dl><AssetSourceDetails asset={youtubeAsset} assetRecord={youtubeRecord} /></dl>,
    );

    const link = screen.getByRole('link', { name: /open on youtube.*opens in a new tab/i });
    expect(link).toHaveAttribute('href', youtubeAsset.sourceUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('Filename')).not.toBeInTheDocument();
    expect(screen.queryByText('File type')).not.toBeInTheDocument();
    expect(screen.queryByText('File size')).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('shows available upload metadata and hides nullable values cleanly', () => {
    const uploadRecord: AssetRecordResponse = {
      id: uploadAsset.assetId,
      originalFilename: 'lecture.mp4',
      title: uploadAsset.title,
      status: uploadAsset.assetStatus,
      workspaceId: uploadAsset.workspaceId,
      sourceType: 'UPLOAD',
      youtubeVideoId: null,
      sourceUrl: null,
      contentType: 'video/mp4',
      sizeBytes: 1_048_576,
      createdAt: uploadAsset.createdAt,
      updatedAt: uploadAsset.createdAt,
    };
    const { rerender } = render(
      <dl><AssetSourceDetails asset={uploadAsset} assetRecord={uploadRecord} /></dl>,
    );

    expect(screen.getByText('lecture.mp4')).toBeInTheDocument();
    expect(screen.getByText('video/mp4')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();

    rerender(<dl><AssetSourceDetails asset={uploadAsset} assetRecord={{
      ...uploadRecord,
      originalFilename: null,
      contentType: null,
      sizeBytes: null,
    }} /></dl>);
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Filename')).not.toBeInTheDocument();
  });
});

describe('failed-state copy and retry action', () => {
  it.each([
    ['YOUTUBE_UNAVAILABLE', 'This YouTube video is unavailable or cannot be accessed.'],
    ['YOUTUBE_LIVE_NOT_SUPPORTED', 'Live YouTube videos are not supported.'],
    ['YOUTUBE_DURATION_LIMIT_EXCEEDED', 'This video is longer than the supported limit.'],
    ['YOUTUBE_SIZE_LIMIT_EXCEEDED', 'This video is larger than the supported limit.'],
    ['YOUTUBE_ACQUISITION_TIMEOUT', 'Downloading this video timed out. Try again later.'],
    ['YOUTUBE_ACQUISITION_FAILED', 'The video could not be prepared for processing.'],
    ['PROCESSING_FAILED', 'Processing failed. You can try again.'],
  ])('maps %s to bounded user-facing copy', (code, expectedMessage) => {
    expect(getAssetFailureCopy(code).message).toBe(expectedMessage);
  });

  it('uses a safe fallback for unknown failure codes', () => {
    const copy = getAssetFailureCopy('PROVIDER_STDERR_PRIVATE');
    expect(copy.message).toBe('This video could not be processed. You can try again.');
    expect(JSON.stringify(copy)).not.toContain('PROVIDER_STDERR_PRIVATE');
  });

  it('offers retry for any failed asset and prevents repeated activation while pending', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const view = render(
      <AssetProcessingRetryAction
        assetStatus="FAILED"
        failureCode="PROCESSING_FAILED"
        retryError={null}
        isRetrying={false}
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry processing' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    view.rerender(
      <AssetProcessingRetryAction
        assetStatus="FAILED"
        failureCode="PROCESSING_FAILED"
        retryError={null}
        isRetrying
        onRetry={onRetry}
      />,
    );
    const pendingAction = screen.getByRole('button', { name: 'Retrying processing...' });
    expect(pendingAction).toBeDisabled();
    await user.click(pendingAction);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('handles stale retry conflicts safely and hides retry outside FAILED', () => {
    const conflict = new ApiClientError(
      409,
      'raw provider stderr and stack trace',
      'ASSET_PROCESSING_RETRY_NOT_ALLOWED',
    );
    const view = render(
      <AssetProcessingRetryAction
        assetStatus="FAILED"
        failureCode="YOUTUBE_ACQUISITION_FAILED"
        retryError={conflict}
        isRetrying={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Retry no longer available');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/stderr|stack trace/i);

    view.rerender(
      <AssetProcessingRetryAction
        assetStatus="PROCESSING"
        retryError={null}
        isRetrying={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /retry processing/i })).not.toBeInTheDocument();
  });
});
