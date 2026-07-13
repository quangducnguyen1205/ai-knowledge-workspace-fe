import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, formatDateTime } from '../../../lib/ui';
import { getAssetStatusDescription, getFriendlyDeleteErrorCopy } from '../model/error-copy';
import type { AssetSummary } from '../model/types';
import { StatusBadge } from './status-badge';

export function AssetList({
  assets,
  selectedAssetId,
  successNotice,
  assetsError,
  deleteError,
  deleteBusy,
  deletingAssetId,
  assetsLoading,
  onSelectAsset,
  onDeleteAsset,
}: {
  assets: AssetSummary[];
  selectedAssetId: string | null;
  successNotice: { title: string; message: string } | null;
  assetsError: unknown;
  deleteError: unknown;
  deleteBusy: boolean;
  deletingAssetId: string | null;
  assetsLoading: boolean;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
}) {
  const deleteErrorCopy = getFriendlyDeleteErrorCopy(deleteError);

  return (
    <div className="asset-list">
      <div className="asset-list__meta">
        <strong>{assets.length}</strong>
        <span>{assets.length === 1 ? 'asset in this workspace' : 'assets in this workspace'}</span>
      </div>

      <div className="status-legend">
        <span className="status-legend__label">Status legend</span>
        <StatusBadge status="PROCESSING" />
        <StatusBadge status="TRANSCRIPT_READY" />
        <StatusBadge status="SEARCHABLE" />
        <StatusBadge status="FAILED" />
      </div>

      {assetsLoading ? <LoadingBlock label="Loading workspace assets..." compact /> : null}
      {!assetsLoading && assetsError ? <ErrorBanner error={assetsError} /> : null}
      {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'warning' ? (
        <InfoBanner tone="warning" title={deleteErrorCopy.title} message={deleteErrorCopy.message} detail={deleteErrorCopy.detail} />
      ) : null}
      {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'error' ? (
        <ErrorBanner error={deleteError} title={deleteErrorCopy.title} message={deleteErrorCopy.message} detail={deleteErrorCopy.detail} />
      ) : null}
      {!assetsLoading && !assetsError && successNotice ? (
        <InfoBanner tone="success" title={successNotice.title} message={successNotice.message} />
      ) : null}

      {!assetsLoading && !assetsError && assets.length === 0 ? (
        <EmptyState title="No assets yet" description="Upload a lecture video to start transcript review and prepare this workspace for search." />
      ) : null}

      {!assetsLoading && !assetsError && assets.length > 0 ? (
        <ul className="asset-list__items">
          {assets.map((asset) => {
            const isSelected = asset.assetId === selectedAssetId;
            const isDeleting = deletingAssetId === asset.assetId;
            return (
              <li key={asset.assetId} className="asset-row">
                <button
                  type="button"
                  className={`asset-card ${isSelected ? 'asset-card--selected' : ''}`}
                  onClick={() => onSelectAsset(asset.assetId)}
                >
                  <div className="asset-card__header">
                    <strong>{asset.title}</strong>
                    <StatusBadge status={asset.assetStatus} />
                  </div>
                  <div className="asset-card__meta">
                    <span>{formatDateTime(asset.createdAt)}</span>
                    <span className="asset-card__id">{asset.assetId}</span>
                  </div>
                  <p className="asset-card__summary">{getAssetStatusDescription(asset.assetStatus)}</p>
                </button>
                <Button
                  type="button"
                  tone="ghost"
                  className="asset-row__delete"
                  onClick={() => onDeleteAsset(asset)}
                  disabled={deleteBusy}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
