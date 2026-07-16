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
import { Button, ErrorBanner } from '../../lib/ui';
import { useAuth } from './auth-provider';

export const authKeys = {
  currentUser: ['auth', 'me'] as const,
};

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

type FriendlyAuthErrorCopy = {
  title: string;
  message: string;
};

function getFriendlyAuthErrorCopy(error: unknown, mode: 'register' | 'login' | 'logout'): FriendlyAuthErrorCopy | null {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.status === 0) {
    return {
      title: mode === 'logout' ? 'Could not sign out' : 'Sign in is temporarily unavailable',
      message:
        mode === 'logout'
          ? 'Check your connection and try again. Your current session is still active.'
          : 'Check your connection and try again. Your sign-in state has not changed.',
    };
  }

  if (mode === 'register' && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED') {
    return {
      title: 'Email already registered',
      message: 'Sign in with this email or use a different address.',
    };
  }

  if (mode === 'login' && error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
    return {
      title: 'Email or password is incorrect',
      message: 'Check your details and try again.',
    };
  }

  if (error.status === 400 && error.code === 'INVALID_EMAIL') {
    return {
      title: 'Enter a valid email',
      message: 'Use a complete email address and try again.',
    };
  }

  if (error.status === 400 && error.code === 'INVALID_PASSWORD') {
    return {
      title: 'Password is not valid',
      message: 'Check the password requirements and try again.',
    };
  }

  if (error.status === 400 && error.code === 'INVALID_AUTH_REQUEST') {
    return {
      title: 'Complete the form',
      message: 'Check the fields and submit again.',
    };
  }

  if (mode === 'logout') {
    return {
      title: 'Could not sign out',
      message: 'Your current session is still active. Try again later.',
    };
  }

  return {
    title: mode === 'register' ? 'Could not create account' : 'Could not sign in',
    message:
      mode === 'register'
        ? 'Your account was not created. Try again later.'
        : 'Sign in was not completed. Try again later.',
  };
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
        <button
          type="button"
          className="auth-page__switch"
          onClick={() => {
            onResetErrors();
            onNavigateMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </button>
      </header>

      <main className="auth-page__main">
        <div className="auth-card">
          <div className="auth-card__top">
            <div className="auth-card__intro">
              <p className="hero__eyebrow">{mode === 'register' ? 'Get started' : 'Welcome back'}</p>
              <h1>{mode === 'register' ? 'Create your account' : 'Sign in to your workspace'}</h1>
              <p>
                {mode === 'register'
                  ? 'Create a workspace for your videos, transcripts, and cited answers.'
                  : 'Continue learning where you left off.'}
              </p>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="field__input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                maxLength={255}
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="field__input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'register' ? 'Create a secure password' : 'Enter your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={255}
              />
            </label>

            <div className="auth-form__actions">
              <Button type="submit" disabled={isSubmitting || !email.trim() || !password.trim()}>
                {isSubmitting
                  ? mode === 'register'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
              <span className="auth-form__hint">
                {mode === 'register'
                  ? 'You will be signed in when your account is ready.'
                  : 'Your videos remain private to your account.'}
              </span>
            </div>
          </form>

          {activeError ? (
            <ErrorBanner
              error={activeError}
              title={errorCopy?.title}
              message={errorCopy?.message}
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
  const isActionDisabled = Boolean(configIssue) || authModeUnavailable || isStartingLogin;

  return (
    <div className="auth-page">
      <header className="auth-page__header">
        <button type="button" className="public-brand public-brand--button" onClick={onBackHome}>
          <span className="public-brand__mark" aria-hidden="true">AK</span>
          <strong>AI Knowledge Workspace</strong>
        </button>
      </header>
      <main className="auth-page__main">
        <div className="auth-card">
          <div className="auth-card__top">
            <div className="auth-card__intro">
              <p className="hero__eyebrow">Welcome back</p>
              <h1>Continue to your workspace</h1>
              <p>Use your organization account to continue learning.</p>
            </div>
          </div>

          <div className="auth-form">
            <div className="auth-form__actions">
              <Button type="button" onClick={onContinue} disabled={isActionDisabled}>
                {isStartingLogin ? 'Opening sign in...' : 'Continue to sign in'}
              </Button>
              <span className="auth-form__hint">
                Your videos remain private to your account.
              </span>
            </div>
          </div>

          {configIssue ? (
            <ErrorBanner
              error={new Error(configIssue.message)}
              title="Sign in is not configured"
              message="The app cannot start sign in yet. Contact your administrator."
            />
          ) : null}

          {authModeUnavailable ? (
            <ErrorBanner
              error={new Error(authErrorMessage ?? 'Authentication mode is unavailable.')}
              title="Sign in is temporarily unavailable"
              message="The current sign-in method is not available. Try again later."
            />
          ) : null}

          {!configIssue && !authModeUnavailable && authErrorMessage ? (
            <ErrorBanner
              error={new Error(authErrorMessage)}
              title="Sign in was not completed"
              message="Try signing in again."
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
