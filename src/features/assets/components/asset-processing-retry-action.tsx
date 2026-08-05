import { Button, ErrorFeedback } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { getAssetFailureCopy, getFriendlyRetryErrorCopy } from '../model/error-copy';
import type { AssetStatus } from '../model/types';

export function AssetProcessingRetryAction({
  assetStatus,
  failureCode,
  retryError,
  isRetrying,
  onRetry,
}: {
  assetStatus: AssetStatus | null;
  failureCode?: string | null;
  retryError: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation(['viewer']);

  if (assetStatus !== 'FAILED') return null;

  const failureCopy = getAssetFailureCopy(failureCode);
  const retryErrorCopy = getFriendlyRetryErrorCopy(retryError);

  return (
    <div className="action-card action-card--failure">
      <div>
        <p className="panel__eyebrow">{t('recovery.eyebrow')}</p>
        <h3>{t(failureCopy.titleKey)}</h3>
        <p>{t(failureCopy.messageKey)}</p>
      </div>
      <div>
        <Button type="button" tone="secondary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? t('recovery.retrying') : t('recovery.retry')}
        </Button>
      </div>
      {retryError ? (
        <ErrorFeedback
          error={retryError}
          title={retryErrorCopy ? t(retryErrorCopy.titleKey) : undefined}
          message={retryErrorCopy ? t(retryErrorCopy.messageKey) : undefined}
        />
      ) : null}
    </div>
  );
}
