import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantAnswerCitation } from '../../features/assistant/model/types';
import { useAssistantCitationNavigation } from './use-assistant-citation-navigation';

const baseCitation: AssistantAnswerCitation = {
  sourceId: 'source-1',
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  createdAt: '2026-06-26T10:02:00Z',
};

describe('useAssistantCitationNavigation', () => {
  it('clears asset search selection and navigates to the cited source context', () => {
    const clearAssetSearchSelection = vi.fn();
    const selectAsset = vi.fn();
    const navigate = vi.fn();
    const { result } = renderHook(() => useAssistantCitationNavigation({
      clearAssetSearchSelection,
      selectAsset,
      navigate,
    }));

    act(() => result.current(baseCitation));

    expect(clearAssetSearchSelection).toHaveBeenCalledTimes(1);
    expect(selectAsset).toHaveBeenCalledWith('asset-1');
    expect(navigate).toHaveBeenCalledWith({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'row-2',
      source: 'assistant',
    });
  });

  it('uses the segment compatibility reference and ignores invalid citations safely', () => {
    const navigate = vi.fn();
    const clearAssetSearchSelection = vi.fn();
    const selectAsset = vi.fn();
    const { result } = renderHook(() => useAssistantCitationNavigation({
      clearAssetSearchSelection,
      selectAsset,
      navigate,
    }));

    act(() => result.current({ ...baseCitation, transcriptRowId: null, segmentIndex: 4 }));
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ transcriptRowId: 'segment-4' }));

    navigate.mockClear();
    clearAssetSearchSelection.mockClear();
    selectAsset.mockClear();
    act(() => result.current({ ...baseCitation, transcriptRowId: null, segmentIndex: null }));
    expect(navigate).not.toHaveBeenCalled();
    expect(clearAssetSearchSelection).not.toHaveBeenCalled();
    expect(selectAsset).not.toHaveBeenCalled();
  });
});
