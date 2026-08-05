import { lazy, Suspense, useEffect, useMemo, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../shared/api/api-error';
import type { SearchResponse, SearchResult } from '../features/search/api/search-api';
import { Button, EmptyState, ErrorFeedback, LoadingBlock } from '../lib/ui';
import { useTranslation } from '../shared/i18n';
import { routeToHash, useHashRoute, type AppRoute } from './router';
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
// The public landing is its own lazy chunk: signed-in sessions never download the cinematic
// landing (or its WebGL dependencies), and the landing chunk loads only for signed-out visitors.
const PublicLanding = lazy(() =>
  import('../features/public-landing/public-landing').then((module) => ({ default: module.PublicLanding })),
);
import { useAuth } from '../features/auth/auth-provider';
import { assetKeys, useAssetRouteQuery } from '../features/assets/hooks/asset-queries';
import { useAssetSelection } from '../features/assets/hooks/use-asset-selection';
import { useAssetLifecycle } from '../features/assets/hooks/use-asset-lifecycle';
import { useAssetPlaybackProgress } from '../features/assets/hooks/use-asset-playback-progress';
import { resolveMediaPlaybackAvailability } from '../features/assets/player/media-playback-availability';
import { useAssetManagement } from '../features/assets/hooks/use-asset-management';
import { AssetLibraryScreen } from '../features/assets/library-screen';
import { AssetDetailScreen } from '../features/assets/detail-screen';
import { WorkspaceHomeScreen } from '../features/dashboard/dashboard';
import { searchKeys, useSearchController, useTranscriptContextQuery } from '../features/search/hooks/use-search-controller';
import { getClearedStudyRoute, getSearchReturnRoute, getStudyRouteState } from '../features/search/model/study-route-state';
import { resolveTranscriptLookupId } from '../features/search/model/search-result-reference';
import { useRouteSearchHydration } from '../features/search/model/use-route-search-hydration';
import { matchesTranscriptReference } from '../entities/transcript/model/transcript-display';
import { WorkspaceSearchScreen } from '../features/search/search-screen';
import { ContinueWatchingPanel } from '../features/continue-watching/continue-watching-panel';
import { useContinueWatching } from '../features/continue-watching/hooks/use-continue-watching';
import { buildSavedMomentKey, useSavedMoments } from '../features/saved-moments/hooks/use-saved-moments';
import { SaveMomentButton } from '../features/saved-moments/save-moment-button';
import { SavedMomentsPanel, momentTimestampLabel } from '../features/saved-moments/saved-moments-panel';
import { useAssetUpload } from '../features/upload/hooks/use-asset-upload';
import { useYouTubeAssetCreation } from '../features/upload/hooks/use-youtube-asset-creation';
import { SettingsScreen } from '../features/settings/settings';
import {
  useWorkspacesQuery,
  WorkspaceBar,
  workspaceKeys,
} from '../features/workspaces/workspaces';
import { useWorkspaceManagement } from '../features/workspaces/hooks/use-workspace-management';
import { useAssistantCitationNavigation } from './navigation/use-assistant-citation-navigation';
import { useAssetRouteWorkspaceHydration } from './bootstrap/use-asset-route-workspace-hydration';
import type { AssetProcessingResponse, AssetSummary } from '../features/assets/model/types';

export function AppRouter() {
  const { t } = useTranslation(['shell', 'common', 'upload']);
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
  const isPublicAuthRoute = route.name === 'login' || route.name === 'register';

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
  const playbackProgress = useAssetPlaybackProgress({
    assetId: selectedAsset?.assetId ?? null,
    enabled: resolveMediaPlaybackAvailability(selectedAsset).available,
  });

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
  const savedMoments = useSavedMoments(selectedWorkspaceId);
  const continueWatching = useContinueWatching(selectedWorkspaceId);
  const studyRouteState = getStudyRouteState(route, selectedWorkspaceId, workspaceSearch.submittedSearch);
  const routedStudyContextQuery = useTranscriptContextQuery(studyRouteState.contextParams);
  const noticeContextKey = `${currentUser?.id ?? 'anonymous'}:${selectedWorkspaceId ?? 'no-workspace'}:${routeToHash(route)}`;
  const focusedSavedMomentRowId = studyRouteState.focusedTranscriptRowId;
  const focusedSavedMomentRow = focusedSavedMomentRowId
    ? lifecycle.transcriptRows?.find((row) => matchesTranscriptReference(row, focusedSavedMomentRowId))
    : undefined;
  const savedMomentAction = route.name === 'asset' && focusedSavedMomentRowId && selectedAsset
    ? (
      <SaveMomentButton
        assetTitle={selectedAsset.title}
        timestampLabel={momentTimestampLabel(focusedSavedMomentRow?.startMs ?? null, t('common:timeUnavailable'))}
        isSaved={savedMoments.isSaved(route.assetId, focusedSavedMomentRowId)}
        isSaving={savedMoments.savingKey === buildSavedMomentKey(route.assetId, focusedSavedMomentRowId)}
        hasFailed={savedMoments.saveErrorKey === buildSavedMomentKey(route.assetId, focusedSavedMomentRowId)}
        onSave={() => savedMoments.save({
          assetId: route.assetId,
          transcriptRowId: focusedSavedMomentRowId,
        })}
      />
    )
    : undefined;


  const assetManagement = useAssetManagement({
    currentUserId: currentUser?.id,
    workspaceId: selectedWorkspaceId,
    workspaceName: selectedWorkspace?.name,
    noticeContextKey,
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

  function finishAssetCreation(response: AssetProcessingResponse, displayTitle: string) {
    selectAsset(response.assetId);
    workspaceSearch.reset();
    assetSearch.reset();
    assetManagement.recordCreationSuccess(response.sourceType, displayTitle);
    navigate({ name: 'asset', assetId: response.assetId });
  }

  const upload = useAssetUpload({
    workspaceId: selectedWorkspaceId,
    onUploaded: (response, input) => {
      finishAssetCreation(response, input.title?.trim() || input.file.name);
    },
  });

  const youtubeCreation = useYouTubeAssetCreation({
    workspaceId: selectedWorkspaceId,
    onCreated: (response, input) => {
      finishAssetCreation(response, input.title?.trim() || t('upload:youtube.defaultTitle'));
    },
  });

  const workspaceManagement = useWorkspaceManagement({
    noticeContextKey,
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
      sourceType: routedAsset.sourceType,
      youtubeVideoId: routedAsset.youtubeVideoId,
      sourceUrl: routedAsset.sourceUrl,
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
        existing.sourceType === summary.sourceType &&
        existing.youtubeVideoId === summary.youtubeVideoId &&
        existing.sourceUrl === summary.sourceUrl &&
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

  useEffect(() => {
    if (isAuthenticated && isPublicAuthRoute) {
      navigate({ name: 'home' });
    }
  }, [isAuthenticated, isPublicAuthRoute, navigate]);

  function handleSelectWorkspace(workspaceId: string) {
    workspaceManagement.clearSuccessNotice();
    if (route.name === 'search') {
      navigate({ name: 'search' });
    }
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
    queryClient.removeQueries({ queryKey: searchKeys.resultsScope(workspaceId) });
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
        if (isPublicAuthRoute) navigate({ name: 'home' });
      },
    });
  }

  function handleLogin(input: { email: string; password: string }) {
    loginMutation.mutate(input, {
      onSuccess: async () => {
        registerMutation.reset();
        logoutMutation.reset();
        await reconcileAuthBoundary();
        if (isPublicAuthRoute) navigate({ name: 'home' });
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

  function openTranscriptMoment(result: SearchResult, origin: 'workspace-search' | 'transcript-search') {
    const transcriptRowId = resolveTranscriptLookupId(result);
    const searchController = origin === 'workspace-search' ? workspaceSearch : assetSearch;

    if (!transcriptRowId) {
      searchController.setSelectedResult(null);
      openAsset(result.assetId);
      return;
    }

    searchController.setSelectedResult(result);
    selectAsset(result.assetId);
    navigate(origin === 'workspace-search'
      ? {
          name: 'asset',
          assetId: result.assetId,
          transcriptRowId,
          source: 'search',
          searchQuery: workspaceSearch.submittedSearch ?? undefined,
        }
      : {
          name: 'asset',
          assetId: result.assetId,
          transcriptRowId,
        });
  }

  function clearRoutedStudyContext() {
    const clearedRoute = getClearedStudyRoute(route);

    if (clearedRoute) {
      assetSearch.clearSelectedResult();
      navigate(clearedRoute);
    }
  }

  function returnToSearchFromAsset() {
    navigate(getSearchReturnRoute(route));
  }

  function updateSearchResultTitles(assetId: string, title: string) {
    queryClient.setQueriesData<SearchResponse>({ queryKey: searchKeys.allResults }, (current) => {
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
        <LoadingBlock label={t('status.completingSignIn')} />
      </div>
    );
  }

  if (currentUserQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label={t('status.checkingSession')} />
      </div>
    );
  }

  if (
    route.name === 'home' &&
    (isLegacyAuthRequired ||
      (auth.mode === 'keycloak_jwt' &&
        (auth.configIssue || (!auth.hasBearerToken && !isJwtAuthModeUnavailable && !auth.authErrorMessage))))
  ) {
    return (
      // The fallback holds the landing's ink background so the chunk swap never flashes white.
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050b10' }} aria-hidden="true" />}>
        <PublicLanding navigate={navigate} />
      </Suspense>
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
        onBackHome={() => navigate({ name: 'home' })}
      />
    );
  }

  if (isLegacyAuthRequired) {
    return (
      <AuthEntrySurface
        mode={route.name === 'register' ? 'register' : 'login'}
        registerError={registerMutation.error}
        loginError={loginMutation.error}
        isRegistering={registerMutation.isPending}
        isLoggingIn={loginMutation.isPending}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onResetErrors={resetAuthMutations}
        onNavigateMode={(mode) => navigate({ name: mode })}
        onBackHome={() => navigate({ name: 'home' })}
      />
    );
  }

  if (currentUserQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorFeedback error={currentUserQuery.error} />
      </div>
    );
  }

  if (workspacesQuery.isLoading) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label={t('status.loadingWorkspaceScope')} />
      </div>
    );
  }

  if (workspacesQuery.error) {
    return (
      <div className="app-shell app-shell--centered">
        <ErrorFeedback error={workspacesQuery.error} />
      </div>
    );
  }

  if (!selectedWorkspace && (workspacesQuery.isFetching || workspaceScopeRefreshAfter !== null || (workspacesQuery.data?.length ?? 0) > 0)) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label={t('status.refreshingWorkspaceScope')} />
      </div>
    );
  }

  if (route.name === 'asset' && (assetRouteWorkspace.isHydrating || assetRouteWorkspace.isUnavailable)) {
    return (
      <div className="app-shell app-shell--centered">
        <LoadingBlock label={t('status.resolvingAssetWorkspace')} />
      </div>
    );
  }

  const settingsScreen = (
    <SettingsScreen
      currentUserEmail={currentUser?.email ?? t('account.unknown')}
      logoutError={auth.mode === 'legacy_session' ? logoutMutation.error : null}
      isLoggingOut={isLogoutPending}
      onLogout={() => void handleLogout()}
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
          createSuccessId={workspaceManagement.createSuccessId}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={workspaceManagement.createWorkspace}
          onRenameWorkspace={workspaceManagement.renameWorkspace}
          onDeleteWorkspace={workspaceManagement.deleteWorkspace}
          onResetDelete={workspaceManagement.resetDelete}
          isCreating={workspaceManagement.isCreating}
          isRenaming={workspaceManagement.isRenaming}
          isDeleting={workspaceManagement.isDeleting}
        />
      }
    />
  );

  let screenContent;

  if (!selectedWorkspace) {
    screenContent = route.name === 'settings' ? settingsScreen : (
      <div className="screen-stack">
        <div className="workspace-setup-card">
          <EmptyState
            title={t('noWorkspace.title')}
            description={t('noWorkspace.description')}
          />
          <div className="workspace-setup-card__actions">
            <Button type="button" onClick={() => navigate({ name: 'settings' })}>
              {t('noWorkspace.action')}
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    // Feature-owned current-work panels, composed once and arranged by Search and Home alike.
    const continueWatchingPanel = (
      <ContinueWatchingPanel
        workspaceName={selectedWorkspace.name}
        items={continueWatching.items}
        isLoading={continueWatching.isLoading}
        error={continueWatching.error}
        onContinueWatching={(item) => navigate({ name: 'asset', assetId: item.assetId })}
      />
    );
    const savedMomentsPanel = (
      <SavedMomentsPanel
        workspaceId={selectedWorkspace.id}
        workspaceName={selectedWorkspace.name}
        items={savedMoments.items}
        isLoading={savedMoments.isLoading}
        error={savedMoments.error}
        removingId={savedMoments.removingId}
        removeError={savedMoments.removeError}
        onOpenMoment={(moment) => navigate({
          name: 'asset',
          assetId: moment.assetId,
          transcriptRowId: moment.transcriptRowId,
        })}
        onRemoveMoment={savedMoments.removeAsync}
      />
    );

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
            renameError={assetManagement.visibleRenameError}
            deleteBusy={assetManagement.isDeleting}
            deletingAssetId={assetManagement.deletingAssetId}
            renameBusy={Boolean(assetManagement.renamingAssetId)}
            renamingAssetId={assetManagement.renamingAssetId}
            assetsLoading={assetsQuery.isLoading}
            uploadError={upload.error}
            uploadSuccessId={upload.uploadedAssetId}
            isUploading={upload.isUploading}
            youtubeError={youtubeCreation.error}
            youtubeSuccessId={youtubeCreation.createdAssetId}
            isCreatingYouTube={youtubeCreation.isCreating}
            isUploadOpen={Boolean(route.upload)}
            onSelectAsset={openAsset}
            onDeleteAsset={assetManagement.handleDeleteAsset}
            onRenameAsset={(asset, title) => assetManagement.handleRenameAsset(title, asset)}
            onUpload={upload.submit}
            onCreateYouTube={youtubeCreation.submit}
            onResetCreation={() => {
              upload.reset();
              youtubeCreation.reset();
            }}
            onOpenUpload={() => navigate({ name: 'library', upload: true })}
            onCloseUpload={() => navigate({ name: 'library' })}
          />
        );
        break;
      case 'asset':
        screenContent = (
          <AssetDetailScreen
            workspaceId={selectedWorkspace.id}
            workspaceName={selectedWorkspace.name}
            asset={selectedAsset}
            assetRecord={assetRouteQuery.data}
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
            retryError={lifecycle.retryError}
            isRetrying={lifecycle.isRetrying}
            isRenaming={Boolean(assetManagement.isRenamingSelectedAsset)}
            isDeleting={assetManagement.deletingAssetId === selectedAsset?.assetId}
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
            studyContextResponse={routedStudyContextQuery.data}
            studyContextError={routedStudyContextQuery.error}
            isStudyContextLoading={routedStudyContextQuery.isLoading || routedStudyContextQuery.isFetching}
            searchResetToken={assetSearch.resetToken}
            playbackProgress={playbackProgress.progress}
            playbackProgressSaveFailed={playbackProgress.saveFailed}
            onObservePlayback={playbackProgress.observePlayback}
            onIndex={lifecycle.runRecoveryIndexing}
            onRetryProcessing={lifecycle.runProcessingRetry}
            onRename={assetManagement.handleRenameAsset}
            onResetRename={assetManagement.resetRename}
            onDelete={assetManagement.handleDeleteAsset}
            onSearchWithinAsset={assetSearch.submit}
            onSelectSearchResult={assetSearch.setSelectedResult}
            onOpenTranscriptMoment={(result) => openTranscriptMoment(result, 'transcript-search')}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onOpenAssistantCitation={openAssistantCitationInAsset}
            onReturnToSearch={route.name === 'asset' && route.source === 'search' ? returnToSearchFromAsset : undefined}
            onClearStudyContext={studyRouteState.focusedTranscriptRowId ? clearRoutedStudyContext : undefined}
            momentAction={savedMomentAction}
          />
        );
        break;
      case 'search':
        screenContent = (
          <WorkspaceSearchScreen
            workspaceName={selectedWorkspace.name}
            assetSources={displayAssets}
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
            onSearch={(query) => {
              const trimmedQuery = query.trim();
              workspaceSearch.submit(trimmedQuery);
              navigate({ name: 'search', searchQuery: trimmedQuery });
            }}
            onSelectResult={workspaceSearch.setSelectedResult}
            onOpenResultContext={(result) => openTranscriptMoment(result, 'workspace-search')}
            continueWatching={continueWatchingPanel}
            savedMoments={savedMomentsPanel}
          />
        );
        break;
      case 'settings':
        screenContent = settingsScreen;
        break;
      case 'home':
      default:
        screenContent = (
          <WorkspaceHomeScreen
            workspaceName={selectedWorkspace.name}
            assets={displayAssets}
            selectedAsset={selectedAsset}
            searchableAssetCount={searchableAssetCount}
            continueWatching={continueWatchingPanel}
            savedMoments={savedMomentsPanel}
            onUploadVideo={() => navigate({ name: 'library', upload: true })}
            onOpenSearch={() => navigate({ name: 'search' })}
            onOpenAsset={openAsset}
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
      currentUserEmail={currentUser?.email ?? t('account.unknown')}
      isWorkspaceFetching={workspacesQuery.isFetching}
      isLogoutPending={isLogoutPending}
      onSelectWorkspace={handleSelectWorkspace}
      onLogout={handleLogout}
    >
      {screenContent}
    </AppShell>
  );
}
