import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../api/api-error';
import {
  Button,
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingBlock,
  PanelHeading,
  SuccessNotification,
  joinClassNames,
} from './index';

afterEach(cleanup);

describe('shared UI foundation', () => {
  it('maps Button tones to stable semantic class names and forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref} tone="ghost">Open</Button>);

    const button = screen.getByRole('button', { name: 'Open' });
    expect(button).toHaveClass('button', 'button--ghost');
    expect(ref.current).toBe(button);
  });

  it('defaults Button to the primary tone without page- or feature-named variants', () => {
    render(<Button>Save</Button>);

    const className = screen.getByRole('button', { name: 'Save' }).className;
    expect(className).toBe('button button--primary');
    expect(className).not.toMatch(/search|asset|workspace|savedMoment|landing/i);
  });

  it('renders PanelHeading with caller-owned heading, eyebrow and trailing content', () => {
    render(
      <PanelHeading eyebrow="Saved" trailing={<p role="status">2 saved</p>}>
        <h2 id="custom-id" tabIndex={-1}>Saved moments</h2>
      </PanelHeading>,
    );

    const heading = screen.getByRole('heading', { name: 'Saved moments' });
    expect(heading).toHaveAttribute('id', 'custom-id');
    expect(heading.closest('.panel-heading')).not.toBeNull();
    expect(screen.getByText('Saved')).toHaveClass('panel__eyebrow');
    expect(screen.getByRole('status')).toHaveTextContent('2 saved');
  });

  it('keeps PanelHeading free of interactive elements of its own', () => {
    const { container } = render(
      <PanelHeading eyebrow="Playback">
        <h2>Continue watching</h2>
      </PanelHeading>,
    );

    expect(container.querySelectorAll('button, a, input, select')).toHaveLength(0);
  });

  it('announces errors through role=alert with bounded copy', () => {
    render(<ErrorBanner error={new ApiClientError(503, 'raw backend detail')} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain('raw backend detail');
    expect(alert.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('keeps LoadingBlock labelled by text with the dot hidden from assistive tech', () => {
    render(<LoadingBlock label="Loading saved moments..." />);

    expect(screen.getByText('Loading saved moments...')).toBeInTheDocument();
    expect(document.querySelector('.loading-block__dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders EmptyState and InfoBanner as plain informative surfaces', () => {
    render(
      <>
        <EmptyState title="Nothing yet" description="Add a video to begin." />
        <InfoBanner tone="warning" title="Heads up" message="Processing continues." />
      </>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Nothing yet' })).toBeInTheDocument();
    expect(document.querySelector('.message--warning')).not.toBeNull();
  });

  it('gives SuccessNotification a dismiss action without nesting interactive elements', () => {
    const onDismiss = vi.fn();
    render(<SuccessNotification title="Saved" message="Moment saved." onDismiss={onDismiss} />);

    const dismiss = screen.getByRole('button', { name: 'Dismiss Saved' });
    dismiss.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(dismiss.querySelector('button, a')).toBeNull();
  });

  it('joins class names while dropping falsy values', () => {
    expect(joinClassNames('a', false, null, undefined, 'b')).toBe('a b');
  });
});
