import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { SearchResponse, SearchResult } from './api/search-api';
import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../entities/transcript/model/transcript-display';
import { formatTranscriptTimestamp } from '../../entities/transcript/model/transcript-time';
import { Button, EmptyState, LoadingBlock, PanelHeading, Section } from '../../shared/ui';
import { ErrorFeedback } from '../../shared/feedback';
import { Trans, useTranslation } from '../../shared/i18n';
import { SourceBadge } from '../assets/public';
import type { AssetSourceType } from '../assets/public';
import {
  getSearchMomentAssetTitle,
  groupSearchMomentsByAsset,
} from './model/group-search-moments';
import {
  MISSING_SEARCH_MOMENT_PREVIEW_KEY,
  resolveSearchMomentPreview,
} from './model/search-moment-preview';
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
  selectedMomentStartMs,
  routeQuery,
  scope,
  embedded = false,
  onSearch,
  onSelectResult,
  onOpenResultContext,
  onPlaySelectedMoment,
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
  /** Start of the selected canonical moment, when the transcript gives it a timestamp. */
  selectedMomentStartMs?: number | null;
  routeQuery?: string | null;
  scope?: SearchPanelScope;
  embedded?: boolean;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onOpenResultContext?: (result: SearchResult) => void;
  /** Explicit playback of the selected moment; omitted where this Asset has no playable media. */
  onPlaySelectedMoment?: (startMs: number) => void;
  onReturnToSearch?: () => void;
  onClearContext?: () => void;
}) {
  const { t } = useTranslation(['search', 'common']);
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
    const timestampLabel = timestamp ?? t('common:timeUnavailable');
    const isSelected =
      selectedResult?.assetId === result.assetId &&
      selectedResult?.transcriptRowId === result.transcriptRowId &&
      selectedResult?.segmentIndex === result.segmentIndex;
    const actionLabelKey = !hasContextAction
      ? 'results.unavailableLabel'
      : onOpenResultContext
        ? 'results.openLabel'
        : 'results.showLabel';
    const actionLabel = t(actionLabelKey, { title: assetTitle, time: timestampLabel.toLowerCase() });

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
              <span>{t('common:videoMoment')}</span>
              <span className="search-result__timestamp-value">{timestampLabel}</span>
            </span>
          </span>
          <span className="search-result__excerpt">
            {resolveSearchMomentPreview(result) ?? t(MISSING_SEARCH_MOMENT_PREVIEW_KEY)}
          </span>
          <span className="search-result__open-label">
            {!hasContextAction
              ? t('results.unavailable')
              : onOpenResultContext
                ? t('results.open')
                : isSelected ? t('results.shown') : t('results.show')}
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
            <p className="panel__eyebrow">{t('panel.assetEyebrow')}</p>
            <h2>{t('panel.assetTitle')}</h2>
          </div>
          <span className="panel-pill">{searchEnabled ? t('panel.ready') : t('panel.unavailable')}</span>
        </div>
      ) : null}

      <form className="search-form" onSubmit={handleSubmit} role="search">
        <label className="field field--grow">
          <span className="field__label">
            {isAssetScoped ? t('panel.assetFieldLabel') : t('panel.workspaceFieldLabel', { workspace: workspaceName })}
          </span>
          <input
            className="field__input search-form__input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={searchEnabled
              ? isAssetScoped ? t('panel.assetPlaceholder') : t('panel.workspacePlaceholder')
              : isAssetScoped ? t('panel.assetPlaceholderLocked') : t('panel.workspacePlaceholderLocked')}
            disabled={!searchEnabled}
          />
        </label>
        <Button type="submit" disabled={!searchEnabled || !searchInput.trim() || isSearching}>
          {isSearching ? t('panel.submitting') : t('panel.submit')}
        </Button>
      </form>

      {!searchEnabled ? (
        <p className="search-availability" role="status">
          {isAssetScoped ? t('panel.assetLocked') : t('panel.workspaceLocked')}
        </p>
      ) : null}

      {searchError ? <ErrorFeedback error={searchError} /> : null}
      {isSearching ? (
        <div className="search-loading-status" role="status" aria-live="polite" aria-atomic="true">
          <LoadingBlock
            label={isAssetScoped ? t('panel.assetSearching') : t('panel.workspaceSearching', { workspace: workspaceName })}
            compact
          />
        </div>
      ) : null}

      {!activeQuery && !isSearching ? (
        <div role="status">
          <EmptyState
            title={isAssetScoped ? t('empty.assetTitle') : t('empty.workspaceTitle')}
            description={isAssetScoped ? t('empty.assetDescription') : t('empty.workspaceDescription')}
          />
        </div>
      ) : null}

      {!isSearching && activeQuery && !searchError && !hasSearchResults ? (
        <div role="status">
          <EmptyState
            title={t('empty.noResultsTitle')}
            description={isAssetScoped ? t('empty.noResultsAsset') : t('empty.noResultsWorkspace')}
          />
        </div>
      ) : null}

      {isAssetScoped && !isSearching && !searchError && activeQuery && hasSearchResults ? (
        <p className="search-summary" role="status">
          <Trans
            i18nKey="results.matchCount"
            ns="search"
            count={searchResponse?.resultCount ?? searchResponse?.results.length ?? 0}
            values={{ query: activeQuery }}
          />
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
            eyebrow={t('panel.workspaceTitle')}
            className="panel-heading--underlined"
            trailing={(
              <p className="search-summary" role="status" aria-live="polite">
                <strong>{searchResponse?.resultCount ?? searchResponse?.results.length ?? 0}</strong>{' '}
                {t('results.momentCount', { count: searchResponse?.resultCount ?? 0 })}
                {' · '}
                {t('results.shownAcross', {
                  shown: searchResponse?.results.length ?? 0,
                  count: resultGroups.length,
                })}
              </p>
            )}
          >
            <h2 id={resultsHeadingId}>{t('results.heading')}</h2>
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
                  <span>{t('results.momentCount', { count: group.momentCount })}</span>
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
              <h2 id="local-context-title">{t('context.heading')}</h2>
              <span className="context-panel__hint">{t('context.hint')}</span>
            </div>
            <div className="selected-context__actions">
              {onPlaySelectedMoment && selectedMomentStartMs !== null && selectedMomentStartMs !== undefined ? (
                <Button type="button" onClick={() => onPlaySelectedMoment(selectedMomentStartMs)}>
                  {t('context.playFrom', { time: formatTranscriptTimestamp(selectedMomentStartMs) })}
                </Button>
              ) : null}
              {onReturnToSearch ? <Button type="button" tone="secondary" onClick={onReturnToSearch}>{t('context.backToSearch')}</Button> : null}
              {onClearContext ? <Button type="button" tone="ghost" onClick={onClearContext}>{t('common:actions.clear')}</Button> : null}
            </div>
          </div>
          {isContextLoading ? <LoadingBlock label={t('context.loading')} compact /> : null}
          {!isContextLoading && contextError ? <ErrorFeedback error={contextError} /> : null}
          {!isContextLoading && !contextError && !contextResponse ? (
            <EmptyState title={t('context.unavailableTitle')} description={t('context.unavailableDescription')} />
          ) : null}
          {contextResponse ? (
            <ol className="transcript-list transcript-list--compact">
              {displayContextRows.map(({ row, displayText }) => {
                const isHit = matchesTranscriptReference(row, contextRowId);
                return (
                  <li key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`} className={`transcript-list__item ${isHit ? 'transcript-list__item--active' : ''}`}>
                    <div className="transcript-list__meta">
                      <span>{t('common:momentIndex', { index: row.segmentIndex ?? '—' })}</span>
                      {isHit ? <span className="hit-pill">{t('context.match')}</span> : null}
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
  return (
    <Section
      title={isAssetScoped ? t('panel.assetTitle') : t('panel.workspaceTitle')}
      eyebrow={isAssetScoped ? scope?.assetTitle : workspaceName}
    >
      {content}
    </Section>
  );
}
