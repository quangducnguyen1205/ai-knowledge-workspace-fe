import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../app/AppShell';
import type { FrontendAuthConfig } from '../../lib/auth-config';
import type { OidcAuthClient } from '../../lib/oidc-client';
import { AuthProvider } from './auth-provider';

const legacyConfig: FrontendAuthConfig = {
  mode: 'legacy_session',
  keycloak: null,
  issue: null,
};

const keycloakConfig: FrontendAuthConfig = {
  mode: 'keycloak_jwt',
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'workspace-dev',
    clientId: 'workspace-web',
    authority: 'http://localhost:8180/realms/workspace-dev',
  },
  issue: null,
};

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
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createOidcClientMock(overrides: Partial<OidcAuthClient> = {}): OidcAuthClient {
  return {
    startLogin: vi.fn(async () => undefined),
    completeSignInRedirect: vi.fn(async () => ({ accessToken: `bearer-${crypto.randomUUID()}` })),
    clearLocalSession: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderApp(config: FrontendAuthConfig, oidcClient = createOidcClientMock()) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthProvider config={config} oidcClientFactory={() => oidcClient}>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return oidcClient;
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>, url: string): Headers {
  const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>;
  const call = calls.find(([input]) => String(input) === url);
  if (!call) {
    throw new Error(`No fetch call found for ${url}`);
  }

  return call[1].headers as Headers;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

describe('auth mode UI boundary', () => {
  it('preserves the legacy password login/session flow', async () => {
    const passwordInput = 'x'.repeat(12);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return jsonResponse({ code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required' }, 401);
      }
      if (url === '/api/auth/login') {
        return jsonResponse({ id: 'user-1', email: 'learner@example.com' });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp(legacyConfig);

    expect(await screen.findByRole('heading', { name: /sign in to your workspace/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), passwordInput);
    const signInSubmitButton = screen
      .getAllByRole('button', { name: /^sign in$/i })
      .find((button) => button.getAttribute('type') === 'submit');
    expect(signInSubmitButton).toBeDefined();
    await userEvent.click(signInSubmitButton!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }));
    });
  });

  it('shows only the Keycloak action in JWT mode and does not use legacy password login', async () => {
    const fetchMock = vi.fn(async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ code: 'AUTHENTICATION_REQUIRED' }, 401),
    );
    const oidcClient = createOidcClientMock();
    vi.stubGlobal('fetch', fetchMock);

    renderApp(keycloakConfig, oidcClient);

    expect(await screen.findByRole('button', { name: /continue with keycloak/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /continue with keycloak/i }));

    expect(oidcClient.startLogin).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/auth/login')).toBe(false);
  });

  it('flags missing public Keycloak configuration without starting login', async () => {
    const missingConfig: FrontendAuthConfig = {
      mode: 'keycloak_jwt',
      keycloak: null,
      issue: {
        code: 'MISSING_KEYCLOAK_CONFIG',
        message: 'Keycloak JWT mode requires public client configuration: VITE_KEYCLOAK_REALM.',
        missingKeys: ['VITE_KEYCLOAK_REALM'],
      },
    };
    const oidcClient = createOidcClientMock();

    renderApp(missingConfig, oidcClient);

    expect(await screen.findByText(/keycloak configuration incomplete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with keycloak/i })).toBeDisabled();
    expect(oidcClient.startLogin).not.toHaveBeenCalled();
  });

  it('uses bearer auth for /api/me and renders the Spring product user after callback', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const callbackCode = crypto.randomUUID();
    const callbackState = crypto.randomUUID();
    window.history.pushState({}, '', `/?code=${encodeURIComponent(callbackCode)}&state=${encodeURIComponent(callbackState)}`);
    const storageSetItem = vi.spyOn(Storage.prototype, 'setItem');
    const indexedDbOpen = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return jsonResponse({ id: 'spring-user-id', email: 'spring-product@example.com' });
      }
      if (url === '/api/workspaces') {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    });
    const oidcClient = createOidcClientMock({
      completeSignInRedirect: vi.fn(async () => ({
        accessToken: bearerValue,
        profile: {
          email: 'keycloak-profile@example.com',
          realm_access: { roles: ['workspace-admin'] },
        },
      } as never)),
    });
    vi.stubGlobal('indexedDB', { open: indexedDbOpen });
    vi.stubGlobal('fetch', fetchMock);

    renderApp(keycloakConfig, oidcClient);

    expect(await screen.findAllByText('spring-product@example.com')).not.toHaveLength(0);
    expect(requestHeaders(fetchMock, '/api/me').get('Authorization')).toBe(`Bearer ${bearerValue}`);
    expect(screen.queryByText(/workspace-admin/i)).not.toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(storageSetItem).not.toHaveBeenCalledWith(expect.any(String), expect.stringContaining(bearerValue));
    expect(indexedDbOpen).not.toHaveBeenCalled();
  });

  it('does not create a redirect loop when the backend reports AUTH_MODE_UNAVAILABLE', async () => {
    const bearerValue = `bearer-${crypto.randomUUID()}`;
    const callbackCode = crypto.randomUUID();
    const callbackState = crypto.randomUUID();
    window.history.pushState({}, '', `/?code=${encodeURIComponent(callbackCode)}&state=${encodeURIComponent(callbackState)}`);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/me') {
        return jsonResponse({ code: 'AUTH_MODE_UNAVAILABLE', message: 'Legacy session authentication is unavailable' }, 409);
      }
      return jsonResponse([]);
    });
    const oidcClient = createOidcClientMock({
      completeSignInRedirect: vi.fn(async () => ({ accessToken: bearerValue })),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp(keycloakConfig, oidcClient);

    expect(await screen.findByText(/backend auth mode mismatch/i)).toBeInTheDocument();
    expect(oidcClient.startLogin).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/me')).toHaveLength(1);
  });
});
