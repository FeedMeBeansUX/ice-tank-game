import * as THREE from 'three';
import { TUNING } from '@ice-tank-sumo/shared';

export type CameraMode = 'overview' | 'play';

/**
 * Camera that looks almost straight down with a slight tilt, and glides
 * smoothly to a focus point on the ice.
 *
 * - "play" shows about 50% of the arena's diameter (the in-game distance).
 *   From milestone 1 the focus point is your own tank.
 * - "overview" shows the whole arena. Milestone 0 only, for checking the scene.
 */
export class TopDownCamera {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'overview';

  private readonly focus = new THREE.Vector3();
  private readonly goalFocus = new THREE.Vector3();
  private distance: number;
  private readonly offsetDir = new THREE.Vector3();

  constructor(aspect: number) {
    const c = TUNING.camera;
    this.camera = new THREE.PerspectiveCamera(c.fovDeg, aspect, 0.5, 600);
    const tilt = THREE.MathUtils.degToRad(c.tiltDeg);
    const yaw = THREE.MathUtils.degToRad(c.yawDeg);
    this.offsetDir.set(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
    this.distance = this.goalDistance();
    this.apply();
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === 'overview') this.goalFocus.set(0, 0, 0);
  }

  /** Point on the ice the camera should centre on. */
  setFocus(x: number, z: number): void {
    this.goalFocus.set(x, 0, z);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-TUNING.camera.followSharpness * dt);
    this.focus.lerp(this.goalFocus, k);
    this.distance += (this.goalDistance() - this.distance) * k;
    this.apply();
  }

  /**
   * Distance at which the screen's shorter side spans the wanted share of the
   * arena's diameter.
   */
  private goalDistance(): number {
    const c = TUNING.camera;
    const fraction = this.mode === 'play' ? c.playViewFraction : c.overviewFraction;
    const span = fraction * TUNING.arena.radius * 2;
    const halfFov = THREE.MathUtils.degToRad(c.fovDeg) / 2;
    const aspect = this.camera.aspect;
    // Vertical field of view is fixed; on a portrait screen the width is the short side.
    const verticalSpan = aspect >= 1 ? span : span / aspect;
    return verticalSpan / 2 / Math.tan(halfFov);
  }

  private apply(): void {
    this.camera.position.copy(this.focus).addScaledVector(this.offsetDir, this.distance);
    this.camera.lookAt(this.focus);
  }
}
