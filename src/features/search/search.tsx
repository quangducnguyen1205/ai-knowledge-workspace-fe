import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTranscriptContext,
  searchTranscript,
  type SearchResponse,
  type SearchResult,
  type TranscriptContextResponse,
  type TranscriptRow,
} from '../../lib/api';
import { buildTranscriptDisplayRows } from '../../lib/transcript-display';
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
  searchableAssetCount,
  resetToken,
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
  searchableAssetCount: number;
  resetToken: number;
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
  const searchEnabled = searchableAssetCount > 0;
  const hasSearchResults = Boolean(searchResponse?.results.length);
  const displayContextRows = useMemo(
    () => (contextResponse?.rows.length ? buildTranscriptDisplayRows(contextResponse.rows) : []),
    [contextResponse?.rows],
  );
  const searchPromptState = !activeQuery
    ? {
        title: 'Search this workspace',
        description: 'Run a query after at least one asset is indexed. Results stay scoped to the active workspace.',
      }
    : hasSearchResults
      ? {
          title: 'Choose a result to open context',
          description: 'Choose a result to inspect the surrounding transcript rows for that hit.',
        }
      : {
          title: 'No transcript context selected yet',
          description: 'Run a query with at least one hit, then open a result to inspect transcript context.',
      };
  const contextEmptyState = !activeQuery
    ? {
        title: 'Search first, then open context',
        description: 'Run a workspace search to choose one result and open its transcript context window.',
      }
    : hasSearchResults
      ? {
          title: 'Choose a result to open context',
          description: 'Choose one enabled result card above to inspect the surrounding transcript rows for that hit.',
        }
      : {
          title: 'No transcript context available yet',
          description: 'The current query returned no hits in this workspace, so there is no transcript context to open.',
        };

  useEffect(() => {
    setSearchInput('');
  }, [resetToken, workspaceName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = searchInput.trim();

    if (!trimmedQuery || !searchEnabled) {
      return;
    }

    onSearch(trimmedQuery);
  }

  return (
    <Section
      title="Workspace Search"
      eyebrow={workspaceName}
      actions={
        <span className="panel-pill">
          {searchableAssetCount} searchable {searchableAssetCount === 1 ? 'asset' : 'assets'}
        </span>
      }
    >
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Search transcript text</span>
          <div className="search-form">
            <input
              className="field__input"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={
                searchEnabled
                  ? 'consensus, paging, normalization, binary trees...'
                  : 'Index one asset in this workspace to enable search'
              }
              disabled={!searchEnabled}
            />
            <Button type="submit" disabled={!searchEnabled || !searchInput.trim() || isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </label>
      </form>

      <InfoBanner
        title={`Search scope: ${workspaceName}`}
        message="Only indexed assets inside the active workspace are considered by this search panel."
        detail={`${searchableAssetCount} searchable asset${searchableAssetCount === 1 ? '' : 's'} currently available.`}
      />

      {!searchEnabled ? (
        <InfoBanner
          tone="warning"
          title="Search unlocks after indexing"
          message="This workspace does not have any searchable assets yet. Finish transcript review and explicit indexing first."
        />
      ) : null}

      {searchError ? <ErrorBanner error={searchError} /> : null}

      {activeQuery ? (
        <div className="search-summary">
          <strong>{searchResponse?.resultCount ?? 0}</strong>
          <span>
            results for <code>{activeQuery}</code> in {workspaceName}
          </span>
        </div>
      ) : (
        <EmptyState title={searchPromptState.title} description={searchPromptState.description} />
      )}

      {isSearching ? <LoadingBlock label="Searching transcript content..." /> : null}

      {!isSearching && activeQuery && !searchError && !searchResponse?.results.length ? (
        <EmptyState
          title="No matches in this workspace"
          description="Try a different phrase, broader topic, or another indexed asset in this workspace."
        />
      ) : null}

      {searchResponse?.results.length ? (
        <ul className="search-results">
          {searchResponse.results.map((result) => {
            const lookupId = resolveTranscriptLookupId(result);
            const hasContextAction = Boolean(lookupId);
            const isSelected =
              selectedResult?.assetId === result.assetId &&
              selectedResult?.transcriptRowId === result.transcriptRowId &&
              selectedResult?.segmentIndex === result.segmentIndex;

            return (
              <li key={`${result.assetId}-${lookupId ?? 'no-row'}-${result.segmentIndex ?? 'na'}`}>
                <button
                  type="button"
                  className={`search-result ${isSelected ? 'search-result--selected' : ''} ${!hasContextAction ? 'search-result--disabled' : ''}`}
                  onClick={hasContextAction ? () => onSelectResult(result) : undefined}
                  disabled={!hasContextAction}
                  aria-pressed={isSelected}
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
                    <span className={`search-result__action ${isSelected ? 'search-result__action--active' : ''}`}>
                      {!hasContextAction ? 'Context unavailable' : isSelected ? 'Context shown below' : 'Open transcript context'}
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
          <span className="context-panel__hint">Context window: 2 rows around the hit</span>
        </div>

        {selectedResult ? (
          <div className={`context-window__selected ${isContextLoading ? 'context-window__selected--pending' : ''}`}>
            <p className="context-window__label">
              {contextResponse
                ? 'Opened from selected result'
                : isContextLoading
                  ? 'Loading selected result'
                  : contextError
                    ? 'Selected result with context error'
                    : 'Selected result'}
            </p>
            <strong>{selectedResult.assetTitle}</strong>
            <span>
              Matched <code>{activeQuery ?? 'current query'}</code> inside {workspaceName}
            </span>
            <p className="context-window__selected-copy">{selectedResult.text}</p>
          </div>
        ) : null}

        {isContextLoading ? <LoadingBlock label="Loading transcript context..." compact /> : null}
        {!isContextLoading && contextError ? <ErrorBanner error={contextError} /> : null}
        {!isContextLoading && !contextError && !contextResponse ? (
          <EmptyState title={contextEmptyState.title} description={contextEmptyState.description} />
        ) : null}

        {contextResponse ? (
          <div className="context-window">
            <div className="context-window__meta">
              <span>Hit segment: {contextResponse.hitSegmentIndex ?? 'n/a'}</span>
              <span>Window size: {contextResponse.window}</span>
            </div>

            <ol className="transcript-list transcript-list--compact">
              {displayContextRows.map(({ row, displayText, overlapHidden }) => {
                const isHit = matchesContextRow(row, contextResponse.transcriptRowId);

                return (
                  <li
                    key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`}
                    className={`transcript-list__item ${isHit ? 'transcript-list__item--active' : ''}`}
                  >
                    <div className="transcript-list__meta">
                      <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                      <span>{formatDateTime(row.createdAt)}</span>
                      {overlapHidden ? <span className="transcript-overlap-note">Overlap hidden</span> : null}
                      {isHit ? <span className="hit-pill">Hit row</span> : null}
                    </div>
                    <p>{displayText}</p>
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
