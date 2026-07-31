import { useEffect, type RefObject } from 'react';

const MAX_TILT_DEGREES = 5;

/**
 * Restrained pointer-driven depth for the decorative spatial scene.
 *
 * Precise pointers only: the effect attaches nothing when the pointer is coarse, when reduced
 * motion is requested, when 3D transforms are unsupported, or when matchMedia itself is missing
 * (jsdom) — the scene then renders with its static composition. Movement writes two CSS custom
 * properties through one pending animation frame, so no React state updates happen per pointer
 * move, and the scene returns to neutral on pointer exit. There is no idle animation.
 */
export function usePointerDepth(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window.matchMedia !== 'function') return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const supports3d =
      typeof CSS !== 'undefined' && CSS.supports?.('transform-style', 'preserve-3d');
    if (!finePointer.matches || reducedMotion.matches || !supports3d) return;

    let frame = 0;
    let tiltX = 0;
    let tiltY = 0;

    const apply = () => {
      frame = 0;
      element.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
    };

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      tiltX = ((event.clientY - rect.top) / rect.height - 0.5) * -2 * MAX_TILT_DEGREES;
      tiltY = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_TILT_DEGREES;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const detach = () => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerleave', reset);
      reset();
    };

    const onPreferenceChange = () => {
      if (!finePointer.matches || reducedMotion.matches) detach();
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerleave', reset);
    reducedMotion.addEventListener?.('change', onPreferenceChange);
    finePointer.addEventListener?.('change', onPreferenceChange);

    return () => {
      detach();
      reducedMotion.removeEventListener?.('change', onPreferenceChange);
      finePointer.removeEventListener?.('change', onPreferenceChange);
    };
  }, [ref]);
}
