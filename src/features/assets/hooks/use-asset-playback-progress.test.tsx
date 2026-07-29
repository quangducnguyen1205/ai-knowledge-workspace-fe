import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaPlaybackSnapshot } from '../player/media-player';
import {
  PLAYBACK_PROGRESS_SAVE_INTERVAL_MS,
  useAssetPlaybackProgress,
} from './use-asset-playback-progress';

const api = vi.hoisted(() => ({
  getAssetPlaybackProgress: vi.fn(),
  putAssetPlaybackProgress: vi.fn(),
}));

vi.mock('../api/assets-api', () => api);

function emptyProgress(assetId: string) {
  return { assetId, positionMs: 0, completed: false, updatedAt: null };
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidateQueries, wrapper };
}

function playing(positionMs: number | null): MediaPlaybackSnapshot {
  return { state: 'playing', positionMs };
}

function savedRequests() {
  return api.putAssetPlaybackProgress.mock.calls.map(([assetId, body]) => ({ assetId, ...body }));
}

/** React Query dispatches a mutation function on a microtask, so saves need a flush. */
async function flushSaves() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

type ProgressHook = { result: { current: { observePlayback: (s: MediaPlaybackSnapshot) => void } } };

async function observe(view: ProgressHook, ...snapshots: MediaPlaybackSnapshot[]) {
  act(() => {
    for (const snapshot of snapshots) view.result.current.observePlayback(snapshot);
  });
  await flushSaves();
}

beforeEach(() => {
  api.getAssetPlaybackProgress.mockResolvedValue(emptyProgress('asset-1'));
  api.putAssetPlaybackProgress.mockImplementation((assetId: string, body: {
    positionMs: number;
    completed: boolean;
  }) => Promise.resolve({ assetId, ...body, updatedAt: '2026-07-29T10:00:00Z' }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAssetPlaybackProgress reading', () => {
  it('reads saved progress for the enabled Asset only', async () => {
    api.getAssetPlaybackProgress.mockResolvedValue({
      assetId: 'asset-1',
      positionMs: 42_000,
      completed: false,
      updatedAt: '2026-07-29T10:00:00Z',
    });
    const { wrapper } = createHarness();
    const view = renderHook(
      ({ assetId, enabled }) => useAssetPlaybackProgress({ assetId, enabled }),
      { wrapper, initialProps: { assetId: 'asset-1' as string | null, enabled: true } },
    );

    await waitFor(() => expect(view.result.current.progress?.positionMs).toBe(42_000));
    expect(api.getAssetPlaybackProgress).toHaveBeenCalledWith('asset-1', expect.anything());
  });

  it('does not read progress when no usable player exists', async () => {
    const { wrapper } = createHarness();
    renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: false }), { wrapper });

    await act(async () => Promise.resolve());
    expect(api.getAssetPlaybackProgress).not.toHaveBeenCalled();
  });

  it('never exposes a response belonging to a different Asset', async () => {
    api.getAssetPlaybackProgress.mockResolvedValue({
      assetId: 'asset-stale',
      positionMs: 90_000,
      completed: false,
      updatedAt: null,
    });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await act(async () => Promise.resolve());
    expect(view.result.current.progress).toBeUndefined();
  });
});

