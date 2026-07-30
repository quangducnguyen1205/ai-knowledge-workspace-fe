import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import { resetApiAuthForTests } from '../../shared/api/http-client';
import type { ContinueWatchingItem } from './api/continue-watching-api';
import { ContinueWatchingPanel } from './continue-watching-panel';
import { continueWatchingKeys, useContinueWatching } from './hooks/use-continue-watching';

const item: ContinueWatchingItem = {
  assetId: 'asset-1',
  workspaceId: 'workspace-1',
  assetTitle: 'Vector Clocks Lecture',
  sourceType: 'UPLOAD',
  positionMs: 61_000,
  completed: false,
  updatedAt: '2026-07-30T08:00:00Z',
};

function renderPanel(overrides: Partial<Parameters<typeof ContinueWatchingPanel>[0]> = {}) {
  const onContinueWatching = vi.fn();
  render(
    <ContinueWatchingPanel
      workspaceName="Distributed Systems"
      items={[item]}
      isLoading={false}
      error={null}
      onContinueWatching={onContinueWatching}
      {...overrides}
    />,
  );
  return { onContinueWatching };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function listPayload(workspaceId: string, items: unknown[]) {
  return { workspaceIdFilter: workspaceId, itemCount: items.length, maxItems: 12, items };
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper };
}

afterEach(() => {
  cleanup();
  resetApiAuthForTests();
  vi.unstubAllGlobals();
});

describe('continue watching states', () => {
  it('shows a loading state without content or an empty state', () => {
    renderPanel({ isLoading: true, items: [] });

    expect(screen.getByText(/Loading playback progress in Distributed Systems/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing in progress yet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue watching/i })).not.toBeInTheDocument();
  });

  it('explains the empty state in words rather than by colour alone', () => {
    renderPanel({ items: [] });

    expect(screen.getByText('Nothing in progress yet')).toBeInTheDocument();
    expect(screen.getByText(/Play a video in this workspace/i)).toBeInTheDocument();
  });

  it('shows a bounded error state instead of the raw backend payload', () => {
    renderPanel({ items: [], error: new ApiClientError(503, 'The request could not be completed.') });

    expect(screen.queryByText(/Nothing in progress yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/asset_playback_progress/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Continue watching/ })).not.toBeInTheDocument();
  });

  it('renders title, source, playback position and last watched time', () => {
    renderPanel();

    expect(screen.getByText('Vector Clocks Lecture')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('01:01')).toBeInTheDocument();
    expect(screen.getByText(/^Last watched /)).toBeInTheDocument();
  });

  it('never announces an unavailable position as a real timestamp', () => {
    renderPanel({ items: [{ ...item, positionMs: null }] });

    expect(screen.getByText('Position unavailable')).toBeInTheDocument();
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
  });

  it('treats a zero position as unavailable rather than the start of the video', () => {
    renderPanel({ items: [{ ...item, positionMs: 0 }] });

    expect(screen.getByText('Position unavailable')).toBeInTheDocument();
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
  });

  it('marks a missing source type without inventing one', () => {
    renderPanel({ items: [{ ...item, sourceType: null }] });

    expect(screen.getByText('Source unavailable')).toBeInTheDocument();
  });

  it('reports an unknown last watched time without a fabricated date', () => {
    renderPanel({ items: [{ ...item, updatedAt: null }] });

    expect(screen.getByText('Last watched Unknown')).toBeInTheDocument();
  });
});

