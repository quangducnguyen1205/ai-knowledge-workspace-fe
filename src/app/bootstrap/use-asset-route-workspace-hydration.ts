import { useEffect, useMemo, useRef } from 'react';
import type { AssetRecordResponse } from '../../features/assets/model/types';
import type { Workspace } from '../../features/workspaces/api/workspaces-api';
import type { AppRoute } from '../router';

type AssetRouteWorkspaceHydrationInput = {
  route: AppRoute;
  asset: AssetRecordResponse | undefined;
  isAssetLoading: boolean;
  isAssetError: boolean;
  workspaces: Workspace[] | undefined;
  isWorkspaceLoading: boolean;
  selectedWorkspaceId: string | null;
  onSelectAuthorizedWorkspace: (workspaceId: string) => void;
  onUnavailableRoute: () => void;
};

export function useAssetRouteWorkspaceHydration({
  route,
  asset,
  isAssetLoading,
  isAssetError,
  workspaces,
  isWorkspaceLoading,
  selectedWorkspaceId,
  onSelectAuthorizedWorkspace,
  onUnavailableRoute,
}: AssetRouteWorkspaceHydrationInput) {
  const routedAssetId = route.name === 'asset' ? route.assetId : null;
  const requestedWorkspaceKeyRef = useRef<string | null>(null);
  const owningWorkspace = useMemo(
    () => asset && workspaces?.find((workspace) => workspace.id === asset.workspaceId),
    [asset, workspaces],
  );
  const isWorkspaceScopeResolved = !isWorkspaceLoading && workspaces !== undefined;
  const isUnavailable = Boolean(
    routedAssetId && (isAssetError || (asset && isWorkspaceScopeResolved && !owningWorkspace)),
  );

  useEffect(() => {
    if (!routedAssetId || isAssetLoading || !isWorkspaceScopeResolved) {
      return;
    }

    if (isAssetError || !asset || !owningWorkspace) {
      requestedWorkspaceKeyRef.current = null;
      onUnavailableRoute();
      return;
    }

    if (selectedWorkspaceId === owningWorkspace.id) {
      requestedWorkspaceKeyRef.current = null;
      return;
    }

    const requestedWorkspaceKey = `${selectedWorkspaceId ?? 'none'}:${owningWorkspace.id}`;
    if (requestedWorkspaceKeyRef.current !== requestedWorkspaceKey) {
      requestedWorkspaceKeyRef.current = requestedWorkspaceKey;
      onSelectAuthorizedWorkspace(owningWorkspace.id);
    }
  }, [
    asset,
    isAssetError,
    isAssetLoading,
    isWorkspaceScopeResolved,
    onSelectAuthorizedWorkspace,
    onUnavailableRoute,
    owningWorkspace,
    routedAssetId,
    selectedWorkspaceId,
  ]);

  return {
    isHydrating: Boolean(
      routedAssetId && !isUnavailable && (isAssetLoading || !isWorkspaceScopeResolved || !asset || selectedWorkspaceId !== asset.workspaceId),
    ),
    isUnavailable,
  };
}
