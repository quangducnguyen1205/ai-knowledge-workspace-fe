import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../api/search-api';
import { SUPPORTED_LANGUAGES } from '../../../shared/i18n';
import { resources } from '../../../shared/i18n/resources';
import {
  MISSING_SEARCH_MOMENT_PREVIEW_KEY,
  resolveSearchMomentPreview,
} from './search-moment-preview';

function moment(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    assetId: 'asset-1',
    assetTitle: 'Vector Clocks Lecture',
    transcriptRowId: 'row-2',
    segmentIndex: 2,
    startMs: 1_000,
    endMs: 2_000,
    text: 'Vector clocks preserve causal relationships.',
    contextSnippet: null,
    createdAt: null,
    score: 1,
    ...overrides,
  };
}

describe('resolveSearchMomentPreview', () => {
  it('prefers a nonblank canonical snippet over the matching row text', () => {
    const preview = resolveSearchMomentPreview(moment({
      contextSnippet: 'Earlier row. Vector clocks preserve causal relationships. Later row.',
    }));

    expect(preview).toBe('Earlier row. Vector clocks preserve causal relationships. Later row.');
    expect(preview).not.toContain('Vector clocks preserve causal relationships.Vector');
  });

  it('falls back to the matching row text when the snippet is null, absent or whitespace', () => {
    const withoutSnippet = moment();
    Reflect.deleteProperty(withoutSnippet, 'contextSnippet');

    expect(resolveSearchMomentPreview(moment({ contextSnippet: null })))
      .toBe('Vector clocks preserve causal relationships.');
    expect(resolveSearchMomentPreview(withoutSnippet))
      .toBe('Vector clocks preserve causal relationships.');
    expect(resolveSearchMomentPreview(moment({ contextSnippet: '   \n\t ' })))
      .toBe('Vector clocks preserve causal relationships.');
  });

  it('defers to the caller\'s bounded label only when neither value carries readable text', () => {
    expect(resolveSearchMomentPreview(moment({ contextSnippet: '  ', text: '   ' }))).toBeNull();
    expect(resolveSearchMomentPreview({ contextSnippet: null } as unknown as SearchResult)).toBeNull();
    expect(MISSING_SEARCH_MOMENT_PREVIEW_KEY).toBe('missingPreview');
  });

  it('never concatenates the snippet with the matching row text', () => {
    const preview = resolveSearchMomentPreview(moment({
      contextSnippet: 'Canonical context.',
      text: 'Exact matching row.',
    }));

    expect(preview).toBe('Canonical context.');
    expect(preview).not.toContain('Exact matching row.');
  });

  it('preserves Unicode content and trims only surrounding whitespace', () => {
    expect(resolveSearchMomentPreview(moment({
      contextSnippet: '  Đồng hồ vector giữ quan hệ nhân quả giữa các sự kiện.  ',
    }))).toBe('Đồng hồ vector giữ quan hệ nhân quả giữa các sự kiện.');
  });

  it('returns markup-bearing snippets as plain text without interpreting it', () => {
    const preview = resolveSearchMomentPreview(moment({
      contextSnippet: 'Compare <em>vector</em> clocks & <script>alert(1)</script> ordering.',
    }));

    expect(preview).toBe('Compare <em>vector</em> clocks & <script>alert(1)</script> ordering.');
  });

  it('uses neutral video-knowledge copy in the bounded fallback, in every language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const label = resources[language].search[MISSING_SEARCH_MOMENT_PREVIEW_KEY];
      expect(label, language).toBeTruthy();
      expect(label, language).not.toMatch(/lesson|course|learner|score|study summary/i);
    }
  });
});
