import { request } from '../../../shared/api/http-client';

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export type UpdateWorkspaceNameInput = {
  workspaceId: string;
  name: string;
};

export async function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/workspaces');
}

export async function createWorkspace(name: string): Promise<Workspace> {
  return request<Workspace>('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function updateWorkspaceName(input: UpdateWorkspaceNameInput): Promise<Workspace> {
  return request<Workspace>(`/api/workspaces/${input.workspaceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name }),
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await request<void>(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
}
