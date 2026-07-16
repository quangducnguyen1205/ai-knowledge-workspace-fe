import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '../features/workspaces/api/workspaces-api';
import { Button } from '../lib/ui';
import { routeToHash, type AppRoute } from './router';

type ShellNavItem = {
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
    { label: 'Home', route: { name: 'home' }, isActive: route.name === 'home' },
    {
      label: 'Library',
      route: { name: 'library' },
      disabled: !selectedWorkspace,
      disabledReason: 'Create or select a workspace before opening the video library.',
      isActive: route.name === 'library' || route.name === 'asset',
    },
    {
      label: 'Search',
      route: { name: 'search' },
      disabled: !selectedWorkspace,
      disabledReason: 'Create or select a workspace before searching.',
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
      <a className="skip-link" href="#main-content">Skip to content</a>
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
              aria-label="AI Knowledge Workspace home"
            >
              <span className="product-brand__mark" aria-hidden="true">AK</span>
              <span className="product-brand__copy">
                <strong>AI Knowledge Workspace</strong>
                <small>Learning workspace</small>
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
              Menu
            </button>

            <nav
              id="product-primary-nav"
              className={`product-nav ${isMobileNavOpen ? 'product-nav--open' : ''}`}
              aria-label="Primary navigation"
            >
              {navItems.map((item) => (
                <a
                  key={item.label}
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
                <span className="visually-hidden">Current workspace</span>
                <select
                  className="field__input"
                  value={selectedWorkspaceId ?? ''}
                  onChange={(event) => onSelectWorkspace(event.target.value)}
                  disabled={isWorkspaceFetching || workspaces.length === 0}
                  aria-label="Workspace"
                >
                  {workspaces.length === 0 ? <option value="">No workspace yet</option> : null}
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                className="product-upload-action"
                onClick={() => navigateFromShell({ name: 'library', upload: true })}
                disabled={!selectedWorkspace}
                title={!selectedWorkspace ? 'Create or select a workspace before uploading.' : undefined}
              >
                Upload
              </Button>

              <div ref={accountMenuRef} className="account-menu">
                <button
                  ref={accountButtonRef}
                  type="button"
                  className="account-menu__trigger"
                  aria-label="Open account menu"
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
                  <div id="account-menu-popover" className="account-menu__popover" aria-label="Account menu">
                    <div className="account-menu__identity">
                      <span>Signed in as</span>
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
                      Workspace settings
                    </a>
                    <button type="button" onClick={() => void onLogout()} disabled={isLogoutPending}>
                      {isLogoutPending ? 'Signing out...' : 'Sign out'}
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
