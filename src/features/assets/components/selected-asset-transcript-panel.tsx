import { useEffect, useMemo, useRef } from 'react';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../../entities/transcript/model/transcript-display';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section } from '../../../lib/ui';
import { getTranscriptConflictCopy } from '../model/error-copy';
import type { AssetStatus, AssetStatusResponse, AssetSummary } from '../model/types';

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
  embedded?: boolean;
}) {
  const transcriptConflictCopy = getTranscriptConflictCopy(transcriptError, resolvedAssetStatus, statusResponse?.processingJobStatus);
  const focusedRowRef = useRef<HTMLLIElement>(null);
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

  useEffect(() => {
    if (!focusedTranscriptRowId || transcriptLoading || !focusedRowIsVisible) return undefined;

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
  }, [focusedRowIsVisible, focusedTranscriptRowId, transcriptLoading]);

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
          <ol className="transcript-list">
            {displayTranscriptRows.map(({ row, displayText }) => {
              const isFocusedRow = Boolean(focusedTranscriptRowId && matchesTranscriptReference(row, focusedTranscriptRowId));
              return (
                <li
                  key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`}
                  ref={isFocusedRow ? focusedRowRef : undefined}
                  className={`transcript-list__item ${isFocusedRow ? 'transcript-list__item--active' : ''}`}
                  tabIndex={isFocusedRow ? -1 : undefined}
                  aria-current={isFocusedRow ? 'true' : undefined}
                  aria-label={isFocusedRow ? 'Selected transcript moment' : undefined}
                >
                  <div className="transcript-list__meta">
                    <span>Moment {row.segmentIndex ?? '—'}</span>
                    {isFocusedRow ? <span className="hit-pill">{focusedRowLabel}</span> : null}
                  </div>
                  <p>{displayText}</p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
  );

  if (embedded) return content;
  return <Section title="Transcript" eyebrow={workspaceName}>{content}</Section>;
}
