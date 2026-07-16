import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceManagement } from './use-workspace-management';

const activeWorkspace = { id: 'workspace-1', name: 'Active workspace', createdAt: '2026-01-01T00:00:00Z' };
const otherWorkspace = { id: 'workspace-2', name: 'Other workspace', createdAt: '2026-01-02T00:00:00Z' };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderManagement(selectedWorkspaceId = activeWorkspace.id) {
  const onClearWorkspaceScope = vi.fn();
  const onDeletedWorkspaceRoute = vi.fn();
  const setWorkspaceScopeRefreshAfter = vi.fn();
  const setPreferredWorkspaceId = vi.fn();

  const hook = renderHook(
    () => useWorkspaceManagement({
      noticeContextKey: `user-1:${selectedWorkspaceId}:settings`,
      selectedWorkspaceId,
      setPreferredWorkspaceId,
      setWorkspaceScopeRefreshAfter,
      onClearWorkspaceScope,
      onDeletedWorkspaceRoute,
    }),
    { wrapper: createWrapper() },
  );

  return { ...hook, onClearWorkspaceScope, onDeletedWorkspaceRoute, setWorkspaceScopeRefreshAfter };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useWorkspaceManagement deletion', () => {
  it('clears active workspace scope and routes to a safe screen only after deletion succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const management = renderManagement();

    act(() => management.result.current.deleteWorkspace(activeWorkspace));

    await waitFor(() => expect(management.onClearWorkspaceScope).toHaveBeenCalledWith(activeWorkspace.id));
    expect(management.setWorkspaceScopeRefreshAfter).toHaveBeenCalledTimes(1);
    expect(management.onDeletedWorkspaceRoute).toHaveBeenCalledTimes(1);
  });

  it('preserves the active workspace scope when deleting a different workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const management = renderManagement();

    act(() => management.result.current.deleteWorkspace(otherWorkspace));

    await waitFor(() => expect(management.result.current.successNotice?.title).toBe('Workspace deleted'));
    expect(management.onClearWorkspaceScope).not.toHaveBeenCalled();
    expect(management.setWorkspaceScopeRefreshAfter).not.toHaveBeenCalled();
    expect(management.onDeletedWorkspaceRoute).not.toHaveBeenCalled();
  });

  it('keeps the workspace scope in place when a deletion conflict is returned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 'WORKSPACE_NOT_EMPTY',
      message: 'Workspace still has assets',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    const management = renderManagement();

    act(() => management.result.current.deleteWorkspace(activeWorkspace));

    await waitFor(() => expect(management.result.current.deleteError).toBeTruthy());
    expect(management.onClearWorkspaceScope).not.toHaveBeenCalled();
    expect(management.onDeletedWorkspaceRoute).not.toHaveBeenCalled();
  });
});
