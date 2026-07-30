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

  it('builds an absolute browser URL from origin, pathname and the canonical hash', () => {
    const permalink = buildMomentPermalink('asset-1', 'row-2', {
      origin: 'https://workspace.example',
      pathname: '/app/',
    });

    expect(permalink).toBe('https://workspace.example/app/#/assets/asset-1?row=row-2');
  });

  it('preserves a non-root deployment pathname', () => {
    expect(buildMomentPermalink('asset-1', 'row-2', {
      origin: 'https://workspace.example',
      pathname: '/team/workspace/app/',
    })).toBe('https://workspace.example/team/workspace/app/#/assets/asset-1?row=row-2');
  });

  it('strips the current page query string instead of copying it into the bookmark', () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          origin: 'https://workspace.example',
          pathname: '/app/',
          search: '?code=secret&state=temporary',
          hash: '#/search',
        },
      },
    });

    try {
      const permalink = buildMomentPermalink('asset-1', 'row-2');

      expect(permalink).toBe('https://workspace.example/app/#/assets/asset-1?row=row-2');
      for (const leaked of ['code=', 'state=', 'secret', 'temporary', '?code']) {
        expect(permalink).not.toContain(leaked);
      }
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    }
  });

  it('never copies callback-style or transient parameters from the current page', () => {
    const permalink = buildMomentPermalink('asset-1', 'row-2', {
      origin: 'https://workspace.example',
      // A pathname never carries these; the point is that only origin + pathname are used.
      pathname: '/app/',
    });

    for (const excluded of [
      'code=', 'state=', 'session_state=', 'tenant=', 'workspaceId=', 'from=', 'q=',
    ]) {
      expect(permalink).not.toContain(excluded);
    }
    expect(permalink.slice(permalink.indexOf('#'))).toBe('#/assets/asset-1?row=row-2');
  });

  it('keeps encoding and the router round-trip correct in the absolute form', () => {
    const permalink = buildMomentPermalink('asset/one', 'row two&three', {
      origin: 'https://workspace.example',
      pathname: '/app/',
    });

    expect(permalink).toBe('https://workspace.example/app/#/assets/asset%2Fone?row=row+two%26three');
    expect(parseRoute(permalink.slice(permalink.indexOf('#')))).toMatchObject({
      name: 'asset',
      assetId: 'asset/one',
      transcriptRowId: 'row two&three',
    });
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
