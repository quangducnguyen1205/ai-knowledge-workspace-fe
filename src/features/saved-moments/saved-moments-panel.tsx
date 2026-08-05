import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { buildMomentPermalink } from '../../entities/moment/model';
import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, LoadingBlock, PanelHeading } from '../../shared/ui';
import { ErrorFeedback } from '../../shared/feedback';
import { Trans, useDateTimeFormat, useTranslation } from '../../shared/i18n';
import { SourceBadge } from '../assets/public';
import type { SavedMoment } from './api/saved-moments-api';

export type SavedMomentsPanelProps = {
  /** Stable identity of the active Workspace. Owns pending-removal focus; never used as copy. */
  workspaceId: string;
  /** Display name only. Names are not unique, so identity must never be derived from it. */
  workspaceName: string;
  items: readonly SavedMoment[];
  isLoading: boolean;
  error: unknown;
  removingId: string | null;
  removeError: unknown;
  onOpenMoment: (moment: SavedMoment) => void;
  /**
   * Resolves when the removal succeeded and rejects when it failed, so the panel can move focus
   * only after the item actually disappears.
   */
  onRemoveMoment: (savedMomentId: string) => void | Promise<unknown>;
};

/**
 * Focus target chosen at click time from the list as the user sees it: the following item, else
 * the preceding item, else the section heading when the list becomes empty.
 */
type PendingRemovalFocus = {
  removedId: string;
  followingId: string | null;
  previousId: string | null;
  knownIds: ReadonlySet<string>;
  /** The Workspace the removal was started in, by stable ID rather than display name. */
  workspaceId: string;
};

/**
 * A moment with no usable timing has no timestamp to show. The caller passes the localized
 * fallback rather than this module owning copy, so the same helper serves every language.
 */
export function momentTimestampLabel(startMs: number | null, unavailableLabel = ''): string {
  return startMs !== null && Number.isFinite(startMs) && startMs >= 0
    ? formatTranscriptTimestamp(startMs)
    : unavailableLabel;
}

/**
 * Saved moments are a small bookmark list, not a second search surface: it presents the current
 * canonical row and the three reversible actions a bookmark needs.
 */
