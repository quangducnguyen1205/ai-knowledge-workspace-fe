import type { ReactNode } from 'react';
import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import type { SearchResponse, SearchResult } from './api/search-api';
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
  savedMoments,
}: SearchScreenProps) {
  return (
    <div className="screen-stack workspace-search-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">Explore</p>
          <h1>Search within {workspaceName}</h1>
          <p>Find relevant video moments and open the exact transcript row that matters.</p>
        </div>
      </header>

      <section
        className="workspace-search-surface"
        aria-label={`Workspace moment search for ${workspaceName}`}
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
        <section className="workspace-saved-moments-surface" aria-label={`Saved moments in ${workspaceName}`}>
          {savedMoments}
        </section>
      ) : null}
    </div>
  );
}
