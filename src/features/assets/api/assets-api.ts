import type { TranscriptRow } from '../../../entities/transcript/model/types';
import { buildQueryString, request } from '../../../shared/api/http-client';
import type {
  AssetIndexResponse,
  AssetRecordResponse,
  AssetStatusResponse,
  AssetSummary,
  UpdateAssetTitleInput,
} from '../model/types';

type AssetListEnvelope = {
  items: AssetSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export async function listAssets(workspaceId: string): Promise<AssetSummary[]> {
  const response = await request<AssetSummary[] | AssetListEnvelope>(
    `/api/assets${buildQueryString({ workspaceId })}`,
  );

  return Array.isArray(response) ? response : response.items;
}

export async function deleteAsset(assetId: string): Promise<void> {
  await request<void>(`/api/assets/${assetId}`, { method: 'DELETE' });
}

export async function updateAssetTitle(input: UpdateAssetTitleInput): Promise<AssetRecordResponse> {
  return request<AssetRecordResponse>(`/api/assets/${input.assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: input.title }),
  });
}

export async function getAssetStatus(assetId: string, signal?: AbortSignal): Promise<AssetStatusResponse> {
  return request<AssetStatusResponse>(`/api/assets/${assetId}/status`, { signal });
}

export async function getAssetTranscript(assetId: string, signal?: AbortSignal): Promise<TranscriptRow[]> {
  return request<TranscriptRow[]>(`/api/assets/${assetId}/transcript`, { signal });
}

export async function indexAssetTranscript(assetId: string): Promise<AssetIndexResponse> {
  return request<AssetIndexResponse>(`/api/assets/${assetId}/index`, { method: 'POST' });
}
