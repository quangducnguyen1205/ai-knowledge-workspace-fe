import { describe, expect, it } from 'vitest';
import { readFrontendAuthConfig, resolveAuthMode } from './auth-config';

describe('frontend auth configuration', () => {
  it('defaults to legacy_session when no auth mode is configured', () => {
    expect(resolveAuthMode({})).toBe('legacy_session');
    expect(readFrontendAuthConfig({})).toMatchObject({
      mode: 'legacy_session',
      keycloak: null,
      issue: null,
    });
  });

  it('requires public Keycloak client settings in keycloak_jwt mode', () => {
    const config = readFrontendAuthConfig({
      VITE_AUTHENTICATION_MODE: 'keycloak_jwt',
      VITE_KEYCLOAK_URL: 'http://localhost:8180',
    });

    expect(config.mode).toBe('keycloak_jwt');
    expect(config.keycloak).toBeNull();
    expect(config.issue).toMatchObject({
      code: 'MISSING_KEYCLOAK_CONFIG',
      missingKeys: ['VITE_KEYCLOAK_REALM', 'VITE_KEYCLOAK_CLIENT_ID'],
    });
  });

  it('builds the Keycloak issuer authority from local public-client settings', () => {
    const config = readFrontendAuthConfig({
      VITE_AUTHENTICATION_MODE: 'keycloak_jwt',
      VITE_KEYCLOAK_URL: 'http://localhost:8180/',
      VITE_KEYCLOAK_REALM: 'workspace-dev',
      VITE_KEYCLOAK_CLIENT_ID: 'workspace-web',
    });

    expect(config).toMatchObject({
      mode: 'keycloak_jwt',
      keycloak: {
        url: 'http://localhost:8180',
        realm: 'workspace-dev',
        clientId: 'workspace-web',
        authority: 'http://localhost:8180/realms/workspace-dev',
      },
      issue: null,
    });
  });
});
