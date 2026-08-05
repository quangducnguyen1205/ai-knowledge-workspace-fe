import { useEffect } from 'react';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { Button, ErrorFeedback, InfoBanner, SuccessNotification } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { useEphemeralNotice } from '../../../shared/ui/use-ephemeral-notice';
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
  const { t } = useTranslation(['viewer']);
  const { notice, showNotice, clearNotice } = useEphemeralNotice(
    statusResponse?.assetId ?? indexResponse?.assetId ?? 'no-asset',
  );
  const action = getIndexActionState({
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  });

  useEffect(() => {
    if (indexResponse) {
      showNotice({
        id: 'asset-indexed',
        title: t('recovery.indexedTitle'),
        message: t('recovery.indexedMessage'),
      });
    } else {
      clearNotice();
    }
  }, [clearNotice, indexResponse, showNotice, t]);

  return (
    <>
      {action ? (
        <div className={`action-card ${!action.canIndex ? 'action-card--muted' : ''}`}>
          <div className="action-card__copy">
            <p className="panel__eyebrow">{t('recovery.eyebrow')}</p>
            <h3>{t(action.titleKey)}</h3>
            <p>{t(action.descriptionKey)}</p>
          </div>
          <Button type="button" tone={action.buttonTone} onClick={onIndex} disabled={!action.canIndex || isIndexing}>
            {isIndexing ? t('recovery.indexing') : t(action.buttonLabelKey)}
          </Button>
        </div>
      ) : null}

      {isIndexing ? (
        <InfoBanner title={t('recovery.indexingTitle')} message={t('recovery.indexingMessage')} />
      ) : null}
      {notice ? (
        <SuccessNotification title={notice.title} message={notice.message} onDismiss={notice.dismiss} />
      ) : null}
      {indexError ? <ErrorFeedback error={indexError} /> : null}
    </>
  );
}
