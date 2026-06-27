import { useEffect, useMemo } from 'react';
import type { AppRoute } from '../router';

type ProtectedRouteFallbackInput = {
  route: AppRoute;
  isAuthenticated: boolean;
  isCurrentUserLoading: boolean;
  isCurrentUserFetching: boolean;
  hasSelectedWorkspace: boolean;
  isWorkspaceLoading: boolean;
  isWorkspaceFetching: boolean;
  isWorkspaceScopeRefreshing: boolean;
  workspaceCount: number;
};

export type ProtectedRouteFallbackState = {
  bootstrapPending: boolean;
  fallbackRoute: AppRoute | null;
  routeCanRender: boolean;
};

export function resolveProtectedRouteFallback({
  route,
  isAuthenticated,
  isCurrentUserLoading,
  isCurrentUserFetching,
  hasSelectedWorkspace,
  isWorkspaceLoading,
  isWorkspaceFetching,
  isWorkspaceScopeRefreshing,
  workspaceCount,
}: ProtectedRouteFallbackInput): ProtectedRouteFallbackState {
  if (hasSelectedWorkspace) {
    return {
      bootstrapPending: false,
      fallbackRoute: null,
      routeCanRender: true,
    };
  }

  const currentUserPending = isCurrentUserLoading || isCurrentUserFetching;
  const workspaceSelectionPending =
    isWorkspaceLoading || isWorkspaceFetching || isWorkspaceScopeRefreshing || workspaceCount > 0;
  const bootstrapPending = currentUserPending || (isAuthenticated && workspaceSelectionPending);

  if (bootstrapPending || !isAuthenticated || route.name === 'home' || route.name === 'settings') {
    return {
      bootstrapPending,
      fallbackRoute: null,
      routeCanRender: route.name === 'home' || route.name === 'settings',
    };
  }

  return {
    bootstrapPending: false,
    fallbackRoute: { name: 'home' },
    routeCanRender: false,
  };
}

export function useProtectedRouteFallback(
  input: ProtectedRouteFallbackInput & { navigate: (route: AppRoute) => void },
): ProtectedRouteFallbackState {
  const { navigate, ...fallbackInput } = input;
  const fallbackState = useMemo(
    () => resolveProtectedRouteFallback(fallbackInput),
    [
      fallbackInput.hasSelectedWorkspace,
      fallbackInput.isAuthenticated,
      fallbackInput.isCurrentUserFetching,
      fallbackInput.isCurrentUserLoading,
      fallbackInput.isWorkspaceFetching,
      fallbackInput.isWorkspaceLoading,
      fallbackInput.isWorkspaceScopeRefreshing,
      fallbackInput.route,
      fallbackInput.workspaceCount,
    ],
  );

  useEffect(() => {
    if (fallbackState.fallbackRoute) {
      navigate(fallbackState.fallbackRoute);
    }
  }, [fallbackState.fallbackRoute, navigate]);

  return fallbackState;
}
