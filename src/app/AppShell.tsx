import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type AssetStatus, type AssetSummary, type SearchResponse, type SearchResult } from '../lib/api';
import { EmptyState, ErrorBanner, InfoBanner, LoadingBlock } from '../lib/ui';
import {
  AssetsPanel,
  SelectedAssetPanel,
  assetKeys,
  deriveAssetStatus,
  isTerminalProcessing,
  useDeleteAssetMutation,
  useRenameAssetMutation,
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

const goldenPathSteps = [
  'Choose workspace',
  'Upload asset',
  'Wait for processing',
  'Review transcript',
  'Index explicitly',
  'Search workspace',
  'Open context',
] as const;

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
  const deleteMutation = useDeleteAssetMutation();
  const renameMutation = useRenameAssetMutation();

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [preferredAssetId, setPreferredAssetId] = useState<string | null>(null);
  const selectedAssetIdRef = useRef<string | null>(null);
  const preferredAssetIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedAssetId(null);
    setPreferredAssetId(null);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    selectedAssetIdRef.current = selectedAssetId;
  }, [selectedAssetId]);

  useEffect(() => {
    preferredAssetIdRef.current = preferredAssetId;
  }, [preferredAssetId]);

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
  const displayAssets = useMemo(() => {
    const assets = assetsQuery.data ?? [];

    if (!selectedAssetId || !resolvedAssetStatus) {
      return assets;
    }

    return assets.map((asset) =>
      asset.assetId === selectedAssetId && asset.assetStatus !== resolvedAssetStatus
        ? { ...asset, assetStatus: resolvedAssetStatus }
        : asset,
    );
  }, [assetsQuery.data, resolvedAssetStatus, selectedAssetId]);
  const searchableAssetCount = useMemo(() => {
    return displayAssets.filter((asset) => asset.assetStatus === 'SEARCHABLE').length;
  }, [displayAssets]);

  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [searchResetToken, setSearchResetToken] = useState(0);
  const selectedSearchResultRef = useRef<SearchResult | null>(null);

  useEffect(() => {
    selectedSearchResultRef.current = selectedSearchResult;
  }, [selectedSearchResult]);

  useEffect(() => {
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    uploadMutation.reset();
  }, [selectedWorkspaceId, uploadMutation.reset]);

  useEffect(() => {
    if (!renameMutation.isPending && renameMutation.variables?.assetId !== selectedAssetId) {
      renameMutation.reset();
    }
  }, [renameMutation.isPending, renameMutation.reset, renameMutation.variables?.assetId, selectedAssetId]);

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

  useEffect(() => {
    const uploadedAssetId = uploadMutation.data?.assetId;

    if (!uploadedAssetId) {
      return;
    }

    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
  }, [uploadMutation.data?.assetId]);

  useEffect(() => {
    const indexedAssetId = indexMutation.data?.assetId;

    if (!indexedAssetId) {
      return;
    }

    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
  }, [indexMutation.data?.assetId]);

  useEffect(() => {
    const results = searchQuery.data?.results;

    if (!selectedSearchResult || !results) {
      return;
    }

    const stillPresent = results.some(
      (result) =>
        result.assetId === selectedSearchResult.assetId &&
        result.transcriptRowId === selectedSearchResult.transcriptRowId &&
        result.segmentIndex === selectedSearchResult.segmentIndex,
    );

    if (!stillPresent) {
      setSelectedSearchResult(null);
    }
  }, [searchQuery.data?.results, selectedSearchResult]);

  const heroGuide = useMemo(() => {
    if (uploadMutation.isPending) {
      return {
        title: 'Current step: upload in progress',
        message: `The selected file is being sent into ${selectedWorkspace?.name ?? 'the active workspace'}. Watch the left panel for the new asset, then keep following the status flow.`,
        tone: 'info' as const,
      };
    }

    if (!selectedAsset) {
      return {
        title: 'Current step: choose or upload an asset',
        message: `Start inside ${selectedWorkspace?.name ?? 'the active workspace'} by uploading a file or selecting an existing asset from the left panel.`,
        tone: 'info' as const,
      };
    }

    if (resolvedAssetStatus === 'PROCESSING') {
      return {
        title: 'Current step: wait for processing',
        message: 'The selected asset is still processing. Transcript rows and explicit indexing stay unavailable until Spring finishes this step.',
        tone: 'warning' as const,
      };
    }

    if (resolvedAssetStatus === 'FAILED') {
      return {
        title: 'Current step: switch assets or upload again',
        message: 'This asset is not usable for the demo path. Pick another asset in the workspace or upload a new file to continue.',
        tone: 'warning' as const,
      };
    }

    if (resolvedAssetStatus === 'TRANSCRIPT_READY') {
      return {
        title: 'Current step: run explicit indexing',
        message: 'Transcript rows are ready in the middle panel. Use the explicit indexing action there before searching the workspace.',
        tone: 'warning' as const,
      };
    }

    if (resolvedAssetStatus === 'SEARCHABLE' && !submittedSearch) {
      return {
        title: 'Current step: search the workspace',
        message: `At least one asset is searchable in ${selectedWorkspace?.name ?? 'the active workspace'}. Run a query in the right panel to continue the demo.`,
        tone: 'success' as const,
      };
    }

    if (searchQuery.isFetching) {
      return {
        title: 'Current step: searching transcript rows',
        message: 'Spring is searching indexed transcript rows inside the active workspace.',
        tone: 'info' as const,
      };
    }

    if (submittedSearch && !searchQuery.error && !searchQuery.data?.results.length) {
      return {
        title: 'Current step: refine the search query',
        message: 'The current query did not return any transcript hits in this workspace. Try a different term or pick another searchable asset.',
        tone: 'warning' as const,
      };
    }

    if (submittedSearch && searchQuery.data?.results.length && !selectedSearchResult) {
      return {
        title: 'Current step: open one result in context',
        message: 'Search results are ready in the right panel. Click one enabled result card to fetch its transcript context window.',
        tone: 'info' as const,
      };
    }

    if (selectedSearchResult && contextQuery.isFetching) {
      return {
        title: 'Current step: loading transcript context',
        message: 'Spring is fetching the surrounding transcript rows for the selected search result.',
        tone: 'info' as const,
      };
    }

    if (selectedSearchResult && contextQuery.data) {
      return {
        title: 'Current step: review transcript context',
        message: 'The right panel is showing the selected hit with nearby transcript rows. This completes the core demo path.',
        tone: 'success' as const,
      };
    }

    return {
      title: 'Current step: continue the golden path',
      message: 'Follow the panels from left to right: upload, wait for transcript readiness, index explicitly, then search and open one hit in context.',
      tone: 'info' as const,
    };
  }, [
    contextQuery.data,
    contextQuery.isFetching,
    resolvedAssetStatus,
    searchQuery.data?.results.length,
    searchQuery.error,
    searchQuery.isFetching,
    selectedAsset,
    selectedSearchResult,
    selectedWorkspace?.name,
    submittedSearch,
    uploadMutation.isPending,
  ]);

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

  function updateSearchResultTitles(assetId: string, title: string) {
    queryClient.setQueriesData<SearchResponse>({ queryKey: ['search', 'results'] }, (current) => {
      if (!current?.results?.length) {
        return current;
      }

      let didChange = false;
      const results = current.results.map((result) => {
        if (result.assetId !== assetId || result.assetTitle === title) {
          return result;
        }

        didChange = true;
        return { ...result, assetTitle: title };
      });

      return didChange ? { ...current, results } : current;
    });
  }

  function clearAssetDependentState(assetId: string) {
    if (selectedAssetIdRef.current === assetId) {
      setSelectedAssetId(null);
      setStatusPollingEnabled(false);
      queryClient.removeQueries({ queryKey: assetKeys.status(assetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(assetId) });
    }

    if (preferredAssetIdRef.current === assetId) {
      setPreferredAssetId(null);
    }

    if (selectedSearchResultRef.current?.assetId === assetId) {
      setSelectedSearchResult(null);
    }

    queryClient.removeQueries({ queryKey: ['search', 'context', assetId] });
  }

  function handleDeleteAsset(asset: AssetSummary) {
    if (deleteMutation.isPending) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${asset.title}" from ${selectedWorkspace?.name ?? 'this workspace'}?\n\nThis removes the asset through Spring and refreshes the workspace list.`,
    );

    if (!confirmed) {
      return;
    }

    deleteMutation.mutate(
      {
        assetId: asset.assetId,
        workspaceId: asset.workspaceId,
      },
      {
        onSuccess: async (_response, variables) => {
          clearAssetDependentState(variables.assetId);

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
            queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
          ]);
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            clearAssetDependentState(variables.assetId);

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  function handleRenameAsset(title: string) {
    if (!selectedAsset) {
      return;
    }

    renameMutation.mutate(
      {
        assetId: selectedAsset.assetId,
        workspaceId: selectedAsset.workspaceId,
        title,
      },
      {
        onSuccess: (response, variables) => {
          queryClient.setQueryData<AssetSummary[] | undefined>(assetKeys.list(variables.workspaceId), (current) =>
            current?.map((asset) =>
              asset.assetId === variables.assetId
                ? {
                    ...asset,
                    title: response.title,
                    assetStatus: response.status,
                    workspaceId: response.workspaceId || asset.workspaceId,
                    createdAt: response.createdAt ?? asset.createdAt,
                  }
                : asset,
            ),
          );

          updateSearchResultTitles(variables.assetId, response.title);
          setSelectedSearchResult((current) =>
            current?.assetId === variables.assetId ? { ...current, assetTitle: response.title } : current,
          );
        },
        onError: async (error, variables) => {
          if (error instanceof ApiClientError && error.status === 404) {
            if (selectedAssetIdRef.current === variables.assetId) {
              clearAssetDependentState(variables.assetId);
            }

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: assetKeys.list(variables.workspaceId) }),
              queryClient.invalidateQueries({ queryKey: ['search', 'results', variables.workspaceId] }),
            ]);
          }
        },
      },
    );
  }

  const visibleDeleteError =
    deleteMutation.error && deleteMutation.variables?.workspaceId === selectedWorkspaceId ? deleteMutation.error : null;
  const deletingAssetId = deleteMutation.isPending ? deleteMutation.variables?.assetId ?? null : null;
  const visibleRenameError =
    renameMutation.error && renameMutation.variables?.assetId === selectedAssetId ? renameMutation.error : null;
  const isRenamingSelectedAsset =
    renameMutation.isPending && renameMutation.variables?.assetId === selectedAssetId;

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
          <div className="hero__path">
            <p className="hero__path-label">Golden path</p>
            <ol className="hero__path-list">
              {goldenPathSteps.map((step, index) => (
                <li key={step} className="hero-step">
                  <span className="hero-step__index">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="hero__chips">
            <span className="hero-chip">Active workspace: {selectedWorkspace.name}</span>
            <span className="hero-chip">Indexing stays explicit</span>
            <span className="hero-chip">Search stays workspace-scoped</span>
            <span className="hero-chip">
              {searchableAssetCount} searchable asset{searchableAssetCount === 1 ? '' : 's'}
            </span>
          </div>
          <InfoBanner title={heroGuide.title} message={heroGuide.message} tone={heroGuide.tone} className="hero__guide" />
        </div>

        <WorkspaceBar
          workspaces={workspacesQuery.data ?? []}
          selectedWorkspace={selectedWorkspace}
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
          assets={displayAssets}
          selectedAssetId={selectedAssetId}
          assetsError={assetsQuery.error}
          deleteError={visibleDeleteError}
          deleteBusy={deleteMutation.isPending}
          deletingAssetId={deletingAssetId}
          assetsLoading={assetsQuery.isLoading}
          uploadError={uploadMutation.error}
          uploadSuccessId={uploadMutation.data?.assetId}
          isUploading={uploadMutation.isPending}
          onSelectAsset={setSelectedAssetId}
          onDeleteAsset={handleDeleteAsset}
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
          isRenaming={Boolean(isRenamingSelectedAsset)}
          renameError={visibleRenameError}
          onIndex={handleIndexAsset}
          onRename={handleRenameAsset}
          onResetRename={() => renameMutation.reset()}
        />

        <SearchPanel
          workspaceName={selectedWorkspace.name}
          searchableAssetCount={searchableAssetCount}
          resetToken={searchResetToken}
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
