import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../../app/AppRouter';
import type { FrontendAuthConfig } from '../../../lib/auth-config';
import { AuthProvider } from '../../auth/auth-provider';

/**
 * Route scope: the cinematic landing exists only for the signed-out home route. Authenticated
 * sessions keep the existing application surfaces and never mount the landing.
 */

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

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider config={legacyConfig} oidcClientFactory={() => {
        throw new Error('legacy mode never builds an OIDC client');
      }}>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '#/';
});

describe('public landing route scope', () => {
  it('serves the moment-engine landing to a signed-out visitor on the home route', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401)));
    renderApp();

    expect(await screen.findByRole('heading', { level: 1, name: 'Find the exact moment in every video.' }))
      .toBeInTheDocument();
    expect(document.querySelector('.me-landing')).not.toBeNull();
    // The retired landing copy is gone with its component.
    expect(screen.queryByText(/Turn long videos into knowledge you can find and trust/)).not.toBeInTheDocument();
  });

  it('keeps authenticated home on the existing application, with no landing mounted', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith('/api/me')) {
        return jsonResponse({ id: 'user-1', email: 'user@example.com' });
      }

      if (url.startsWith('/api/workspaces')) {
        return jsonResponse([]);
      }

      return jsonResponse({ code: 'NOT_FOUND' }, 404);
    }));
    renderApp();

    expect(await screen.findByRole('heading', { name: 'No workspace yet' })).toBeInTheDocument();
    expect(document.querySelector('.me-landing')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Enter workspace' })).not.toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeNull();
  });
});
