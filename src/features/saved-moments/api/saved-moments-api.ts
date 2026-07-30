import { buildQueryString, request } from '../../../shared/api/http-client';
import type { AssetSourceType } from '../../assets/model/types';

export type SavedMoment = {
  savedMomentId: string;
  workspaceId: string;
  assetId: string;
  assetTitle: string;
  sourceType: AssetSourceType | null;
  transcriptRowId: string;
  segmentIndex: number | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
  savedAt: string;
};

export type SavedMomentListResponse = {
  workspaceIdFilter: string;
  savedMomentCount: number;
  maxItems: number;
  items: SavedMoment[];
};

type SavedMomentPayload = Omit<SavedMoment, 'startMs' | 'endMs' | 'segmentIndex' | 'sourceType'> & {
  segmentIndex?: number | null;
  startMs?: number | null;
  endMs?: number | null;
  sourceType?: string | null;
};

type SavedMomentListPayload = Omit<SavedMomentListResponse, 'items'> & {
  items: SavedMomentPayload[];
};

export type SaveMomentInput = {
  assetId: string;
  transcriptRowId: string;
};

const SOURCE_TYPES: AssetSourceType[] = ['UPLOAD', 'YOUTUBE'];

/**
 * Nullable timing and source type are normalized exactly like search results, so an absent field
 * and an explicit null both mean "unknown" rather than zero.
 */
function normalizeSavedMoment(payload: SavedMomentPayload): SavedMoment {
  const sourceType = payload.sourceType?.trim().toUpperCase();

  return {
    ...payload,
    segmentIndex: payload.segmentIndex ?? null,
    startMs: payload.startMs ?? null,
    endMs: payload.endMs ?? null,
    sourceType: SOURCE_TYPES.includes(sourceType as AssetSourceType)
      ? (sourceType as AssetSourceType)
      : null,
  };
}

export async function listSavedMoments(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<SavedMomentListResponse> {
  const response = await request<SavedMomentListPayload>(
    `/api/saved-moments${buildQueryString({ workspaceId })}`,
    { signal },
  );
  return { ...response, items: response.items.map(normalizeSavedMoment) };
}

export async function saveMoment(input: SaveMomentInput): Promise<SavedMoment> {
  const response = await request<SavedMomentPayload>('/api/saved-moments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId: input.assetId, transcriptRowId: input.transcriptRowId }),
  });
  return normalizeSavedMoment(response);
}

export async function removeSavedMoment(savedMomentId: string): Promise<void> {
  await request<void>(`/api/saved-moments/${savedMomentId}`, { method: 'DELETE' });
}
