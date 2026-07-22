import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from '../../entities/transcript/model/types';
import type { AssetSummary } from './model/types';
import { AssetIndexingRecoveryAction } from './components/asset-indexing-recovery-action';
import { deriveAssetStatus, shouldPollAssetStatus } from './model/lifecycle';
import { AssetUploadForm } from '../upload/components/asset-upload-form';
import { AssetUploadDialog } from '../upload/components/asset-upload-dialog';
import { ApiClientError } from '../../shared/api/api-error';
import { AssetList } from './components/asset-list';

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
    startMs: null,
    endMs: null,
    text: 'Automatic indexing follows transcript readiness.',
    createdAt: '2026-06-26T10:01:00Z',
  },
];

function renderIndexingRecovery(
  overrides: Partial<ComponentProps<typeof AssetIndexingRecoveryAction>> = {},
) {
  const props: ComponentProps<typeof AssetIndexingRecoveryAction> = {
    resolvedAssetStatus: 'TRANSCRIPT_READY',
    statusResponse: {
      assetId: 'asset-1',
      processingJobId: 'job-1',
      assetStatus: 'TRANSCRIPT_READY',
      processingJobStatus: 'SUCCEEDED',
    },
    transcriptRows,
    transcriptError: null,
    indexError: null,
    indexResponse: undefined,
    isIndexing: false,
    onIndex: vi.fn(),
    ...overrides,
  };

  render(<AssetIndexingRecoveryAction {...props} />);
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

  it('presents manual search preparation only as a secondary recovery action', async () => {
    const user = userEvent.setup();
    const props = renderIndexingRecovery();

    expect(screen.getByText('Recovery')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search preparation needs attention' })).toBeInTheDocument();

    const action = screen.getByRole('button', { name: 'Retry search preparation' });
    expect(action).toHaveClass('button--secondary');
    await user.click(action);
    expect(props.onIndex).toHaveBeenCalledTimes(1);
  });

  it('removes recovery indexing after the automatic searchable transition', () => {
    renderIndexingRecovery({
      resolvedAssetStatus: 'SEARCHABLE',
      statusResponse: {
        assetId: 'asset-1',
        processingJobId: 'job-1',
        assetStatus: 'SEARCHABLE',
        processingJobStatus: 'SUCCEEDED',
      },
    });

    expect(screen.queryByRole('button', { name: 'Retry search preparation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Search preparation needs attention' })).not.toBeInTheDocument();
  });
});

describe('asset upload characterization', () => {
  it('contains upload in a labelled dialog with Escape close and focus restoration', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <AssetUploadDialog
        workspaceName="Distributed Systems"
        uploadError={null}
        isUploading={false}
        onUpload={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Upload video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close upload dialog' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

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
    const titleInput = screen.getByLabelText(/video title/i);
    const fileInput = screen.getByLabelText(/video file/i) as HTMLInputElement;

    await user.type(titleInput, '  Lifecycle lecture  ');
    await user.upload(fileInput, file);
    expect(screen.getByText('lecture.mp4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload video' }));

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
    expect(screen.getByRole('button', { name: 'Upload video' })).toBeDisabled();

    rerender(<AssetUploadForm {...baseProps} isUploading />);
    expect(screen.getByRole('button', { name: 'Uploading video...' })).toBeDisabled();
    expect(screen.getByText('Uploading video')).toBeInTheDocument();
  });

  it('rejects an unsupported selected file before it can submit an upload request', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onUpload = vi.fn();
    render(
      <AssetUploadForm
        workspaceName="Distributed Systems"
        uploadError={null}
        isUploading={false}
        onUpload={onUpload}
      />,
    );
    const fileInput = screen.getByLabelText(/video file/i) as HTMLInputElement;
    const invalidFile = new File(['notes'], 'notes.txt', { type: 'video/mp4' });

    expect(fileInput).toHaveAttribute(
      'accept',
      '.mp4,.mov,.m4v,.webm,.avi,video/mp4,video/quicktime,video/x-m4v,video/webm,application/webm,video/x-msvideo,video/avi,video/msvideo',
    );
    await user.upload(fileInput, invalidFile);

    expect(screen.getByRole('alert')).toHaveTextContent('Choose an MP4, MOV, M4V, WebM, or AVI video.');
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload video' })).toBeDisabled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('clears a client validation error after a compatible video is selected', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onUpload = vi.fn();
    render(
      <AssetUploadForm
        workspaceName="Distributed Systems"
        uploadError={null}
        isUploading={false}
        onUpload={onUpload}
      />,
    );
    const fileInput = screen.getByLabelText(/video file/i) as HTMLInputElement;

    await user.upload(fileInput, new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const validFile = new File(['video'], 'lecture.webm', { type: 'video/webm' });
    await user.upload(fileInput, validFile);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload video' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Upload video' }));
    expect(onUpload).toHaveBeenCalledWith({ file: validFile, title: undefined });
  });

  it('renders the server invalid-upload response with the same safe format guidance', () => {
    render(
      <AssetUploadForm
        workspaceName="Distributed Systems"
        uploadError={new ApiClientError(400, 'Only MP4, MOV, M4V, WebM, and AVI video files are supported', 'INVALID_UPLOAD_FILE')}
        isUploading={false}
        onUpload={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Video format is not supported');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an MP4, MOV, M4V, WebM, or AVI video.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Only MP4, MOV, M4V, WebM, and AVI');
  });
});

describe('video library actions', () => {
  it('keeps Open, Rename, and Delete in a labelled overflow menu without showing the asset id', async () => {
    const user = userEvent.setup();
    const onSelectAsset = vi.fn();
    const onRenameAsset = vi.fn();
    const onDeleteAsset = vi.fn();

    render(
      <AssetList
        assets={[asset]}
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
        onSelectAsset={onSelectAsset}
        onDeleteAsset={onDeleteAsset}
        onRenameAsset={onRenameAsset}
      />,
    );

    expect(screen.queryByText(asset.assetId)).not.toBeInTheDocument();
    const actions = screen.getByRole('button', { name: `Actions for ${asset.title}` });
    await user.click(actions);
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onSelectAsset).toHaveBeenCalledWith(asset.assetId);

    await user.click(actions);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const titleInput = screen.getByLabelText(`New title for ${asset.title}`);
    await user.clear(titleInput);
    await user.type(titleInput, 'Distributed Systems Lecture');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onRenameAsset).toHaveBeenCalledWith(asset, 'Distributed Systems Lecture');

    await user.click(actions);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteAsset).toHaveBeenCalledWith(asset);
  });
});
