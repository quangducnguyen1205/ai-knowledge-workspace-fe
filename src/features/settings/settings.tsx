import type { ReactNode } from 'react';
import { Button, ErrorBanner, Section } from '../../lib/ui';
import { getFriendlyLogoutErrorCopy } from '../auth/auth';

type SettingsScreenProps = {
  currentUserEmail: string;
  workspaceManagement: ReactNode;
  logoutError: unknown;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export function SettingsScreen({
  currentUserEmail,
  workspaceManagement,
  logoutError,
  isLoggingOut,
  onLogout,
}: SettingsScreenProps) {
  const logoutErrorCopy = getFriendlyLogoutErrorCopy(logoutError);

  return (
    <div className="screen-stack settings-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">Settings</p>
          <h1>Workspace and account</h1>
          <p>Manage your current workspace or sign out.</p>
        </div>
      </header>

      <div className="settings-layout">
        <Section title="Workspace management" className="settings-workspace">
          {workspaceManagement}
        </Section>

        <Section title="Account" className="settings-account">
          <div className="account-details">
            <span>Email</span>
            <strong>{currentUserEmail}</strong>
          </div>
          <Button type="button" tone="ghost" onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
          {logoutError ? (
            <ErrorBanner error={logoutError} title={logoutErrorCopy?.title} message={logoutErrorCopy?.message} />
          ) : null}
        </Section>
      </div>
    </div>
  );
}
