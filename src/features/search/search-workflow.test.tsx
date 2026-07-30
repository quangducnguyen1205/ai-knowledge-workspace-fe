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
import { WorkspaceSearchScreen } from './search-screen';
import { resolveTranscriptLookupId } from './model/search-result-reference';

const workspaceName = 'Distributed Systems';

const baseResult: SearchResult = {
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  startMs: 1000,
  endMs: 2000,
  text: 'Vector clocks preserve causal relationships between events in distributed systems.',
  contextSnippet: null,
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
  sourceType: 'UPLOAD',
  youtubeVideoId: null,
  sourceUrl: null,
  createdAt: '2026-06-26T10:00:00Z',
};

const transcriptRows: TranscriptRow[] = [
  {
    id: 'row-1',
    videoId: 'asset-1',
    segmentIndex: 1,
    startMs: 0,
    endMs: 999,
    text: 'First we define happens-before relationships.',
    createdAt: '2026-06-26T10:01:00Z',
  },
  {
    id: 'row-2',
    videoId: 'asset-1',
    segmentIndex: 2,
    startMs: 1000,
    endMs: 2000,
    text: 'Vector clocks preserve causal relationships between events in distributed systems.',
    createdAt: '2026-06-26T10:02:00Z',
  },
  {
    id: 'row-3',
    videoId: 'asset-1',
    segmentIndex: 3,
    startMs: null,
    endMs: null,
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
    assetSources: [asset],
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
    retryError: null,
    isRetrying: false,
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
    onRetryProcessing: vi.fn(),
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

    expect(screen.getByLabelText(`Search within ${workspaceName}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled();
    expect(screen.getByText(/search this workspace/i)).toBeInTheDocument();
  });

  it('shows Asset, source, timestamp, snippet, and an accessible moment-opening action', () => {
    renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse,
      onOpenResultContext: vi.fn(),
    });

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    expect(within(action).getByText('Vector Clocks Lecture')).toBeInTheDocument();
    expect(within(action).getByText('Upload')).toBeInTheDocument();
    expect(within(action).getByText('00:01')).toBeInTheDocument();
    expect(screen.getByText(/vector clocks preserve causal relationships/i)).toBeInTheDocument();
    expect(within(action).getByText(/video moment/i)).toBeInTheDocument();
    expect(action).toBeEnabled();
  });

  it('groups interleaved backend moments without changing group or moment order', () => {
    const youtubeResult: SearchResult = {
      ...baseResult,
      assetId: 'asset-2',
      assetTitle: 'Incident Review',
      transcriptRowId: 'row-b-1',
      segmentIndex: 0,
      startMs: 0,
      endMs: 900,
      text: 'The incident timeline starts with the first alert.',
      score: 99,
    };
    const laterFirstAssetResult: SearchResult = {
      ...baseResult,
      transcriptRowId: 'row-a-2',
      segmentIndex: 9,
      startMs: 520_000,
      endMs: 522_000,
      text: 'A later ranked result for vector clocks.',
      score: 0.01,
    };

    renderSearchPanel({
      assetSources: [
        asset,
        { assetId: 'asset-2', sourceType: 'YOUTUBE' },
      ],
      activeQuery: 'systems',
      searchResponse: {
        ...searchResponse,
        query: 'systems',
        resultCount: 3,
        results: [laterFirstAssetResult, youtubeResult, baseResult],
      },
      onOpenResultContext: vi.fn(),
    });

    expect(screen.getByRole('heading', { name: 'Video moments' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /3 matching moments · 3 shown across 2 videos/i,
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['Vector Clocks Lecture', 'Incident Review']);

    const firstGroup = screen.getByRole('heading', {
      name: 'Vector Clocks Lecture',
    }).closest('section');
    const secondGroup = screen.getByRole('heading', {
      name: 'Incident Review',
    }).closest('section');
    expect(firstGroup).not.toBeNull();
    expect(secondGroup).not.toBeNull();
    expect(within(firstGroup as HTMLElement).getByText('2 matching moments')).toBeInTheDocument();
    expect(within(secondGroup as HTMLElement).getByText('1 matching moment')).toBeInTheDocument();
    expect(within(firstGroup as HTMLElement).getAllByRole('button').map((button) => button.textContent))
      .toEqual([
        expect.stringContaining('A later ranked result for vector clocks.'),
        expect.stringContaining('Vector clocks preserve causal relationships'),
      ]);
    expect(within(secondGroup as HTMLElement).getAllByText('YouTube')).toHaveLength(2);
    expect(screen.getByRole('button', {
      name: 'Open moment in Incident Review at 00:00',
    })).toBeEnabled();
  });

  it('uses bounded fallbacks when optional moment presentation metadata is unavailable', () => {
    renderSearchPanel({
      assetSources: [],
      activeQuery: 'missing metadata',
      searchResponse: {
        ...searchResponse,
        query: 'missing metadata',
        results: [{
          ...baseResult,
          assetTitle: '   ',
          startMs: null,
          endMs: null,
          text: '',
        }],
      },
      onOpenResultContext: vi.fn(),
    });

    const action = screen.getByRole('button', {
      name: 'Open moment in Untitled video at time unavailable',
    });
    expect(within(action).getByText('Source unavailable')).toBeInTheDocument();
    expect(within(action).getByText('Time unavailable')).toBeInTheDocument();
    expect(within(action).getByText('Transcript snippet unavailable.')).toBeInTheDocument();
  });

  it('uses unavailable semantics when a result has no stable transcript identity', () => {
    renderSearchPanel({
      activeQuery: 'legacy moment',
      searchResponse: {
        ...searchResponse,
        query: 'legacy moment',
        results: [{
          ...baseResult,
          transcriptRowId: null,
          segmentIndex: null,
        }],
      },
      onOpenResultContext: vi.fn(),
    });

    expect(screen.getByRole('button', {
      name: 'Video moment unavailable in Vector Clocks Lecture at 00:01',
    })).toBeDisabled();
    expect(screen.queryByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    })).not.toBeInTheDocument();
  });

  it('keeps long mobile moment content inside the bounded grouped-result structure', () => {
    const longToken = `Incident-${'x'.repeat(180)}`;
    renderSearchPanel({
      activeQuery: longToken,
      searchResponse: {
        ...searchResponse,
        query: longToken,
        results: [{
          ...baseResult,
          assetTitle: longToken,
          text: longToken,
        }],
      },
      onOpenResultContext: vi.fn(),
    });

    const title = screen.getAllByText(longToken)[0];
    const action = screen.getByRole('button', {
      name: `Open moment in ${longToken} at 00:01`,
    });
    expect(title.closest('.search-result-group__identity')).not.toBeNull();
    expect(action).toHaveClass('search-result__moment');
    expect(within(action).getByText(longToken, { selector: '.search-result__excerpt' }))
      .toBeInTheDocument();
    expect(action.closest('.search-result-group')).not.toBeNull();
  });

  it('states the selected Workspace scope with semantic Search and results headings', () => {
    render(
      <WorkspaceSearchScreen
        workspaceName={workspaceName}
        assetSources={[asset]}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="vector clocks"
        routeQuery="vector clocks"
        searchResponse={searchResponse}
        searchError={null}
        isSearching={false}
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
        onOpenResultContext={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', {
      level: 1,
      name: `Search within ${workspaceName}`,
    })).toBeInTheDocument();
    expect(screen.getByRole('region', {
      name: `Workspace moment search for ${workspaceName}`,
    })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Video moments' })).toBeInTheDocument();
  });

  it('trims a keyboard-submitted natural content query', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    renderSearchPanel({ onSearch });

    const input = screen.getByLabelText(`Search within ${workspaceName}`);
    await user.type(input, '  causal ordering  ');
    await user.keyboard('{Enter}');

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith('causal ordering');
    expect(input).toHaveFocus();
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

    await user.click(screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    }));

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

    expect(screen.getByText(/searching within distributed systems/i)).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

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

    expect(screen.getByText(/no video moments found/i)).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    rerender(
      <SearchPanel
        workspaceName={workspaceName}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="vector clocks"
        assetSources={[asset]}
        searchResponse={searchResponse}
        searchError={new Error('Search service unavailable')}
        isSearching={false}
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
        onOpenResultContext={vi.fn()}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The action could not be completed. Try again later.')).toBeInTheDocument();
    expect(screen.queryByText(/search service unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Video moments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    })).not.toBeInTheDocument();
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

  it('focuses the exact rendered transcript row when the target changes without moving the document', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const windowScrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const documentScrollTop = document.documentElement.scrollTop;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const view = renderAssetDetail({ focusedTranscriptRowId: 'row-2' });

    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/vector clocks preserve/i);

    view.rerender(<AssetDetailScreen {...view.props} focusedTranscriptRowId="row-1" />);

    await waitFor(() => expect(screen.getByLabelText('Selected transcript moment')).toHaveFocus());
    expect(screen.getByLabelText('Selected transcript moment')).toHaveTextContent(/first we define/i);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(windowScrollTo).not.toHaveBeenCalled();
    expect(document.documentElement.scrollTop).toBe(documentScrollTop);
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

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    action.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onOpenResultContext).toHaveBeenCalledTimes(2);
    expect(onOpenResultContext).toHaveBeenLastCalledWith(baseResult);
  });
});

describe('canonical moment context previews', () => {
  const canonicalSnippet =
    'Before the hit we define happens-before. Vector clocks preserve causal relationships between events in distributed systems. Concurrent events have no total ordering.';

  function renderMoments(
    results: SearchResult[],
    overrides: Partial<ComponentProps<typeof SearchPanel>> = {},
  ) {
    return renderSearchPanel({
      activeQuery: 'vector clocks',
      searchResponse: { ...searchResponse, resultCount: results.length, results },
      onOpenResultContext: vi.fn(),
      ...overrides,
    });
  }

  function excerptOf(action: HTMLElement): HTMLElement {
    return action.querySelector('.search-result__excerpt') as HTMLElement;
  }

  it('renders the canonical snippet instead of the exact matching row text', () => {
    renderMoments([{ ...baseResult, contextSnippet: canonicalSnippet }]);

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    expect(excerptOf(action)).toHaveTextContent(canonicalSnippet);
    expect(excerptOf(action).textContent).toBe(canonicalSnippet);
    expect(screen.queryByText(baseResult.text, { selector: '.search-result__excerpt' }))
      .not.toBeInTheDocument();
  });

  it('falls back to the matching row text for null, absent, and whitespace snippets', () => {
    const absentSnippet: SearchResult = { ...baseResult, transcriptRowId: 'row-absent' };
    Reflect.deleteProperty(absentSnippet, 'contextSnippet');

    renderMoments([
      { ...baseResult, transcriptRowId: 'row-null', contextSnippet: null },
      absentSnippet,
      { ...baseResult, transcriptRowId: 'row-blank', contextSnippet: '   \n\t ' },
    ]);

    const excerpts = document.querySelectorAll('.search-result__excerpt');
    expect(excerpts).toHaveLength(3);
    expect(Array.from(excerpts).map((excerpt) => excerpt.textContent)).toEqual([
      baseResult.text,
      baseResult.text,
      baseResult.text,
    ]);
  });

  it('uses the bounded fallback when neither snippet nor text is readable', () => {
    renderMoments([{ ...baseResult, contextSnippet: '  ', text: '   ' }]);

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    expect(excerptOf(action).textContent).toBe('Transcript snippet unavailable.');
  });

  it('renders a Vietnamese snippet as readable plain text', () => {
    const vietnameseSnippet =
      'Trước đoạn khớp: định nghĩa quan hệ xảy ra trước. Đồng hồ vector giữ quan hệ nhân quả giữa các sự kiện.';
    renderMoments([{ ...baseResult, contextSnippet: vietnameseSnippet }]);

    const excerpt = excerptOf(screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    }));
    expect(excerpt.textContent).toBe(vietnameseSnippet);
    expect(excerpt.querySelectorAll('*')).toHaveLength(0);
  });

  it('does not interpret markup inside a snippet as HTML', () => {
    const markupSnippet = 'Compare <em>vector</em> clocks & <script>alert(1)</script> ordering.';
    renderMoments([{ ...baseResult, contextSnippet: markupSnippet }]);

    const excerpt = excerptOf(screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    }));
    expect(excerpt.textContent).toBe(markupSnippet);
    expect(excerpt.querySelector('em')).toBeNull();
    expect(excerpt.querySelector('script')).toBeNull();
    expect(excerpt.innerHTML).not.toContain('<em>');
  });

  it('keeps a long snippet wrapping inside the bounded grouped-result structure', () => {
    const longSnippet = `Context-${'y'.repeat(600)}`;
    renderMoments([{ ...baseResult, contextSnippet: longSnippet }]);

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    const excerpt = excerptOf(action);
    expect(excerpt.textContent).toBe(longSnippet);
    expect(excerpt.closest('.search-result__moment')).toBe(action);
    expect(action.closest('.search-result-group')).not.toBeNull();
    expect(action).toHaveClass('search-result__moment');
  });

  it('keeps the accessible action name based on Asset title and timestamp, not the snippet', () => {
    const longSnippet = `Context-${'z'.repeat(600)}`;
    renderMoments([{ ...baseResult, contextSnippet: longSnippet }]);

    const action = screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    });
    const accessibleName = action.getAttribute('aria-label') ?? '';
    expect(accessibleName).toBe('Open moment in Vector Clocks Lecture at 00:01');
    expect(accessibleName).not.toContain(longSnippet);
    expect(accessibleName).not.toContain('Context-');
    expect(accessibleName.length).toBeLessThan(120);
    expect(excerptOf(action).textContent).toBe(longSnippet);
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('keeps group order, moment order, timestamps and source badges unchanged', () => {
    const laterMoment: SearchResult = {
      ...baseResult,
      transcriptRowId: 'row-a-2',
      segmentIndex: 9,
      startMs: 520_000,
      endMs: 522_000,
      text: 'A later ranked result for vector clocks.',
      contextSnippet: 'Canonical context for the later moment.',
      score: 0.01,
    };
    const youtubeMoment: SearchResult = {
      ...baseResult,
      assetId: 'asset-2',
      assetTitle: 'Incident Review',
      transcriptRowId: 'row-b-1',
      segmentIndex: 0,
      startMs: 0,
      endMs: 900,
      text: 'The incident timeline starts with the first alert.',
      contextSnippet: null,
      score: 99,
    };

    renderMoments(
      [laterMoment, youtubeMoment, { ...baseResult, contextSnippet: canonicalSnippet }],
      { assetSources: [asset, { assetId: 'asset-2', sourceType: 'YOUTUBE' }] },
    );

    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
      .toEqual(['Vector Clocks Lecture', 'Incident Review']);
    expect(Array.from(document.querySelectorAll('.search-result__excerpt'))
      .map((excerpt) => excerpt.textContent)).toEqual([
      'Canonical context for the later moment.',
      canonicalSnippet,
      'The incident timeline starts with the first alert.',
    ]);
    expect(Array.from(document.querySelectorAll('.search-result__timestamp-value'))
      .map((value) => value.textContent)).toEqual(['08:40', '00:01', '00:00']);
    expect(screen.getAllByText('Upload')).toHaveLength(3);
    expect(screen.getAllByText('YouTube')).toHaveLength(2);
  });

  it('opens the original transcript row identity when the preview came from a snippet', async () => {
    const user = userEvent.setup();
    const onOpenResultContext = vi.fn();
    const snippetResult: SearchResult = { ...baseResult, contextSnippet: canonicalSnippet };

    renderMoments([snippetResult], {
      onOpenResultContext: (result) => {
        onOpenResultContext(result);
        window.location.hash = routeToHash({
          name: 'asset',
          assetId: result.assetId,
          transcriptRowId: resolveTranscriptLookupId(result) ?? '',
          source: 'search',
          searchQuery: 'vector clocks',
        });
      },
    });

    await user.click(screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 00:01',
    }));

    expect(onOpenResultContext).toHaveBeenCalledWith(snippetResult);
    expect(resolveTranscriptLookupId(snippetResult)).toBe('row-2');
    expect(parseRoute(window.location.hash)).toEqual({
      name: 'asset',
      assetId: 'asset-1',
      transcriptRowId: 'row-2',
      source: 'search',
      searchQuery: 'vector clocks',
    });
  });

  it('applies the same preview fallback to Asset-scoped Find in transcript results', () => {
    const absentSnippet: SearchResult = { ...baseResult, transcriptRowId: 'row-absent' };
    Reflect.deleteProperty(absentSnippet, 'contextSnippet');

    renderMoments(
      [
        { ...baseResult, contextSnippet: canonicalSnippet },
        absentSnippet,
        { ...baseResult, transcriptRowId: 'row-blank', contextSnippet: ' ', text: ' ' },
      ],
      { scope: { mode: 'asset', assetTitle: 'Vector Clocks Lecture' } },
    );

    expect(screen.getAllByRole('heading', { name: 'Find in transcript' }).length)
      .toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Video moments' })).not.toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('.search-result__excerpt'))
      .map((excerpt) => excerpt.textContent)).toEqual([
      canonicalSnippet,
      baseResult.text,
      'Transcript snippet unavailable.',
    ]);
  });

  it('leaves loading, empty, and error states untouched when snippets are available', () => {
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

    expect(screen.getByText(/searching within distributed systems/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.search-result__excerpt')).toHaveLength(0);

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

    expect(screen.getByText(/no video moments found/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.search-result__excerpt')).toHaveLength(0);

    rerender(
      <SearchPanel
        workspaceName={workspaceName}
        searchableAssetCount={1}
        resetToken={0}
        activeQuery="vector clocks"
        assetSources={[asset]}
        searchResponse={{
          ...searchResponse,
          results: [{ ...baseResult, contextSnippet: canonicalSnippet }],
        }}
        searchError={new Error('Search service unavailable')}
        isSearching={false}
        contextResponse={undefined}
        contextError={null}
        isContextLoading={false}
        selectedResult={null}
        onSearch={vi.fn()}
        onSelectResult={vi.fn()}
        onOpenResultContext={vi.fn()}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText(canonicalSnippet)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.search-result__excerpt')).toHaveLength(0);
  });
});
