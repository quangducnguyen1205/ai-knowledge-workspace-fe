import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAuthForTests } from '../../../shared/api/http-client';
import { listContinueWatching } from './continue-watching-api';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const itemPayload = {
  assetId: 'asset-1',
  workspaceId: 'workspace-1',
  assetTitle: 'Vector Clocks Lecture',
  sourceType: 'UPLOAD',
  positionMs: 61_000,
  completed: false,
  updatedAt: '2026-07-30T08:00:00Z',
};

function listPayload(items: unknown[]) {
  return {
    workspaceIdFilter: 'workspace-1',
    itemCount: items.length,
    maxItems: 12,
    items,
  };
}

afterEach(() => {
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('continue watching API mapping', () => {
  it('reads one workspace through the shared Spring client', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([itemPayload])));
    vi.stubGlobal('fetch', fetchMock);

    const response = await listContinueWatching('workspace-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/playback-progress?workspaceId=workspace-1');
    expect(response.maxItems).toBe(12);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      assetId: 'asset-1',
      assetTitle: 'Vector Clocks Lecture',
      sourceType: 'UPLOAD',
      positionMs: 61_000,
      completed: false,
      updatedAt: '2026-07-30T08:00:00Z',
    });
  });

  it('normalizes an absent, null or negative position to null rather than zero', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([
        { ...itemPayload, assetId: 'a', positionMs: null },
        { ...itemPayload, assetId: 'b', positionMs: -5 },
        { assetId: 'c', workspaceId: 'workspace-1', assetTitle: 'No position', completed: false },
      ]))));

    const response = await listContinueWatching('workspace-1');

    expect(response.items.map((item) => item.positionMs)).toEqual([null, null, null]);
  });

  it('keeps a zero position as an unusable timestamp rather than a real one', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([{ ...itemPayload, positionMs: 0 }]))));

    const response = await listContinueWatching('workspace-1');

    expect(response.items[0].positionMs).toBe(0);
  });

  it('floors a fractional position to whole milliseconds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([{ ...itemPayload, positionMs: 61_000.9 }]))));

    expect((await listContinueWatching('workspace-1')).items[0].positionMs).toBe(61_000);
  });

  it('treats an unknown source type as null instead of guessing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([{ ...itemPayload, sourceType: 'PODCAST' }]))));

    expect((await listContinueWatching('workspace-1')).items[0].sourceType).toBeNull();
  });

  it('normalizes a missing or blank updated time to null', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([
        { ...itemPayload, assetId: 'a', updatedAt: null },
        { ...itemPayload, assetId: 'b', updatedAt: '' },
      ]))));

    expect((await listContinueWatching('workspace-1')).items.map((item) => item.updatedAt))
      .toEqual([null, null]);
  });

  it('coerces a missing completion flag to false', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([
        { assetId: 'a', workspaceId: 'workspace-1', assetTitle: 'No flag', positionMs: 1_000 },
      ]))));

    expect((await listContinueWatching('workspace-1')).items[0].completed).toBe(false);
  });

  it('surfaces a bounded client error instead of a backend payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' }, 404)));

    await expect(listContinueWatching('workspace-1')).rejects.toMatchObject({
      status: 404,
      code: 'WORKSPACE_NOT_FOUND',
    });
  });

  it('never calls anything except the Spring product API', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(listPayload([])));
    vi.stubGlobal('fetch', fetchMock);

    await listContinueWatching('workspace-1');

    for (const [path, init] of fetchMock.mock.calls) {
      expect(String(path)).toMatch(/^\/api\//);
      expect(init?.method ?? 'GET').toBe('GET');
    }
  });
});
