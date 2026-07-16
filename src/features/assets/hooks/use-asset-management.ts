import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/api-error';
import { assetKeys, useDeleteAssetMutation, useRenameAssetMutation } from './asset-queries';
import type { AssetSummary } from '../model/types';

type SuccessNotice = { title: string; message: string };

export function useAssetManagement({
  currentUserId,
  workspaceId,
  workspaceName,
  selectedAsset,
  selectedAssetId,
  selectedAssetIdRef,
  preferredAssetIdRef,
  setSelectedAssetId,
  setPreferredAssetId,
  onClearAssetReferences,
  onAssetTitleChanged,
  onDeletedSelectedRoute,
}: {
  currentUserId?: string;
  workspaceId: string | null;
  workspaceName?: string;
  selectedAsset: AssetSummary | null;
  selectedAssetId: string | null;
  selectedAssetIdRef: { current: string | null };
  preferredAssetIdRef: { current: string | null };
  setSelectedAssetId: (assetId: string | null) => void;
  setPreferredAssetId: (assetId: string | null) => void;
  onClearAssetReferences: (assetId: string) => void;
  onAssetTitleChanged: (assetId: string, title: string) => void;
  onDeletedSelectedRoute: (assetId: string) => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteAssetMutation();
  const renameMutation = useRenameAssetMutation();
  const [librarySuccessNotice, setLibrarySuccessNotice] = useState<SuccessNotice | null>(null);
  const [detailSuccessNotice, setDetailSuccessNotice] = useState<SuccessNotice | null>(null);

  useEffect(() => {
    setLibrarySuccessNotice(null);
    setDetailSuccessNotice(null);
  }, [workspaceId]);

  useEffect(() => {
    setLibrarySuccessNotice(null);
    setDetailSuccessNotice(null);
  }, [currentUserId]);

  useEffect(() => setDetailSuccessNotice(null), [selectedAssetId]);

  useEffect(() => renameMutation.reset(), [currentUserId, renameMutation.reset, selectedAssetId, workspaceId]);

  function clearAssetDependentState(assetId: string) {
    if (selectedAssetIdRef.current === assetId) {
      setSelectedAssetId(null);
      queryClient.removeQueries({ queryKey: assetKeys.status(assetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(assetId) });
    }
    if (preferredAssetIdRef.current === assetId) setPreferredAssetId(null);
    onClearAssetReferences(assetId);
    queryClient.removeQueries({ queryKey: ['search', 'context', assetId] });
  }

  function handleDeleteAsset(asset: AssetSummary) {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm(
      `Delete "${asset.title}" from ${workspaceName ?? 'this workspace'}?\n\nThis removes the asset and refreshes the workspace list.`,
    );
    if (!confirmed) return;

    setLibrarySuccessNotice(null);
    setDetailSuccessNotice(null);
    deleteMutation.mutate(
      { assetId: asset.assetId, workspaceId: asset.workspaceId },
      {
        onSuccess: async (_response, variables) => {
          clearAssetDependentState(variables.assetId);
          onDeletedSelectedRoute(variables.assetId);
          setLibrarySuccessNotice({
            title: 'Video deleted',
            message: `Removed "${asset.title}" from ${workspaceName ?? 'the active workspace'}.`,
          });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
            queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
          ]);
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            clearAssetDependentState(variables.assetId);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  function handleRenameAsset(title: string, targetAsset: AssetSummary | null = selectedAsset) {
    if (!targetAsset) return;
    setLibrarySuccessNotice(null);
    setDetailSuccessNotice(null);
    renameMutation.mutate(
      { assetId: targetAsset.assetId, workspaceId: targetAsset.workspaceId, title },
      {
        onSuccess: (response, variables) => {
          queryClient.setQueryData<AssetSummary[] | undefined>(assetKeys.list(variables.workspaceId), (current) =>
            current?.map((asset) => asset.assetId === variables.assetId
              ? {
                  ...asset,
                  title: response.title,
                  assetStatus: response.status,
                  workspaceId: response.workspaceId || asset.workspaceId,
                  createdAt: response.createdAt ?? asset.createdAt,
                }
              : asset),
          );
          onAssetTitleChanged(variables.assetId, response.title);
          setLibrarySuccessNotice({ title: 'Video renamed', message: `Title updated to "${response.title}".` });
          if (selectedAssetIdRef.current === variables.assetId) {
            setDetailSuccessNotice({ title: 'Video renamed', message: `Title updated to "${response.title}".` });
          }
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            if (selectedAssetIdRef.current === variables.assetId) clearAssetDependentState(variables.assetId);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  return {
    librarySuccessNotice,
    detailSuccessNotice,
    recordUploadSuccess: (title: string) => setLibrarySuccessNotice({
      title: 'Video uploaded',
      message: `Added "${title}" to ${workspaceName ?? 'the active workspace'}.`,
    }),
    clearNotices: () => {
      setLibrarySuccessNotice(null);
      setDetailSuccessNotice(null);
    },
    handleDeleteAsset,
    handleRenameAsset,
    resetRename: renameMutation.reset,
    visibleDeleteError: deleteMutation.error && deleteMutation.variables?.workspaceId === workspaceId ? deleteMutation.error : null,
    deletingAssetId: deleteMutation.isPending ? deleteMutation.variables?.assetId ?? null : null,
    isDeleting: deleteMutation.isPending,
    visibleRenameError: renameMutation.error && renameMutation.variables?.workspaceId === workspaceId ? renameMutation.error : null,
    renamingAssetId: renameMutation.isPending ? renameMutation.variables?.assetId ?? null : null,
    isRenamingSelectedAsset: renameMutation.isPending && renameMutation.variables?.assetId === selectedAssetId,
  };
}
