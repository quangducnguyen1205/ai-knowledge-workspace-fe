import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { configureApiAuth } from '../../shared/api/http-client';
import {
  readFrontendAuthConfig,
  type AuthConfigurationIssue,
  type AuthMode,
  type FrontendAuthConfig,
  type KeycloakPublicClientConfig,
} from '../../lib/auth-config';
import {
  clearOidcCallbackUrl,
  createKeycloakOidcClient,
  isOidcCallbackUrl,
  type OidcAuthenticatedSession,
  type OidcAuthClient,
} from '../../lib/oidc-client';

type KeycloakAuthPhase =
  | 'configuration_error'
  | 'unauthenticated'
  | 'completing_callback'
  | 'authenticated'
  | 'auth_mode_unavailable'
  | 'error';

type AuthContextValue = {
  mode: AuthMode;
  configIssue: AuthConfigurationIssue | null;
  keycloakPhase: KeycloakAuthPhase | null;
  hasBearerToken: boolean;
  accessTokenVersion: number;
  isResolvingAuth: boolean;
  isStartingLogin: boolean;
  authErrorMessage: string | null;
  startKeycloakLogin: () => Promise<void>;
  clearLocalAuth: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
  config?: FrontendAuthConfig;
  oidcClientFactory?: (config: KeycloakPublicClientConfig) => OidcAuthClient;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialKeycloakPhase(config: FrontendAuthConfig): KeycloakAuthPhase | null {
  if (config.issue) {
    return 'configuration_error';
  }

  if (config.mode === 'legacy_session') {
    return null;
  }

  return isOidcCallbackUrl() ? 'completing_callback' : 'unauthenticated';
}

function getErrorMessage(_error: unknown): string {
  return 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.';
}

export function AuthProvider({
  children,
  config: providedConfig,
  oidcClientFactory = createKeycloakOidcClient,
}: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [config] = useState<FrontendAuthConfig>(() => providedConfig ?? readFrontendAuthConfig());
  const oidcClient = useMemo(
    () => (config.mode === 'keycloak_jwt' && config.keycloak ? oidcClientFactory(config.keycloak) : null),
    [config, oidcClientFactory],
  );
  const accessTokenRef = useRef<string | null>(null);
  const callbackPromiseRef = useRef<Promise<OidcAuthenticatedSession> | null>(null);
  const [accessTokenVersion, setAccessTokenVersion] = useState(0);
  const [keycloakPhase, setKeycloakPhase] = useState<KeycloakAuthPhase | null>(() => getInitialKeycloakPhase(config));
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const clearBearerToken = useCallback(() => {
    accessTokenRef.current = null;
    setAccessTokenVersion((current) => current + 1);
  }, []);

  const handleJwtUnauthorized = useCallback(() => {
    if (config.mode !== 'keycloak_jwt') {
      return;
    }

    clearBearerToken();
    setAuthErrorMessage(null);
    setKeycloakPhase('unauthenticated');
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
  }, [clearBearerToken, config.mode, queryClient]);

  const handleAuthModeUnavailable = useCallback(() => {
    if (config.mode !== 'keycloak_jwt') {
      return;
    }

    clearBearerToken();
    setAuthErrorMessage('Phương thức đăng nhập hiện tại chưa được hệ thống chấp nhận.');
    setKeycloakPhase('auth_mode_unavailable');
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
  }, [clearBearerToken, config.mode, queryClient]);

  useEffect(() => {
    configureApiAuth({
      mode: config.mode,
      getAccessToken: () => accessTokenRef.current,
      onUnauthorized: handleJwtUnauthorized,
      onAuthModeUnavailable: handleAuthModeUnavailable,
    });
  }, [config.mode, handleAuthModeUnavailable, handleJwtUnauthorized]);

  useEffect(() => {
    if (config.mode !== 'keycloak_jwt' || !oidcClient || !isOidcCallbackUrl()) {
      return;
    }

    const activeOidcClient = oidcClient;
    let isCancelled = false;

    async function completeCallback() {
      setKeycloakPhase('completing_callback');
      setAuthErrorMessage(null);

      try {
        if (!callbackPromiseRef.current) {
          callbackPromiseRef.current = activeOidcClient.completeSignInRedirect();
        }

        const callbackPromise = callbackPromiseRef.current;
        const session = await callbackPromise;
        if (isCancelled) {
          return;
        }

        accessTokenRef.current = session.accessToken;
        setAccessTokenVersion((current) => current + 1);
        setKeycloakPhase('authenticated');
        clearOidcCallbackUrl();
        callbackPromiseRef.current = null;
      } catch (error) {
        if (isCancelled) {
          return;
        }

        clearBearerToken();
        setAuthErrorMessage(getErrorMessage(error));
        setKeycloakPhase('error');
        callbackPromiseRef.current = null;
      }
    }

    void completeCallback();

    return () => {
      isCancelled = true;
    };
  }, [clearBearerToken, config.mode, oidcClient]);

  const startKeycloakLogin = useCallback(async () => {
    if (config.mode !== 'keycloak_jwt' || !oidcClient) {
      return;
    }

    setIsStartingLogin(true);
    setAuthErrorMessage(null);

    try {
      await oidcClient.startLogin();
    } catch (error) {
      setAuthErrorMessage(getErrorMessage(error));
      setKeycloakPhase('error');
    } finally {
      setIsStartingLogin(false);
    }
  }, [config.mode, oidcClient]);

  const clearLocalAuth = useCallback(async () => {
    clearBearerToken();
    setAuthErrorMessage(null);
    setKeycloakPhase(config.mode === 'keycloak_jwt' ? 'unauthenticated' : null);
    queryClient.removeQueries({ queryKey: ['auth'] });

    if (oidcClient) {
      await oidcClient.clearLocalSession();
    }
  }, [clearBearerToken, config.mode, oidcClient, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: config.mode,
      configIssue: config.issue,
      keycloakPhase,
      hasBearerToken: Boolean(accessTokenRef.current),
      accessTokenVersion,
      isResolvingAuth: keycloakPhase === 'completing_callback',
      isStartingLogin,
      authErrorMessage,
      startKeycloakLogin,
      clearLocalAuth,
    }),
    [
      accessTokenVersion,
      authErrorMessage,
      clearLocalAuth,
      config.issue,
      config.mode,
      isStartingLogin,
      keycloakPhase,
      startKeycloakLogin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
