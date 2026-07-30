import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../app/AppRouter';
import type { FrontendAuthConfig } from '../../lib/auth-config';
import { AuthProvider } from '../auth/auth-provider';

const legacyConfig: FrontendAuthConfig = { mode: 'legacy_session', keycloak: null, issue: null };
const routeTimeout = { timeout: 5_000 };

const asset = {
  assetId: 'asset-1',
  title: 'Vector Clocks Lecture',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-2',
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
    startMs: 61_000,
    endMs: 64_000,
    text: 'Vector clocks preserve causal relationships between events.',
    createdAt: '2026-06-26T10:02:00Z',
  },
];

const savedMoment = {
  savedMomentId: 'saved-1',
  workspaceId: 'workspace-2',
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  sourceType: 'UPLOAD',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  startMs: 61_000,
  endMs: 64_000,
  text: transcriptRows[1].text,
  savedAt: '2026-07-30T08:00:00Z',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

type FetchState = { saved: Record<string, unknown>[]; playbackProgressWrites: number };

function createFetchMock(state: FetchState, overrides?: (url: string, init?: RequestInit) => Response | undefined) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const override = overrides?.(url, init);
    if (override) return override;

    if (url === '/api/me') return jsonResponse({ id: 'user-1', email: 'learner@example.com' });

    if (url === '/api/workspaces') {
      return jsonResponse([
        { id: 'workspace-1', name: 'Operations', createdAt: '2026-06-26T00:00:00Z' },
        { id: 'workspace-2', name: 'Distributed Systems', createdAt: '2026-06-26T00:00:00Z' },
      ]);
    }

    if (url.startsWith('/api/assets?')) {
      return jsonResponse(url.includes('workspace-2') ? [asset] : []);
    }

    if (url === '/api/assets/asset-1') {
      return jsonResponse({
        id: asset.assetId,
        title: asset.title,
        status: asset.assetStatus,
        workspaceId: asset.workspaceId,
        sourceType: asset.sourceType,
        youtubeVideoId: null,
        sourceUrl: null,
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

    if (url === '/api/assets/asset-1/transcript') return jsonResponse(transcriptRows);

    if (url.startsWith('/api/assets/asset-1/transcript/context')) {
      return jsonResponse({
        assetId: 'asset-1',
        transcriptRowId: 'row-2',
        hitSegmentIndex: 2,
        window: 2,
        rows: transcriptRows,
      });
    }

    if (url.startsWith('/api/assets/asset-1/playback-progress')) {
      if (init?.method === 'PUT') {
        state.playbackProgressWrites += 1;
      }
      return jsonResponse({
        assetId: 'asset-1', positionMs: 0, completed: false, updatedAt: null,
      });
    }

    if (url === '/api/saved-moments' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { assetId: string; transcriptRowId: string };
      const existing = state.saved.find(
        (item) => item.assetId === body.assetId && item.transcriptRowId === body.transcriptRowId,
      );
      if (existing) return jsonResponse(existing);
      const created = { ...savedMoment, ...body };
      state.saved = [created, ...state.saved];
      return jsonResponse(created);
    }

    if (url.startsWith('/api/saved-moments?')) {
      const workspaceId = new URL(url, 'http://localhost').searchParams.get('workspaceId') ?? '';
      const items = state.saved.filter((item) => item.workspaceId === workspaceId);
      return jsonResponse({
        workspaceIdFilter: workspaceId,
        savedMomentCount: items.length,
        maxItems: 100,
        items,
      });
    }

    if (url.startsWith('/api/saved-moments/') && init?.method === 'DELETE') {
      const savedMomentId = url.slice('/api/saved-moments/'.length);
      state.saved = state.saved.filter((item) => item.savedMomentId !== savedMomentId);
      return jsonResponse(null, 204);
    }

    if (url.startsWith('/api/search?')) {
      return jsonResponse({
        query: 'vector clocks',
        workspaceIdFilter: 'workspace-2',
        assetIdFilter: null,
        resultCount: 0,
        results: [],
      });
    }

    return jsonResponse([]);
  });
}

function renderAppAt(hash: string, fetchMock: ReturnType<typeof vi.fn>) {
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
});

