import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type {
  AssetIndexResponse,
  AssetStatus,
  AssetStatusResponse,
  AssetSummary,
} from './model/types';
import type { AssistantAnswerCitation } from '../assistant/model/types';
import type { SearchResponse, SearchResult } from '../search/api/search-api';
import type { TranscriptContextResponse, TranscriptRow } from '../../entities/transcript/model/types';
import { Button, EmptyState, ErrorBanner, InfoBanner, SuccessNotification, formatDateTime } from '../../lib/ui';
import type { EphemeralNotice } from '../../shared/ui/use-ephemeral-notice';
import { getFriendlyRenameErrorCopy } from './model/error-copy';
import { AssetIndexingRecoveryAction } from './components/asset-indexing-recovery-action';
import { SelectedAssetTranscriptPanel } from './components/selected-asset-transcript-panel';
import { StatusBadge } from './components/status-badge';
import { AssetAssistantPanel } from '../assistant/components/asset-assistant-panel';
import { SearchPanel } from '../search/search';

type StudyTab = 'transcript' | 'ask' | 'details';

type AssetDetailScreenProps = {
  workspaceId?: string;
  workspaceName: string;
  asset: AssetSummary | null;
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
  onIndex: () => void;
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
};

export function AssetDetailScreen({
  workspaceId,
  workspaceName,
  asset,
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
  onIndex,
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
}: AssetDetailScreenProps) {
  const [activeTab, setActiveTab] = useState<StudyTab>('transcript');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const isMobileStudyLayout = useMobileStudyLayout();
  const assistantWorkspaceId = workspaceId ?? asset?.workspaceId ?? null;
  const renameErrorCopy = getFriendlyRenameErrorCopy(renameError);
  const transcriptRowCount = transcriptRows?.length ?? 0;

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
        <header className="page-header"><div className="page-header__copy"><h1>Video</h1></div></header>
        <EmptyState title="Video unavailable" description="Return to the library and choose another video." />
      </div>
    );
  }

  return (
    <div className="study-screen">
      <header className="study-header">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={onOpenLibrary}>Library</button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Study</span>
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
              aria-label={`Actions for ${asset.title}`}
              aria-expanded={isActionMenuOpen}
              onClick={() => setIsActionMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">•••</span>
            </button>
            {isActionMenuOpen ? (
              <div className="overflow-menu__popover" aria-label="Video actions">
                <button
                  type="button"
                  onClick={() => {
                    onResetRename();
                    setDraftTitle(asset.title);
                    setIsEditingTitle(true);
                    setIsActionMenuOpen(false);
                  }}
                >
                  Rename
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
                  {isDeleting ? 'Deleting...' : 'Delete'}
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
              <span className="field__label">Video title</span>
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
              {isRenaming ? 'Saving...' : 'Save'}
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
              Cancel
            </Button>
          </form>
        ) : null}

        {renameErrorCopy?.tone === 'warning' ? <InfoBanner tone="warning" title={renameErrorCopy.title} message={renameErrorCopy.message} /> : null}
        {renameErrorCopy?.tone === 'error' ? <ErrorBanner error={renameError} title={renameErrorCopy.title} message={renameErrorCopy.message} /> : null}
        {successNotice ? (
          <SuccessNotification
            title={successNotice.title}
            message={successNotice.message}
            onDismiss={successNotice.dismiss}
          />
        ) : null}
      </header>

      <div className="study-tabs" role="tablist" aria-label="Study views">
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
            {tab === 'ask' ? 'Ask' : tab[0].toUpperCase() + tab.slice(1)}
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
            <p className="panel__eyebrow">Video</p>
            <h2>Details</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Workspace</dt><dd>{workspaceName}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={resolvedAssetStatus} /></dd></div>
            <div><dt>Added</dt><dd>{formatDateTime(asset.createdAt)}</dd></div>
            <div><dt>Transcript</dt><dd>{transcriptRowCount ? `${transcriptRowCount} segments` : 'Not ready yet'}</dd></div>
          </dl>
          <details className="processing-details">
            <summary>Processing details</summary>
            <p>{getProcessingSummary(resolvedAssetStatus)}</p>
            {statusError ? <ErrorBanner error={statusError} /> : null}
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

function getProcessingSummary(status: AssetStatus | null): string {
  switch (status) {
    case 'SEARCHABLE': return 'This video is ready to search and ask questions about.';
    case 'TRANSCRIPT_READY': return 'The transcript is ready while search preparation finishes.';
    case 'FAILED': return 'This video could not be processed.';
    case 'PROCESSING':
    default: return 'The video is being prepared. This page updates automatically.';
  }
}
