import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../api/search-api';
import { useSearchController } from './use-search-controller';

const api = vi.hoisted(() => ({ searchTranscript: vi.fn(), getTranscriptContext: vi.fn() }));
vi.mock('../api/search-api', () => api);

const resultRow: SearchResult = {
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  startMs: 0,
  endMs: 1250,
  text: 'Vector clocks preserve causality.',
  createdAt: '2026-06-26T10:02:00Z',
  score: 3.21,
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => cleanup());

describe('useSearchController', () => {
  it('owns trimmed workspace/asset scope and the selected transcript context window', async () => {
    api.searchTranscript.mockResolvedValue({
      query: 'vector clocks',
      workspaceIdFilter: 'workspace-1',
      assetIdFilter: 'asset-1',
      resultCount: 1,
      results: [resultRow],
    });
    api.getTranscriptContext.mockResolvedValue({
      assetId: 'asset-1', transcriptRowId: 'row-2', hitSegmentIndex: 2, window: 2, rows: [],
    });
    const { result } = renderHook(
      () => useSearchController({ workspaceId: 'workspace-1', assetId: 'asset-1' }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.submit('  vector clocks  '));
    await waitFor(() => expect(result.current.searchResponse?.resultCount).toBe(1));
    expect(api.searchTranscript.mock.calls[0]?.slice(0, 3)).toEqual(['vector clocks', 'workspace-1', 'asset-1']);

    act(() => result.current.setSelectedResult(resultRow));
    expect(result.current.selectedResult).toMatchObject({ startMs: 0, endMs: 1250 });
    await waitFor(() => expect(result.current.contextResponse?.transcriptRowId).toBe('row-2'));
    expect(api.getTranscriptContext.mock.calls[0]?.slice(0, 3)).toEqual(['asset-1', 'row-2', 2]);
  });

  it('aborts stale search work and resets answer-independent state when scope changes', async () => {
    const signals: AbortSignal[] = [];
    api.searchTranscript.mockImplementation(
      (_query: string, _workspaceId: string, _assetId: string | null | undefined, signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      },
    );
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useSearchController({ workspaceId, assetId: null }),
      { initialProps: { workspaceId: 'workspace-1' }, wrapper: createWrapper() },
    );

    act(() => result.current.submit('vector clocks'));
    await waitFor(() => expect(signals).toHaveLength(1));
    rerender({ workspaceId: 'workspace-2' });

    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
    await waitFor(() => expect(result.current.submittedSearch).toBeNull());
    expect(result.current.selectedResult).toBeNull();
  });
});
