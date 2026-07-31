import { useEffect, useState } from 'react';

/**
 * Capability gate for the Moment Engine scene. The landing narrative is complete HTML either way;
 * this module only decides whether the decorative WebGL layer may mount and how heavy it may be.
 * It deliberately imports no 3D code so the decision itself stays in the small landing chunk.
 */

export type SceneMode = 'immersive' | 'static';
export type SceneQuality = 'high' | 'lite';

export interface SceneProfile {
  mode: SceneMode;
  quality: SceneQuality;
}

/**
 * Any of these puts the visitor on the static composition: reduced motion is a hard opt-out,
 * coarse pointers mark phones/tablets where a long pinned scene hurts, and 900px is the canonical
 * breakpoint below which the scene must yield to content.
 */
const STATIC_MEDIA_QUERIES = [
  '(prefers-reduced-motion: reduce)',
  '(pointer: coarse)',
  '(max-width: 900px)',
] as const;

const LITE_MEDIA_QUERY = '(max-width: 1080px)';

export function detectWebGlSupport(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) {
    return false;
  }

  try {
    const canvas = doc.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');

    if (!context) {
      return false;
    }

    // Release the probe context immediately instead of waiting for garbage collection.
    (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function resolveSceneMode(view: Window | undefined = typeof window === 'undefined' ? undefined : window): SceneMode {
  if (!view || typeof view.matchMedia !== 'function') {
    return 'static';
  }

  if (STATIC_MEDIA_QUERIES.some((query) => view.matchMedia(query).matches)) {
    return 'static';
  }

  const cores = view.navigator?.hardwareConcurrency;

  if (typeof cores === 'number' && cores > 0 && cores < 4) {
    return 'static';
  }

  return detectWebGlSupport(view.document) ? 'immersive' : 'static';
}

export function resolveSceneQuality(view: Window | undefined = typeof window === 'undefined' ? undefined : window): SceneQuality {
  if (!view || typeof view.matchMedia !== 'function') {
    return 'lite';
  }

  if (view.matchMedia(LITE_MEDIA_QUERY).matches) {
    return 'lite';
  }

  const cores = view.navigator?.hardwareConcurrency;

  if (typeof cores === 'number' && cores > 0 && cores <= 4) {
    return 'lite';
  }

  return 'high';
}

/** Resolves the scene profile once and follows live media-query changes (resize, OS setting). */
export function useSceneProfile(): SceneProfile {
  const [profile, setProfile] = useState<SceneProfile>(() => ({
    mode: resolveSceneMode(),
    quality: resolveSceneQuality(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const watched = [...STATIC_MEDIA_QUERIES, LITE_MEDIA_QUERY].map((query) => window.matchMedia(query));
    const update = () => setProfile({ mode: resolveSceneMode(), quality: resolveSceneQuality() });

    for (const query of watched) {
      query.addEventListener?.('change', update);
    }

    return () => {
      for (const query of watched) {
        query.removeEventListener?.('change', update);
      }
    };
  }, []);

  return profile;
}
