import { useMemo } from 'react';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../../entities/transcript/model/transcript-display';
import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime } from '../../../lib/ui';
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
}) {
  const transcriptConflictCopy = getTranscriptConflictCopy(transcriptError, resolvedAssetStatus, statusResponse?.processingJobStatus);
  const displayTranscriptRows = useMemo(
    () => (transcriptRows?.length ? buildTranscriptDisplayRows(transcriptRows) : []),
    [transcriptRows],
  );
  const focusedRowIsVisible = Boolean(
    focusedTranscriptRowId && displayTranscriptRows.some(({ row }) => matchesTranscriptReference(row, focusedTranscriptRowId)),
  );
  const focusedRowLabel = focusedTranscriptSource === 'assistant' ? 'Citation source' : focusedTranscriptSource === 'search' ? 'Search hit' : 'Focused row';
  const missingFocusedRowCopy = focusedTranscriptSource === 'assistant'
    ? {
        title: 'Cited transcript source is not visible',
        message: 'The cited transcript reference could not be matched in the loaded transcript. Review search results or the full transcript directly.',
      }
    : {
        title: 'Selected search row is not visible in this transcript',
        message: 'The transcript may have changed since the search result was opened. Use the study context above or return to search.',
      };

  if (!asset) return null;

  return (
    <Section title="Transcript Review" eyebrow={workspaceName}>
      <div className="panel-block">
        <div className="panel-block__header">
          <h3>Transcript</h3>
          <span className="context-panel__hint">Transcript rows appear here as soon as they are ready</span>
        </div>

        {transcriptLoading ? <LoadingBlock label="Loading transcript rows..." /> : null}
        {!transcriptLoading && transcriptConflictCopy ? (
          <InfoBanner tone="warning" title={transcriptConflictCopy.title} message={transcriptConflictCopy.message} detail={transcriptConflictCopy.detail} />
        ) : null}
        {!transcriptLoading && transcriptError && !transcriptConflictCopy ? <ErrorBanner error={transcriptError} /> : null}
        {!transcriptLoading && !transcriptError && !transcriptRows?.length ? (
          <EmptyState title="Transcript not loaded yet" description="Keep this asset selected. Transcript rows will appear here as soon as processing completes successfully." />
        ) : null}
        {focusedTranscriptRowId && !transcriptLoading && displayTranscriptRows.length > 0 && !focusedRowIsVisible ? (
          <InfoBanner tone="warning" title={missingFocusedRowCopy.title} message={missingFocusedRowCopy.message} />
        ) : null}

        {displayTranscriptRows.length ? (
          <ol className="transcript-list">
            {displayTranscriptRows.map(({ row, displayText, overlapHidden }) => {
              const isFocusedRow = Boolean(focusedTranscriptRowId && matchesTranscriptReference(row, focusedTranscriptRowId));
              return (
                <li
                  key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`}
                  className={`transcript-list__item ${isFocusedRow ? 'transcript-list__item--active' : ''}`}
                >
                  <div className="transcript-list__meta">
                    <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                    <span>{formatDateTime(row.createdAt)}</span>
                    {overlapHidden ? <span className="transcript-overlap-note">Overlap hidden</span> : null}
                    {isFocusedRow ? <span className="hit-pill">{focusedRowLabel}</span> : null}
                  </div>
                  <p>{displayText}</p>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </Section>
  );
}
