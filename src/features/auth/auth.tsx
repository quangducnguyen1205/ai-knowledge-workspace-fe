import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClientError, getCurrentUser, loginUser, logoutUser, registerUser, type AuthCredentialsInput } from '../../lib/api';
import { Button, ErrorBanner } from '../../lib/ui';

export const authKeys = {
  currentUser: ['auth', 'me'] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 0,
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
  detail?: string;
};

function getFriendlyAuthErrorCopy(error: unknown, mode: 'register' | 'login' | 'logout'): FriendlyAuthErrorCopy | null {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.status === 0) {
    return {
      title: mode === 'logout' ? 'Logout could not reach Spring' : 'Auth request could not reach Spring',
      message:
        mode === 'logout'
          ? 'The frontend could not contact the Spring backend, so the current session stayed in place.'
          : 'The frontend could not contact the Spring backend, so the session did not change.',
    };
  }

  if (mode === 'register' && error.status === 409 && error.code === 'EMAIL_ALREADY_REGISTERED') {
    return {
      title: 'Email already registered',
      message: 'Use a different email address or switch to Sign in if this account already exists.',
      detail: `Backend detail: ${error.code}`,
    };
  }

  if (mode === 'login' && error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
    return {
      title: 'Sign-in failed',
      message: 'Spring rejected this email and password combination. Check the credentials and try again.',
      detail: `Backend detail: ${error.code}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_EMAIL') {
    return {
      title: 'Email was rejected',
      message: 'Enter a valid email address and try again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_PASSWORD') {
    return {
      title: 'Password was rejected',
      message: 'Use a non-empty password that meets the current backend length rules, then try again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (error.status === 400 && error.code === 'INVALID_AUTH_REQUEST') {
    return {
      title: 'Auth request was rejected',
      message: 'Spring did not accept the auth form payload. Check both fields and try again.',
      detail: `Backend detail: ${error.code} - ${error.message}`,
    };
  }

  if (mode === 'logout') {
    return {
      title: 'Logout failed',
      message: 'Spring did not confirm logout, so the current authenticated shell stays in place.',
      detail: error.code ? `Backend detail: ${error.code} - ${error.message}` : `Backend detail: ${error.message}`,
    };
  }

  return {
    title: mode === 'register' ? 'Registration failed' : 'Sign-in failed',
    message:
      mode === 'register'
        ? 'Spring did not confirm account creation, so the frontend stayed on the auth entry surface.'
        : 'Spring did not confirm sign-in, so the frontend stayed on the auth entry surface.',
    detail: error.code ? `Backend detail: ${error.code} - ${error.message}` : `Backend detail: ${error.message}`,
  };
}

export function AuthEntrySurface({
  registerError,
  loginError,
  isRegistering,
  isLoggingIn,
  onRegister,
  onLogin,
  onResetErrors,
}: {
  registerError: unknown;
  loginError: unknown;
  isRegistering: boolean;
  isLoggingIn: boolean;
  onRegister: (input: AuthCredentialsInput) => void;
  onLogin: (input: AuthCredentialsInput) => void;
  onResetErrors: () => void;
}) {
  const [mode, setMode] = useState<'register' | 'login'>('login');
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
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__intro">
          <p className="hero__eyebrow">AI Knowledge Workspace</p>
          <h1>Sign in to the search workspace</h1>
          <p>
            Use the Spring product auth path to open the existing search-first shell for workspace scope, uploads,
            explicit indexing, and transcript search.
          </p>
        </div>

        <div className="auth-card__tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              onResetErrors();
              setMode('login');
            }}
            aria-pressed={mode === 'login'}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              onResetErrors();
              setMode('register');
            }}
            aria-pressed={mode === 'register'}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="learner@example.com"
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
              placeholder="At least 8 characters"
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
                ? 'Successful register also authenticates the new user into the current Spring session.'
                : 'Successful sign-in hands off directly into the existing workspace shell.'}
            </span>
          </div>
        </form>

        {activeError ? (
          <ErrorBanner
            error={activeError}
            title={errorCopy?.title}
            message={errorCopy?.message}
            detail={errorCopy?.detail}
          />
        ) : null}

        <div className="auth-card__footer">
          <strong>Main product auth path</strong>
          <p>
            This frontend now uses register, sign in, sign out, and <code>GET /api/me</code> as the main product auth
            flow. The older local/dev session shortcut is intentionally not part of this primary UX.
          </p>
        </div>
      </div>
    </div>
  );
}

export function getFriendlyLogoutErrorCopy(error: unknown): FriendlyAuthErrorCopy | null {
  return getFriendlyAuthErrorCopy(error, 'logout');
}
