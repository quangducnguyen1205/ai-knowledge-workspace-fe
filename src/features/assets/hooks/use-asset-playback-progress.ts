import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getAssetPlaybackProgress, putAssetPlaybackProgress } from '../api/assets-api';
import { normalizePlaybackPositionMs } from '../model/playback-progress';
import type { MediaPlaybackSnapshot, MediaPlaybackState } from '../player/media-player';
import { assetKeys } from './asset-queries';

/** Longest gap between two saves while playback continues normally. */
export const PLAYBACK_PROGRESS_SAVE_INTERVAL_MS = 5_000;

/**
 * A position may drift by at most the elapsed wall-clock time plus this tolerance during
 * normal playback. A larger jump is treated as an explicit seek and saved immediately.
 */
export const PLAYBACK_PROGRESS_SEEK_TOLERANCE_MS = 2_000;

type SavePlaybackProgressInput = {
  assetId: string;
  positionMs: number;
  completed: boolean;
};

type PlaybackTracking = {
  assetId: string | null;
  hasPlaybackStarted: boolean;
  /** Latest position observed from meaningful playback; the value a final flush persists. */
  latestPositionMs: number | null;
  lastSaved: { positionMs: number; completed: boolean } | null;
  lastSaveAt: number;
};

/**
 * Decides whether a snapshot's position describes playback the learner performed.
 *
 * A player that is being created, cued, reset or torn down also reports a position — usually a
 * reset `0`. Removing a playing media element, for example, emits a `loadstart` that the Upload
 * adapter maps to `unstarted` at position `0`. Letting such a snapshot replace the tracked
 * position would make the final flush persist `0` and destroy real progress when Study switches
 * directly from one Asset to another.
 *
 * This deliberately keys on playback state plus session context rather than on `positionMs === 0`,
 * so starting from the beginning, replaying after completion, seeking to zero and backward seeks
 * all remain persistable.
 */
export function shouldTrackPlaybackPosition(
  state: MediaPlaybackState,
  hasPlaybackStarted: boolean,
): boolean {
  switch (state) {
    // Playback is happening, including a legitimate start or replay at position zero.
    case 'playing':
      return true;
    // Meaningful only once playback has actually begun in this session.
    case 'paused':
    case 'buffering':
    case 'ended':
      return hasPlaybackStarted;
    // Provider lifecycle, cueing, reset and teardown states never describe playback.
    case 'unstarted':
    case 'cued':
    case 'error':
    default:
      return false;
  }
}

function emptyTracking(assetId: string | null): PlaybackTracking {
  return {
    assetId,
    hasPlaybackStarted: false,
    latestPositionMs: null,
    lastSaved: null,
    lastSaveAt: 0,
  };
}

/**
 * Owns source-neutral playback progress for one Asset: the Spring read, the bounded save
 * policy and the per-Asset tracking state.
 *
 * Saves never invalidate Asset, transcript or search queries, and every write carries the
 * Asset id it was recorded for so a late save can never target a different Asset.
 */
