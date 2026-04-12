import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendDisplayUrl, createWorkspace, listWorkspaces, usingProxy, type Workspace } from '../../lib/api';
import { Button, ErrorBanner, formatDateTime } from '../../lib/ui';

const workspaceKeys = {
  all: ['workspaces'] as const,
};

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: listWorkspaces,
    staleTime: 60_000,
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
  createSuccessId,
  onSelectWorkspace,
  onCreateWorkspace,
  isCreating,
}: {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  createError: unknown;
  createSuccessId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  isCreating: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState('');

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
        <div className={`workspace-focus ${isLoading ? 'workspace-focus--busy' : ''}`}>
          <span className="workspace-focus__eyebrow">Active workspace</span>
          <div className="workspace-focus__main">
            <strong>{selectedWorkspace?.name ?? 'Loading workspace...'}</strong>
            <span>
              {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'} available
            </span>
          </div>
          <div className="workspace-focus__meta">
            <span>
              {selectedWorkspace ? `Created ${formatDateTime(selectedWorkspace.createdAt)}` : 'Waiting for workspace data'}
            </span>
            <span>{isLoading ? 'Refreshing workspace scope...' : 'Assets and search are scoped here'}</span>
          </div>
        </div>

        <div className="pill">
          <span className="pill__label">Backend</span>
          <span className="pill__value">{usingProxy ? `proxy -> ${backendDisplayUrl}` : backendDisplayUrl}</span>
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
          <span className="field__hint">Switching workspace refreshes asset listing and search scope.</span>
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
            <span className="field__hint">New workspaces become easy demo scopes for upload and search.</span>
          </label>
          <Button type="submit" tone="secondary" disabled={isCreating || !workspaceName.trim()}>
            {isCreating ? 'Creating...' : 'Add workspace'}
          </Button>
        </form>
      </div>

      {createError ? <ErrorBanner error={createError} className="workspace-bar__error" /> : null}
    </div>
  );
}
