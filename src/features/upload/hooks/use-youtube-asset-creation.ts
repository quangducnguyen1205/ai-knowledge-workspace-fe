import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetKeys } from '../../assets/hooks/asset-queries';
import type { AssetProcessingResponse } from '../../assets/model/types';
import {
  createYouTubeAsset,
  type CreateYouTubeAssetInput,
} from '../api/upload-api';

export function useYouTubeAssetCreation({
  workspaceId,
  onCreated,
}: {
  workspaceId: string | null;
  onCreated: (response: AssetProcessingResponse, input: CreateYouTubeAssetInput) => void;
}) {
  const queryClient = useQueryClient();
  const submissionPendingRef = useRef(false);
  const mutation = useMutation({
    mutationFn: createYouTubeAsset,
    onSuccess: async (response, input) => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
      onCreated(response, input);
    },
    onSettled: () => {
      submissionPendingRef.current = false;
    },
  });

  useEffect(() => {
    submissionPendingRef.current = false;
    mutation.reset();
  }, [mutation.reset, workspaceId]);

  return {
    submit: (input: { url: string; title?: string }) => {
      if (!workspaceId || submissionPendingRef.current) return;
      submissionPendingRef.current = true;
      mutation.mutate({ workspaceId, url: input.url, title: input.title });
    },
    error: mutation.error,
    isCreating: mutation.isPending,
    createdAssetId: mutation.data?.assetId,
    reset: mutation.reset,
  };
}
