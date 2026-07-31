import { buildQueryString, request } from '../../../shared/api/http-client';
import type { AssetSourceType } from '../../assets/public';

export type ContinueWatchingItem = {
  assetId: string;
  workspaceId: string;
  assetTitle: string;
  sourceType: AssetSourceType | null;
  positionMs: number | null;
  completed: boolean;
  updatedAt: string | null;
};

export type ContinueWatchingResponse = {
  workspaceIdFilter: string;
  itemCount: number;
  maxItems: number;
  items: ContinueWatchingItem[];
};

type ContinueWatchingItemPayload = Omit<ContinueWatchingItem, 'sourceType' | 'positionMs' | 'updatedAt'> & {
  sourceType?: string | null;
  positionMs?: number | null;
  updatedAt?: string | null;
};

type ContinueWatchingResponsePayload = Omit<ContinueWatchingResponse, 'items'> & {
  items: ContinueWatchingItemPayload[];
};

const SOURCE_TYPES: AssetSourceType[] = ['UPLOAD', 'YOUTUBE'];

/**
 * A position is only usable when it is a finite, non-negative number of milliseconds. Anything
 * else becomes `null` so the surface can say the timestamp is unavailable instead of showing a
 * misleading `00:00`.
 */
function normalizePositionMs(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function normalizeItem(payload: ContinueWatchingItemPayload): ContinueWatchingItem {
  const sourceType = payload.sourceType?.trim().toUpperCase();

  return {
    ...payload,
    sourceType: SOURCE_TYPES.includes(sourceType as AssetSourceType)
      ? (sourceType as AssetSourceType)
      : null,
    positionMs: normalizePositionMs(payload.positionMs),
    completed: payload.completed === true,
    updatedAt: typeof payload.updatedAt === 'string' && payload.updatedAt ? payload.updatedAt : null,
  };
}

export async function listContinueWatching(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<ContinueWatchingResponse> {
  const response = await request<ContinueWatchingResponsePayload>(
    `/api/playback-progress${buildQueryString({ workspaceId })}`,
    { signal },
  );
  return { ...response, items: response.items.map(normalizeItem) };
}
