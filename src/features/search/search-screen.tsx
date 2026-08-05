import type { ReactNode } from 'react';
import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import type { SearchResponse, SearchResult } from './api/search-api';
import { useTranslation } from '../../shared/i18n';
import { SearchPanel, type SearchAssetSource } from './search';

type SearchScreenProps = {
  workspaceName: string;
  assetSources: readonly SearchAssetSource[];
  searchableAssetCount: number;
  resetToken: number;
  activeQuery: string | null;
  routeQuery: string | null;
  searchResponse?: SearchResponse;
  searchError: unknown;
  isSearching: boolean;
  contextResponse?: TranscriptContextResponse;
  contextError: unknown;
  isContextLoading: boolean;
  selectedResult: SearchResult | null;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onOpenResultContext: (result: SearchResult) => void;
  /** Workspace-scoped Assets the viewer can resume, rendered above the search surface. */
  continueWatching?: ReactNode;
  /** Workspace-scoped saved moments rendered under the search surface. */
  savedMoments?: ReactNode;
};

export function WorkspaceSearchScreen({
  workspaceName,
  assetSources,
  searchableAssetCount,
  resetToken,
  activeQuery,
  routeQuery,
  searchResponse,
  searchError,
  isSearching,
  contextResponse,
  contextError,
  isContextLoading,
  selectedResult,
  onSearch,
  onSelectResult,
  onOpenResultContext,
  continueWatching,
  savedMoments,
}: SearchScreenProps) {
  const { t } = useTranslation('search');

  return (
    <div className="screen-stack workspace-search-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">{t('screen.eyebrow')}</p>
          <h1>{t('screen.title', { workspace: workspaceName })}</h1>
          <p>{t('screen.description')}</p>
        </div>
      </header>

      {continueWatching ? (
        <section
          className="workspace-continue-watching-surface"
          aria-label={t('screen.continueWatchingLabel', { workspace: workspaceName })}
        >
          {continueWatching}
        </section>
      ) : null}

      <section
        className="workspace-search-surface"
        aria-label={t('screen.searchSurfaceLabel', { workspace: workspaceName })}
      >
        <SearchPanel
          embedded
          workspaceName={workspaceName}
          assetSources={assetSources}
          searchableAssetCount={searchableAssetCount}
          resetToken={resetToken}
          activeQuery={activeQuery}
          routeQuery={routeQuery}
          searchResponse={searchResponse}
          searchError={searchError}
          isSearching={isSearching}
          contextResponse={contextResponse}
          contextError={contextError}
          isContextLoading={isContextLoading}
          selectedResult={selectedResult}
          onSearch={onSearch}
          onSelectResult={onSelectResult}
          onOpenResultContext={onOpenResultContext}
        />
      </section>

      {savedMoments ? (
        <section className="workspace-saved-moments-surface" aria-label={t('screen.savedMomentsLabel', { workspace: workspaceName })}>
          {savedMoments}
        </section>
      ) : null}
    </div>
  );
}
