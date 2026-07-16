import { resolveAuthMode, type AuthMode } from '../../lib/auth-config';
import { ApiClientError } from './api-error';

type ApiErrorPayload = {
  code?: string;
};

export type ApiAuthContext = {
  mode: AuthMode;
  getAccessToken?: () => string | null;
  onUnauthorized?: (error: ApiClientError) => void;
  onAuthModeUnavailable?: (error: ApiClientError) => void;
};

let apiAuthContext: ApiAuthContext = {
  mode: resolveAuthMode(),
};

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');

export const backendDisplayUrl =
  (import.meta.env.VITE_API_DISPLAY_URL ?? '').trim() ||
  normalizedApiBaseUrl ||
  'http://localhost:8081';

export const usingProxy = normalizedApiBaseUrl.length === 0;

function buildUrl(path: string): string {
  return normalizedApiBaseUrl ? `${normalizedApiBaseUrl}${path}` : path;
}

export function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

function getSafeTransportErrorMessage(status: number): string {
  return status === 0
    ? 'Không thể kết nối đến dịch vụ.'
    : 'Yêu cầu không thể hoàn tất.';
}

function getErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const maybePayload = payload as ApiErrorPayload;
  return typeof maybePayload.code === 'string' && maybePayload.code.trim()
    ? maybePayload.code
    : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildRequestInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (apiAuthContext.mode === 'keycloak_jwt') {
    const accessToken = apiAuthContext.getAccessToken?.();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return {
      ...init,
      credentials: 'omit',
      headers,
    };
  }

  return {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers,
  };
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path), buildRequestInit(init));
  } catch {
    throw new ApiClientError(0, getSafeTransportErrorMessage(0));
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const error = new ApiClientError(
      response.status,
      getSafeTransportErrorMessage(response.status),
      getErrorCode(payload),
    );

    if (apiAuthContext.mode === 'keycloak_jwt' && error.status === 401) {
      apiAuthContext.onUnauthorized?.(error);
    }

    if (apiAuthContext.mode === 'keycloak_jwt' && error.status === 409 && error.code === 'AUTH_MODE_UNAVAILABLE') {
      apiAuthContext.onAuthModeUnavailable?.(error);
    }

    throw error;
  }

  return payload as T;
}

export function configureApiAuth(context: ApiAuthContext): void {
  apiAuthContext = context;
}

export function resetApiAuthForTests(): void {
  apiAuthContext = {
    mode: resolveAuthMode(),
  };
}
