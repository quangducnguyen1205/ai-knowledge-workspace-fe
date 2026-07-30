import { useState } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../../shared/api/api-error';
import type { SavedMoment } from './api/saved-moments-api';
import { SavedMomentsPanel } from './saved-moments-panel';
import { SaveMomentButton } from './save-moment-button';

const moment: SavedMoment = {
  savedMomentId: 'saved-1',
  workspaceId: 'workspace-1',
  assetId: 'asset-1',
  assetTitle: 'Vector Clocks Lecture',
  sourceType: 'UPLOAD',
  transcriptRowId: 'row-2',
  segmentIndex: 2,
  startMs: 61_000,
  endMs: 64_000,
  text: 'Vector clocks preserve causal relationships between events.',
  savedAt: '2026-07-30T08:00:00Z',
};

function renderPanel(overrides: Partial<Parameters<typeof SavedMomentsPanel>[0]> = {}) {
  const onOpenMoment = vi.fn();
  const onRemoveMoment = vi.fn();
  const props = {
    workspaceName: 'Distributed Systems',
    items: [moment],
    isLoading: false,
    error: null,
    removingId: null,
    removeError: null,
    onOpenMoment,
    onRemoveMoment,
    ...overrides,
  };
  render(<SavedMomentsPanel {...props} />);
  return { onOpenMoment, onRemoveMoment };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('saved moments panel states', () => {
  it('shows a loading state without content or an empty state', () => {
    renderPanel({ isLoading: true, items: [] });

    expect(screen.getByText(/Loading saved moments in Distributed Systems/i)).toBeInTheDocument();
    expect(screen.queryByText(/No saved moments yet/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open moment/i })).not.toBeInTheDocument();
  });

  it('shows a distinct empty state with a text explanation rather than colour alone', () => {
    renderPanel({ items: [] });

    expect(screen.getByText('No saved moments yet')).toBeInTheDocument();
    expect(screen.getByText(/Save a moment from a search result/i)).toBeInTheDocument();
  });

  it('shows a bounded error state instead of the raw backend payload', () => {
    renderPanel({ items: [], error: new ApiClientError(503, 'The request could not be completed.') });

    expect(screen.queryByText(/No saved moments yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/saved_moments/i)).not.toBeInTheDocument();
  });

  it('renders identity, source, timestamp, canonical text and saved time', () => {
    renderPanel();

    expect(screen.getByText('Vector Clocks Lecture')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('01:01')).toBeInTheDocument();
    expect(screen.getByText(moment.text)).toBeInTheDocument();
    expect(screen.getByRole('listitem').querySelector('.saved-moment__saved-at')?.textContent)
      .toMatch(/^Saved /);
  });

  it('labels an unknown timestamp instead of rendering a misleading zero', () => {
    renderPanel({ items: [{ ...moment, startMs: null, endMs: null }] });

    expect(screen.getByText('Time unavailable')).toBeInTheDocument();
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
  });

  it('marks a missing source type without inventing one', () => {
    renderPanel({ items: [{ ...moment, sourceType: null }] });

    expect(screen.getByText('Source unavailable')).toBeInTheDocument();
  });
});

