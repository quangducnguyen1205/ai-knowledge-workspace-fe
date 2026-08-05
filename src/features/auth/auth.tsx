import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClientError } from '../../shared/api/api-error';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  type AuthCredentialsInput,
} from './api/auth-api';
import type { AuthConfigurationIssue } from '../../lib/auth-config';
import { Button, ErrorFeedback } from '../../lib/ui';
import { LanguageSelect, useTranslation } from '../../shared/i18n';
import { useAuth } from './auth-provider';

export { authKeys } from './auth-keys';
import { authKeys } from './auth-keys';

export function useCurrentUserQuery() {
  const auth = useAuth();

  return useQuery({
    queryKey: [...authKeys.currentUser, auth.mode, auth.accessTokenVersion] as const,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 0,
    enabled: auth.mode === 'legacy_session' || auth.hasBearerToken,
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: registerUser,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: loginUser,
  });
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: logoutUser,
  });
}

/**
 * Which copy an authentication failure shows, as `auth` namespace keys rather than sentences.
 *
 * The sign-in branch is deliberately non-enumerating: an unknown email, a wrong password and an
 * input that could never be a valid credential all resolve to one message, so a caller learns
 * only that the pair did not match. Field-format guidance belongs to registration, where it helps
 * rather than leaks.
 */
function authErrorCopy<Key extends
  | 'offlineRegister'
  | 'offlineLogout'
  | 'emailTaken'
  | 'invalidCredentials'
  | 'invalidEmail'
  | 'invalidPassword'
  | 'incompleteForm'
  | 'logoutFailed'
  | 'registerFailed'
  | 'loginFailed'
>(key: Key) {
  return {
    titleKey: `auth:errors.${key}.title`,
    messageKey: `auth:errors.${key}.message`,
  } as const;
}

export type FriendlyAuthErrorCopy = ReturnType<typeof authErrorCopy>;

function getFriendlyAuthErrorCopy(
  error: unknown,
  mode: 'register' | 'login' | 'logout',
): FriendlyAuthErrorCopy | null {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.status === 0) {
    return authErrorCopy(mode === 'logout' ? 'offlineLogout' : 'offlineRegister');
  }

  if (mode === 'register' && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED') {
    return authErrorCopy('emailTaken');
  }

  if (mode === 'login'
      && ((error.status === 401 && error.code === 'INVALID_CREDENTIALS')
        || (error.status === 400
          && (error.code === 'INVALID_EMAIL' || error.code === 'INVALID_PASSWORD')))) {
    return authErrorCopy('invalidCredentials');
  }

  if (error.status === 400 && error.code === 'INVALID_EMAIL') {
    return authErrorCopy('invalidEmail');
  }

  if (error.status === 400 && error.code === 'INVALID_PASSWORD') {
    return authErrorCopy('invalidPassword');
  }

  if (error.status === 400 && error.code === 'INVALID_AUTH_REQUEST') {
    return authErrorCopy('incompleteForm');
  }

  if (mode === 'logout') {
    return authErrorCopy('logoutFailed');
  }

  return authErrorCopy(mode === 'register' ? 'registerFailed' : 'loginFailed');
}

