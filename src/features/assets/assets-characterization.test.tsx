import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import type { AssetSummary } from './model/types';
import { SelectedAssetPanel } from './components/selected-asset-panel';
import { deriveAssetStatus, shouldPollAssetStatus } from './model/lifecycle';
import { AssetUploadForm } from '../upload/components/asset-upload-form';

const asset: AssetSummary = {
  assetId: 'asset-1',
  title: 'Indexing Lecture',
  assetStatus: 'TRANSCRIPT_READY',
  workspaceId: 'workspace-1',
  createdAt: '2026-06-26T10:00:00Z',
};

const transcriptRows: TranscriptRow[] = [
  {
    id: 'row-1',
    videoId: 'asset-1',
    segmentIndex: 1,
    text: 'Automatic indexing follows transcript readiness.',
    createdAt: '2026-06-26T10:01:00Z',
  },
];

function renderSelectedAssetPanel(
  overrides: Partial<ComponentProps<typeof SelectedAssetPanel>> = {},
) {
  const props: ComponentProps<typeof SelectedAssetPanel> = {
    asset,
    workspaceName: 'Distributed Systems',
    successNotice: null,
    resolvedAssetStatus: 'TRANSCRIPT_READY',
    statusResponse: {
      assetId: 'asset-1',
      processingJobId: 'job-1',
      assetStatus: 'TRANSCRIPT_READY',
      processingJobStatus: 'SUCCEEDED',
    },
    statusError: null,
    transcriptRows,
    transcriptError: null,
    transcriptLoading: false,
    indexError: null,
    indexResponse: undefined,
    isIndexing: false,
    isRenaming: false,
    renameError: null,
    onIndex: vi.fn(),
    onRename: vi.fn(),
    onResetRename: vi.fn(),
    ...overrides,
  };

  render(<SelectedAssetPanel {...props} />);
  return props;
}

afterEach(() => cleanup());

describe('asset lifecycle characterization', () => {
  it('polls only processing and transcript-ready states', () => {
    expect(
      (['PROCESSING', 'TRANSCRIPT_READY', 'SEARCHABLE', 'FAILED'] as const).map(shouldPollAssetStatus),
    ).toEqual([true, true, false, false]);
    expect(shouldPollAssetStatus(null)).toBe(false);
  });

  it('keeps searchable and explicit-index responses ahead of stale list state', () => {
    expect(
      deriveAssetStatus(
        { ...asset, assetStatus: 'PROCESSING' },
        {
          assetId: asset.assetId,
          processingJobId: 'job-1',
          assetStatus: 'SEARCHABLE',
          processingJobStatus: 'SUCCEEDED',
        },
        undefined,
        undefined,
      ),
    ).toBe('SEARCHABLE');

    expect(
      deriveAssetStatus(asset, undefined, transcriptRows, {
        assetId: asset.assetId,
        assetStatus: 'SEARCHABLE',
        indexedDocumentCount: 1,
      }),
    ).toBe('SEARCHABLE');
  });

  it('presents explicit indexing as a secondary recovery action', async () => {
    const user = userEvent.setup();
    const props = renderSelectedAssetPanel();

    expect(screen.getByText('Explicit indexing')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Indexing fallback' })).toBeInTheDocument();
    expect(screen.getByText(/automatic indexing has not completed/i)).toBeInTheDocument();

    const action = screen.getByRole('button', { name: 'Index transcript' });
    expect(action).toHaveClass('button--secondary');
    await user.click(action);
    expect(props.onIndex).toHaveBeenCalledTimes(1);
  });

  it('removes recovery indexing after the automatic searchable transition', () => {
    renderSelectedAssetPanel({
      asset: { ...asset, assetStatus: 'SEARCHABLE' },
      resolvedAssetStatus: 'SEARCHABLE',
      statusResponse: {
        assetId: 'asset-1',
        processingJobId: 'job-1',
        assetStatus: 'SEARCHABLE',
        processingJobStatus: 'SUCCEEDED',
      },
    });

    expect(screen.queryByRole('button', { name: 'Index transcript' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Indexing fallback' })).not.toBeInTheDocument();
  });
});

describe('asset upload characterization', () => {
  it('submits the trimmed optional title and resets file controls after success', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const props: ComponentProps<typeof AssetUploadForm> = {
      workspaceName: 'Distributed Systems',
      uploadError: null,
      uploadSuccessId: undefined,
      isUploading: false,
      onUpload,
    };
    const { rerender } = render(<AssetUploadForm {...props} />);
    const file = new File(['video'], 'lecture.mp4', { type: 'video/mp4' });
    const titleInput = screen.getByLabelText(/asset title/i);
    const fileInput = screen.getByLabelText(/source file/i) as HTMLInputElement;

    await user.type(titleInput, '  Lifecycle lecture  ');
    await user.upload(fileInput, file);
    expect(screen.getByText('lecture.mp4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload to workspace' }));

    expect(onUpload).toHaveBeenCalledWith({ file, title: 'Lifecycle lecture' });

    rerender(<AssetUploadForm {...props} uploadSuccessId="asset-2" />);
    expect(titleInput).toHaveValue('');
    expect(fileInput).toHaveValue('');
    expect(fileInput.files).toHaveLength(0);
  });

  it('keeps submission disabled until a file is selected and while uploading', () => {
    const baseProps: ComponentProps<typeof AssetUploadForm> = {
      workspaceName: 'Distributed Systems',
      uploadError: null,
      isUploading: false,
      onUpload: vi.fn(),
    };

    const { rerender } = render(<AssetUploadForm {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Upload to workspace' })).toBeDisabled();

    rerender(<AssetUploadForm {...baseProps} isUploading />);
    expect(screen.getByRole('button', { name: /uploading to distributed systems/i })).toBeDisabled();
    expect(screen.getByText('Upload in progress')).toBeInTheDocument();
  });
});