describe('saved moments panel actions', () => {
  it('opens a moment through the canonical route without search origin', async () => {
    const user = userEvent.setup();
    const { onOpenMoment } = renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Open moment in Vector Clocks Lecture at 01:01',
    }));

    expect(onOpenMoment).toHaveBeenCalledWith(moment);
  });

  it('copies the canonical absolute permalink', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Copy link to moment in Vector Clocks Lecture at 01:01',
    }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('#/assets/asset-1?row=row-2');
    expect(copied).not.toContain('from=');
    expect(copied).not.toContain('q=');
    expect(await screen.findByText('Link copied to the clipboard.')).toBeInTheDocument();
  });

  it('shows bounded feedback when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Copy link to moment in Vector Clocks Lecture at 01:01',
    }));

    expect(await screen.findByText(/Could not copy the link/i)).toBeInTheDocument();
  });

  it('shows bounded feedback when the clipboard write is rejected', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
    });
    renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Copy link to moment in Vector Clocks Lecture at 01:01',
    }));

    expect(await screen.findByText(/Could not copy the link/i)).toBeInTheDocument();
  });

  it('removes a saved moment by identifier and reports progress once', async () => {
    const user = userEvent.setup();
    const { onRemoveMoment } = renderPanel();

    await user.click(screen.getByRole('button', {
      name: 'Remove saved moment in Vector Clocks Lecture at 01:01',
    }));

    expect(onRemoveMoment).toHaveBeenCalledWith('saved-1');
  });

  it('disables only the removing item while the mutation is in flight', () => {
    renderPanel({
      items: [moment, { ...moment, savedMomentId: 'saved-2', transcriptRowId: 'row-3' }],
      removingId: 'saved-1',
    });

    const removeButtons = screen.getAllByRole('button', { name: /^Remove saved moment/ });
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeEnabled();
    expect(screen.getByText('Removing...')).toBeInTheDocument();
  });

  it('keeps the list usable and shows bounded feedback when removal fails', () => {
    renderPanel({ removeError: new ApiClientError(404, 'The request could not be completed.') });

    expect(screen.getByRole('button', { name: /^Open moment/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Remove saved moment/ })).toBeEnabled();
  });
});

describe('saved moments accessibility and layout constraints', () => {
  it('never nests an interactive control inside another', () => {
    renderPanel();

    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('button, a, input, select, textarea')).toBeNull();
    }
  });

  it('gives every action an explicit name containing the Asset and timestamp', () => {
    renderPanel();

    for (const prefix of ['Open moment in', 'Copy link to moment in', 'Remove saved moment in']) {
      const button = screen.getByRole('button', { name: new RegExp(`^${prefix}`) });
      expect(button).toHaveAccessibleName(expect.stringContaining('Vector Clocks Lecture'));
      expect(button).toHaveAccessibleName(expect.stringContaining('01:01'));
    }
  });

  it('exposes exactly one polite live region per saved moment for mutation feedback', () => {
    renderPanel();

    const item = screen.getByRole('listitem');
    const liveRegions = within(item).getAllByRole('status');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveAttribute('aria-live', 'polite');
  });

  it('uses a semantic heading and list so keyboard users can traverse the section', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Saved moments' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('reaches every action by keyboard in a predictable order', async () => {
    const user = userEvent.setup();
    const { onOpenMoment } = renderPanel();

    await user.tab();
    expect(screen.getByRole('button', { name: /^Open moment/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Copy link/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Remove saved moment/ })).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{Tab}{/Shift}');
    await user.keyboard('{Enter}');
    expect(onOpenMoment).toHaveBeenCalled();
  });

  it('allows long titles and canonical text to wrap instead of overflowing', () => {
    renderPanel({
      items: [{
        ...moment,
        assetTitle: 'A'.repeat(180),
        text: 'B'.repeat(400),
      }],
    });

    const title = screen.getByText('A'.repeat(180));
    const text = screen.getByText('B'.repeat(400));
    expect(title).toHaveClass('saved-moment__asset-title');
    expect(text).toHaveClass('saved-moment__text');
  });
});

