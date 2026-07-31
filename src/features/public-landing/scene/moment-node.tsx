import { useEffect, useMemo, useRef, type ElementRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Quaternion, Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import type { ScrollProgressStore } from '../narrative/use-scroll-progress';
import { chapterPhase, easeInOut, lerp, ramp } from './progress-math';
import { createTranscriptTexture } from './transcript-texture';

/**
 * The canonical moment. It arrives at the end of the search chapter, locks under the camera in
 * chapter four with its two context rows, an amber timestamp tick and a line back to the source
 * timeline, becomes a preserved moment object (stable-link ring, save flag, progress arc) in
 * chapter five, and finally takes its place in the composed workspace.
 */

const ENTRY: [number, number, number] = [2.6, 1.2, -0.6];
const LOCK: [number, number, number] = [1.35, 0.15, 1.9];
const MOMENT: [number, number, number] = [-0.5, 1.05, 2.3];
const FINAL: [number, number, number] = [2.9, 0.8, 0.5];
const TIMELINE_ANCHOR = new Vector3(1.15, -0.72, 0.35);

const CONSTELLATION_POINTS: Array<[number, number, number]> = [
  [-2.4, 1.4, -1.6], [-1.1, 2.6, -0.4], [0.4, 2.1, -1.9], [-2.9, 2.4, 0.2],
  [1.2, 2.9, -0.9], [-0.2, 3.2, 0.6], [-1.8, 3.0, -1.2], [0.9, 1.8, 0.9], [-3.1, 1.8, -0.7],
];

const CONSTELLATION_EDGES: Array<[number, number, number]> = [
  CONSTELLATION_POINTS[0]!, CONSTELLATION_POINTS[1]!, CONSTELLATION_POINTS[4]!,
  CONSTELLATION_POINTS[5]!, CONSTELLATION_POINTS[6]!, CONSTELLATION_POINTS[3]!,
];

const UP = new Vector3(0, 1, 0);

export function MomentNode({ progressRef }: { progressRef: RefObject<ScrollProgressStore> }) {
  const rowTexture = useMemo(() => createTranscriptTexture('row-locked', 5), []);
  const neighborTextures = useMemo(
    () => [createTranscriptTexture('row', 21), createTranscriptTexture('row', 22)],
    [],
  );

  useEffect(() => () => {
    rowTexture.dispose();
    for (const texture of neighborTextures) texture.dispose();
  }, [rowTexture, neighborTextures]);

  const rowGroupRef = useRef<Group>(null);
  const rowMaterialRef = useRef<MeshStandardMaterial>(null);
  const neighborMaterialRefs = useRef<Array<MeshStandardMaterial | null>>([]);
  const tickRef = useRef<Mesh>(null);
  const badgeRefs = useRef<Array<Mesh | null>>([]);
  const connectorRef = useRef<Mesh>(null);
  const constellationGroupRef = useRef<Group>(null);
  const constellationMaterialRefs = useRef<Array<MeshStandardMaterial | null>>([]);
  const constellationLineRef = useRef<ElementRef<typeof Line>>(null);

  const scratch = useRef({
    position: new Vector3(),
    lineEnd: new Vector3(),
    mid: new Vector3(),
    direction: new Vector3(),
    quaternion: new Quaternion(),
  });

  useFrame(() => {
    const progress = progressRef.current?.value ?? 0;
    const appear = easeInOut(ramp(chapterPhase(progress, 3), 0.72, 1));
    const lockPhase = easeInOut(chapterPhase(progress, 4));
    const keepPhase = easeInOut(chapterPhase(progress, 5));
    const composePhase = easeInOut(chapterPhase(progress, 6));
    const s = scratch.current;

    // Row card journey: entry → lock → moment object → final composition slot.
    s.position.set(
      lerp(lerp(lerp(ENTRY[0], LOCK[0], appear), MOMENT[0], keepPhase), FINAL[0], composePhase),
      lerp(lerp(lerp(ENTRY[1], LOCK[1], appear), MOMENT[1], keepPhase), FINAL[1], composePhase),
      lerp(lerp(lerp(ENTRY[2], LOCK[2], appear), MOMENT[2], keepPhase), FINAL[2], composePhase),
    );

    const rowGroup = rowGroupRef.current;

    if (rowGroup) {
      rowGroup.position.copy(s.position);
      rowGroup.rotation.y = lerp(lerp(0.3, -0.06, appear), -0.12, composePhase);
      rowGroup.scale.setScalar(lerp(lerp(0.8, 1, appear), 0.92, composePhase));
      rowGroup.visible = appear > 0.01;
    }

    if (rowMaterialRef.current) {
      rowMaterialRef.current.opacity = appear;
      rowMaterialRef.current.emissiveIntensity = 0.35 + lockPhase * 0.65;
    }

    // Context rows exist for the lock chapter and quietly bow out as the moment is preserved.
    const neighborOpacity = easeInOut(ramp(lockPhase, 0.1, 0.42)) * 0.62 * (1 - keepPhase);
    neighborMaterialRefs.current.forEach((material) => {
      if (material) material.opacity = neighborOpacity;
    });

    if (tickRef.current) {
      const reveal = easeInOut(ramp(lockPhase, 0.2, 0.48));
      tickRef.current.scale.y = Math.max(reveal, 0.0001);
      tickRef.current.visible = reveal > 0.01;
    }

    // Preservation badges: stable link, save flag, progress arc — staggered, deliberate.
    const badgeWindows: Array<[number, number]> = [[0.1, 0.4], [0.25, 0.55], [0.4, 0.7]];
    badgeRefs.current.forEach((badge, index) => {
      if (!badge) return;
      const window = badgeWindows[index]!;
      const reveal = easeInOut(ramp(keepPhase, window[0], window[1]));
      badge.scale.setScalar(Math.max(reveal, 0.0001));
      badge.visible = reveal > 0.01;
    });

    // Connection path back to the source timeline, drawn from the timeline upward.
    const connector = connectorRef.current;

    if (connector) {
      const draw = easeInOut(ramp(lockPhase, 0.3, 0.72));
      const strength = draw * (1 - composePhase) * lerp(1, 0.3, keepPhase);

      if (strength > 0.01 && rowGroup) {
        s.lineEnd.copy(rowGroup.position);
        s.lineEnd.y -= 0.38;
        s.lineEnd.lerpVectors(TIMELINE_ANCHOR, s.lineEnd, draw);
        s.mid.addVectors(TIMELINE_ANCHOR, s.lineEnd).multiplyScalar(0.5);
        s.direction.subVectors(s.lineEnd, TIMELINE_ANCHOR);
        const length = Math.max(s.direction.length(), 0.0001);
        connector.position.copy(s.mid);
        connector.quaternion.copy(s.quaternion.setFromUnitVectors(UP, s.direction.normalize()));
        connector.scale.set(1, length, 1);
        connector.visible = true;
        (connector.material as MeshStandardMaterial).opacity = strength * 0.85;
      } else {
        connector.visible = false;
      }
    }

    // The restrained knowledge constellation of preserved moments.
    const constellationOpacity = keepPhase * lerp(0.85, 0.5, composePhase);
    const constellationGroup = constellationGroupRef.current;

    if (constellationGroup) {
      constellationGroup.visible = constellationOpacity > 0.01;
      constellationGroup.position.y = composePhase * 0.9;
    }

    constellationMaterialRefs.current.forEach((material) => {
      if (material) material.opacity = constellationOpacity;
    });

    const constellationLine = constellationLineRef.current;

    if (constellationLine) {
      constellationLine.material.opacity = constellationOpacity * 0.35;
    }
  });

  return (
    <>
      <group ref={rowGroupRef} visible={false}>
        <mesh>
          <planeGeometry args={[2.7, 0.64]} />
          <meshStandardMaterial
            ref={rowMaterialRef}
            map={rowTexture}
            transparent
            opacity={0}
            roughness={0.75}
            metalness={0.05}
            emissive="#2b2213"
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh ref={tickRef} position={[-1.42, 0, 0.05]} visible={false}>
          <boxGeometry args={[0.06, 0.56, 0.06]} />
          <meshStandardMaterial color="#e8b25c" emissive="#e8b25c" emissiveIntensity={0.8} />
        </mesh>
        {/* Stable-link ring */}
        <mesh ref={(mesh) => { badgeRefs.current[0] = mesh; }} position={[-1.16, 0.46, 0.08]} visible={false}>
          <torusGeometry args={[0.085, 0.016, 10, 28]} />
          <meshStandardMaterial color="#4fd8e8" emissive="#2a8fa3" emissiveIntensity={0.7} />
        </mesh>
        {/* Save-moment flag */}
        <mesh ref={(mesh) => { badgeRefs.current[1] = mesh; }} position={[-0.88, 0.46, 0.08]} visible={false}>
          <boxGeometry args={[0.12, 0.15, 0.04]} />
          <meshStandardMaterial color="#2ea18f" emissive="#176f64" emissiveIntensity={0.7} />
        </mesh>
        {/* Playback-progress arc */}
        <mesh ref={(mesh) => { badgeRefs.current[2] = mesh; }} position={[-0.62, 0.46, 0.08]} rotation={[0, 0, 2.2]} visible={false}>
          <torusGeometry args={[0.095, 0.018, 10, 28, 4.4]} />
          <meshStandardMaterial color="#e8b25c" emissive="#b7822f" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {[-0.68, 0.68].map((offset, index) => (
        <mesh key={offset} position={[LOCK[0], LOCK[1] + offset, LOCK[2] - 0.06]} rotation={[0, -0.06, 0]}>
          <planeGeometry args={[2.7, 0.52]} />
          <meshStandardMaterial
            ref={(material) => { neighborMaterialRefs.current[index] = material; }}
            map={neighborTextures[index]}
            transparent
            opacity={0}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      ))}

      <mesh ref={connectorRef} visible={false}>
        <cylinderGeometry args={[0.014, 0.014, 1, 6]} />
        <meshStandardMaterial
          color="#e8b25c"
          emissive="#b7822f"
          emissiveIntensity={0.55}
          transparent
          opacity={0}
        />
      </mesh>

      <group ref={constellationGroupRef} visible={false}>
        {CONSTELLATION_POINTS.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial
              ref={(material) => { constellationMaterialRefs.current[index] = material; }}
              color="#7fd9d2"
              emissive="#1fa08e"
              emissiveIntensity={0.6}
              transparent
              opacity={0}
            />
          </mesh>
        ))}
        <Line
          ref={constellationLineRef}
          points={CONSTELLATION_EDGES}
          color="#7fd9d2"
          transparent
          opacity={0}
          lineWidth={1}
        />
      </group>
    </>
  );
}
