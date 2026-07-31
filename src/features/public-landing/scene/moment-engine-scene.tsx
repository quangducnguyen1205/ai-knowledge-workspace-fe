import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import type { ScrollProgressStore } from '../narrative/use-scroll-progress';
import type { SceneQuality } from './scene-quality';
import { CameraRig, type PointerDrift } from './camera-rig';
import { TranscriptPlanes } from './transcript-planes';
import { SearchBeam } from './search-beam';
import { MomentNode } from './moment-node';
import { chapterPhase, easeInOut, lerp, ramp } from './progress-math';
import { createScreenTexture } from './transcript-texture';

/**
 * The Moment Engine stage: ink-black space, one cinematic video frame, its timeline, the
 * transcript field, the search beam, the canonical moment and the final composed workspace.
 * Every object is generated geometry with restrained emission — no downloaded assets.
 */

/** The source video: dark acrylic frame, softly lit footage, receding as knowledge forms. */
function VideoUnit({ progressRef }: { progressRef: RefObject<ScrollProgressStore> }) {
  const groupRef = useRef<Group>(null);
  const screenRef = useRef<MeshBasicMaterial>(null);
  const screenTexture = useMemo(() => createScreenTexture(), []);

  useEffect(() => () => screenTexture.dispose(), [screenTexture]);

  useFrame(() => {
    const progress = progressRef.current?.value ?? 0;
    const recede = easeInOut(chapterPhase(progress, 2));
    const composePhase = easeInOut(chapterPhase(progress, 6));
    const group = groupRef.current;

    if (group) {
      group.position.set(
        lerp(lerp(0, -0.5, recede), -3.35, composePhase),
        lerp(0.55, 0.35, composePhase),
        lerp(lerp(0, -1.9, recede), -0.6, composePhase),
      );
      group.rotation.y = lerp(lerp(0, 0.14, recede), 0.16, composePhase);
      group.scale.setScalar(lerp(1, 0.82, composePhase));
    }

    if (screenRef.current) {
      // The footage dims a step once attention moves to the transcript field.
      const dim = easeInOut(chapterPhase(progress, 3));
      screenRef.current.color.setScalar(lerp(1, 0.55, dim * 0.8));
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.55, 0]}>
      <RoundedBox args={[3.6, 2.1, 0.16]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color="#10161f" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[3.3, 1.84]} />
        <meshBasicMaterial ref={screenRef} map={screenTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The timeline rail under the video: one teal energy marker, later the amber lock point. */
function TimelineRail({ progressRef }: { progressRef: RefObject<ScrollProgressStore> }) {
  const groupRef = useRef<Group>(null);
  const playheadRef = useRef<Mesh>(null);
  const amberRef = useRef<Mesh>(null);

  useFrame(() => {
    const progress = progressRef.current?.value ?? 0;
    const lockPhase = easeInOut(chapterPhase(progress, 4));
    const composePhase = easeInOut(chapterPhase(progress, 6));
    const group = groupRef.current;

    if (group) {
      group.position.set(0, lerp(-0.75, -1.15, composePhase), lerp(0.15, 0.6, composePhase));
      group.scale.x = lerp(1, 1.22, composePhase);
    }

    if (playheadRef.current) {
      // Chapter four: the playhead seeks to the matching point.
      playheadRef.current.position.x = lerp(-0.9, 1.15, easeInOut(ramp(lockPhase, 0.3, 0.8)));
    }

    if (amberRef.current) {
      const reveal = easeInOut(ramp(lockPhase, 0.2, 0.45));
      amberRef.current.scale.setScalar(Math.max(reveal, 0.0001));
      amberRef.current.visible = reveal > 0.01;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.75, 0.15]}>
      <mesh>
        <boxGeometry args={[4.5, 0.045, 0.045]} />
        <meshStandardMaterial color="#1d2836" metalness={0.4} roughness={0.5} />
      </mesh>
      {[-1.7, -0.4, 0.5, 1.7].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.03, 0.14, 0.05]} />
          <meshStandardMaterial color="#31405a" />
        </mesh>
      ))}
      {/* The single teal energy marker of the raw-footage chapter. */}
      <mesh position={[-0.9, 0, 0.01]}>
        <boxGeometry args={[0.07, 0.24, 0.07]} />
        <meshStandardMaterial color="#2ea18f" emissive="#1fa08e" emissiveIntensity={1.1} />
      </mesh>
      {/* Playhead. */}
      <mesh ref={playheadRef} position={[-0.9, 0.02, 0.05]}>
        <boxGeometry args={[0.035, 0.34, 0.035]} />
        <meshStandardMaterial color="#e9eef2" emissive="#9fb4c0" emissiveIntensity={0.4} />
      </mesh>
      {/* Amber lock point revealed in chapter four. */}
      <mesh ref={amberRef} position={[1.15, 0, 0.02]} visible={false}>
        <boxGeometry args={[0.07, 0.26, 0.07]} />
        <meshStandardMaterial color="#e8b25c" emissive="#b7822f" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

/** Sparse static dust for depth. No idle animation — parallax alone brings it to life. */
function DustParticles() {
  const geometry = useMemo(() => {
    const count = 240;
    const positions = new Float32Array(count * 3);
    // Deterministic scatter (LCG) so the field never changes between visits.
    let state = 1234567;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (next() - 0.5) * 19;
      positions[index * 3 + 1] = (next() - 0.5) * 7.5 + 1;
      positions[index * 3 + 2] = (next() - 0.5) * 13 - 2;
    }

    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    return buffer;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.045} color="#9adcd2" transparent opacity={0.3} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export function MomentEngineScene({
  progressRef,
  driftRef,
  quality,
}: {
  progressRef: RefObject<ScrollProgressStore>;
  driftRef: RefObject<PointerDrift>;
  quality: SceneQuality;
}) {
  return (
    <>
      <fog attach="fog" args={['#050b10', 9, 30]} />
      <ambientLight intensity={0.55} color="#9fc4bd" />
      <directionalLight position={[4.5, 6, 5]} intensity={1.05} color="#dff0ea" />
      <pointLight position={[-6, 3.5, -3]} intensity={26} color="#1fa08e" distance={20} decay={2} />
      <CameraRig progressRef={progressRef} driftRef={driftRef} />
      <VideoUnit progressRef={progressRef} />
      <TimelineRail progressRef={progressRef} />
      <TranscriptPlanes progressRef={progressRef} quality={quality} />
      <SearchBeam progressRef={progressRef} quality={quality} />
      <MomentNode progressRef={progressRef} />
      {quality === 'high' ? <DustParticles /> : null}
    </>
  );
}
