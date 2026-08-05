import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, LoadingBlock, PanelHeading } from '../../shared/ui';
import { ErrorFeedback } from '../../shared/feedback';
import { Trans, useDateTimeFormat, useTranslation } from '../../shared/i18n';
import { SourceBadge } from '../assets/public';
import type { ContinueWatchingItem } from './api/continue-watching-api';

export type ContinueWatchingPanelProps = {
  workspaceName: string;
  items: readonly ContinueWatchingItem[];
  isLoading: boolean;
  error: unknown;
  onContinueWatching: (item: ContinueWatchingItem) => void;
};

/**
 * A position that never started, or that the server could not report, has no usable timestamp.
 * The caller supplies the localized fallback so this helper stays language-independent.
 */
export function playbackPositionLabel(positionMs: number | null, unavailableLabel = ''): string {
  return positionMs !== null && Number.isFinite(positionMs) && positionMs > 0
    ? formatTranscriptTimestamp(positionMs)
    : unavailableLabel;
}

/**
 * Compact list of Assets the viewer can resume. It presents current canonical Asset data and one
 * action; restoring the position stays owned by the viewer's existing playback integration.
 */
export function ContinueWatchingPanel({
  workspaceName,
  items,
  isLoading,
  error,
  onContinueWatching,
}: ContinueWatchingPanelProps) {
  const { t } = useTranslation('moments');
  const formatDateTime = useDateTimeFormat();

  return (
    <section className="continue-watching" aria-labelledby="continue-watching-title">
      <PanelHeading
        eyebrow={t('continueWatching.eyebrow')}
        trailing={!isLoading && !error && items.length ? (
          <p className="search-summary" role="status">
            <Trans i18nKey="continueWatching.count" ns="moments" count={items.length} />
          </p>
        ) : null}
      >
        <h2 id="continue-watching-title">{t('continueWatching.heading')}</h2>
      </PanelHeading>

      {isLoading ? (
        <div className="continue-watching__status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock label={t('continueWatching.loading', { workspace: workspaceName })} compact />
        </div>
      ) : null}

      {!isLoading && error ? <ErrorFeedback error={error} /> : null}

      {!isLoading && !error && items.length === 0 ? (
        <div role="status">
          <EmptyState
            title={t('continueWatching.emptyTitle')}
            description={t('continueWatching.emptyDescription')}
          />
        </div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <ul className="continue-watching__list">
          {items.map((item) => {
            const positionLabel = playbackPositionLabel(item.positionMs, t('continueWatching.positionUnavailable'));

            return (
              <li key={item.assetId} className="continue-watching-item">
                <div className="continue-watching-item__header">
                  <span className="continue-watching-item__identity">
                    <span className="continue-watching-item__title">{item.assetTitle}</span>
                    <SourceBadge sourceType={item.sourceType} />
                  </span>
                  <span className="continue-watching-item__position">
                    <span>{t('continueWatching.stoppedAt')}</span>
                    <span className="continue-watching-item__position-value">{positionLabel}</span>
                  </span>
                </div>

                <p className="continue-watching-item__watched-at">
                  {t('continueWatching.lastWatched', { when: formatDateTime(item.updatedAt) })}
                </p>

                <div className="continue-watching-item__actions">
                  <Button
                    type="button"
                    onClick={() => onContinueWatching(item)}
                    aria-label={t('continueWatching.actionLabel', { title: item.assetTitle, time: positionLabel.toLowerCase() })}
                  >
                    {t('continueWatching.action')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
