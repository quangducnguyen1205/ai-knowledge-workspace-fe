import { Button, ErrorFeedback } from '../../../lib/ui';
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
  if (assetStatus !== 'FAILED') return null;

  const failureCopy = getAssetFailureCopy(failureCode);
  const retryErrorCopy = getFriendlyRetryErrorCopy(retryError);

  return (
    <div className="action-card action-card--failure">
      <div>
        <p className="panel__eyebrow">Recovery</p>
        <h3>{failureCopy.title}</h3>
        <p>{failureCopy.message}</p>
      </div>
      <div>
        <Button type="button" tone="secondary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying processing...' : 'Retry processing'}
        </Button>
      </div>
      {retryError ? (
        <ErrorFeedback
          error={retryError}
          title={retryErrorCopy?.title}
          message={retryErrorCopy?.message}
          detail={retryErrorCopy?.detail}
        />
      ) : null}
    </div>
  );
}
