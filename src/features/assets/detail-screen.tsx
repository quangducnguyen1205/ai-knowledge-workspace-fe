import type {
  AssetIndexResponse,
  AssetStatus,
  AssetStatusResponse,
  AssetSummary,
  AssistantAnswerCitation,
  SearchResponse,
  SearchResult,
  TranscriptContextResponse,
  TranscriptRow,
} from '../../lib/api';
import { buildTranscriptDisplayRows, matchesTranscriptReference } from '../../entities/transcript/model/transcript-display';
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingBlock, Section, formatDateTime } from '../../lib/ui';
import { SelectedAssetPanel, SelectedAssetTranscriptPanel, StatusBadge } from './assets';
import { AssetAssistantPanel } from '../assistant/assistant';
import { SearchPanel } from '../search/search';

type AssetDetailScreenProps = {
  workspaceId?: string;
  workspaceName: string;
  assets: AssetSummary[];
  asset: AssetSummary | null;
  successNotice: { title: string; message: string } | null;
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
  sourceSearchQuery: string | null;
  studyContextResponse?: TranscriptContextResponse;
  studyContextError: unknown;
  isStudyContextLoading: boolean;
  searchResetToken: number;
  searchableAssetCount: number;
  onIndex: () => void;
  onRename: (title: string) => void;
  onResetRename: () => void;
  onSearchWithinAsset: (query: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onOpenLibrary: () => void;
  onOpenSearch: () => void;
  onOpenAsset: (assetId: string) => void;
  onOpenAssistantCitation?: (citation: AssistantAnswerCitation) => void;
  onReturnToSearch?: () => void;
  onClearStudyContext?: () => void;
};

export function AssetDetailScreen({
  workspaceId,
  workspaceName,
  assets,
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
  sourceSearchQuery,
  studyContextResponse,
  studyContextError,
  isStudyContextLoading,
  searchResetToken,
  searchableAssetCount,
  onIndex,
  onRename,
  onResetRename,
  onSearchWithinAsset,
  onSelectSearchResult,
  onOpenLibrary,
  onOpenSearch,
  onOpenAsset,
  onOpenAssistantCitation,
  onReturnToSearch,
  onClearStudyContext,
}: AssetDetailScreenProps) {
  const otherAssets = assets.filter((currentAsset) => currentAsset.assetId !== asset?.assetId).slice(0, 5);
  const assetSearchableCount = resolvedAssetStatus === 'SEARCHABLE' ? 1 : 0;
  const assistantWorkspaceId = workspaceId ?? asset?.workspaceId ?? null;

  return (
    <div className="screen-grid screen-grid--detail">
      <div className="screen-main">
        <SelectedAssetPanel
          asset={asset}
          workspaceName={workspaceName}
          successNotice={successNotice}
          resolvedAssetStatus={resolvedAssetStatus}
          statusResponse={statusResponse}
          statusError={statusError}
          transcriptRows={transcriptRows}
          transcriptError={transcriptError}
          transcriptLoading={transcriptLoading}
          indexError={indexError}
          indexResponse={indexResponse}
          isIndexing={isIndexing}
          isRenaming={isRenaming}
          renameError={renameError}
          onIndex={onIndex}
          onRename={onRename}
          onResetRename={onResetRename}
        />

        {asset && assistantWorkspaceId && onOpenAssistantCitation ? (
          <AssetAssistantPanel
            workspaceId={assistantWorkspaceId}
            workspaceName={workspaceName}
            assetId={asset.assetId}
            assetTitle={asset.title}
            isAssetSearchable={resolvedAssetStatus === 'SEARCHABLE'}
            onOpenCitationContext={onOpenAssistantCitation}
          />
        ) : null}

        {asset && focusedTranscriptRowId ? (
          <TranscriptStudyContextPanel
            assetTitle={asset.title}
            workspaceName={workspaceName}
            focusedTranscriptRowId={focusedTranscriptRowId}
            source={focusedTranscriptSource}
            sourceSearchQuery={sourceSearchQuery}
            contextResponse={studyContextResponse}
            contextError={studyContextError}
            isContextLoading={isStudyContextLoading}
            onReturnToSearch={onReturnToSearch}
            onClearStudyContext={onClearStudyContext}
          />
        ) : null}

        {asset ? (
          <SearchPanel
            workspaceName={workspaceName}
            searchableAssetCount={assetSearchableCount}
            resetToken={searchResetToken}
            activeQuery={activeQuery}
            searchResponse={searchResponse}
            searchError={searchError}
            isSearching={isSearching}
            contextResponse={contextResponse}
            contextError={contextError}
            isContextLoading={isContextLoading}
            selectedResult={selectedSearchResult}
            scope={{ mode: 'asset', assetTitle: asset.title }}
            onSearch={onSearchWithinAsset}
            onSelectResult={onSelectSearchResult}
          />
        ) : null}

        <SelectedAssetTranscriptPanel
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
      </div>

      <div className="screen-side">
        <Section title="Asset navigation" eyebrow={workspaceName}>
          {!asset ? (
            <EmptyState
              title="No asset selected"
              description="Open the library to choose an asset and follow its automatic path to search."
            />
          ) : (
            <div className="summary-list">
              <div className="summary-list__item">
                <span className="summary-list__label">Current asset</span>
                <strong>{asset.title}</strong>
              </div>
              <div className="summary-list__item">
                <span className="summary-list__label">Current status</span>
                <div className="summary-list__status">
                  <StatusBadge status={resolvedAssetStatus} />
                </div>
              </div>
              <div className="guidance-card__actions">
                <Button type="button" onClick={onOpenLibrary}>
                  Back to library
                </Button>
                <Button type="button" tone="ghost" onClick={onOpenSearch} disabled={searchableAssetCount === 0}>
                  Open search
                </Button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Other assets" eyebrow="Workspace library">
          {otherAssets.length === 0 ? (
            <EmptyState
              title="No additional assets yet"
              description="Upload more lecture videos in the library if you want a broader searchable workspace."
            />
          ) : (
            <div className="compact-list">
              {otherAssets.map((otherAsset) => (
                <button
                  key={otherAsset.assetId}
                  type="button"
                  className="compact-list__button"
                  onClick={() => onOpenAsset(otherAsset.assetId)}
                >
                  <div className="compact-list__header">
                    <strong>{otherAsset.title}</strong>
                    <StatusBadge status={otherAsset.assetStatus} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function TranscriptStudyContextPanel({
  assetTitle,
  workspaceName,
  focusedTranscriptRowId,
  source,
  sourceSearchQuery,
  contextResponse,
  contextError,
  isContextLoading,
  onReturnToSearch,
  onClearStudyContext,
}: {
  assetTitle: string;
  workspaceName: string;
  focusedTranscriptRowId: string;
  source?: 'search' | 'assistant' | null;
  sourceSearchQuery: string | null;
  contextResponse?: TranscriptContextResponse;
  contextError: unknown;
  isContextLoading: boolean;
  onReturnToSearch?: () => void;
  onClearStudyContext?: () => void;
}) {
  const displayContextRows = contextResponse?.rows.length ? buildTranscriptDisplayRows(contextResponse.rows) : [];
  const resolvedSource = source ?? (sourceSearchQuery ? 'search' : null);
  const sourceTitle =
    resolvedSource === 'search'
      ? 'Opened from workspace search'
      : resolvedSource === 'assistant'
        ? 'Opened from assistant citation'
        : 'Focused transcript reference';
  const sourceMessage =
    resolvedSource === 'search'
      ? sourceSearchQuery
        ? `This asset detail view is focused on a transcript match for "${sourceSearchQuery}".`
        : 'This asset detail view is focused on a selected transcript match.'
      : resolvedSource === 'assistant'
        ? 'This asset detail view is focused on a cited transcript reference from the assistant answer.'
        : 'This asset detail view is focused on a transcript reference carried in the route.';
  const hitLabel =
    resolvedSource === 'assistant' ? 'Citation source' : resolvedSource === 'search' ? 'Search hit' : 'Focused row';

  return (
    <Section
      title="Study this moment"
      eyebrow={assetTitle}
      actions={
        <div className="study-context__actions">
          {onReturnToSearch ? (
            <Button type="button" tone="secondary" onClick={onReturnToSearch}>
              Back to search
            </Button>
          ) : null}
          {onClearStudyContext ? (
            <Button type="button" tone="ghost" onClick={onClearStudyContext}>
              Clear focus
            </Button>
          ) : null}
        </div>
      }
    >
      <InfoBanner
        title={sourceTitle}
        message={sourceMessage}
        detail={`Workspace: ${workspaceName}. Nearby context uses the existing transcript context API.`}
      />

      {isContextLoading ? <LoadingBlock label="Loading selected transcript context..." /> : null}

      {!isContextLoading && contextError ? (
        <ErrorBanner
          error={contextError}
          title="Selected transcript row is unavailable"
          message="The selected search hit could not be loaded. Return to search or review the full transcript below."
        />
      ) : null}

      {!isContextLoading && !contextError && !contextResponse ? (
        <EmptyState
          title="Context not available yet"
          description="The selected search hit is still carried in the route, but nearby transcript rows are not loaded."
        />
      ) : null}

      {contextResponse ? (
        <div className="context-window study-context">
          <div className="context-window__meta">
            <span>Hit segment: {contextResponse.hitSegmentIndex ?? 'n/a'}</span>
            <span>Context window: {contextResponse.window}</span>
          </div>

          <ol className="transcript-list transcript-list--compact">
            {displayContextRows.map(({ row, displayText, overlapHidden }) => {
              const isHit = matchesTranscriptReference(row, focusedTranscriptRowId);

              return (
                <li
                  key={row.id ?? `segment-${row.segmentIndex ?? 'missing'}`}
                  className={`transcript-list__item ${isHit ? 'transcript-list__item--active' : ''}`}
                >
                  <div className="transcript-list__meta">
                    <span>Segment {row.segmentIndex ?? 'n/a'}</span>
                    <span>{formatDateTime(row.createdAt)}</span>
                    {overlapHidden ? <span className="transcript-overlap-note">Overlap hidden</span> : null}
                    {isHit ? <span className="hit-pill">{hitLabel}</span> : null}
                  </div>
                  <p>{displayText}</p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </Section>
  );
}
