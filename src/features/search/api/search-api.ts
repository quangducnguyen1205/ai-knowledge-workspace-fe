import type { TranscriptContextResponse } from '../../../entities/transcript/model/types';
import { buildQueryString, request } from '../../../shared/api/http-client';

export type SearchResult = {
  assetId: string;
  assetTitle: string;
  transcriptRowId: string | null;
  segmentIndex: number | null;
  text: string;
  createdAt: string | null;
  score: number | null;
};

export type SearchResponse = {
  query: string;
  workspaceIdFilter: string;
  assetIdFilter: string | null;
  resultCount: number;
  results: SearchResult[];
};

export async function searchTranscript(
  query: string,
  workspaceId: string,
  assetId?: string | null,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  return request<SearchResponse>(
    `/api/search${buildQueryString({ q: query, workspaceId, assetId: assetId ?? undefined })}`,
    { signal },
  );
}

export async function getTranscriptContext(
  assetId: string,
  transcriptRowId: string,
  window = 2,
  signal?: AbortSignal,
): Promise<TranscriptContextResponse> {
  return request<TranscriptContextResponse>(
    `/api/assets/${assetId}/transcript/context${buildQueryString({
      transcriptRowId,
      window: String(window),
    })}`,
    { signal },
  );
}
