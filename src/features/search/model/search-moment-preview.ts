import type { SearchResult } from '../api/search-api';

export const MISSING_SEARCH_MOMENT_PREVIEW = 'Transcript snippet unavailable.';

/**
 * Chooses the preview text for a moment without changing the moment itself: the canonical Spring
 * `contextSnippet` is preferred, the exact matching row `text` stays the compatibility fallback,
 * and a bounded label covers results that carry neither. The two values are never concatenated,
 * so navigation identity and the complete matching row remain the Asset view's responsibility.
 */
export function resolveSearchMomentPreview(
  result: Pick<SearchResult, 'contextSnippet' | 'text'>,
): string {
  return result.contextSnippet?.trim() || result.text?.trim() || MISSING_SEARCH_MOMENT_PREVIEW;
}
