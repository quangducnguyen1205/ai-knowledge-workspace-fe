import { ErrorBanner, InfoBanner } from '../../../lib/ui';
import { getAssetLifecycleState, getLifecycleSteps } from '../model/lifecycle';
import type { AssetStatus, AssetStatusResponse } from '../model/types';
import type { TranscriptRow } from '../../../entities/transcript/model/types';

export function AssetLifecyclePanel({
  resolvedAssetStatus,
  statusResponse,
  statusError,
  transcriptRows,
  transcriptError,
}: {
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  statusError: unknown;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
}) {
  const input = {
    resolvedAssetStatus,
    processingJobStatus: statusResponse?.processingJobStatus,
    transcriptRows,
    transcriptError,
  };
  const lifecycleState = getAssetLifecycleState(input);
  const lifecycleSteps = getLifecycleSteps(input);

  return (
    <>
      <div className="lifecycle-rail">
        {lifecycleSteps.map((step, index) => (
          <div key={step.label} className={`lifecycle-step lifecycle-step--${step.state}`}>
            <span className="lifecycle-step__index">{index + 1}</span>
            <div className="lifecycle-step__copy">
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
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
    </>
  );
}
