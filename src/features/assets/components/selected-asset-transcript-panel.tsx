import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../../entities/transcript/model/transcript-display';
import { getTranscriptRowIdentity } from '../../../entities/transcript/model/active-transcript-row';
import { formatTranscriptTimestamp } from '../../../entities/transcript/model/transcript-time';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section } from '../../../lib/ui';
import { getTranscriptConflictCopy } from '../model/error-copy';
import type { AssetStatus, AssetStatusResponse, AssetSummary } from '../model/types';

export type TranscriptFollowMode = 'following' | 'suspended-by-user';

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
  embedded?: boolean;
}) {
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
  const focusedRowLabel = focusedTranscriptSource === 'assistant' ? 'Citation' : focusedTranscriptSource === 'search' ? 'Search match' : 'Selected';
  const missingFocusedRowCopy = focusedTranscriptSource === 'assistant'
    ? {
        title: 'Cited moment is not visible',
        message: 'The cited moment could not be matched in this transcript. Search the transcript directly.',
      }
    : {
        title: 'Selected moment is not visible',
        message: 'The transcript may have changed. Use the selected context above or return to search.',
      };

  const scrollToActivePlaybackRow = useCallback((force: boolean) => {
    const row = activePlaybackRowRef.current;
    const viewport = transcriptListRef.current;
    if (!row || !viewport || !transcriptViewVisible) return;

    const rowRect = row.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const edgeThreshold = Math.min(48, Math.max(0, viewportRect.height * 0.15));
    const rowNearEdge =
      rowRect.top < viewportRect.top + edgeThreshold ||
      rowRect.bottom > viewportRect.bottom - edgeThreshold;
    if (!force && !rowNearEdge) return;

    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
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
      const reduceMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (typeof focusedRow.scrollIntoView === 'function') {
        focusedRow.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
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
            <h2>Transcript</h2>
          </div>
        </div>

        {transcriptLoading ? <LoadingBlock label="Loading transcript..." /> : null}
        {!transcriptLoading && transcriptConflictCopy ? (
          <InfoBanner tone="warning" title={transcriptConflictCopy.title} message={transcriptConflictCopy.message} detail={transcriptConflictCopy.detail} />
        ) : null}
        {!transcriptLoading && transcriptError && !transcriptConflictCopy ? <ErrorBanner error={transcriptError} /> : null}
        {!transcriptLoading && !transcriptError && !transcriptRows?.length ? (
          <EmptyState title="Transcript not ready yet" description="This page updates automatically while the video is being prepared." />
        ) : null}
        {focusedTranscriptRowId && !transcriptLoading && displayTranscriptRows.length > 0 && !focusedRowIsVisible ? (
          <InfoBanner tone="warning" title={missingFocusedRowCopy.title} message={missingFocusedRowCopy.message} />
        ) : null}

        {displayTranscriptRows.length ? (
          <>
            {followMode === 'suspended-by-user' ? (
              <div className="transcript-follow-control">
                <span role="status">Transcript following is paused.</span>
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
                  Resume following
                </button>
              </div>
            ) : null}
            <ol
              ref={transcriptListRef}
              className="transcript-list transcript-list--scrollable"
              tabIndex={0}
              aria-label="Video transcript"
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
                      ? 'Selected transcript moment, currently playing'
                      : isFocusedRow
                        ? 'Selected transcript moment'
                        : isPlaybackActive
                          ? 'Currently playing transcript segment'
                          : undefined
                  }
                >
                  <div className="transcript-list__meta">
                    <span>Moment {row.segmentIndex ?? '—'}</span>
                    {rowIsSeekable && formattedStartTime ? (
                      <button
                        type="button"
                        className="transcript-seek-action"
                        aria-label={`Play transcript segment from ${formattedStartTime}`}
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
                    {isPlaybackActive ? <span className="playback-pill">Playing</span> : null}
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
  return <Section title="Transcript" eyebrow={workspaceName}>{content}</Section>;
}
