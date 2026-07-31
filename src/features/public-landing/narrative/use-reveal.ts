import { useEffect, type RefObject } from 'react';

/**
 * Progressive copy reveal. Content is fully visible by default; only when animation is actually
 * possible (IntersectionObserver present, motion allowed) does the hook add the reveal classes,
 * so no environment can ever hide the narrative behind an animation that never runs.
 */
export function useChapterReveal(rootRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const root = rootRef.current;

    if (!enabled || !root || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('me-reveal--visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );

    for (const target of targets) {
      target.classList.add('me-reveal');
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      for (const target of targets) {
        target.classList.remove('me-reveal', 'me-reveal--visible');
      }
    };
  }, [rootRef, enabled]);
}

/** Motion is allowed only when the OS has not asked for reduced motion. */
export function isMotionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
