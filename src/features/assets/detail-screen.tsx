import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type {
  AssetIndexResponse,
  AssetPlaybackProgress,
  AssetRecordResponse,
  AssetStatus,
  AssetStatusResponse,
  AssetSummary,
} from './model/types';
import type { AssistantAnswerCitation } from '../assistant/public';
import type { SearchResponse, SearchResult } from '../search/public';
import type { TranscriptContextResponse, TranscriptRow } from '../../entities/transcript/model/types';
import {
  getTranscriptRowIdentity,
  resolveActiveTranscriptRow,
} from '../../entities/transcript/model/active-transcript-row';
import { matchesTranscriptReference } from '../../entities/transcript/model/transcript-display';
import { Button, EmptyState, ErrorFeedback, InfoBanner, SuccessNotification } from '../../lib/ui';
import { useDateTimeFormat, useTranslation } from '../../shared/i18n';
import type { EphemeralNotice } from '../../shared/ui/use-ephemeral-notice';
import { getFriendlyRenameErrorCopy } from './model/error-copy';
import { AssetIndexingRecoveryAction } from './components/asset-indexing-recovery-action';
import { AssetProcessingRetryAction } from './components/asset-processing-retry-action';
import { AssetSourceDetails } from './components/asset-source-details';
import { PlaybackResumeOffer } from './components/playback-resume-offer';
import {
  SelectedAssetTranscriptPanel,
  type TranscriptFollowMode,
} from './components/selected-asset-transcript-panel';
import { StatusBadge } from './components/status-badge';
import type {
  MediaPlaybackSnapshot,
  MediaPlayerHandle,
} from './player/media-player';
import { resolveMediaPlaybackAvailability } from './player/media-playback-availability';
import { UploadMediaPlayer } from './player/upload-media-player';
import { YouTubePlayer } from './player/youtube-player';
import { AssetAssistantPanel } from '../assistant/public';
import { SearchPanel } from '../search/public';

type StudyTab = 'transcript' | 'ask' | 'details';

type AssetDetailScreenProps = {
  workspaceId?: string;
  workspaceName: string;
  asset: AssetSummary | null;
  assetRecord?: AssetRecordResponse;
  successNotice: EphemeralNotice | null;
  resolvedAssetStatus: AssetStatus | null;
  statusResponse?: AssetStatusResponse;
  statusError: unknown;
  transcriptRows?: TranscriptRow[];
  transcriptError: unknown;
  transcriptLoading: boolean;
  indexError: unknown;
  indexResponse?: AssetIndexResponse;
  isIndexing: boolean;
  retryError: unknown;
  isRetrying: boolean;
  isRenaming: boolean;
  isDeleting: boolean;
  renameError: unknown;
  activeQuery: string | null;
  searchResponse?: SearchResponse;
  searchError: unknown;
  isSearching: boolean;
  contextResponse?: TranscriptContextResponse;
  contextError: unknown;
  isContextLoading: boolean;
  selectedSearchResult: SearchResult | null;
  focusedTranscriptRowId: string | null;
  focusedTranscriptSource?: 'search' | 'assistant' | null;
  studyContextResponse?: TranscriptContextResponse;
  studyContextError: unknown;
  isStudyContextLoading: boolean;
  searchResetToken: number;
  playbackProgress?: AssetPlaybackProgress;
  playbackProgressSaveFailed?: boolean;
  onObservePlayback?: (snapshot: MediaPlaybackSnapshot) => void;
  onIndex: () => void;
  onRetryProcessing: () => void;
  onRename: (title: string) => void;
  onResetRename: () => void;
  onDelete: (asset: AssetSummary) => void;
  onSearchWithinAsset: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onOpenTranscriptMoment: (result: SearchResult) => void;
  onOpenLibrary: () => void;
  onOpenAssistantCitation?: (citation: AssistantAnswerCitation) => void;
  onReturnToSearch?: () => void;
  onClearStudyContext?: () => void;
  /** Control for saving the currently focused canonical moment; rendered outside every row. */
  momentAction?: ReactNode;
};

