import { useMutation, useQuery } from '@tanstack/react-query';
import { deleteAsset, getAsset, listAssets, updateAssetTitle } from '../api/assets-api';
import type { AssetRecordResponse, UpdateAssetTitleInput } from '../model/types';

export const assetKeys = {
  all: ['assets'] as const,
  list: (workspaceId: string) => ['assets', 'list', workspaceId] as const,
  detail: (assetId: string) => ['assets', 'detail', assetId] as const,
  status: (assetId: string) => ['assets', 'status', assetId] as const,
  transcript: (assetId: string) => ['assets', 'transcript', assetId] as const,
};

export type DeleteAssetInput = { assetId: string; workspaceId: string };
export type RenameAssetInput = UpdateAssetTitleInput & { workspaceId: string };

export function useAssetsQuery(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? assetKeys.list(workspaceId) : ['assets', 'list', 'empty'],
    queryFn: () => listAssets(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useAssetRouteQuery(assetId: string | null, enabled: boolean) {
  return useQuery<AssetRecordResponse>({
    queryKey: assetId ? assetKeys.detail(assetId) : ['assets', 'detail', 'empty'],
    queryFn: () => getAsset(assetId as string),
    enabled: Boolean(assetId) && enabled,
  });
}

export function useDeleteAssetMutation() {
  return useMutation({ mutationFn: ({ assetId }: DeleteAssetInput) => deleteAsset(assetId) });
}

export function useRenameAssetMutation() {
  return useMutation({ mutationFn: ({ assetId, title }: RenameAssetInput) => updateAssetTitle({ assetId, title }) });
}
