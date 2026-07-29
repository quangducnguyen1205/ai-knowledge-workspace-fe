import type { SearchResult } from '../api/search-api';

export const UNTITLED_SEARCH_ASSET_LABEL = 'Untitled video';

export type SearchMomentGroup = {
  assetId: string;
  assetTitle: string;
  momentCount: number;
  results: SearchResult[];
};

/**
 * Groups the backend-ranked result stream for presentation without sorting either
 * Asset groups or the moments inside them.
 */
export function groupSearchMomentsByAsset(
  results: readonly SearchResult[],
): SearchMomentGroup[] {
  const groups = new Map<string, SearchMomentGroup>();

  for (const result of results) {
    const existingGroup = groups.get(result.assetId);

    if (existingGroup) {
      existingGroup.results.push(result);
      existingGroup.momentCount += 1;
      continue;
    }

    groups.set(result.assetId, {
      assetId: result.assetId,
      assetTitle: getSearchMomentAssetTitle(result),
      momentCount: 1,
      results: [result],
    });
  }

  return Array.from(groups.values());
}

export function getSearchMomentAssetTitle(
  result: Pick<SearchResult, 'assetTitle'>,
): string {
  const normalizedTitle = result.assetTitle?.trim();
  return normalizedTitle || UNTITLED_SEARCH_ASSET_LABEL;
}
