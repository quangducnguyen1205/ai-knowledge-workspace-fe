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
  selectedAssetTitle?: string;
  currentUserEmail: string;
  isWorkspaceFetching: boolean;
  processingAssetCount: number;
  transcriptReadyAssetCount: number;
  searchableAssetCount: number;
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
  selectedAssetTitle,
  currentUserEmail,
  isWorkspaceFetching,
  processingAssetCount,
  transcriptReadyAssetCount,
  searchableAssetCount,
  isLogoutPending,
  onSelectWorkspace,
  onLogout,
  children,
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const routeKey = route.name === 'asset' ? `asset:${route.assetId}` : route.name;

  const pageMeta = useMemo(() => {
    switch (route.name) {
      case 'library':
        return {
          title: 'Asset Library',
          description: 'Upload lecture videos, inspect processing state, and keep the workspace inventory organized.',
        };
      case 'asset':
        return {
          title: selectedAssetTitle ?? 'Asset Detail',
          description: 'Review processing, automatic indexing, fallback controls, and searchability for a single asset.',
        };
      case 'search':
        return {
          title: 'Workspace Search',
          description: 'Run workspace-scoped transcript search and inspect surrounding context around each hit.',
        };
      case 'settings':
        return {
          title: 'Settings',
          description: 'Manage workspaces conservatively and review the authenticated account context.',
        };
      case 'home':
      default:
        return {
          title: 'Workspace Home',
          description: 'Track search readiness, recent assets, and the next best action for the current workspace.',
        };
    }
  }, [route.name, selectedAssetTitle]);

  const navItems: ShellNavItem[] = [
    { label: 'Home', route: { name: 'home' }, isActive: route.name === 'home' },
    {
      label: 'Library',
      route: { name: 'library' },
      disabled: !selectedWorkspace,
      disabledReason: 'Create or select a workspace before opening the asset library.',
      isActive: route.name === 'library' || route.name === 'asset',
    },
    {
      label: 'Search',
      route: { name: 'search' },
      disabled: !selectedWorkspace,
      disabledReason: 'Create or select a workspace before searching transcript context.',
      isActive: route.name === 'search',
    },
    { label: 'Settings', route: { name: 'settings' }, isActive: route.name === 'settings' },
  ];

  useEffect(() => setIsMobileNavOpen(false), [routeKey]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    function closeMobileNav(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      setIsMobileNavOpen(false);
      mobileMenuButtonRef.current?.focus();
    }

    window.addEventListener('keydown', closeMobileNav);
    return () => window.removeEventListener('keydown', closeMobileNav);
  }, [isMobileNavOpen]);

  return (
    <div className="app-shell app-shell--product">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="product-shell">
        <header className="product-header">
          <div className="product-header__bar">
            <a
              className="product-brand"
              href={routeToHash({ name: 'home' })}
              onClick={(event) => {
                event.preventDefault();
                navigate({ name: 'home' });
              }}
              aria-label="AI Knowledge Workspace home"
            >
              <div className="product-brand__mark" aria-hidden="true">AK</div>
              <div className="product-brand__copy">
                <span className="product-brand__eyebrow">AI Knowledge Workspace</span>
                <strong>Learning video workspace</strong>
              </div>
            </a>

            <button
              ref={mobileMenuButtonRef}
              type="button"
              className="product-menu-button"
              aria-controls="product-primary-nav"
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((current) => !current)}
            >
              Menu
            </button>

            <nav
              id="product-primary-nav"
              className={`product-nav ${isMobileNavOpen ? 'product-nav--open' : ''}`}
              aria-label="Product navigation"
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
                    setIsMobileNavOpen(false);
                    navigate(item.route);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="product-header__actions">
              <label className="product-workspace-switcher product-workspace-switcher--compact">
                <span className="product-workspace-switcher__label">Workspace</span>
                <select
                  className="field__input"
                  value={selectedWorkspaceId ?? ''}
                  onChange={(event) => onSelectWorkspace(event.target.value)}
                  disabled={isWorkspaceFetching || workspaces.length === 0}
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
                onClick={() => navigate({ name: 'library' })}
                disabled={!selectedWorkspace}
                title={!selectedWorkspace ? 'Create or select a workspace before uploading.' : undefined}
              >
                Upload
              </Button>
              <div className="product-account-summary" aria-label="Signed in account">
                <span className="product-account-summary__label">Signed in</span>
                <strong>{currentUserEmail}</strong>
              </div>
              <Button
                type="button"
                className="product-signout-action"
                tone="ghost"
                onClick={() => void onLogout()}
                disabled={isLogoutPending}
              >
                {isLogoutPending ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </div>
        </header>

        <main id="main-content" className="product-main" tabIndex={-1}>
          <header className="product-topbar">
            <div className="product-topbar__copy">
              {route.name === 'asset' ? (
                <nav className="product-breadcrumb" aria-label="Breadcrumb">
                  <a
                    href={routeToHash({ name: 'library' })}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate({ name: 'library' });
                    }}
                  >
                    Library
                  </a>
                  <span aria-hidden="true">/</span>
                  <span aria-current="page">{selectedAssetTitle ?? 'Asset detail'}</span>
                </nav>
              ) : null}
              <p className="hero__eyebrow">{selectedWorkspace?.name ?? 'Workspace setup'}</p>
              <h1>{pageMeta.title}</h1>
              <p>{pageMeta.description}</p>
            </div>

            <div className="product-topbar__actions">
              <div className="product-status-card" aria-label="Current workspace status">
                <span className="product-status-card__label">Current workspace</span>
                <strong>{selectedWorkspace?.name ?? 'No workspace yet'}</strong>
                <span>
                  {selectedWorkspace
                    ? `${processingAssetCount} processing, ${transcriptReadyAssetCount} transcript ready, ${searchableAssetCount} searchable`
                    : 'Create a workspace to start the product flow.'}
                </span>
              </div>

              <Button type="button" tone="secondary" onClick={() => navigate({ name: 'settings' })}>
                Workspace settings
              </Button>
            </div>
          </header>

          <div className="product-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
