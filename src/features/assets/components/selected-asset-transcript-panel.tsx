import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../../entities/transcript/model/transcript-display';
import { getTranscriptRowIdentity } from '../../../entities/transcript/model/active-transcript-row';
import { formatTranscriptTimestamp } from '../../../entities/transcript/model/transcript-time';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { EmptyState, ErrorFeedback, InfoBanner, LoadingBlock, Section } from '../../../lib/ui';
import { useTranslation } from '../../../shared/i18n';
import { getTranscriptConflictCopy } from '../model/error-copy';
import type { AssetStatus, AssetStatusResponse, AssetSummary } from '../model/types';

export type TranscriptFollowMode = 'following' | 'suspended-by-user';

type TranscriptRowGeometry = Pick<DOMRect, 'top' | 'bottom' | 'height'>;

type TranscriptViewportMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/**
 * Resolves the transcript viewport `scrollTop` that centers a row, or `null` when no scroll is
 * warranted.
 *
 * Native `scrollIntoView` may scroll every scrollable ancestor including the document, which
 * repositions the whole Study page while playback advances. Transcript following therefore
 * computes a clamped viewport-only target instead.
 */
export function resolveTranscriptScrollTop(
  rowRect: TranscriptRowGeometry,
  viewportRect: TranscriptRowGeometry,
  viewport: TranscriptViewportMetrics,
  force: boolean,
): number | null {
  const edgeThreshold = Math.min(48, Math.max(0, viewportRect.height * 0.15));
  const rowNearEdge =
    rowRect.top < viewportRect.top + edgeThreshold ||
    rowRect.bottom > viewportRect.bottom - edgeThreshold;
  if (!force && !rowNearEdge) return null;

  const rowOffsetInContent = rowRect.top - viewportRect.top + viewport.scrollTop;
  const centeredScrollTop = rowOffsetInContent - (viewport.clientHeight - rowRect.height) / 2;
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const targetScrollTop = Math.round(
    Math.min(Math.max(centeredScrollTop, 0), maxScrollTop),
  );

  return targetScrollTop === Math.round(viewport.scrollTop) ? null : targetScrollTop;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scrolls only the transcript viewport; never the window or any other ancestor. */
function scrollTranscriptViewportTo(viewport: HTMLElement, scrollTop: number) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

  if (typeof viewport.scrollTo === 'function') {
    viewport.scrollTo({ top: scrollTop, behavior });
    return;
  }

  viewport.scrollTop = scrollTop;
}

function alignTranscriptRow(
  row: HTMLElement | null,
  viewport: HTMLElement | null,
  force: boolean,
) {
  if (!row || !viewport) return;

  const target = resolveTranscriptScrollTop(
    row.getBoundingClientRect(),
    viewport.getBoundingClientRect(),
    viewport,
    force,
  );
  if (target === null) return;

  scrollTranscriptViewportTo(viewport, target);
}

