/**
 * Pure math shared by the camera rig and every animated scene object. Everything here is a pure
 * function of the global scroll progress, so scrolling backward replays the story in reverse and
 * a refresh at any scroll position lands on a consistent state.
 */

export const CHAPTER_COUNT = 6;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Smoothstep easing: gentle in and out, no overshoot — the "deliberate, not explosive" motion. */
export function easeInOut(t: number): number {
  const clamped = clamp01(t);
  return clamped * clamped * (3 - 2 * clamped);
}

/** Linear ramp from `from` to `to` in global progress, clamped outside the window. */
export function ramp(progress: number, from: number, to: number): number {
  if (to <= from) {
    return progress >= to ? 1 : 0;
  }

  return clamp01((progress - from) / (to - from));
}

/**
 * The chapter windows lead the raw sixth-of-scroll split slightly: a chapter's motion begins
 * as its section scrolls in and completes while its copy is still on screen, instead of
 * finishing after the reader has moved on.
 */
const PHASE_LEAD = 0.045;

/**
 * Progress through one chapter's sixth of the scroll: 0 before the chapter, 1 after it.
 * Chapters are 1-based to match the visible section numbering.
 */
export function chapterPhase(progress: number, chapter: number): number {
  const start = (chapter - 1) / CHAPTER_COUNT - PHASE_LEAD;
  const end = chapter / CHAPTER_COUNT - PHASE_LEAD;
  return ramp(progress, start, end);
}

/**
 * Camera pose blending across the six chapter poses: which segment the camera is in and the
 * eased local position inside it. The plateau holds each pose while a chapter's copy is on
 * screen so transitions concentrate between chapters instead of drifting constantly.
 */
export function cameraSegment(progress: number): { index: number; t: number } {
  const segments = CHAPTER_COUNT - 1;
  const scaled = clamp01(progress) * segments;
  const index = Math.min(Math.floor(scaled), segments - 1);
  const local = scaled - index;
  const plateau = 0.18;
  const travel = easeInOut(ramp(local, plateau, 1 - plateau));

  return { index, t: travel };
}

/**
 * Framerate-independent exponential damping. Returns the new value; callers keep requesting
 * frames until `Math.abs(target - value)` falls under their settle threshold.
 */
export function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * deltaSeconds));
}
