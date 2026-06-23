import { UserManager, WebStorageStateStore, type StateStore } from 'oidc-client-ts';
import type { KeycloakPublicClientConfig } from './auth-config';

export type OidcAuthenticatedSession = {
  accessToken: string;
};

export type OidcAuthClient = {
  startLogin: () => Promise<void>;
  completeSignInRedirect: () => Promise<OidcAuthenticatedSession>;
  clearLocalSession: () => Promise<void>;
};

export class MemoryStateStore implements StateStore {
  private readonly values = new Map<string, string>();

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async remove(key: string): Promise<string | null> {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.values.keys());
  }
}

export function isOidcCallbackUrl(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search);
  return params.has('state') && (params.has('code') || params.has('error'));
}

export function clearOidcCallbackUrl(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(window.history.state, document.title, cleanUrl);
}

function getBrowserBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function createKeycloakOidcClient(config: KeycloakPublicClientConfig): OidcAuthClient {
  const redirectUri = getBrowserBaseUrl();
  const userManager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: false,
    monitorSession: false,
    loadUserInfo: false,
    userStore: new MemoryStateStore(),
    stateStore: new WebStorageStateStore({
      prefix: 'akw:oidc:',
      store: window.sessionStorage,
    }),
  });

  return {
    startLogin: () => userManager.signinRedirect(),
    completeSignInRedirect: async () => {
      const user = await userManager.signinRedirectCallback();
      return {
        accessToken: user.access_token,
      };
    },
    clearLocalSession: () => userManager.removeUser(),
  };
}
