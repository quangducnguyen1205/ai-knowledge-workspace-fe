import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRoute, routeToHash } from '../../app/router';
import type {
  AssetStatus,
  AssetSummary,
} from '../assets/model/types';
import type {
  SearchResponse,
  SearchResult,
} from './api/search-api';
import type {
  TranscriptContextResponse,
  TranscriptRow,
} from '../../entities/transcript/model/types';
import { AssetDetailScreen } from '../assets/detail-screen';
import { shouldPollAssetStatus } from '../assets/assets';
import { SearchPanel, resolveTranscriptLookupId } from './search';

const workspaceName = 'Distributed Systems';

const baseResult: SearchResult = {
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  text: 'Vector clocks preserve causal relationships between events in distributed systems.',
  createdAt: '2026-06-26T10:02:00Z',
  score: 3.21,
};

const searchResponse: SearchResponse = {
  query: 'vector clocks',
  workspaceIdFilter: 'workspace-1',
  assetIdFilter: null,
  resultCount: 1,
  results: [baseResult],
};

const asset: AssetSummary = {
  assetId: 'asset-1',
  title: 'Vector Clocks Lecture',
  assetStatus: 'SEARCHABLE',
  workspaceId: 'workspace-1',
  createdAt: '2026-06-26T10:00:00Z',
};

const transcriptRows: TranscriptRow[] = [
  {
    id: 'row-1',
    videoId: 'asset-1',
    segmentIndex: 1,
    text: 'First we define happens-before relationships.',
    createdAt: '2026-06-26T10:01:00Z',
  },
  {
    id: 'row-2',
    videoId: 'asset-1',
    segmentIndex: 2,
    text: 'Vector clocks preserve causal relationships between events in distributed systems.',
    createdAt: '2026-06-26T10:02:00Z',
  },
  {
    id: 'row-3',
    videoId: 'asset-1',
    segmentIndex: 3,
    text: 'Concurrent events do not have a total ordering.',
    createdAt: '2026-06-26T10:03:00Z',
  },
];

const contextResponse: TranscriptContextResponse = {
  assetId: 'asset-1',
  transcriptRowId: 'row-2',
  hitSegmentIndex: 2,
  window: 2,
  rows: transcriptRows,
};

function renderSearchPanel(overrides: Partial<ComponentProps<typeof SearchPanel>> = {}) {
  const props: ComponentProps<typeof SearchPanel> = {
    workspaceName,
    searchableAssetCount: 1,
    resetToken: 0,
    activeQuery: null,
    searchResponse: undefined,
    searchError: null,
    isSearching: false,
    contextResponse: undefined,
    contextError: null,
    isContextLoading: false,
    selectedResult: null,
    onSearch: vi.fn(),
    onSelectResult: vi.fn(),
    ...overrides,
  };

  render(<SearchPanel {...props} />);

  return props;
}

