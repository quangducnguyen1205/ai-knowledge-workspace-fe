import { useMemo, useState } from 'react';
import type { AssetStatus, AssetSummary } from './model/types';
import { Button, Section } from '../../lib/ui';
import { AssetList } from './components/asset-list';
import { AssetUploadDialog } from '../upload/components/asset-upload-dialog';

type LibraryFilter = 'ALL' | AssetStatus;

const STATUS_FILTERS: Array<{ value: LibraryFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'SEARCHABLE', label: 'Ready' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'TRANSCRIPT_READY', label: 'Preparing search' },
  { value: 'FAILED', label: 'Failed' },
];

type AssetLibraryScreenProps = {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAssetId: string | null;
  successNotice: { title: string; message: string } | null;
  assetsError: unknown;
  deleteError: unknown;
  renameError: unknown;
  deleteBusy: boolean;
  deletingAssetId: string | null;
  renameBusy: boolean;
  renamingAssetId: string | null;
  assetsLoading: boolean;
  uploadError: unknown;
  uploadSuccessId?: string;
  isUploading: boolean;
  isUploadOpen: boolean;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
  onRenameAsset: (asset: AssetSummary, title: string) => void;
  onUpload: (input: { file: File; title?: string }) => void;
  onOpenUpload: () => void;
  onCloseUpload: () => void;
};

export function AssetLibraryScreen({
  workspaceName,
  assets,
  selectedAssetId,
  successNotice,
  assetsError,
  deleteError,
  renameError,
  deleteBusy,
  deletingAssetId,
  renameBusy,
  renamingAssetId,
  assetsLoading,
  uploadError,
  uploadSuccessId,
  isUploading,
  isUploadOpen,
  onSelectAsset,
  onDeleteAsset,
  onRenameAsset,
  onUpload,
  onOpenUpload,
  onCloseUpload,
}: AssetLibraryScreenProps) {
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<LibraryFilter>('ALL');
  const normalizedTitleFilter = titleFilter.trim().toLocaleLowerCase();
  const visibleAssets = useMemo(
    () => assets.filter((asset) => {
      const matchesTitle = !normalizedTitleFilter || asset.title.toLocaleLowerCase().includes(normalizedTitleFilter);
      const matchesStatus = statusFilter === 'ALL' || asset.assetStatus === statusFilter;
      return matchesTitle && matchesStatus;
    }),
    [assets, normalizedTitleFilter, statusFilter],
  );
  const filtersActive = Boolean(normalizedTitleFilter) || statusFilter !== 'ALL';

  return (
    <div className="screen-stack library-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">{workspaceName}</p>
          <h1>Library</h1>
          <p>Manage the videos in this workspace.</p>
        </div>
        <div className="page-header__actions">
          <Button type="button" onClick={onOpenUpload}>Upload video</Button>
        </div>
      </header>

      <Section
        title="Videos"
        actions={<span className="panel-pill">{assets.length} {assets.length === 1 ? 'video' : 'videos'}</span>}
        className="library-panel"
      >
        {assets.length > 0 ? (
          <div className="library-filters" aria-label="Filter videos">
            <label className="library-filter-search">
              <span className="visually-hidden">Filter videos by title</span>
              <input
                className="field__input"
                type="search"
                value={titleFilter}
                onChange={(event) => setTitleFilter(event.target.value)}
                placeholder="Filter videos"
              />
            </label>
            <div className="filter-chips" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`filter-chip ${statusFilter === filter.value ? 'filter-chip--active' : ''}`}
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <AssetList
          assets={visibleAssets}
          selectedAssetId={selectedAssetId}
          successNotice={successNotice}
          assetsError={assetsError}
          deleteError={deleteError}
          renameError={renameError}
          deleteBusy={deleteBusy}
          deletingAssetId={deletingAssetId}
          renameBusy={renameBusy}
          renamingAssetId={renamingAssetId}
          assetsLoading={assetsLoading}
          emptyDescription={filtersActive ? 'Try a different title or status filter.' : undefined}
          onSelectAsset={onSelectAsset}
          onDeleteAsset={onDeleteAsset}
          onRenameAsset={onRenameAsset}
        />
      </Section>

      {isUploadOpen ? (
        <AssetUploadDialog
          workspaceName={workspaceName}
          uploadError={uploadError}
          uploadSuccessId={uploadSuccessId}
          isUploading={isUploading}
          onUpload={onUpload}
          onClose={onCloseUpload}
        />
      ) : null}
    </div>
  );
}
