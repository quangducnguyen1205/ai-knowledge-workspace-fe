import { useCallback } from 'react';
import type { AssistantAnswerCitation } from '../../features/assistant/model/types';
import { resolveAssistantCitationReference } from '../../features/assistant/model/citation-reference';
import type { AppRoute } from '../router';

export function useAssistantCitationNavigation({
  clearAssetSearchSelection,
  selectAsset,
  navigate,
}: {
  clearAssetSearchSelection: () => void;
  selectAsset: (assetId: string) => void;
  navigate: (route: AppRoute) => void;
}) {
  return useCallback((citation: AssistantAnswerCitation) => {
    const transcriptRowId = resolveAssistantCitationReference(citation);
    if (!transcriptRowId) return;

    clearAssetSearchSelection();
    selectAsset(citation.assetId);
    navigate({
      name: 'asset',
      assetId: citation.assetId,
      transcriptRowId,
      source: 'assistant',
    });
  }, [clearAssetSearchSelection, navigate, selectAsset]);
}