describe('useAssetPlaybackProgress saving', () => {
  it('never saves for metadata, cueing or a position of zero before playback begins', async () => {
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });
    await act(async () => Promise.resolve());

    act(() => {
      view.result.current.observePlayback({ state: 'unstarted', positionMs: 0 });
      view.result.current.observePlayback({ state: 'cued', positionMs: 0 });
      view.result.current.observePlayback({ state: 'paused', positionMs: 0 });
      view.result.current.observePlayback({ state: 'buffering', positionMs: 0 });
    });

    expect(api.putAssetPlaybackProgress).not.toHaveBeenCalled();
  });

  it('saves at most once every five seconds while playing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(view, playing(1_000));
    expect(savedRequests()).toEqual([{ assetId: 'asset-1', positionMs: 1_000, completed: false }]);

    vi.advanceTimersByTime(2_000);
    await observe(view, playing(3_000));
    vi.advanceTimersByTime(2_900);
    await observe(view, playing(5_900));
    expect(api.putAssetPlaybackProgress).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(PLAYBACK_PROGRESS_SAVE_INTERVAL_MS);
    await observe(view, playing(10_900));
    expect(savedRequests()).toEqual([
      { assetId: 'asset-1', positionMs: 1_000, completed: false },
      { assetId: 'asset-1', positionMs: 10_900, completed: false },
    ]);
  });

  it('saves immediately after a meaningful explicit seek', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(view, playing(1_000));
    vi.advanceTimersByTime(1_000);
    await observe(view, playing(120_000));

    expect(savedRequests()).toEqual([
      { assetId: 'asset-1', positionMs: 1_000, completed: false },
      { assetId: 'asset-1', positionMs: 120_000, completed: false },
    ]);
  });

  it('saves immediately on pause and suppresses an unchanged duplicate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(view, playing(1_000));
    vi.advanceTimersByTime(1_500);
    await observe(
      view,
      { state: 'paused', positionMs: 2_500 },
      { state: 'paused', positionMs: 2_500 },
    );

    expect(savedRequests()).toEqual([
      { assetId: 'asset-1', positionMs: 1_000, completed: false },
      { assetId: 'asset-1', positionMs: 2_500, completed: false },
    ]);
  });

  it('ignores non-finite, negative and error positions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(
      view,
      playing(Number.NaN),
      playing(-1),
      playing(null),
      { state: 'error', positionMs: null },
    );

    expect(api.putAssetPlaybackProgress).not.toHaveBeenCalled();
  });

  it('marks completion on ended and clears it when playback starts again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(view, playing(1_000));
    vi.advanceTimersByTime(1_000);
    await observe(view, { state: 'ended', positionMs: 30_000 });
    expect(savedRequests()[1]).toEqual({
      assetId: 'asset-1',
      positionMs: 30_000,
      completed: true,
    });

    vi.advanceTimersByTime(500);
    await observe(view, playing(0));
    expect(savedRequests()[2]).toEqual({ assetId: 'asset-1', positionMs: 0, completed: false });
  });

  it('keeps playback usable when the save request fails', async () => {
    api.putAssetPlaybackProgress.mockRejectedValue(new Error('server unavailable'));
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    act(() => view.result.current.observePlayback(playing(1_000)));
    await waitFor(() => expect(view.result.current.saveFailed).toBe(true));

    expect(api.putAssetPlaybackProgress).toHaveBeenCalledTimes(1);
    expect(() => view.result.current.observePlayback({ state: 'paused', positionMs: 4_000 }))
      .not.toThrow();
  });

  it('does not invalidate Asset, transcript or search queries when saving', async () => {
    const { wrapper, invalidateQueries } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });
    await act(async () => Promise.resolve());

    act(() => view.result.current.observePlayback(playing(1_000)));
    await waitFor(() => expect(api.putAssetPlaybackProgress).toHaveBeenCalledTimes(1));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('useAssetPlaybackProgress Asset switching', () => {
  it('flushes the outgoing Asset and never writes its position to the next Asset', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(
      ({ assetId }) => useAssetPlaybackProgress({ assetId, enabled: true }),
      { wrapper, initialProps: { assetId: 'asset-a' as string | null } },
    );

    await observe(view, playing(1_000));
    vi.advanceTimersByTime(1_000);
    await observe(view, playing(2_000));
    expect(savedRequests()).toEqual([{ assetId: 'asset-a', positionMs: 1_000, completed: false }]);

    act(() => view.rerender({ assetId: 'asset-b' }));
    await flushSaves();

    const afterSwitch = savedRequests();
    expect(afterSwitch[1]).toEqual({ assetId: 'asset-a', positionMs: 2_000, completed: false });
    expect(afterSwitch.filter((request) => request.assetId === 'asset-b')).toEqual([]);

    // Tracking state, throttling and pending position must not survive the switch.
    await observe(
      view,
      { state: 'paused', positionMs: 500 },
      { state: 'cued', positionMs: 0 },
    );
    expect(savedRequests().filter((request) => request.assetId === 'asset-b')).toEqual([]);

    await observe(view, playing(750));
    expect(savedRequests().filter((request) => request.assetId === 'asset-b')).toEqual([
      { assetId: 'asset-b', positionMs: 750, completed: false },
    ]);
  });

  it('performs a best-effort final save when the document is hidden and on unmount', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { wrapper } = createHarness();
    const view = renderHook(() => useAssetPlaybackProgress({ assetId: 'asset-1', enabled: true }), {
      wrapper,
    });

    await observe(view, playing(1_000));
    vi.advanceTimersByTime(1_000);
    await observe(view, playing(3_000));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await flushSaves();
    expect(savedRequests()[1]).toEqual({ assetId: 'asset-1', positionMs: 3_000, completed: false });

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.advanceTimersByTime(1_000);
    await observe(view, playing(4_000));
    act(() => view.unmount());
    await flushSaves();

    expect(savedRequests()[2]).toEqual({ assetId: 'asset-1', positionMs: 4_000, completed: false });
    expect(savedRequests().every((request) => request.assetId === 'asset-1')).toBe(true);
  });
});
