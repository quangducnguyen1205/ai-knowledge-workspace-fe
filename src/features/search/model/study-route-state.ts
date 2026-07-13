import type { AppRoute } from '../../../app/router';
import type { TranscriptContextParams } from '../hooks/use-search-controller';

export type StudyRouteState = {
  focusedTranscriptRowId: string | null;
  source: 'search' | 'assistant' | null;
  sourceSearchQuery: string | null;
  contextParams: TranscriptContextParams | null;
};

export function getStudyRouteState(
  route: AppRoute,
  selectedWorkspaceId: string | null,
  fallbackSearchQuery: string | null,
): StudyRouteState {
  const focusedTranscriptRowId = route.name === 'asset' ? route.transcriptRowId ?? null : null;
  const source = route.name === 'asset' ? route.source ?? null : null;
  const sourceSearchQuery =
    route.name === 'asset' && route.source === 'search' ? route.searchQuery ?? fallbackSearchQuery : null;

  return {
    focusedTranscriptRowId,
    source,
    sourceSearchQuery,
    contextParams:
      route.name === 'asset' && focusedTranscriptRowId && selectedWorkspaceId
        ? {
            assetId: route.assetId,
            transcriptRowId: focusedTranscriptRowId,
            window: 2,
          }
        : null,
  };
}

export function getSearchReturnRoute(route: AppRoute): AppRoute {
  if (route.name !== 'asset') {
    return { name: 'search' };
  }

  const searchQueryFromRoute = route.searchQuery?.trim();
  return searchQueryFromRoute ? { name: 'search', searchQuery: searchQueryFromRoute } : { name: 'search' };
}

export function getClearedStudyRoute(route: AppRoute): AppRoute | null {
  return route.name === 'asset' ? { name: 'asset', assetId: route.assetId } : null;
}
