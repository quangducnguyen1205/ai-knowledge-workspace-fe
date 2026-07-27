import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerAssistant } from '../../features/assistant/api/assistant-api';
import {
  getAsset,
  getAssetTranscript,
  listAssets,
  retryAssetProcessing,
} from '../../features/assets/api/assets-api';
import { getCurrentUser, loginUser } from '../../features/auth/api/auth-api';
import { getTranscriptContext, searchTranscript } from '../../features/search/api/search-api';
import { createYouTubeAsset, uploadAsset } from '../../features/upload/api/upload-api';
import { listWorkspaces } from '../../features/workspaces/api/workspaces-api';
import { configureApiAuth, resetApiAuthForTests } from './http-client';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getRequestInit(fetchMock: ReturnType<typeof vi.fn>, index = 0): RequestInit {
  const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>;
  return calls[index][1];
}

afterEach(() => {
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('API auth boundary', () => {
  it('keeps legacy login on the existing session endpoint with cookie credentials', async () => {
    const passwordInput = 'x'.repeat(12);
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ id: 'user-1', email: 'learner@example.com' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await loginUser({ email: 'learner@example.com', password: passwordInput });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
    }));
  });

  it('sends the in-memory bearer token through the shared API client in JWT mode', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ id: 'user-1', email: 'spring@example.com' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuth({
      mode: 'keycloak_jwt',
      getAccessToken: () => bearerValue,
    });

    await getCurrentUser();

    const init = getRequestInit(fetchMock);
    const headers = init.headers as Headers;
    expect(init.credentials).toBe('omit');
    expect(headers.get('Authorization')).toBe(`Bearer ${bearerValue}`);
  });

  it('does not place bearer tokens in browser persistent storage', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const storageSetItem = vi.spyOn(Storage.prototype, 'setItem');
    const indexedDbOpen = vi.fn();
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) => jsonResponse([]));
    vi.stubGlobal('indexedDB', { open: indexedDbOpen });
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuth({
      mode: 'keycloak_jwt',
      getAccessToken: () => bearerValue,
    });

    await listWorkspaces();

    expect(storageSetItem).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining(bearerValue));
    expect(indexedDbOpen).not.toHaveBeenCalled();
  });

  it('marks JWT auth unauthenticated on 401 without logging the token', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const onUnauthorized = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () =>
      jsonResponse({ code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required' }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuth({
      mode: 'keycloak_jwt',
      getAccessToken: () => bearerValue,
      onUnauthorized,
    });

    await expect(listWorkspaces()).rejects.toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining(bearerValue));
  });

  it('surfaces AUTH_MODE_UNAVAILABLE without retrying legacy identity paths', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const passwordInput = 'x'.repeat(12);
    const onAuthModeUnavailable = vi.fn();
    const fetchMock = vi.fn(async () =>
      jsonResponse({ code: 'AUTH_MODE_UNAVAILABLE', message: 'Legacy session authentication is unavailable' }, 409),
    );
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuth({
      mode: 'keycloak_jwt',
      getAccessToken: () => bearerValue,
      onAuthModeUnavailable,
    });

    await expect(loginUser({ email: 'learner@example.com', password: passwordInput })).rejects.toMatchObject({
      status: 409,
      code: 'AUTH_MODE_UNAVAILABLE',
    });

    expect(onAuthModeUnavailable).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>;
    expect(calls[0][0]).toBe('/api/auth/login');
  });
});

describe('assistant answer API client', () => {
  it('posts only the public asset-scoped answer fields', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        answer: 'The transcript does not contain enough context.',
        citations: [],
        insufficientContext: true,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await answerAssistant({
      workspaceId: 'workspace-1',
      assetId: 'asset-1',
      question: 'What does this lecture say about indexing?',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/assistant/answer', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
    }));

    const init = getRequestInit(fetchMock);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      workspaceId: 'workspace-1',
      assetId: 'asset-1',
      question: 'What does this lecture say about indexing?',
    });
    expect(body).not.toHaveProperty('maxSources');
    expect(body).not.toHaveProperty('contextWindow');
    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('provider');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('timeout');
  });

  it('preserves canonical citation timing and normalizes legacy citations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      answer: 'Grounded answer',
      citations: [
        {
          sourceId: 'source-1', assetId: 'asset-1', assetTitle: 'Lecture',
          transcriptRowId: 'row-0', segmentIndex: 0, startMs: 0, endMs: 1000, createdAt: null,
        },
        {
          sourceId: 'source-2', assetId: 'asset-1', assetTitle: 'Lecture',
          transcriptRowId: 'row-1', segmentIndex: 1, createdAt: null,
        },
      ],
      insufficientContext: false,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await answerAssistant({
      workspaceId: 'workspace-1', assetId: 'asset-1', question: 'What happened?',
    });

    expect(response.citations.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 1000],
      [null, null],
    ]);
  });
});

