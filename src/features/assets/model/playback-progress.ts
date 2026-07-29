import type { AssetPlaybackProgress } from './types';

/**
 * A playback position is only usable when it is a finite, non-negative integer count of
 * milliseconds. Anything else becomes `null` and is never saved.
 */
export function normalizePlaybackPositionMs(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

/** Normalizes a Spring playback-progress representation into the single client shape. */
export function normalizeAssetPlaybackProgress(
  assetId: string,
  payload: Partial<AssetPlaybackProgress> | null | undefined,
): AssetPlaybackProgress {
  return {
    assetId: typeof payload?.assetId === 'string' && payload.assetId ? payload.assetId : assetId,
    positionMs: normalizePlaybackPositionMs(payload?.positionMs) ?? 0,
    completed: payload?.completed === true,
    updatedAt: typeof payload?.updatedAt === 'string' && payload.updatedAt ? payload.updatedAt : null,
  };
}
