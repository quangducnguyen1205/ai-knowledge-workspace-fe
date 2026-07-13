import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/api-error';
import type { Workspace } from '../api/workspaces-api';
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRenameWorkspaceMutation,
  workspaceKeys,
} from '../workspaces';

type SuccessNotice = { title: string; message: string };

export function useWorkspaceManagement({
  currentUserId,
  selectedWorkspace,
  selectedWorkspaceId,
  setPreferredWorkspaceId,
  setWorkspaceScopeRefreshAfter,
  onClearWorkspaceScope,
  onDeletedWorkspaceRoute,
}: {
  currentUserId?: string;
  selectedWorkspace: Workspace | null;
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
  const [successNotice, setSuccessNotice] = useState<SuccessNotice | null>(null);

  useEffect(() => setSuccessNotice(null), [currentUserId]);

  function createWorkspace(name: string) {
    setSuccessNotice(null);
    createMutation.mutate(name, {
      onSuccess: (workspace) => {
        setPreferredWorkspaceId(workspace.id);
        setSuccessNotice({
          title: 'Workspace created',
          message: `Created "${workspace.name}" and refreshed the visible workspace scope.`,
        });
      },
    });
  }

  function renameWorkspace(input: { workspaceId: string; name: string }) {
    setSuccessNotice(null);
    renameMutation.mutate(input, {
      onSuccess: (workspace) => {
        setSuccessNotice({
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

  function deleteWorkspace() {
    if (!selectedWorkspace || deleteMutation.isPending) return;

    const deletingWorkspaceName = selectedWorkspace.name;
    const confirmed = window.confirm(
      `Delete workspace "${deletingWorkspaceName}"?\n\nOnly empty non-default workspaces can be removed. This will refresh the visible workspace scope.`,
    );
    if (!confirmed) return;

    setSuccessNotice(null);
    deleteMutation.mutate(
      { workspaceId: selectedWorkspace.id },
      {
        onSuccess: async (_response, variables) => {
          setWorkspaceScopeRefreshAfter(Date.now());
          onClearWorkspaceScope(variables.workspaceId);
          onDeletedWorkspaceRoute();
          setSuccessNotice({
            title: 'Workspace deleted',
            message: `Removed "${deletingWorkspaceName}" and refreshed the visible workspace scope.`,
          });
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            setWorkspaceScopeRefreshAfter(Date.now());
            onClearWorkspaceScope(variables.workspaceId);
            await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
          }
        },
      },
    );
  }

  return {
    successNotice,
    clearSuccessNotice: () => setSuccessNotice(null),
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    createError: createMutation.error,
    renameError: renameMutation.error && renameMutation.variables?.workspaceId === selectedWorkspaceId
      ? renameMutation.error
      : null,
    deleteError: deleteMutation.error && deleteMutation.variables?.workspaceId === selectedWorkspaceId
      ? deleteMutation.error
      : null,
    createSuccessId: createMutation.data?.id,
    isCreating: createMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
