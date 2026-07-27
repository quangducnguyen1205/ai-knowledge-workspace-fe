import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useYouTubeAssetCreation } from './use-youtube-asset-creation';

const api = vi.hoisted(() => ({ createYouTubeAsset: vi.fn() }));
vi.mock('../api/upload-api', () => api);

function createHarness() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidateQueries, wrapper };
}

afterEach(() => cleanup());

describe('useYouTubeAssetCreation', () => {
  it('owns workspace mapping and reuses the upload success invalidation callback contract', async () => {
    api.createYouTubeAsset.mockResolvedValue({
      assetId: 'asset-youtube',
      processingJobId: 'job-youtube',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
    });
    const onCreated = vi.fn();
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(
      () => useYouTubeAssetCreation({ workspaceId: 'workspace-1', onCreated }),
      { wrapper },
    );

    act(() => result.current.submit({
      url: 'https://youtu.be/abc_DEF-123',
      title: 'Causal ordering',
    }));
    await waitFor(() => expect(result.current.createdAssetId).toBe('asset-youtube'));

    expect(api.createYouTubeAsset.mock.calls[0]?.[0]).toEqual({
      workspaceId: 'workspace-1',
      url: 'https://youtu.be/abc_DEF-123',
      title: 'Causal ordering',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'list', 'workspace-1'] });
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-youtube', assetStatus: 'PROCESSING', sourceType: 'YOUTUBE' }),
      expect.objectContaining({ workspaceId: 'workspace-1', url: 'https://youtu.be/abc_DEF-123' }),
    );
  });

  it('prevents duplicate submission while the first creation request is pending', async () => {
    let resolveCreation: (value: unknown) => void = () => undefined;
    api.createYouTubeAsset.mockImplementation(() => new Promise((resolve) => {
      resolveCreation = resolve;
    }));
    const { wrapper } = createHarness();
    const { result } = renderHook(
      () => useYouTubeAssetCreation({ workspaceId: 'workspace-1', onCreated: vi.fn() }),
      { wrapper },
    );

    act(() => {
      result.current.submit({ url: 'https://youtu.be/abc_DEF-123' });
      result.current.submit({ url: 'https://youtu.be/abc_DEF-123' });
    });

    await waitFor(() => expect(api.createYouTubeAsset).toHaveBeenCalledTimes(1));

    act(() => resolveCreation({
      assetId: 'asset-youtube',
      processingJobId: 'job-youtube',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
    }));
    await waitFor(() => expect(result.current.isCreating).toBe(false));
  });
});
