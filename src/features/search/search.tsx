import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { SearchResponse, SearchResult } from './api/search-api';
import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../entities/transcript/model/transcript-display';
import { Button, EmptyState, ErrorBanner, LoadingBlock, Section } from '../../lib/ui';
import { resolveTranscriptLookupId } from './model/search-result-reference';

type SearchPanelScope = {
  mode: 'workspace' | 'asset';
  assetTitle?: string;
};

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
  selectedContextRowId,
  routeQuery,
  scope,
  embedded = false,
  onSearch,
  onSelectResult,
  onOpenResultContext,
  onReturnToSearch,
  onClearContext,
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
  selectedContextRowId?: string | null;
  routeQuery?: string | null;
  scope?: SearchPanelScope;
  embedded?: boolean;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onOpenResultContext?: (result: SearchResult) => void;
  onReturnToSearch?: () => void;
  onClearContext?: () => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const routeQueryDraft = routeQuery?.trim() || null;
  const isAssetScoped = scope?.mode === 'asset';
  const selectedResultRowId = selectedResult ? resolveTranscriptLookupId(selectedResult) : null;
  const contextRowId = selectedContextRowId === undefined ? selectedResultRowId : selectedContextRowId;
  const searchEnabled = searchableAssetCount > 0;
  const hasSearchResults = Boolean(searchResponse?.results.length);
  const displayContextRows = useMemo(
    () => (contextResponse?.rows.length ? buildTranscriptDisplayRows(contextResponse.rows) : []),
    [contextResponse?.rows],
  );
  const resultGroups = useMemo(() => {
    if (isAssetScoped) return [];
    const groups = new Map<string, { assetTitle: string; results: SearchResult[] }>();
    for (const result of searchResponse?.results ?? []) {
      const group = groups.get(result.assetId) ?? { assetTitle: result.assetTitle, results: [] };
      group.results.push(result);
      groups.set(result.assetId, group);
    }
    return Array.from(groups.entries()).map(([assetId, group]) => ({ assetId, ...group }));
  }, [isAssetScoped, searchResponse?.results]);

  useEffect(() => {
    setSearchInput(routeQueryDraft ?? '');
  }, [resetToken, routeQueryDraft, workspaceName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = searchInput.trim();
    if (trimmedQuery && searchEnabled) onSearch(trimmedQuery);
  }

  function renderResult(result: SearchResult, index: number): ReactNode {
    const lookupId = resolveTranscriptLookupId(result);
    const hasContextAction = Boolean(lookupId);
    const isSelected =
      selectedResult?.assetId === result.assetId &&
      selectedResult?.transcriptRowId === result.transcriptRowId &&
      selectedResult?.segmentIndex === result.segmentIndex;
    const actionLabel = onOpenResultContext
      ? `Open moment ${index + 1} in ${result.assetTitle}`
      : `Show transcript context for moment ${index + 1} in ${result.assetTitle}`;

    return (
      <article
        className={`search-result ${isSelected ? 'search-result--selected' : ''} ${!hasContextAction ? 'search-result--disabled' : ''}`}
        aria-current={isSelected ? 'true' : undefined}
      >
        <button
          type="button"
          className="search-result__moment"
          onClick={() => onOpenResultContext ? onOpenResultContext(result) : onSelectResult(result)}
          disabled={!hasContextAction}
          aria-label={actionLabel}
        >
          <span className="search-result__header">
            <span className="search-result__rank">Transcript moment</span>
          </span>
          <span className="search-result__excerpt">{result.text}</span>
          <span className="search-result__open-label">
            {!hasContextAction ? 'Unavailable' : onOpenResultContext ? 'Open moment' : isSelected ? 'Context shown' : 'Show context'}
          </span>
        </button>
      </article>
    );
  }

  const content = (
    <div className={`search-panel ${isAssetScoped ? 'search-panel--asset' : 'search-panel--workspace'}`}>
      {isAssetScoped ? (
        <div className="study-pane__header search-panel__heading">
          <div>
            <p className="panel__eyebrow">Transcript</p>
            <h2>Find in transcript</h2>
          </div>
          <span className="panel-pill">{searchEnabled ? 'Ready' : 'Unavailable'}</span>
        </div>
      ) : null}

      <form className="search-form" onSubmit={handleSubmit} role="search">
        <label className="field field--grow">
          <span className="field__label">{isAssetScoped ? 'Find in transcript' : 'Search workspace'}</span>
          <input
            className="field__input search-form__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={searchEnabled
              ? isAssetScoped ? 'Find a word or phrase' : 'Search across video transcripts'
              : isAssetScoped ? 'Available when this video is ready' : 'Upload a video to begin searching'}
            disabled={!searchEnabled}
          />
        </label>
        <Button type="submit" disabled={!searchEnabled || !searchInput.trim() || isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {!searchEnabled ? (
        <p className="search-availability" role="status">
          {isAssetScoped ? 'Find in transcript will be available when this video is ready.' : 'Search will be available when a video is ready.'}
        </p>
      ) : null}

      {searchError ? <ErrorBanner error={searchError} /> : null}
      {isSearching ? <LoadingBlock label={isAssetScoped ? 'Searching this transcript...' : 'Searching your workspace...'} compact /> : null}

      {!activeQuery && !isSearching ? (
        <EmptyState
          title={isAssetScoped ? 'Find an exact moment' : 'Search your learning workspace'}
          description={isAssetScoped ? 'Enter a word or phrase from this video.' : 'Enter a topic or phrase to find it across your videos.'}
        />
      ) : null}

      {!isSearching && activeQuery && !searchError && !hasSearchResults ? (
        <EmptyState
          title="No matches found"
          description={isAssetScoped ? 'Try a broader phrase from this transcript.' : 'Try a broader phrase or a different topic.'}
        />
      ) : null}

      {activeQuery && hasSearchResults ? (
        <p className="search-summary" role="status">
          {isAssetScoped ? (
            <><strong>{searchResponse?.resultCount ?? searchResponse?.results.length ?? 0}</strong>{' '}
              {(searchResponse?.resultCount ?? 0) === 1 ? 'match' : 'matches'} for “{activeQuery}”</>
          ) : (
            <>Top relevant moments for “{activeQuery}” · <strong>{searchResponse?.results.length ?? 0} shown</strong></>
          )}
        </p>
      ) : null}

      {isAssetScoped && searchResponse?.results.length ? (
        <ol className="search-results search-results--compact">
          {searchResponse.results.map((result, index) => (
            <li key={`${result.assetId}-${resolveTranscriptLookupId(result) ?? 'no-row'}-${result.segmentIndex ?? index}`}>
              {renderResult(result, index)}
            </li>
          ))}
        </ol>
      ) : null}

      {!isAssetScoped && resultGroups.length ? (
        <div className="search-result-groups">
          {resultGroups.map((group, groupIndex) => (
            <section key={group.assetId} className="search-result-group" aria-labelledby={`search-group-${groupIndex}`}>
              <header>
                <h2 id={`search-group-${groupIndex}`}>{group.assetTitle}</h2>
                <span>{group.results.length} {group.results.length === 1 ? 'moment' : 'moments'}</span>
              </header>
              <ol className="search-results">
                {group.results.map((result, index) => (
                  <li key={`${result.assetId}-${resolveTranscriptLookupId(result) ?? 'no-row'}-${result.segmentIndex ?? index}`}>
                    {renderResult(result, index)}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : null}

      {isAssetScoped && contextRowId ? (
        <section className="context-panel" aria-labelledby="local-context-title">
          <div className="panel-block__header">
            <div>
              <h2 id="local-context-title">Selected context</h2>
              <span className="context-panel__hint">Around the matching moment</span>
            </div>
            <div className="selected-context__actions">
              {onReturnToSearch ? <Button type="button" tone="secondary" onClick={onReturnToSearch}>Back to search</Button> : null}
              {onClearContext ? <Button type="button" tone="ghost" onClick={onClearContext}>Clear</Button> : null}
            </div>
          </div>
          {isContextLoading ? <LoadingBlock label="Loading context..." compact /> : null}
          {!isContextLoading && contextError ? <ErrorBanner error={contextError} /> : null}
          {!isContextLoading && !contextError && !contextResponse ? (
            <EmptyState title="Context unavailable" description="Continue with the full transcript below." />
          ) : null}
          {contextResponse ? (
            <ol className="transcript-list transcript-list--compact">
              {displayContextRows.map(({ row, displayText }) => {
                const isHit = matchesTranscriptReference(row, contextRowId);
                return (
                  <li key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`} className={`transcript-list__item ${isHit ? 'transcript-list__item--active' : ''}`}>
                    <div className="transcript-list__meta">
                      <span>Moment {row.segmentIndex ?? '—'}</span>
                      {isHit ? <span className="hit-pill">Match</span> : null}
                    </div>
                    <p>{displayText}</p>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  if (embedded) return content;
  return <Section title={isAssetScoped ? 'Find in transcript' : 'Workspace Search'} eyebrow={isAssetScoped ? scope?.assetTitle : workspaceName}>{content}</Section>;
}
