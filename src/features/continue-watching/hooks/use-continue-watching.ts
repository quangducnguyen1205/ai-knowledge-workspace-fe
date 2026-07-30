import { useQuery } from '@tanstack/react-query';
import { listContinueWatching } from '../api/continue-watching-api';

/**
 * Continue watching is Workspace-scoped product state. The Workspace ID is part of the cache key,
 * so switching Workspace can never render the previous Workspace's items.
 */
export const continueWatchingKeys = {
  all: ['continue-watching'] as const,
  list: (workspaceId: string) => ['continue-watching', workspaceId] as const,
};

export function useContinueWatching(workspaceId: string | null) {
  const query = useQuery({
    queryKey: workspaceId ? continueWatchingKeys.list(workspaceId) : ['continue-watching', 'none'],
    queryFn: ({ signal }) => listContinueWatching(workspaceId ?? '', signal),
    enabled: Boolean(workspaceId),
  });

  return {
    items: query.data?.items ?? [],
    maxItems: query.data?.maxItems ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
