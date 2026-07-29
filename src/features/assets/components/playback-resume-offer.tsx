import { formatTranscriptTimestamp } from '../../../entities/transcript/model/transcript-time';
import { Button } from '../../../lib/ui';

/**
 * Explicit resume offer. Progress is never applied automatically, and this surface carries no
 * live region so periodic saves are not announced.
 */
export function PlaybackResumeOffer({
  positionMs,
  onResume,
  onStartFromBeginning,
}: {
  positionMs: number;
  onResume: () => void;
  onStartFromBeginning: () => void;
}) {
  const formattedPosition = formatTranscriptTimestamp(positionMs);

  return (
    <section className="playback-resume" aria-labelledby="playback-resume-heading">
      <div className="playback-resume__copy">
        <h2 id="playback-resume-heading">Continue watching</h2>
        <p>You stopped at {formattedPosition}.</p>
      </div>
      <div className="playback-resume__actions">
        <Button type="button" onClick={onResume}>
          Resume from {formattedPosition}
        </Button>
        <Button type="button" tone="secondary" onClick={onStartFromBeginning}>
          Start from beginning
        </Button>
      </div>
    </section>
  );
}
