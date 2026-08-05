import { useMemo, useState } from 'react';
import type { AssetStatus, AssetSummary } from './model/types';
import { Button, Section } from '../../lib/ui';
import { useTranslation } from '../../shared/i18n';
import { AssetList } from './components/asset-list';
import { AssetUploadDialog } from '../upload/public';
import type { EphemeralNotice } from '../../shared/ui/use-ephemeral-notice';

type LibraryFilter = 'ALL' | AssetStatus;

/** The filter values are Spring's `AssetStatus` contract; only their labels are translated. */
const STATUS_FILTERS = [
  { value: 'ALL', labelKey: 'filters.all' },
  { value: 'SEARCHABLE', labelKey: 'filters.ready' },
  { value: 'PROCESSING', labelKey: 'filters.processing' },
  { value: 'TRANSCRIPT_READY', labelKey: 'filters.preparingSearch' },
  { value: 'FAILED', labelKey: 'filters.failed' },
] as const satisfies ReadonlyArray<{ value: LibraryFilter; labelKey: string }>;

type AssetLibraryScreenProps = {
  workspaceName: string;
  assets: AssetSummary[];
  selectedAssetId: string | null;
  successNotice: EphemeralNotice | null;
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
  youtubeError: unknown;
  youtubeSuccessId?: string;
  isCreatingYouTube: boolean;
  isUploadOpen: boolean;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
  onRenameAsset: (asset: AssetSummary, title: string) => void;
  onUpload: (input: { file: File; title?: string }) => void;
  onCreateYouTube: (input: { url: string; title?: string }) => void;
  onResetCreation: () => void;
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
  youtubeError,
  youtubeSuccessId,
  isCreatingYouTube,
  isUploadOpen,
  onSelectAsset,
  onDeleteAsset,
  onRenameAsset,
  onUpload,
  onCreateYouTube,
  onResetCreation,
  onOpenUpload,
  onCloseUpload,
}: AssetLibraryScreenProps) {
  const { t } = useTranslation(['library', 'common']);
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
          <h1>{t('screen.title')}</h1>
          <p>{t('screen.description')}</p>
        </div>
        <div className="page-header__actions">
          <Button type="button" onClick={onOpenUpload}>{t('screen.addVideo')}</Button>
        </div>
      </header>

      <Section
        title={t('screen.videos')}
        actions={<span className="panel-pill">{t('common:videoCount', { count: assets.length })}</span>}
        className="library-panel"
      >
        {assets.length > 0 ? (
          <div className="library-filters" aria-label={t('filters.label')}>
            <label className="library-filter-search">
              <span className="visually-hidden">{t('filters.byTitle')}</span>
              <input
                className="field__input"
                type="search"
                value={titleFilter}
                onChange={(event) => setTitleFilter(event.target.value)}
                placeholder={t('filters.titlePlaceholder')}
              />
            </label>
            <div className="filter-chips" role="group" aria-label={t('filters.byStatus')}>
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`filter-chip ${statusFilter === filter.value ? 'filter-chip--active' : ''}`}
                  aria-pressed={statusFilter === filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {t(filter.labelKey)}
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
          emptyDescription={filtersActive ? t('list.emptyFiltered') : undefined}
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
          youtubeError={youtubeError}
          youtubeSuccessId={youtubeSuccessId}
          isCreatingYouTube={isCreatingYouTube}
          onUpload={onUpload}
          onCreateYouTube={onCreateYouTube}
          onResetCreation={onResetCreation}
          onClose={onCloseUpload}
        />
      ) : null}
    </div>
  );
}
