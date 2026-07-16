import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/api-error';
import type { Workspace } from '../api/workspaces-api';
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRenameWorkspaceMutation,
  workspaceKeys,
} from '../workspaces';
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
          title: 'Workspace created',
          message: `Created "${workspace.name}" and refreshed the visible workspace scope.`,
        });
      },
    });
  }

  function renameWorkspace(input: { workspaceId: string; name: string }) {
    feedback.clearNotice();
    renameMutation.mutate(input, {
      onSuccess: (workspace) => {
        feedback.showNotice({
          title: 'Workspace renamed',
          message: `Active workspace is now "${workspace.name}".`,
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
            title: 'Workspace deleted',
            message: isDeletingSelectedWorkspace
              ? `Removed "${deletingWorkspaceName}" and refreshed the visible workspace scope.`
              : `Removed "${deletingWorkspaceName}" without changing the current workspace scope.`,
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
