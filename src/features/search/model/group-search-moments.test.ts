import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../api/search-api';
import {
  groupSearchMomentsByAsset,
  UNTITLED_SEARCH_ASSET_LABEL,
} from './group-search-moments';

function result(
  assetId: string,
  transcriptRowId: string,
  overrides: Partial<SearchResult> = {},
): SearchResult {
  return {
    assetId,
    assetTitle: `Video ${assetId}`,
    transcriptRowId,
    segmentIndex: 0,
    startMs: 0,
    endMs: 1_000,
    text: transcriptRowId,
    createdAt: null,
    score: 1,
    ...overrides,
  };
}

describe('groupSearchMomentsByAsset', () => {
  it('creates one counted group per Asset and keeps first backend appearance as group order', () => {
    const assetAFirst = result('asset-a', 'row-a-1');
    const assetBFirst = result('asset-b', 'row-b-1');
    const assetASecond = result('asset-a', 'row-a-2');

    const groups = groupSearchMomentsByAsset([
      assetAFirst,
      assetBFirst,
      assetASecond,
    ]);

    expect(groups.map(({ assetId, momentCount }) => ({ assetId, momentCount }))).toEqual([
      { assetId: 'asset-a', momentCount: 2 },
      { assetId: 'asset-b', momentCount: 1 },
    ]);
    expect(groups[0]?.results).toEqual([assetAFirst, assetASecond]);
    expect(groups[1]?.results).toEqual([assetBFirst]);
  });

  it('preserves relative moment order instead of reranking by score or timestamp', () => {
    const backendFirst = result('asset-a', 'row-later', {
      startMs: 90_000,
      endMs: 91_000,
      score: 0.1,
    });
    const backendSecond = result('asset-a', 'row-earlier', {
      startMs: 1_000,
      endMs: 2_000,
      score: 99,
    });

    const [group] = groupSearchMomentsByAsset([backendFirst, backendSecond]);

    expect(group?.results).toEqual([backendFirst, backendSecond]);
  });

  it('uses a bounded fallback for blank or missing-like Asset titles', () => {
    const blankTitle = result('asset-a', 'row-a', { assetTitle: '   ' });
    const missingTitle = {
      ...result('asset-b', 'row-b'),
      assetTitle: undefined,
    } as unknown as SearchResult;

    const groups = groupSearchMomentsByAsset([blankTitle, missingTitle]);

    expect(groups.map((group) => group.assetTitle)).toEqual([
      UNTITLED_SEARCH_ASSET_LABEL,
      UNTITLED_SEARCH_ASSET_LABEL,
    ]);
  });

  it('does not mutate the backend result array or its result objects', () => {
    const backendFirst = result('asset-a', 'row-a-1');
    const backendSecond = result('asset-a', 'row-a-2');
    const input = Object.freeze([backendFirst, backendSecond]);
    const before = input.map((item) => ({ ...item }));

    const [group] = groupSearchMomentsByAsset(input);

    expect(input).toEqual(before);
    expect(backendFirst).toEqual(before[0]);
    expect(backendSecond).toEqual(before[1]);
    expect(group?.results).not.toBe(input);
  });
});
