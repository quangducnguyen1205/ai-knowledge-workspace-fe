import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAuthForTests } from '../../../shared/api/http-client';
import { listSavedMoments, removeSavedMoment, saveMoment } from './saved-moments-api';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const savedMomentPayload = {
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
};

afterEach(() => {
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('saved moments API mapping', () => {
  it('lists moments for one workspace through the shared Spring client', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      workspaceIdFilter: 'workspace-1',
      savedMomentCount: 1,
      maxItems: 100,
      items: [savedMomentPayload],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await listSavedMoments('workspace-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/saved-moments?workspaceId=workspace-1');
    expect(response.maxItems).toBe(100);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      savedMomentId: 'saved-1',
      assetId: 'asset-1',
      transcriptRowId: 'row-2',
      sourceType: 'UPLOAD',
      startMs: 1_000,
      endMs: 2_000,
    });
  });

  it('normalizes absent and null timing to null rather than zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      workspaceIdFilter: 'workspace-1',
      savedMomentCount: 2,
      maxItems: 100,
      items: [
        { ...savedMomentPayload, savedMomentId: 'saved-null', startMs: null, endMs: null, segmentIndex: null },
        {
          savedMomentId: 'saved-absent',
          workspaceId: 'workspace-1',
          assetId: 'asset-1',
          assetTitle: 'Lecture',
          transcriptRowId: 'row-3',
          text: 'No timing.',
          savedAt: '2026-07-30T08:00:00Z',
        },
      ],
    })));

    const response = await listSavedMoments('workspace-1');

    expect(response.items[0]).toMatchObject({ startMs: null, endMs: null, segmentIndex: null });
    expect(response.items[1]).toMatchObject({ startMs: null, endMs: null, segmentIndex: null });
  });

  it('treats an unknown source type as null instead of guessing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      workspaceIdFilter: 'workspace-1',
      savedMomentCount: 1,
      maxItems: 100,
      items: [{ ...savedMomentPayload, sourceType: 'PODCAST' }],
    })));

    const response = await listSavedMoments('workspace-1');

    expect(response.items[0].sourceType).toBeNull();
  });

  it('saves only the Asset and canonical row identity', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse(savedMomentPayload));
    vi.stubGlobal('fetch', fetchMock);

    const saved = await saveMoment({ assetId: 'asset-1', transcriptRowId: 'row-2' });

    const [path, init] = fetchMock.mock.calls[0];
    expect(String(path)).toBe('/api/saved-moments');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ assetId: 'asset-1', transcriptRowId: 'row-2' });
    expect(saved.savedMomentId).toBe('saved-1');
  });

  it('removes a saved moment by identifier', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse(null, 204));
    vi.stubGlobal('fetch', fetchMock);

    await removeSavedMoment('saved-1');

    const [path, init] = fetchMock.mock.calls[0];
    expect(String(path)).toBe('/api/saved-moments/saved-1');
    expect(init?.method).toBe('DELETE');
  });

  it('surfaces a bounded client error instead of a backend payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse(
      { code: 'SAVED_MOMENT_TARGET_NOT_FOUND', message: 'Video moment not found' },
      404,
    )));

    await expect(saveMoment({ assetId: 'asset-1', transcriptRowId: 'row-gone' })).rejects.toMatchObject({
      status: 404,
      code: 'SAVED_MOMENT_TARGET_NOT_FOUND',
    });
  });

  it('never calls anything except the Spring product API', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      workspaceIdFilter: 'workspace-1',
      savedMomentCount: 0,
      maxItems: 100,
      items: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listSavedMoments('workspace-1');

    for (const [path] of fetchMock.mock.calls) {
      expect(String(path)).toMatch(/^\/api\//);
    }
  });
});