describe('asset and search API contracts', () => {
  it('normalizes transcript timing while preserving zero, null, and legacy missing fields', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([
      {
        id: 'row-0', videoId: 'asset-1', segmentIndex: 0,
        startMs: 0, endMs: 1250, text: 'Timed row', createdAt: null,
      },
      {
        id: 'row-null', videoId: 'asset-1', segmentIndex: 1,
        startMs: null, endMs: null, text: 'Explicit legacy row', createdAt: null,
      },
      {
        id: 'row-missing', videoId: 'asset-1', segmentIndex: 2,
        text: 'Legacy payload row', createdAt: null,
      },
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await getAssetTranscript('asset-1');

    expect(rows.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 1250],
      [null, null],
      [null, null],
    ]);
  });

  it('preserves timing in search and transcript-context mappings', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        query: 'vector clocks',
        workspaceIdFilter: 'workspace-1',
        assetIdFilter: null,
        resultCount: 2,
        results: [
          {
            assetId: 'asset-1', assetTitle: 'Lecture', transcriptRowId: 'row-0', segmentIndex: 0,
            startMs: 0, endMs: 900, text: 'Timed hit', createdAt: null, score: 1,
          },
          {
            assetId: 'asset-1', assetTitle: 'Lecture', transcriptRowId: 'row-1', segmentIndex: 1,
            text: 'Legacy hit', createdAt: null, score: 0.5,
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        assetId: 'asset-1', transcriptRowId: 'row-0', hitSegmentIndex: 0, window: 2,
        rows: [{
          id: 'row-0', videoId: 'asset-1', segmentIndex: 0,
          startMs: 0, endMs: 900, text: 'Timed context', createdAt: null,
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const search = await searchTranscript('vector clocks', 'workspace-1');
    const context = await getTranscriptContext('asset-1', 'row-0');

    expect(search.results.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
      [0, 900],
      [null, null],
    ]);
    expect(context.rows[0]).toMatchObject({ startMs: 0, endMs: 900 });
  });

  it('keeps stable codes but discards raw backend exception content', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      code: 'SEARCH_SERVICE_UNAVAILABLE',
      message: 'SQLException at jdbc:postgresql://private-host password=secret',
      detail: 'java.package.InternalException',
    }, 503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listWorkspaces()).rejects.toMatchObject({
      status: 503,
      code: 'SEARCH_SERVICE_UNAVAILABLE',
      message: 'The request could not be completed.',
    });
  });

  it('keeps upload multipart fields and optional title normalization unchanged', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      assetId: 'asset-1',
      processingJobId: 'job-1',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'UPLOAD',
      youtubeVideoId: null,
      sourceUrl: null,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['video'], 'lecture.mp4', { type: 'video/mp4' });

    const response = await uploadAsset({ workspaceId: 'workspace-1', file, title: '  Lecture title  ' });

    expect(fetchMock).toHaveBeenCalledWith('/api/assets/upload', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
    }));
    const body = getRequestInit(fetchMock).body as FormData;
    expect(body.get('workspaceId')).toBe('workspace-1');
    expect(body.get('title')).toBe('Lecture title');
    expect(body.get('file')).toBe(file);
    expect(response).toMatchObject({
      sourceType: 'UPLOAD',
      youtubeVideoId: null,
      sourceUrl: null,
    });
  });

  it('creates a YouTube asset with the exact JSON request shape and Spring-derived source response', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      assetId: 'asset-youtube',
      processingJobId: 'job-youtube',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
    }, 202));
    vi.stubGlobal('fetch', fetchMock);

    const response = await createYouTubeAsset({
      workspaceId: 'workspace-1',
      url: '  https://youtu.be/abc_DEF-123  ',
      title: '  Causal ordering  ',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/assets/youtube', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
    }));
    const init = getRequestInit(fetchMock);
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      workspaceId: 'workspace-1',
      url: 'https://youtu.be/abc_DEF-123',
      title: 'Causal ordering',
    });
    expect(response).toMatchObject({
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
    });
  });

  it('retries processing through the exact asset endpoint and POST method', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      assetId: 'asset-youtube',
      processingJobId: 'job-retry',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
    }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await retryAssetProcessing('asset-youtube');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assets/asset-youtube/retry-processing',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('preserves authoritative source fields and nullable upload metadata from list and detail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [{
          assetId: 'asset-youtube',
          title: 'YouTube lecture',
          assetStatus: 'PROCESSING',
          workspaceId: 'workspace-1',
          sourceType: 'YOUTUBE',
          youtubeVideoId: 'abc_DEF-123',
          sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
          createdAt: '2026-07-27T00:00:00Z',
        }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'asset-youtube',
        originalFilename: null,
        title: 'YouTube lecture',
        status: 'PROCESSING',
        workspaceId: 'workspace-1',
        sourceType: 'YOUTUBE',
        youtubeVideoId: 'abc_DEF-123',
        sourceUrl: 'https://www.youtube.com/watch?v=abc_DEF-123',
        contentType: null,
        sizeBytes: null,
        createdAt: '2026-07-27T00:00:00Z',
        updatedAt: '2026-07-27T00:00:00Z',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const [summary] = await listAssets('workspace-1');
    const detail = await getAsset('asset-youtube');

    expect(summary).toMatchObject({ sourceType: 'YOUTUBE', youtubeVideoId: 'abc_DEF-123' });
    expect(detail).toMatchObject({
      sourceType: 'YOUTUBE',
      originalFilename: null,
      contentType: null,
      sizeBytes: null,
    });
  });

  it('keeps workspace, optional asset scope, and encoding in search query parameters', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      query: 'vector clocks',
      workspaceIdFilter: 'workspace one',
      assetIdFilter: 'asset/1',
      resultCount: 0,
      results: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await searchTranscript('vector clocks', 'workspace one', 'asset/1');

    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>;
    expect(calls[0][0]).toBe(
      '/api/search?q=vector+clocks&workspaceId=workspace+one&assetId=asset%2F1',
    );
  });
});