export function SelectedAssetTranscriptPanel({
  asset,
  workspaceName,
  resolvedAssetStatus,
  statusResponse,
  transcriptRows,
  transcriptError,
  transcriptLoading,
  focusedTranscriptRowId,
  focusedTranscriptSource,
  activePlaybackRowId,
  followMode = 'following',
  transcriptViewVisible = true,
  onSuspendFollowing,
  onResumeFollowing,
  onPlaySegment,
  momentAction,
  embedded = false,
}: {
  asset: AssetSummary | null;
  workspaceName: string;
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
  transcriptLoading: boolean;
  focusedTranscriptRowId?: string | null;
  focusedTranscriptSource?: 'search' | 'assistant' | null;
  activePlaybackRowId?: string | null;
  followMode?: TranscriptFollowMode;
  transcriptViewVisible?: boolean;
  onSuspendFollowing?: () => void;
  onResumeFollowing?: () => void;
  onPlaySegment?: (startMs: number, rowIdentity: string) => void;
  /** Optional control for the currently selected moment; kept outside every interactive row. */
  momentAction?: ReactNode;
  embedded?: boolean;
}) {
  const { t } = useTranslation(['viewer', 'common']);
  const transcriptConflictCopy = getTranscriptConflictCopy(transcriptError, resolvedAssetStatus, statusResponse?.processingJobStatus);
  const focusedRowRef = useRef<HTMLLIElement | null>(null);
  const activePlaybackRowRef = useRef<HTMLLIElement | null>(null);
  const transcriptListRef = useRef<HTMLOListElement>(null);
  const displayTranscriptRows = useMemo(
    () => (transcriptRows?.length ? buildTranscriptDisplayRows(transcriptRows) : []),
    [transcriptRows],
  );
  const focusedRowIsVisible = Boolean(
    focusedTranscriptRowId && displayTranscriptRows.some(({ row }) => matchesTranscriptReference(row, focusedTranscriptRowId)),
  );
  const focusedRowLabel = focusedTranscriptSource === 'assistant'
    ? t('transcript.labelCitation')
    : focusedTranscriptSource === 'search'
      ? t('transcript.labelSearchMatch')
      : t('transcript.labelSelected');
  const missingFocusedRowKey = focusedTranscriptSource === 'assistant'
    ? 'transcript.missingCitation'
    : 'transcript.missingSelected';

  const scrollToActivePlaybackRow = useCallback((force: boolean) => {
    if (!transcriptViewVisible) return;
    alignTranscriptRow(activePlaybackRowRef.current, transcriptListRef.current, force);
  }, [transcriptViewVisible]);

  useEffect(() => {
    if (
      !focusedTranscriptRowId ||
      transcriptLoading ||
      !focusedRowIsVisible ||
      !transcriptViewVisible
    ) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const focusedRow = focusedRowRef.current;
      if (!focusedRow) return;
      alignTranscriptRow(focusedRow, transcriptListRef.current, true);
      focusedRow.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusedRowIsVisible, focusedTranscriptRowId, transcriptLoading, transcriptViewVisible]);

  useEffect(() => {
    if (
      !activePlaybackRowId ||
      followMode !== 'following' ||
      !transcriptViewVisible
    ) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      scrollToActivePlaybackRow(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activePlaybackRowId,
    followMode,
    scrollToActivePlaybackRow,
    transcriptViewVisible,
  ]);

  function suspendForKeyboard(event: KeyboardEvent<HTMLOListElement>) {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
      onSuspendFollowing?.();
    }
  }

  function suspendForScrollbar(event: PointerEvent<HTMLOListElement>) {
    const viewport = event.currentTarget;
    const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
    if (scrollbarWidth <= 0) return;
    const rect = viewport.getBoundingClientRect();
    if (event.clientX >= rect.right - scrollbarWidth) onSuspendFollowing?.();
  }

  function suspendForSelection() {
    const viewport = transcriptListRef.current;
    const selection = window.getSelection();
    if (
      !viewport ||
      !selection ||
      selection.isCollapsed ||
      (
        !(selection.anchorNode && viewport.contains(selection.anchorNode)) &&
        !(selection.focusNode && viewport.contains(selection.focusNode))
      )
    ) {
      return;
    }
    onSuspendFollowing?.();
  }

  if (!asset) return null;

  const content = (
      <div className="transcript-panel">
        <div className="panel-block__header">
          <div>
            <p className="panel__eyebrow">{workspaceName}</p>
            <h2>{t('transcript.heading')}</h2>
          </div>
          {momentAction ? <div className="panel-block__actions">{momentAction}</div> : null}
        </div>

        {transcriptLoading ? <LoadingBlock label={t('transcript.loading')} /> : null}
        {!transcriptLoading && transcriptConflictCopy ? (
          <InfoBanner tone="warning" title={t(transcriptConflictCopy.titleKey)} message={t(transcriptConflictCopy.messageKey)} />
        ) : null}
        {!transcriptLoading && transcriptError && !transcriptConflictCopy ? <ErrorFeedback error={transcriptError} /> : null}
        {!transcriptLoading && !transcriptError && !transcriptRows?.length ? (
          <EmptyState title={t('transcript.emptyTitle')} description={t('transcript.emptyDescription')} />
        ) : null}
        {focusedTranscriptRowId && !transcriptLoading && displayTranscriptRows.length > 0 && !focusedRowIsVisible ? (
          <InfoBanner tone="warning" title={t(`${missingFocusedRowKey}.title`)} message={t(`${missingFocusedRowKey}.message`)} />
        ) : null}

        {displayTranscriptRows.length ? (
          <>
            {followMode === 'suspended-by-user' ? (
              <div className="transcript-follow-control">
                <span role="status">{t('transcript.followPaused')}</span>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    onResumeFollowing?.();
                    window.requestAnimationFrame(() => {
                      scrollToActivePlaybackRow(true);
                      transcriptListRef.current?.focus({ preventScroll: true });
                    });
                  }}
                >
                  {t('transcript.resumeFollowing')}
                </button>
              </div>
            ) : null}
            <ol
              ref={transcriptListRef}
              className="transcript-list transcript-list--scrollable"
              tabIndex={0}
              aria-label={t('transcript.listLabel')}
              onWheel={() => onSuspendFollowing?.()}
              onTouchStart={() => onSuspendFollowing?.()}
              onKeyDown={suspendForKeyboard}
              onPointerDown={suspendForScrollbar}
              onMouseUp={suspendForSelection}
            >
            {displayTranscriptRows.map(({ row, displayText }, index) => {
              const isFocusedRow = Boolean(focusedTranscriptRowId && matchesTranscriptReference(row, focusedTranscriptRowId));
              const rowIdentity = getTranscriptRowIdentity(row, index);
              const isPlaybackActive = rowIdentity === activePlaybackRowId;
              const rowIsSeekable = Boolean(
                onPlaySegment &&
                row.startMs !== null &&
                row.endMs !== null,
              );
              const formattedStartTime = row.startMs !== null
                ? formatTranscriptTimestamp(row.startMs)
                : null;
              return (
                <li
                  key={rowIdentity}
                  ref={(node) => {
                    if (isFocusedRow) focusedRowRef.current = node;
                    if (isPlaybackActive) activePlaybackRowRef.current = node;
                  }}
                  className={[
                    'transcript-list__item',
                    isFocusedRow ? 'transcript-list__item--active' : '',
                    isPlaybackActive ? 'transcript-list__item--playing' : '',
                  ].filter(Boolean).join(' ')}
                  tabIndex={isFocusedRow ? -1 : undefined}
                  aria-current={isPlaybackActive ? 'time' : isFocusedRow ? 'true' : undefined}
                  aria-label={
                    isFocusedRow && isPlaybackActive
                      ? t('transcript.rowSelectedPlaying')
                      : isFocusedRow
                        ? t('transcript.rowSelected')
                        : isPlaybackActive
                          ? t('transcript.rowPlaying')
                          : undefined
                  }
                >
                  <div className="transcript-list__meta">
                    <span>{t('common:momentIndex', { index: row.segmentIndex ?? '—' })}</span>
                    {rowIsSeekable && formattedStartTime ? (
                      <button
                        type="button"
                        className="transcript-seek-action"
                        aria-label={t('transcript.playFrom', { time: formattedStartTime })}
                        onClick={() => {
                          if (row.startMs !== null) {
                            onPlaySegment?.(row.startMs, rowIdentity);
                          }
                        }}
                      >
                        <span aria-hidden="true">▶</span>
                        <span>{formattedStartTime}</span>
                      </button>
                    ) : null}
                    {isPlaybackActive ? <span className="playback-pill">{t('transcript.playing')}</span> : null}
                    {isFocusedRow ? <span className="hit-pill">{focusedRowLabel}</span> : null}
                  </div>
                  <p>{displayText}</p>
                </li>
              );
            })}
            </ol>
          </>
        ) : null}
      </div>
  );

  if (embedded) return content;
  return <Section title={t('transcript.heading')} eyebrow={workspaceName}>{content}</Section>;
}
