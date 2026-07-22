import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResponse } from '../../search/api/search-api';
import type { AssetSummary } from '../model/types';
import { assetKeys } from './asset-queries';
import { useAssetManagement } from './use-asset-management';

const deletedAsset: AssetSummary = {
  assetId: 'asset-1',
  title: 'Delete me',
  assetStatus: 'PROCESSING',
  workspaceId: 'workspace-1',
  createdAt: '2026-07-16T00:00:00Z',
};

const retainedAsset: AssetSummary = {
  ...deletedAsset,
  assetId: 'asset-2',
  title: 'Keep me',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAssetManagement deletion cleanup', () => {
  it('immediately evicts the deleted asset from every frontend product cache and current route', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(assetKeys.list('workspace-1'), [deletedAsset, retainedAsset]);
    queryClient.setQueryData(assetKeys.detail('asset-1'), { id: 'asset-1' });
    queryClient.setQueryData(assetKeys.status('asset-1'), { assetId: 'asset-1' });
    queryClient.setQueryData(assetKeys.transcript('asset-1'), [{ id: 'row-1' }]);
    queryClient.setQueryData(['search', 'context', 'asset-1', 'row-1', 2], { assetId: 'asset-1' });
    queryClient.setQueryData<SearchResponse>(['search', 'results', 'workspace-1', 'all-assets', 'topic'], {
      query: 'topic',
      workspaceIdFilter: 'workspace-1',
      assetIdFilter: null,
      resultCount: 2,
      results: [
        { assetId: 'asset-1', assetTitle: 'Delete me', transcriptRowId: 'row-1', segmentIndex: 1, startMs: null, endMs: null, text: 'topic', createdAt: null, score: 2 },
        { assetId: 'asset-2', assetTitle: 'Keep me', transcriptRowId: 'row-2', segmentIndex: 2, startMs: null, endMs: null, text: 'topic', createdAt: null, score: 1 },
      ],
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onClearAssetReferences = vi.fn();
    const onDeletedSelectedRoute = vi.fn();
    const selectedAssetIdRef = { current: 'asset-1' as string | null };
    const preferredAssetIdRef = { current: 'asset-1' as string | null };

    const { result } = renderHook(() => useAssetManagement({
      currentUserId: 'user-1',
      workspaceId: 'workspace-1',
      workspaceName: 'Workspace',
      noticeContextKey: 'user-1:workspace-1:asset-1',
      selectedAsset: deletedAsset,
      selectedAssetId: 'asset-1',
      selectedAssetIdRef,
      preferredAssetIdRef,
      setSelectedAssetId: vi.fn((assetId) => { selectedAssetIdRef.current = assetId; }),
      setPreferredAssetId: vi.fn((assetId) => { preferredAssetIdRef.current = assetId; }),
      onClearAssetReferences,
      onAssetTitleChanged: vi.fn(),
      onDeletedSelectedRoute,
    }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => result.current.handleDeleteAsset(deletedAsset));

    await waitFor(() => expect(onDeletedSelectedRoute).toHaveBeenCalledWith('asset-1'));
    expect(queryClient.getQueryData<AssetSummary[]>(assetKeys.list('workspace-1')))
      .toEqual([retainedAsset]);
    expect(queryClient.getQueryData(assetKeys.detail('asset-1'))).toBeUndefined();
    expect(queryClient.getQueryData(assetKeys.status('asset-1'))).toBeUndefined();
    expect(queryClient.getQueryData(assetKeys.transcript('asset-1'))).toBeUndefined();
    expect(queryClient.getQueriesData({ queryKey: ['search', 'context', 'asset-1'] })).toHaveLength(0);
    expect(queryClient.getQueryData<SearchResponse>(['search', 'results', 'workspace-1', 'all-assets', 'topic'])?.results)
      .toEqual([expect.objectContaining({ assetId: 'asset-2' })]);
    expect(onClearAssetReferences).toHaveBeenCalledWith('asset-1');
    expect(selectedAssetIdRef.current).toBeNull();
    expect(preferredAssetIdRef.current).toBeNull();
  });
});
