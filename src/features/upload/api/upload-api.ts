import { request } from '../../../shared/api/http-client';
import type { AssetProcessingResponse } from '../../assets/public';

export type AssetUploadResponse = AssetProcessingResponse;

export type CreateYouTubeAssetInput = {
  workspaceId: string;
  url: string;
  title?: string;
};

export type UploadAssetInput = {
  workspaceId: string;
  file: File;
  title?: string;
};

export async function uploadAsset(input: UploadAssetInput): Promise<AssetUploadResponse> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('workspaceId', input.workspaceId);

  if (input.title?.trim()) {
    formData.append('title', input.title.trim());
  }

  return request<AssetUploadResponse>('/api/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function createYouTubeAsset(
  input: CreateYouTubeAssetInput,
): Promise<AssetProcessingResponse> {
  const title = input.title?.trim();

  return request<AssetProcessingResponse>('/api/assets/youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      url: input.url.trim(),
      ...(title ? { title } : {}),
    }),
  });
}
