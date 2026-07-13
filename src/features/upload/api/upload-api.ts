import { request } from '../../../shared/api/http-client';
import type { AssetStatus } from '../../assets/model/types';

export type AssetUploadResponse = {
  assetId: string;
  processingJobId: string;
  assetStatus: AssetStatus;
  workspaceId: string;
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
