/**
 * Search query-key owner. Cache writers outside the search feature (asset deletion cleanup,
 * Workspace switches) reference these names instead of rebuilding `['search', …]` arrays by hand.
 */
export const searchKeys = {
  all: ['search'] as const,
  allResults: ['search', 'results'] as const,
  resultsScope: (workspaceId: string) => ['search', 'results', workspaceId] as const,
  results: (workspaceId: string, query: string, assetId?: string | null) =>
    ['search', 'results', workspaceId, assetId ?? 'all-assets', query] as const,
  contextScope: (assetId: string) => ['search', 'context', assetId] as const,
  context: (assetId: string, transcriptRowId: string, window: number) =>
    ['search', 'context', assetId, transcriptRowId, window] as const,
};
