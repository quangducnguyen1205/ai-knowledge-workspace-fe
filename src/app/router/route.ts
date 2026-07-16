export type AppRoute =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'library'; upload?: boolean }
  | {
      name: 'asset';
      assetId: string;
      transcriptRowId?: string;
      source?: 'search' | 'assistant';
      searchQuery?: string;
    }
  | { name: 'search'; searchQuery?: string }
  | { name: 'settings' };

export function getCurrentHash(): string {
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

  if (segments[0] === 'login') {
    return { name: 'login' };
  }

  if (segments[0] === 'register') {
    return { name: 'register' };
  }

  if (segments[0] === 'library') {
    return searchParams.get('upload') === '1' ? { name: 'library', upload: true } : { name: 'library' };
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
    const sourceParam = searchParams.get('from');
    const source = sourceParam === 'search' || sourceParam === 'assistant' ? sourceParam : undefined;
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
    case 'login':
      return '#/login';
    case 'register':
      return '#/register';
    case 'library':
      return route.upload ? '#/library?upload=1' : '#/library';
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

        if (route.source) {
          params.set('from', route.source);
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
