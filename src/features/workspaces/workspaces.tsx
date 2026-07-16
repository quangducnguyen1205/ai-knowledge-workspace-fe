import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteWorkspace,
  createWorkspace,
  listWorkspaces,
  updateWorkspaceName,
  type UpdateWorkspaceNameInput,
  type Workspace,
} from './api/workspaces-api';
import { isApiClientError } from '../../shared/api/api-error';
import { Button, ErrorBanner, InfoBanner } from '../../lib/ui';
import { WorkspaceDeleteDialog } from './components/workspace-delete-dialog';

export const workspaceKeys = {
  all: ['workspaces'] as const,
};

export function useWorkspacesQuery(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: listWorkspaces,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useRenameWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkspaceName,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId }: { workspaceId: string }) => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

type FriendlyMessageCopy = {
  title: string;
  message: string;
};

function getFriendlyWorkspaceRenameErrorCopy(
  error: unknown,
): (FriendlyMessageCopy & { tone: 'warning' | 'error' }) | null {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_WORKSPACE_NAME') {
    return {
      tone: 'warning',
      title: 'Workspace name is not valid',
      message: 'Enter a non-empty name within the allowed length.',
    };
  }

  if (error.status === 404) {
    return {
      tone: 'warning',
      title: 'Workspace not found',
      message: 'It no longer exists or you do not have access.',
    };
  }

  if (error.status === 0) {
    return {
      tone: 'error',
      title: 'Could not rename workspace',
      message: 'Check your connection and try again. The previous name was kept.',
    };
  }

  return {
    tone: 'error',
    title: 'Could not rename workspace',
    message: 'The previous name was kept. Try again later.',
  };
}

export function WorkspaceBar({
  workspaces,
  selectedWorkspace,
  selectedWorkspaceId,
  isLoading,
  successNotice,
  createError,
  renameError,
  deleteError,
  createSuccessId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onResetDelete,
  isCreating,
  isRenaming,
  isDeleting,
}: {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  successNotice: { title: string; message: string } | null;
  createError: unknown;
  renameError: unknown;
  deleteError: unknown;
  createSuccessId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (input: UpdateWorkspaceNameInput) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  onResetDelete: () => void;
  isCreating: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [renameWorkspaceName, setRenameWorkspaceName] = useState('');
  const [deleteDialogWorkspace, setDeleteDialogWorkspace] = useState<Workspace | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const renameErrorCopy = getFriendlyWorkspaceRenameErrorCopy(renameError);
  const workspaceActionBusy = isCreating || isRenaming || isDeleting;

  useEffect(() => {
    if (createSuccessId) {
      setWorkspaceName('');
    }
  }, [createSuccessId]);

  useEffect(() => {
    setRenameWorkspaceName(selectedWorkspace?.name ?? '');
  }, [selectedWorkspace?.id, selectedWorkspace?.name]);

  useEffect(() => {
    if (
      deleteDialogWorkspace &&
      !isDeleting &&
      !deleteError &&
      !workspaces.some((workspace) => workspace.id === deleteDialogWorkspace.id)
    ) {
      setDeleteDialogWorkspace(null);
    }
  }, [deleteDialogWorkspace, deleteError, isDeleting, workspaces]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = workspaceName.trim();

    if (!trimmedName) {
      return;
    }

    onCreateWorkspace(trimmedName);
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWorkspace) {
      return;
    }

    const trimmedName = renameWorkspaceName.trim();

    if (!trimmedName || trimmedName === selectedWorkspace.name) {
      return;
    }

    onRenameWorkspace({
      workspaceId: selectedWorkspace.id,
      name: trimmedName,
    });
  }

  function openDeleteDialog() {
    if (!selectedWorkspace || workspaceActionBusy) {
      return;
    }

    onResetDelete();
    setDeleteDialogWorkspace({ ...selectedWorkspace });
  }

  function closeDeleteDialog() {
    if (isDeleting) {
      return;
    }

    onResetDelete();
    setDeleteDialogWorkspace(null);
    requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  return (
    <div className="workspace-bar">
      <div className="workspace-bar__cluster">
        <label className="field">
          <span className="field__label">Current workspace</span>
          <select
            className="field__input"
            value={selectedWorkspaceId ?? ''}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            disabled={isLoading || workspaces.length === 0 || isRenaming || isDeleting}
          >
            {workspaces.length === 0 ? <option value="">No workspace yet</option> : null}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <form className="workspace-create settings-action" onSubmit={handleSubmit}>
          <div className="settings-action__heading">
            <h3>Create workspace</h3>
            <p>Use a short name that is easy to recognize in the header.</p>
          </div>
          <label className="field field--grow">
            <span className="field__label">Workspace name</span>
            <input
              className="field__input"
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Algorithms, Databases, Distributed Systems"
              maxLength={255}
              disabled={workspaceActionBusy}
            />
          </label>
          <Button type="submit" disabled={workspaceActionBusy || !workspaceName.trim()}>
            {isCreating ? 'Creating...' : 'Create workspace'}
          </Button>
        </form>

        <form className="workspace-manage settings-action" onSubmit={handleRenameSubmit}>
          <div className="settings-action__heading">
            <h3>Rename or delete</h3>
            <p>Changes apply to the current workspace.</p>
          </div>
          <label className="field field--grow">
            <span className="field__label">Workspace name</span>
            <input
              className="field__input"
              type="text"
              value={renameWorkspaceName}
              onChange={(event) => setRenameWorkspaceName(event.target.value)}
              placeholder="Rename the active workspace"
              maxLength={255}
              disabled={!selectedWorkspace || workspaceActionBusy}
            />
          </label>

          <div className="workspace-manage__actions">
            <Button
              type="submit"
              tone="secondary"
              disabled={
                workspaceActionBusy ||
                !selectedWorkspace ||
                !renameWorkspaceName.trim() ||
                renameWorkspaceName.trim() === selectedWorkspace.name
              }
            >
              {isRenaming ? 'Saving...' : 'Rename workspace'}
            </Button>
            <button
              ref={deleteButtonRef}
              type="button"
              className="button button--ghost"
              disabled={workspaceActionBusy || !selectedWorkspace}
              onClick={openDeleteDialog}
            >
              {isDeleting ? 'Deleting...' : 'Delete workspace'}
            </button>
          </div>
        </form>
      </div>

      {successNotice ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="success"
          title={successNotice.title}
          message={successNotice.message}
        />
      ) : null}
      {createError ? <ErrorBanner error={createError} className="workspace-bar__error" /> : null}
      {renameErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="warning"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
        />
      ) : null}
      {renameErrorCopy?.tone === 'error' ? (
        <ErrorBanner
          error={renameError}
          className="workspace-bar__error"
          title={renameErrorCopy.title}
          message={renameErrorCopy.message}
        />
      ) : null}
      {deleteDialogWorkspace ? (
        <WorkspaceDeleteDialog
          workspace={deleteDialogWorkspace}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={() => onDeleteWorkspace(deleteDialogWorkspace)}
          onCancel={closeDeleteDialog}
        />
      ) : null}
    </div>
  );
}
