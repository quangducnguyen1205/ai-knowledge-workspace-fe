import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetApiAuthForTests } from '../../../shared/api/http-client';
import { searchTranscript } from './search-api';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type MomentPayload = Record<string, unknown>;

function searchPayload(results: MomentPayload[]) {
  return {
    query: 'vector clocks',
    workspaceIdFilter: 'workspace-1',
    assetIdFilter: null,
    resultCount: results.length,
    results,
  };
}

const timedMoment: MomentPayload = {
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  startMs: 1_000,
  endMs: 2_000,
  text: 'Vector clocks preserve causal relationships.',
  createdAt: '2026-06-26T10:02:00Z',
  score: 3.21,
};

function stubSearch(results: MomentPayload[]) {
  const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
    jsonResponse(searchPayload(results)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('search moment context snippet mapping', () => {
  it('keeps the canonical snippet alongside the exact matching row text', async () => {
    stubSearch([{
      ...timedMoment,
      contextSnippet: 'Before the hit. Vector clocks preserve causal relationships. After the hit.',
    }]);

    const response = await searchTranscript('vector clocks', 'workspace-1');

    expect(response.results[0]).toMatchObject({
      transcriptRowId: 'row-2',
      segmentIndex: 2,
      startMs: 1_000,
      endMs: 2_000,
      text: 'Vector clocks preserve causal relationships.',
      contextSnippet: 'Before the hit. Vector clocks preserve causal relationships. After the hit.',
    });
  });

  it('normalizes an absent, null or whitespace-only snippet to null without touching text', async () => {
    stubSearch([
      timedMoment,
      { ...timedMoment, contextSnippet: null },
      { ...timedMoment, contextSnippet: '   \n\t  ' },
    ]);

    const response = await searchTranscript('vector clocks', 'workspace-1');

    expect('contextSnippet' in timedMoment).toBe(false);
    expect(response.results.map((result) => result.contextSnippet)).toEqual([null, null, null]);
    expect(response.results.map((result) => result.text)).toEqual([
      'Vector clocks preserve causal relationships.',
      'Vector clocks preserve causal relationships.',
      'Vector clocks preserve causal relationships.',
    ]);
  });

  it('preserves a Unicode snippet exactly apart from surrounding whitespace', async () => {
    stubSearch([{
      ...timedMoment,
      contextSnippet: '  Đồng hồ vector giữ quan hệ nhân quả giữa các sự kiện.  ',
    }]);

    const response = await searchTranscript('vector clocks', 'workspace-1');

    expect(response.results[0].contextSnippet)
      .toBe('Đồng hồ vector giữ quan hệ nhân quả giữa các sự kiện.');
  });

  it('requests the unchanged Spring search path and query parameters', async () => {
    const fetchMock = stubSearch([{ ...timedMoment, contextSnippet: 'Canonical context.' }]);

    await searchTranscript('vector clocks', 'workspace-1', 'asset-1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search?q=vector+clocks&workspaceId=workspace-1&assetId=asset-1',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/contextSnippet|window|snippet/i);
  });
});