function renderAssetDetail(overrides: Partial<ComponentProps<typeof AssetDetailScreen>> = {}) {
  const props: ComponentProps<typeof AssetDetailScreen> = {
    workspaceName,
    assets: [asset],
    asset,
    successNotice: null,
    resolvedAssetStatus: asset.assetStatus as AssetStatus,
    statusResponse: undefined,
    statusError: null,
    transcriptRows,
    transcriptError: null,
    transcriptLoading: false,
    indexError: null,
    indexResponse: undefined,
    isIndexing: false,
    isRenaming: false,
    renameError: null,
    activeQuery: null,
    searchResponse: undefined,
    searchError: null,
    isSearching: false,
    contextResponse: undefined,
    contextError: null,
    isContextLoading: false,
    selectedSearchResult: null,
    focusedTranscriptRowId: null,
    sourceSearchQuery: null,
    studyContextResponse: undefined,
    studyContextError: null,
    isStudyContextLoading: false,
    searchResetToken: 0,
    searchableAssetCount: 1,
    onIndex: vi.fn(),
    onRename: vi.fn(),
    onResetRename: vi.fn(),
    onSearchWithinAsset: vi.fn(),
    onSelectSearchResult: vi.fn(),
    onOpenLibrary: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenAsset: vi.fn(),
    ...overrides,
  };

  render(<AssetDetailScreen {...props} />);

  return props;
}

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('search-to-study workflow', () => {
  it('polls through processing and transcript readiness, then stops at searchable', () => {
    expect(
      (['PROCESSING', 'TRANSCRIPT_READY', 'SEARCHABLE'] as const).map((status) => shouldPollAssetStatus(status)),
    ).toEqual([true, true, false]);
  });

  it('renders a labelled search control and initial state', () => {
    renderSearchPanel();

    expect(screen.getByLabelText(/search transcript text/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
    expect(screen.getByText(/search this workspace/i)).toBeInTheDocument();
  });

  it('shows result asset identity and a context-opening action', () => {
    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext: vi.fn(),
    });

    expect(screen.getByText('Vector Clocks Lecture')).toBeInTheDocument();
    expect(screen.getByText(/vector clocks preserve causal relationships/i)).toBeInTheDocument();
    expect(screen.getByText(/moment: segment 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study result 1 in vector clocks lecture/i })).toBeEnabled();
  });

  it('opens an existing Asset Detail route with asset and transcript-row identity', async () => {
    const user = userEvent.setup();

    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext: (result) => {
        const transcriptRowId = resolveTranscriptLookupId(result);
        if (!transcriptRowId) {
          return;
        }

        window.location.hash = routeToHash({
          name: 'asset',
          assetId: result.assetId,
          transcriptRowId,
          source: 'search',
          searchQuery: 'vector clocks',
        });
      },
    });

    await user.click(screen.getByRole('button', { name: /study result 1 in vector clocks lecture/i }));

    expect(parseRoute(window.location.hash)).toEqual({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'row-2',
      source: 'search',
      searchQuery: 'vector clocks',
    });
  });

  it('keeps search loading, empty, and error states readable', () => {
    const { rerender } = render(
      <SearchPanel
        workspaceName={workspaceName}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="vector clocks"
        searchResponse={undefined}
        searchError={null}
        isSearching
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByText(/searching transcript content/i)).toBeInTheDocument();

    rerender(
      <SearchPanel
        workspaceName={workspaceName}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="missing topic"
        searchResponse={{ ...searchResponse, resultCount: 0, results: [] }}
        searchError={null}
        isSearching={false}
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByText(/no matches in this workspace/i)).toBeInTheDocument();

    rerender(
      <SearchPanel
        workspaceName={workspaceName}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="vector clocks"
        searchResponse={undefined}
        searchError={new Error('Search service unavailable')}
        isSearching={false}
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByText(/search service unavailable/i)).toBeInTheDocument();
  });

  it('renders selected transcript context on Asset Detail', () => {
    renderAssetDetail({
      focusedTranscriptRowId: 'row-2',
      sourceSearchQuery: 'vector clocks',
      studyContextResponse: contextResponse,
    });

    expect(screen.getByRole('heading', { name: /study this moment/i })).toBeInTheDocument();
    expect(screen.getByText(/opened from workspace search/i)).toBeInTheDocument();
    expect(screen.getAllByText(/search hit/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/vector clocks preserve causal relationships/i)).not.toHaveLength(0);
  });

  it('keeps manual indexing as a fallback only while the asset is transcript ready', () => {
    const transcriptReadyAsset = { ...asset, assetStatus: 'TRANSCRIPT_READY' as const };

    renderAssetDetail({
      workspaceId: 'workspace-1',
      assets: [transcriptReadyAsset],
      asset: transcriptReadyAsset,
      resolvedAssetStatus: 'TRANSCRIPT_READY',
      searchableAssetCount: 0,
      onOpenAssistantCitation: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Index transcript' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Indexing fallback' })).toBeInTheDocument();
    expect(screen.getByText(/automatic indexing has not completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  it('requires no manual indexing after automatic completion and enables the assistant', () => {
    renderAssetDetail({
      workspaceId: 'workspace-1',
      onOpenAssistantCitation: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: /index transcript|re-index transcript/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/indexing fallback/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('preserves canonical transcript display without a selected row', () => {
    renderAssetDetail();

    expect(screen.queryByRole('heading', { name: /study this moment/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /transcript review/i })).toBeInTheDocument();
    expect(screen.getByText(/first we define happens-before/i)).toBeInTheDocument();
  });

  it('shows safe feedback when the selected row is missing from the visible transcript', () => {
    renderAssetDetail({
      focusedTranscriptRowId: 'row-missing',
      sourceSearchQuery: 'vector clocks',
      studyContextResponse: undefined,
    });

    expect(screen.getByText(/context not available yet/i)).toBeInTheDocument();
    expect(screen.getByText(/selected search row is not visible in this transcript/i)).toBeInTheDocument();
  });

  it('keeps a search-return action when detail was opened from search', async () => {
    const user = userEvent.setup();
    const onReturnToSearch = vi.fn();

    renderAssetDetail({
      focusedTranscriptRowId: 'row-2',
      sourceSearchQuery: 'vector clocks',
      studyContextResponse: contextResponse,
      onReturnToSearch,
    });

    await user.click(screen.getByRole('button', { name: /back to search/i }));

    expect(onReturnToSearch).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard activation for the context-opening action', async () => {
    const user = userEvent.setup();
    const onOpenResultContext = vi.fn();

    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext,
    });

    const action = screen.getByRole('button', { name: /study result 1 in vector clocks lecture/i });
    action.focus();
    await user.keyboard('{Enter}');

    expect(onOpenResultContext).toHaveBeenCalledWith(baseResult);
  });
});
