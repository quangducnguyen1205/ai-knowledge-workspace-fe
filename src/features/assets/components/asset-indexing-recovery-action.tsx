import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { Button, ErrorBanner, InfoBanner } from '../../../lib/ui';
import { getIndexActionState } from '../model/lifecycle';
import type { AssetIndexResponse, AssetStatus, AssetStatusResponse } from '../model/types';

export function AssetIndexingRecoveryAction({
  resolvedAssetStatus,
  statusResponse,
  transcriptRows,
  transcriptError,
  indexError,
  indexResponse,
  isIndexing,
  onIndex,
}: {
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
  indexError: unknown;
  indexResponse?: AssetIndexResponse;
  isIndexing: boolean;
  onIndex: () => void;
}) {
  const action = getIndexActionState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });

  return (
    <>
      {action ? (
        <div className={`action-card ${!action.canIndex ? 'action-card--muted' : ''}`}>
          <div className="action-card__copy">
            <p className="panel__eyebrow">Explicit indexing</p>
            <h3>{action.title}</h3>
            <p>{action.description}</p>
          </div>
          <Button type="button" tone={action.buttonTone} onClick={onIndex} disabled={!action.canIndex || isIndexing}>
            {isIndexing ? 'Indexing...' : action.buttonLabel}
          </Button>
        </div>
      ) : null}

      {isIndexing ? (
        <InfoBanner title="Indexing transcript" message="Publishing transcript rows to workspace search so this asset becomes discoverable." />
      ) : null}
      {indexResponse ? (
        <InfoBanner tone="success" title="Indexing complete" message={`Indexed ${indexResponse.indexedDocumentCount} transcript rows for this asset.`} />
      ) : null}
      {indexError ? <ErrorBanner error={indexError} /> : null}
    </>
  );
}
