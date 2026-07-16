import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import { WorkspaceDeleteDialog } from './components/workspace-delete-dialog';
import { WorkspaceBar } from './workspaces';

const workspace = { id: 'workspace-1', name: 'Algorithms', createdAt: '2026-01-01T00:00:00Z' };

afterEach(() => cleanup());

describe('WorkspaceDeleteDialog', () => {
  it('opens from workspace management without using the native confirmation path', async () => {
    const user = userEvent.setup();
    const onDeleteWorkspace = vi.fn();
    const onResetDelete = vi.fn();
    render(
      <WorkspaceBar
        workspaces={[workspace]}
        selectedWorkspace={workspace}
        selectedWorkspaceId={workspace.id}
        isLoading={false}
        successNotice={null}
        createError={null}
        renameError={null}
        deleteError={null}
        logoutError={null}
        onSelectWorkspace={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onRenameWorkspace={vi.fn()}
        onDeleteWorkspace={onDeleteWorkspace}
        onResetDelete={onResetDelete}
        isCreating={false}
        isRenaming={false}
        isDeleting={false}
        onLogout={vi.fn()}
        isLoggingOut={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete workspace' }));

    expect(screen.getByRole('dialog', { name: 'Delete “Algorithms”?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDeleteWorkspace).not.toHaveBeenCalled();
    expect(onResetDelete).toHaveBeenCalledTimes(2);
  });

  it('keeps the controlled dialog open until cancel and sends no delete request on cancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<WorkspaceDeleteDialog workspace={workspace} isDeleting={false} error={null} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByRole('dialog', { name: 'Delete “Algorithms”?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('supports Escape cancellation while no request is pending', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<WorkspaceDeleteDialog workspace={workspace} isDeleting={false} error={null} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('submits exactly once and blocks duplicate confirmation while pending', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WorkspaceDeleteDialog workspace={workspace} isDeleting={false} error={null} onConfirm={onConfirm} onCancel={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: 'Delete workspace' });
    await user.click(confirm);
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('keeps recoverable non-empty conflict feedback inside the dialog for a later retry', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <WorkspaceDeleteDialog
        workspace={workspace}
        isDeleting={false}
        error={new ApiClientError(409, 'Workspace still has assets', 'WORKSPACE_NOT_EMPTY')}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Workspace vẫn còn tài liệu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete workspace' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders the protected default-workspace conflict without raw backend detail', () => {
    render(
      <WorkspaceDeleteDialog
        workspace={workspace}
        isDeleting={false}
        error={new ApiClientError(409, 'raw backend detail', 'DEFAULT_WORKSPACE_DELETE_FORBIDDEN')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Không thể xóa workspace mặc định')).toBeInTheDocument();
    expect(screen.queryByText('raw backend detail')).not.toBeInTheDocument();
  });

  it('renders a safe generic failure and keeps retry available', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <WorkspaceDeleteDialog
        workspace={workspace}
        isDeleting={false}
        error={new ApiClientError(500, 'internal stack detail')}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Không thể xóa workspace')).toBeInTheDocument();
    expect(screen.queryByText('internal stack detail')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete workspace' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