describe('canonical moment permalink in a fresh session', () => {
  it('resolves the owning Workspace and focuses the exact canonical row without search state', async () => {
    const state: FetchState = { saved: [], playbackProgressWrites: 0 };
    renderAppAt('#/assets/asset-1?row=row-2', createFetchMock(state));

    const focusedRow = await screen.findByLabelText('Selected transcript moment', {}, routeTimeout);
    expect(focusedRow).toHaveTextContent(/vector clocks preserve/i);
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
    expect(window.location.hash).toBe('#/assets/asset-1?row=row-2');
    expect(window.location.hash).not.toContain('from=');
    expect(window.location.hash).not.toContain('q=');
    expect(screen.queryByRole('button', { name: 'Back to search' })).not.toBeInTheDocument();
  });

  it('never autoplays and never writes playback progress just by opening the link', async () => {
    const state: FetchState = { saved: [], playbackProgressWrites: 0 };
    renderAppAt('#/assets/asset-1?row=row-2', createFetchMock(state));

    await screen.findByLabelText('Selected transcript moment', {}, routeTimeout);

    expect(state.playbackProgressWrites).toBe(0);
    for (const media of document.querySelectorAll('video, audio')) {
      expect((media as HTMLMediaElement).autoplay).toBe(false);
      expect((media as HTMLMediaElement).paused).toBe(true);
    }
  });

  it('shows a safe bounded state for an unauthorized or deleted moment link', async () => {
    const state: FetchState = { saved: [], playbackProgressWrites: 0 };
    const fetchMock = createFetchMock(state, (url) =>
      url === '/api/assets/asset-1'
        ? jsonResponse({ code: 'ASSET_NOT_FOUND', message: 'Asset not found' }, 404)
        : undefined);
    renderAppAt('#/assets/asset-1?row=row-2', fetchMock);

    await waitFor(() => expect(window.location.hash).not.toContain('assets/asset-1'), routeTimeout);
    expect(screen.queryByLabelText('Selected transcript moment')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('saved_moments');
  });
});

describe('saving and reopening a canonical moment', () => {
  it('saves the focused moment, lists it in Explore and reopens the canonical link', async () => {
    const user = userEvent.setup();
    const state: FetchState = { saved: [], playbackProgressWrites: 0 };
    renderAppAt('#/assets/asset-1?row=row-2', createFetchMock(state));

    const saveButton = await screen.findByRole(
      'button',
      { name: 'Save moment in Vector Clocks Lecture at 01:01' },
      routeTimeout,
    );
    await user.click(saveButton);

    await waitFor(() => expect(state.saved).toHaveLength(1));
    expect(await screen.findByRole('button', {
      name: 'Moment in Vector Clocks Lecture at 01:01 is saved',
    }, routeTimeout)).toBeDisabled();

    window.location.hash = '#/search';
    const savedRegion = await screen.findByRole('region', { name: 'Saved moments in Distributed Systems' }, routeTimeout);
    expect(within(savedRegion).getByText(transcriptRows[1].text)).toBeInTheDocument();

    await user.click(within(savedRegion).getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 01:01',
    }));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1?row=row-2'));
    expect(await screen.findByLabelText('Selected transcript moment', {}, routeTimeout))
      .toHaveTextContent(/vector clocks preserve/i);
  });

  it('keeps a repeated save idempotent and removes the moment from the list', async () => {
    const user = userEvent.setup();
    const state: FetchState = { saved: [{ ...savedMoment }], playbackProgressWrites: 0 };
    renderAppAt('#/search', createFetchMock(state));

    await user.selectOptions(await screen.findByLabelText('Workspace', {}, routeTimeout), 'workspace-2');
    const savedRegion = await screen.findByRole('region', { name: 'Saved moments in Distributed Systems' }, routeTimeout);
    expect(within(savedRegion).getAllByRole('listitem')).toHaveLength(1);

    await user.click(within(savedRegion).getByRole('button', {
      name: 'Remove saved moment in Vector Clocks Lecture at 01:01',
    }));

    await waitFor(() => expect(state.saved).toHaveLength(0));
    expect(await within(savedRegion).findByText('No saved moments yet')).toBeInTheDocument();
  });

  it('copies a permalink without the current page query string', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => undefined);
    const state: FetchState = { saved: [{ ...savedMoment }], playbackProgressWrites: 0 };
    renderAppAt('/?code=secret&state=temporary#/search', createFetchMock(state));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await user.selectOptions(await screen.findByLabelText('Workspace', {}, routeTimeout), 'workspace-2');
    const savedRegion = await screen.findByRole('region', { name: 'Saved moments in Distributed Systems' }, routeTimeout);
    expect(window.location.search).toBe('?code=secret&state=temporary');

    await user.click(within(savedRegion).getByRole('button', {
      name: 'Copy link to moment in Vector Clocks Lecture at 01:01',
    }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(copied).toBe(`${window.location.origin}${window.location.pathname}#/assets/asset-1?row=row-2`);
    for (const excluded of ['code=', 'state=', 'secret', 'temporary', 'from=', 'q=', 'workspaceId=']) {
      expect(copied).not.toContain(excluded);
    }
  });

  it('scopes a save failure to the moment it happened on', async () => {
    const user = userEvent.setup();
    const state: FetchState = { saved: [], playbackProgressWrites: 0 };
    let failRowOne = true;
    const fetchMock = createFetchMock(state, (url, init) => {
      if (url === '/api/saved-moments' && init?.method === 'POST' && failRowOne) {
        const body = JSON.parse(String(init.body)) as { transcriptRowId: string };
        if (body.transcriptRowId === 'row-1') {
          return jsonResponse({ code: 'SAVED_MOMENT_TARGET_NOT_FOUND' }, 404);
        }
      }
      return undefined;
    });
    renderAppAt('#/assets/asset-1?row=row-1', fetchMock);

    await user.click(await screen.findByRole(
      'button',
      { name: 'Save moment in Vector Clocks Lecture at 00:00' },
      routeTimeout,
    ));
    expect(await screen.findByText('Could not save this moment. Try again.', {}, routeTimeout))
      .toBeInTheDocument();

    // Focusing another canonical moment must not inherit the failure.
    window.location.hash = '#/assets/asset-1?row=row-2';
    await screen.findByRole(
      'button',
      { name: 'Save moment in Vector Clocks Lecture at 01:01' },
      routeTimeout,
    );
    expect(screen.queryByText('Could not save this moment. Try again.')).not.toBeInTheDocument();

    // Returning to the failed moment still shows its bounded retry feedback.
    window.location.hash = '#/assets/asset-1?row=row-1';
    expect(await screen.findByText('Could not save this moment. Try again.', {}, routeTimeout))
      .toBeInTheDocument();

    failRowOne = false;
    await user.click(screen.getByRole('button', {
      name: 'Save moment in Vector Clocks Lecture at 00:00',
    }));

    await waitFor(() => expect(state.saved).toHaveLength(1), routeTimeout);
    await waitFor(() =>
      expect(screen.queryByText('Could not save this moment. Try again.')).not.toBeInTheDocument());
    expect(await screen.findByRole('button', {
      name: 'Moment in Vector Clocks Lecture at 00:00 is saved',
    }, routeTimeout)).toBeDisabled();
  });

  it('never shows saved moments from the previously selected Workspace', async () => {
    const user = userEvent.setup();
    const state: FetchState = { saved: [{ ...savedMoment }], playbackProgressWrites: 0 };
    renderAppAt('#/search', createFetchMock(state));

    await user.selectOptions(await screen.findByLabelText('Workspace', {}, routeTimeout), 'workspace-2');
    const savedRegion = await screen.findByRole('region', { name: 'Saved moments in Distributed Systems' }, routeTimeout);
    expect(within(savedRegion).getByText(transcriptRows[1].text)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Workspace'), 'workspace-1');

    const operationsRegion = await screen.findByRole('region', { name: 'Saved moments in Operations' }, routeTimeout);
    expect(within(operationsRegion).queryByText(transcriptRows[1].text)).not.toBeInTheDocument();
    expect(within(operationsRegion).getByText('No saved moments yet')).toBeInTheDocument();
  });
});
