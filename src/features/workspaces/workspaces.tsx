import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  backendDisplayUrl,
  createWorkspace,
  listWorkspaces,
  usingProxy,
  type Workspace,
} from '../../lib/api';
import { Button, ErrorBanner } from '../../lib/ui';
import { getFriendlyLogoutErrorCopy } from '../auth/auth';

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

export function WorkspaceBar({
  workspaces,
  selectedWorkspace,
  selectedWorkspaceId,
  isLoading,
  createError,
  logoutError,
  createSuccessId,
  onSelectWorkspace,
  onCreateWorkspace,
  isCreating,
  onLogout,
  isLoggingOut,
}: {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  createError: unknown;
  logoutError: unknown;
  createSuccessId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  isCreating: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState('');
  const logoutErrorCopy = getFriendlyLogoutErrorCopy(logoutError);

  useEffect(() => {
    if (createSuccessId) {
      setWorkspaceName('');
    }
  }, [createSuccessId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = workspaceName.trim();

    if (!trimmedName) {
      return;
    }

    onCreateWorkspace(trimmedName);
  }

  return (
    <div className="workspace-bar">
      <div className="workspace-bar__top">
        <div className={`workspace-bar__intro ${isLoading ? 'workspace-bar__intro--busy' : ''}`}>
          <div>
            <span className="workspace-focus__eyebrow">Workspace controls</span>
            <strong className="workspace-focus__title">Keep the active scope in sync</strong>
          </div>
          <p className="workspace-bar__intro-copy">
            Change workspace, create another owned workspace, or sign out without leaving the current search shell.
          </p>
        </div>

        <div className="workspace-bar__pills">
          <div className="pill">
            <span className="pill__label">Backend</span>
            <span className="pill__value">{usingProxy ? `proxy -> ${backendDisplayUrl}` : backendDisplayUrl}</span>
          </div>

          <Button type="button" tone="ghost" onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>
      </div>

      <div className="workspace-bar__cluster">
        <label className="field">
          <span className="field__label">Workspace scope</span>
          <select
            className="field__input"
            value={selectedWorkspaceId ?? ''}
            onChange={(event) => onSelectWorkspace(event.target.value)}
            disabled={isLoading || workspaces.length === 0}
          >
            {workspaces.length === 0 ? <option value="">No workspace yet</option> : null}
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <span className="field__hint">
            {selectedWorkspace
              ? `Currently in ${selectedWorkspace.name}. Changing scope updates assets and search in place.`
              : 'Changing workspace updates assets and search in place for the active session.'}
          </span>
        </label>

        <form className="workspace-create" onSubmit={handleSubmit}>
          <label className="field field--grow">
            <span className="field__label">Create workspace</span>
            <input
              className="field__input"
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Algorithms, Databases, Distributed Systems..."
              maxLength={255}
            />
            <span className="field__hint">Create another owned scope for uploads, indexing, and search.</span>
          </label>
          <Button type="submit" tone="secondary" disabled={isCreating || !workspaceName.trim()}>
            {isCreating ? 'Creating...' : 'Add workspace'}
          </Button>
        </form>
      </div>

      {logoutError ? (
        <ErrorBanner
          error={logoutError}
          className="workspace-bar__error"
          title={logoutErrorCopy?.title}
          message={logoutErrorCopy?.message}
          detail={logoutErrorCopy?.detail}
        />
      ) : null}
      {createError ? <ErrorBanner error={createError} className="workspace-bar__error" /> : null}
    </div>
  );
}
