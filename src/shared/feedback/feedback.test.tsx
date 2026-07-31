import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiClientError } from '../api/api-error';
import { ErrorFeedback } from './index';

afterEach(cleanup);

describe('ErrorFeedback adapter', () => {
  it('maps an unknown error to bounded copy and keeps alert semantics', () => {
    render(<ErrorFeedback error={new ApiClientError(503, 'SQLException at jdbc://internal')} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain('SQLException');
    expect(alert.textContent).not.toContain('jdbc');
    expect(alert.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('lets a caller override the mapped copy without exposing the raw error', () => {
    render(
      <ErrorFeedback
        error={new Error('raw internals')}
        title="Search unavailable"
        message="Try again in a moment."
        detail="Results will refresh automatically."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Search unavailable');
    expect(alert).toHaveTextContent('Try again in a moment.');
    expect(alert.textContent).not.toContain('raw internals');
  });
});
