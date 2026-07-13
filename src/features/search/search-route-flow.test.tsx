import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
      return jsonResponse({
        query: 'vector clocks',
        workspaceIdFilter: 'workspace-1',
        assetIdFilter: null,
        resultCount: 1,
        results: [
          {
            assetId: 'asset-1',
            assetTitle: 'Vector Clocks Lecture',
            transcriptRowId: 'row-2',
            segmentIndex: 2,
            text: 'Vector clocks preserve causal relationships between events in distributed systems.',
            createdAt: '2026-06-26T10:02:00Z',
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
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

describe('Search route query flow', () => {
  it('returns from Asset Detail to Search with the source query and reuses normal search loading', async () => {
    const user = userEvent.setup();
    const fetchMock = renderAppAt('#/assets/asset-1?row=row-2&from=search&q=vector%20clocks');

    await user.click(await screen.findByRole('button', { name: 'Back to search' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/search?q=vector+clocks');
    });
    expect(await screen.findByDisplayValue('vector clocks')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Study result 1 in Vector Clocks Lecture' }),
    ).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('returns from Asset Detail to plain Search when the source query is blank', async () => {
    const user = userEvent.setup();
    const fetchMock = renderAppAt('#/assets/asset-1?row=row-2&from=search&q=%20%20');

    await user.click(await screen.findByRole('button', { name: 'Back to search' }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/search');
    });
    expect(await screen.findByLabelText(/search transcript text/i)).toHaveValue('');
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it('hydrates Search from route q and submits through the existing search path once', async () => {
    const fetchMock = renderAppAt('#/search?q=vector%20clocks');

    expect(await screen.findByDisplayValue('vector clocks')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Study result 1 in Vector Clocks Lecture' }),
    ).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it('does not auto-submit Search when the route has no q', async () => {
    const fetchMock = renderAppAt('#/search');

    expect(await screen.findByLabelText(/search transcript text/i)).toHaveValue('');
    expect(screen.getByText(/search this workspace/i)).toBeInTheDocument();
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });
});
