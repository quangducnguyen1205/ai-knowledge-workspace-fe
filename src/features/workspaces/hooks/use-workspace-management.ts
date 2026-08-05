import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/api-error';
import type { Workspace } from '../api/workspaces-api';
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRenameWorkspaceMutation,
  workspaceKeys,
} from '../workspaces';
import { useTranslation } from '../../../shared/i18n';
import { useEphemeralNotice } from '../../../shared/ui/use-ephemeral-notice';

export function useWorkspaceManagement({
  noticeContextKey,
  selectedWorkspaceId,
  setPreferredWorkspaceId,
  setWorkspaceScopeRefreshAfter,
  onClearWorkspaceScope,
  onDeletedWorkspaceRoute,
}: {
  noticeContextKey: string;
  selectedWorkspaceId: string | null;
  setPreferredWorkspaceId: (workspaceId: string | null) => void;
  setWorkspaceScopeRefreshAfter: (refreshedAfter: number | null) => void;
  onClearWorkspaceScope: (workspaceId: string) => void;
  onDeletedWorkspaceRoute: () => void;
}) {
  const { t } = useTranslation('workspaces');
  const queryClient = useQueryClient();
  const createMutation = useCreateWorkspaceMutation();
  const renameMutation = useRenameWorkspaceMutation();
  const deleteMutation = useDeleteWorkspaceMutation();
  const feedback = useEphemeralNotice(noticeContextKey);

  function createWorkspace(name: string) {
    feedback.clearNotice();
    createMutation.mutate(name, {
      onSuccess: (workspace) => {
        setPreferredWorkspaceId(workspace.id);
        feedback.showNotice({
          id: 'workspace-created',
          title: t('notices.created.title'),
          message: t('notices.created.message', { name: workspace.name }),
        });
      },
    });
  }

  function renameWorkspace(input: { workspaceId: string; name: string }) {
    feedback.clearNotice();
    renameMutation.mutate(input, {
      onSuccess: (workspace) => {
        feedback.showNotice({
          id: 'workspace-renamed',
          title: t('notices.renamed.title'),
          message: t('notices.renamed.message', { name: workspace.name }),
        });
      },
      onError: async (error, variables) => {
        if (error instanceof ApiClientError && error.status === 404) {
          setWorkspaceScopeRefreshAfter(Date.now());
          onClearWorkspaceScope(variables.workspaceId);
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
        }
      },
    });
  }

  function deleteWorkspace(workspace: Workspace) {
    if (deleteMutation.isPending) return;

    const deletingWorkspaceName = workspace.name;
    const isDeletingSelectedWorkspace = workspace.id === selectedWorkspaceId;
    feedback.clearNotice();
    deleteMutation.mutate(
      { workspaceId: workspace.id },
      {
        onSuccess: async (_response, variables) => {
          if (isDeletingSelectedWorkspace) {
            setWorkspaceScopeRefreshAfter(Date.now());
            onClearWorkspaceScope(variables.workspaceId);
            onDeletedWorkspaceRoute();
          }
          feedback.showNotice({
            id: 'workspace-deleted',
            title: t('notices.deleted.title'),
            message: isDeletingSelectedWorkspace
              ? t('notices.deleted.messageActive', { name: deletingWorkspaceName })
              : t('notices.deleted.messageOther', { name: deletingWorkspaceName }),
          });
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
        },
        onError: async (error, variables) => {
          if (isDeletingSelectedWorkspace && error instanceof ApiClientError && error.status === 404) {
            setWorkspaceScopeRefreshAfter(Date.now());
            onClearWorkspaceScope(variables.workspaceId);
            onDeletedWorkspaceRoute();
            await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
          }
        },
      },
    );
  }

  return {
    successNotice: feedback.notice,
    clearSuccessNotice: feedback.clearNotice,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    createError: createMutation.error,
    renameError: renameMutation.error && renameMutation.variables?.workspaceId === selectedWorkspaceId
      ? renameMutation.error
      : null,
    deleteError: deleteMutation.error,
    createSuccessId: createMutation.data?.id,
    isCreating: createMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDeleting: deleteMutation.isPending,
    resetDelete: deleteMutation.reset,
  };
}
