import { useCallback, useEffect, useState } from 'react';

export type AppRoute =
  | { name: 'home' }
  | { name: 'library' }
  | {
      name: 'asset';
      assetId: string;
      transcriptRowId?: string;
      source?: 'search';
      searchQuery?: string;
    }
  | { name: 'search'; searchQuery?: string }
  | { name: 'settings' };

function getCurrentHash(): string {
  if (typeof window === 'undefined') {
    return '#/';
  }

  return window.location.hash || '#/';
}

export function parseRoute(hash: string): AppRoute {
  const normalizedPath = hash.replace(/^#/, '') || '/';
  const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  const [pathname, queryString = ''] = path.split('?');
  const searchParams = new URLSearchParams(queryString);
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'library') {
    return { name: 'library' };
  }

  if (segments[0] === 'search') {
    const searchQuery = searchParams.get('q')?.trim() || undefined;

    return { name: 'search', searchQuery };
  }

  if (segments[0] === 'settings') {
    return { name: 'settings' };
  }

  if (segments[0] === 'assets' && segments[1]) {
    const transcriptRowId = searchParams.get('row')?.trim() || undefined;
    const source = searchParams.get('from') === 'search' ? 'search' : undefined;
    const searchQuery = searchParams.get('q')?.trim() || undefined;

    return {
      name: 'asset',
      assetId: decodeURIComponent(segments[1]),
      transcriptRowId,
      source,
      searchQuery,
    };
  }

  return { name: 'home' };
}

export function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'library':
      return '#/library';
    case 'search':
      {
        const params = new URLSearchParams();

        if (route.searchQuery?.trim()) {
          params.set('q', route.searchQuery.trim());
        }

        const queryString = params.toString();
        return `#/search${queryString ? `?${queryString}` : ''}`;
      }
    case 'settings':
      return '#/settings';
    case 'asset':
      {
        const params = new URLSearchParams();

        if (route.transcriptRowId) {
          params.set('row', route.transcriptRowId);
        }

        if (route.source === 'search') {
          params.set('from', 'search');
        }

        if (route.searchQuery?.trim()) {
          params.set('q', route.searchQuery.trim());
        }

        const queryString = params.toString();
        return `#/assets/${encodeURIComponent(route.assetId)}${queryString ? `?${queryString}` : ''}`;
      }
    default:
      return '#/';
  }
}

export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(getCurrentHash()));

  useEffect(() => {
    function handleHashChange() {
      setRoute(parseRoute(getCurrentHash()));
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextHash = routeToHash(nextRoute);

    if (typeof window === 'undefined') {
      setRoute(nextRoute);
      return;
    }

    if (window.location.hash === nextHash) {
      setRoute(nextRoute);
      return;
    }

    window.location.hash = nextHash;
  }, []);

  return [route, navigate];
}
