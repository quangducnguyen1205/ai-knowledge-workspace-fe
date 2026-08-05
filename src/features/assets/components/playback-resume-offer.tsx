import { formatTranscriptTimestamp } from '../../../entities/transcript/model/transcript-time';
import { Button } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';

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
  const { t } = useTranslation('viewer');
  const formattedPosition = formatTranscriptTimestamp(positionMs);

  return (
    <section className="playback-resume" aria-labelledby="playback-resume-heading">
      <div className="playback-resume__copy">
        <h2 id="playback-resume-heading">{t('resume.heading')}</h2>
        <p>{t('resume.stoppedAt', { position: formattedPosition })}</p>
      </div>
      <div className="playback-resume__actions">
        <Button type="button" onClick={onResume}>
          {t('resume.resume', { position: formattedPosition })}
        </Button>
        <Button type="button" tone="secondary" onClick={onStartFromBeginning}>
          {t('resume.fromStart')}
        </Button>
      </div>
    </section>
  );
}
