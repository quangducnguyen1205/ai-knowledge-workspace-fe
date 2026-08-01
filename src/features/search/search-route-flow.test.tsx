import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../app/AppRouter';
import type { FrontendAuthConfig } from '../../lib/auth-config';
import { AuthProvider } from '../auth/auth-provider';

const legacyConfig: FrontendAuthConfig = {
  mode: 'legacy_session',
  keycloak: null,
  issue: null,
};

const asset = {
  assetId: 'asset-1',
  title: 'Vector Clocks Lecture',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  sourceType: 'UPLOAD',
  youtubeVideoId: null,
  sourceUrl: null,
  createdAt: '2026-06-26T10:00:00Z',
};

const transcriptRows = [
  {
    id: 'row-1',
    videoId: 'asset-1',
    segmentIndex: 1,
    startMs: 0,
    endMs: 999,
    text: 'First we define happens-before relationships.',
    createdAt: '2026-06-26T10:01:00Z',
  },
  {
    id: 'row-2',
    videoId: 'asset-1',
    segmentIndex: 2,
    startMs: 1_000,
    endMs: 2_000,
    text: 'Vector clocks preserve causal relationships between events in distributed systems.',
    createdAt: '2026-06-26T10:02:00Z',
  },
];

const routeFlowTimeout = { timeout: 5_000 };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/me') {
      return jsonResponse({ id: 'user-1', email: 'learner@example.com' });
    }

    if (url === '/api/workspaces') {
      return jsonResponse([
        {
          id: 'workspace-1',
          name: 'Distributed Systems',
          createdAt: '2026-06-26T00:00:00Z',
        },
      ]);
    }

    if (url === '/api/assets?workspaceId=workspace-1') {
      return jsonResponse([asset]);
    }

    if (url === '/api/assets/asset-1') {
      return jsonResponse({
        id: asset.assetId,
        title: asset.title,
        status: asset.assetStatus,
        workspaceId: asset.workspaceId,
        sourceType: asset.sourceType,
        youtubeVideoId: asset.youtubeVideoId,
        sourceUrl: asset.sourceUrl,
        originalFilename: 'vector-clocks.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1_024,
        createdAt: asset.createdAt,
        updatedAt: asset.createdAt,
      });
    }

    if (url === '/api/assets/asset-1/status') {
      return jsonResponse({
        assetId: 'asset-1',
        processingJobId: 'job-1',
        assetStatus: 'SEARCHABLE',
        processingJobStatus: 'SUCCEEDED',
      });
    }

    if (url === '/api/assets/asset-1/transcript') {
      return jsonResponse(transcriptRows);
    }

    if (url.startsWith('/api/assets/asset-1/transcript/context')) {
      return jsonResponse({
        assetId: 'asset-1',
        transcriptRowId: 'row-2',
        hitSegmentIndex: 2,
        window: 2,
        rows: transcriptRows,
      });
    }

    if (url.startsWith('/api/search?')) {
      const isTranscriptSearch = url.includes('assetId=asset-1');
      const resultRow = isTranscriptSearch ? transcriptRows[0] : transcriptRows[1];
      return jsonResponse({
        query: 'vector clocks',
        workspaceIdFilter: 'workspace-1',
        assetIdFilter: isTranscriptSearch ? 'asset-1' : null,
        resultCount: 1,
        results: [
          {
            assetId: 'asset-1',
            assetTitle: 'Vector Clocks Lecture',
            transcriptRowId: resultRow.id,
            segmentIndex: resultRow.segmentIndex,
            startMs: resultRow.startMs,
            endMs: resultRow.endMs,
            text: resultRow.text,
            createdAt: resultRow.createdAt,
            score: 3.21,
          },
        ],
      });
    }

    return jsonResponse([]);
  });
}

function renderAppAt(hash: string, fetchMock = createFetchMock()) {
  window.history.replaceState({}, '', hash);
  vi.stubGlobal('fetch', fetchMock);

  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider config={legacyConfig}>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return fetchMock;
}

function searchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) => String(input).startsWith('/api/search?'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

describe('Search route query flow', () => {
  it('returns from Asset Detail to Search with the source query and reuses normal search loading', async () => {
    const user = userEvent.setup();
    const fetchMock = renderAppAt('#/assets/asset-1?row=row-2&from=search&q=vector%20clocks');

    await user.click(await screen.findByRole('button', { name: 'Back to search' }, routeFlowTimeout));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/search?q=vector+clocks');
    });
    expect(await screen.findByDisplayValue('vector clocks')).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'button',
        { name: 'Open moment in Vector Clocks Lecture at 00:01' },
        routeFlowTimeout,
      ),
    ).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('returns from Asset Detail to plain Search when the source query is blank', async () => {
    const user = userEvent.setup();
    const fetchMock = renderAppAt('#/assets/asset-1?row=row-2&from=search&q=%20%20');

    await user.click(await screen.findByRole('button', { name: 'Back to search' }, routeFlowTimeout));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/search');
    });
    expect(await screen.findByLabelText(/search within distributed systems/i)).toHaveValue('');
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('hydrates Search from route q and submits through the existing search path once', async () => {
    const fetchMock = renderAppAt('#/search?q=vector%20clocks');

    expect(await screen.findByDisplayValue('vector clocks')).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'button',
        { name: 'Open moment in Vector Clocks Lecture at 00:01' },
        routeFlowTimeout,
      ),
    ).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('does not auto-submit Search when the route has no q', async () => {
    const fetchMock = renderAppAt('#/search');

    expect(await screen.findByLabelText(/search within distributed systems/i)).toHaveValue('');
    expect(screen.getByText(/search this workspace/i)).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('clears incompatible results on Workspace change and opens only the new Workspace moment', async () => {
    const user = userEvent.setup();
    const baseFetch = createFetchMock();
    const workspaceTwoAsset = {
      ...asset,
      assetId: 'asset-2',
      title: 'Incident Review',
      workspaceId: 'workspace-2',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'incident_123',
      sourceUrl: 'https://www.youtube.com/watch?v=incident_123',
    };
    const workspaceTwoRow = {
      id: 'row-incident',
      videoId: 'asset-2',
      segmentIndex: 4,
      startMs: 3_000,
      endMs: 5_000,
      text: 'The incident timeline starts with the first alert.',
      createdAt: '2026-06-27T10:02:00Z',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/workspaces') {
        return jsonResponse([
          { id: 'workspace-1', name: 'Distributed Systems', createdAt: '2026-06-26T00:00:00Z' },
          { id: 'workspace-2', name: 'Operations', createdAt: '2026-06-27T00:00:00Z' },
        ]);
      }
      if (url === '/api/assets?workspaceId=workspace-2') return jsonResponse([workspaceTwoAsset]);
      if (url === '/api/assets/asset-2') {
        return jsonResponse({
          id: workspaceTwoAsset.assetId,
          title: workspaceTwoAsset.title,
          status: workspaceTwoAsset.assetStatus,
          workspaceId: workspaceTwoAsset.workspaceId,
          sourceType: workspaceTwoAsset.sourceType,
          youtubeVideoId: workspaceTwoAsset.youtubeVideoId,
          sourceUrl: workspaceTwoAsset.sourceUrl,
          originalFilename: null,
          contentType: null,
          sizeBytes: null,
          createdAt: workspaceTwoAsset.createdAt,
          updatedAt: workspaceTwoAsset.createdAt,
        });
      }
      if (url === '/api/assets/asset-2/status') {
        return jsonResponse({
          assetId: 'asset-2',
          processingJobId: 'job-2',
          assetStatus: 'SEARCHABLE',
          processingJobStatus: 'SUCCEEDED',
        });
      }
      if (url === '/api/assets/asset-2/transcript') return jsonResponse([workspaceTwoRow]);
      if (url.startsWith('/api/assets/asset-2/transcript/context')) {
        return jsonResponse({
          assetId: 'asset-2',
          transcriptRowId: 'row-incident',
          hitSegmentIndex: 4,
          window: 2,
          rows: [workspaceTwoRow],
        });
      }
      if (url.startsWith('/api/search?') && url.includes('workspaceId=workspace-2')) {
        return jsonResponse({
          query: 'incident timeline',
          workspaceIdFilter: 'workspace-2',
          assetIdFilter: null,
          resultCount: 1,
          results: [{
            assetId: 'asset-2',
            assetTitle: 'Incident Review',
            transcriptRowId: 'row-incident',
            segmentIndex: 4,
            startMs: 3_000,
            endMs: 5_000,
            text: workspaceTwoRow.text,
            createdAt: workspaceTwoRow.createdAt,
            score: 8.4,
          }],
        });
      }
      return baseFetch(input);
    });
    renderAppAt('#/search?q=vector%20clocks', fetchMock);

    expect(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:01' },
      routeFlowTimeout,
    )).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Workspace'), 'workspace-2');

    await waitFor(() => expect(window.location.hash).toBe('#/search'));
    expect(await screen.findByLabelText('Search within Operations')).toHaveValue('');
    expect(screen.queryByText('Vector Clocks Lecture')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    })).not.toBeInTheDocument();

    const input = screen.getByLabelText('Search within Operations');
    await user.type(input, 'incident timeline');
    await user.keyboard('{Enter}');
    const operationsMoment = await screen.findByRole(
      'button',
      { name: 'Open moment in Incident Review at 00:03' },
      routeFlowTimeout,
    );
    await user.click(operationsMoment);

    await waitFor(() => expect(window.location.hash)
      .toBe('#/assets/asset-2?row=row-incident&from=search&q=incident+timeline'));
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/first alert/i);
    expect(searchCalls(fetchMock).map(([input]) => String(input))).toEqual([
      expect.stringMatching(/q=vector\+clocks.*workspaceId=workspace-1/),
      expect.stringMatching(/q=incident\+timeline.*workspaceId=workspace-2/),
    ]);
  });

  it('opens a workspace result excerpt and focuses the exact transcript row', async () => {
    const user = userEvent.setup();
    const scrolling = mockTranscriptScrolling();
    renderAppAt('#/search?q=vector%20clocks');

    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:01' },
      routeFlowTimeout,
    ));

    await waitFor(() => expect(window.location.hash)
      .toBe('#/assets/asset-1?row=row-2&from=search&q=vector+clocks'));
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks preserve/i);
    scrolling.expectDocumentUnmoved();

    const contextRegions = await screen.findAllByRole('region', { name: 'Selected context' }, routeFlowTimeout);
    expect(contextRegions).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: /search result in context/i })).not.toBeInTheDocument();
    expect(within(contextRegions[0]).getByText(/vector clocks preserve/i).closest('li'))
      .toHaveClass('transcript-list__item--active');

    await user.click(within(contextRegions[0]).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1'));
    expect(screen.queryByRole('region', { name: 'Selected context' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected transcript moment')).not.toBeInTheDocument();
  });

  it('returns to the same scoped results without issuing the Search request again', async () => {
    const user = userEvent.setup();
    mockTranscriptScrolling();
    const fetchMock = renderAppAt('#/search?q=vector%20clocks');
    const momentAction = await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:01' },
      routeFlowTimeout,
    );

    await user.click(momentAction);
    await waitFor(() => expect(window.location.hash)
      .toBe('#/assets/asset-1?row=row-2&from=search&q=vector+clocks'));
    await user.click(await screen.findByRole('button', { name: 'Back to search' }, routeFlowTimeout));

    await waitFor(() => expect(window.location.hash).toBe('#/search?q=vector+clocks'));
    expect(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:01' },
      routeFlowTimeout,
    )).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('uses the same stable row target for Find in transcript', async () => {
    const user = userEvent.setup();
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1');

    const input = await screen.findByLabelText('Find in transcript', {}, routeFlowTimeout);
    await user.type(input, 'happens-before');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:00' },
      routeFlowTimeout,
    ));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1?row=row-1'));
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/happens-before/i);
    expect(await screen.findAllByRole('region', { name: 'Selected context' }, routeFlowTimeout)).toHaveLength(1);
  });

  it('restores direct, Back, and Forward row targets without leaving the asset', async () => {
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1?row=row-2');

    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks/i));

    window.history.pushState({}, '', '#/assets/asset-1?row=row-1');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/happens-before/i));

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1?row=row-2'), routeFlowTimeout);
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks/i));

    window.history.forward();
    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1?row=row-1'), routeFlowTimeout);
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/happens-before/i));
  });
});