export function SavedMomentsPanel({
  workspaceId,
  workspaceName,
  items,
  isLoading,
  error,
  removingId,
  removeError,
  onOpenMoment,
  onRemoveMoment,
}: SavedMomentsPanelProps) {
  const { t } = useTranslation(['moments', 'common']);
  const formatDateTime = useDateTimeFormat();
  const [copyState, setCopyState] = useState<{ savedMomentId: string; status: 'copied' | 'failed' } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const removeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingRemovalFocus = useRef<PendingRemovalFocus | null>(null);
  const failedRemovalFocusId = useRef<string | null>(null);

  const registerActionRef = useCallback(
    (refs: MutableRefObject<Map<string, HTMLButtonElement>>, savedMomentId: string) =>
      (element: HTMLButtonElement | null) => {
        if (element) refs.current.set(savedMomentId, element);
        else refs.current.delete(savedMomentId);
      },
    [],
  );

  /**
   * Runs only after a successful removal has actually removed the item from the rendered list, so
   * background refetches, Workspace changes and failed removals never move focus.
   */
  useEffect(() => {
    const pending = pendingRemovalFocus.current;
    if (!pending) return;

    // Stable Workspace identity owns the pending removal, and is checked first so any change of
    // active Workspace discards it outright. Display names are not unique and the replacement list
    // may be empty or even share savedMoment IDs, so neither can be trusted here.
    if (pending.workspaceId !== workspaceId) {
      pendingRemovalFocus.current = null;
      return;
    }

    if (items.some((item) => item.savedMomentId === pending.removedId)) return;

    pendingRemovalFocus.current = null;

    // Within the same Workspace, a refetch that brings an unrelated set is not a removal either.
    if (!items.every((item) => pending.knownIds.has(item.savedMomentId))) return;

    const followingButton = pending.followingId
      ? openButtonRefs.current.get(pending.followingId)
      : undefined;
    const previousButton = pending.previousId
      ? openButtonRefs.current.get(pending.previousId)
      : undefined;
    const target = followingButton ?? previousButton;

    if (target) target.focus();
    else if (items.length === 0) headingRef.current?.focus();
  }, [items, workspaceId]);

  /**
   * Restores focus to a Remove button that a failed removal left disabled, once it is interactive
   * again. Driven by rendered state rather than a timer.
   */
  useEffect(() => {
    const failedId = failedRemovalFocusId.current;
    if (!failedId) return;

    const button = removeButtonRefs.current.get(failedId);
    if (!button || button.disabled) return;

    failedRemovalFocusId.current = null;
    button.focus();
  }, [items, removingId]);

  async function handleRemove(moment: SavedMoment, index: number) {
    // Recorded before awaiting so the focus decision never depends on whether the list re-renders
    // before or after the mutation promise settles. The effect applies it only once the item is
    // actually gone, which only a successful removal can cause.
    pendingRemovalFocus.current = {
      removedId: moment.savedMomentId,
      followingId: items[index + 1]?.savedMomentId ?? null,
      previousId: items[index - 1]?.savedMomentId ?? null,
      knownIds: new Set(items.map((item) => item.savedMomentId)),
      workspaceId,
    };

    try {
      await onRemoveMoment(moment.savedMomentId);
    } catch {
      // The item is still listed. Disabling the button while in flight blurred it, so put focus
      // back where the user left it rather than dropping to the document body.
      pendingRemovalFocus.current = null;
      const button = removeButtonRefs.current.get(moment.savedMomentId);
      if (button && !button.disabled) button.focus();
      else failedRemovalFocusId.current = moment.savedMomentId;
    }
  }

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
      <PanelHeading
        eyebrow={t('saved.eyebrow')}
        trailing={!isLoading && !error && items.length ? (
          <p className="search-summary" role="status">
            <Trans
              i18nKey="saved.count"
              ns="moments"
              count={items.length}
              values={{ workspace: workspaceName }}
            />
          </p>
        ) : null}
      >
        {/* tabIndex -1 keeps the heading out of normal Tab order while allowing programmatic focus. */}
        <h2 id="saved-moments-title" ref={headingRef} tabIndex={-1}>{t('saved.heading')}</h2>
      </PanelHeading>

      {isLoading ? (
        <div className="saved-moments__status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock label={t('saved.loading', { workspace: workspaceName })} compact />
        </div>
      ) : null}

      {!isLoading && error ? <ErrorFeedback error={error} /> : null}
      {removeError ? <ErrorFeedback error={removeError} /> : null}

      {!isLoading && !error && items.length === 0 ? (
        <div role="status">
          <EmptyState
            title={t('saved.emptyTitle')}
            description={t('saved.emptyDescription')}
          />
        </div>
      ) : null}

      {!isLoading && !error && items.length ? (
        <ul className="saved-moments__list">
          {items.map((moment, index) => {
            const timestampLabel = momentTimestampLabel(moment.startMs, t('common:timeUnavailable'));
            const describedBy = `saved-moment-text-${moment.savedMomentId}`;
            const isRemoving = removingId === moment.savedMomentId;
            const copyFeedback = copyState?.savedMomentId === moment.savedMomentId ? copyState.status : null;

            return (
              <li key={moment.savedMomentId} className="saved-moment">
                <div className="saved-moment__header">
                  <span className="saved-moment__identity">
                    <span className="saved-moment__asset-title">{moment.assetTitle}</span>
                    <SourceBadge sourceType={moment.sourceType} />
                  </span>
                  <span className="saved-moment__timestamp">
                    <span>{t('common:videoMoment')}</span>
                    <span className="saved-moment__timestamp-value">{timestampLabel}</span>
                  </span>
                </div>

                <p className="saved-moment__text" id={describedBy}>{moment.text}</p>
                <p className="saved-moment__saved-at">{t('saved.savedAt', { when: formatDateTime(moment.savedAt) })}</p>

                <div className="saved-moment__actions">
                  <Button
                    type="button"
                    ref={registerActionRef(openButtonRefs, moment.savedMomentId)}
                    onClick={() => onOpenMoment(moment)}
                    aria-label={t('saved.openLabel', { title: moment.assetTitle, time: timestampLabel.toLowerCase() })}
                  >
                    {t('saved.open')}
                  </Button>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => void handleCopy(moment)}
                    aria-label={t('saved.copyLabel', { title: moment.assetTitle, time: timestampLabel.toLowerCase() })}
                  >
                    {t('saved.copy')}
                  </Button>
                  <Button
                    type="button"
                    tone="ghost"
                    className="saved-moment__remove"
                    ref={registerActionRef(removeButtonRefs, moment.savedMomentId)}
                    disabled={isRemoving}
                    onClick={() => void handleRemove(moment, index)}
                    aria-label={t('saved.removeLabel', { title: moment.assetTitle, time: timestampLabel.toLowerCase() })}
                  >
                    {isRemoving ? t('saved.removing') : t('saved.remove')}
                  </Button>
                </div>

                <p className="saved-moment__feedback" role="status" aria-live="polite">
                  {copyFeedback === 'copied' ? t('saved.copied') : null}
                  {copyFeedback === 'failed' ? t('saved.copyFailed') : null}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
