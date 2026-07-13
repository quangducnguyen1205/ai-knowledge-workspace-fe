import { useEffect, useMemo, useState } from 'react';
import type { Workspace } from '../../features/workspaces/api/workspaces-api';

const lastWorkspaceSelectionStorageKey = 'akw:last-workspace-id';

function readStoredWorkspaceSelection(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(lastWorkspaceSelectionStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredWorkspaceSelection(workspaceId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(lastWorkspaceSelectionStorageKey, workspaceId);
  } catch {
    // Ignore storage failures and keep the shell functional.
  }
}

type WorkspaceBootstrapInput = {
  workspaces: Workspace[] | undefined;
  workspacesDataUpdatedAt: number;
  startTransition: (callback: () => void) => void;
};

export function useWorkspaceBootstrap({
  workspaces,
  workspacesDataUpdatedAt,
  startTransition,
}: WorkspaceBootstrapInput) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(() => readStoredWorkspaceSelection());
  const [workspaceScopeRefreshAfter, setWorkspaceScopeRefreshAfter] = useState<number | null>(null);

  useEffect(() => {
    const workspaceList = workspaces ?? [];

    if (workspaceScopeRefreshAfter !== null) {
      if (workspacesDataUpdatedAt <= workspaceScopeRefreshAfter) {
        return;
      }

      if (!workspaceList.length) {
        setWorkspaceScopeRefreshAfter(null);
        return;
      }

      const restoredWorkspace = preferredWorkspaceId
        ? workspaceList.find((workspace) => workspace.id === preferredWorkspaceId)
        : null;

      startTransition(() => setSelectedWorkspaceId(restoredWorkspace?.id ?? workspaceList[0].id));
      setWorkspaceScopeRefreshAfter(null);
      return;
    }

    if (!workspaceList.length) {
      return;
    }

    if (preferredWorkspaceId) {
      const preferredWorkspace = workspaceList.find((workspace) => workspace.id === preferredWorkspaceId);
      if (preferredWorkspace) {
        startTransition(() => setSelectedWorkspaceId(preferredWorkspace.id));
        setPreferredWorkspaceId(null);
        return;
      }
    }

    if (selectedWorkspaceId && workspaceList.some((workspace) => workspace.id === selectedWorkspaceId)) {
      return;
    }

    startTransition(() => setSelectedWorkspaceId(workspaceList[0].id));
  }, [
    preferredWorkspaceId,
    selectedWorkspaceId,
    startTransition,
    workspaceScopeRefreshAfter,
    workspaces,
    workspacesDataUpdatedAt,
  ]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      writeStoredWorkspaceSelection(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const selectedWorkspace = useMemo(
    () => workspaces?.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  return {
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    preferredWorkspaceId,
    setPreferredWorkspaceId,
    workspaceScopeRefreshAfter,
    setWorkspaceScopeRefreshAfter,
  };
}
