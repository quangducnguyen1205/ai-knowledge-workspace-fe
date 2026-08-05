import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, EmptyState, ErrorFeedback, InfoBanner, LoadingBlock, SuccessNotification } from '../../../lib/ui';
import { useDateTimeFormat, useTranslation } from '../../../shared/i18n';
import type { EphemeralNotice } from '../../../shared/ui/use-ephemeral-notice';
import { getFriendlyDeleteErrorCopy, getFriendlyRenameErrorCopy } from '../model/error-copy';
import type { AssetSummary } from '../model/types';
import { SourceBadge } from './source-badge';
import { StatusBadge } from './status-badge';

export function AssetList({
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
  emptyDescription,
  onSelectAsset,
  onDeleteAsset,
  onRenameAsset,
}: {
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
  emptyDescription?: string;
  onSelectAsset: (assetId: string) => void;
  onDeleteAsset: (asset: AssetSummary) => void;
  onRenameAsset: (asset: AssetSummary, title: string) => void;
}) {
  const { t } = useTranslation(['library', 'common']);
  const formatDateTime = useDateTimeFormat();
  const [openMenuAssetId, setOpenMenuAssetId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetSummary | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteErrorCopy = getFriendlyDeleteErrorCopy(deleteError);
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);

  useEffect(() => {
    if (!openMenuAssetId) return;

    function closeMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuAssetId(null);
        menuButtonRef.current?.focus();
      }
    }

    function closeMenuFromOutside(event: Event) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpenMenuAssetId(null);
      }
    }

    window.addEventListener('keydown', closeMenuWithKeyboard);
    window.addEventListener('pointerdown', closeMenuFromOutside);
    return () => {
      window.removeEventListener('keydown', closeMenuWithKeyboard);
      window.removeEventListener('pointerdown', closeMenuFromOutside);
    };
  }, [openMenuAssetId]);

  useEffect(() => {
    if (editingAsset && !assets.some((asset) => asset.assetId === editingAsset.assetId)) {
      setEditingAsset(null);
      setDraftTitle('');
    }
  }, [assets, editingAsset]);

  // A rename that succeeded clears the inline editor. The notice is matched by its stable id
  // rather than by its rendered title, which now varies with the active language.
  useEffect(() => {
    if (editingAsset && successNotice?.id === 'asset-renamed') {
      setEditingAsset(null);
      setDraftTitle('');
    }
  }, [editingAsset, successNotice]);

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset || renameBusy) return;
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === editingAsset.title) return;
    onRenameAsset(editingAsset, nextTitle);
  }

  return (
    <div className="asset-list">
      {assetsLoading ? <LoadingBlock label={t('list.loading')} compact /> : null}
      {!assetsLoading && assetsError ? <ErrorFeedback error={assetsError} /> : null}
      {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'warning' ? (
        <InfoBanner tone="warning" title={t(deleteErrorCopy.titleKey)} message={t(deleteErrorCopy.messageKey)} />
      ) : null}
      {!assetsLoading && !assetsError && deleteErrorCopy?.tone === 'error' ? (
        <ErrorFeedback error={deleteError} title={t(deleteErrorCopy.titleKey)} message={t(deleteErrorCopy.messageKey)} />
      ) : null}
      {!assetsLoading && !assetsError && successNotice ? (
        <SuccessNotification
          title={successNotice.title}
          message={successNotice.message}
          onDismiss={successNotice.dismiss}
        />
      ) : null}

      {!assetsLoading && !assetsError && assets.length === 0 ? (
        <EmptyState title={t('list.emptyTitle')} description={emptyDescription ?? t('list.emptyDescription')} />
      ) : null}

      {!assetsLoading && !assetsError && assets.length > 0 ? (
        <ul className="video-list">
          {assets.map((asset) => {
            const isSelected = asset.assetId === selectedAssetId;
            const isDeleting = deletingAssetId === asset.assetId;
            const isRenaming = renamingAssetId === asset.assetId;
            const isEditing = editingAsset?.assetId === asset.assetId;

            return (
              <li key={asset.assetId} className={`video-row ${isSelected ? 'video-row--selected' : ''}`}>
                <button type="button" className="video-row__open" onClick={() => onSelectAsset(asset.assetId)}>
                  <span className="video-row__thumb" aria-hidden="true">▶</span>
                  <span className="video-row__copy">
                    <strong>{asset.title}</strong>
                    <span className="video-row__meta">
                      <small>{formatDateTime(asset.createdAt)}</small>
                      <SourceBadge sourceType={asset.sourceType} />
                    </span>
                  </span>
                  <StatusBadge status={asset.assetStatus} />
                </button>

                <div ref={openMenuAssetId === asset.assetId ? menuRef : undefined} className="overflow-menu">
                  <button
                    ref={openMenuAssetId === asset.assetId ? menuButtonRef : undefined}
                    type="button"
                    className="overflow-menu__trigger"
                    aria-label={t('list.rowActions', { title: asset.title })}
                    aria-expanded={openMenuAssetId === asset.assetId}
                    onClick={() => setOpenMenuAssetId((current) => current === asset.assetId ? null : asset.assetId)}
                  >
                    <span aria-hidden="true">•••</span>
                  </button>
                  {openMenuAssetId === asset.assetId ? (
                    <div className="overflow-menu__popover" aria-label={t('list.rowActionsMenu', { title: asset.title })}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuAssetId(null);
                          onSelectAsset(asset.assetId);
                        }}
                      >
                        {t('common:actions.open')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAsset(asset);
                          setDraftTitle(asset.title);
                          setOpenMenuAssetId(null);
                        }}
                      >
                        {t('common:actions.rename')}
                      </button>
                      <button
                        type="button"
                        className="overflow-menu__danger"
                        onClick={() => {
                          setOpenMenuAssetId(null);
                          onDeleteAsset(asset);
                        }}
                        disabled={deleteBusy}
                      >
                        {isDeleting ? t('common:actions.deleting') : t('common:actions.delete')}
                      </button>
                    </div>
                  ) : null}
                </div>

                {isEditing ? (
                  <form className="video-row__rename" onSubmit={submitRename}>
                    <label className="field field--grow">
                      <span className="visually-hidden">{t('list.renameLabel', { title: asset.title })}</span>
                      <input
                        className="field__input"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        maxLength={255}
                        autoFocus
                        disabled={renameBusy}
                      />
                    </label>
                    <Button type="submit" className="button--inline" disabled={renameBusy || !draftTitle.trim() || draftTitle.trim() === asset.title}>
                      {isRenaming ? t('common:actions.saving') : t('common:actions.save')}
                    </Button>
                    <Button
                      type="button"
                      tone="ghost"
                      className="button--inline"
                      onClick={() => {
                        setEditingAsset(null);
                        setDraftTitle('');
                      }}
                      disabled={renameBusy}
                    >
                      {t('common:actions.cancel')}
                    </Button>
                    {renameErrorCopy?.tone === 'warning' ? (
                      <InfoBanner tone="warning" title={t(renameErrorCopy.titleKey)} message={t(renameErrorCopy.messageKey)} />
                    ) : null}
                    {renameErrorCopy?.tone === 'error' ? (
                      <ErrorFeedback error={renameError} title={t(renameErrorCopy.titleKey)} message={t(renameErrorCopy.messageKey)} />
                    ) : null}
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
