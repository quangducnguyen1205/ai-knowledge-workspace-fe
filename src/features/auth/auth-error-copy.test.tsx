import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import { AuthEntrySurface } from './auth';

function renderSurface(mode: 'login' | 'register', error: unknown) {
  render(
    <AuthEntrySurface
      mode={mode}
      registerError={mode === 'register' ? error : null}
      loginError={mode === 'login' ? error : null}
      isRegistering={false}
      isLoggingIn={false}
      onRegister={vi.fn()}
      onLogin={vi.fn()}
      onResetErrors={vi.fn()}
      onNavigateMode={vi.fn()}
      onBackHome={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe('sign-in failures never enumerate accounts or leak field shape', () => {
  const nonEnumerating = 'Email or password is incorrect';

  it('shows the single non-enumerating message for a wrong password', () => {
    renderSurface('login', new ApiClientError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS'));

    expect(screen.getByText(nonEnumerating)).toBeInTheDocument();
    expect(screen.getByText('Check your details and try again.')).toBeInTheDocument();
  });

  it('shows the same message for an unknown email', () => {
    // Spring answers unknown-email and wrong-password identically (401 INVALID_CREDENTIALS), so
    // the surface cannot reveal whether the account exists.
    renderSurface('login', new ApiClientError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS'));

    expect(screen.getByText(nonEnumerating)).toBeInTheDocument();
    expect(screen.queryByText(/no account|not registered|unknown email/i)).not.toBeInTheDocument();
  });

  it('keeps a too-short login password on the same message instead of format guidance', () => {
    // A password below the minimum can never be correct; at sign-in that fact must read as a
    // credential mismatch, not as password-requirements coaching.
    renderSurface('login', new ApiClientError(400, 'password must be at least 8 characters', 'INVALID_PASSWORD'));

    expect(screen.getByText(nonEnumerating)).toBeInTheDocument();
    expect(screen.queryByText(/at least 8 characters|password requirements/i)).not.toBeInTheDocument();
  });

  it('treats a malformed login email as a credential mismatch too', () => {
    renderSurface('login', new ApiClientError(400, 'email must be a valid email address', 'INVALID_EMAIL'));

    expect(screen.getByText(nonEnumerating)).toBeInTheDocument();
    expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument();
  });

  it('hides raw backend detail on every auth failure', () => {
    renderSurface('login', new ApiClientError(500, 'SQLException at jdbc://internal users table'));

    expect(document.body.textContent).not.toMatch(/SQL|jdbc|exception|stack/i);
    expect(screen.getByText(/could not sign in/i)).toBeInTheDocument();
  });
});

describe('registration keeps field-format guidance', () => {
  it('shows password-format guidance for a short registration password', () => {
    renderSurface('register', new ApiClientError(400, 'password must be at least 8 characters', 'INVALID_PASSWORD'));

    expect(screen.getByText('Password is not valid')).toBeInTheDocument();
    expect(screen.getByText('Check the password requirements and try again.')).toBeInTheDocument();
    expect(screen.queryByText('Email or password is incorrect')).not.toBeInTheDocument();
  });

  it('shows email-format guidance for a malformed registration email', () => {
    renderSurface('register', new ApiClientError(400, 'email must be a valid email address', 'INVALID_EMAIL'));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });
});
