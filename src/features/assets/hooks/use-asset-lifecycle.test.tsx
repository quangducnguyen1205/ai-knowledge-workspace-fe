import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetSummary } from '../model/types';
import { ASSET_LIFECYCLE_POLL_INTERVAL_MS, useAssetLifecycle } from './use-asset-lifecycle';

const api = vi.hoisted(() => ({
  getAssetStatus: vi.fn(),
  getAssetTranscript: vi.fn(),
  indexAssetTranscript: vi.fn(),
}));

vi.mock('../api/assets-api', () => api);

const processingAsset: AssetSummary = {
  assetId: 'asset-1',
  title: 'Lifecycle lecture',
  assetStatus: 'PROCESSING',
  workspaceId: 'workspace-1',
  createdAt: '2026-06-26T10:00:00Z',
};

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, invalidateQueries, wrapper };
}

afterEach(() => cleanup());

describe('useAssetLifecycle', () => {
  it('uses the frozen three-second interval and stops after the automatic searchable transition', async () => {
    api.getAssetStatus
      .mockResolvedValueOnce({
        assetId: 'asset-1',
        processingJobId: 'job-1',
        assetStatus: 'PROCESSING',
        processingJobStatus: 'RUNNING',
      })
      .mockResolvedValue({
        assetId: 'asset-1',
        processingJobId: 'job-1',
        assetStatus: 'SEARCHABLE',
        processingJobStatus: 'SUCCEEDED',
      });
    api.getAssetTranscript.mockResolvedValue([]);
    const { invalidateQueries, wrapper } = createHarness();
    const { result } = renderHook(
      () => useAssetLifecycle({ asset: processingAsset, workspaceId: 'workspace-1' }),
      { wrapper },
    );

    expect(ASSET_LIFECYCLE_POLL_INTERVAL_MS).toBe(3_000);
    await waitFor(() => expect(result.current.statusResponse?.assetStatus).toBe('PROCESSING'));
    expect(result.current.shouldPoll).toBe(true);

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.resolvedAssetStatus).toBe('SEARCHABLE'));

    expect(result.current.shouldPoll).toBe(false);
    expect(result.current.canUseSearch).toBe(true);
    expect(result.current.canUseAssistant).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'list', 'workspace-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['search'] });
  });

  it('aborts an obsolete status request when asset selection changes', async () => {
    const observedSignals: AbortSignal[] = [];
    api.getAssetStatus.mockImplementation((_assetId: string, signal?: AbortSignal) => {
      if (signal) observedSignals.push(signal);
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    const { wrapper } = createHarness();
    const { rerender } = renderHook(
      ({ asset }) => useAssetLifecycle({ asset, workspaceId: 'workspace-1' }),
      { initialProps: { asset: processingAsset }, wrapper },
    );

    await waitFor(() => expect(observedSignals).toHaveLength(1));
    rerender({ asset: { ...processingAsset, assetId: 'asset-2', title: 'New selection' } });

    await waitFor(() => expect(observedSignals[0]?.aborted).toBe(true));
    await waitFor(() => expect(observedSignals).toHaveLength(2));
  });

  it('keeps explicit indexing behind the recovery command and refreshes lifecycle/search state', async () => {
    api.getAssetStatus.mockResolvedValue({
      assetId: 'asset-1',
      processingJobId: 'job-1',
      assetStatus: 'TRANSCRIPT_READY',
      processingJobStatus: 'SUCCEEDED',
    });
    api.getAssetTranscript.mockResolvedValue([{ id: 'row-1', videoId: 'asset-1', segmentIndex: 1, text: 'Ready' }]);
    api.indexAssetTranscript.mockResolvedValue({
      assetId: 'asset-1',
      assetStatus: 'SEARCHABLE',
      indexedDocumentCount: 1,
    });
    const { invalidateQueries, wrapper } = createHarness();
    const transcriptReadyAsset = { ...processingAsset, assetStatus: 'TRANSCRIPT_READY' as const };
    const { result } = renderHook(
      () => useAssetLifecycle({ asset: transcriptReadyAsset, workspaceId: 'workspace-1' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.canRunRecoveryIndexing).toBe(true));
    act(() => result.current.runRecoveryIndexing());
    await waitFor(() => expect(result.current.indexResponse?.assetStatus).toBe('SEARCHABLE'));

    expect(api.indexAssetTranscript).toHaveBeenCalledWith('asset-1', expect.any(Object));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'list', 'workspace-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['search'] });
  });
});
