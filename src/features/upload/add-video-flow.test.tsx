import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../app/AppRouter';
import { AuthProvider } from '../auth/auth-provider';
import type { FrontendAuthConfig } from '../../lib/auth-config';

const legacyConfig: FrontendAuthConfig = {
  mode: 'legacy_session',
  keycloak: null,
  issue: null,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('Add video application flow', () => {
  it('uses the upload success invalidation and navigation lifecycle after YouTube creation', async () => {
    const user = userEvent.setup();
    let assetCreated = false;
    const sourceUrl = 'https://www.youtube.com/watch?v=abc_DEF-123';
    const assetSummary = {
      assetId: 'asset-youtube',
      title: 'Causal ordering',
      assetStatus: 'PROCESSING',
      workspaceId: 'workspace-1',
      sourceType: 'YOUTUBE',
      youtubeVideoId: 'abc_DEF-123',
      sourceUrl,
      createdAt: '2026-07-27T00:00:00Z',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') return jsonResponse({ id: 'user-1', email: 'learner@example.com' });
      if (url === '/api/workspaces') {
        return jsonResponse([{ id: 'workspace-1', name: 'Distributed Systems', createdAt: '2026-07-27T00:00:00Z' }]);
      }
      if (url === '/api/assets?workspaceId=workspace-1') {
        return jsonResponse(assetCreated ? [assetSummary] : []);
      }
      if (url === '/api/assets/youtube') {
        assetCreated = true;
        return jsonResponse({
          assetId: assetSummary.assetId,
          processingJobId: 'job-youtube',
          assetStatus: 'PROCESSING',
          workspaceId: assetSummary.workspaceId,
          sourceType: 'YOUTUBE',
          youtubeVideoId: assetSummary.youtubeVideoId,
          sourceUrl,
        }, 202);
      }
      if (url === '/api/assets/asset-youtube') {
        return jsonResponse({
          id: assetSummary.assetId,
          originalFilename: null,
          title: assetSummary.title,
          status: assetSummary.assetStatus,
          workspaceId: assetSummary.workspaceId,
          sourceType: assetSummary.sourceType,
          youtubeVideoId: assetSummary.youtubeVideoId,
          sourceUrl,
          contentType: null,
          sizeBytes: null,
          createdAt: assetSummary.createdAt,
          updatedAt: assetSummary.createdAt,
        });
      }
      if (url === '/api/assets/asset-youtube/status') {
        return jsonResponse({
          assetId: assetSummary.assetId,
          processingJobId: 'job-youtube',
          assetStatus: 'PROCESSING',
          processingJobStatus: 'PENDING',
          failureCode: null,
        });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(
      <QueryClientProvider client={createQueryClient()}>
        <AuthProvider config={legacyConfig}>
          <AppRouter />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'Add video to current workspace' }));
    await user.click(screen.getByRole('radio', { name: 'YouTube URL' }));
    await user.type(screen.getByRole('textbox', { name: 'YouTube URL' }), 'https://youtu.be/abc_DEF-123');
    await user.type(screen.getByRole('textbox', { name: 'Video title (optional)' }), 'Causal ordering');
    await user.click(screen.getByRole('button', { name: 'Add YouTube video' }));

    await waitFor(() => expect(window.location.hash).toBe('#/assets/asset-youtube'));
    expect(await screen.findByRole('heading', { name: 'Causal ordering', level: 1 })).toBeInTheDocument();
    expect(container.querySelector('.source-badge')).toHaveTextContent('YouTube');
    expect(screen.getAllByText('Processing video').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assets/youtube',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
