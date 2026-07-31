import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Group, type MeshBasicMaterial, type PointLight } from 'three';
import type { ScrollProgressStore } from '../narrative/use-scroll-progress';
import type { SceneQuality } from './scene-quality';
import { chapterPhase, easeInOut, lerp, ramp } from './progress-math';

/**
 * The workspace-search sweep of chapter three: a restrained electric-cyan blade that crosses the
 * transcript field once, carrying the query object with it. It exists only inside its chapter —
 * opacity rises from and returns to zero at the chapter edges — so no stray glow leaks into the
 * rest of the journey.
 */
export function SearchBeam({
  progressRef,
  quality,
}: {
  progressRef: RefObject<ScrollProgressStore>;
  quality: SceneQuality;
}) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<MeshBasicMaterial>(null);
  const glowRef = useRef<MeshBasicMaterial>(null);
  const chipRef = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame(() => {
    const progress = progressRef.current?.value ?? 0;
    const phase = chapterPhase(progress, 3);
    const sweep = easeInOut(ramp(phase, 0.12, 0.88));
    const presence = Math.sin(Math.PI * ramp(phase, 0.04, 0.96));
    const group = groupRef.current;

    if (group) {
      group.position.x = lerp(-6.4, 6.4, sweep);
      group.visible = presence > 0.02;
    }

    if (coreRef.current) coreRef.current.opacity = presence * 0.85;
    if (glowRef.current) glowRef.current.opacity = presence * 0.22;
    if (chipRef.current) chipRef.current.opacity = presence * 0.95;

    if (lightRef.current) {
      lightRef.current.intensity = presence * 26;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.8, -1.4]} visible={false}>
      <mesh>
        <planeGeometry args={[0.14, 7.6]} />
        <meshBasicMaterial
          ref={coreRef}
          color="#4fd8e8"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[1.05, 7.6]} />
        <meshBasicMaterial
          ref={glowRef}
          color="#2a8fa3"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* The query object riding the beam. */}
      <mesh position={[0, 3.4, 0.1]}>
        <boxGeometry args={[0.95, 0.32, 0.07]} />
        <meshBasicMaterial ref={chipRef} color="#123a44" transparent opacity={0} />
      </mesh>
      {quality === 'high' ? (
        <pointLight ref={lightRef} color="#4fd8e8" intensity={0} distance={9} decay={2} />
      ) : null}
    </group>
  );
}
