import { useEffect, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../shared/api/api-error';
import type { SearchResponse, SearchResult } from '../features/search/api/search-api';
import { Button, EmptyState, ErrorBanner, LoadingBlock } from '../lib/ui';
import { useHashRoute, type AppRoute } from './router';
import { AppShell } from './AppShell';
import { useProtectedRouteFallback } from './bootstrap/use-protected-route-fallback';
import { useWorkspaceBootstrap } from './bootstrap/use-workspace-bootstrap';
import {
  useCurrentUserQuery,
  AuthEntrySurface,
  KeycloakAuthEntrySurface,
  authKeys,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} from '../features/auth/auth';
import { useAuth } from '../features/auth/auth-provider';
import { assetKeys, useAssetRouteQuery } from '../features/assets/hooks/asset-queries';
import { useAssetSelection } from '../features/assets/hooks/use-asset-selection';
import { useAssetLifecycle } from '../features/assets/hooks/use-asset-lifecycle';
import { useAssetManagement } from '../features/assets/hooks/use-asset-management';
import { AssetLibraryScreen } from '../features/assets/library-screen';
import { AssetDetailScreen } from '../features/assets/detail-screen';
import { WorkspaceHomeScreen } from '../features/dashboard/dashboard';
import { searchKeys, useSearchController, useTranscriptContextQuery } from '../features/search/hooks/use-search-controller';
import { getClearedStudyRoute, getSearchReturnRoute, getStudyRouteState } from '../features/search/model/study-route-state';
import { resolveTranscriptLookupId } from '../features/search/model/search-result-reference';
import { useRouteSearchHydration } from '../features/search/model/use-route-search-hydration';
import { WorkspaceSearchScreen } from '../features/search/search-screen';
import { useAssetUpload } from '../features/upload/hooks/use-asset-upload';
import { SettingsScreen } from '../features/settings/settings';
import {
  useWorkspacesQuery,
  WorkspaceBar,
  workspaceKeys,
} from '../features/workspaces/workspaces';
import { useWorkspaceManagement } from '../features/workspaces/hooks/use-workspace-management';
import { useAssistantCitationNavigation } from './navigation/use-assistant-citation-navigation';
import { useAssetRouteWorkspaceHydration } from './bootstrap/use-asset-route-workspace-hydration';
import type { AssetSummary } from '../features/assets/model/types';

export function AppRouter() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [route, navigate] = useHashRoute();
  const [isTransitionPending, startTransition] = useTransition();

  const currentUserQuery = useCurrentUserQuery();
  const registerMutation = useRegisterMutation();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const isAuthenticated =
    auth.mode === 'keycloak_jwt' ? auth.hasBearerToken && currentUserQuery.isSuccess : currentUserQuery.isSuccess;
  const currentUser = currentUserQuery.data ?? null;
  const isLegacyAuthRequired =
    auth.mode === 'legacy_session' &&
    currentUserQuery.error instanceof ApiClientError &&
    currentUserQuery.error.status === 401 &&
    currentUserQuery.error.code === 'AUTHENTICATION_REQUIRED';
  const isJwtAuthModeUnavailable =
    auth.mode === 'keycloak_jwt' &&
    (auth.keycloakPhase === 'auth_mode_unavailable' ||
      (currentUserQuery.error instanceof ApiClientError &&
        currentUserQuery.error.status === 409 &&
        currentUserQuery.error.code === 'AUTH_MODE_UNAVAILABLE'));

  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const {
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    setPreferredWorkspaceId,
    workspaceScopeRefreshAfter,
    setWorkspaceScopeRefreshAfter,
  } = useWorkspaceBootstrap({
    workspaces: workspacesQuery.data,
    workspacesDataUpdatedAt: workspacesQuery.dataUpdatedAt,
    startTransition,
  });

  const routedAssetId = route.name === 'asset' ? route.assetId : null;
  const assetRouteQuery = useAssetRouteQuery(routedAssetId, isAuthenticated);
  const {
    assetsQuery,
    selectedAsset,
    selectedAssetId,
    selectedAssetIdRef,
    preferredAssetIdRef,
    setSelectedAssetId,
    setPreferredAssetId,
    selectAsset,
    clearSelection,
  } = useAssetSelection({ workspaceId: selectedWorkspaceId, routedAssetId, startTransition });
  const lifecycle = useAssetLifecycle({ asset: selectedAsset, workspaceId: selectedWorkspaceId });

  const displayAssets = useMemo(() => {
    const assets = assetsQuery.data ?? [];
    const resolvedStatus = lifecycle.resolvedAssetStatus;

    if (!selectedAssetId || !resolvedStatus) {
      return assets;
    }

    return assets.map((asset) =>
      asset.assetId === selectedAssetId && asset.assetStatus !== resolvedStatus
        ? { ...asset, assetStatus: resolvedStatus }
        : asset,
    );
  }, [assetsQuery.data, lifecycle.resolvedAssetStatus, selectedAssetId]);

  const searchableAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'SEARCHABLE').length,
    [displayAssets],
  );
  const processingAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'PROCESSING').length,
    [displayAssets],
  );
  const transcriptReadyAssetCount = useMemo(
    () => displayAssets.filter((asset) => asset.assetStatus === 'TRANSCRIPT_READY').length,
    [displayAssets],
  );

  const workspaceSearch = useSearchController({ workspaceId: selectedWorkspaceId });
  const assetSearch = useSearchController({ workspaceId: selectedWorkspaceId, assetId: selectedAssetId });
  const openAssistantCitationInAsset = useAssistantCitationNavigation({
    clearAssetSearchSelection: assetSearch.clearSelectedResult,
    selectAsset,
    navigate,
  });

  const routeSearchQuery = useRouteSearchHydration({
    route,
    selectedWorkspaceId,
    searchableAssetCount,
    submittedSearch: workspaceSearch.submittedSearch,
    onRouteSearchSubmit: workspaceSearch.submit,
  });
  const studyRouteState = getStudyRouteState(route, selectedWorkspaceId, workspaceSearch.submittedSearch);
  const routedStudyContextQuery = useTranscriptContextQuery(studyRouteState.contextParams);

  const assetManagement = useAssetManagement({
    currentUserId: currentUser?.id,
    workspaceId: selectedWorkspaceId,
    workspaceName: selectedWorkspace?.name,
    selectedAsset,
    selectedAssetId,
    selectedAssetIdRef,
    preferredAssetIdRef,
    setSelectedAssetId,
    setPreferredAssetId,
    onClearAssetReferences: (assetId) => {
      if (workspaceSearch.selectedResultRef.current?.assetId === assetId) workspaceSearch.setSelectedResult(null);
      if (assetSearch.selectedResultRef.current?.assetId === assetId) assetSearch.setSelectedResult(null);
      if (selectedAssetIdRef.current === assetId) assetSearch.reset();
    },
    onAssetTitleChanged: (assetId, title) => {
      updateSearchResultTitles(assetId, title);
      workspaceSearch.updateAssetTitle(assetId, title);
      assetSearch.updateAssetTitle(assetId, title);
    },
    onDeletedSelectedRoute: (assetId) => {
      if (route.name === 'asset' && route.assetId === assetId) navigate({ name: 'library' });
    },
  });

  const upload = useAssetUpload({
    workspaceId: selectedWorkspaceId,
    onUploaded: (response, input) => {
      selectAsset(response.assetId);
      workspaceSearch.reset();
      assetSearch.reset();
      assetManagement.recordUploadSuccess(input.title?.trim() || input.file.name);
      navigate({ name: 'asset', assetId: response.assetId });
    },
  });

  const workspaceManagement = useWorkspaceManagement({
    currentUserId: currentUser?.id,
    selectedWorkspaceId,
    setPreferredWorkspaceId,
    setWorkspaceScopeRefreshAfter,
    onClearWorkspaceScope: clearWorkspaceScopedState,
    onDeletedWorkspaceRoute: () => navigate({ name: 'home' }),
  });

  const assetRouteWorkspace = useAssetRouteWorkspaceHydration({
    route,
    asset: assetRouteQuery.data,
    isAssetLoading: assetRouteQuery.isLoading || assetRouteQuery.isFetching,
    isAssetError: assetRouteQuery.isError,
    workspaces: workspacesQuery.data,
    isWorkspaceLoading: workspacesQuery.isLoading || workspacesQuery.isFetching,
    selectedWorkspaceId,
    onSelectAuthorizedWorkspace: handleSelectWorkspace,
    onUnavailableRoute: () => navigate({ name: 'library' }),
  });

  useEffect(() => {
    const routedAsset = assetRouteQuery.data;

    if (!routedAsset) {
      return;
    }

    const summary: AssetSummary = {
      assetId: routedAsset.id,
      title: routedAsset.title,
      assetStatus: routedAsset.status,
      workspaceId: routedAsset.workspaceId,
      createdAt: routedAsset.createdAt ?? '',
    };

    queryClient.setQueryData<AssetSummary[]>(assetKeys.list(routedAsset.workspaceId), (current = []) => {
      const existing = current.find((asset) => asset.assetId === summary.assetId);

      if (!existing) {
        return [...current, summary];
      }

      if (
        existing.title === summary.title &&
        existing.assetStatus === summary.assetStatus &&
        existing.workspaceId === summary.workspaceId &&
        existing.createdAt === summary.createdAt
      ) {
        return current;
      }

      return current.map((asset) => (asset.assetId === summary.assetId ? { ...asset, ...summary } : asset));
    });
  }, [assetRouteQuery.data, queryClient]);

  useEffect(() => {
    const indexedAssetId = lifecycle.indexResponse?.assetId;

    if (!indexedAssetId) {
      return;
    }

    workspaceSearch.reset();
    if (indexedAssetId === selectedAssetIdRef.current) {
      assetSearch.reset();
    }
  }, [assetSearch.reset, lifecycle.indexResponse?.assetId, selectedAssetIdRef, workspaceSearch.reset]);

  useProtectedRouteFallback({
    route,
    isAuthenticated,
    isCurrentUserLoading: currentUserQuery.isLoading,
    isCurrentUserFetching: currentUserQuery.isFetching,
    hasSelectedWorkspace: Boolean(selectedWorkspace),
    isWorkspaceLoading: workspacesQuery.isLoading,
    isWorkspaceFetching: workspacesQuery.isFetching,
    isWorkspaceScopeRefreshing: workspaceScopeRefreshAfter !== null,
    workspaceCount: workspacesQuery.data?.length ?? 0,
    navigate,
  });

  function handleSelectWorkspace(workspaceId: string) {
    workspaceManagement.clearSuccessNotice();
    setPreferredWorkspaceId(workspaceId);
    clearSelection();
    workspaceSearch.reset();
    assetSearch.reset();
    startTransition(() => setSelectedWorkspaceId(workspaceId));
  }

  function clearWorkspaceScopedState(workspaceId: string) {
    const previousSelectedAssetId = selectedAssetIdRef.current;

    if (previousSelectedAssetId) {
      queryClient.removeQueries({ queryKey: assetKeys.status(previousSelectedAssetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(previousSelectedAssetId) });
    }

    queryClient.removeQueries({ queryKey: assetKeys.list(workspaceId) });
    queryClient.removeQueries({ queryKey: ['search', 'results', workspaceId] });
    queryClient.removeQueries({ queryKey: searchKeys.all });

    setPreferredWorkspaceId(null);
    clearSelection();
    workspaceSearch.reset();
    assetSearch.reset();
    assetManagement.clearNotices();
    workspaceManagement.clearSuccessNotice();
    startTransition(() => setSelectedWorkspaceId(null));
  }

  function clearSessionScopedState() {
    const previousSelectedAssetId = selectedAssetIdRef.current;

    if (previousSelectedAssetId) {
      queryClient.removeQueries({ queryKey: assetKeys.status(previousSelectedAssetId) });
      queryClient.removeQueries({ queryKey: assetKeys.transcript(previousSelectedAssetId) });
    }

    clearSelection();
    workspaceSearch.reset();
    assetSearch.reset();
    workspaceManagement.clearSuccessNotice();
    assetManagement.clearNotices();
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

  async function handleLogout() {
    if (auth.mode === 'keycloak_jwt') {
      setWorkspaceScopeRefreshAfter(null);
      clearSessionScopedState();
      queryClient.removeQueries({ queryKey: authKeys.currentUser });
      queryClient.removeQueries({ queryKey: assetKeys.all });
      queryClient.removeQueries({ queryKey: workspaceKeys.all });
      navigate({ name: 'home' });
      await auth.clearLocalAuth();
      return;
    }

    logoutMutation.mutate(undefined, {
      onSuccess: async () => {
        setWorkspaceScopeRefreshAfter(null);
        clearSessionScopedState();
        queryClient.removeQueries({ queryKey: assetKeys.all });
        queryClient.removeQueries({ queryKey: workspaceKeys.all });
        navigate({ name: 'home' });
        await queryClient.refetchQueries({ queryKey: authKeys.currentUser, type: 'active' });
      },
    });
  }

  function openAsset(assetId: string) {
    if (!assetId) {
      return;
    }

    selectAsset(assetId);
    navigate({ name: 'asset', assetId });
  }

  function openSearchResultInAsset(result: SearchResult) {
    const transcriptRowId = resolveTranscriptLookupId(result);

    if (!transcriptRowId) {
      workspaceSearch.setSelectedResult(null);
      openAsset(result.assetId);
      return;
    }

    workspaceSearch.setSelectedResult(result);
    selectAsset(result.assetId);
    navigate({
      name: 'asset',
      assetId: result.assetId,
      transcriptRowId,
      source: 'search',
      searchQuery: workspaceSearch.submittedSearch ?? undefined,
    });
  }

  function clearRoutedStudyContext() {
    const clearedRoute = getClearedStudyRoute(route);

    if (clearedRoute) {
      navigate(clearedRoute);
    }
  }

  function returnToSearchFromAsset() {
    navigate(getSearchReturnRoute(route));
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

  const isLogoutPending = auth.mode === 'legacy_session' && logoutMutation.isPending;

  if (auth.isResolvingAuth) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Completing Keycloak sign-in..." />
      </div>
    );
  }

  if (auth.mode === 'keycloak_jwt' && (auth.configIssue || isJwtAuthModeUnavailable || !auth.hasBearerToken)) {
    return (
      <KeycloakAuthEntrySurface
        configIssue={auth.configIssue}
        authModeUnavailable={isJwtAuthModeUnavailable}
        authErrorMessage={auth.authErrorMessage}
        isStartingLogin={auth.isStartingLogin}
        onContinue={() => void auth.startKeycloakLogin()}
      />
    );
  }

  if (currentUserQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Checking authenticated session..." />
      </div>
    );
  }

  if (isLegacyAuthRequired) {
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

  if (!selectedWorkspace && (workspacesQuery.isFetching || workspaceScopeRefreshAfter !== null || (workspacesQuery.data?.length ?? 0) > 0)) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Refreshing workspace scope..." />
      </div>
    );
  }

  if (route.name === 'asset' && (assetRouteWorkspace.isHydrating || assetRouteWorkspace.isUnavailable)) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label="Resolving the authorized asset workspace..." />
      </div>
    );
  }

  let screenContent;

  if (!selectedWorkspace) {
    screenContent = (
      <div className="screen-stack">
        <div className="workspace-setup-card">
          <EmptyState
            title="No workspace yet"
            description="Create a workspace in Settings to start uploading lecture videos and preparing them for transcript search."
          />
          <div className="workspace-setup-card__actions">
            <Button type="button" onClick={() => navigate({ name: 'settings' })}>
              Open settings
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    switch (route.name) {
      case 'library':
        screenContent = (
          <AssetLibraryScreen
            workspaceName={selectedWorkspace.name}
            assets={displayAssets}
            selectedAssetId={selectedAssetId}
            successNotice={assetManagement.librarySuccessNotice}
            assetsError={assetsQuery.error}
            deleteError={assetManagement.visibleDeleteError}
            deleteBusy={assetManagement.isDeleting}
            deletingAssetId={assetManagement.deletingAssetId}
            assetsLoading={assetsQuery.isLoading}
            uploadError={upload.error}
            uploadSuccessId={upload.uploadedAssetId}
            isUploading={upload.isUploading}
            onSelectAsset={openAsset}
            onDeleteAsset={assetManagement.handleDeleteAsset}
            onUpload={upload.submit}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenSettings={() => navigate({ name: 'settings' })}
          />
        );
        break;
      case 'asset':
        screenContent = (
          <AssetDetailScreen
            workspaceId={selectedWorkspace.id}
            workspaceName={selectedWorkspace.name}
            assets={displayAssets}
            asset={selectedAsset}
            successNotice={assetManagement.detailSuccessNotice}
            resolvedAssetStatus={lifecycle.resolvedAssetStatus}
            statusResponse={lifecycle.statusResponse}
            statusError={lifecycle.statusError}
            transcriptRows={lifecycle.transcriptRows}
            transcriptError={lifecycle.transcriptError}
            transcriptLoading={lifecycle.transcriptLoading}
            indexError={lifecycle.indexError}
            indexResponse={lifecycle.indexResponse}
            isIndexing={lifecycle.isIndexing}
            isRenaming={Boolean(assetManagement.isRenamingSelectedAsset)}
            renameError={assetManagement.visibleRenameError}
            activeQuery={assetSearch.submittedSearch}
            searchResponse={assetSearch.searchResponse}
            searchError={assetSearch.searchError}
            isSearching={assetSearch.isSearching}
            contextResponse={assetSearch.contextResponse}
            contextError={assetSearch.contextError}
            isContextLoading={assetSearch.isContextLoading}
            selectedSearchResult={assetSearch.selectedResult}
            focusedTranscriptRowId={studyRouteState.focusedTranscriptRowId}
            focusedTranscriptSource={studyRouteState.source}
            sourceSearchQuery={studyRouteState.sourceSearchQuery}
            studyContextResponse={routedStudyContextQuery.data}
            studyContextError={routedStudyContextQuery.error}
            isStudyContextLoading={routedStudyContextQuery.isLoading || routedStudyContextQuery.isFetching}
            searchResetToken={assetSearch.resetToken}
            searchableAssetCount={searchableAssetCount}
            onIndex={lifecycle.runRecoveryIndexing}
            onRename={assetManagement.handleRenameAsset}
            onResetRename={assetManagement.resetRename}
            onSearchWithinAsset={assetSearch.submit}
            onSelectSearchResult={assetSearch.setSelectedResult}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenAsset={openAsset}
            onOpenAssistantCitation={openAssistantCitationInAsset}
            onReturnToSearch={route.name === 'asset' && route.source === 'search' ? returnToSearchFromAsset : undefined}
            onClearStudyContext={studyRouteState.focusedTranscriptRowId ? clearRoutedStudyContext : undefined}
          />
        );
        break;
      case 'search':
        screenContent = (
          <WorkspaceSearchScreen
            workspaceName={selectedWorkspace.name}
            searchableAssetCount={searchableAssetCount}
            resetToken={workspaceSearch.resetToken}
            activeQuery={workspaceSearch.submittedSearch}
            routeQuery={routeSearchQuery}
            searchResponse={workspaceSearch.searchResponse}
            searchError={workspaceSearch.searchError}
            isSearching={workspaceSearch.isSearching}
            contextResponse={workspaceSearch.contextResponse}
            contextError={workspaceSearch.contextError}
            isContextLoading={workspaceSearch.isContextLoading}
            selectedResult={workspaceSearch.selectedResult}
            assets={displayAssets}
            onSearch={(query) => {
              const trimmedQuery = query.trim();
              workspaceSearch.submit(trimmedQuery);
              navigate({ name: 'search', searchQuery: trimmedQuery });
            }}
            onSelectResult={workspaceSearch.setSelectedResult}
            onOpenResultContext={openSearchResultInAsset}
            onOpenAsset={openAsset}
            onOpenLibrary={() => navigate({ name: 'library' })}
          />
        );
        break;
      case 'settings':
        screenContent = (
          <SettingsScreen
            currentUserEmail={currentUser?.email ?? 'Unknown account'}
            selectedWorkspaceName={selectedWorkspace.name}
            workspaceManagement={
              <WorkspaceBar
                workspaces={workspacesQuery.data ?? []}
                selectedWorkspace={selectedWorkspace}
                selectedWorkspaceId={selectedWorkspaceId}
                isLoading={workspacesQuery.isLoading || workspacesQuery.isFetching || isTransitionPending}
                successNotice={workspaceManagement.successNotice}
                createError={workspaceManagement.createError}
                renameError={workspaceManagement.renameError}
                deleteError={workspaceManagement.deleteError}
                logoutError={auth.mode === 'legacy_session' ? logoutMutation.error : null}
                createSuccessId={workspaceManagement.createSuccessId}
                onSelectWorkspace={handleSelectWorkspace}
                onCreateWorkspace={workspaceManagement.createWorkspace}
                onRenameWorkspace={workspaceManagement.renameWorkspace}
                onDeleteWorkspace={workspaceManagement.deleteWorkspace}
                onResetDelete={workspaceManagement.resetDelete}
                isCreating={workspaceManagement.isCreating}
                isRenaming={workspaceManagement.isRenaming}
                isDeleting={workspaceManagement.isDeleting}
                onLogout={handleLogout}
                isLoggingOut={isLogoutPending}
              />
            }
          />
        );
        break;
      case 'home':
      default:
        screenContent = (
          <WorkspaceHomeScreen
            workspaceName={selectedWorkspace.name}
            currentUserEmail={currentUser?.email ?? 'Unknown account'}
            assets={displayAssets}
            selectedAsset={selectedAsset}
            searchableAssetCount={searchableAssetCount}
            activeQuery={workspaceSearch.submittedSearch}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenAsset={openAsset}
            onOpenSettings={() => navigate({ name: 'settings' })}
          />
        );
        break;
    }
  }

  return (
    <AppShell
      route={route}
      navigate={navigate}
      workspaces={workspacesQuery.data ?? []}
      selectedWorkspace={selectedWorkspace}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedAssetTitle={selectedAsset?.title}
      currentUserEmail={currentUser?.email ?? 'Unknown account'}
      isWorkspaceFetching={workspacesQuery.isFetching}
      processingAssetCount={processingAssetCount}
      transcriptReadyAssetCount={transcriptReadyAssetCount}
      searchableAssetCount={searchableAssetCount}
      isLogoutPending={isLogoutPending}
      onSelectWorkspace={handleSelectWorkspace}
      onLogout={handleLogout}
    >
      {screenContent}
    </AppShell>
  );
}