describe('predictable focus after removal', () => {
  const first = moment;
  const second: SavedMoment = {
    ...moment,
    savedMomentId: 'saved-2',
    assetTitle: 'Consensus Lecture',
    transcriptRowId: 'row-3',
    startMs: 122_000,
  };
  const third: SavedMoment = {
    ...moment,
    savedMomentId: 'saved-3',
    assetTitle: 'Incident Review',
    transcriptRowId: 'row-4',
    startMs: 183_000,
  };

  /**
   * Mirrors the real container: a successful removal drops the item from the rendered list, a
   * failed one leaves it in place, and the Remove button is disabled while the call is in flight.
   */
  function ControlledSavedMoments({
    initialItems,
    onRemove,
    workspaceName = 'Distributed Systems',
  }: {
    initialItems: SavedMoment[];
    onRemove: (savedMomentId: string) => Promise<unknown>;
    workspaceName?: string;
  }) {
    const [items, setItems] = useState(initialItems);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removeError, setRemoveError] = useState<unknown>(null);

    return (
      <div>
        <button type="button">Before the panel</button>
        <SavedMomentsPanel
          workspaceName={workspaceName}
          items={items}
          isLoading={false}
          error={null}
          removingId={removingId}
          removeError={removeError}
          onOpenMoment={() => undefined}
          onRemoveMoment={async (savedMomentId) => {
            setRemovingId(savedMomentId);
            try {
              await onRemove(savedMomentId);
              setItems((current) => current.filter((item) => item.savedMomentId !== savedMomentId));
            } catch (error) {
              setRemoveError(error);
              throw error;
            } finally {
              setRemovingId(null);
            }
          }}
        />
        <button type="button" onClick={() => setItems([...initialItems])}>
          Refresh list
        </button>
      </div>
    );
  }

  function removeButton(assetTitle: string) {
    return screen.getByRole('button', { name: new RegExp(`^Remove saved moment in ${assetTitle}`) });
  }

  function openButton(assetTitle: string) {
    return screen.getByRole('button', { name: new RegExp(`^Open moment in ${assetTitle}`) });
  }

  it('focuses the following item when a middle item is removed', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSavedMoments
        initialItems={[first, second, third]}
        onRemove={async () => undefined}
      />,
    );

    await user.click(removeButton('Consensus Lecture'));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    await waitFor(() => expect(openButton('Incident Review')).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('focuses the previous item when the last item is removed', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSavedMoments
        initialItems={[first, second, third]}
        onRemove={async () => undefined}
      />,
    );

    await user.click(removeButton('Incident Review'));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    await waitFor(() => expect(openButton('Consensus Lecture')).toHaveFocus());
  });

  it('focuses the Saved moments heading when the only item is removed', async () => {
    const user = userEvent.setup();
    render(<ControlledSavedMoments initialItems={[first]} onRemove={async () => undefined} />);

    await user.click(removeButton('Vector Clocks Lecture'));

    await waitFor(() => expect(screen.getByText('No saved moments yet')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Saved moments' })).toHaveFocus());
  });

  it('keeps focus on the existing Remove button when removal fails', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSavedMoments
        initialItems={[first, second]}
        onRemove={async () => {
          // A real browser blurs a focused control the moment it becomes disabled; jsdom does not,
          // so reproduce that here or the assertion below would pass without any restoration.
          (document.activeElement as HTMLElement | null)?.blur();
          throw new ApiClientError(404, 'The request could not be completed.');
        }}
      />,
    );

    await user.click(removeButton('Vector Clocks Lecture'));

    await waitFor(() => expect(removeButton('Vector Clocks Lecture')).toBeEnabled());
    await waitFor(() => expect(removeButton('Vector Clocks Lecture')).toHaveFocus());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(openButton('Consensus Lecture')).not.toHaveFocus();
  });

  it('does not move focus when a background list refresh replaces the same items', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSavedMoments
        initialItems={[first, second]}
        onRemove={async () => undefined}
      />,
    );

    const anchor = screen.getByRole('button', { name: 'Before the panel' });
    anchor.focus();
    expect(anchor).toHaveFocus();

    await act(async () => {
      screen.getByRole('button', { name: 'Refresh list' }).click();
    });

    expect(anchor).toHaveFocus();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('does not run removal focus behavior when the Workspace list is replaced', async () => {
    const otherWorkspaceItem: SavedMoment = {
      ...moment,
      savedMomentId: 'saved-other',
      workspaceId: 'workspace-2',
      assetTitle: 'Operations Handover',
      transcriptRowId: 'row-9',
    };

    function panel(workspaceName: string, items: SavedMoment[]) {
      return (
        <div>
          <button type="button">Outside the panel</button>
          <SavedMomentsPanel
            workspaceName={workspaceName}
            items={items}
            isLoading={false}
            error={null}
            removingId={null}
            removeError={null}
            onOpenMoment={() => undefined}
            onRemoveMoment={async () => undefined}
          />
        </div>
      );
    }

    const view = render(panel('Distributed Systems', [first, second]));
    const anchor = screen.getByRole('button', { name: 'Outside the panel' });

    await act(async () => {
      removeButton('Vector Clocks Lecture').click();
    });
    anchor.focus();

    // A Workspace switch arriving before the removal renders is not a removal: neither an
    // unrelated item nor the heading may take focus.
    view.rerender(panel('Operations', [otherWorkspaceItem]));
    await waitFor(() => expect(screen.getByText('Operations Handover')).toBeInTheDocument());
    expect(anchor).toHaveFocus();
    expect(openButton('Operations Handover')).not.toHaveFocus();
  });

  it('does not focus the heading when a Workspace switch empties the list mid-removal', async () => {
    function panel(workspaceName: string, items: SavedMoment[]) {
      return (
        <div>
          <button type="button">Outside the panel</button>
          <SavedMomentsPanel
            workspaceName={workspaceName}
            items={items}
            isLoading={false}
            error={null}
            removingId={null}
            removeError={null}
            onOpenMoment={() => undefined}
            onRemoveMoment={async () => undefined}
          />
        </div>
      );
    }

    const view = render(panel('Distributed Systems', [first, second]));
    const anchor = screen.getByRole('button', { name: 'Outside the panel' });

    await act(async () => {
      removeButton('Vector Clocks Lecture').click();
    });
    anchor.focus();

    // An empty new Workspace looks like "the list is gone", but it is a Workspace change, not a
    // removal, so the heading must not take focus.
    view.rerender(panel('Operations', []));

    await waitFor(() => expect(screen.getByText('No saved moments yet')).toBeInTheDocument());
    expect(anchor).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Saved moments' })).not.toHaveFocus();
  });

  it('keeps the heading out of normal Tab order while allowing programmatic focus', async () => {
    const user = userEvent.setup();
    renderPanel();

    const heading = screen.getByRole('heading', { name: 'Saved moments' });
    expect(heading).toHaveAttribute('tabindex', '-1');

    await user.tab();
    expect(heading).not.toHaveFocus();
    expect(screen.getByRole('button', { name: /^Open moment/ })).toHaveFocus();

    heading.focus();
    expect(heading).toHaveFocus();
  });

  it('preserves Open, Copy, Remove keyboard ordering after the focus change', async () => {
    const user = userEvent.setup();
    render(
      <ControlledSavedMoments
        initialItems={[first, second, third]}
        onRemove={async () => undefined}
      />,
    );

    await user.click(removeButton('Consensus Lecture'));
    await waitFor(() => expect(openButton('Incident Review')).toHaveFocus());

    await user.tab();
    expect(screen.getByRole('button', { name: /^Copy link to moment in Incident Review/ }))
      .toHaveFocus();
    await user.tab();
    expect(removeButton('Incident Review')).toHaveFocus();
  });
});

