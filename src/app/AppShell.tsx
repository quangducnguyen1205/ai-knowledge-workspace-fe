import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '../features/workspaces/api/workspaces-api';
import { Button } from '../lib/ui';
import { useTranslation } from '../shared/i18n';
import { routeToHash, type AppRoute } from './router';

type ShellNavItem = {
  /** Stable list identity, so a translated label never becomes a React key. */
  key: string;
  label: string;
  route: AppRoute;
  disabled?: boolean;
  disabledReason?: string;
  isActive: boolean;
};

type AppShellProps = {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  currentUserEmail: string;
  isWorkspaceFetching: boolean;
  isLogoutPending: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onLogout: () => void | Promise<void>;
  children: ReactNode;
};

export function AppShell({
  route,
  navigate,
  workspaces,
  selectedWorkspace,
  selectedWorkspaceId,
  currentUserEmail,
  isWorkspaceFetching,
  isLogoutPending,
  onSelectWorkspace,
  onLogout,
  children,
}: AppShellProps) {
  const { t } = useTranslation(['shell', 'common']);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const routeKey = routeToHash(route);
  const accountInitials = useMemo(() => {
    const localPart = currentUserEmail.split('@')[0]?.trim() || 'A';
    const parts = localPart.split(/[._\-\s]+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : localPart.slice(0, 2)).toUpperCase();
  }, [currentUserEmail]);

  const navItems: ShellNavItem[] = [
    { key: 'home', label: t('nav.home'), route: { name: 'home' }, isActive: route.name === 'home' },
    {
      key: 'library',
      label: t('nav.library'),
      route: { name: 'library' },
      disabled: !selectedWorkspace,
      disabledReason: t('nav.libraryDisabled'),
      isActive: route.name === 'library' || route.name === 'asset',
    },
    {
      key: 'search',
      label: t('nav.explore'),
      route: { name: 'search' },
      disabled: !selectedWorkspace,
      disabledReason: t('nav.exploreDisabled'),
      isActive: route.name === 'search',
    },
  ];

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsAccountMenuOpen(false);
  }, [routeKey]);

  useEffect(() => {
    function closeOpenMenu(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      if (isAccountMenuOpen) {
        setIsAccountMenuOpen(false);
        accountButtonRef.current?.focus();
        return;
      }

      if (isMobileNavOpen) {
        setIsMobileNavOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    }

    window.addEventListener('keydown', closeOpenMenu);
    return () => window.removeEventListener('keydown', closeOpenMenu);
  }, [isAccountMenuOpen, isMobileNavOpen]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    function closeAccountMenu(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !accountMenuRef.current?.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', closeAccountMenu);
    return () => window.removeEventListener('pointerdown', closeAccountMenu);
  }, [isAccountMenuOpen]);

  function navigateFromShell(nextRoute: AppRoute) {
    setIsMobileNavOpen(false);
    setIsAccountMenuOpen(false);
    navigate(nextRoute);
  }

  return (
    <div className="app-shell app-shell--product">
      <a className="skip-link" href="#main-content">{t('common:skipToContent')}</a>
      <div className="product-shell">
        <header className="product-header">
          <div className="product-header__bar">
            <a
              className="product-brand"
              href={routeToHash({ name: 'home' })}
              onClick={(event) => {
                event.preventDefault();
                navigateFromShell({ name: 'home' });
              }}
              aria-label={t('brand.homeLabel')}
            >
              <span className="product-brand__mark" aria-hidden="true">AK</span>
              <span className="product-brand__copy">
                <strong>{t('brand.name')}</strong>
                <small>{t('brand.tagline')}</small>
              </span>
            </a>

            <button
              ref={mobileMenuButtonRef}
              type="button"
              className="product-menu-button"
              aria-controls="product-primary-nav"
              aria-expanded={isMobileNavOpen}
              onClick={() => {
                setIsAccountMenuOpen(false);
                setIsMobileNavOpen((current) => !current);
              }}
            >
              {t('nav.menu')}
            </button>

            <nav
              id="product-primary-nav"
              className={`product-nav ${isMobileNavOpen ? 'product-nav--open' : ''}`}
              aria-label={t('nav.label')}
            >
              {navItems.map((item) => (
                <a
                  key={item.key}
                  className={`product-nav__link ${item.isActive ? 'product-nav__link--active' : ''}`}
                  href={routeToHash(item.route)}
                  aria-current={item.isActive ? 'page' : undefined}
                  aria-disabled={item.disabled ? 'true' : undefined}
                  title={item.disabled ? item.disabledReason : undefined}
                  onClick={(event) => {
                    if (item.disabled) {
                      event.preventDefault();
                      return;
                    }
                    event.preventDefault();
                    navigateFromShell(item.route);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="product-header__actions">
              <label className="product-workspace-switcher">
                <span className="visually-hidden">{t('workspaceSwitcher.current')}</span>
                <select
                  className="field__input"
                  value={selectedWorkspaceId ?? ''}
                  onChange={(event) => onSelectWorkspace(event.target.value)}
                  disabled={isWorkspaceFetching || workspaces.length === 0}
                  aria-label={t('workspaceSwitcher.label')}
                >
                  {workspaces.length === 0 ? <option value="">{t('workspaceSwitcher.empty')}</option> : null}
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                className="product-upload-action"
                aria-label={t('addVideo.accessibleLabel')}
                onClick={() => navigateFromShell({ name: 'library', upload: true })}
                disabled={!selectedWorkspace}
                title={!selectedWorkspace ? t('addVideo.disabled') : undefined}
              >
                {t('addVideo.label')}
              </Button>

              <div ref={accountMenuRef} className="account-menu">
                <button
                  ref={accountButtonRef}
                  type="button"
                  className="account-menu__trigger"
                  aria-label={t('account.open')}
                  aria-controls="account-menu-popover"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    setIsAccountMenuOpen((current) => !current);
                  }}
                >
                  <span aria-hidden="true">{accountInitials}</span>
                </button>

                {isAccountMenuOpen ? (
                  <div id="account-menu-popover" className="account-menu__popover" aria-label={t('account.menu')}>
                    <div className="account-menu__identity">
                      <span>{t('account.signedInAs')}</span>
                      <strong>{currentUserEmail}</strong>
                    </div>
                    <a
                      href={routeToHash({ name: 'settings' })}
                      aria-current={route.name === 'settings' ? 'page' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateFromShell({ name: 'settings' });
                      }}
                    >
                      {t('account.workspaceTools')}
                    </a>
                    <button type="button" onClick={() => void onLogout()} disabled={isLogoutPending}>
                      {isLogoutPending ? t('account.signingOut') : t('account.signOut')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="product-main" tabIndex={-1}>
          <div className="product-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
