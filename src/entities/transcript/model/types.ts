export type TranscriptRow = {
  id: string | null;
  videoId: string | null;
  segmentIndex: number | null;
  text: string;
  createdAt: string | null;
};

export type TranscriptContextResponse = {
  assetId: string;
  transcriptRowId: string;
  hitSegmentIndex: number | null;
  window: number;
  rows: TranscriptRow[];
};
