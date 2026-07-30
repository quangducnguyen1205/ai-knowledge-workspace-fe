import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSavedMoments,
  removeSavedMoment,
  saveMoment,
  type SavedMoment,
  type SavedMomentListResponse,
  type SaveMomentInput,
} from '../api/saved-moments-api';

/**
 * Saved moments are Workspace-scoped product state. The Workspace ID is part of every cache key,
 * so switching Workspace can never render the previous Workspace's saved moments.
 */
export const savedMomentKeys = {
  all: ['saved-moments'] as const,
  list: (workspaceId: string) => ['saved-moments', 'list', workspaceId] as const,
};

export function buildSavedMomentKey(assetId: string, transcriptRowId: string): string {
  return `${assetId}::${transcriptRowId}`;
}

export function useSavedMoments(workspaceId: string | null) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: workspaceId ? savedMomentKeys.list(workspaceId) : ['saved-moments', 'list', 'none'],
    queryFn: ({ signal }) => listSavedMoments(workspaceId ?? '', signal),
    enabled: Boolean(workspaceId),
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const savedKeys = useMemo(
    () => new Set(items.map((item) => buildSavedMomentKey(item.assetId, item.transcriptRowId))),
    [items],
  );

  function invalidate() {
    if (workspaceId) {
      void queryClient.invalidateQueries({ queryKey: savedMomentKeys.list(workspaceId) });
    }
  }

  const saveMutation = useMutation({
    mutationFn: (input: SaveMomentInput) => saveMoment(input),
    onSuccess: (saved: SavedMoment) => {
      if (!workspaceId || saved.workspaceId !== workspaceId) {
        invalidate();
        return;
      }

      queryClient.setQueryData<SavedMomentListResponse>(
        savedMomentKeys.list(workspaceId),
        (current) => {
          if (!current) return current;
          const withoutDuplicate = current.items.filter(
            (item) => item.savedMomentId !== saved.savedMomentId,
          );
          if (withoutDuplicate.length === current.items.length) {
            const items = [saved, ...withoutDuplicate].slice(0, current.maxItems);
            return { ...current, items, savedMomentCount: items.length };
          }
          const items = [saved, ...withoutDuplicate];
          return { ...current, items, savedMomentCount: items.length };
        },
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (savedMomentId: string) => removeSavedMoment(savedMomentId),
    onSuccess: (_result, savedMomentId) => {
      if (!workspaceId) return;
      queryClient.setQueryData<SavedMomentListResponse>(
        savedMomentKeys.list(workspaceId),
        (current) => {
          if (!current) return current;
          const items = current.items.filter((item) => item.savedMomentId !== savedMomentId);
          return { ...current, items, savedMomentCount: items.length };
        },
      );
    },
  });

  const isSaved = useCallback(
    (assetId: string, transcriptRowId: string | null) =>
      Boolean(transcriptRowId) && savedKeys.has(buildSavedMomentKey(assetId, transcriptRowId ?? '')),
    [savedKeys],
  );

  return {
    items,
    maxItems: listQuery.data?.maxItems ?? null,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    isSaved,
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
    savingKey: saveMutation.isPending && saveMutation.variables
      ? buildSavedMomentKey(saveMutation.variables.assetId, saveMutation.variables.transcriptRowId)
      : null,
    remove: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    removingId: removeMutation.isPending ? (removeMutation.variables ?? null) : null,
    removeError: removeMutation.error,
  };
}
