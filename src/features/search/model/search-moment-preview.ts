import type { SearchResult } from '../api/search-api';

/** `search` namespace key the caller renders when there is no previewable text. */
export const MISSING_SEARCH_MOMENT_PREVIEW_KEY = 'missingPreview';

/**
 * Chooses the preview text for a moment without changing the moment itself: the canonical Spring
 * `contextSnippet` is preferred and the exact matching row `text` stays the compatibility
 * fallback. The two values are never concatenated, so navigation identity and the complete
 * matching row remain the Asset view's responsibility.
 *
 * `null` means the result carries no readable text; the caller renders the localized bounded
 * label (`MISSING_SEARCH_MOMENT_PREVIEW_KEY`) rather than this module owning copy.
 */
export function resolveSearchMomentPreview(
  result: Pick<SearchResult, 'contextSnippet' | 'text'>,
): string | null {
  return result.contextSnippet?.trim() || result.text?.trim() || null;
}
