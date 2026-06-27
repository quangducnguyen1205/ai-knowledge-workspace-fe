import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash } from './router';

describe('hash route helpers', () => {
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
});
