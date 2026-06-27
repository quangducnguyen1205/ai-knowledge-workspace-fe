import type { SearchResponse, SearchResult, TranscriptContextResponse, AssetSummary } from '../../lib/api';
import { Button, EmptyState, InfoBanner, Section } from '../../lib/ui';
import { StatusBadge } from '../assets/assets';
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
  assets: AssetSummary[];
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onOpenResultContext: (result: SearchResult) => void;
  onOpenAsset: (assetId: string) => void;
  onOpenLibrary: () => void;
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
  assets,
  onSearch,
  onSelectResult,
  onOpenResultContext,
  onOpenAsset,
  onOpenLibrary,
}: SearchScreenProps) {
  const searchableAssets = assets.filter((asset) => asset.assetStatus === 'SEARCHABLE').slice(0, 6);

  return (
    <div className="screen-grid screen-grid--search">
      <div className="screen-main">
        {routeQuery ? (
          <InfoBanner
            title={`Returned to workspace search for "${routeQuery}"`}
            message="Results are loaded through the current product search API; result rows are not cached or restored from the URL."
          />
        ) : null}

        <SearchPanel
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
      </div>

      <div className="screen-side">
        <Section title="Search readiness" eyebrow={workspaceName}>
          {searchableAssetCount === 0 ? (
            <div className="guidance-card">
              <strong>Search is still locked</strong>
              <p>Index at least one transcript before search becomes available in this workspace.</p>
              <Button type="button" onClick={onOpenLibrary}>
                Open library
              </Button>
            </div>
          ) : (
            <div className="summary-list">
              <div className="summary-list__item">
                <span className="summary-list__label">Searchable assets</span>
                <strong>{searchableAssetCount}</strong>
              </div>
              <div className="summary-list__item">
                <span className="summary-list__label">Active query</span>
                <strong>{activeQuery ?? 'No query yet'}</strong>
              </div>
            </div>
          )}
        </Section>

        <Section title="Searchable assets" eyebrow="Open detail">
          {searchableAssets.length === 0 ? (
            <EmptyState
              title="No searchable assets yet"
              description="Return to the library or an asset detail view to finish transcript indexing first."
            />
          ) : (
            <div className="compact-list">
              {searchableAssets.map((asset) => (
                <button
                  key={asset.assetId}
                  type="button"
                  className="compact-list__button"
                  onClick={() => onOpenAsset(asset.assetId)}
                >
                  <div className="compact-list__header">
                    <strong>{asset.title}</strong>
                    <StatusBadge status={asset.assetStatus} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
