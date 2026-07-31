import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicLanding } from '../public-landing';

// jsdom has no matchMedia and no WebGL, so the landing renders its static composition here —
// which is exactly the point: the whole narrative must exist without the scene.

afterEach(cleanup);

describe('moment engine narrative content', () => {
  it('renders exactly one H1 with the product statement', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Find the exact moment in every video.');
  });

  it('tells the story in six connected chapters', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    const chapters = Array.from(document.querySelectorAll('section[data-chapter]'));
    expect(chapters.map((chapter) => chapter.getAttribute('data-chapter'))).toEqual([
      '1', '2', '3', '4', '5', '6',
    ]);

    expect(screen.getByRole('heading', { name: 'Every spoken idea becomes searchable.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search across the whole workspace.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jump directly to the moment that matters.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save the moment. Return when it matters.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your videos already contain the answer.' })).toBeInTheDocument();
  });

  it('keeps the real entry CTAs on the existing auth routes', async () => {
    const navigate = vi.fn();
    render(<PublicLanding navigate={navigate} />);

    const enterWorkspace = screen.getByRole('link', { name: 'Enter workspace' });
    expect(enterWorkspace).toHaveAttribute('href', '#/login');

    const openWorkspace = screen.getByRole('link', { name: 'Open your workspace' });
    expect(openWorkspace).toHaveAttribute('href', '#/register');

    // Header and footer each carry a sign-in link; both stay on the existing route.
    for (const signIn of screen.getAllByRole('link', { name: 'Sign in' })) {
      expect(signIn).toHaveAttribute('href', '#/login');
    }
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '#/register');

    await userEvent.click(enterWorkspace);
    expect(navigate).toHaveBeenCalledWith({ name: 'login' });

    await userEvent.click(openWorkspace);
    expect(navigate).toHaveBeenCalledWith({ name: 'register' });
  });

  it('offers an in-page story entry instead of a dead secondary CTA', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<PublicLanding navigate={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'See how it works' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('shows the workspace-search example query', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    expect(screen.getByText('“retrieval practice”')).toBeInTheDocument();
  });

  it('claims only shipped capabilities — no invented search powers, permanence or customers', () => {
    render(<PublicLanding navigate={vi.fn()} />);
    const text = document.body.textContent ?? '';

    // Unsupported capability language.
    expect(text).not.toMatch(/semantic|typo|fuzzy|translat|summar|perfect|real-time|collaborat/i);
    // Over-promising permanence for stable links.
    expect(text).not.toMatch(/permanent|never breaks|always available|works forever|forever/i);
    // Fake marketing signals.
    expect(text).not.toMatch(/customers|testimonial|trusted by|companies|churn|\d+\s*%|\d+k\+?\s*(users|teams)/i);

    // The shipped capabilities are named.
    for (const capability of ['Workspace search', 'Transcript context', 'Saved Moments', 'Continue Watching']) {
      expect(screen.getByText(capability)).toBeInTheDocument();
    }
  });

  it('keeps the stable-link promise accurate: exact location, not immortality', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    expect(screen.getByText(/copy their exact location/)).toBeInTheDocument();
  });
});
