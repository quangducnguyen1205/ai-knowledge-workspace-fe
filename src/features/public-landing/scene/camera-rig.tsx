import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { ScrollProgressStore } from '../narrative/use-scroll-progress';
import { cameraSegment, damp } from './progress-math';

export interface PointerDrift {
  /** Normalized pointer offset in [-1, 1] each axis; {0,0} when the pointer rests or leaves. */
  targetX: number;
  targetY: number;
}

interface CameraPose {
  position: [number, number, number];
  look: [number, number, number];
}

/**
 * One continuous camera journey across the six chapters. Scroll owns the pose; the pointer adds
 * only a small damped drift (≈5° maximum) on precise pointers. Every pose change is eased and
 * damped, so there is never a teleport — including backward scroll and mid-scroll reloads,
 * which snap on the very first frame instead of animating from chapter one.
 */
const POSES: CameraPose[] = [
  { position: [0, 0.6, 9.2], look: [0, 0.1, 0] },
  { position: [2.4, 1.5, 6.6], look: [0.9, 0.3, 0.6] },
  { position: [-3.8, 2.3, 8.6], look: [-0.3, 0.6, -1.6] },
  { position: [1.0, 0.62, 5.9], look: [1.25, 0.1, 1.9] },
  { position: [-1.6, 1.45, 6.2], look: [-0.4, 0.95, 2.0] },
  { position: [0, 2.1, 10.8], look: [0, 0.35, 0] },
];

const MAX_DRIFT_RADIANS = 0.085;
const SETTLE_EPSILON = 0.0004;

export function CameraRig({
  progressRef,
  driftRef,
}: {
  progressRef: RefObject<ScrollProgressStore>;
  driftRef: RefObject<PointerDrift>;
}) {
  const state = useRef({
    initialized: false,
    position: new Vector3(),
    look: new Vector3(),
    driftX: 0,
    driftY: 0,
    targetPosition: new Vector3(),
    targetLook: new Vector3(),
    lookTarget: new Vector3(),
  });

  useFrame(({ camera, invalidate }, delta) => {
    const rig = state.current;
    const progress = progressRef.current?.value ?? 0;
    const drift = driftRef.current ?? { targetX: 0, targetY: 0 };
    const { index, t } = cameraSegment(progress);
    const from = POSES[index]!;
    const to = POSES[index + 1]!;

    rig.targetPosition.set(...from.position).lerp(rig.targetLook.set(...to.position), t);
    const targetPosition = rig.targetPosition;
    rig.targetLook.set(...from.look).lerp(rig.lookTarget.set(...to.look), t);
    const targetLook = rig.targetLook;

    if (!rig.initialized) {
      // First frame (including a reload mid-scroll): adopt the scroll pose without a flight.
      rig.initialized = true;
      rig.position.copy(targetPosition);
      rig.look.copy(targetLook);
    }

    const smoothing = Math.min(1, delta * 4.2);
    rig.position.lerp(targetPosition, smoothing);
    rig.look.lerp(targetLook, smoothing);
    rig.driftX = damp(rig.driftX, drift.targetX * MAX_DRIFT_RADIANS, 5, delta);
    rig.driftY = damp(rig.driftY, drift.targetY * MAX_DRIFT_RADIANS, 5, delta);

    camera.position.set(
      rig.position.x + rig.driftX * 0.9,
      rig.position.y - rig.driftY * 0.6,
      rig.position.z,
    );
    rig.lookTarget.set(
      rig.look.x + rig.driftX * 2.4,
      rig.look.y - rig.driftY * 1.6,
      rig.look.z,
    );
    camera.lookAt(rig.lookTarget);

    const settled =
      rig.position.distanceToSquared(targetPosition) < SETTLE_EPSILON * SETTLE_EPSILON &&
      rig.look.distanceToSquared(targetLook) < SETTLE_EPSILON * SETTLE_EPSILON &&
      Math.abs(rig.driftX - drift.targetX * MAX_DRIFT_RADIANS) < SETTLE_EPSILON &&
      Math.abs(rig.driftY - drift.targetY * MAX_DRIFT_RADIANS) < SETTLE_EPSILON;

    if (!settled) {
      // Demand frameloop: keep requesting frames only while something is still converging.
      invalidate();
    }
  });

  return null;
}
