import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { SearchResponse, SearchResult } from './api/search-api';
import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../entities/transcript/model/transcript-display';
import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, LoadingBlock, PanelHeading, Section } from '../../shared/ui';
import { ErrorFeedback } from '../../shared/feedback';
import { SourceBadge } from '../assets/public';
import type { AssetSourceType } from '../assets/public';
import {
  getSearchMomentAssetTitle,
  groupSearchMomentsByAsset,
} from './model/group-search-moments';
import { resolveSearchMomentPreview } from './model/search-moment-preview';
import { resolveTranscriptLookupId } from './model/search-result-reference';

type SearchPanelScope = {
  mode: 'workspace' | 'asset';
  assetTitle?: string;
};

export type SearchAssetSource = {
  assetId: string;
  sourceType: AssetSourceType;
};

export function SearchPanel({
  workspaceName,
  assetSources = [],
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
  assetSources?: readonly SearchAssetSource[];
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
  const resultsHeadingId = useId();
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
  const resultGroups = useMemo(
    () => isAssetScoped ? [] : groupSearchMomentsByAsset(searchResponse?.results ?? []),
    [isAssetScoped, searchResponse?.results],
  );
  const sourceTypeByAssetId = useMemo(
    () => new Map(assetSources.map((asset) => [asset.assetId, asset.sourceType])),
    [assetSources],
  );

  useEffect(() => {
    setSearchInput(routeQueryDraft ?? '');
  }, [resetToken, routeQueryDraft, workspaceName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = searchInput.trim();
    if (trimmedQuery && searchEnabled) onSearch(trimmedQuery);
  }

  function renderResult(result: SearchResult): ReactNode {
    const lookupId = resolveTranscriptLookupId(result);
    const hasContextAction = Boolean(lookupId);
    const assetTitle = getSearchMomentAssetTitle(result);
    const sourceType = sourceTypeByAssetId.get(result.assetId) ?? null;
    const timestamp = result.startMs !== null && Number.isFinite(result.startMs) && result.startMs >= 0
      ? formatTranscriptTimestamp(result.startMs)
      : null;
    const timestampLabel = timestamp ?? 'Time unavailable';
    const isSelected =
      selectedResult?.assetId === result.assetId &&
      selectedResult?.transcriptRowId === result.transcriptRowId &&
      selectedResult?.segmentIndex === result.segmentIndex;
    const actionLabel = !hasContextAction
      ? `Video moment unavailable in ${assetTitle} at ${timestampLabel.toLowerCase()}`
      : onOpenResultContext
        ? `Open moment in ${assetTitle} at ${timestampLabel.toLowerCase()}`
        : `Show transcript context for moment in ${assetTitle} at ${timestampLabel.toLowerCase()}`;

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
            <span className="search-result__identity">
              <span className="search-result__asset-title">{assetTitle}</span>
              <SourceBadge sourceType={sourceType} />
            </span>
            <span className="search-result__timestamp">
              <span>Video moment</span>
              <span className="search-result__timestamp-value">{timestampLabel}</span>
            </span>
          </span>
          <span className="search-result__excerpt">
            {resolveSearchMomentPreview(result)}
          </span>
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
          <span className="field__label">
            {isAssetScoped ? 'Find in transcript' : `Search within ${workspaceName}`}
          </span>
          <input
            className="field__input search-form__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={searchEnabled
              ? isAssetScoped ? 'Find a word or phrase' : 'Search by topic, phrase, or idea'
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

      {searchError ? <ErrorFeedback error={searchError} /> : null}
      {isSearching ? (
        <div className="search-loading-status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock label={isAssetScoped ? 'Searching this transcript...' : `Searching within ${workspaceName}...`} compact />
        </div>
      ) : null}

      {!activeQuery && !isSearching ? (
        <div role="status">
          <EmptyState
            title={isAssetScoped ? 'Find an exact moment' : 'Search this workspace'}
            description={isAssetScoped ? 'Enter a word or phrase from this video.' : 'Enter a natural content query to find exact moments across your videos.'}
          />
        </div>
      ) : null}

      {!isSearching && activeQuery && !searchError && !hasSearchResults ? (
        <div role="status">
          <EmptyState
            title="No video moments found"
            description={isAssetScoped ? 'Try a broader phrase from this transcript.' : 'Try a broader phrase or a different topic in this workspace.'}
          />
        </div>
      ) : null}

      {isAssetScoped && !isSearching && !searchError && activeQuery && hasSearchResults ? (
        <p className="search-summary" role="status">
          <strong>{searchResponse?.resultCount ?? searchResponse?.results.length ?? 0}</strong>{' '}
          {(searchResponse?.resultCount ?? 0) === 1 ? 'match' : 'matches'} for “{activeQuery}”
        </p>
      ) : null}

      {isAssetScoped && !isSearching && !searchError && activeQuery && searchResponse?.results.length ? (
        <ol className="search-results search-results--compact">
          {searchResponse.results.map((result, index) => (
            <li key={`${result.assetId}-${resolveTranscriptLookupId(result) ?? 'no-row'}-${result.segmentIndex ?? index}`}>
              {renderResult(result)}
            </li>
          ))}
        </ol>
      ) : null}

      {!isAssetScoped && !isSearching && !searchError && activeQuery && resultGroups.length ? (
        <section className="workspace-moment-results" aria-labelledby={resultsHeadingId}>
          <PanelHeading
            eyebrow="Explore"
            className="panel-heading--underlined"
            trailing={(
              <p className="search-summary" role="status" aria-live="polite">
                <strong>{searchResponse?.resultCount ?? searchResponse?.results.length ?? 0}</strong>{' '}
                {(searchResponse?.resultCount ?? 0) === 1 ? 'matching moment' : 'matching moments'}
                {' · '}
                {searchResponse?.results.length ?? 0} shown across {resultGroups.length}{' '}
                {resultGroups.length === 1 ? 'video' : 'videos'}
              </p>
            )}
          >
            <h2 id={resultsHeadingId}>Video moments</h2>
          </PanelHeading>
          <div className="search-result-groups">
            {resultGroups.map((group, groupIndex) => (
              <section
                key={group.assetId}
                className="search-result-group"
                aria-labelledby={`${resultsHeadingId}-group-${groupIndex}`}
              >
                <header>
                  <div className="search-result-group__identity">
                    <h3 id={`${resultsHeadingId}-group-${groupIndex}`}>{group.assetTitle}</h3>
                    <SourceBadge sourceType={sourceTypeByAssetId.get(group.assetId) ?? null} />
                  </div>
                  <span>{group.momentCount} matching {group.momentCount === 1 ? 'moment' : 'moments'}</span>
                </header>
                <ol className="search-results">
                  {group.results.map((result, index) => (
                    <li key={`${result.assetId}-${resolveTranscriptLookupId(result) ?? 'no-row'}-${result.segmentIndex ?? index}`}>
                      {renderResult(result)}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
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
          {!isContextLoading && contextError ? <ErrorFeedback error={contextError} /> : null}
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
  return <Section title={isAssetScoped ? 'Find in transcript' : 'Explore'} eyebrow={isAssetScoped ? scope?.assetTitle : workspaceName}>{content}</Section>;
}
