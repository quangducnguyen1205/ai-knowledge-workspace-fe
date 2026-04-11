import { useEffect, useMemo, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type AssetStatus, type SearchResult } from '../lib/api';
import { EmptyState, ErrorBanner, LoadingBlock } from '../lib/ui';
import {
  AssetsPanel,
  SelectedAssetPanel,
  assetKeys,
  deriveAssetStatus,
  isTerminalProcessing,
  useAssetStatusQuery,
  useAssetTranscriptQuery,
  useAssetsQuery,
  useIndexAssetMutation,
  useUploadAssetMutation,
} from '../features/assets/assets';
import {
  SearchPanel,
  resolveTranscriptLookupId,
  searchKeys,
  useSearchQuery,
  useTranscriptContextQuery,
} from '../features/search/search';
import {
  WorkspaceBar,
  useCreateWorkspaceMutation,
  useWorkspacesQuery,
} from '../features/workspaces/workspaces';

function canLoadTranscript(assetStatus: AssetStatus | null, processingJobStatus?: string): boolean {
  return (
    assetStatus === 'TRANSCRIPT_READY' ||
    assetStatus === 'SEARCHABLE' ||
    processingJobStatus === 'SUCCEEDED'
  );
}

export function AppShell() {
  const queryClient = useQueryClient();
  const [isTransitionPending, startTransition] = useTransition();

  const workspacesQuery = useWorkspacesQuery();
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const workspaces = workspacesQuery.data ?? [];
    if (!workspaces.length) {
      return;
    }

    if (preferredWorkspaceId) {
      const preferredWorkspace = workspaces.find((workspace) => workspace.id === preferredWorkspaceId);
      if (preferredWorkspace) {
        startTransition(() => setSelectedWorkspaceId(preferredWorkspaceId));
        setPreferredWorkspaceId(null);
        return;
      }
    }

    if (selectedWorkspaceId && workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      return;
    }

    startTransition(() => setSelectedWorkspaceId(workspaces[0].id));
  }, [preferredWorkspaceId, selectedWorkspaceId, startTransition, workspacesQuery.data]);

  const selectedWorkspace = useMemo(
    () => workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspacesQuery.data],
  );

  const assetsQuery = useAssetsQuery(selectedWorkspaceId);
  const uploadMutation = useUploadAssetMutation();
  const indexMutation = useIndexAssetMutation();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [preferredAssetId, setPreferredAssetId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAssetId(null);
    setPreferredAssetId(null);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    const assets = assetsQuery.data ?? [];

    if (preferredAssetId) {
      const preferredAsset = assets.find((asset) => asset.assetId === preferredAssetId);
      if (preferredAsset) {
        startTransition(() => setSelectedAssetId(preferredAssetId));
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

  const [statusPollingEnabled, setStatusPollingEnabled] = useState(false);

  useEffect(() => {
    setStatusPollingEnabled(Boolean(selectedAssetId) && selectedAsset?.assetStatus === 'PROCESSING');
  }, [selectedAsset?.assetStatus, selectedAssetId]);

  useEffect(() => {
    indexMutation.reset();
  }, [indexMutation.reset, selectedAssetId]);

  const assetStatusQuery = useAssetStatusQuery(selectedAssetId, statusPollingEnabled);

  useEffect(() => {
    if (!selectedWorkspaceId || !assetStatusQuery.data) {
      return;
    }

    if (selectedAsset?.assetStatus !== assetStatusQuery.data.assetStatus) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
    }

    if (isTerminalProcessing(assetStatusQuery.data.processingJobStatus)) {
      setStatusPollingEnabled(false);
    }
  }, [assetStatusQuery.data, queryClient, selectedAsset?.assetStatus, selectedWorkspaceId]);

  const transcriptQuery = useAssetTranscriptQuery(
    selectedAssetId,
    Boolean(selectedAssetId) &&
      selectedAsset?.assetStatus !== 'FAILED' &&
      canLoadTranscript(selectedAsset?.assetStatus ?? null, assetStatusQuery.data?.processingJobStatus),
  );

  useEffect(() => {
    if (transcriptQuery.isSuccess && selectedWorkspaceId) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
    }
  }, [queryClient, selectedWorkspaceId, transcriptQuery.dataUpdatedAt, transcriptQuery.isSuccess]);

  useEffect(() => {
    if (
      transcriptQuery.error instanceof ApiClientError &&
      transcriptQuery.error.status === 409 &&
      selectedWorkspaceId &&
      selectedAssetId
    ) {
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(selectedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: assetKeys.status(selectedAssetId) });
    }
  }, [queryClient, selectedAssetId, selectedWorkspaceId, transcriptQuery.error]);

  const resolvedAssetStatus = useMemo(
    () =>
      deriveAssetStatus(
        selectedAsset,
        assetStatusQuery.data,
        transcriptQuery.data,
        indexMutation.data?.assetId === selectedAssetId ? indexMutation.data : undefined,
      ),
    [assetStatusQuery.data, indexMutation.data, selectedAsset, selectedAssetId, transcriptQuery.data],
  );

  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
  }, [selectedWorkspaceId]);

  const searchQuery = useSearchQuery(
    submittedSearch && selectedWorkspaceId ? { query: submittedSearch, workspaceId: selectedWorkspaceId } : null,
  );

  const contextLookupId = selectedSearchResult ? resolveTranscriptLookupId(selectedSearchResult) : null;

  const contextQuery = useTranscriptContextQuery(
    selectedSearchResult && contextLookupId
      ? {
          assetId: selectedSearchResult.assetId,
          transcriptRowId: contextLookupId,
          window: 2,
        }
      : null,
  );

  function handleCreateWorkspace(name: string) {
    createWorkspaceMutation.mutate(name, {
      onSuccess: (workspace) => {
        setPreferredWorkspaceId(workspace.id);
      },
    });
  }

  function handleSelectWorkspace(workspaceId: string) {
    setPreferredWorkspaceId(null);
    setPreferredAssetId(null);
    startTransition(() => setSelectedWorkspaceId(workspaceId));
  }

  function handleUpload(input: { file: File; title?: string }) {
    if (!selectedWorkspaceId) {
      return;
    }

    uploadMutation.mutate(
      {
        workspaceId: selectedWorkspaceId,
        file: input.file,
        title: input.title,
      },
      {
        onSuccess: (response) => {
          setPreferredAssetId(response.assetId);
          setStatusPollingEnabled(true);
          void queryClient.invalidateQueries({ queryKey: assetKeys.list(response.workspaceId) });
        },
      },
    );
  }

  function handleIndexAsset() {
    if (!selectedAssetId) {
      return;
    }

    indexMutation.mutate(selectedAssetId, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: selectedWorkspaceId ? assetKeys.list(selectedWorkspaceId) : assetKeys.all,
          }),
          queryClient.invalidateQueries({ queryKey: searchKeys.all }),
        ]);
      },
    });
  }

  if (workspacesQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Loading workspaces..." />
      </div>
    );
  }

  if (workspacesQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorBanner error={workspacesQuery.error} />
      </div>
    );
  }

  if (!selectedWorkspace) {
    return (
      <div className="app-shell app-shell--centered">
        <EmptyState
          title="No workspace scope yet"
          description="Create a workspace to start the upload -> transcript -> index -> search demo."
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">AI Knowledge Workspace</p>
          <h1>Spring-owned transcript recovery demo</h1>
          <p>
            One page, three panels, explicit indexing, and a separate transcript-context follow-up view. The UI always
            keeps the active workspace visible so the backend scope stays obvious.
          </p>
        </div>

        <WorkspaceBar
          workspaces={workspacesQuery.data ?? []}
          selectedWorkspaceId={selectedWorkspaceId}
          isLoading={workspacesQuery.isLoading || isTransitionPending}
          createError={createWorkspaceMutation.error}
          createSuccessId={createWorkspaceMutation.data?.id}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          isCreating={createWorkspaceMutation.isPending}
        />
      </header>

      <main className="workspace-grid">
        <AssetsPanel
          workspaceName={selectedWorkspace.name}
          assets={assetsQuery.data ?? []}
          selectedAssetId={selectedAssetId}
          assetsError={assetsQuery.error}
          assetsLoading={assetsQuery.isLoading}
          uploadError={uploadMutation.error}
          uploadSuccessId={uploadMutation.data?.assetId}
          isUploading={uploadMutation.isPending}
          onSelectAsset={setSelectedAssetId}
          onUpload={handleUpload}
        />

        <SelectedAssetPanel
          asset={selectedAsset}
          workspaceName={selectedWorkspace.name}
          resolvedAssetStatus={resolvedAssetStatus}
          statusResponse={assetStatusQuery.data}
          statusError={assetStatusQuery.error}
          transcriptRows={transcriptQuery.data}
          transcriptError={transcriptQuery.error}
          transcriptLoading={transcriptQuery.isLoading || transcriptQuery.isFetching}
          indexError={indexMutation.error}
          indexResponse={indexMutation.data?.assetId === selectedAssetId ? indexMutation.data : undefined}
          isIndexing={indexMutation.isPending}
          onIndex={handleIndexAsset}
        />

        <SearchPanel
          workspaceName={selectedWorkspace.name}
          activeQuery={submittedSearch}
          searchResponse={searchQuery.data}
          searchError={searchQuery.error}
          isSearching={searchQuery.isLoading || searchQuery.isFetching}
          contextResponse={contextQuery.data}
          contextError={contextQuery.error}
          isContextLoading={contextQuery.isLoading || contextQuery.isFetching}
          selectedResult={selectedSearchResult}
          onSearch={(query) => {
            setSubmittedSearch(query);
            setSelectedSearchResult(null);
          }}
          onSelectResult={setSelectedSearchResult}
        />
      </main>
    </div>
  );
}
