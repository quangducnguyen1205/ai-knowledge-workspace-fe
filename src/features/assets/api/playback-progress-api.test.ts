import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApiAuth, resetApiAuthForTests } from '../../../shared/api/http-client';
import { getAssetPlaybackProgress, putAssetPlaybackProgress } from './assets-api';

function mockJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response;
}

function lastRequest(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: call?.[0] as string, init: call?.[1] as RequestInit };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetApiAuthForTests();
});

describe('playback progress API', () => {
  it('reads progress from the exact Spring path derived only from the Asset id', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({
      assetId: 'asset-1',
      positionMs: 12_345,
      completed: false,
      updatedAt: '2026-07-29T10:00:00Z',
    }));

    const progress = await getAssetPlaybackProgress('asset-1');

    const { url, init } = lastRequest(fetchMock);
    expect(url).toBe('/api/assets/asset-1/playback-progress');
    expect(init.method).toBeUndefined();
    expect(url).not.toMatch(/token|access|bearer|minio|bucket|filename|sourceUrl|youtube/i);
    expect(progress).toEqual({
      assetId: 'asset-1',
      positionMs: 12_345,
      completed: false,
      updatedAt: '2026-07-29T10:00:00Z',
    });
  });

  it('normalizes an empty progress record and defensive payload values', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({
      assetId: 'asset-1',
      positionMs: 0,
      completed: false,
      updatedAt: null,
    }));
    expect(await getAssetPlaybackProgress('asset-1')).toEqual({
      assetId: 'asset-1',
      positionMs: 0,
      completed: false,
      updatedAt: null,
    });

    fetchMock.mockResolvedValue(mockJsonResponse({
      positionMs: 1_200.9,
      completed: 'yes',
      updatedAt: '',
    }));
    expect(await getAssetPlaybackProgress('asset-2')).toEqual({
      assetId: 'asset-2',
      positionMs: 1_200,
      completed: false,
      updatedAt: null,
    });

    fetchMock.mockResolvedValue(mockJsonResponse({ positionMs: -5, completed: true }));
    expect(await getAssetPlaybackProgress('asset-3')).toEqual({
      assetId: 'asset-3',
      positionMs: 0,
      completed: true,
      updatedAt: null,
    });
  });

  it('saves progress with the exact contract body and no extra fields', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({
      assetId: 'asset-1',
      positionMs: 12_345,
      completed: false,
      updatedAt: '2026-07-29T10:00:00Z',
    }));

    await putAssetPlaybackProgress('asset-1', { positionMs: 12_345, completed: false });

    const { url, init } = lastRequest(fetchMock);
    expect(url).toBe('/api/assets/asset-1/playback-progress');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ positionMs: 12_345, completed: false });
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('delegates authentication to the shared API client in both modes', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({
      assetId: 'asset-1',
      positionMs: 0,
      completed: false,
      updatedAt: null,
    }));

    configureApiAuth({ mode: 'legacy_session' });
    await putAssetPlaybackProgress('asset-1', { positionMs: 1_000, completed: false });
    expect(lastRequest(fetchMock).init.credentials).toBe('include');
    expect(new Headers(lastRequest(fetchMock).init.headers).has('Authorization')).toBe(false);

    configureApiAuth({ mode: 'keycloak_jwt', getAccessToken: () => 'test-access-token' });
    await getAssetPlaybackProgress('asset-1');
    const bearerRequest = lastRequest(fetchMock);
    expect(bearerRequest.init.credentials).toBe('omit');
    expect(new Headers(bearerRequest.init.headers).get('Authorization'))
      .toBe('Bearer test-access-token');
    expect(bearerRequest.url).not.toMatch(/test-access-token/);
  });
});
