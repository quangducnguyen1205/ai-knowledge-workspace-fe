import { describe, expect, it } from 'vitest';
import { resolveProtectedRouteFallback } from './use-protected-route-fallback';

const baseInput = {
  route: { name: 'search' } as const,
  isAuthenticated: true,
  isCurrentUserLoading: false,
  isCurrentUserFetching: false,
  hasSelectedWorkspace: false,
  isWorkspaceLoading: false,
  isWorkspaceFetching: false,
  isWorkspaceScopeRefreshing: false,
  workspaceCount: 0,
};

describe('protected route fallback resolution', () => {
  it('preserves valid deep routes while current user bootstrap is unresolved', () => {
    expect(
      resolveProtectedRouteFallback({
        ...baseInput,
        route: { name: 'asset', assetId: 'asset-1', transcriptRowId: 'row-2', source: 'search' },
        isCurrentUserLoading: true,
      }),
    ).toEqual({
      bootstrapPending: true,
      fallbackRoute: null,
      routeCanRender: false,
    });
  });

  it('preserves valid deep routes while workspace selection is still settling', () => {
    expect(
      resolveProtectedRouteFallback({
        ...baseInput,
        workspaceCount: 1,
      }),
    ).toEqual({
      bootstrapPending: true,
      fallbackRoute: null,
      routeCanRender: false,
    });
  });

  it('falls back only after authenticated workspace state resolves empty', () => {
    expect(resolveProtectedRouteFallback(baseInput)).toEqual({
      bootstrapPending: false,
      fallbackRoute: { name: 'home' },
      routeCanRender: false,
    });
  });

  it('does not redirect public setup routes without a selected workspace', () => {
    expect(resolveProtectedRouteFallback({ ...baseInput, route: { name: 'settings' } })).toEqual({
      bootstrapPending: false,
      fallbackRoute: null,
      routeCanRender: true,
    });
  });
});
