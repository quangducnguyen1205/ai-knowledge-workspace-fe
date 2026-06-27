import { useCallback, useEffect, useState } from 'react';
import { getCurrentHash, parseRoute, routeToHash, type AppRoute } from './route';

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
