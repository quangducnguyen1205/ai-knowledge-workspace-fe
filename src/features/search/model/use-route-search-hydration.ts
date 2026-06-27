import { useEffect, useRef } from 'react';
import type { AppRoute } from '../../../app/router';

export function getRouteSearchQuery(route: AppRoute): string | null {
  return route.name === 'search' ? route.searchQuery?.trim() || null : null;
}

export function useRouteSearchHydration({
  route,
  selectedWorkspaceId,
  searchableAssetCount,
  submittedSearch,
  onRouteSearchSubmit,
}: {
  route: AppRoute;
  selectedWorkspaceId: string | null;
  searchableAssetCount: number;
  submittedSearch: string | null;
  onRouteSearchSubmit: (query: string) => void;
}): string | null {
  const routeSearchQuery = getRouteSearchQuery(route);
  const lastRouteSearchSubmissionRef = useRef<string | null>(null);

  useEffect(() => {
    if (route.name !== 'search') {
      return;
    }

    if (!routeSearchQuery) {
      lastRouteSearchSubmissionRef.current = null;
      return;
    }

    if (!selectedWorkspaceId || searchableAssetCount === 0) {
      return;
    }

    const routeSearchKey = `${selectedWorkspaceId}:${routeSearchQuery}`;
    if (lastRouteSearchSubmissionRef.current === routeSearchKey && submittedSearch === routeSearchQuery) {
      return;
    }

    lastRouteSearchSubmissionRef.current = routeSearchKey;

    if (submittedSearch !== routeSearchQuery) {
      onRouteSearchSubmit(routeSearchQuery);
    }
  }, [onRouteSearchSubmit, route.name, routeSearchQuery, searchableAssetCount, selectedWorkspaceId, submittedSearch]);

  return routeSearchQuery;
}
