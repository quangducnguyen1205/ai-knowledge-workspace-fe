import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import type { FrontendAuthConfig } from '../lib/auth-config';
import { AuthProvider } from '../features/auth/auth-provider';

const legacyConfig: FrontendAuthConfig = {
  mode: 'legacy_session',
  keycloak: null,
  issue: null,
};

const workspaces = [
  { id: 'workspace-1', name: 'Default workspace', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'workspace-2', name: 'Authorized asset workspace', createdAt: '2026-01-02T00:00:00Z' },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assetRecord(assetId: string, workspaceId: string) {
  return {
    id: assetId,
    title: assetId === 'asset-2' ? 'Asset in the authorized workspace' : 'Asset in the default workspace',
    status: 'SEARCHABLE' as const,
    workspaceId,
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  };
}

function assetSummary(assetId: string, workspaceId: string) {
  const asset = assetRecord(assetId, workspaceId);
  return {
    assetId: asset.id,
    title: asset.title,
    assetStatus: asset.status,
    workspaceId,
    createdAt: asset.createdAt,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

function createFetchMock({
  assetResponse = assetRecord('asset-2', 'workspace-2'),
  deferAssetResponse = false,
  visibleWorkspaces = workspaces,
}: {
  assetResponse?: unknown;
  deferAssetResponse?: boolean;
  visibleWorkspaces?: typeof workspaces;
} = {}) {
  let resolveAssetResponse: ((response: Response) => void) | null = null;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/me') return Promise.resolve(jsonResponse({ id: 'user-1', email: 'learner@example.com' }));
    if (url === '/api/workspaces') return Promise.resolve(jsonResponse(visibleWorkspaces));
    if (url === '/api/assets/asset-2') {
      return deferAssetResponse
        ? new Promise<Response>((resolve) => { resolveAssetResponse = resolve; })
        : Promise.resolve(jsonResponse(assetResponse));
    }
    if (url === '/api/assets/asset-1') return Promise.resolve(jsonResponse(assetRecord('asset-1', 'workspace-1')));
    if (url === '/api/assets?workspaceId=workspace-1') return Promise.resolve(jsonResponse([assetSummary('asset-1', 'workspace-1')]));
    if (url === '/api/assets?workspaceId=workspace-2') return Promise.resolve(jsonResponse([assetSummary('asset-2', 'workspace-2')]));
    if (url.endsWith('/status')) {
      const assetId = url.includes('asset-2') ? 'asset-2' : 'asset-1';
      return Promise.resolve(jsonResponse({
        assetId,
        processingJobId: `job-${assetId}`,
        assetStatus: 'SEARCHABLE',
        processingJobStatus: 'SUCCEEDED',
      }));
    }
    if (url.endsWith('/transcript')) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse([]));
  });

  return {
    fetchMock,
    resolveAssetResponse: () => resolveAssetResponse?.(jsonResponse(assetResponse)),
  };
}

function renderApp(hash: string, fetchMock: ReturnType<typeof vi.fn>) {
  window.history.replaceState({}, '', hash);
  vi.stubGlobal('fetch', fetchMock);

  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider config={legacyConfig}>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('asset route workspace hydration', () => {
  it('hydrates the authorized owning workspace instead of trusting the persisted workspace hint', async () => {
    window.localStorage.setItem('akw:last-workspace-id', 'workspace-1');
    const { fetchMock } = createFetchMock();
    renderApp('#/assets/asset-2', fetchMock);

    expect(await screen.findByText('Asset in the authorized workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
    expect(window.location.hash).toBe('#/assets/asset-2');
    expect(fetchMock).toHaveBeenCalledWith('/api/assets/asset-2', expect.any(Object));
  });

  it('does not redirect while the authorized asset response is still loading', async () => {
    window.localStorage.setItem('akw:last-workspace-id', 'workspace-1');
    const transport = createFetchMock({ deferAssetResponse: true });
    renderApp('#/assets/asset-2', transport.fetchMock);

    expect(await screen.findByText('Resolving the authorized asset workspace...')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/assets/asset-2');

    transport.resolveAssetResponse();

    expect(await screen.findByText('Asset in the authorized workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
  });

  it('keeps a route in its already-selected authorized workspace', async () => {
    window.localStorage.setItem('akw:last-workspace-id', 'workspace-2');
    const { fetchMock } = createFetchMock();
    renderApp('#/assets/asset-2', fetchMock);

    expect(await screen.findByText('Asset in the authorized workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
    expect(window.location.hash).toBe('#/assets/asset-2');
  });

  it('falls back safely when the authorized asset is missing or hidden', async () => {
    const { fetchMock } = createFetchMock({
      assetResponse: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' },
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return Promise.resolve(jsonResponse({ id: 'user-1', email: 'learner@example.com' }));
      if (url === '/api/workspaces') return Promise.resolve(jsonResponse(workspaces));
      if (url === '/api/assets/asset-2') return Promise.resolve(jsonResponse({ code: 'ASSET_NOT_FOUND', message: 'Asset not found' }, 404));
      if (url === '/api/assets?workspaceId=workspace-1') return Promise.resolve(jsonResponse([]));
      if (url === '/api/assets?workspaceId=workspace-2') return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });
    renderApp('#/assets/asset-2', fetchMock);

    await waitFor(() => expect(window.location.hash).toBe('#/library'));
    expect(screen.queryByText('Asset in the authorized workspace')).not.toBeInTheDocument();
  });

  it('falls back safely when the asset workspace is not in the authorized workspace list', async () => {
    const { fetchMock } = createFetchMock({ visibleWorkspaces: [workspaces[0]] });
    renderApp('#/assets/asset-2', fetchMock);

    await waitFor(() => expect(window.location.hash).toBe('#/library'));
    expect(screen.queryByText('Asset in the authorized workspace')).not.toBeInTheDocument();
  });

  it('keeps Back and Forward-style asset route changes aligned with each authorized workspace', async () => {
    window.localStorage.setItem('akw:last-workspace-id', 'workspace-2');
    const { fetchMock } = createFetchMock();
    renderApp('#/assets/asset-2', fetchMock);

    expect(await screen.findByText('Asset in the authorized workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');

    window.history.pushState({}, '', '#/assets/asset-1');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByText('Asset in the default workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-1');

    window.history.pushState({}, '', '#/assets/asset-2');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByText('Asset in the authorized workspace')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace')).toHaveValue('workspace-2');
  });
});
