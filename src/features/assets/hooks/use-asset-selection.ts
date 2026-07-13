import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAssetsQuery } from './asset-queries';

export function useAssetSelection({
  workspaceId,
  routedAssetId,
  startTransition,
}: {
  workspaceId: string | null;
  routedAssetId: string | null;
  startTransition: (callback: () => void) => void;
}) {
  const assetsQuery = useAssetsQuery(workspaceId);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [preferredAssetId, setPreferredAssetId] = useState<string | null>(null);
  const selectedAssetIdRef = useRef<string | null>(null);
  const preferredAssetIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedAssetId(null);
    setPreferredAssetId(null);
  }, [workspaceId]);

  useEffect(() => {
    selectedAssetIdRef.current = selectedAssetId;
  }, [selectedAssetId]);

  useEffect(() => {
    preferredAssetIdRef.current = preferredAssetId;
  }, [preferredAssetId]);

  useEffect(() => {
    if (
      routedAssetId &&
      routedAssetId !== selectedAssetIdRef.current &&
      routedAssetId !== preferredAssetIdRef.current
    ) {
      setPreferredAssetId(routedAssetId);
    }
  }, [routedAssetId]);

  useEffect(() => {
    const assets = assetsQuery.data ?? [];

    if (preferredAssetId) {
      const preferredAsset = assets.find((asset) => asset.assetId === preferredAssetId);
      if (preferredAsset) {
        startTransition(() => setSelectedAssetId(preferredAsset.assetId));
        setPreferredAssetId(null);
        return;
      }

      if (assetsQuery.isFetching) {
        return;
      }
    }

    if (!assets.length) {
      setSelectedAssetId(null);
      return;
    }

    if (selectedAssetId && assets.some((asset) => asset.assetId === selectedAssetId)) {
      return;
    }

    startTransition(() => setSelectedAssetId(assets[0].assetId));
  }, [assetsQuery.data, assetsQuery.isFetching, preferredAssetId, selectedAssetId, startTransition]);

  const selectedAsset = useMemo(
    () => assetsQuery.data?.find((asset) => asset.assetId === selectedAssetId) ?? null,
    [assetsQuery.data, selectedAssetId],
  );

  const selectAsset = useCallback((assetId: string) => {
    if (!assetId) {
      return;
    }
    setPreferredAssetId(assetId);
    startTransition(() => setSelectedAssetId(assetId));
  }, [startTransition]);

  const clearSelection = useCallback(() => {
    setSelectedAssetId(null);
    setPreferredAssetId(null);
  }, []);

  return {
    assetsQuery,
    selectedAsset,
    selectedAssetId,
    selectedAssetIdRef,
    preferredAssetIdRef,
    setSelectedAssetId,
    setPreferredAssetId,
    selectAsset,
    clearSelection,
  };
}
