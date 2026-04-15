import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiClientError,
  backendDisplayUrl,
  createAuthSession,
  createWorkspace,
  listWorkspaces,
  usingProxy,
  type Workspace,
} from '../../lib/api';
import { Button, ErrorBanner, formatDateTime } from '../../lib/ui';

export const workspaceKeys = {
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

export function useAuthSessionMutation() {
  return useMutation({
    mutationFn: createAuthSession,
  });
}

type FriendlySessionErrorCopy = {
  title: string;
  message: string;
  detail?: string;
};

function getFriendlySessionErrorCopy(error: unknown): FriendlySessionErrorCopy | null {
  if (!(error instanceof ApiClientError)) {
    return null;
  }

  if (error.status === 400 && error.code === 'INVALID_CURRENT_USER_ID') {
    return {
      title: 'Current user was rejected',
      message: 'Use a non-empty current user ID that fits within the backend length limit, then try switching again.',
      detail: `Backend detail: ${error.code}`,
    };
  }

  if (error.status === 0) {
    return {
      title: 'Current user could not reach Spring',
      message: 'The frontend could not contact the Spring backend, so the visible workspace scope did not change.',
    };
  }

  return {
    title: 'Current user update failed',
    message: 'Spring did not confirm the current user switch, so the existing visible scope stays in place.',
    detail: error.code ? `Backend detail: ${error.code} - ${error.message}` : `Backend detail: ${error.message}`,
  };
}

export function WorkspaceBar({
  workspaces,
  selectedWorkspace,
  selectedWorkspaceId,
  isLoading,
  activeUserId,
  pendingUserId,
  sessionError,
  sessionSuccessUserId,
  createError,
  createSuccessId,
  onSelectWorkspace,
  onSetCurrentUser,
  onCreateWorkspace,
  isSettingCurrentUser,
  isCreating,
}: {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  activeUserId: string | null;
  pendingUserId: string | null;
  sessionError: unknown;
  sessionSuccessUserId?: string;
  createError: unknown;
  createSuccessId?: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onSetCurrentUser: (userId: string) => void;
  onCreateWorkspace: (name: string) => void;
  isSettingCurrentUser: boolean;
  isCreating: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState('');
  const [userId, setUserId] = useState('');
  const sessionErrorCopy = getFriendlySessionErrorCopy(sessionError);

  useEffect(() => {
    if (createSuccessId) {
      setWorkspaceName('');
    }
  }, [createSuccessId]);

  useEffect(() => {
    if (sessionSuccessUserId) {
      setUserId(sessionSuccessUserId);
    }
  }, [sessionSuccessUserId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = workspaceName.trim();

    if (!trimmedName) {
      return;
    }

    onCreateWorkspace(trimmedName);
  }

  function handleSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUserId = userId.trim();

    if (!trimmedUserId) {
      return;
    }

    onSetCurrentUser(trimmedUserId);
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
            <span>
              Current user:{' '}
              {pendingUserId ? `switching to ${pendingUserId}` : activeUserId ?? 'using backend fallback scope'}
            </span>
          </div>
        </div>

        <div className="workspace-bar__pills">
          <div className="pill">
            <span className="pill__label">Current user</span>
            <span className="pill__value">
              {pendingUserId ? `Switching to ${pendingUserId}...` : activeUserId ?? 'Backend fallback'}
            </span>
          </div>

          <div className="pill">
            <span className="pill__label">Backend</span>
            <span className="pill__value">{usingProxy ? `proxy -> ${backendDisplayUrl}` : backendDisplayUrl}</span>
          </div>
        </div>
      </div>

      <div className="workspace-bar__cluster">
        <form className="workspace-session" onSubmit={handleSessionSubmit}>
          <label className="field field--grow">
            <span className="field__label">Current user</span>
            <input
              className="field__input"
              type="text"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="student-a, demo-owner, reviewer-1..."
              maxLength={255}
            />
            <span className="field__hint">
              Calls <code>POST /api/auth/session</code>, then refreshes visible workspace and asset scope.
            </span>
          </label>
          <Button type="submit" tone="ghost" disabled={isSettingCurrentUser || !userId.trim()}>
            {isSettingCurrentUser ? 'Switching...' : activeUserId ? 'Switch user' : 'Set user'}
          </Button>
        </form>

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

      {sessionError ? (
        <ErrorBanner
          error={sessionError}
          className="workspace-bar__error"
          title={sessionErrorCopy?.title}
          message={sessionErrorCopy?.message}
          detail={sessionErrorCopy?.detail}
        />
      ) : null}
      {createError ? <ErrorBanner error={createError} className="workspace-bar__error" /> : null}
    </div>
  );
}
