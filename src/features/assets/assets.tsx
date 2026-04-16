import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClientError,
  deleteAsset,
  getAssetStatus,
  getAssetTranscript,
  indexAssetTranscript,
  isApiClientError,
  listAssets,
  updateAssetTitle,
  uploadAsset,
  type AssetIndexResponse,
  type AssetStatus,
  type AssetStatusResponse,
  type AssetSummary,
  type ProcessingJobStatus,
  type TranscriptRow,
  type UpdateAssetTitleInput,
} from '../../lib/api';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime } from '../../lib/ui';

export const assetKeys = {
  all: ['assets'] as const,
  list: (workspaceId: string) => ['assets', 'list', workspaceId] as const,
  status: (assetId: string) => ['assets', 'status', assetId] as const,
  transcript: (assetId: string) => ['assets', 'transcript', assetId] as const,
};

export function isTerminalProcessing(status: ProcessingJobStatus | undefined): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED';
}

type FriendlyMessageCopy = {
  title: string;
  message: string;
  detail?: string;
};

type DeleteAssetInput = {
  assetId: string;
  workspaceId: string;
};

type RenameAssetInput = UpdateAssetTitleInput & {
  workspaceId: string;
};

type IndexActionState = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonTone: 'primary' | 'secondary' | 'ghost';
  canIndex: boolean;
};

type AssetLifecycleState = {
  step: string;
  summary: string;
  nextAction: string;
  tone: 'info' | 'success' | 'warning';
};

function getAssetStatusDescription(status: AssetStatus | null): string {
  switch (status) {
    case 'PROCESSING':
      return 'Upload accepted. Wait for transcript readiness before indexing.';
    case 'TRANSCRIPT_READY':
      return 'Transcript rows are available. Explicit indexing is the next step.';
    case 'SEARCHABLE':
      return 'Indexed successfully and eligible for workspace search.';
    case 'FAILED':
      return 'Processing or transcript retrieval failed for this asset.';
    default:
      return 'Asset state not available yet.';
  }
}

function getTechnicalDetail(error: ApiClientError): string | undefined {
  const normalizedMessage = error.message.trim();

  if (!normalizedMessage) {
    return undefined;
  }

  if (
    ['bad request', 'conflict', 'unsupported media type', 'unprocessable entity'].includes(
      normalizedMessage.toLowerCase(),
    )
  ) {
    return error.code ? `Backend detail: ${error.code}` : undefined;
  }

  return error.code
    ? `Backend detail: ${error.code} - ${normalizedMessage}`
    : `Backend detail: ${normalizedMessage}`;
}

function getFriendlyUploadErrorCopy(error: unknown): FriendlyMessageCopy | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 0) {
    return {
      title: 'Upload could not reach Spring',
      message: 'The frontend could not contact the Spring backend, so the upload never started.',
    };
  }

  if ([400, 409, 413, 415, 422].includes(error.status)) {
    return {
      title: 'Upload was rejected',
      message:
        'Spring did not accept this file for processing. Try a supported audio or video file and confirm the selected workspace is still valid.',
      detail: getTechnicalDetail(error),
    };
  }

  return null;
}

function getFriendlyDeleteErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset already removed',
      message: 'Spring says this asset no longer exists. The frontend will refresh the workspace list and clear any stale selected state that still points to it.',
      detail: getTechnicalDetail(error),
    };
  }

  if (
    (error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
    (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')
  ) {
    return {
      tone: 'error',
      title: 'Delete could not finish',
      message: 'Spring could not complete asset deletion because the search integration is unavailable right now. The asset stays visible until the backend confirms removal.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Delete could not reach Spring',
      message: 'The frontend could not contact the Spring backend, so this asset was not removed.',
    };
  }

  return {
    tone: 'error',
    title: 'Delete failed',
    message: 'Spring did not confirm asset deletion. The frontend will keep the current list until the backend says the asset is gone.',
    detail: getTechnicalDetail(error),
  };
}

function getFriendlyRenameErrorCopy(error: unknown): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_ASSET_TITLE') {
    return {
      tone: 'warning',
      title: 'Title was rejected',
      message: 'Use a non-empty title that fits within the current backend length limit, then try saving again.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Asset no longer exists',
      message: 'Spring could not find this asset anymore. The frontend will refresh the workspace list and clear stale selected state if needed.',
      detail: getTechnicalDetail(error),
    };
  }

  if (
    (error.status === 503 && error.code === 'ELASTICSEARCH_UNAVAILABLE') ||
    (error.status === 502 && error.code === 'ELASTICSEARCH_INTEGRATION_ERROR')
  ) {
    return {
      tone: 'error',
      title: 'Rename could not finish',
      message: 'Spring could not sync this title update right now, so the old title stays in place until the backend confirms the change.',
      detail: getTechnicalDetail(error),
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Rename could not reach Spring',
      message: 'The frontend could not contact the Spring backend, so this title was not updated.',
    };
  }

  return {
    tone: 'error',
    title: 'Rename failed',
    message: 'Spring did not confirm the title update, so the old title is still being shown.',
    detail: getTechnicalDetail(error),
  };
}

function getTranscriptConflictCopy(
  error: unknown,
  resolvedAssetStatus: AssetStatus | null,
  processingJobStatus?: ProcessingJobStatus,
): FriendlyMessageCopy | null {
  if (!(isApiClientError(error) && error.status === 409)) {
    return null;
  }

  if (resolvedAssetStatus === 'FAILED' || processingJobStatus === 'FAILED') {
    return {
      title: 'Transcript is unavailable for this asset',
      message: 'Spring marked processing as failed, so there are no transcript rows available to inspect or index.',
      detail: getTechnicalDetail(error),
    };
  }

  if (processingJobStatus === 'SUCCEEDED' || resolvedAssetStatus === 'TRANSCRIPT_READY') {
    return {
      title: 'Transcript rows are still unavailable',
      message:
        'The processing job finished, but Spring has not returned transcript rows for this asset yet. Indexing stays disabled until rows exist.',
      detail: getTechnicalDetail(error),
    };
  }

  return {
    title: 'Transcript is still being prepared',
    message: 'Spring has not exposed transcript rows for this asset yet. Wait for processing to finish before indexing.',
    detail: getTechnicalDetail(error),
  };
}

