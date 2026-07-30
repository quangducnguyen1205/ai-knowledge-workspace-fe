import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../../../shared/api/api-error';
import {
  getAssetStatus,
  getAssetTranscript,
  indexAssetTranscript,
  retryAssetProcessing,
} from '../api/assets-api';
import { assetKeys } from './asset-queries';
import { searchKeys } from '../../search/model/search-keys';
import {
  canLoadTranscript,
  deriveAssetStatus,
  getIndexActionState,
  shouldPollAssetStatus,
} from '../model/lifecycle';
import type { AssetRecordResponse, AssetStatusResponse, AssetSummary } from '../model/types';

export const ASSET_LIFECYCLE_POLL_INTERVAL_MS = 3_000;

export function useAssetLifecycle({
  asset,
  workspaceId,
}: {
  asset: AssetSummary | null;
  workspaceId: string | null;
}) {
  const queryClient = useQueryClient();
  const assetId = asset?.assetId ?? null;
  const [statusPollingEnabled, setStatusPollingEnabled] = useState(false);
  const retryPendingRef = useRef(false);

  useEffect(() => {
    setStatusPollingEnabled(Boolean(assetId) && shouldPollAssetStatus(asset?.assetStatus));
  }, [asset?.assetStatus, assetId]);

  const statusQuery = useQuery({
    queryKey: assetId ? assetKeys.status(assetId) : ['assets', 'status', 'empty'],
    queryFn: ({ signal }) => getAssetStatus(assetId as string, signal),
    enabled: Boolean(assetId),
    refetchInterval: statusPollingEnabled ? ASSET_LIFECYCLE_POLL_INTERVAL_MS : false,
  });

  useEffect(() => {
    if (!workspaceId || !statusQuery.data) {
      return;
    }

    const observedAssetStatus = statusQuery.data.assetStatus;
    if (asset?.assetStatus !== observedAssetStatus) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: assetKeys.list(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: searchKeys.all }),
      ]);
    }

    setStatusPollingEnabled(shouldPollAssetStatus(observedAssetStatus));
  }, [asset?.assetStatus, queryClient, statusQuery.data, workspaceId]);

  const transcriptEnabled =
    Boolean(assetId) &&
    asset?.assetStatus !== 'FAILED' &&
    canLoadTranscript(asset?.assetStatus ?? null, statusQuery.data?.processingJobStatus);
  const transcriptQuery = useQuery({
    queryKey: assetId ? assetKeys.transcript(assetId) : ['assets', 'transcript', 'empty'],
    queryFn: ({ signal }) => getAssetTranscript(assetId as string, signal),
    enabled: transcriptEnabled,
    retry: false,
  });

  useEffect(() => {
    if (transcriptQuery.isSuccess && workspaceId) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(workspaceId) });
    }
  }, [queryClient, transcriptQuery.dataUpdatedAt, transcriptQuery.isSuccess, workspaceId]);

  useEffect(() => {
    if (
      transcriptQuery.error instanceof ApiClientError &&
      transcriptQuery.error.status === 409 &&
      workspaceId &&
      assetId
    ) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: assetKeys.status(assetId) });
    }
  }, [assetId, queryClient, transcriptQuery.error, workspaceId]);

  const indexMutation = useMutation({
    mutationFn: indexAssetTranscript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assetKeys.all });
    },
  });

  useEffect(() => indexMutation.reset(), [assetId, indexMutation.reset]);

  const retryMutation = useMutation({
    mutationFn: retryAssetProcessing,
    onSuccess: async (response) => {
      setStatusPollingEnabled(true);
      queryClient.setQueryData<AssetSummary[] | undefined>(
        assetKeys.list(response.workspaceId),
        (current) => current?.map((item) => item.assetId === response.assetId
          ? {
              ...item,
              assetStatus: response.assetStatus,
              sourceType: response.sourceType,
              youtubeVideoId: response.youtubeVideoId,
              sourceUrl: response.sourceUrl,
            }
          : item),
      );
      queryClient.setQueryData<AssetRecordResponse | undefined>(
        assetKeys.detail(response.assetId),
        (current) => current
          ? {
              ...current,
              status: response.assetStatus,
              sourceType: response.sourceType,
              youtubeVideoId: response.youtubeVideoId,
              sourceUrl: response.sourceUrl,
            }
          : current,
      );
      queryClient.setQueryData<AssetStatusResponse | undefined>(
        assetKeys.status(response.assetId),
        (current) => current
          ? {
              ...current,
              processingJobId: response.processingJobId,
              assetStatus: response.assetStatus,
              processingJobStatus: 'PENDING',
              failureCode: null,
            }
          : current,
      );
      queryClient.removeQueries({ queryKey: assetKeys.transcript(response.assetId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) }),
        queryClient.invalidateQueries({ queryKey: assetKeys.detail(response.assetId) }),
        queryClient.invalidateQueries({ queryKey: assetKeys.status(response.assetId) }),
      ]);
    },
    onError: async (error) => {
      if (
        error instanceof ApiClientError &&
        error.code === 'ASSET_PROCESSING_RETRY_NOT_ALLOWED' &&
        assetId
      ) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: workspaceId ? assetKeys.list(workspaceId) : assetKeys.all }),
          queryClient.invalidateQueries({ queryKey: assetKeys.detail(assetId) }),
          queryClient.invalidateQueries({ queryKey: assetKeys.status(assetId) }),
        ]);
      }
    },
    onSettled: () => {
      retryPendingRef.current = false;
    },
  });

  useEffect(() => {
    retryPendingRef.current = false;
    retryMutation.reset();
  }, [assetId, retryMutation.reset]);

  const resolvedAssetStatus = useMemo(
    () => deriveAssetStatus(
      asset,
      statusQuery.data,
      transcriptQuery.data,
      indexMutation.data?.assetId === assetId ? indexMutation.data : undefined,
    ),
    [asset, assetId, indexMutation.data, statusQuery.data, transcriptQuery.data],
  );

  const indexActionState = getIndexActionState({
    resolvedAssetStatus,
    processingJobStatus: statusQuery.data?.processingJobStatus,
    transcriptRows: transcriptQuery.data,
    transcriptError: transcriptQuery.error,
  });

  const runRecoveryIndexing = useCallback(() => {
    if (!assetId) {
      return;
    }

    indexMutation.mutate(assetId, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: workspaceId ? assetKeys.list(workspaceId) : assetKeys.all }),
          queryClient.invalidateQueries({ queryKey: searchKeys.all }),
        ]);
      },
    });
  }, [assetId, indexMutation, queryClient, workspaceId]);

  const runProcessingRetry = useCallback(() => {
    if (!assetId || resolvedAssetStatus !== 'FAILED' || retryPendingRef.current) {
      return;
    }

    retryPendingRef.current = true;
    retryMutation.mutate(assetId);
  }, [assetId, resolvedAssetStatus, retryMutation]);

  const refresh = useCallback(async () => {
    const requests: Array<Promise<unknown>> = [statusQuery.refetch()];
    if (transcriptEnabled) {
      requests.push(transcriptQuery.refetch());
    }
    await Promise.all(requests);
  }, [statusQuery, transcriptEnabled, transcriptQuery]);

  return {
    resolvedAssetStatus,
    statusResponse: statusQuery.data,
    statusError: statusQuery.error,
    transcriptRows: transcriptQuery.data,
    transcriptError: transcriptQuery.error,
    transcriptLoading: transcriptQuery.isLoading || transcriptQuery.isFetching,
    indexError: indexMutation.error,
    indexResponse: indexMutation.data?.assetId === assetId ? indexMutation.data : undefined,
    isIndexing: indexMutation.isPending,
    resetIndexing: indexMutation.reset,
    runRecoveryIndexing,
    retryError: retryMutation.error,
    isRetrying: retryMutation.isPending,
    runProcessingRetry,
    refresh,
    isProcessing: resolvedAssetStatus === 'PROCESSING',
    isTranscriptReady: resolvedAssetStatus === 'TRANSCRIPT_READY',
    isSearchable: resolvedAssetStatus === 'SEARCHABLE',
    isTerminalFailure: resolvedAssetStatus === 'FAILED',
    canRetryProcessing: resolvedAssetStatus === 'FAILED',
    shouldPoll: statusPollingEnabled,
    canUseSearch: resolvedAssetStatus === 'SEARCHABLE',
    canUseAssistant: resolvedAssetStatus === 'SEARCHABLE',
    canRunRecoveryIndexing: Boolean(indexActionState?.canIndex),
  };
}
