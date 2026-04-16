import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type AssetStatus, type AssetSummary, type SearchResponse, type SearchResult } from '../lib/api';
import { EmptyState, ErrorBanner, LoadingBlock } from '../lib/ui';
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
  useCreateWorkspaceMutation,
  useWorkspacesQuery,
  WorkspaceBar,
  workspaceKeys,
} from '../features/workspaces/workspaces';
import {
  AuthEntrySurface,
  authKeys,
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from '../features/auth/auth';

const lastWorkspaceSelectionStorageKey = 'akw:last-workspace-id';

function readStoredWorkspaceSelection(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(lastWorkspaceSelectionStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredWorkspaceSelection(workspaceId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(lastWorkspaceSelectionStorageKey, workspaceId);
  } catch {
    // Ignore storage failures and keep the shell functional.
  }
}

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

  const currentUserQuery = useCurrentUserQuery();
  const registerMutation = useRegisterMutation();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const isAuthenticated = currentUserQuery.isSuccess;
  const currentUser = currentUserQuery.data ?? null;
  const isAuthRequired =
    currentUserQuery.error instanceof ApiClientError &&
    currentUserQuery.error.status === 401 &&
    currentUserQuery.error.code === 'AUTHENTICATION_REQUIRED';

  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [preferredWorkspaceId, setPreferredWorkspaceId] = useState<string | null>(() => readStoredWorkspaceSelection());
  const [workspaceScopeRefreshAfter, setWorkspaceScopeRefreshAfter] = useState<number | null>(null);

  useEffect(() => {
    const workspaces = workspacesQuery.data ?? [];
    if (workspaceScopeRefreshAfter !== null) {
      if (workspacesQuery.dataUpdatedAt <= workspaceScopeRefreshAfter) {
        return;
      }

      if (!workspaces.length) {
        setWorkspaceScopeRefreshAfter(null);
        return;
      }

      const restoredWorkspace = preferredWorkspaceId
        ? workspaces.find((workspace) => workspace.id === preferredWorkspaceId)
        : null;

      startTransition(() => setSelectedWorkspaceId(restoredWorkspace?.id ?? workspaces[0].id));
      setWorkspaceScopeRefreshAfter(null);
      return;
    }

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
  }, [
    preferredWorkspaceId,
    selectedWorkspaceId,
    startTransition,
    workspaceScopeRefreshAfter,
    workspacesQuery.data,
    workspacesQuery.dataUpdatedAt,
  ]);

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

  useEffect(() => {
    if (selectedWorkspaceId) {
      writeStoredWorkspaceSelection(selectedWorkspaceId);
    }
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

  function handleCreateWorkspace(name: string) {
    createWorkspaceMutation.mutate(name, {
      onSuccess: (workspace) => {
        setPreferredWorkspaceId(workspace.id);
      },
    });
  }

  function handleSelectWorkspace(workspaceId: string) {
    setPreferredWorkspaceId(workspaceId);
    setPreferredAssetId(null);
    startTransition(() => setSelectedWorkspaceId(workspaceId));
  }

  function clearSessionScopedState() {
    const previousSelectedAssetId = selectedAssetIdRef.current;

    if (previousSelectedAssetId) {
      queryClient.removeQueries({ queryKey: assetKeys.status(previousSelectedAssetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(previousSelectedAssetId) });
    }

    setSelectedAssetId(null);
    setPreferredAssetId(null);
    setStatusPollingEnabled(false);
    setSubmittedSearch(null);
    setSelectedSearchResult(null);
    setSearchResetToken((current) => current + 1);
    startTransition(() => setSelectedWorkspaceId(null));

    queryClient.removeQueries({ queryKey: searchKeys.all });
  }

  function resetAuthMutations() {
    registerMutation.reset();
    loginMutation.reset();
  }

  async function reconcileAuthBoundary() {
    setWorkspaceScopeRefreshAfter(Date.now());
    clearSessionScopedState();
    queryClient.removeQueries({ queryKey: assetKeys.all });
    queryClient.removeQueries({ queryKey: workspaceKeys.all });
    await queryClient.refetchQueries({ queryKey: authKeys.currentUser, type: 'active' });
  }

  function handleRegister(input: { email: string; password: string }) {
    registerMutation.mutate(input, {
      onSuccess: async () => {
        loginMutation.reset();
        logoutMutation.reset();
        await reconcileAuthBoundary();
      },
    });
  }

  function handleLogin(input: { email: string; password: string }) {
    loginMutation.mutate(input, {
      onSuccess: async () => {
        registerMutation.reset();
        logoutMutation.reset();
        await reconcileAuthBoundary();
      },
    });
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: async () => {
        setWorkspaceScopeRefreshAfter(null);
        clearSessionScopedState();
        queryClient.removeQueries({ queryKey: assetKeys.all });
        queryClient.removeQueries({ queryKey: workspaceKeys.all });
        await queryClient.refetchQueries({ queryKey: authKeys.currentUser, type: 'active' });
      },
    });
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

  if (currentUserQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Checking authenticated session..." />
      </div>
    );
  }

  if (isAuthRequired) {
    return (
      <AuthEntrySurface
        registerError={registerMutation.error}
        loginError={loginMutation.error}
        isRegistering={registerMutation.isPending}
        isLoggingIn={loginMutation.isPending}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onResetErrors={resetAuthMutations}
      />
    );
  }

  if (currentUserQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorBanner error={currentUserQuery.error} />
      </div>
    );
  }

  if (workspacesQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Loading authenticated workspace scope..." />
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
    if (workspacesQuery.isFetching || workspaceScopeRefreshAfter !== null || (workspacesQuery.data?.length ?? 0) > 0) {
      return (
        <div className="app-shell app-shell--centered">
          <LoadingBlock label="Refreshing visible workspace scope..." />
        </div>
      );
    }

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
        <div className="hero__copy hero__copy--compact">
          <div className="hero__headline">
            <div>
              <p className="hero__eyebrow">AI Knowledge Workspace</p>
              <h1>Search-first lecture workspace</h1>
              <p>
                Stay inside one authenticated account and one active workspace while you upload media, index transcript
                rows explicitly, search within scope, and reopen transcript context.
              </p>
            </div>
          </div>
          <div className="hero__chips">
            <span className="hero-chip">Search-first</span>
            <span className="hero-chip">Current scope: {selectedWorkspace.name}</span>
            <span className="hero-chip">
              {searchableAssetCount} searchable asset{searchableAssetCount === 1 ? '' : 's'}
            </span>
            <span className="hero-chip">Explicit indexing</span>
          </div>
        </div>

        <WorkspaceBar
          workspaces={workspacesQuery.data ?? []}
          selectedWorkspace={selectedWorkspace}
          selectedWorkspaceId={selectedWorkspaceId}
          isLoading={workspacesQuery.isLoading || workspacesQuery.isFetching || isTransitionPending}
          searchableAssetCount={searchableAssetCount}
          currentUser={currentUser!}
          createError={createWorkspaceMutation.error}
          logoutError={logoutMutation.error}
          createSuccessId={createWorkspaceMutation.data?.id}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          isCreating={createWorkspaceMutation.isPending}
          onLogout={handleLogout}
          isLoggingOut={logoutMutation.isPending}
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
