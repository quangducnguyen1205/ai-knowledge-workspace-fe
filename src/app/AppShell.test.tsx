import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const workspace = {
  id: 'workspace-1',
  name: 'Distributed Systems',
  createdAt: '2026-06-26T00:00:00Z',
};

afterEach(() => cleanup());

describe('AppShell layout boundary', () => {
  it('keeps primary navigation focused and moves account actions into a menu', async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const onSelectWorkspace = vi.fn();

    render(
      <AppShell
        route={{ name: 'library' }}
        navigate={navigate}
        workspaces={[workspace]}
        selectedWorkspace={workspace}
        selectedWorkspaceId={workspace.id}
        currentUserEmail="learner@example.com"
        isWorkspaceFetching={false}
        isLogoutPending={false}
        onSelectWorkspace={onSelectWorkspace}
        onLogout={vi.fn()}
      >
        <h1>Library</h1>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: /Home|Library|Search/ })).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.queryByText('learner@example.com')).not.toBeInTheDocument();

    const accountMenuButton = screen.getByRole('button', { name: 'Open account menu' });
    await user.click(accountMenuButton);
    expect(screen.getByLabelText('Account menu')).toHaveTextContent('learner@example.com');
    expect(screen.getByRole('link', { name: 'Workspace settings' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(accountMenuButton).toHaveAttribute('aria-expanded', 'false');
    expect(accountMenuButton).toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'Search' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'search' });
  });

  it('preserves Escape close and focus restoration for compact navigation', async () => {
    const user = userEvent.setup();

    render(
      <AppShell
        route={{ name: 'home' }}
        navigate={vi.fn()}
        workspaces={[workspace]}
        selectedWorkspace={workspace}
        selectedWorkspaceId={workspace.id}
        currentUserEmail="learner@example.com"
        isWorkspaceFetching={false}
        isLogoutPending={false}
        onSelectWorkspace={vi.fn()}
        onLogout={vi.fn()}
      >
        <p>Home content</p>
      </AppShell>,
    );

    const menu = screen.getByRole('button', { name: 'Menu' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });
});
