import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAssetStatus,
  getAssetTranscript,
  indexAssetTranscript,
  listAssets,
  uploadAsset,
  type AssetIndexResponse,
  type AssetStatus,
  type AssetStatusResponse,
  type AssetSummary,
  type ProcessingJobStatus,
  type TranscriptRow,
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
  assetsLoading,
  uploadError,
  uploadSuccessId,
  isUploading,
  onSelectAsset,
  onUpload,
}: {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAssetId: string | null;
  assetsError: unknown;
  assetsLoading: boolean;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  onSelectAsset: (assetId: string) => void;
  onUpload: (input: { file: File; title?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          {isUploading ? 'Uploading...' : 'Upload into workspace'}
        </Button>

        {uploadError ? <ErrorBanner error={uploadError} /> : null}
      </form>

      <div className="asset-list">
        <div className="asset-list__meta">
          <strong>{assets.length}</strong>
          <span>{assets.length === 1 ? 'asset in scope' : 'assets in scope'}</span>
        </div>

        {assetsLoading ? <LoadingBlock label="Loading workspace assets..." compact /> : null}
        {!assetsLoading && assetsError ? <ErrorBanner error={assetsError} /> : null}

        {!assetsLoading && !assetsError && assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            description="Upload one lecture recording into this workspace to start the demo flow."
          />
        ) : null}

        {!assetsLoading && !assetsError && assets.length > 0 ? (
          <ul className="asset-list__items">
            {assets.map((asset) => {
              const isSelected = asset.assetId === selectedAssetId;

              return (
                <li key={asset.assetId}>
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
                  </button>
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
  onIndex,
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
  onIndex: () => void;
}) {
  const canIndex = Boolean(transcriptRows?.length);
  const statusPairs = useMemo(
    () => [
      ['Workspace', workspaceName],
      ['Asset status', resolvedAssetStatus ?? 'Unknown'],
      ['Processing job', statusResponse?.processingJobStatus ?? 'Waiting for status'],
      ['Created', asset ? formatDateTime(asset.createdAt) : 'Unknown'],
    ],
    [asset, resolvedAssetStatus, statusResponse?.processingJobStatus, workspaceName],
  );

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
    <Section
      title={asset.title}
      eyebrow={workspaceName}
      actions={<StatusBadge status={resolvedAssetStatus} />}
    >
      <div className="detail-grid">
        {statusPairs.map(([label, value]) => (
          <div key={label} className="detail-grid__item">
            <span className="detail-grid__label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {statusError ? <ErrorBanner error={statusError} /> : null}

      {!statusError && resolvedAssetStatus === 'PROCESSING' ? (
        <InfoBanner
          title="Processing is still explicit"
          message="This demo waits for the Spring status endpoint to reach terminal success before transcript fetch becomes meaningful."
        />
      ) : null}

      <div className="panel-block">
        <div className="panel-block__header">
          <h3>Transcript</h3>
          <Button
            type="button"
            tone={resolvedAssetStatus === 'SEARCHABLE' ? 'secondary' : 'primary'}
            onClick={onIndex}
            disabled={!canIndex || isIndexing}
          >
            {isIndexing
              ? 'Indexing...'
              : resolvedAssetStatus === 'SEARCHABLE'
                ? 'Re-index transcript'
                : 'Index transcript'}
          </Button>
        </div>

        {transcriptLoading ? <LoadingBlock label="Loading transcript rows..." /> : null}
        {!transcriptLoading && transcriptError ? <ErrorBanner error={transcriptError} /> : null}
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
          title="Indexing complete"
          message={`Indexed ${indexResponse.indexedDocumentCount} transcript rows for this asset.`}
        />
      ) : null}
      {indexError ? <ErrorBanner error={indexError} /> : null}
    </Section>
  );
}