/**
 * Observes the Viewer's own media element: what position it was given and whether anything
 * started playing it. The element reports no metadata on its own in this environment, so the
 * test decides when the media becomes ready.
 */
function stubViewerMedia() {
  const video = screen.getByLabelText('Uploaded video: Vector Clocks Lecture');
  if (!(video instanceof HTMLVideoElement)) throw new Error('Expected a native video element');

  let currentTime = 0;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (next: number) => {
      currentTime = next;
    },
  });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => true });
  const play = vi.fn(() => Promise.resolve());
  Object.defineProperty(video, 'play', { configurable: true, value: play });

  return {
    play,
    setCurrentTime: (next: number) => {
      currentTime = next;
    },
    readCurrentTime: () => currentTime,
    becomeReady: () => fireEvent.loadedMetadata(video),
  };
}

describe('Moment playback from every entry path', () => {
  it('positions the paused player at the canonical moment opened from Workspace Search', async () => {
    const user = userEvent.setup();
    mockTranscriptScrolling();
    renderAppAt('#/search?q=vector%20clocks');

    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:01' },
      routeFlowTimeout,
    ));

    await waitFor(() => expect(window.location.hash)
      .toBe('#/assets/asset-1?row=row-2&from=search&q=vector+clocks'));
    const playMoment = await screen.findByRole('button', { name: 'Play from 00:01' }, routeFlowTimeout);

    const media = stubViewerMedia();
    media.setCurrentTime(42);
    media.becomeReady();
    expect(media.readCurrentTime()).toBe(1);
    expect(media.play).not.toHaveBeenCalled();

    await user.click(playMoment);
    expect(media.readCurrentTime()).toBe(1);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('positions the paused player identically for a moment opened from Find in transcript', async () => {
    const user = userEvent.setup();
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1');

    await user.type(
      await screen.findByLabelText('Find in transcript', {}, routeFlowTimeout),
      'happens-before',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment in Vector Clocks Lecture at 00:00' },
      routeFlowTimeout,
    ));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1?row=row-1'));
    const playMoment = await screen.findByRole('button', { name: 'Play from 00:00' }, routeFlowTimeout);

    const media = stubViewerMedia();
    media.setCurrentTime(42);
    media.becomeReady();
    expect(media.readCurrentTime()).toBe(0);
    expect(media.play).not.toHaveBeenCalled();

    await user.click(playMoment);
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it('hydrates a canonical moment link opened cold in a fresh tab the same way', async () => {
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1?row=row-2');

    expect(await screen.findByRole('button', { name: 'Play from 00:01' }, routeFlowTimeout))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks preserve/i);

    const media = stubViewerMedia();
    media.setCurrentTime(42);
    media.becomeReady();
    expect(media.readCurrentTime()).toBe(1);
    expect(media.play).not.toHaveBeenCalled();
  });

  it('leaves a plain Viewer route with no selected moment exactly as it was', async () => {
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1');

    expect(await screen.findByRole('list', { name: 'Video transcript' }, routeFlowTimeout))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play from/i })).not.toBeInTheDocument();

    const media = stubViewerMedia();
    media.setCurrentTime(42);
    media.becomeReady();
    expect(media.readCurrentTime()).toBe(42);
    expect(media.play).not.toHaveBeenCalled();
  });
});

function mockTranscriptScrolling() {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const documentScrollTop = document.documentElement.scrollTop;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

  return {
    expectDocumentUnmoved() {
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(windowScrollTo).not.toHaveBeenCalled();
      expect(document.documentElement.scrollTop).toBe(documentScrollTop);
    },
  };
}
