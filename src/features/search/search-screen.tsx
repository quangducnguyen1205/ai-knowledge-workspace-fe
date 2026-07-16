import type { TranscriptContextResponse } from '../../entities/transcript/model/types';
import type { SearchResponse, SearchResult } from './api/search-api';
import { SearchPanel } from './search';

type SearchScreenProps = {
  workspaceName: string;
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
};

export function WorkspaceSearchScreen({
  workspaceName,
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
}: SearchScreenProps) {
  return (
    <div className="screen-stack workspace-search-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">{workspaceName}</p>
          <h1>Workspace Search</h1>
          <p>Find exact moments across every ready video in this workspace.</p>
        </div>
      </header>

      <section className="workspace-search-surface" aria-label="Workspace transcript search">
        <SearchPanel
          embedded
          workspaceName={workspaceName}
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
    </div>
  );
}
