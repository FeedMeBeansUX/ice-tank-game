import * as THREE from 'three';
import type { TankState } from '@ice-tank-sumo/shared';

/**
 * Draws one tank: a low-poly hull with tracks and a turret that turns on its
 * own. Also draws the falling animation and the spawn-protection blink.
 */

/** Player colours (the requirements ask for a distinct colour per player). */
export const PLAYER_COLORS = ['#ff7a3d', '#3fb5ff', '#7bd65b', '#c77dff'];
export const DUMMY_COLOR = '#8f9ba6';

const GRAVITY = 14;

function flat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.05 });
}

/** Model A: small and light. Built for a collision radius of about 1.1 m, nose along +x. */
function buildModelA(color: THREE.Color): { root: THREE.Group; turret: THREE.Group; materials: THREE.MeshStandardMaterial[] } {
  const body = flat(color);
  const dark = flat(color.clone().multiplyScalar(0.55));
  const tracks = flat('#2b3138');
  const root = new THREE.Group();

  // Tracks
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 0.42), tracks);
    track.position.set(0, 0.21, side * 0.66);
    root.add(track);
  }

  // Hull: a six-sided plate seen from above, with a pointed nose.
  const outline = new THREE.Shape();
  outline.moveTo(1.05, 0);
  outline.lineTo(0.7, 0.55);
  outline.lineTo(-0.95, 0.55);
  outline.lineTo(-1.05, 0);
  outline.lineTo(-0.95, -0.55);
  outline.lineTo(0.7, -0.55);
  outline.closePath();
  const hullGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.34, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, body);
  hull.position.y = 0.32;
  root.add(hull);

  // Turret
  const turret = new THREE.Group();
  turret.position.y = 0.78;
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.32, 6), dark);
  dome.rotation.y = Math.PI / 6;
  turret.add(dome);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.14), dark);
  barrel.position.set(0.72, 0.02, 0);
  turret.add(barrel);
  root.add(turret);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret, materials: [body, dark, tracks] };
}

export class TankView {
  readonly root = new THREE.Group();
  private readonly body: THREE.Group;
  private readonly turret: THREE.Group;
  private readonly materials: THREE.MeshStandardMaterial[];
  private readonly ownRing: THREE.Mesh | null = null;

  // Previous simulation state, for smooth drawing between physics steps.
  private prev = { x: 0, z: 0, heading: 0, turret: 0 };

  constructor(
    tank: TankState,
    color: THREE.ColorRepresentation,
    isOwn: boolean,
  ) {
    const built = buildModelA(new THREE.Color(color));
    this.body = built.root;
    this.turret = built.turret;
    this.materials = built.materials;
    this.root.add(this.body);

    if (isOwn) {
      // Ring on the ice under your own tank, so you can always find yourself.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.45, 1.65, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.root.add(ring);
      this.ownRing = ring;
    }
    this.snap(tank);
  }

  /** Remember the state before a physics step. */
  capture(tank: TankState): void {
    this.prev.x = tank.x;
    this.prev.z = tank.z;
    this.prev.heading = tank.heading;
    this.prev.turret = tank.turret;
  }

  /** Jump straight to the current state (after a respawn). */
  snap(tank: TankState): void {
    this.capture(tank);
  }

  /**
   * Draw the tank `alpha` of the way between the previous and the current
   * physics step. Returns the drawn ground position (for the camera).
   */
  draw(tank: TankState, alpha: number, time: number): { x: number; z: number } {
    const x = this.prev.x + (tank.x - this.prev.x) * alpha;
    const z = this.prev.z + (tank.z - this.prev.z) * alpha;
    const heading = this.prev.heading + angleLerp(this.prev.heading, tank.heading, alpha);
    const turret = this.prev.turret + angleLerp(this.prev.turret, tank.turret, alpha);

    this.root.position.set(x, 0, z);
    this.body.rotation.set(0, -heading, 0);
    this.turret.rotation.y = -(turret - heading);

    let opacity = 1;
    if (tank.status === 'falling') {
      // Drop and tip over, then fade out.
      const t = tank.fallTime;
      this.root.position.y = -0.5 * GRAVITY * t * t;
      this.body.rotation.z = -Math.min(t * 3, 1.4);
      opacity = Math.max(0, 1 - Math.max(0, t - 0.5) / 0.6);
    } else {
      this.body.rotation.z = 0;
      this.root.position.y = 0;
      // Blink while spawn-protected (can't be pushed).
      if (tank.protectionLeft > 0) opacity = Math.sin(time * 28) > 0 ? 0.35 : 0.75;
    }
    this.setOpacity(opacity);
    this.root.visible = opacity > 0.01;
    if (this.ownRing) this.ownRing.visible = tank.status === 'alive';
    return { x, z };
  }

  private setOpacity(opacity: number): void {
    const transparent = opacity < 1;
    for (const m of this.materials) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = opacity;
    }
  }
}

function angleLerp(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d * t;
}

/** Expanding ring where a click was accepted (instant feedback). */
export class ClickMarkers {
  readonly group = new THREE.Group();
  private readonly markers: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly geometry = new THREE.RingGeometry(0.55, 0.75, 28);

  add(x: number, z: number): void {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.03, z);
    this.group.add(mesh);
    this.markers.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    const life = 0.5;
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i]!;
      m.age += dt;
      const t = m.age / life;
      if (t >= 1) {
        this.group.remove(m.mesh);
        (m.mesh.material as THREE.Material).dispose();
        this.markers.splice(i, 1);
        continue;
      }
      m.mesh.scale.setScalar(1 + t * 1.2);
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
    }
  }
}
