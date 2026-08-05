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
import { Button, ErrorFeedback, InfoBanner, SuccessNotification } from '../../lib/ui';
import { useTranslation } from '../../shared/i18n';
import type { EphemeralNotice } from '../../shared/ui/use-ephemeral-notice';
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

/** Which rename copy applies, as `workspaces` namespace keys — the words stay in the resources. */
function renameErrorKeys<Key extends 'renameInvalidName' | 'renameNotFound' | 'renameOffline' | 'renameFailed'>(
  tone: 'warning' | 'error',
  key: Key,
) {
  return {
    tone,
    titleKey: `workspaces:errors.${key}.title`,
    messageKey: `workspaces:errors.${key}.message`,
  } as const;
}

function getFriendlyWorkspaceRenameErrorCopy(error: unknown) {
  if (!isApiClientError(error)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_WORKSPACE_NAME') {
    return renameErrorKeys('warning', 'renameInvalidName');
  }

  if (error.status === 404) {
    return renameErrorKeys('warning', 'renameNotFound');
  }

  if (error.status === 0) {
    return renameErrorKeys('error', 'renameOffline');
  }

  return renameErrorKeys('error', 'renameFailed');
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
  successNotice: EphemeralNotice | null;
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
  const { t } = useTranslation(['workspaces', 'common']);
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
          <span className="field__label">{t('current')}</span>
          <select
            className="field__input"
            value={selectedWorkspaceId ?? ''}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            disabled={isLoading || workspaces.length === 0 || isRenaming || isDeleting}
          >
            {workspaces.length === 0 ? <option value="">{t('empty')}</option> : null}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <form className="workspace-create settings-action" onSubmit={handleSubmit}>
          <div className="settings-action__heading">
            <h3>{t('create.title')}</h3>
            <p>{t('create.description')}</p>
          </div>
          <label className="field field--grow">
            <span className="field__label">{t('nameLabel')}</span>
            <input
              className="field__input"
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder={t('create.placeholder')}
              maxLength={255}
              disabled={workspaceActionBusy}
            />
          </label>
          <Button type="submit" disabled={workspaceActionBusy || !workspaceName.trim()}>
            {isCreating ? t('create.submitting') : t('create.submit')}
          </Button>
        </form>

        <form className="workspace-manage settings-action" onSubmit={handleRenameSubmit}>
          <div className="settings-action__heading">
            <h3>{t('manage.title')}</h3>
            <p>{t('manage.description')}</p>
          </div>
          <label className="field field--grow">
            <span className="field__label">{t('nameLabel')}</span>
            <input
              className="field__input"
              type="text"
              value={renameWorkspaceName}
              onChange={(event) => setRenameWorkspaceName(event.target.value)}
              placeholder={t('manage.placeholder')}
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
              {isRenaming ? t('common:actions.saving') : t('manage.rename')}
            </Button>
            <button
              ref={deleteButtonRef}
              type="button"
              className="button button--ghost"
              disabled={workspaceActionBusy || !selectedWorkspace}
              onClick={openDeleteDialog}
            >
              {isDeleting ? t('common:actions.deleting') : t('manage.delete')}
            </button>
          </div>
        </form>
      </div>

      {successNotice ? (
        <SuccessNotification
          className="workspace-bar__error"
          title={successNotice.title}
          message={successNotice.message}
          onDismiss={successNotice.dismiss}
        />
      ) : null}
      {createError ? <ErrorFeedback error={createError} className="workspace-bar__error" /> : null}
      {renameErrorCopy?.tone === 'warning' ? (
        <InfoBanner
          className="workspace-bar__error"
          tone="warning"
          title={t(renameErrorCopy.titleKey)}
          message={t(renameErrorCopy.messageKey)}
        />
      ) : null}
      {renameErrorCopy?.tone === 'error' ? (
        <ErrorFeedback
          error={renameError}
          className="workspace-bar__error"
          title={t(renameErrorCopy.titleKey)}
          message={t(renameErrorCopy.messageKey)}
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
