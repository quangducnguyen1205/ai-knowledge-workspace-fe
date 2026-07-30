import { describe, expect, it } from 'vitest';
import { parseRoute } from '../../../app/router';
import { buildMomentPermalink, buildMomentRouteHash } from './moment-link';

describe('canonical moment permalink', () => {
  it('carries only the Asset and canonical transcript-row identity', () => {
    expect(buildMomentRouteHash('asset-1', 'row-2')).toBe('#/assets/asset-1?row=row-2');
  });

  it('never depends on search origin, query or cached result state', () => {
    const hash = buildMomentRouteHash('asset-1', 'row-2');

    expect(hash).not.toContain('from=');
    expect(hash).not.toContain('q=');
    expect(hash).not.toContain('workspace');
  });

  it('round-trips through the router back to the same canonical moment', () => {
    const route = parseRoute(buildMomentRouteHash('asset-1', 'row-2'));

    expect(route).toEqual({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'row-2',
      source: undefined,
      searchQuery: undefined,
    });
  });

  it('encodes identifiers that need escaping', () => {
    const hash = buildMomentRouteHash('asset/one', 'row two&three');

    expect(hash).toBe('#/assets/asset%2Fone?row=row+two%26three');
    expect(parseRoute(hash)).toMatchObject({ assetId: 'asset/one', transcriptRowId: 'row two&three' });
  });

  it('builds an absolute browser URL for the clipboard', () => {
    const permalink = buildMomentPermalink('asset-1', 'row-2', {
      origin: 'https://workspace.example',
      pathname: '/app/',
      search: '',
    });

    expect(permalink).toBe('https://workspace.example/app/#/assets/asset-1?row=row-2');
  });

  it('preserves an existing deployment query string', () => {
    expect(buildMomentPermalink('asset-1', 'row-2', {
      origin: 'https://workspace.example',
      pathname: '/',
      search: '?tenant=acme',
    })).toBe('https://workspace.example/?tenant=acme#/assets/asset-1?row=row-2');
  });

  it('falls back to the hash when there is no browser location', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error deliberately simulating a non-browser environment
    delete globalThis.window;

    try {
      expect(buildMomentPermalink('asset-1', 'row-2')).toBe('#/assets/asset-1?row=row-2');
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
