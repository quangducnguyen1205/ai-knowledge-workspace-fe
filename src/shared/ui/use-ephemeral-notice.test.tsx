import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBanner, SuccessNotification } from '../../lib/ui';
import { EPHEMERAL_NOTICE_DURATION_MS, useEphemeralNotice } from './use-ephemeral-notice';

function NoticeHarness({ contextKey, showError = false }: { contextKey: string; showError?: boolean }) {
  const { notice, showNotice } = useEphemeralNotice(contextKey);

  return (
    <div>
      <button
        type="button"
        onClick={() => showNotice({ title: 'Video renamed', message: 'The title was updated.' })}
      >
        Show success
      </button>
      {notice ? (
        <SuccessNotification
          title={notice.title}
          message={notice.message}
          onDismiss={notice.dismiss}
        />
      ) : null}
      {showError ? <ErrorBanner error={new Error('persistent failure')} /> : null}
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ephemeral success notification', () => {
  it('announces politely, supports manual dismissal, and expires after four seconds', () => {
    vi.useFakeTimers();
    render(<NoticeHarness contextKey="library:workspace-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    expect(screen.getByRole('status')).toHaveTextContent('Video renamed');
    expect(screen.getByRole('button', { name: 'Dismiss Video renamed' })).toBeEnabled();

    act(() => vi.advanceTimersByTime(EPHEMERAL_NOTICE_DURATION_MS - 1));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Video renamed' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears on context change and cancels its pending timer on cleanup', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { rerender, unmount } = render(<NoticeHarness contextKey="library:workspace-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    rerender(<NoticeHarness contextKey="asset:workspace-1:asset-1" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('never auto-dismisses a persistent error', () => {
    vi.useFakeTimers();
    render(<NoticeHarness contextKey="library:workspace-1" showError />);

    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    act(() => vi.advanceTimersByTime(EPHEMERAL_NOTICE_DURATION_MS));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
