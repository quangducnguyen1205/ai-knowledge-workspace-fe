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
  it('preserves navigation, workspace, account, route heading, and content landmarks', async () => {
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
        processingAssetCount={1}
        transcriptReadyAssetCount={2}
        searchableAssetCount={3}
        isLogoutPending={false}
        onSelectWorkspace={onSelectWorkspace}
        onLogout={vi.fn()}
      >
        <p>Library route content</p>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Asset Library', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByText('Library route content')).toBeInTheDocument();
    expect(screen.getByLabelText('Signed in account')).toHaveTextContent('learner@example.com');
    expect(screen.getByLabelText('Current workspace status')).toHaveTextContent(
      '1 processing, 2 transcript ready, 3 searchable',
    );

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
        processingAssetCount={0}
        transcriptReadyAssetCount={0}
        searchableAssetCount={0}
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