export function useAssetPlaybackProgress({
  assetId,
  enabled,
}: {
  assetId: string | null;
  enabled: boolean;
}) {
  const trackingRef = useRef<PlaybackTracking>(emptyTracking(null));

  const progressQuery = useQuery({
    queryKey: assetId
      ? assetKeys.playbackProgress(assetId)
      : ['assets', 'playback-progress', 'empty'],
    queryFn: ({ signal }) => getAssetPlaybackProgress(assetId as string, signal),
    enabled: Boolean(assetId) && enabled,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (input: SavePlaybackProgressInput) => putAssetPlaybackProgress(input.assetId, {
      positionMs: input.positionMs,
      completed: input.completed,
    }),
    retry: false,
  });

  const saveRef = useRef(saveMutation.mutate);
  const resetSaveRef = useRef(saveMutation.reset);
  saveRef.current = saveMutation.mutate;
  resetSaveRef.current = saveMutation.reset;

  const save = useCallback((targetAssetId: string, positionMs: number, completed: boolean) => {
    const tracking = trackingRef.current;
    const previous = tracking.lastSaved;
    if (previous && previous.positionMs === positionMs && previous.completed === completed) return;

    tracking.lastSaved = { positionMs, completed };
    tracking.lastSaveAt = Date.now();
    saveRef.current({ assetId: targetAssetId, positionMs, completed });
  }, []);

  /**
   * Best-effort save of the latest meaningful playback position for one specific Asset.
   *
   * The Asset identity is checked against the tracking record rather than assumed from effect
   * ordering, so a flush can only ever persist the position it actually tracked for that Asset.
   */
  const flush = useCallback((targetAssetId: string) => {
    const tracking = trackingRef.current;
    if (tracking.assetId !== targetAssetId || !tracking.hasPlaybackStarted) return;
    if (tracking.latestPositionMs === null) return;

    save(targetAssetId, tracking.latestPositionMs, tracking.lastSaved?.completed ?? false);
  }, [save]);

  const observePlayback = useCallback((snapshot: MediaPlaybackSnapshot) => {
    const tracking = trackingRef.current;
    if (!assetId || tracking.assetId !== assetId || snapshot.state === 'error') return;

    if (snapshot.state === 'playing') tracking.hasPlaybackStarted = true;

    const observedPositionMs = normalizePlaybackPositionMs(snapshot.positionMs);
    if (
      observedPositionMs !== null &&
      shouldTrackPlaybackPosition(snapshot.state, tracking.hasPlaybackStarted)
    ) {
      tracking.latestPositionMs = observedPositionMs;
    }

    // Loading metadata, cueing or tearing down a player is not playback interaction.
    if (!tracking.hasPlaybackStarted) return;

    const positionMs = tracking.latestPositionMs;
    if (positionMs === null) return;

    if (snapshot.state === 'ended') {
      save(assetId, positionMs, true);
      return;
    }

    if (snapshot.state === 'paused') {
      save(assetId, positionMs, false);
      return;
    }

    if (snapshot.state !== 'playing' && snapshot.state !== 'buffering') return;

    // The first save of a playback session, and any save that clears a completed record,
    // happen immediately rather than waiting for the interval.
    if (tracking.lastSaved === null || tracking.lastSaved.completed) {
      save(assetId, positionMs, false);
      return;
    }

    const elapsedMs = Date.now() - tracking.lastSaveAt;
    const seeked = Math.abs(positionMs - tracking.lastSaved.positionMs)
      > elapsedMs + PLAYBACK_PROGRESS_SEEK_TOLERANCE_MS;

    if (seeked || elapsedMs >= PLAYBACK_PROGRESS_SAVE_INTERVAL_MS) {
      save(assetId, positionMs, false);
    }
  }, [assetId, save]);

  useEffect(() => {
    trackingRef.current = emptyTracking(enabled ? assetId : null);
    resetSaveRef.current();

    // Cleanup determines the outgoing Asset's final save from its own tracking record, and only
    // then discards it. The incoming Asset starts from a cleared record above.
    return () => {
      if (assetId) flush(assetId);
      trackingRef.current = emptyTracking(null);
    };
  }, [assetId, enabled, flush]);

  useEffect(() => {
    if (!assetId || !enabled) return undefined;

    function saveOnHide() {
      if (document.visibilityState === 'hidden') flush(assetId as string);
    }

    document.addEventListener('visibilitychange', saveOnHide);
    return () => document.removeEventListener('visibilitychange', saveOnHide);
  }, [assetId, enabled, flush]);

  const progress = progressQuery.data?.assetId === assetId ? progressQuery.data : undefined;

  return {
    progress,
    progressError: progressQuery.error,
    isProgressLoading: progressQuery.isLoading,
    saveFailed: Boolean(saveMutation.error),
    observePlayback,
  };
}