export function AuthEntrySurface({
  mode,
  registerError,
  loginError,
  isRegistering,
  isLoggingIn,
  onRegister,
  onLogin,
  onResetErrors,
  onNavigateMode,
  onBackHome,
}: {
  mode: 'register' | 'login';
  registerError: unknown;
  loginError: unknown;
  isRegistering: boolean;
  isLoggingIn: boolean;
  onRegister: (input: AuthCredentialsInput) => void;
  onLogin: (input: AuthCredentialsInput) => void;
  onResetErrors: () => void;
  onNavigateMode: (mode: 'register' | 'login') => void;
  onBackHome: () => void;
}) {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const activeError = mode === 'register' ? registerError : loginError;
  const errorCopy = getFriendlyAuthErrorCopy(activeError, mode);
  const isSubmitting = mode === 'register' ? isRegistering : isLoggingIn;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      email: email.trim(),
      password,
    };

    if (!payload.email || !payload.password.trim()) {
      return;
    }

    if (mode === 'register') {
      onRegister(payload);
      return;
    }

    onLogin(payload);
  }

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <button type="button" className="public-brand public-brand--button" onClick={onBackHome}>
          <span className="public-brand__mark" aria-hidden="true">AK</span>
          <strong>AI Knowledge Workspace</strong>
        </button>
        <div className="auth-page__header-actions">
          <LanguageSelect id="auth-language" hideLabel className="auth-page__language" />
          <button
            type="button"
            className="auth-page__switch"
            onClick={() => {
              onResetErrors();
              onNavigateMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? t('register.switch') : t('login.switch')}
          </button>
        </div>
      </header>

      <main className="auth-page__main">
        <div className="auth-card">
          <div className="auth-card__top">
            <div className="auth-card__intro">
              <p className="hero__eyebrow">{mode === 'register' ? t('register.eyebrow') : t('login.eyebrow')}</p>
              <h1>{mode === 'register' ? t('register.title') : t('login.title')}</h1>
              <p>{mode === 'register' ? t('register.subtitle') : t('login.subtitle')}</p>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">{t('fields.email')}</span>
              <input
                className="field__input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('fields.emailPlaceholder')}
                autoComplete={mode === 'login' ? 'username' : 'email'}
                maxLength={255}
              />
            </label>

            <label className="field">
              <span className="field__label">{t('fields.password')}</span>
              <input
                className="field__input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'register' ? t('register.passwordPlaceholder') : t('login.passwordPlaceholder')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={255}
              />
            </label>

            <div className="auth-form__actions">
              <Button type="submit" disabled={isSubmitting || !email.trim() || !password.trim()}>
                {isSubmitting
                  ? mode === 'register'
                    ? t('register.submitting')
                    : t('login.submitting')
                  : mode === 'register'
                    ? t('register.submit')
                    : t('login.submit')}
              </Button>
              <span className="auth-form__hint">
                {mode === 'register' ? t('register.hint') : t('login.hint')}
              </span>
            </div>
          </form>

          {activeError ? (
            <ErrorFeedback
              error={activeError}
              title={errorCopy ? t(errorCopy.titleKey) : undefined}
              message={errorCopy ? t(errorCopy.messageKey) : undefined}
            />
          ) : null}

        </div>
      </main>
    </div>
  );
}

export function KeycloakAuthEntrySurface({
  configIssue,
  authModeUnavailable,
  authErrorMessage,
  isStartingLogin,
  onContinue,
  onBackHome,
}: {
  configIssue: AuthConfigurationIssue | null;
  authModeUnavailable: boolean;
  authErrorMessage: string | null;
  isStartingLogin: boolean;
  onContinue: () => void;
  onBackHome: () => void;
}) {
  const { t } = useTranslation('auth');
  const isActionDisabled = Boolean(configIssue) || authModeUnavailable || isStartingLogin;

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <button type="button" className="public-brand public-brand--button" onClick={onBackHome}>
          <span className="public-brand__mark" aria-hidden="true">AK</span>
          <strong>AI Knowledge Workspace</strong>
        </button>
        <div className="auth-page__header-actions">
          <LanguageSelect id="auth-language" hideLabel className="auth-page__language" />
        </div>
      </header>
      <main className="auth-page__main">
        <div className="auth-card">
          <div className="auth-card__top">
            <div className="auth-card__intro">
              <p className="hero__eyebrow">{t('keycloak.eyebrow')}</p>
              <h1>{t('keycloak.title')}</h1>
              <p>{t('keycloak.subtitle')}</p>
            </div>
          </div>

          <div className="auth-form">
            <div className="auth-form__actions">
              <Button type="button" onClick={onContinue} disabled={isActionDisabled}>
                {isStartingLogin ? t('keycloak.submitting') : t('keycloak.submit')}
              </Button>
              <span className="auth-form__hint">
                {t('login.hint')}
              </span>
            </div>
          </div>

          {configIssue ? (
            <ErrorFeedback
              error={new Error(configIssue.message)}
              title={t('keycloak.notConfigured.title')}
              message={t('keycloak.notConfigured.message')}
            />
          ) : null}

          {authModeUnavailable ? (
            <ErrorFeedback
              error={new Error(authErrorMessage ?? t('keycloak.modeUnavailable'))}
              title={t('keycloak.unavailable.title')}
              message={t('keycloak.unavailable.message')}
            />
          ) : null}

          {!configIssue && !authModeUnavailable && authErrorMessage ? (
            <ErrorFeedback
              error={new Error(authErrorMessage)}
              title={t('keycloak.incomplete.title')}
              message={t('keycloak.incomplete.message')}
            />
          ) : null}

        </div>
      </main>
    </div>
  );
}

export function getFriendlyLogoutErrorCopy(error: unknown): FriendlyAuthErrorCopy | null {
  return getFriendlyAuthErrorCopy(error, 'logout');
}
