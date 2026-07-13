export type AssetStatus = 'PROCESSING' | 'TRANSCRIPT_READY' | 'SEARCHABLE' | 'FAILED';
export type ProcessingJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type AssetSummary = {
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
};

export type AssetIndexResponse = {
  assetId: string;
  assetStatus: AssetStatus;
  indexedDocumentCount: number;
};

export type AssetRecordResponse = {
  id: string;
  title: string;
  status: AssetStatus;
  workspaceId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UpdateAssetTitleInput = {
  assetId: string;
  title: string;
};