function getIndexActionState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): IndexActionState {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (transcriptRowCount > 0 && input.resolvedAssetStatus === 'SEARCHABLE') {
    return {
      title: 'Rebuild search documents',
      description:
        'This asset is already searchable. Re-index only if you want Spring search documents refreshed from the current transcript rows.',
      buttonLabel: 'Re-index transcript',
      buttonTone: 'secondary',
      canIndex: true,
    };
  }

  if (transcriptRowCount > 0) {
    return {
      title: 'Make this asset searchable',
      description: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded. Run the explicit indexing step to publish this asset into workspace search.`,
      buttonLabel: 'Index transcript',
      buttonTone: 'primary',
      canIndex: true,
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      title: 'Indexing unavailable',
      description: 'Processing failed for this asset, so Spring has no transcript rows available to index.',
      buttonLabel: 'Indexing unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      title: 'Indexing unavailable',
      description: 'Wait for Spring to finish processing and expose transcript rows before indexing becomes a valid action.',
      buttonLabel: 'Waiting for transcript',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      title: 'Indexing unavailable',
      description: 'Spring did not return transcript rows for this asset, so indexing stays disabled for now.',
      buttonLabel: 'Transcript unavailable',
      buttonTone: 'ghost',
      canIndex: false,
    };
  }

  return {
    title: 'Indexing unavailable',
    description: 'Transcript rows must be available before this frontend can call the explicit index action.',
    buttonLabel: 'Indexing unavailable',
    buttonTone: 'ghost',
    canIndex: false,
  };
}

function getAssetLifecycleState(input: {
  resolvedAssetStatus: AssetStatus | null;
  processingJobStatus?: ProcessingJobStatus;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}): AssetLifecycleState {
  const transcriptRowCount = input.transcriptRows?.length ?? 0;

  if (input.resolvedAssetStatus === 'SEARCHABLE') {
    return {
      step: 'Searchable',
      summary: 'This asset has completed the current lifecycle and can participate in workspace-scoped search.',
      nextAction: 'Use the search panel on the right to run a query and open one hit in transcript context.',
      tone: 'success',
    };
  }

  if (transcriptRowCount > 0) {
    return {
      step: 'Ready to index',
      summary: `${transcriptRowCount} transcript row${transcriptRowCount === 1 ? '' : 's'} loaded for the selected asset.`,
      nextAction: 'Run the explicit indexing action below to make this asset searchable.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'FAILED' || input.processingJobStatus === 'FAILED') {
    return {
      step: 'Failed',
      summary: 'This asset cannot continue through the current demo path because backend processing failed.',
      nextAction: 'Select another asset in the workspace or upload a new file.',
      tone: 'warning',
    };
  }

  if (isApiClientError(input.transcriptError) && input.transcriptError.status === 409) {
    return {
      step: 'Transcript pending',
      summary: 'Processing finished, but transcript rows are still unavailable through Spring.',
      nextAction: 'Stay on this asset until transcript rows appear. Indexing remains unavailable for now.',
      tone: 'warning',
    };
  }

  if (input.resolvedAssetStatus === 'PROCESSING' || !isTerminalProcessing(input.processingJobStatus)) {
    return {
      step: 'Processing',
      summary: 'Spring is still processing this asset, so the transcript and indexing steps are not ready yet.',
      nextAction: 'Wait for processing to finish, then review transcript readiness in this panel.',
      tone: 'warning',
    };
  }

  return {
    step: 'Uploaded',
    summary: 'The asset is selected and waiting for the next backend readiness signal.',
    nextAction: 'Keep the asset selected so status, transcript, and indexing state stay in sync.',
    tone: 'info',
  };
}

export function deriveAssetStatus(
  asset: AssetSummary | null,
  statusResponse: AssetStatusResponse | undefined,
  transcriptRows: TranscriptRow[] | undefined,
  indexResponse: AssetIndexResponse | undefined,
): AssetStatus | null {
  if (indexResponse?.assetStatus) {
    return indexResponse.assetStatus;
  }

  if (asset?.assetStatus === 'SEARCHABLE' || statusResponse?.assetStatus === 'SEARCHABLE') {
    return 'SEARCHABLE';
  }

  if (transcriptRows?.length) {
    return 'TRANSCRIPT_READY';
  }

  return statusResponse?.assetStatus ?? asset?.assetStatus ?? null;
}

export function useAssetsQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? assetKeys.list(workspaceId) : ['assets', 'list', 'empty'],
    queryFn: () => listAssets(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useUploadAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadAsset,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
    },
  });
}

export function useDeleteAssetMutation() {
  return useMutation({
    mutationFn: ({ assetId }: DeleteAssetInput) => deleteAsset(assetId),
  });
}

export function useRenameAssetMutation() {
  return useMutation({
    mutationFn: ({ assetId, title }: RenameAssetInput) => updateAssetTitle({ assetId, title }),
  });
}

export function useAssetStatusQuery(assetId: string | null, pollingEnabled: boolean) {
  return useQuery({
    queryKey: assetId ? assetKeys.status(assetId) : ['assets', 'status', 'empty'],
    queryFn: () => getAssetStatus(assetId as string),
    enabled: Boolean(assetId),
    refetchInterval: pollingEnabled ? 3_000 : false,
  });
}

export function useAssetTranscriptQuery(assetId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: assetId ? assetKeys.transcript(assetId) : ['assets', 'transcript', 'empty'],
    queryFn: () => getAssetTranscript(assetId as string),
    enabled,
    retry: false,
  });
}

export function useIndexAssetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: indexAssetTranscript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.all });
    },
  });
}

export function StatusBadge({ status }: { status: AssetStatus | null }) {
  const normalizedStatus = status ?? 'PROCESSING';

  return <span className={`status-badge status-badge--${normalizedStatus.toLowerCase()}`}>{normalizedStatus}</span>;
}

export function AssetsPanel({
  workspaceName,
  assets,
  selectedAssetId,
  assetsError,
  deleteError,
  deleteBusy,
  deletingAssetId,
  assetsLoading,
  uploadError,
  uploadSuccessId,
  isUploading,
  onSelectAsset,
  onDeleteAsset,
  onUpload,
}: {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAssetId: string | null;
  assetsError: unknown;
  deleteError: unknown;
  deleteBusy: boolean;
  deletingAssetId: string | null;
  assetsLoading: boolean;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
  onUpload: (input: { file: File; title?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadErrorCopy = getFriendlyUploadErrorCopy(uploadError);
  const deleteErrorCopy = getFriendlyDeleteErrorCopy(deleteError);

  useEffect(() => {
    if (uploadSuccessId) {
      setTitle('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      return;
    }

    onUpload({
      file,
      title: title.trim() || undefined,
    });
  }

  return (
    <Section title="Assets" eyebrow={workspaceName}>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Optional title</span>
          <input
            className="field__input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Leave blank to use the filename"
            maxLength={255}
          />
        </label>

        <label className="field">
          <span className="field__label">Media file</span>
          <input
            ref={fileInputRef}
            className="field__input field__input--file"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            accept="video/*,audio/*"
          />
        </label>

        <Button type="submit" disabled={isUploading || !file}>
          {isUploading ? `Uploading to ${workspaceName}...` : 'Upload into workspace'}
        </Button>

        {file ? (
          <div className="selected-file">
            <strong>Selected file</strong>
            <span>{file.name}</span>
          </div>
        ) : null}

        {isUploading ? (
          <InfoBanner
            title="Uploading asset"
            message={`Sending the selected file into ${workspaceName}. The asset should appear here first, then status polling continues.`}
          />
        ) : null}

        {uploadError ? (
          <ErrorBanner
            error={uploadError}
            title={uploadErrorCopy?.title}
            message={uploadErrorCopy?.message}
            detail={uploadErrorCopy?.detail}
          />
        ) : null}
      </form>

      <div className="asset-list">
        <div className="asset-list__meta">
          <strong>{assets.length}</strong>
          <span>{assets.length === 1 ? 'asset in active workspace' : 'assets in active workspace'}</span>
        </div>

        <div className="status-legend">
          <span className="status-legend__label">Status legend</span>
          <StatusBadge status="PROCESSING" />
          <StatusBadge status="TRANSCRIPT_READY" />
          <StatusBadge status="SEARCHABLE" />
          <StatusBadge status="FAILED" />
        </div>

        {assetsLoading ? <LoadingBlock label="Loading workspace assets..." compact /> : null}
        {!assetsLoading && assetsError ? <ErrorBanner error={assetsError} /> : null}
        {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'warning' ? (
          <InfoBanner
            tone="warning"
            title={deleteErrorCopy.title}
            message={deleteErrorCopy.message}
            detail={deleteErrorCopy.detail}
          />
        ) : null}
        {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'error' ? (
          <ErrorBanner
            error={deleteError}
            title={deleteErrorCopy.title}
            message={deleteErrorCopy.message}
            detail={deleteErrorCopy.detail}
          />
        ) : null}

        {!assetsLoading && !assetsError && assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            description="Upload one lecture or recording into this workspace to start processing, transcript review, and search preparation."
          />
        ) : null}

        {!assetsLoading && !assetsError && assets.length > 0 ? (
          <ul className="asset-list__items">
            {assets.map((asset) => {
              const isSelected = asset.assetId === selectedAssetId;
              const isDeleting = deletingAssetId === asset.assetId;

              return (
                <li key={asset.assetId} className="asset-row">
                  <button
                    type="button"
                    className={`asset-card ${isSelected ? 'asset-card--selected' : ''}`}
                    onClick={() => onSelectAsset(asset.assetId)}
                  >
                    <div className="asset-card__header">
                      <strong>{asset.title}</strong>
                      <StatusBadge status={asset.assetStatus} />
                    </div>
                    <div className="asset-card__meta">
                      <span>{formatDateTime(asset.createdAt)}</span>
                      <span className="asset-card__id">{asset.assetId}</span>
                    </div>
                    <p className="asset-card__summary">{getAssetStatusDescription(asset.assetStatus)}</p>
                  </button>
                  <Button
                    type="button"
                    tone="ghost"
                    className="asset-row__delete"
                    onClick={() => onDeleteAsset(asset)}
                    disabled={deleteBusy}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

export function SelectedAssetPanel({
  asset,
  workspaceName,
  resolvedAssetStatus,
  statusResponse,
  statusError,
  transcriptRows,
  transcriptError,
  transcriptLoading,
  indexError,
  indexResponse,
  isIndexing,
  isRenaming,
  renameError,
  onIndex,
  onRename,
  onResetRename,
}: {
  asset: AssetSummary | null;
  workspaceName: string;
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  statusError: unknown;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
  transcriptLoading: boolean;
  indexError: unknown;
  indexResponse?: AssetIndexResponse;
  isIndexing: boolean;
  isRenaming: boolean;
  renameError: unknown;
  onIndex: () => void;
  onRename: (title: string) => void;
  onResetRename: () => void;
}) {
  const transcriptRowCount = transcriptRows?.length ?? 0;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const transcriptConflictCopy = getTranscriptConflictCopy(
    transcriptError,
    resolvedAssetStatus,
    statusResponse?.processingJobStatus,
  );
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);
  const indexActionState = getIndexActionState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });
  const lifecycleState = getAssetLifecycleState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });
  const statusPairs = useMemo(
    () => [
      ['Workspace', workspaceName],
      ['Asset status', resolvedAssetStatus ?? 'Unknown'],
      ['Processing job', statusResponse?.processingJobStatus ?? 'Waiting for status'],
      ['Transcript rows', transcriptRowCount > 0 ? String(transcriptRowCount) : 'Not loaded yet'],
      ['Created', asset ? formatDateTime(asset.createdAt) : 'Unknown'],
    ],
    [asset, resolvedAssetStatus, statusResponse?.processingJobStatus, transcriptRowCount, workspaceName],
  );

  useEffect(() => {
    if (!asset) {
      setDraftTitle('');
      setIsEditingTitle(false);
      return;
    }

    setDraftTitle(asset.title);
    setIsEditingTitle(false);
  }, [asset?.assetId, asset?.title]);

  if (!asset) {
    return (
      <Section title="Selected Asset" eyebrow="Details">
        <EmptyState
          title="Pick an asset"
          description="Choose an uploaded item from the left panel to inspect status, transcript rows, and indexing."
        />
      </Section>
    );
  }

  return (
    <Section title="Selected Asset" eyebrow={workspaceName} actions={<StatusBadge status={resolvedAssetStatus} />}>
      <div className="selected-asset-title">
        <div className="selected-asset-title__copy">
          <p className="panel__eyebrow">Current asset title</p>
          {!isEditingTitle ? <h3>{asset.title}</h3> : null}
          {!isEditingTitle ? (
            <p className="selected-asset-title__hint">
              Keep the title readable here so it also stays clear in the asset list and search results.
            </p>
          ) : null}
        </div>

        {!isEditingTitle ? (
          <Button
            type="button"
            tone="ghost"
            className="button--inline"
            onClick={() => {
              onResetRename();
              setDraftTitle(asset.title);
              setIsEditingTitle(true);
            }}
            disabled={isRenaming}
          >
            Rename
          </Button>
        ) : (
          <form
            className="selected-asset-title__form"
            onSubmit={(event) => {
              event.preventDefault();
              const normalizedTitle = draftTitle.trim();

              if (normalizedTitle === asset.title.trim()) {
                onResetRename();
                setDraftTitle(asset.title);
                setIsEditingTitle(false);
                return;
              }

              onRename(normalizedTitle);
            }}
          >
            <input
              className="field__input"
              type="text"
              value={draftTitle}
              onChange={(event) => {
                if (renameError) {
                  onResetRename();
                }
                setDraftTitle(event.target.value);
              }}
              maxLength={255}
              autoFocus
              disabled={isRenaming}
            />
            <div className="selected-asset-title__actions">
              <Button type="submit" className="button--inline" disabled={isRenaming}>
                {isRenaming ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                tone="ghost"
                className="button--inline"
                onClick={() => {
                  onResetRename();
                  setDraftTitle(asset.title);
                  setIsEditingTitle(false);
                }}
                disabled={isRenaming}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {renameErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          tone="warning"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}
      {renameErrorCopy?.tone === 'error' ? (
        <ErrorBanner
          error={renameError}
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
          detail={renameErrorCopy.detail}
        />
      ) : null}

      <div className="detail-grid">
        {statusPairs.map(([label, value]) => (
          <div key={label} className="detail-grid__item">
            <span className="detail-grid__label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {statusError ? <ErrorBanner error={statusError} /> : null}

      {!statusError ? (
        <InfoBanner
          tone={lifecycleState.tone}
          title={`Current asset step: ${lifecycleState.step}`}
          message={lifecycleState.summary}
          detail={`Next: ${lifecycleState.nextAction}`}
        />
      ) : null}

      <div className="panel-block">
        <div className={`action-card ${!indexActionState.canIndex ? 'action-card--muted' : ''}`}>
          <div className="action-card__copy">
            <p className="panel__eyebrow">Explicit indexing</p>
            <h3>{indexActionState.title}</h3>
            <p>{indexActionState.description}</p>
          </div>
          <Button
            type="button"
            tone={indexActionState.buttonTone}
            onClick={onIndex}
            disabled={!indexActionState.canIndex || isIndexing}
          >
            {isIndexing ? 'Indexing...' : indexActionState.buttonLabel}
          </Button>
        </div>

        {isIndexing ? (
          <InfoBanner
            title="Indexing transcript"
            message="Writing transcript rows through the Spring index endpoint so this asset can participate in workspace search."
          />
        ) : null}

        <div className="panel-block__header">
          <h3>Transcript</h3>
          <span className="context-panel__hint">Transcript rows are shown only when Spring says they are ready</span>
        </div>

        {transcriptLoading ? <LoadingBlock label="Loading transcript rows..." /> : null}
        {!transcriptLoading && transcriptConflictCopy ? (
          <InfoBanner
            tone="warning"
            title={transcriptConflictCopy.title}
            message={transcriptConflictCopy.message}
            detail={transcriptConflictCopy.detail}
          />
        ) : null}
        {!transcriptLoading && transcriptError && !transcriptConflictCopy ? <ErrorBanner error={transcriptError} /> : null}
        {!transcriptLoading && !transcriptError && !transcriptRows?.length ? (
          <EmptyState
            title="Transcript not loaded yet"
            description="Once the selected asset reaches terminal success, the frontend will fetch transcript rows through Spring."
          />
        ) : null}

        {transcriptRows?.length ? (
          <ol className="transcript-list">
            {transcriptRows.map((row) => (
              <li key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`} className="transcript-list__item">
                <div className="transcript-list__meta">
                  <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                  <span>{formatDateTime(row.createdAt)}</span>
                </div>
                <p>{row.text}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {indexResponse ? (
        <InfoBanner
          tone="success"
          title="Indexing complete"
          message={`Indexed ${indexResponse.indexedDocumentCount} transcript rows for this asset.`}
        />
      ) : null}
      {indexError ? <ErrorBanner error={indexError} /> : null}
    </Section>
  );
}
