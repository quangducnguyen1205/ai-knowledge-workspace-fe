import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  configureApiAuth,
  getCurrentUser,
  listWorkspaces,
  loginUser,
  resetApiAuthForTests,
} from './api';

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
