import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAssetMediaUrl } from '../api/assets-api';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('authorized Upload media URL', () => {
  it('derives the exact Spring media path from the Asset id alone', () => {
    expect(buildAssetMediaUrl('11111111-2222-3333-4444-555555555555')).toBe(
      '/api/assets/11111111-2222-3333-4444-555555555555/media',
    );
  });

  it('exposes no storage, filename or provider identity', () => {
    const url = buildAssetMediaUrl('asset-upload');

    expect(url).toBe('/api/assets/asset-upload/media');
    expect(url).not.toMatch(/minio|bucket|object|key|presigned|\.mp4|lecture|9000|8000/i);
    expect(url).not.toMatch(/^https?:/);
    expect(url).not.toMatch(/[?#]/);
  });

  it('encodes the Asset id instead of trusting it as a path fragment', () => {
    expect(buildAssetMediaUrl('a b/c')).toBe('/api/assets/a%20b%2Fc/media');
  });

  it('follows the configured API base convention used by every other product request', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'https://backend.example.test/');

    const { buildAssetMediaUrl: buildWithBase } = await import('../api/assets-api');

    expect(buildWithBase('asset-upload')).toBe(
      'https://backend.example.test/api/assets/asset-upload/media',
    );
  });
});
