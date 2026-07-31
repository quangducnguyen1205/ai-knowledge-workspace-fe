import { useEffect, useRef, type RefObject } from 'react';
import { Canvas, invalidate } from '@react-three/fiber';
import { useScrollProgress } from '../narrative/use-scroll-progress';
import type { PointerDrift } from './camera-rig';
import { MomentEngineScene } from './moment-engine-scene';
import type { SceneQuality } from './scene-quality';

/**
 * Default export so the whole WebGL stack (three, fiber, drei, GSAP) stays in one lazy chunk.
 *
 * Rendering is demand-based: a frame is produced only when scroll progress changes, the pointer
 * drifts, or the camera is still settling — a hidden tab or an idle page renders nothing. React
 * Three Fiber disposes the scene graph on unmount; the scroll trigger and window listeners are
 * removed in their own effects.
 */
export default function MomentEngineCanvas({
  stageRef,
  quality,
}: {
  stageRef: RefObject<HTMLElement | null>;
  quality: SceneQuality;
}) {
  const progressRef = useScrollProgress(stageRef, () => invalidate());
  const driftRef = useRef<PointerDrift>({ targetX: 0, targetY: 0 });

  useEffect(() => {
    // One passive listener, no React state: the rig damps toward these targets per frame.
    const handlePointerMove = (event: PointerEvent) => {
      if (document.hidden) {
        return;
      }

      driftRef.current.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      driftRef.current.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    };
    const resetDrift = () => {
      driftRef.current.targetX = 0;
      driftRef.current.targetY = 0;
      invalidate();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        invalidate();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', resetDrift);
    document.documentElement.addEventListener('pointerleave', resetDrift);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', resetDrift);
      document.documentElement.removeEventListener('pointerleave', resetDrift);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <Canvas
      frameloop="demand"
      dpr={quality === 'high' ? [1, 1.5] : [1, 1]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 60, position: [0, 0.6, 9.2] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <MomentEngineScene progressRef={progressRef} driftRef={driftRef} quality={quality} />
    </Canvas>
  );
}