describe('save moment action', () => {
  function renderSave(overrides: Partial<Parameters<typeof SaveMomentButton>[0]> = {}) {
    const onSave = vi.fn();
    render(
      <SaveMomentButton
        assetTitle="Vector Clocks Lecture"
        timestampLabel="01:01"
        isSaved={false}
        isSaving={false}
        hasFailed={false}
        onSave={onSave}
        {...overrides}
      />,
    );
    return { onSave };
  }

  it('invites saving and names the exact moment', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSave();

    const button = screen.getByRole('button', {
      name: 'Save moment in Vector Clocks Lecture at 01:01',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('reflects the saved state and blocks a redundant repeat save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSave({ isSaved: true });

    const button = screen.getByRole('button', {
      name: 'Moment in Vector Clocks Lecture at 01:01 is saved',
    });
    expect(button).toHaveTextContent('Saved');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('announces progress once while saving', () => {
    renderSave({ isSaving: true });

    expect(screen.getByRole('button')).toHaveTextContent('Saving...');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('keeps the control usable and shows bounded feedback after a failure', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSave({ hasFailed: true });

    expect(screen.getByText('Could not save this moment. Try again.')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('is reachable and activatable by keyboard', async () => {
    const user = userEvent.setup();
    const { onSave } = renderSave();

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('never nests the save control inside another interactive element', () => {
    renderSave();

    expect(screen.getByRole('button').querySelector('button, a, input')).toBeNull();
  });
});
