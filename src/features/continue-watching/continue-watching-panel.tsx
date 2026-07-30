import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, ErrorBanner, LoadingBlock, formatDateTime } from '../../lib/ui';
import { SourceBadge } from '../assets/components/source-badge';
import type { ContinueWatchingItem } from './api/continue-watching-api';

export type ContinueWatchingPanelProps = {
  workspaceName: string;
  items: readonly ContinueWatchingItem[];
  isLoading: boolean;
  error: unknown;
  onContinueWatching: (item: ContinueWatchingItem) => void;
};

/** A position that never started, or that the server could not report, has no usable timestamp. */
export function playbackPositionLabel(positionMs: number | null): string {
  return positionMs !== null && Number.isFinite(positionMs) && positionMs > 0
    ? formatTranscriptTimestamp(positionMs)
    : 'Position unavailable';
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
  return (
    <section className="continue-watching" aria-labelledby="continue-watching-title">
      <div className="continue-watching__heading">
        <div>
          <p className="panel__eyebrow">Playback</p>
          <h2 id="continue-watching-title">Continue watching</h2>
        </div>
        {!isLoading && !error && items.length ? (
          <p className="search-summary" role="status">
            <strong>{items.length}</strong> {items.length === 1 ? 'video' : 'videos'} in progress
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="continue-watching__status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock label={`Loading playback progress in ${workspaceName}...`} compact />
        </div>
      ) : null}

      {!isLoading && error ? <ErrorBanner error={error} /> : null}

      {!isLoading && !error && items.length === 0 ? (
        <div role="status">
          <EmptyState
            title="Nothing in progress yet"
            description="Play a video in this workspace and it will appear here so you can pick up where you left off."
          />
        </div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <ul className="continue-watching__list">
          {items.map((item) => {
            const positionLabel = playbackPositionLabel(item.positionMs);

            return (
              <li key={item.assetId} className="continue-watching-item">
                <div className="continue-watching-item__header">
                  <span className="continue-watching-item__identity">
                    <span className="continue-watching-item__title">{item.assetTitle}</span>
                    {item.sourceType ? (
                      <SourceBadge sourceType={item.sourceType} />
                    ) : (
                      <span className="source-badge source-badge--unknown">Source unavailable</span>
                    )}
                  </span>
                  <span className="continue-watching-item__position">
                    <span>Stopped at</span>
                    <span className="continue-watching-item__position-value">{positionLabel}</span>
                  </span>
                </div>

                <p className="continue-watching-item__watched-at">
                  Last watched {formatDateTime(item.updatedAt)}
                </p>

                <div className="continue-watching-item__actions">
                  <Button
                    type="button"
                    onClick={() => onContinueWatching(item)}
                    aria-label={`Continue watching ${item.assetTitle} at ${positionLabel.toLowerCase()}`}
                  >
                    Continue watching
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
