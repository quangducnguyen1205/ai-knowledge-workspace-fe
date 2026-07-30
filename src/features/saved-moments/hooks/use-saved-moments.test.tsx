import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAuthForTests } from '../../../shared/api/http-client';
import { savedMomentKeys, useSavedMoments } from './use-saved-moments';

type Payload = Record<string, unknown>;

function moment(overrides: Payload = {}): Payload {
  return {
    savedMomentId: 'saved-1',
    workspaceId: 'workspace-1',
    assetId: 'asset-1',
    assetTitle: 'Vector Clocks Lecture',
    sourceType: 'UPLOAD',
    transcriptRowId: 'row-2',
    segmentIndex: 2,
    startMs: 1_000,
    endMs: 2_000,
    text: 'Vector clocks preserve causal relationships.',
    savedAt: '2026-07-30T08:00:00Z',
    ...overrides,
  };
}

function listPayload(workspaceId: string, items: Payload[]) {
  return {
    workspaceIdFilter: workspaceId,
    savedMomentCount: items.length,
    maxItems: 100,
    items,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

afterEach(() => {
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('workspace-scoped saved moment state', () => {
  it('keys the cache by Workspace so a switch never shows the previous list', async () => {
    const fetchMock = vi.fn(async (input?: RequestInfo | URL) => {
      const url = String(input);
      return url.includes('workspace-2')
        ? jsonResponse(listPayload('workspace-2', [moment({
            savedMomentId: 'saved-2',
            workspaceId: 'workspace-2',
            assetId: 'asset-2',
            transcriptRowId: 'row-9',
          })]))
        : jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string }) => useSavedMoments(workspaceId),
      { wrapper: Wrapper, initialProps: { workspaceId: 'workspace-1' } },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].savedMomentId).toBe('saved-1');

    rerender({ workspaceId: 'workspace-2' });

    await waitFor(() => expect(result.current.items[0]?.savedMomentId).toBe('saved-2'));
    expect(result.current.items.map((item) => item.workspaceId)).toEqual(['workspace-2']);
    expect(savedMomentKeys.list('workspace-1')).not.toEqual(savedMomentKeys.list('workspace-2'));
  });

  it('renders nothing and issues no request without a selected Workspace', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(listPayload('workspace-1', [moment()])));
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments(null), { wrapper: Wrapper });

    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports which canonical moments are already saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(listPayload('workspace-1', [moment()]))));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.isSaved('asset-1', 'row-2')).toBe(true);
    expect(result.current.isSaved('asset-1', 'row-3')).toBe(false);
    expect(result.current.isSaved('asset-2', 'row-2')).toBe(false);
    expect(result.current.isSaved('asset-1', null)).toBe(false);
  });

  it('adds a newly saved moment to the front of the workspace list', async () => {
    const fetchMock = vi.fn(async (input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse(moment({ savedMomentId: 'saved-new', transcriptRowId: 'row-7' }));
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.save({ assetId: 'asset-1', transcriptRowId: 'row-7' }));

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items[0].savedMomentId).toBe('saved-new');
    expect(result.current.isSaved('asset-1', 'row-7')).toBe(true);
  });

  it('keeps a repeated save idempotent in the rendered list', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse(moment());
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-2' });
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-2' });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].savedMomentId).toBe('saved-1');
  });

  it('removes a moment from the list without refetching the whole workspace', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse(null, 204);
      }
      return jsonResponse(listPayload('workspace-1', [
        moment(),
        moment({ savedMomentId: 'saved-2', transcriptRowId: 'row-3' }),
      ]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      result.current.remove('saved-1');
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].savedMomentId).toBe('saved-2');
    expect(result.current.isSaved('asset-1', 'row-2')).toBe(false);
  });

  it('keeps the existing list usable when a save fails', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ code: 'SAVED_MOMENT_TARGET_NOT_FOUND' }, 404);
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-gone' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.saveError).toBeTruthy());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.isSaved('asset-1', 'row-gone')).toBe(false);
  });

  it('keeps the existing list usable when a removal fails', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse({ code: 'SAVED_MOMENT_NOT_FOUND' }, 404);
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      result.current.remove('saved-1');
    });

    await waitFor(() => expect(result.current.removeError).toBeTruthy());
    expect(result.current.items).toHaveLength(1);
  });

  it('attributes a save failure to the exact moment it was attempted for', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ code: 'SAVED_MOMENT_TARGET_NOT_FOUND' }, 404);
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.saveErrorKey).toBeNull();

    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-gone' })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.saveErrorKey).toBe('asset-1::row-gone'));
    // Another canonical moment must not inherit the failure.
    expect(result.current.saveErrorKey).not.toBe('asset-1::row-2');
    expect(result.current.saveErrorKey).not.toBe('asset-2::row-gone');
    expect(result.current.savingKey).toBeNull();
  });

  it('clears the failed key when the same moment is retried successfully', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ code: 'SAVED_MOMENT_TARGET_NOT_FOUND' }, 503)
          : jsonResponse(moment({ savedMomentId: 'saved-retry', transcriptRowId: 'row-7' }));
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-7' })
        .catch(() => undefined);
    });
    await waitFor(() => expect(result.current.saveErrorKey).toBe('asset-1::row-7'));

    // Retrying the failed moment remains possible and a success clears its feedback.
    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-7' });
    });

    await waitFor(() => expect(result.current.saveErrorKey).toBeNull());
    expect(result.current.isSaved('asset-1', 'row-7')).toBe(true);
  });

  it('keeps saved and saving keys item-specific while one shared mutation stays in flight', async () => {
    let releaseSave: (() => void) | null = null;
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        await new Promise<void>((resolve) => { releaseSave = resolve; });
        return jsonResponse(moment({ savedMomentId: 'saved-slow', transcriptRowId: 'row-7' }));
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    let pending: Promise<unknown> | null = null;
    act(() => {
      pending = result.current.saveAsync({ assetId: 'asset-1', transcriptRowId: 'row-7' });
    });

    await waitFor(() => expect(result.current.savingKey).toBe('asset-1::row-7'));
    expect(result.current.savingKey).not.toBe('asset-1::row-2');
    expect(result.current.isSaved('asset-1', 'row-2')).toBe(true);
    expect(result.current.isSaved('asset-1', 'row-7')).toBe(false);
    expect(result.current.saveErrorKey).toBeNull();

    await act(async () => {
      releaseSave?.();
      await pending;
    });

    await waitFor(() => expect(result.current.savingKey).toBeNull());
    expect(result.current.isSaved('asset-1', 'row-7')).toBe(true);
  });

  it('does not merge a save that belongs to a different Workspace', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse(moment({ savedMomentId: 'saved-other', workspaceId: 'workspace-2' }));
      }
      return jsonResponse(listPayload('workspace-1', [moment()]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useSavedMoments('workspace-1'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.saveAsync({ assetId: 'asset-9', transcriptRowId: 'row-9' });
    });

    expect(result.current.items.map((item) => item.savedMomentId)).not.toContain('saved-other');
  });
});
