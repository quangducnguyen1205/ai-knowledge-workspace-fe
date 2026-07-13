import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAssetUpload } from './use-asset-upload';

const api = vi.hoisted(() => ({ uploadAsset: vi.fn() }));
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

describe('useAssetUpload', () => {
  it('owns workspace request mapping, list refresh and the post-success contract', async () => {
    api.uploadAsset.mockResolvedValue({
      assetId: 'asset-2',
      workspaceId: 'workspace-1',
      title: 'Lifecycle lecture',
      status: 'PROCESSING',
      createdAt: '2026-06-26T10:00:00Z',
    });
    const onUploaded = vi.fn();
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(
      () => useAssetUpload({ workspaceId: 'workspace-1', onUploaded }),
      { wrapper },
    );
    const file = new File(['video'], 'lecture.mp4', { type: 'video/mp4' });

    act(() => result.current.submit({ file, title: 'Lifecycle lecture' }));
    await waitFor(() => expect(result.current.uploadedAssetId).toBe('asset-2'));

    expect(api.uploadAsset.mock.calls[0]?.[0]).toEqual({
      workspaceId: 'workspace-1',
      file,
      title: 'Lifecycle lecture',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'list', 'workspace-1'] });
    expect(onUploaded).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-2', status: 'PROCESSING' }),
      expect.objectContaining({ workspaceId: 'workspace-1', file }),
    );
  });

  it('does not submit without a workspace and resets a completed result when scope changes', async () => {
    api.uploadAsset.mockResolvedValue({
      assetId: 'asset-2',
      workspaceId: 'workspace-1',
      title: 'lecture.mp4',
      status: 'PROCESSING',
      createdAt: '2026-06-26T10:00:00Z',
    });
    const file = new File(['video'], 'lecture.mp4', { type: 'video/mp4' });
    const { wrapper } = createHarness();
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useAssetUpload({ workspaceId, onUploaded: vi.fn() }),
      { initialProps: { workspaceId: 'workspace-1' as string | null }, wrapper },
    );

    act(() => result.current.submit({ file }));
    await waitFor(() => expect(result.current.uploadedAssetId).toBe('asset-2'));
    rerender({ workspaceId: null });
    await waitFor(() => expect(result.current.uploadedAssetId).toBeUndefined());
    act(() => result.current.submit({ file }));

    expect(api.uploadAsset).toHaveBeenCalledTimes(1);
  });
});
