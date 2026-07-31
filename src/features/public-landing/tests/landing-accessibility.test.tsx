import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicLanding } from '../public-landing';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubMatchMedia(matching: (query: string) => boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe('moment engine accessibility', () => {
  it('keeps a logical heading hierarchy: one H1, then chapter H2s', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)));
    expect(levels).toEqual([1, 2, 2, 2, 2, 2]);
  });

  it('labels every chapter section by its own heading', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    for (const section of Array.from(document.querySelectorAll('section[data-chapter]'))) {
      const labelId = section.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const heading = document.getElementById(labelId!);
      expect(heading, `section ${section.getAttribute('data-chapter')}`).toBeInTheDocument();
      expect(section.contains(heading)).toBe(true);
    }
  });

  it('keeps landmarks and the skip link', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    const main = screen.getByRole('main');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#me-main');
    expect(main).toHaveAttribute('id', 'me-main');
  });

  it('keeps decorative visuals hidden and free of interactive elements', () => {
    render(<PublicLanding navigate={vi.fn()} />);

    const visuals = Array.from(document.querySelectorAll<HTMLElement>('.me-static'));
    expect(visuals.length).toBeGreaterThan(0);

    for (const visual of visuals) {
      expect(visual).toHaveAttribute('aria-hidden', 'true');
      expect(within(visual).queryAllByRole('button', { hidden: true })).toEqual([]);
      expect(within(visual).queryAllByRole('link', { hidden: true })).toEqual([]);
      expect(visual.querySelectorAll('[tabindex]')).toHaveLength(0);
    }
  });

  it('keeps the full story and CTAs under prefers-reduced-motion, with no reveal animation', () => {
    stubMatchMedia((query) => query.includes('prefers-reduced-motion'));
    render(<PublicLanding navigate={vi.fn()} />);

    expect(document.querySelectorAll('section[data-chapter]')).toHaveLength(6);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Enter workspace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your workspace' })).toBeInTheDocument();
    // Content must never start hidden when motion is off.
    expect(document.querySelector('.me-reveal')).toBeNull();
    // Reduced motion always means the static composition, never the WebGL scene.
    expect(document.querySelector('.me-landing--static')).not.toBeNull();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('never hides content behind the reveal animation when IntersectionObserver is unavailable', () => {
    stubMatchMedia(() => false); // motion allowed, but jsdom has no IntersectionObserver
    render(<PublicLanding navigate={vi.fn()} />);

    expect(document.querySelector('.me-reveal')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
