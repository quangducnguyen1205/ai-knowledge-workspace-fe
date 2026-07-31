/**
 * Public entrypoint of the search feature. Other features may embed the search panel, reference
 * result types, and invalidate search caches through the named key owner — nothing else. The
 * internal controller, route hydration and grouping logic stay private.
 */
export { SearchPanel, type SearchAssetSource } from './search';
export { searchKeys } from './model/search-keys';
export type { SearchResponse, SearchResult } from './api/search-api';
