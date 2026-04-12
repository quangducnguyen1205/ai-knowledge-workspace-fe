import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTranscriptContext,
  searchTranscript,
  type SearchResponse,
  type SearchResult,
  type TranscriptContextResponse,
  type TranscriptRow,
} from '../../lib/api';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime, formatScore } from '../../lib/ui';

export type SearchParams = {
  query: string;
  workspaceId: string;
};

export type TranscriptContextParams = {
  assetId: string;
  transcriptRowId: string;
  window: number;
};

export const searchKeys = {
  all: ['search'] as const,
  results: (workspaceId: string, query: string) => ['search', 'results', workspaceId, query] as const,
  context: (assetId: string, transcriptRowId: string, window: number) =>
    ['search', 'context', assetId, transcriptRowId, window] as const,
};

export function resolveTranscriptLookupId(result: SearchResult): string | null {
  if (result.transcriptRowId) {
    return result.transcriptRowId;
  }

  return result.segmentIndex !== null ? `segment-${result.segmentIndex}` : null;
}

function matchesContextRow(row: TranscriptRow, transcriptRowId: string): boolean {
  if (row.id) {
    return row.id === transcriptRowId;
  }

  return row.segmentIndex !== null && `segment-${row.segmentIndex}` === transcriptRowId;
}

export function useSearchQuery(params: SearchParams | null) {
  return useQuery({
    queryKey: params ? searchKeys.results(params.workspaceId, params.query) : ['search', 'results', 'empty'],
    queryFn: () => searchTranscript(params?.query ?? '', params?.workspaceId ?? ''),
    enabled: Boolean(params?.query && params?.workspaceId),
  });
}

export function useTranscriptContextQuery(params: TranscriptContextParams | null) {
  return useQuery({
    queryKey: params
      ? searchKeys.context(params.assetId, params.transcriptRowId, params.window)
      : ['search', 'context', 'empty'],
    queryFn: () => getTranscriptContext(params?.assetId ?? '', params?.transcriptRowId ?? '', params?.window ?? 2),
    enabled: Boolean(params?.assetId && params?.transcriptRowId),
  });
}

export function SearchPanel({
  workspaceName,
  activeQuery,
  searchResponse,
  searchError,
  isSearching,
  contextResponse,
  contextError,
  isContextLoading,
  selectedResult,
  onSearch,
  onSelectResult,
}: {
  workspaceName: string;
  activeQuery: string | null;
  searchResponse?: SearchResponse;
  searchError: unknown;
  isSearching: boolean;
  contextResponse?: TranscriptContextResponse;
  contextError: unknown;
  isContextLoading: boolean;
  selectedResult: SearchResult | null;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
}) {
  const [searchInput, setSearchInput] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = searchInput.trim();

    if (!trimmedQuery) {
      return;
    }

    onSearch(trimmedQuery);
  }

  return (
    <Section title="Search + Context" eyebrow={workspaceName}>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Search transcript text</span>
          <div className="search-form">
            <input
              className="field__input"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="binary trees, paging, consensus, normalization..."
            />
            <Button type="submit" disabled={!searchInput.trim() || isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </label>
      </form>

      <InfoBanner
        title={`Search scope: ${workspaceName}`}
        message="Only searchable assets inside the active workspace are considered by this search panel."
      />

      {searchError ? <ErrorBanner error={searchError} /> : null}

      {activeQuery ? (
        <div className="search-summary">
          <strong>{searchResponse?.resultCount ?? 0}</strong>
          <span>
            results for <code>{activeQuery}</code> in {workspaceName}
          </span>
        </div>
      ) : (
        <EmptyState
          title="Search inside the active workspace"
          description="Run a query after at least one asset reaches SEARCHABLE. Results stay scoped to the workspace selected above."
        />
      )}

      {isSearching ? <LoadingBlock label="Searching Spring-owned transcript rows..." /> : null}

      {!isSearching && activeQuery && !searchError && !searchResponse?.results.length ? (
        <EmptyState
          title="No matches in this workspace"
          description="Try a different term after the asset reaches SEARCHABLE and indexing has completed."
        />
      ) : null}

      {searchResponse?.results.length ? (
        <ul className="search-results">
          {searchResponse.results.map((result) => {
            const lookupId = resolveTranscriptLookupId(result);
            const isSelected =
              selectedResult?.assetId === result.assetId &&
              selectedResult?.transcriptRowId === result.transcriptRowId &&
              selectedResult?.segmentIndex === result.segmentIndex;

            return (
              <li key={`${result.assetId}-${lookupId ?? 'no-row'}-${result.segmentIndex ?? 'na'}`}>
                <button
                  type="button"
                  className={`search-result ${isSelected ? 'search-result--selected' : ''}`}
                  onClick={() => onSelectResult(result)}
                >
                  <div className="search-result__header">
                    <strong>{result.assetTitle}</strong>
                    <span className="search-result__score">score {formatScore(result.score)}</span>
                  </div>
                  <p>{result.text}</p>
                  <div className="search-result__meta">
                    <span>Segment {result.segmentIndex ?? 'n/a'}</span>
                    <span>{formatDateTime(result.createdAt)}</span>
                    <span>{workspaceName}</span>
                  </div>
                  <div className="search-result__footer">
                    <span className="search-result__scope">Scoped to the active workspace</span>
                    <span className="search-result__action">
                      {lookupId ? 'Open transcript context' : 'Context unavailable'}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="context-panel">
        <div className="panel-block__header">
          <h3>Transcript context</h3>
          <span className="context-panel__hint">Separate follow-up view, window = 2</span>
        </div>

        {isContextLoading ? <LoadingBlock label="Loading transcript context..." compact /> : null}
        {!isContextLoading && contextError ? <ErrorBanner error={contextError} /> : null}
        {!isContextLoading && !contextError && !contextResponse ? (
          <EmptyState
            title="Open a search result"
            description="Click a result above to fetch a focused transcript window around that hit."
          />
        ) : null}

        {contextResponse ? (
          <div className="context-window">
            {selectedResult ? (
              <div className="context-window__selected">
                <strong>{selectedResult.assetTitle}</strong>
                <span>Matched query inside {workspaceName}</span>
              </div>
            ) : null}

            <div className="context-window__meta">
              <span>Hit segment: {contextResponse.hitSegmentIndex ?? 'n/a'}</span>
              <span>Window size: {contextResponse.window}</span>
            </div>

            <ol className="transcript-list transcript-list--compact">
              {contextResponse.rows.map((row) => {
                const isHit = matchesContextRow(row, contextResponse.transcriptRowId);

                return (
                  <li
                    key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`}
                    className={`transcript-list__item ${isHit ? 'transcript-list__item--active' : ''}`}
                  >
                    <div className="transcript-list__meta">
                      <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                      <span>{formatDateTime(row.createdAt)}</span>
                      {isHit ? <span className="hit-pill">Hit row</span> : null}
                    </div>
                    <p>{row.text}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