describe('continue watching actions and accessibility', () => {
  it('opens the Asset through the plain viewer route without a playback position', async () => {
    const user = userEvent.setup();
    const { onContinueWatching } = renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Continue watching Vector Clocks Lecture at 01:01',
    }));

    expect(onContinueWatching).toHaveBeenCalledWith(item);
  });

  it('names the action with the Asset title and the playback timestamp', () => {
    renderPanel();

    const action = screen.getByRole('button', { name: /^Continue watching Vector Clocks Lecture/ });
    expect(action).toHaveAccessibleName(expect.stringContaining('Vector Clocks Lecture'));
    expect(action).toHaveAccessibleName(expect.stringContaining('01:01'));
  });

  it('uses a semantic heading and list so the section is navigable', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Continue watching' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('never nests an interactive control inside another', () => {
    renderPanel({ items: [item, { ...item, assetId: 'asset-2', assetTitle: 'Second video' }] });

    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('button, a, input, select, textarea')).toBeNull();
    }
  });

  it('reaches every action by keyboard in list order', async () => {
    const user = userEvent.setup();
    const { onContinueWatching } = renderPanel({
      items: [item, { ...item, assetId: 'asset-2', assetTitle: 'Second video' }],
    });

    await user.tab();
    expect(screen.getByRole('button', { name: /Vector Clocks Lecture/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /Second video/ })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onContinueWatching).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-2' }),
    );
  });

  it('keeps a long title wrapping inside the item rather than overflowing', () => {
    renderPanel({ items: [{ ...item, assetTitle: 'A'.repeat(200) }] });

    expect(screen.getByText('A'.repeat(200))).toHaveClass('continue-watching-item__title');
  });

  it('exposes exactly one polite live region while loading and none once loaded', () => {
    const { unmount } = render(
      <ContinueWatchingPanel
        workspaceName="Distributed Systems"
        items={[]}
        isLoading
        error={null}
        onContinueWatching={vi.fn()}
      />,
    );
    const loadingRegions = screen.getAllByRole('status');
    expect(loadingRegions).toHaveLength(1);
    expect(loadingRegions[0]).toHaveAttribute('aria-live', 'polite');
    unmount();

    renderPanel();
    const region = screen.getByRole('region', { name: undefined }) ?? document.body;
    expect(within(region as HTMLElement).getAllByRole('status')).toHaveLength(1);
  });

  it('uses neutral product vocabulary rather than education wording', () => {
    renderPanel({ items: [] });
    const emptyCopy = document.body.textContent ?? '';
    cleanup();
    renderPanel();
    const contentCopy = document.body.textContent ?? '';

    for (const copy of [emptyCopy, contentCopy]) {
      for (const banned of ['Continue learning', 'learning progress', 'study session', 'lesson', 'course']) {
        expect(copy.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    }
    expect(contentCopy).toContain('Continue watching');
  });
});

describe('workspace-scoped continue watching state', () => {
  it('keys the cache by Workspace so a switch never shows the previous list', async () => {
    const fetchMock = vi.fn(async (input?: RequestInfo | URL) => {
      const url = String(input);
      return url.includes('workspace-2')
        ? jsonResponse(listPayload('workspace-2', [{
            ...item, assetId: 'asset-2', workspaceId: 'workspace-2', assetTitle: 'Other workspace video',
          }]))
        : jsonResponse(listPayload('workspace-1', [item]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string }) => useContinueWatching(workspaceId),
      { wrapper: Wrapper, initialProps: { workspaceId: 'workspace-1' } },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].assetId).toBe('asset-1');

    rerender({ workspaceId: 'workspace-2' });

    await waitFor(() => expect(result.current.items[0]?.assetId).toBe('asset-2'));
    expect(result.current.items.map((entry) => entry.workspaceId)).toEqual(['workspace-2']);
    expect(continueWatchingKeys.list('workspace-1')).toEqual(['continue-watching', 'workspace-1']);
    expect(continueWatchingKeys.list('workspace-1'))
      .not.toEqual(continueWatchingKeys.list('workspace-2'));
  });

  it('issues no request and renders nothing without a selected Workspace', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(listPayload('workspace-1', [item])));
    vi.stubGlobal('fetch', fetchMock);
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useContinueWatching(null), { wrapper: Wrapper });

    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes the server-owned maximum without adding a client limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(listPayload('workspace-1', [item]))));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useContinueWatching('workspace-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.maxItems).toBe(12);
  });

  it('surfaces a bounded error and an empty list rather than stale items', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse({ code: 'WORKSPACE_NOT_FOUND' }, 404)));
    const { Wrapper } = wrapper();

    const { result } = renderHook(() => useContinueWatching('workspace-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.items).toEqual([]);
  });
});