export function AssetDetailScreen({
  workspaceId,
  workspaceName,
  asset,
  assetRecord,
  successNotice,
  resolvedAssetStatus,
  statusResponse,
  statusError,
  transcriptRows,
  transcriptError,
  transcriptLoading,
  indexError,
  indexResponse,
  isIndexing,
  retryError,
  isRetrying,
  isRenaming,
  isDeleting,
  renameError,
  activeQuery,
  searchResponse,
  searchError,
  isSearching,
  contextResponse,
  contextError,
  isContextLoading,
  selectedSearchResult,
  focusedTranscriptRowId,
  focusedTranscriptSource,
  studyContextResponse,
  studyContextError,
  isStudyContextLoading,
  searchResetToken,
  playbackProgress,
  playbackProgressSaveFailed = false,
  onObservePlayback,
  onIndex,
  onRetryProcessing,
  onRename,
  onResetRename,
  onDelete,
  onSearchWithinAsset,
  onSelectSearchResult,
  onOpenTranscriptMoment,
  onOpenLibrary,
  onOpenAssistantCitation,
  onReturnToSearch,
  onClearStudyContext,
  momentAction,
}: AssetDetailScreenProps) {
  const { t } = useTranslation(['viewer', 'common', 'library']);
  const formatDateTime = useDateTimeFormat();
  const [activeTab, setActiveTab] = useState<StudyTab>('transcript');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [activePlaybackRowId, setActivePlaybackRowId] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<TranscriptFollowMode>('following');
  const [acknowledgedFocusedRowId, setAcknowledgedFocusedRowId] = useState<string | null>(null);
  const [isResumeOfferDismissed, setIsResumeOfferDismissed] = useState(false);
  const [hasPlayerError, setHasPlayerError] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<MediaPlayerHandle>(null);
  const playerRegionRef = useRef<HTMLElement>(null);
  const isMobileStudyLayout = useMobileStudyLayout();
  const assistantWorkspaceId = workspaceId ?? asset?.workspaceId ?? null;
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);
  const transcriptRowCount = transcriptRows?.length ?? 0;
  const {
    youtubeVideoId,
    uploadMediaAssetId,
    available: mediaPlaybackAvailable,
  } = resolveMediaPlaybackAvailability(asset);
  const timestampedRowCount = useMemo(
    () => (transcriptRows ?? []).filter(
      (row) => row.startMs !== null && row.endMs !== null,
    ).length,
    [transcriptRows],
  );
  // The timestamp of the canonical row the route selected, resolved from the canonical transcript.
  const focusedMomentStartMs = useMemo(() => {
    if (!focusedTranscriptRowId) return null;

    const focusedRow = (transcriptRows ?? []).find(
      (row) => matchesTranscriptReference(row, focusedTranscriptRowId),
    );
    return focusedRow?.startMs ?? null;
  }, [focusedTranscriptRowId, transcriptRows]);
  // Progress tracking needs position snapshots even when no transcript timing exists.
  const playbackObservationEnabled = timestampedRowCount > 0 || Boolean(onObservePlayback);
  const resumableProgress =
    playbackProgress &&
    asset &&
    playbackProgress.assetId === asset.assetId &&
    playbackProgress.positionMs > 0 &&
    !playbackProgress.completed
      ? playbackProgress
      : null;
  const showResumeOffer = Boolean(resumableProgress)
    && mediaPlaybackAvailable
    && !hasPlayerError
    && !isResumeOfferDismissed;
  const effectiveFollowMode: TranscriptFollowMode =
    focusedTranscriptRowId && focusedTranscriptRowId !== acknowledgedFocusedRowId
      ? 'suspended-by-user'
      : followMode;

  const handlePlaybackSnapshot = useCallback((snapshot: MediaPlaybackSnapshot) => {
    onObservePlayback?.(snapshot);
    if (snapshot.state === 'error') setHasPlayerError(true);
    // Playback the learner started themselves makes a stale resume offer irrelevant.
    if (snapshot.state === 'playing') setIsResumeOfferDismissed(true);

    if (
      snapshot.state === 'error' ||
      snapshot.state === 'unstarted' ||
      snapshot.state === 'cued'
    ) {
      setActivePlaybackRowId(null);
      return;
    }

    const activeRow = resolveActiveTranscriptRow(transcriptRows ?? [], snapshot.positionMs);
    setActivePlaybackRowId((current) => {
      const next = activeRow?.identity ?? null;
      return current === next ? current : next;
    });
  }, [onObservePlayback, transcriptRows]);

  const startPlaybackAt = useCallback((positionMs: number) => {
    setIsResumeOfferDismissed(true);
    setFollowMode('following');
    setAcknowledgedFocusedRowId(focusedTranscriptRowId ?? null);
    setActivePlaybackRowId(
      resolveActiveTranscriptRow(transcriptRows ?? [], positionMs)?.identity ?? null,
    );
    playerRef.current?.seekToMs(positionMs);
    playerRef.current?.play();
    // Playback the learner asked for should be watchable, then keep focus in the media region
    // without letting focus itself reposition the page.
    revealPlayerRegion(playerRegionRef.current);
    playerRegionRef.current?.focus({ preventScroll: true });
  }, [focusedTranscriptRowId, transcriptRows]);

  // Opening a moment has to land on the moment: the player is positioned at the canonical row's
  // timestamp and brought on screen, while playback waits for an explicit control.
  useEffect(() => {
    if (focusedMomentStartMs === null || !mediaPlaybackAvailable) return;

    playerRef.current?.seekToMs(focusedMomentStartMs, { keepPaused: true });
    revealPlayerRegion(playerRegionRef.current);
  }, [focusedMomentStartMs, focusedTranscriptRowId, mediaPlaybackAvailable]);

  useEffect(() => {
    setActiveTab('transcript');
    setIsActionMenuOpen(false);
    setIsEditingTitle(false);
    setDraftTitle(asset?.title ?? '');
  }, [asset?.assetId, asset?.title]);

  useEffect(() => {
    if (focusedTranscriptRowId) setActiveTab('transcript');
  }, [focusedTranscriptRowId]);

  useEffect(() => {
    setActivePlaybackRowId(null);
    setFollowMode('following');
    setAcknowledgedFocusedRowId(null);
    setIsResumeOfferDismissed(false);
    setHasPlayerError(false);
  }, [asset?.assetId, youtubeVideoId, uploadMediaAssetId]);

  useEffect(() => {
    if (!focusedTranscriptRowId) return;
    setFollowMode('suspended-by-user');
    setAcknowledgedFocusedRowId(focusedTranscriptRowId);
  }, [focusedTranscriptRowId]);

  useEffect(() => {
    if (!activePlaybackRowId) return;
    const activeStillEligible = (transcriptRows ?? []).some(
      (row, index) =>
        getTranscriptRowIdentity(row, index) === activePlaybackRowId &&
        row.startMs !== null &&
        row.endMs !== null &&
        row.endMs > row.startMs,
    );
    if (!activeStillEligible) setActivePlaybackRowId(null);
  }, [activePlaybackRowId, transcriptRows]);

  useEffect(() => {
    if (!isActionMenuOpen) return;

    function closeMenuWithKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsActionMenuOpen(false);
        actionButtonRef.current?.focus();
      }
    }

    function closeMenuFromOutside(event: Event) {
      if (event.target instanceof Node && !actionMenuRef.current?.contains(event.target)) {
        setIsActionMenuOpen(false);
      }
    }

    window.addEventListener('keydown', closeMenuWithKeyboard);
    window.addEventListener('pointerdown', closeMenuFromOutside);
    return () => {
      window.removeEventListener('keydown', closeMenuWithKeyboard);
      window.removeEventListener('pointerdown', closeMenuFromOutside);
    };
  }, [isActionMenuOpen]);

  function selectTab(tab: StudyTab) {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById(`study-tab-${tab}`)?.focus());
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const tabs: StudyTab[] = ['transcript', 'ask', 'details'];
    const currentIndex = tabs.indexOf(activeTab);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    selectTab(tabs[(currentIndex + direction + tabs.length) % tabs.length] ?? 'transcript');
  }

  if (!asset) {
    return (
      <div className="screen-stack">
        <header className="page-header"><div className="page-header__copy"><h1>{t('missing.heading')}</h1></div></header>
        <EmptyState title={t('missing.title')} description={t('missing.description')} />
      </div>
    );
  }

  return (
    <div className="study-screen">
      <header className="study-header">
        <nav className="product-breadcrumb" aria-label={t('breadcrumb.label')}>
          <button type="button" onClick={onOpenLibrary}>{t('breadcrumb.library')}</button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{t('breadcrumb.current')}</span>
        </nav>
        <div className="study-header__main">
          <div className="study-header__copy">
            <p className="hero__eyebrow">{workspaceName}</p>
            <h1>{asset.title}</h1>
            <StatusBadge status={resolvedAssetStatus} />
          </div>
          <div ref={actionMenuRef} className="overflow-menu">
            <button
              ref={actionButtonRef}
              type="button"
              className="overflow-menu__trigger overflow-menu__trigger--large"
              aria-label={t('header.actions', { title: asset.title })}
              aria-expanded={isActionMenuOpen}
              onClick={() => setIsActionMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">•••</span>
            </button>
            {isActionMenuOpen ? (
              <div className="overflow-menu__popover" aria-label={t('header.actionsMenu')}>
                <button
                  type="button"
                  onClick={() => {
                    onResetRename();
                    setDraftTitle(asset.title);
                    setIsEditingTitle(true);
                    setIsActionMenuOpen(false);
                  }}
                >
                  {t('common:actions.rename')}
                </button>
                <button
                  type="button"
                  className="overflow-menu__danger"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onDelete(asset);
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? t('common:actions.deleting') : t('common:actions.delete')}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {isEditingTitle ? (
          <form
            className="study-title-form"
            onSubmit={(event) => {
              event.preventDefault();
              const nextTitle = draftTitle.trim();
              if (nextTitle && nextTitle !== asset.title) onRename(nextTitle);
            }}
          >
            <label className="field field--grow">
              <span className="field__label">{t('header.titleLabel')}</span>
              <input
                className="field__input"
                value={draftTitle}
                onChange={(event) => {
                  if (renameError) onResetRename();
                  setDraftTitle(event.target.value);
                }}
                maxLength={255}
                autoFocus
                disabled={isRenaming}
              />
            </label>
            <Button type="submit" disabled={isRenaming || !draftTitle.trim() || draftTitle.trim() === asset.title}>
              {isRenaming ? t('common:actions.saving') : t('common:actions.save')}
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => {
                onResetRename();
                setDraftTitle(asset.title);
                setIsEditingTitle(false);
              }}
              disabled={isRenaming}
            >
              {t('common:actions.cancel')}
            </Button>
          </form>
        ) : null}

        {renameErrorCopy?.tone === 'warning' ? <InfoBanner tone="warning" title={t(renameErrorCopy.titleKey)} message={t(renameErrorCopy.messageKey)} /> : null}
        {renameErrorCopy?.tone === 'error' ? <ErrorFeedback error={renameError} title={t(renameErrorCopy.titleKey)} message={t(renameErrorCopy.messageKey)} /> : null}
        {successNotice ? (
          <SuccessNotification
            title={successNotice.title}
            message={successNotice.message}
            onDismiss={successNotice.dismiss}
          />
        ) : null}
      </header>

      {youtubeVideoId ? (
        <YouTubePlayer
          key={`${asset.assetId}:${youtubeVideoId}`}
          ref={playerRef}
          regionRef={playerRegionRef}
          videoId={youtubeVideoId}
          title={asset.title}
          sourceUrl={asset.sourceUrl}
          playbackObservationEnabled={playbackObservationEnabled}
          onPlaybackSnapshot={handlePlaybackSnapshot}
        />
      ) : null}

      {uploadMediaAssetId ? (
        <UploadMediaPlayer
          key={`${uploadMediaAssetId}:upload`}
          ref={playerRef}
          regionRef={playerRegionRef}
          assetId={uploadMediaAssetId}
          title={asset.title}
          playbackObservationEnabled={playbackObservationEnabled}
          onPlaybackSnapshot={handlePlaybackSnapshot}
        />
      ) : null}

      {showResumeOffer && resumableProgress ? (
        <PlaybackResumeOffer
          positionMs={resumableProgress.positionMs}
          onResume={() => startPlaybackAt(resumableProgress.positionMs)}
          onStartFromBeginning={() => startPlaybackAt(0)}
        />
      ) : null}

      {playbackProgressSaveFailed ? (
        <p className="playback-progress-note">{t('resume.saveFailed')}</p>
      ) : null}

      <div className="study-tabs" role="tablist" aria-label={t('tabs.label')}>
        {(['transcript', 'ask', 'details'] as const).map((tab) => (
          <button
            key={tab}
            id={`study-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`study-pane-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="study-layout">
        <section
          id="study-pane-transcript"
          className="study-pane study-pane--transcript"
          role="tabpanel"
          aria-labelledby="study-tab-transcript"
          hidden={isMobileStudyLayout && activeTab !== 'transcript'}
        >
          <SearchPanel
            embedded
            workspaceName={workspaceName}
            assetSources={[asset]}
            searchableAssetCount={resolvedAssetStatus === 'SEARCHABLE' ? 1 : 0}
            resetToken={searchResetToken}
            activeQuery={activeQuery}
            searchResponse={searchResponse}
            searchError={searchError}
            isSearching={isSearching}
            contextResponse={focusedTranscriptRowId ? studyContextResponse : contextResponse}
            contextError={focusedTranscriptRowId ? studyContextError : contextError}
            isContextLoading={focusedTranscriptRowId ? isStudyContextLoading : isContextLoading}
            selectedResult={selectedSearchResult}
            selectedContextRowId={focusedTranscriptRowId}
            selectedMomentStartMs={focusedMomentStartMs}
            onPlaySelectedMoment={mediaPlaybackAvailable && !hasPlayerError ? startPlaybackAt : undefined}
            scope={{ mode: 'asset', assetTitle: asset.title }}
            onSearch={onSearchWithinAsset}
            onSelectResult={onSelectSearchResult}
            onOpenResultContext={onOpenTranscriptMoment}
            onReturnToSearch={onReturnToSearch}
            onClearContext={onClearStudyContext}
          />

          <SelectedAssetTranscriptPanel
            embedded
            asset={asset}
            workspaceName={workspaceName}
            resolvedAssetStatus={resolvedAssetStatus}
            statusResponse={statusResponse}
            transcriptRows={transcriptRows}
            transcriptError={transcriptError}
            transcriptLoading={transcriptLoading}
            focusedTranscriptRowId={focusedTranscriptRowId}
            focusedTranscriptSource={focusedTranscriptSource}
            momentAction={momentAction}
            activePlaybackRowId={mediaPlaybackAvailable ? activePlaybackRowId : null}
            followMode={effectiveFollowMode}
            transcriptViewVisible={!isMobileStudyLayout || activeTab === 'transcript'}
            onSuspendFollowing={() => {
              setFollowMode('suspended-by-user');
              setAcknowledgedFocusedRowId(focusedTranscriptRowId);
            }}
            onResumeFollowing={() => {
              setFollowMode('following');
              setAcknowledgedFocusedRowId(focusedTranscriptRowId);
            }}
            onPlaySegment={mediaPlaybackAvailable
              ? (startMs, rowIdentity) => {
                  setFollowMode('following');
                  setAcknowledgedFocusedRowId(focusedTranscriptRowId);
                  setActivePlaybackRowId(rowIdentity);
                  playerRef.current?.seekToMs(startMs);
                  playerRef.current?.play();
                }
              : undefined}
          />
        </section>

        <aside
          id="study-pane-ask"
          className="study-pane study-pane--assistant"
          role="tabpanel"
          aria-labelledby="study-tab-ask"
          hidden={isMobileStudyLayout && activeTab !== 'ask'}
        >
          {assistantWorkspaceId && onOpenAssistantCitation ? (
            <AssetAssistantPanel
              workspaceId={assistantWorkspaceId}
              assetId={asset.assetId}
              assetTitle={asset.title}
              isAssetSearchable={resolvedAssetStatus === 'SEARCHABLE'}
              onOpenCitationContext={onOpenAssistantCitation}
            />
          ) : null}
        </aside>

        <section
          id="study-pane-details"
          className="study-pane study-pane--details"
          role="tabpanel"
          aria-labelledby="study-tab-details"
          hidden={isMobileStudyLayout && activeTab !== 'details'}
        >
          <div className="study-pane__header">
            <p className="panel__eyebrow">{t('details.eyebrow')}</p>
            <h2>{t('details.heading')}</h2>
          </div>
          <dl className="detail-list">
            <div><dt>{t('details.workspace')}</dt><dd>{workspaceName}</dd></div>
            <AssetSourceDetails asset={asset} assetRecord={assetRecord} />
            <div><dt>{t('details.status')}</dt><dd><StatusBadge status={resolvedAssetStatus} /></dd></div>
            <div><dt>{t('details.added')}</dt><dd>{formatDateTime(asset.createdAt)}</dd></div>
            <div>
              <dt>{t('details.transcript')}</dt>
              <dd>
                {transcriptRowCount
                  ? t('details.segmentCount', { count: transcriptRowCount })
                  : t('details.transcriptNotReady')}
              </dd>
            </div>
          </dl>
          <AssetProcessingRetryAction
            assetStatus={resolvedAssetStatus}
            failureCode={statusResponse?.failureCode}
            retryError={retryError}
            isRetrying={isRetrying}
            onRetry={onRetryProcessing}
          />
          <details className="processing-details">
            <summary>{t('details.processingDetails')}</summary>
            <p>{t(getProcessingSummaryKey(resolvedAssetStatus))}</p>
            {statusError ? <ErrorFeedback error={statusError} /> : null}
            <AssetIndexingRecoveryAction
              resolvedAssetStatus={resolvedAssetStatus}
              statusResponse={statusResponse}
              transcriptRows={transcriptRows}
              transcriptError={transcriptError}
              indexError={indexError}
              indexResponse={indexResponse}
              isIndexing={isIndexing}
              onIndex={onIndex}
            />
          </details>
        </section>
      </div>
    </div>
  );
}

/**
 * Brings the media region on screen when, and only when, it is not already visible.
 *
 * A moment opened from search must not leave the learner looking at an unrelated part of the
 * page, but an already visible player must never be repositioned under them. The move is
 * deliberately immediate: the page scrolls smoothly by default, and an animated jump can be
 * interrupted or left unfinished, which would leave the opened moment off screen after all.
 */
function revealPlayerRegion(region: HTMLElement | null) {
  if (!region || typeof region.scrollIntoView !== 'function') return;

  const bounds = region.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (bounds.top >= 0 && bounds.bottom <= viewportHeight) return;

  region.scrollIntoView({ block: 'center', behavior: 'instant' });
}

function useMobileStudyLayout(): boolean {
  const query = '(max-width: 760px)';
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return matches;
}

/** `viewer` namespace key for the Processing-details summary of an Asset status. */
function getProcessingSummaryKey(status: AssetStatus | null) {
  switch (status) {
    case 'SEARCHABLE': return 'details.summarySearchable' as const;
    case 'TRANSCRIPT_READY': return 'details.summaryTranscriptReady' as const;
    case 'FAILED': return 'details.summaryFailed' as const;
    case 'PROCESSING':
    default: return 'details.summaryProcessing' as const;
  }
}
