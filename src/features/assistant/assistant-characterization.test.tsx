import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetAssistantPanel } from './components/asset-assistant-panel';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAssistant(overrides: Partial<Parameters<typeof AssetAssistantPanel>[0]> = {}) {
  const props: Parameters<typeof AssetAssistantPanel>[0] = {
    workspaceId: 'workspace-1',
    workspaceName: 'Distributed Systems',
    assetId: 'asset-1',
    assetTitle: 'Vector Clocks Lecture',
    isAssetSearchable: true,
    onOpenCitationContext: vi.fn(),
    ...overrides,
  };

  const view = render(<AssetAssistantPanel {...props} />);
  return { ...view, props };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('asset assistant characterization', () => {
  it('submits the Spring asset-scoped request and renders answer citations in order', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        answer: 'Vector clocks capture causal ordering.',
        insufficientContext: false,
        citations: [
          {
            sourceId: 'source-2',
            assetId: 'asset-1',
            assetTitle: 'Vector Clocks Lecture',
            transcriptRowId: 'row-2',
            segmentIndex: 2,
            createdAt: '2026-06-26T10:02:00Z',
          },
          {
            sourceId: 'source-4',
            assetId: 'asset-1',
            assetTitle: 'Vector Clocks Lecture',
            transcriptRowId: null,
            segmentIndex: 4,
            createdAt: '2026-06-26T10:04:00Z',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { props } = renderAssistant();

    await user.type(screen.getByRole('textbox', { name: /question/i }), '  What do vector clocks capture?  ');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('Vector clocks capture causal ordering.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/assistant/answer', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      signal: expect.any(AbortSignal),
    }));
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, RequestInit]>;
    const request = calls[0][1];
    expect(JSON.parse(String(request.body))).toEqual({
      workspaceId: 'workspace-1',
      assetId: 'asset-1',
      question: 'What do vector clocks capture?',
    });
    expect(screen.getAllByText(/source [12]/i).map((node) => node.textContent)).toEqual(['Source 1', 'Source 2']);

    await user.click(
      screen.getByRole('button', {
        name: 'Open transcript context for citation 2 in Vector Clocks Lecture',
      }),
    );
    expect(props.onOpenCitationContext).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'source-4' }));
  });

  it('renders insufficient context without citation navigation', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      answer: 'The transcript does not contain enough context.',
      citations: [],
      insufficientContext: true,
    })));
    renderAssistant();

    await user.type(screen.getByRole('textbox', { name: /question/i }), 'What is not covered?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('Insufficient context')).toBeInTheDocument();
    expect(screen.getByText(/does not contain enough context/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open transcript context for citation/i })).not.toBeInTheDocument();
  });

  it('keeps invalid citations visible but non-interactive', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      answer: 'A source was returned without a transcript reference.',
      insufficientContext: false,
      citations: [{
        sourceId: 'source-invalid',
        assetId: 'asset-1',
        assetTitle: 'Vector Clocks Lecture',
        transcriptRowId: null,
        segmentIndex: null,
        createdAt: null,
      }],
    })));
    renderAssistant();

    await user.type(screen.getByRole('textbox', { name: /question/i }), 'Show the source.');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText('Transcript context unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open transcript context for citation/i })).not.toBeInTheDocument();
  });

  it('aborts the active request and resets answer state when asset scope changes', async () => {
    const user = userEvent.setup();
    let resolveRequest: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return pendingResponse;
    }));
    const { rerender, props } = renderAssistant();

    await user.type(screen.getByRole('textbox', { name: /question/i }), 'What is causality?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByText('Generating answer from transcript sources...')).toBeInTheDocument();

    rerender(<AssetAssistantPanel {...props} assetId="asset-2" assetTitle="Other Lecture" />);
    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByRole('textbox', { name: /question/i })).toHaveValue('');
    expect(screen.getByText('Ask about this transcript')).toBeInTheDocument();

    resolveRequest(jsonResponse({ answer: 'Stale answer', citations: [], insufficientContext: false }));
    await waitFor(() => expect(screen.queryByText('Stale answer')).not.toBeInTheDocument());
  });

  it('preserves disabled and validation semantics', async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderAssistant();

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ask a question about this asset transcript first.');
    expect(screen.getByRole('textbox', { name: /question/i })).toHaveAttribute('aria-invalid', 'true');

    rerender(<AssetAssistantPanel {...props} isAssetSearchable={false} />);
    expect(screen.getByRole('textbox', { name: /question/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    expect(screen.getByText('Assistant unlocks after indexing')).toBeInTheDocument();
  });

  it('keeps the question available for retry after a provider failure', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        code: 'ASSISTANT_PROVIDER_UNAVAILABLE',
        message: 'Assistant provider unavailable',
      }, 503))
      .mockResolvedValueOnce(jsonResponse({
        answer: 'Retry returned a grounded answer.',
        insufficientContext: false,
        citations: [{
          sourceId: 'source-1',
          assetId: 'asset-1',
          assetTitle: 'Vector Clocks Lecture',
          transcriptRowId: 'row-1',
          segmentIndex: 1,
          createdAt: null,
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);
    renderAssistant();

    await user.type(screen.getByRole('textbox', { name: /question/i }), 'What is causality?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Assistant answers are unavailable')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /question/i })).toHaveValue('What is causality?');

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Retry returned a grounded answer.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
