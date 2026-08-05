import type { ReactNode } from 'react';
import { Button, ErrorFeedback, Section } from '../../lib/ui';
import { LanguageSelect, useTranslation } from '../../shared/i18n';
import { getFriendlyLogoutErrorCopy } from '../auth/public';
import { formatAppRevision, resolveAppRevision } from '../../shared/build/build-identity';

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
  const { t } = useTranslation(['settings', 'auth']);
  const logoutErrorCopy = getFriendlyLogoutErrorCopy(logoutError);

  return (
    <div className="screen-stack settings-screen">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="hero__eyebrow">{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </div>
      </header>

      <div className="settings-layout">
        <Section title={t('workspaceSection')} className="settings-workspace">
          {workspaceManagement}
        </Section>

        <Section title={t('accountSection')} className="settings-account">
          <div className="account-details">
            <span>{t('email')}</span>
            <strong>{currentUserEmail}</strong>
          </div>
          <Button type="button" tone="ghost" onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? t('signingOut') : t('signOut')}
          </Button>
          {logoutError ? (
            <ErrorFeedback
              error={logoutError}
              title={logoutErrorCopy ? t(logoutErrorCopy.titleKey) : undefined}
              message={logoutErrorCopy ? t(logoutErrorCopy.messageKey) : undefined}
            />
          ) : null}
        </Section>

        <Section title={t('language.section')} className="settings-language">
          <LanguageSelect id="settings-language" />
          <p className="settings-diagnostics__hint">{t('language.hint')}</p>
        </Section>

        <Section title={t('diagnosticsSection')} className="settings-diagnostics">
          <div className="account-details">
            <span>{t('appRevision')}</span>
            <strong data-testid="app-revision">{formatAppRevision(resolveAppRevision())}</strong>
          </div>
          <p className="settings-diagnostics__hint">{t('appRevisionHint')}</p>
        </Section>
      </div>
    </div>
  );
}
