import { useEffect, useMemo, useState } from 'react';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { Button, EmptyState, ErrorBanner, InfoBanner, Section, formatDateTime } from '../../../lib/ui';
import { getFriendlyRenameErrorCopy } from '../model/error-copy';
import type { AssetIndexResponse, AssetStatus, AssetStatusResponse, AssetSummary } from '../model/types';
import { AssetIndexingRecoveryAction } from './asset-indexing-recovery-action';
import { AssetLifecyclePanel } from './asset-lifecycle-panel';
import { StatusBadge } from './status-badge';

export type SelectedAssetPanelProps = {
  asset: AssetSummary | null;
  workspaceName: string;
  successNotice: { title: string; message: string } | null;
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
};

export function SelectedAssetPanel(props: SelectedAssetPanelProps) {
  const {
    asset, workspaceName, successNotice, resolvedAssetStatus, statusResponse, statusError,
    transcriptRows, transcriptError, indexError, indexResponse, isIndexing, isRenaming,
    renameError, onIndex, onRename, onResetRename,
  } = props;
  const transcriptRowCount = transcriptRows?.length ?? 0;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const normalizedDraftTitle = draftTitle.trim();
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);
  const statusPairs = useMemo(() => [
    ['Workspace', workspaceName],
    ['Asset status', resolvedAssetStatus ?? 'Unknown'],
    ['Processing job', statusResponse?.processingJobStatus ?? 'Waiting for status'],
    ['Transcript rows', transcriptRowCount > 0 ? String(transcriptRowCount) : 'Not loaded yet'],
    ['Created', asset ? formatDateTime(asset.createdAt) : 'Unknown'],
  ], [asset, resolvedAssetStatus, statusResponse?.processingJobStatus, transcriptRowCount, workspaceName]);

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
      <Section title="Asset Detail" eyebrow="Asset details">
        <EmptyState title="Pick an asset" description="Choose an uploaded asset to review status, read the transcript, and control when it becomes searchable." />
      </Section>
    );
  }

  return (
    <Section title="Asset Detail" eyebrow={workspaceName} actions={<StatusBadge status={resolvedAssetStatus} />}>
      <div className="selected-asset-title">
        <div className="selected-asset-title__copy">
          <p className="panel__eyebrow">Selected asset</p>
          {!isEditingTitle ? <h3>{asset.title}</h3> : null}
          {!isEditingTitle ? <p className="selected-asset-title__hint">Keep the title clear here so it stays readable in the library and search results.</p> : null}
        </div>

        {!isEditingTitle ? (
          <Button
            type="button"
            tone="ghost"
            className="button--inline"
            onClick={() => { onResetRename(); setDraftTitle(asset.title); setIsEditingTitle(true); }}
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
                onResetRename(); setDraftTitle(asset.title); setIsEditingTitle(false); return;
              }
              onRename(normalizedTitle);
            }}
          >
            <input
              className="field__input"
              type="text"
              value={draftTitle}
              onChange={(event) => { if (renameError) onResetRename(); setDraftTitle(event.target.value); }}
              maxLength={255}
              autoFocus
              disabled={isRenaming}
            />
            <div className="selected-asset-title__actions">
              <Button type="submit" className="button--inline" disabled={isRenaming || !normalizedDraftTitle || normalizedDraftTitle === asset.title.trim()}>
                {isRenaming ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                tone="ghost"
                className="button--inline"
                onClick={() => { onResetRename(); setDraftTitle(asset.title); setIsEditingTitle(false); }}
                disabled={isRenaming}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {renameErrorCopy?.tone === 'warning' ? <InfoBanner tone="warning" title={renameErrorCopy.title} message={renameErrorCopy.message} detail={renameErrorCopy.detail} /> : null}
      {renameErrorCopy?.tone === 'error' ? <ErrorBanner error={renameError} title={renameErrorCopy.title} message={renameErrorCopy.message} detail={renameErrorCopy.detail} /> : null}
      {successNotice ? <InfoBanner tone="success" title={successNotice.title} message={successNotice.message} /> : null}

      <div className="detail-grid">
        {statusPairs.map(([label, value]) => (
          <div key={label} className="detail-grid__item"><span className="detail-grid__label">{label}</span><strong>{value}</strong></div>
        ))}
      </div>

      <AssetLifecyclePanel
        resolvedAssetStatus={resolvedAssetStatus}
        statusResponse={statusResponse}
        statusError={statusError}
        transcriptRows={transcriptRows}
        transcriptError={transcriptError}
      />
      <AssetIndexingRecoveryAction
        resolvedAssetStatus={resolvedAssetStatus}
        statusResponse={statusResponse}
        transcriptRows={transcriptRows}
        transcriptError={transcriptError}
        indexError={indexError}
        indexResponse={indexResponse}
        isIndexing={isIndexing}
        onIndex={onIndex}
      />
    </Section>
  );
}
