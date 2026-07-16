import type { AssetSummary } from '../assets/model/types';
import { Button, EmptyState, Section, formatDateTime } from '../../lib/ui';
import { StatusBadge } from '../assets/components/status-badge';

type WorkspaceHomeScreenProps = {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAsset: AssetSummary | null;
  searchableAssetCount: number;
  onUploadVideo: () => void;
  onOpenSearch: () => void;
  onOpenAsset: (assetId: string) => void;
};

export function WorkspaceHomeScreen({
  workspaceName,
  assets,
  selectedAsset,
  searchableAssetCount,
  onUploadVideo,
  onOpenSearch,
  onOpenAsset,
}: WorkspaceHomeScreenProps) {
  const processingCount = assets.filter((asset) => asset.assetStatus === 'PROCESSING').length;
  const recentAssets = [...assets]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="screen-stack home-screen">
      <header className="page-header page-header--home">
        <div className="page-header__copy">
          <p className="hero__eyebrow">{workspaceName}</p>
          <h1>Welcome back</h1>
          <p>Continue with a recent video, or add something new to learn from.</p>
          <div className="page-header__summary" aria-label="Workspace video summary">
            <span>{assets.length} {assets.length === 1 ? 'video' : 'videos'}</span>
            {searchableAssetCount > 0 ? <span>{searchableAssetCount} ready</span> : null}
            {processingCount > 0 ? <span>{processingCount} processing</span> : null}
          </div>
        </div>
        <div className="page-header__actions">
          <Button type="button" onClick={onUploadVideo}>Upload video</Button>
          <Button type="button" tone="ghost" onClick={onOpenSearch} disabled={searchableAssetCount === 0}>
            Search workspace
          </Button>
        </div>
      </header>

      <Section
        title="Continue learning"
        actions={recentAssets.length ? <span className="panel-pill">Recent videos</span> : undefined}
        className="continue-learning"
      >
        {recentAssets.length === 0 ? (
          <div className="home-empty">
            <EmptyState
              title="Your first video starts here"
              description="Upload a lecture or lesson and its transcript will appear in this workspace."
            />
            <Button type="button" onClick={onUploadVideo}>Upload video</Button>
          </div>
        ) : (
          <div className="recent-video-grid">
            {recentAssets.map((asset) => (
              <button
                key={asset.assetId}
                type="button"
                className={`recent-video ${selectedAsset?.assetId === asset.assetId ? 'recent-video--active' : ''}`}
                onClick={() => onOpenAsset(asset.assetId)}
              >
                <span className="recent-video__icon" aria-hidden="true">▶</span>
                <span className="recent-video__copy">
                  <strong>{asset.title}</strong>
                  <small>{formatDateTime(asset.createdAt)}</small>
                </span>
                <StatusBadge status={asset.assetStatus} />
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
