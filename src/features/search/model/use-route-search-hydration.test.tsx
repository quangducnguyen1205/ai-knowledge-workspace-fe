import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppRoute } from '../../../app/router';
import { useRouteSearchHydration } from './use-route-search-hydration';

type HarnessProps = {
  route: AppRoute;
  selectedWorkspaceId: string | null;
  submittedSearch: string | null;
};

const searchableAssetCount = 1;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useRouteSearchHydration', () => {
  it('rehydrates the same route query after controller state resets while viewing an Asset', async () => {
    const onRouteSearchSubmit = vi.fn();
    const initialProps: HarnessProps = {
      route: { name: 'search', searchQuery: 'vector clocks' },
      selectedWorkspaceId: 'workspace-1',
      submittedSearch: null,
    };
    const { rerender } = renderHook(
      (props: HarnessProps) => useRouteSearchHydration({
        ...props,
        searchableAssetCount,
        onRouteSearchSubmit,
      }),
      { initialProps },
    );

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenCalledWith('vector clocks'));
    rerender({ ...initialProps, submittedSearch: 'vector clocks' });
    expect(onRouteSearchSubmit).toHaveBeenCalledTimes(1);

    rerender({
      ...initialProps,
      route: { name: 'asset', assetId: 'asset-1', searchQuery: 'vector clocks' },
      submittedSearch: null,
    });
    rerender(initialProps);

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenCalledTimes(2));
    expect(onRouteSearchSubmit).toHaveBeenLastCalledWith('vector clocks');
  });

  it('clears controller state when a query route becomes plain Search', async () => {
    const onRouteSearchSubmit = vi.fn();
    const initialProps: HarnessProps = {
      route: { name: 'search', searchQuery: 'causal order' },
      selectedWorkspaceId: 'workspace-1',
      submittedSearch: null,
    };
    const { rerender } = renderHook(
      (props: HarnessProps) => useRouteSearchHydration({
        ...props,
        searchableAssetCount,
        onRouteSearchSubmit,
      }),
      { initialProps },
    );

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenCalledWith('causal order'));
    rerender({ ...initialProps, submittedSearch: 'causal order' });
    rerender({
      ...initialProps,
      route: { name: 'search' },
      submittedSearch: 'causal order',
    });

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenLastCalledWith(''));
    expect(onRouteSearchSubmit.mock.calls).toEqual([['causal order'], ['']]);
  });

  it('starts a fresh route-query cycle after the Workspace switch clears the route', async () => {
    const onRouteSearchSubmit = vi.fn();
    const initialProps: HarnessProps = {
      route: { name: 'search', searchQuery: 'incident timeline' },
      selectedWorkspaceId: 'workspace-1',
      submittedSearch: null,
    };
    const { rerender } = renderHook(
      (props: HarnessProps) => useRouteSearchHydration({
        ...props,
        searchableAssetCount,
        onRouteSearchSubmit,
      }),
      { initialProps },
    );

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, submittedSearch: 'incident timeline' });
    rerender({
      route: { name: 'search' },
      selectedWorkspaceId: 'workspace-2',
      submittedSearch: null,
    });
    expect(onRouteSearchSubmit).toHaveBeenCalledTimes(1);

    rerender({
      route: { name: 'search', searchQuery: 'incident timeline' },
      selectedWorkspaceId: 'workspace-2',
      submittedSearch: null,
    });

    await waitFor(() => expect(onRouteSearchSubmit).toHaveBeenCalledTimes(2));
    expect(onRouteSearchSubmit).toHaveBeenLastCalledWith('incident timeline');
  });
});
