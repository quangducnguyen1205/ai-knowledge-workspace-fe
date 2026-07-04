import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash } from './route';

describe('hash route helpers', () => {
  it('keeps plain app routes backward compatible', () => {
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/library')).toEqual({ name: 'library' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
    expect(routeToHash({ name: 'home' })).toBe('#/');
    expect(routeToHash({ name: 'library' })).toBe('#/library');
    expect(routeToHash({ name: 'settings' })).toBe('#/settings');
  });

  it('keeps the plain Search route backward compatible', () => {
    expect(parseRoute('#/search')).toEqual({ name: 'search', searchQuery: undefined });
    expect(routeToHash({ name: 'search' })).toBe('#/search');
  });

  it('decodes a safe Search route query', () => {
    expect(parseRoute('#/search?q=vector%20clocks')).toEqual({
      name: 'search',
      searchQuery: 'vector clocks',
    });
  });

  it('encodes trimmed Search query state without unrelated payload fields', () => {
    const hash = routeToHash({ name: 'search', searchQuery: '  vector clocks  ' });

    expect(hash).toBe('#/search?q=vector+clocks');
    expect(hash).not.toContain('row=');
    expect(hash).not.toContain('from=');
    expect(hash).not.toContain('assetTitle=');
    expect(hash).not.toContain('text=');
  });

  it('omits blank Search query state', () => {
    expect(routeToHash({ name: 'search', searchQuery: '   ' })).toBe('#/search');
    expect(parseRoute('#/search?q=%20%20')).toEqual({ name: 'search', searchQuery: undefined });
  });

  it('keeps compact Asset Detail study route state safe and encoded', () => {
    const hash = routeToHash({
      name: 'asset',
      assetId: 'asset/with spaces',
      transcriptRowId: 'row-2',
      source: 'search',
      searchQuery: '  vector clocks  ',
    });

    expect(hash).toBe('#/assets/asset%2Fwith%20spaces?row=row-2&from=search&q=vector+clocks');
    expect(parseRoute(hash)).toEqual({
      name: 'asset',
      assetId: 'asset/with spaces',
      transcriptRowId: 'row-2',
      source: 'search',
      searchQuery: 'vector clocks',
    });
    expect(hash).not.toContain('assetTitle=');
    expect(hash).not.toContain('text=');
  });

  it('keeps assistant citation focus route state compact', () => {
    const hash = routeToHash({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'segment-4',
      source: 'assistant',
    });

    expect(hash).toBe('#/assets/asset-1?row=segment-4&from=assistant');
    expect(parseRoute(hash)).toEqual({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'segment-4',
      source: 'assistant',
      searchQuery: undefined,
    });
  });
});
