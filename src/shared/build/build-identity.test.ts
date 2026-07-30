import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAppRevision, resolveAppRevision } from './build-identity';

const original = (globalThis as Record<string, unknown>).__APP_REVISION__;

afterEach(() => {
  vi.stubGlobal('__APP_REVISION__', original);
});

describe('frontend build identity', () => {
  it('reports the revision the build injected', () => {
    vi.stubGlobal('__APP_REVISION__', '19f475d0704ee978645214ad073db6b263bf6dec');

    expect(resolveAppRevision()).toBe('19f475d0704ee978645214ad073db6b263bf6dec');
    expect(formatAppRevision(resolveAppRevision())).toBe('19f475d0704e');
  });

  it('degrades safely when the build supplied nothing', () => {
    vi.stubGlobal('__APP_REVISION__', '');

    expect(resolveAppRevision()).toBeNull();
    expect(formatAppRevision(null)).toBe('unknown');
  });

  it('degrades safely when the define is missing entirely', () => {
    vi.stubGlobal('__APP_REVISION__', undefined);

    expect(resolveAppRevision()).toBeNull();
  });

  it('treats a whitespace-only revision as absent', () => {
    vi.stubGlobal('__APP_REVISION__', '   ');

    expect(resolveAppRevision()).toBeNull();
  });
});
