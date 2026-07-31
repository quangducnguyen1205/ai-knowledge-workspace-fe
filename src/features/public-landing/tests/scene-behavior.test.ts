import { describe, expect, it } from 'vitest';
import {
  cameraSegment,
  chapterPhase,
  clamp01,
  easeInOut,
  ramp,
} from '../scene/progress-math';
import { detectWebGlSupport, resolveSceneMode, resolveSceneQuality } from '../scene/scene-quality';

/** Minimal window double for the capability gate. */
function fakeView({
  matches = () => false,
  cores,
  webgl = false,
}: {
  matches?: (query: string) => boolean;
  cores?: number;
  webgl?: boolean;
}): Window {
  const context = webgl ? { getExtension: () => null } : null;

  return {
    matchMedia: (query: string) => ({ matches: matches(query) }),
    navigator: { hardwareConcurrency: cores },
    document: {
      createElement: () => ({ getContext: () => context }),
    },
  } as unknown as Window;
}

describe('scene capability gate', () => {
  it('falls back to static without a window or matchMedia', () => {
    expect(resolveSceneMode(undefined)).toBe('static');
    expect(resolveSceneMode({} as Window)).toBe('static');
  });

  it('honors reduced motion, coarse pointers and narrow viewports as hard static gates', () => {
    for (const gate of ['prefers-reduced-motion', 'pointer: coarse', 'max-width: 900px']) {
      const view = fakeView({ matches: (query) => query.includes(gate), webgl: true, cores: 8 });
      expect(resolveSceneMode(view), gate).toBe('static');
    }
  });

  it('requires a working WebGL context', () => {
    expect(resolveSceneMode(fakeView({ webgl: false, cores: 8 }))).toBe('static');
    expect(resolveSceneMode(fakeView({ webgl: true, cores: 8 }))).toBe('immersive');
  });

  it('keeps very weak devices on the static composition', () => {
    expect(resolveSceneMode(fakeView({ webgl: true, cores: 2 }))).toBe('static');
  });

  it('drops to lite quality on narrow-ish viewports and modest processors', () => {
    expect(resolveSceneQuality(fakeView({ matches: (query) => query.includes('1080'), cores: 8 }))).toBe('lite');
    expect(resolveSceneQuality(fakeView({ cores: 4 }))).toBe('lite');
    expect(resolveSceneQuality(fakeView({ cores: 10 }))).toBe('high');
    expect(resolveSceneQuality(undefined)).toBe('lite');
  });

  it('reports missing WebGL in jsdom instead of crashing', () => {
    expect(detectWebGlSupport(document)).toBe(false);
    expect(detectWebGlSupport(undefined)).toBe(false);
  });
});

describe('scroll choreography math', () => {
  it('clamps and eases within bounds', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5);
    expect(ramp(0.25, 0.5, 1)).toBe(0);
    expect(ramp(0.75, 0.5, 1)).toBeCloseTo(0.5, 5);
    expect(ramp(2, 0.5, 1)).toBe(1);
  });

  it('gives each chapter its own complete, slightly-leading phase window', () => {
    // Windows lead the raw sixths a little, so a chapter finishes while its copy is on screen.
    expect(chapterPhase(0.05, 2)).toBe(0);
    expect(chapterPhase(0.3, 2)).toBe(1);
    expect(chapterPhase(0.3, 3)).toBeGreaterThan(0);
    expect(chapterPhase(0.3, 3)).toBeLessThan(1);
    expect(chapterPhase(0.46, 3)).toBe(1);
    expect(chapterPhase(0.44, 4)).toBe(0);
    expect(chapterPhase(1, 6)).toBe(1);

    // Consecutive windows stay ordered: a later chapter never completes before an earlier one.
    for (let step = 0; step <= 100; step += 1) {
      const progress = step / 100;
      for (let chapter = 2; chapter <= 6; chapter += 1) {
        expect(chapterPhase(progress, chapter)).toBeLessThanOrEqual(chapterPhase(progress, chapter - 1));
      }
    }
  });

  it('is a pure function of progress, so backward scroll replays the story in reverse', () => {
    for (const progress of [0, 0.21, 0.47, 0.73, 0.99]) {
      expect(chapterPhase(progress, 3)).toBe(chapterPhase(progress, 3));
      expect(cameraSegment(progress)).toEqual(cameraSegment(progress));
    }
  });

  it('moves the camera monotonically through the six poses without teleports', () => {
    let previous = 0;

    for (let step = 0; step <= 200; step += 1) {
      const progress = step / 200;
      const { index, t } = cameraSegment(progress);
      const absolute = index + t;

      expect(absolute).toBeGreaterThanOrEqual(previous);
      // Each frame-to-frame jump stays a fraction of one segment: no pose is skipped.
      expect(absolute - previous).toBeLessThan(0.35);
      previous = absolute;
    }

    expect(cameraSegment(0)).toEqual({ index: 0, t: 0 });
    expect(cameraSegment(1).index).toBe(4);
    expect(cameraSegment(1).t).toBe(1);
  });
});
