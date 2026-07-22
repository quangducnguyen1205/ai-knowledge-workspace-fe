export type TranscriptRow = {
  id: string | null;
  videoId: string | null;
  segmentIndex: number | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
  createdAt: string | null;
};

export type TranscriptRowPayload = Omit<TranscriptRow, 'startMs' | 'endMs'> & {
  startMs?: number | null;
  endMs?: number | null;
};

export type TranscriptContextResponse = {
  assetId: string;
  transcriptRowId: string;
  hitSegmentIndex: number | null;
  window: number;
  rows: TranscriptRow[];
};

export type TranscriptContextResponsePayload = Omit<TranscriptContextResponse, 'rows'> & {
  rows: TranscriptRowPayload[];
};

export function normalizeTranscriptRow(row: TranscriptRowPayload): TranscriptRow {
  return {
    ...row,
    startMs: row.startMs ?? null,
    endMs: row.endMs ?? null,
  };
}

export function normalizeTranscriptContext(
  response: TranscriptContextResponsePayload,
): TranscriptContextResponse {
  return {
    ...response,
    rows: response.rows.map(normalizeTranscriptRow),
  };
}
