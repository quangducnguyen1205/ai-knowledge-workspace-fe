import type { ComponentProps } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { shouldPollAssetStatus } from '../assets/model/lifecycle';
import { SearchPanel } from './search';
import { resolveTranscriptLookupId } from './model/search-result-reference';

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
    isDeleting: false,
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
    studyContextResponse: undefined,
    studyContextError: null,
    isStudyContextLoading: false,
    searchResetToken: 0,
    onIndex: vi.fn(),
    onRename: vi.fn(),
    onResetRename: vi.fn(),
    onDelete: vi.fn(),
    onOpenAssistantCitation: vi.fn(),
    onSearchWithinAsset: vi.fn(),
    onSelectSearchResult: vi.fn(),
    onOpenTranscriptMoment: vi.fn(),
    onOpenLibrary: vi.fn(),
    ...overrides,
  };

  const view = render(<AssetDetailScreen {...props} />);

  return { ...view, props };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
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

    expect(screen.getByLabelText(/search workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
    expect(screen.getByText(/search your learning workspace/i)).toBeInTheDocument();
  });

  it('shows result asset identity and makes the excerpt the moment-opening action', () => {
    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext: vi.fn(),
    });

    expect(screen.getByText('Vector Clocks Lecture')).toBeInTheDocument();
    expect(screen.getByText(/vector clocks preserve causal relationships/i)).toBeInTheDocument();
    expect(screen.getByText(/transcript moment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open moment 1 in vector clocks lecture/i })).toBeEnabled();
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

    await user.click(screen.getByText(/vector clocks preserve causal relationships/i));

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

    expect(screen.getByText(/searching your workspace/i)).toBeInTheDocument();

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

    expect(screen.getByText(/no matches found/i)).toBeInTheDocument();

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

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The action could not be completed. Try again later.')).toBeInTheDocument();
    expect(screen.queryByText(/search service unavailable/i)).not.toBeInTheDocument();
  });

  it('renders one canonical selected-context region with the matched row highlighted', async () => {
    const user = userEvent.setup();
    const onClearStudyContext = vi.fn();
    renderAssetDetail({
      focusedTranscriptRowId: 'row-2',
      studyContextResponse: contextResponse,
      onClearStudyContext,
    });

    const contextRegions = screen.getAllByRole('region', { name: 'Selected context' });
    expect(contextRegions).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: /search result in context/i })).not.toBeInTheDocument();
    const matchedRow = within(contextRegions[0]).getByText(/vector clocks preserve causal relationships/i).closest('li');
    expect(matchedRow).toHaveClass('transcript-list__item--active');
    expect(within(contextRegions[0]).getAllByRole('listitem')).toHaveLength(3);

    await user.click(within(contextRegions[0]).getByRole('button', { name: 'Clear' }));
    expect(onClearStudyContext).toHaveBeenCalledTimes(1);
  });

  it('focuses and scrolls the exact rendered transcript row when the target changes on the same asset', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const view = renderAssetDetail({ focusedTranscriptRowId: 'row-2' });

    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks preserve/i);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    view.rerender(<AssetDetailScreen {...view.props} focusedTranscriptRowId="row-1" />);

    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/first we define/i);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('keeps manual search preparation as a disclosed fallback only while the transcript is ready', async () => {
    const user = userEvent.setup();
    const transcriptReadyAsset = { ...asset, assetStatus: 'TRANSCRIPT_READY' as const };

    renderAssetDetail({
      workspaceId: 'workspace-1',
      asset: transcriptReadyAsset,
      resolvedAssetStatus: 'TRANSCRIPT_READY',
      onOpenAssistantCitation: vi.fn(),
    });

    await user.click(screen.getByText('Processing details'));
    expect(screen.getByRole('button', { name: 'Retry search preparation' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Search preparation needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  it('requires no manual indexing after automatic completion and enables the assistant', () => {
    renderAssetDetail({
      workspaceId: 'workspace-1',
      onOpenAssistantCitation: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: /retry search preparation/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('composes transcript, ask, and details as focused study views', () => {
    renderAssetDetail();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Transcript', 'Ask', 'Details']);
    expect(screen.queryByRole('heading', { name: /search result in context/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^transcript$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ask this video/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^details$/i })).toBeInTheDocument();
    expect(screen.getByText(/first we define happens-before/i)).toBeInTheDocument();
  });

  it('uses deliberate Transcript, Ask, and Details tabs in the mobile study layout', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(max-width: 760px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    const view = renderAssetDetail();

    expect(document.getElementById('study-pane-ask')).toHaveAttribute('hidden');
    await user.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByRole('tab', { name: 'Ask' })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('study-pane-transcript')).toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { name: 'Ask this video' })).toBeInTheDocument();

    view.rerender(<AssetDetailScreen {...view.props} focusedTranscriptRowId="row-2" />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Transcript' })).toHaveAttribute('aria-selected', 'true'));
    expect(document.getElementById('study-pane-transcript')).not.toHaveAttribute('hidden');
  });

  it('shows safe feedback when the selected row is missing from the visible transcript', () => {
    renderAssetDetail({
      focusedTranscriptRowId: 'row-missing',
      studyContextResponse: undefined,
    });

    expect(screen.getByText(/context unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/selected moment is not visible/i)).toBeInTheDocument();
  });

  it('keeps a search-return action when detail was opened from search', async () => {
    const user = userEvent.setup();
    const onReturnToSearch = vi.fn();

    renderAssetDetail({
      focusedTranscriptRowId: 'row-2',
      studyContextResponse: contextResponse,
      onReturnToSearch,
    });

    await user.click(screen.getByRole('button', { name: /back to search/i }));

    expect(onReturnToSearch).toHaveBeenCalledTimes(1);
  });

  it('supports Enter and Space keyboard activation for the moment excerpt', async () => {
    const user = userEvent.setup();
    const onOpenResultContext = vi.fn();

    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext,
    });

    const action = screen.getByRole('button', { name: /open moment 1 in vector clocks lecture/i });
    action.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onOpenResultContext).toHaveBeenCalledTimes(2);
    expect(onOpenResultContext).toHaveBeenLastCalledWith(baseResult);
  });
});
