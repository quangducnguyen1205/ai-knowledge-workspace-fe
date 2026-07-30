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
    startMs: 61_000,
    endMs: 64_000,
    text: 'Vector clocks preserve causal relationships between events.',
    createdAt: '2026-06-26T10:02:00Z',
  },
];

const continueWatchingItem = {
  assetId: 'asset-1',
  workspaceId: 'workspace-1',
  assetTitle: 'Vector Clocks Lecture',
  sourceType: 'UPLOAD',
  positionMs: 61_000,
  completed: false,
  updatedAt: '2026-07-30T08:00:00Z',
};

type FetchState = {
  continueWatching: Record<string, unknown[]>;
  progress: { positionMs: number; completed: boolean; updatedAt: string | null };
  progressWrites: number;
  continueWatchingCalls: string[];
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

function createFetchMock(state: FetchState) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === '/api/me') return jsonResponse({ id: 'user-1', email: 'viewer@example.com' });

    if (url === '/api/workspaces') {
      return jsonResponse([
        { id: 'workspace-1', name: 'Distributed Systems', createdAt: '2026-06-26T00:00:00Z' },
        { id: 'workspace-2', name: 'Operations', createdAt: '2026-06-26T00:00:00Z' },
      ]);
    }

    if (url.startsWith('/api/assets?')) {
      return jsonResponse(url.includes('workspace-1') ? [asset] : []);
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
        state.progressWrites += 1;
        const body = JSON.parse(String(init.body)) as { positionMs: number; completed: boolean };
        state.progress = { ...body, updatedAt: '2026-07-30T09:00:00Z' };
      }
      return jsonResponse({ assetId: 'asset-1', ...state.progress });
    }

    if (url.startsWith('/api/playback-progress')) {
      const workspaceId = new URL(url, 'http://localhost').searchParams.get('workspaceId') ?? '';
      state.continueWatchingCalls.push(workspaceId);
      const items = state.continueWatching[workspaceId] ?? [];
      return jsonResponse({
        workspaceIdFilter: workspaceId,
        itemCount: items.length,
        maxItems: 12,
        items,
      });
    }

    if (url.startsWith('/api/saved-moments?')) {
      const workspaceId = new URL(url, 'http://localhost').searchParams.get('workspaceId') ?? '';
      return jsonResponse({
        workspaceIdFilter: workspaceId, savedMomentCount: 0, maxItems: 100, items: [],
      });
    }

    if (url.startsWith('/api/search?')) {
      return jsonResponse({
        query: 'vector clocks',
        workspaceIdFilter: 'workspace-1',
        assetIdFilter: null,
        resultCount: 1,
        results: [{
          assetId: 'asset-1',
          assetTitle: 'Vector Clocks Lecture',
          transcriptRowId: 'row-2',
          segmentIndex: 2,
          startMs: 61_000,
          endMs: 64_000,
          text: transcriptRows[1].text,
          contextSnippet: transcriptRows[1].text,
          createdAt: transcriptRows[1].createdAt,
          score: 3.21,
        }],
      });
    }

    return jsonResponse([]);
  });
}

function baseState(): FetchState {
  return {
    continueWatching: { 'workspace-1': [continueWatchingItem], 'workspace-2': [] },
    progress: { positionMs: 61_000, completed: false, updatedAt: '2026-07-30T08:00:00Z' },
    progressWrites: 0,
    continueWatchingCalls: [],
  };
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

describe('continue watching in Explore', () => {
  it('lists the Workspace items and opens the plain viewer route without a playback position', async () => {
    const user = userEvent.setup();
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    const section = await screen.findByRole(
      'region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    expect(within(section).getByRole('heading', { name: 'Continue watching' })).toBeInTheDocument();
    expect(await within(section).findByText('Vector Clocks Lecture', {}, routeTimeout)).toBeInTheDocument();
    expect(within(section).getByText('01:01')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', {
      name: 'Continue watching Vector Clocks Lecture at 01:01',
    }));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1'));
    expect(window.location.hash).not.toContain('position');
    expect(window.location.hash).not.toContain('positionMs');
    expect(window.location.hash).not.toContain('row=');
    expect(window.location.hash).not.toContain('from=');
    expect(window.location.hash).not.toContain('q=');
  });

  it('never autoplays and never writes progress merely by opening the item', async () => {
    const user = userEvent.setup();
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    const section = await screen.findByRole(
      'region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    await user.click(await within(section).findByRole(
      'button', { name: /^Continue watching Vector Clocks/ }, routeTimeout));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1'));
    await screen.findByRole('heading', { name: 'Vector Clocks Lecture' }, routeTimeout);

    expect(state.progressWrites).toBe(0);
    expect(state.progress).toEqual({
      positionMs: 61_000, completed: false, updatedAt: '2026-07-30T08:00:00Z',
    });
    for (const media of document.querySelectorAll('video, audio')) {
      expect((media as HTMLMediaElement).autoplay).toBe(false);
      expect((media as HTMLMediaElement).paused).toBe(true);
    }
  });

  it('keeps the existing resume offer as the owner of restoring the position', async () => {
    const user = userEvent.setup();
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    const section = await screen.findByRole(
      'region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    await user.click(await within(section).findByRole(
      'button', { name: /^Continue watching Vector Clocks/ }, routeTimeout));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-1'));
    await screen.findByRole('heading', { name: 'Vector Clocks Lecture' }, routeTimeout);

    // The viewer, not the Continue watching list, decides how the saved position is restored.
    expect(state.progressWrites).toBe(0);
    expect(window.location.hash).toBe('#/assets/asset-1');
  });

  it('shows the empty state without leaking another Workspace when switching', async () => {
    const user = userEvent.setup();
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    const section = await screen.findByRole(
      'region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    expect(await within(section).findByText('Vector Clocks Lecture', {}, routeTimeout))
      .toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Workspace'), 'workspace-2');

    const operations = await screen.findByRole(
      'region', { name: 'Continue watching in Operations' }, routeTimeout);
    expect(within(operations).queryByText('Vector Clocks Lecture')).not.toBeInTheDocument();
    expect(within(operations).getByText('Nothing in progress yet')).toBeInTheDocument();
    expect(state.continueWatchingCalls).toContain('workspace-2');
  });

  it('leaves search and Saved moments untouched on the same surface', async () => {
    const user = userEvent.setup();
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    await screen.findByRole('region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    expect(await screen.findByRole(
      'region', { name: 'Saved moments in Distributed Systems' }, routeTimeout)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search within Distributed Systems'), 'vector clocks');
    await user.keyboard('{Enter}');

    expect(await screen.findByRole(
      'button', { name: 'Open moment in Vector Clocks Lecture at 01:01' }, routeTimeout,
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Continue watching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saved moments' })).toBeInTheDocument();
  });

  it('uses neutral product vocabulary on the Explore surface', async () => {
    const state = baseState();
    renderAppAt('#/search', createFetchMock(state));

    await screen.findByRole('region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);
    const copy = (document.body.textContent ?? '').toLowerCase();

    for (const banned of ['continue learning', 'learning progress', 'study session', 'lesson', 'course']) {
      expect(copy).not.toContain(banned);
    }
    expect(copy).toContain('continue watching');
    expect(copy).toContain('explore');
  });

  it('requests nothing until a Workspace is resolved', async () => {
    const state = baseState();
    const fetchMock = createFetchMock(state);
    renderAppAt('#/search', fetchMock);

    await screen.findByRole('region', { name: 'Continue watching in Distributed Systems' }, routeTimeout);

    expect(state.continueWatchingCalls.every((workspaceId) => workspaceId.length > 0)).toBe(true);
  });
});
