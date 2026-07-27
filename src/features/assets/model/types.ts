export type AssetStatus = 'PROCESSING' | 'TRANSCRIPT_READY' | 'SEARCHABLE' | 'FAILED';
export type ProcessingJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type AssetSourceType = 'UPLOAD' | 'YOUTUBE';

export type AssetSourceMetadata = {
  sourceType: AssetSourceType;
  youtubeVideoId: string | null;
  sourceUrl: string | null;
};

export type AssetSummary = AssetSourceMetadata & {
  assetId: string;
  title: string;
  assetStatus: AssetStatus;
  workspaceId: string;
  createdAt: string;
};

export type AssetStatusResponse = {
  assetId: string;
  processingJobId: string;
  assetStatus: AssetStatus;
  processingJobStatus: ProcessingJobStatus;
  failureCode?: string | null;
};

export type AssetIndexResponse = {
  assetId: string;
  assetStatus: AssetStatus;
  indexedDocumentCount: number;
};

export type AssetRecordResponse = AssetSourceMetadata & {
  id: string;
  originalFilename: string | null;
  title: string;
  status: AssetStatus;
  workspaceId: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AssetProcessingResponse = AssetSourceMetadata & {
  assetId: string;
  processingJobId: string;
  assetStatus: AssetStatus;
  workspaceId: string;
};

export type UpdateAssetTitleInput = {
  assetId: string;
  title: string;
};
