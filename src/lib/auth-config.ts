export const authModes = ['legacy_session', 'keycloak_jwt'] as const;

export type AuthMode = (typeof authModes)[number];

export type AuthConfigurationIssue = {
  code: 'INVALID_AUTH_MODE' | 'MISSING_KEYCLOAK_CONFIG';
  message: string;
  missingKeys?: string[];
};

export type KeycloakPublicClientConfig = {
  url: string;
  realm: string;
  clientId: string;
  authority: string;
};

export type FrontendAuthConfig =
  | {
      mode: 'legacy_session';
      keycloak: null;
      issue: AuthConfigurationIssue | null;
    }
  | {
      mode: 'keycloak_jwt';
      keycloak: KeycloakPublicClientConfig | null;
      issue: AuthConfigurationIssue | null;
    };

type EnvLike = Record<string, string | undefined>;

function normalizeEnvValue(value: string | undefined): string {
  return value?.trim() ?? '';
}

function normalizePublicUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function isAuthMode(value: string): value is AuthMode {
  return authModes.includes(value as AuthMode);
}

export function resolveAuthMode(env: EnvLike = import.meta.env): AuthMode {
  const rawMode = normalizeEnvValue(env.VITE_AUTHENTICATION_MODE);
  return rawMode ? (isAuthMode(rawMode) ? rawMode : 'legacy_session') : 'legacy_session';
}

export function readFrontendAuthConfig(env: EnvLike = import.meta.env): FrontendAuthConfig {
  const rawMode = normalizeEnvValue(env.VITE_AUTHENTICATION_MODE);
  const requestedMode = rawMode || 'legacy_session';

  if (!isAuthMode(requestedMode)) {
    return {
      mode: 'legacy_session',
      keycloak: null,
      issue: {
        code: 'INVALID_AUTH_MODE',
        message: `VITE_AUTHENTICATION_MODE must be one of: ${authModes.join(', ')}.`,
      },
    };
  }

  if (requestedMode === 'legacy_session') {
    return {
      mode: 'legacy_session',
      keycloak: null,
      issue: null,
    };
  }

  const keycloakUrl = normalizePublicUrl(normalizeEnvValue(env.VITE_KEYCLOAK_URL));
  const realm = normalizeEnvValue(env.VITE_KEYCLOAK_REALM);
  const clientId = normalizeEnvValue(env.VITE_KEYCLOAK_CLIENT_ID);
  const missingKeys = [
    ['VITE_KEYCLOAK_URL', keycloakUrl],
    ['VITE_KEYCLOAK_REALM', realm],
    ['VITE_KEYCLOAK_CLIENT_ID', clientId],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    return {
      mode: 'keycloak_jwt',
      keycloak: null,
      issue: {
        code: 'MISSING_KEYCLOAK_CONFIG',
        message: `Keycloak JWT mode requires public client configuration: ${missingKeys.join(', ')}.`,
        missingKeys,
      },
    };
  }

  return {
    mode: 'keycloak_jwt',
    keycloak: {
      url: keycloakUrl,
      realm,
      clientId,
      authority: `${keycloakUrl}/realms/${realm}`,
    },
    issue: null,
  };
}
