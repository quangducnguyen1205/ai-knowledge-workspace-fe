import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useHashRoute } from './use-hash-route';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '#/');
});

describe('useHashRoute', () => {
  it('updates route state synchronously with programmatic hash navigation', () => {
    window.history.replaceState({}, '', '#/');
    const { result } = renderHook(() => useHashRoute());

    act(() => {
      result.current[1]({ name: 'search', searchQuery: 'vector clocks' });
    });

    expect(result.current[0]).toEqual({
      name: 'search',
      searchQuery: 'vector clocks',
    });
    expect(window.location.hash).toBe('#/search?q=vector+clocks');
  });
});
