import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { DoubleSide, type Mesh, type MeshStandardMaterial } from 'three';
import type { ScrollProgressStore } from '../narrative/use-scroll-progress';
import type { SceneQuality } from './scene-quality';
import { chapterPhase, easeInOut, lerp, ramp } from './progress-math';
import { createTranscriptTexture } from './transcript-texture';

/**
 * The transcript layers. In chapter one they hover as unformed fragments; chapter two fans them
 * into readable sheets; chapter three dims everything the search beam rejects and pushes the
 * matches forward; later chapters keep them as quiet context until the final composition
 * re-stacks them tidily.
 */

interface SheetTrack {
  fragment: { position: [number, number, number]; scale: number };
  fanned: { position: [number, number, number]; rotationY: number };
  final: { position: [number, number, number] };
  isMatch: boolean;
}

function buildMainTracks(count: number): SheetTrack[] {
  return Array.from({ length: count }, (_, index) => {
    const spread = index - (count - 1) / 2;

    return {
      fragment: { position: [spread * 1.55, 0.55 - Math.abs(spread) * 0.3, -0.85], scale: 0.5 },
      fanned: { position: [2.35, 1.3 - index * (2.7 / count), 1.5 - index * 0.3], rotationY: -0.34 },
      final: { position: [-0.4, 1.35 - index * (2.6 / count), 0.35] },
      isMatch: index === 1,
    };
  });
}

const CLUSTERS = [
  { position: [-4.6, 0.9, -3.6] as const, scale: 0.62, matchIndex: 0, seed: 40 },
  { position: [4.8, 1.7, -5.2] as const, scale: 0.55, matchIndex: -1, seed: 60 },
];

