import { request } from '../../../shared/api/http-client';

export type AuthSessionResponse = {
  userId: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthCredentialsInput = {
  email: string;
  password: string;
};

export async function createAuthSession(userId: string): Promise<AuthSessionResponse> {
  return request<AuthSessionResponse>('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}

export async function registerUser(input: AuthCredentialsInput): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: AuthCredentialsInput): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function logoutUser(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/api/me');
}
