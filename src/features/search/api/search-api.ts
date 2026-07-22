import {
  normalizeTranscriptContext,
  type TranscriptContextResponse,
  type TranscriptContextResponsePayload,
} from '../../../entities/transcript/model/types';
import { buildQueryString, request } from '../../../shared/api/http-client';

export type SearchResult = {
  assetId: string;
  assetTitle: string;
  transcriptRowId: string | null;
  segmentIndex: number | null;
  startMs: number | null;
  endMs: number | null;
  text: string;
  createdAt: string | null;
  score: number | null;
};

type SearchResultPayload = Omit<SearchResult, 'startMs' | 'endMs'> & {
  startMs?: number | null;
  endMs?: number | null;
};

type SearchResponsePayload = Omit<SearchResponse, 'results'> & {
  results: SearchResultPayload[];
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
  const response = await request<SearchResponsePayload>(
    `/api/search${buildQueryString({ q: query, workspaceId, assetId: assetId ?? undefined })}`,
    { signal },
  );
  return {
    ...response,
    results: response.results.map((result) => ({
      ...result,
      startMs: result.startMs ?? null,
      endMs: result.endMs ?? null,
    })),
  };
}

export async function getTranscriptContext(
  assetId: string,
  transcriptRowId: string,
  window = 2,
  signal?: AbortSignal,
): Promise<TranscriptContextResponse> {
  const response = await request<TranscriptContextResponsePayload>(
    `/api/assets/${assetId}/transcript/context${buildQueryString({
      transcriptRowId,
      window: String(window),
    })}`,
    { signal },
  );
  return normalizeTranscriptContext(response);
}
