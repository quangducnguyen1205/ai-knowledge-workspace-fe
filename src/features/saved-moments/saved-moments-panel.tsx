import { useState } from 'react';
import { buildMomentPermalink } from '../../entities/moment/model';
import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, ErrorBanner, LoadingBlock, formatDateTime } from '../../lib/ui';
import { SourceBadge } from '../assets/components/source-badge';
import type { SavedMoment } from './api/saved-moments-api';

export type SavedMomentsPanelProps = {
  workspaceName: string;
  items: readonly SavedMoment[];
  isLoading: boolean;
  error: unknown;
  removingId: string | null;
  removeError: unknown;
  onOpenMoment: (moment: SavedMoment) => void;
  onRemoveMoment: (savedMomentId: string) => void;
};

export function momentTimestampLabel(startMs: number | null): string {
  return startMs !== null && Number.isFinite(startMs) && startMs >= 0
    ? formatTranscriptTimestamp(startMs)
    : 'Time unavailable';
}

/**
 * Saved moments are a small bookmark list, not a second search surface: it presents the current
 * canonical row and the three reversible actions a bookmark needs.
 */
export function SavedMomentsPanel({
  workspaceName,
  items,
  isLoading,
  error,
  removingId,
  removeError,
  onOpenMoment,
  onRemoveMoment,
}: SavedMomentsPanelProps) {
  const [copyState, setCopyState] = useState<{ savedMomentId: string; status: 'copied' | 'failed' } | null>(null);

  async function handleCopy(moment: SavedMoment) {
    const permalink = buildMomentPermalink(moment.assetId, moment.transcriptRowId);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard is unavailable');
      }
      await navigator.clipboard.writeText(permalink);
      setCopyState({ savedMomentId: moment.savedMomentId, status: 'copied' });
    } catch {
      setCopyState({ savedMomentId: moment.savedMomentId, status: 'failed' });
    }
  }

  return (
    <section className="saved-moments" aria-labelledby="saved-moments-title">
      <div className="saved-moments__heading">
        <div>
          <p className="panel__eyebrow">Saved</p>
          <h2 id="saved-moments-title">Saved moments</h2>
        </div>
        {!isLoading && !error && items.length ? (
          <p className="search-summary" role="status">
            <strong>{items.length}</strong> {items.length === 1 ? 'saved moment' : 'saved moments'}
            {' in '}
            {workspaceName}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="saved-moments__status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock label={`Loading saved moments in ${workspaceName}...`} compact />
        </div>
      ) : null}

      {!isLoading && error ? <ErrorBanner error={error} /> : null}
      {removeError ? <ErrorBanner error={removeError} /> : null}

      {!isLoading && !error && items.length === 0 ? (
        <div role="status">
          <EmptyState
            title="No saved moments yet"
            description="Save a moment from a search result or the video transcript to find it again here."
          />
        </div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <ul className="saved-moments__list">
          {items.map((moment) => {
            const timestampLabel = momentTimestampLabel(moment.startMs);
            const describedBy = `saved-moment-text-${moment.savedMomentId}`;
            const isRemoving = removingId === moment.savedMomentId;
            const copyFeedback = copyState?.savedMomentId === moment.savedMomentId ? copyState.status : null;

            return (
              <li key={moment.savedMomentId} className="saved-moment">
                <div className="saved-moment__header">
                  <span className="saved-moment__identity">
                    <span className="saved-moment__asset-title">{moment.assetTitle}</span>
                    {moment.sourceType ? (
                      <SourceBadge sourceType={moment.sourceType} />
                    ) : (
                      <span className="source-badge source-badge--unknown">Source unavailable</span>
                    )}
                  </span>
                  <span className="saved-moment__timestamp">
                    <span>Video moment</span>
                    <span className="saved-moment__timestamp-value">{timestampLabel}</span>
                  </span>
                </div>

                <p className="saved-moment__text" id={describedBy}>{moment.text}</p>
                <p className="saved-moment__saved-at">Saved {formatDateTime(moment.savedAt)}</p>

                <div className="saved-moment__actions">
                  <Button
                    type="button"
                    onClick={() => onOpenMoment(moment)}
                    aria-label={`Open moment in ${moment.assetTitle} at ${timestampLabel.toLowerCase()}`}
                  >
                    Open moment
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => void handleCopy(moment)}
                    aria-label={`Copy link to moment in ${moment.assetTitle} at ${timestampLabel.toLowerCase()}`}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    tone="ghost"
                    className="saved-moment__remove"
                    disabled={isRemoving}
                    onClick={() => onRemoveMoment(moment.savedMomentId)}
                    aria-label={`Remove saved moment in ${moment.assetTitle} at ${timestampLabel.toLowerCase()}`}
                  >
                    {isRemoving ? 'Removing...' : 'Remove'}
                  </Button>
                </div>

                <p className="saved-moment__feedback" role="status" aria-live="polite">
                  {copyFeedback === 'copied' ? 'Link copied to the clipboard.' : null}
                  {copyFeedback === 'failed'
                    ? 'Could not copy the link. Copy it from the address bar after opening the moment.'
                    : null}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
