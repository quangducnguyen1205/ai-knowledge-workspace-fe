import { StrictMode, useRef } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScrollTimeline, useScrollProgress } from '../narrative/use-scroll-progress';
import { useChapterReveal } from '../narrative/use-reveal';

/**
 * Scene ownership lifecycle: exactly one scrubbed ScrollTrigger per mounted scene — including
 * under React Strict Mode's double effect pass — and zero after unmount; reveal observers
 * disconnect with their component.
 */

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  ScrollTrigger.killAll();
});

describe('scroll timeline ownership', () => {
  it('creates one ScrollTrigger and removes it on destroy', () => {
    const stage = document.createElement('div');
    document.body.append(stage);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    const timeline = createScrollTimeline(stage);
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    expect(timeline.store.value).toBeGreaterThanOrEqual(0);

    timeline.destroy();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    stage.remove();
  });

  it('never duplicates the trigger under React Strict Mode and cleans up on unmount', () => {
    function Probe() {
      const stageRef = useRef<HTMLDivElement>(null);
      useScrollProgress(stageRef);
      return <div ref={stageRef} style={{ height: '400px' }} />;
    }

    const { unmount } = render(<StrictMode><Probe /></StrictMode>);
    expect(ScrollTrigger.getAll()).toHaveLength(1);

    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});

describe('reveal observer ownership', () => {
  it('observes reveal targets while mounted and disconnects on unmount', () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(_callback: IntersectionObserverCallback) {}
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds = [];
    });

    function Probe() {
      const rootRef = useRef<HTMLDivElement>(null);
      useChapterReveal(rootRef, true);
      return (
        <div ref={rootRef}>
          <p data-reveal>chapter copy</p>
          <p data-reveal>more copy</p>
        </div>
      );
    }

    const { unmount } = render(<Probe />);
    expect(observe).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('.me-reveal')).toHaveLength(2);

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('leaves content untouched when reveal is disabled', () => {
    function Probe() {
      const rootRef = useRef<HTMLDivElement>(null);
      useChapterReveal(rootRef, false);
      return <div ref={rootRef}><p data-reveal>always visible</p></div>;
    }

    render(<Probe />);
    expect(document.querySelector('.me-reveal')).toBeNull();
  });
});
