import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Scroll is the single narrative controller. One scrubbed ScrollTrigger spans the whole stage and
 * publishes its progress into a mutable store that the render loop reads without React state, so
 * scrolling back replays the story in reverse and nothing competes with the scrollbar.
 *
 * This module is loaded only by the lazy scene chunk — the HTML landing never pays for GSAP.
 */

export interface ScrollProgressStore {
  /** Global narrative progress in [0, 1]. */
  value: number;
}

export interface ScrollTimeline {
  store: ScrollProgressStore;
  destroy(): void;
}

export function createScrollTimeline(
  stage: HTMLElement,
  onUpdate?: (value: number) => void,
): ScrollTimeline {
  gsap.registerPlugin(ScrollTrigger);

  const store: ScrollProgressStore = { value: 0 };
  const publish = (progress: number) => {
    store.value = progress;
    onUpdate?.(progress);
  };

  // gsap.context scopes every trigger created inside it; revert() removes them all, which keeps
  // React Strict Mode's mount → cleanup → mount cycle at exactly one live ScrollTrigger.
  const context = gsap.context(() => {
    ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => publish(self.progress),
      // A refresh (including a reload at a mid-scroll position) recomputes progress immediately.
      onRefresh: (self) => publish(self.progress),
    });
  });

  return {
    store,
    destroy() {
      context.revert();
    },
  };
}

/**
 * React lifecycle wrapper: creates the timeline for the mounted stage element and guarantees the
 * trigger is destroyed on unmount. Returns a stable ref to the progress store.
 */
export function useScrollProgress(
  stageRef: RefObject<HTMLElement | null>,
  onUpdate?: (value: number) => void,
): RefObject<ScrollProgressStore> {
  const storeRef = useRef<ScrollProgressStore>({ value: 0 });
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const timeline = createScrollTimeline(stage, (value) => {
      storeRef.current.value = value;
      onUpdateRef.current?.(value);
    });
    storeRef.current.value = timeline.store.value;

    return () => timeline.destroy();
  }, [stageRef]);

  return storeRef;
}
