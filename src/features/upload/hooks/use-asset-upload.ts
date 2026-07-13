import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetKeys } from '../../assets/hooks/asset-queries';
import { uploadAsset, type AssetUploadResponse, type UploadAssetInput } from '../api/upload-api';

export function useAssetUpload({
  workspaceId,
  onUploaded,
}: {
  workspaceId: string | null;
  onUploaded: (response: AssetUploadResponse, input: UploadAssetInput) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: uploadAsset,
    onSuccess: async (response, input) => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
      onUploaded(response, input);
    },
  });

  useEffect(() => mutation.reset(), [mutation.reset, workspaceId]);

  return {
    submit: (input: { file: File; title?: string }) => {
      if (!workspaceId) return;
      mutation.mutate({ workspaceId, file: input.file, title: input.title });
    },
    error: mutation.error,
    isUploading: mutation.isPending,
    uploadedAssetId: mutation.data?.assetId,
    reset: mutation.reset,
  };
}
