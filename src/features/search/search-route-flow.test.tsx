import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
  createdAt: '2026-06-26T10:00:00Z',
};

const transcriptRows = [
  {
    id: 'row-1',
    videoId: 'asset-1',
    segmentIndex: 1,
    text: 'First we define happens-before relationships.',
    createdAt: '2026-06-26T10:01:00Z',
  },
  {
    id: 'row-2',
    videoId: 'asset-1',
    segmentIndex: 2,
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
        { name: 'Open moment 1 in Vector Clocks Lecture' },
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
    expect(await screen.findByLabelText(/search workspace/i)).toHaveValue('');
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('hydrates Search from route q and submits through the existing search path once', async () => {
    const fetchMock = renderAppAt('#/search?q=vector%20clocks');

    expect(await screen.findByDisplayValue('vector clocks')).toBeInTheDocument();
    expect(
      await screen.findByRole(
        'button',
        { name: 'Open moment 1 in Vector Clocks Lecture' },
        routeFlowTimeout,
      ),
    ).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('does not auto-submit Search when the route has no q', async () => {
    const fetchMock = renderAppAt('#/search');

    expect(await screen.findByLabelText(/search workspace/i)).toHaveValue('');
    expect(screen.getByText(/search your learning workspace/i)).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('opens a workspace result excerpt and focuses the exact transcript row', async () => {
    const user = userEvent.setup();
    const scrollIntoView = mockTranscriptScrolling();
    renderAppAt('#/search?q=vector%20clocks');

    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment 1 in Vector Clocks Lecture' },
      routeFlowTimeout,
    ));

    await waitFor(() => expect(window.location.hash)
      .toBe('#/assets/asset-1?row=row-2&from=search&q=vector+clocks'));
    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks preserve/i);
    expect(scrollIntoView).toHaveBeenCalled();

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

  it('uses the same stable row target for Find in transcript', async () => {
    const user = userEvent.setup();
    mockTranscriptScrolling();
    renderAppAt('#/assets/asset-1');

    const input = await screen.findByLabelText('Find in transcript', {}, routeFlowTimeout);
    await user.type(input, 'happens-before');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole(
      'button',
      { name: 'Open moment 1 in Vector Clocks Lecture' },
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

function mockTranscriptScrolling() {
  const scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  return scrollIntoView;
}
