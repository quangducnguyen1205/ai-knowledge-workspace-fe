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
  contextSnippet: string | null;
  createdAt: string | null;
  score: number | null;
};

type SearchResultPayload = Omit<SearchResult, 'startMs' | 'endMs' | 'contextSnippet'> & {
  startMs?: number | null;
  endMs?: number | null;
  contextSnippet?: string | null;
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

/**
 * Spring may add a canonical `contextSnippet` per moment independently of this deployment, so an
 * absent, null or whitespace-only field all mean "no canonical snippet" rather than empty text.
 */
function normalizeSearchContextSnippet(contextSnippet: string | null | undefined): string | null {
  return contextSnippet?.trim() || null;
}

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
      contextSnippet: normalizeSearchContextSnippet(result.contextSnippet),
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