export function TranscriptPlanes({
  progressRef,
  quality,
}: {
  progressRef: RefObject<ScrollProgressStore>;
  quality: SceneQuality;
}) {
  const mainCount = quality === 'high' ? 5 : 3;
  const clusterCount = quality === 'high' ? 3 : 2;
  const tracks = useMemo(() => buildMainTracks(mainCount), [mainCount]);
  const textures = useMemo(
    () => tracks.map((_, index) => createTranscriptTexture('sheet', 11 + index)),
    [tracks],
  );
  const clusterTextures = useMemo(
    () => CLUSTERS.map((cluster) => Array.from(
      { length: clusterCount },
      (_, index) => createTranscriptTexture('sheet', cluster.seed + index),
    )),
    [clusterCount],
  );

  useEffect(() => () => {
    for (const texture of textures) texture.dispose();
    for (const texture of clusterTextures.flat()) texture.dispose();
  }, [textures, clusterTextures]);

  const sheetRefs = useRef<Array<Mesh | null>>([]);
  const clusterGroupRefs = useRef<Array<import('three').Group | null>>([]);
  const clusterFrameMaterials = useRef<Array<MeshStandardMaterial | null>>([]);
  const clusterSheetRefs = useRef<Array<Array<Mesh | null>>>(CLUSTERS.map(() => []));

  useFrame(() => {
    const progress = progressRef.current?.value ?? 0;
    const form = easeInOut(chapterPhase(progress, 2));
    const searchPhase = chapterPhase(progress, 3);
    const dimPhase = easeInOut(ramp(searchPhase, 0.25, 0.7));
    const focusPhase = easeInOut(chapterPhase(progress, 4));
    const composePhase = easeInOut(chapterPhase(progress, 6));

    tracks.forEach((track, index) => {
      const mesh = sheetRefs.current[index];

      if (!mesh) return;

      const x = lerp(track.fragment.position[0], track.fanned.position[0], form);
      const y = lerp(track.fragment.position[1], track.fanned.position[1], form);
      let z = lerp(track.fragment.position[2], track.fanned.position[2], form);
      let opacity = lerp(0.28, 0.92, form);

      if (track.isMatch) {
        z += 0.55 * dimPhase;
        opacity = lerp(opacity, 1, dimPhase);
      } else {
        opacity = lerp(opacity, 0.3, dimPhase);
      }

      opacity = lerp(opacity, track.isMatch ? 0.35 : 0.16, focusPhase);
      opacity = lerp(opacity, 0.55, composePhase);

      mesh.position.set(
        lerp(x, track.final.position[0], composePhase),
        lerp(y, track.final.position[1], composePhase),
        lerp(z, track.final.position[2], composePhase),
      );
      const scale = lerp(lerp(track.fragment.scale, 1, form), 0.86, composePhase);
      mesh.scale.setScalar(scale);
      mesh.rotation.y = lerp(lerp(0.1 * index, track.fanned.rotationY, form), 0, composePhase);

      const material = mesh.material as MeshStandardMaterial;
      material.opacity = opacity;
    });

    CLUSTERS.forEach((cluster, clusterIndex) => {
      const group = clusterGroupRefs.current[clusterIndex];
      const appear = easeInOut(ramp(searchPhase, 0.05, 0.4));
      let clusterOpacity = appear * 0.9;
      clusterOpacity = lerp(clusterOpacity, 0.2, focusPhase);
      clusterOpacity = lerp(clusterOpacity, 0.12, composePhase);

      if (group) {
        group.position.set(
          cluster.position[0],
          cluster.position[1] + (1 - appear) * -0.6,
          cluster.position[2] - composePhase * 1.4,
        );
        group.visible = clusterOpacity > 0.01;
      }

      const frameMaterial = clusterFrameMaterials.current[clusterIndex];

      if (frameMaterial) {
        frameMaterial.opacity = clusterOpacity;
      }

      clusterSheetRefs.current[clusterIndex]?.forEach((mesh, sheetIndex) => {
        if (!mesh) return;
        const isMatch = sheetIndex === cluster.matchIndex;
        let opacity = clusterOpacity;

        if (isMatch) {
          opacity = lerp(opacity, 1, dimPhase);
          mesh.position.z = 0.5 + 0.75 * dimPhase;
        } else {
          opacity = lerp(opacity, clusterOpacity * 0.4, dimPhase);
        }

        (mesh.material as MeshStandardMaterial).opacity = opacity;
      });
    });
  });

  return (
    <>
      {tracks.map((track, index) => (
        <mesh key={index} ref={(mesh) => { sheetRefs.current[index] = mesh; }}>
          <planeGeometry args={[2.55, 1.76]} />
          <meshStandardMaterial
            map={textures[index]}
            transparent
            opacity={0}
            side={DoubleSide}
            roughness={0.85}
            metalness={0.05}
            emissive={track.isMatch ? '#123c36' : '#000000'}
          />
        </mesh>
      ))}

      {CLUSTERS.map((cluster, clusterIndex) => (
        <group
          key={clusterIndex}
          ref={(group) => { clusterGroupRefs.current[clusterIndex] = group; }}
          scale={cluster.scale}
          visible={false}
        >
          <RoundedBox args={[3.4, 2, 0.14]} radius={0.06} smoothness={3}>
            <meshStandardMaterial
              ref={(material) => { clusterFrameMaterials.current[clusterIndex] = material; }}
              color="#121a24"
              metalness={0.5}
              roughness={0.4}
              transparent
              opacity={0}
            />
          </RoundedBox>
          {Array.from({ length: clusterCount }, (_, sheetIndex) => (
            <mesh
              key={sheetIndex}
              ref={(mesh) => { clusterSheetRefs.current[clusterIndex]![sheetIndex] = mesh; }}
              position={[1.15 + sheetIndex * 0.25, 0.85 - sheetIndex * 0.85, 0.5]}
              rotation={[0, -0.25, 0]}
            >
              <planeGeometry args={[2.1, 1.45]} />
              <meshStandardMaterial
                map={clusterTextures[clusterIndex]![sheetIndex]}
                transparent
                opacity={0}
                side={DoubleSide}
                roughness={0.85}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
