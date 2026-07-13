import type { SearchResult } from '../api/search-api';

export function resolveTranscriptLookupId(result: SearchResult): string | null {
  if (result.transcriptRowId) return result.transcriptRowId;
  return result.segmentIndex !== null ? `segment-${result.segmentIndex}` : null;
}
