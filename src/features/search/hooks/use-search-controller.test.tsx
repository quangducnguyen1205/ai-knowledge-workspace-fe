import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchResponse, SearchResult } from '../api/search-api';
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
  contextSnippet: null,
  createdAt: '2026-06-26T10:02:00Z',
  score: 3.21,
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function searchResponse(query: string, workspaceId: string): SearchResponse {
  return {
    query,
    workspaceIdFilter: workspaceId,
    assetIdFilter: null,
    resultCount: 1,
    results: [{ ...resultRow, text: `${query} in ${workspaceId}` }],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

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

  it('normalizes a blank query to no submission and does not call the API', async () => {
    const { result } = renderHook(
      () => useSearchController({ workspaceId: 'workspace-1', assetId: null }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.submit(' \n\t '));

    expect(result.current.submittedSearch).toBeNull();
    expect(result.current.searchResponse).toBeUndefined();
    await waitFor(() => expect(api.searchTranscript).not.toHaveBeenCalled());
  });

  it('does not request again for an identical normalized submission', async () => {
    api.searchTranscript.mockResolvedValue(searchResponse('vector clocks', 'workspace-1'));
    const { result } = renderHook(
      () => useSearchController({ workspaceId: 'workspace-1', assetId: null }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.submit('  vector clocks  '));
    await waitFor(() => expect(result.current.searchResponse?.query).toBe('vector clocks'));

    act(() => result.current.submit('vector clocks'));

    expect(result.current.submittedSearch).toBe('vector clocks');
    expect(api.searchTranscript).toHaveBeenCalledTimes(1);
  });

  it('does not let a late response from an older query replace the current query', async () => {
    const firstRequest = deferred<SearchResponse>();
    const secondRequest = deferred<SearchResponse>();
    const signals = new Map<string, AbortSignal>();
    api.searchTranscript.mockImplementation(
      (query: string, _workspaceId: string, _assetId: string | null | undefined, signal?: AbortSignal) => {
        if (signal) signals.set(query, signal);
        return query === 'first query' ? firstRequest.promise : secondRequest.promise;
      },
    );
    const { result } = renderHook(
      () => useSearchController({ workspaceId: 'workspace-1', assetId: null }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.submit('first query'));
    await waitFor(() => expect(api.searchTranscript).toHaveBeenCalledTimes(1));
    act(() => result.current.submit('second query'));
    await waitFor(() => expect(api.searchTranscript).toHaveBeenCalledTimes(2));
    expect(signals.get('first query')?.aborted).toBe(true);

    act(() => secondRequest.resolve(searchResponse('second query', 'workspace-1')));
    await waitFor(() => expect(result.current.searchResponse?.query).toBe('second query'));

    act(() => firstRequest.resolve(searchResponse('first query', 'workspace-1')));
    await waitFor(() => expect(result.current.searchResponse?.query).toBe('second query'));
  });

  it('aborts the old Workspace request and ignores its late response', async () => {
    const workspaceOneRequest = deferred<SearchResponse>();
    const workspaceTwoRequest = deferred<SearchResponse>();
    const signals = new Map<string, AbortSignal>();
    api.searchTranscript.mockImplementation(
      (_query: string, workspaceId: string, _assetId: string | null | undefined, signal?: AbortSignal) => {
        if (signal) signals.set(workspaceId, signal);
        return workspaceId === 'workspace-1' ? workspaceOneRequest.promise : workspaceTwoRequest.promise;
      },
    );
    const { result, rerender } = renderHook(
      ({ workspaceId }) => useSearchController({ workspaceId, assetId: null }),
      { initialProps: { workspaceId: 'workspace-1' }, wrapper: createWrapper() },
    );

    act(() => result.current.submit('vector clocks'));
    await waitFor(() => expect(api.searchTranscript).toHaveBeenCalledTimes(1));
    rerender({ workspaceId: 'workspace-2' });

    await waitFor(() => expect(signals.get('workspace-1')?.aborted).toBe(true));
    await waitFor(() => expect(result.current.submittedSearch).toBeNull());
    expect(result.current.searchResponse).toBeUndefined();
    expect(api.searchTranscript).toHaveBeenCalledTimes(1);
    expect(result.current.selectedResult).toBeNull();

    act(() => result.current.submit('vector clocks'));
    await waitFor(() => expect(api.searchTranscript).toHaveBeenCalledTimes(2));
    act(() => workspaceTwoRequest.resolve(searchResponse('vector clocks', 'workspace-2')));
    await waitFor(() => expect(result.current.searchResponse?.workspaceIdFilter).toBe('workspace-2'));

    act(() => workspaceOneRequest.resolve(searchResponse('vector clocks', 'workspace-1')));
    await waitFor(() => expect(result.current.searchResponse?.workspaceIdFilter).toBe('workspace-2'));
  });
});
