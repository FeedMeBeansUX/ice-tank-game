import * as THREE from 'three';
import type { ProjectileState, TankModel, TankState, Tuning } from '@ice-tank-sumo/shared';

/**
 * Drawing: tanks (low-poly hull, tracks and a turret that turns on its own),
 * projectiles, click and hit markers, and your range ring.
 */

/** Player colours (the requirements ask for a distinct colour per player). */
export const PLAYER_COLORS = ['#ff7a3d', '#3fb5ff', '#7bd65b', '#c77dff'];
export const DUMMY_COLOR = '#8f9ba6';

const GRAVITY = 14;

function flat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.05 });
}

interface Shape {
  /** Half-length and half-width of the hull plate. */
  halfLength: number;
  halfWidth: number;
  /** How far back from the front the nose taper starts (0 = blunt). */
  nose: number;
  hullHeight: number;
  trackLength: number;
  trackWidth: number;
  trackHeight: number;
  turretRadius: number;
  turretHeight: number;
  barrelLength: number;
  barrelThickness: number;
}

/** Model A: small, pointed nose, thin barrel. Model B: big, blunt, thick barrel. */
const SHAPES: Record<TankModel, Shape> = {
  modelA: {
    halfLength: 1.05, halfWidth: 0.55, nose: 0.35, hullHeight: 0.34,
    trackLength: 2.1, trackWidth: 0.42, trackHeight: 0.42,
    turretRadius: 0.48, turretHeight: 0.32, barrelLength: 0.95, barrelThickness: 0.14,
  },
  modelB: {
    halfLength: 1.4, halfWidth: 0.85, nose: 0.15, hullHeight: 0.46,
    trackLength: 2.8, trackWidth: 0.55, trackHeight: 0.55,
    turretRadius: 0.75, turretHeight: 0.46, barrelLength: 1.25, barrelThickness: 0.3,
  },
};

function buildTank(model: TankModel, color: THREE.Color) {
  const s = SHAPES[model];
  const body = flat(color);
  const dark = flat(color.clone().multiplyScalar(0.55));
  const tracks = flat('#2b3138');
  const root = new THREE.Group();

  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(s.trackLength, s.trackHeight, s.trackWidth), tracks);
    track.position.set(0, s.trackHeight / 2, side * (s.halfWidth + s.trackWidth * 0.25));
    root.add(track);
  }

  // Hull: a six-sided plate seen from above.
  const outline = new THREE.Shape();
  outline.moveTo(s.halfLength, 0);
  outline.lineTo(s.halfLength - s.nose, s.halfWidth);
  outline.lineTo(-s.halfLength + 0.1, s.halfWidth);
  outline.lineTo(-s.halfLength, 0);
  outline.lineTo(-s.halfLength + 0.1, -s.halfWidth);
  outline.lineTo(s.halfLength - s.nose, -s.halfWidth);
  outline.closePath();
  const hullGeometry = new THREE.ExtrudeGeometry(outline, {
    depth: s.hullHeight,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 1,
  });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, body);
  hull.position.y = s.trackHeight * 0.75;
  root.add(hull);

  const turret = new THREE.Group();
  turret.position.y = s.trackHeight * 0.75 + s.hullHeight + 0.12 + s.turretHeight / 2;
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(s.turretRadius * 0.82, s.turretRadius, s.turretHeight, 6), dark);
  dome.rotation.y = Math.PI / 6;
  turret.add(dome);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(s.barrelLength, s.barrelThickness, s.barrelThickness), dark);
  barrel.position.set(s.turretRadius * 0.6 + s.barrelLength / 2, 0.02, 0);
  turret.add(barrel);
  root.add(turret);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret, body, dark, materials: [body, dark, tracks] };
}

export class TankView {
  readonly root = new THREE.Group();
  readonly model: TankModel;
  private readonly body: THREE.Group;
  private readonly turret: THREE.Group;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly turretMaterial: THREE.MeshStandardMaterial;
  private readonly materials: THREE.MeshStandardMaterial[];
  private readonly color: THREE.Color;
  private ownRing: THREE.Mesh | null = null;
  private rangeRing: THREE.LineLoop | null = null;

  // Previous simulation state, for smooth drawing between physics steps.
  private prev = { x: 0, z: 0, heading: 0, turret: 0 };

  constructor(tank: TankState, color: THREE.ColorRepresentation, isOwn: boolean) {
    this.model = tank.model;
    this.color = new THREE.Color(color);
    const built = buildTank(tank.model, this.color);
    this.body = built.root;
    this.turret = built.turret;
    this.bodyMaterial = built.body;
    this.turretMaterial = built.dark;
    this.materials = built.materials;
    this.root.add(this.body);

    if (isOwn) {
      // Ring on the ice under your own tank, so you can always find yourself.
      const r = SHAPES[tank.model].halfLength + 0.45;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.2, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.root.add(ring);
      this.ownRing = ring;

      // Faint circle showing the firing range.
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      }
      const range = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, dashSize: 0.05, gapSize: 0.035, depthWrite: false }),
      );
      range.computeLineDistances();
      range.position.y = 0.03;
      this.root.add(range);
      this.rangeRing = range;
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
  draw(tank: TankState, alpha: number, time: number, tuning: Tuning, showRange: boolean): { x: number; z: number } {
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
      // Blink while spawn-protected (can't be pushed or hit).
      if (tank.protectionLeft > 0) opacity = Math.sin(time * 28) > 0 ? 0.35 : 0.75;
    }
    this.setOpacity(opacity);
    this.root.visible = opacity > 0.01;

    // Glow while boosting (hull) or while power shots are charged (turret).
    const pulse = 0.55 + 0.25 * Math.sin(time * 14);
    this.bodyMaterial.emissive.copy(this.color).multiplyScalar(tank.boostLeft > 0 ? pulse : 0);
    this.turretMaterial.emissive.set(tank.powerShotsLeft > 0 ? '#ffcc33' : '#000000').multiplyScalar(tank.powerShotsLeft > 0 ? pulse : 0);

    const alive = tank.status === 'alive';
    if (this.ownRing) this.ownRing.visible = alive;
    if (this.rangeRing) {
      this.rangeRing.visible = alive && showRange;
      this.rangeRing.scale.setScalar(tuning.combat.rangeMetres);
    }
    return { x, z };
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineLoop) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
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

/** Projectiles: small glowing low-poly balls in the shooter's colour. */
export class ProjectileViews {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<number, { mesh: THREE.Mesh; prevX: number; prevZ: number }>();
  private readonly geometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>();

  constructor(private readonly colorOf: (shooterId: number) => THREE.ColorRepresentation) {}

  /** Remember positions before a physics step. */
  capture(projectiles: ProjectileState[]): void {
    for (const p of projectiles) {
      const entry = this.meshes.get(p.id);
      if (entry) {
        entry.prevX = p.x;
        entry.prevZ = p.z;
      }
    }
  }

  draw(projectiles: ProjectileState[], alpha: number, time: number): void {
    const alive = new Set<number>();
    for (const p of projectiles) {
      alive.add(p.id);
      let entry = this.meshes.get(p.id);
      if (!entry) {
        const color = p.powered ? '#ffcc33' : this.colorOf(p.shooterId);
        const key = String(color);
        let material = this.materials.get(key);
        if (!material) {
          material = new THREE.MeshBasicMaterial({ color });
          this.materials.set(key, material);
        }
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.castShadow = true;
        this.group.add(mesh);
        entry = { mesh, prevX: p.x, prevZ: p.z };
        this.meshes.set(p.id, entry);
      }
      const x = entry.prevX + (p.x - entry.prevX) * alpha;
      const z = entry.prevZ + (p.z - entry.prevZ) * alpha;
      entry.mesh.position.set(x, 0.9, z);
      entry.mesh.scale.setScalar(p.radius);
      entry.mesh.rotation.set(time * 7 + p.id, time * 5, 0);
    }
    for (const [id, entry] of this.meshes) {
      if (!alive.has(id)) {
        this.group.remove(entry.mesh);
        this.meshes.delete(id);
      }
    }
  }
}

/** Expanding rings on the ice: where a click was accepted, and where a shot hit. */
export class GroundMarkers {
  readonly group = new THREE.Group();
  private readonly markers: { mesh: THREE.Mesh; age: number; life: number; grow: number; opacity: number }[] = [];
  private readonly geometry = new THREE.RingGeometry(0.55, 0.75, 28);

  add(x: number, z: number, opts: { color?: THREE.ColorRepresentation; size?: number; life?: number; grow?: number } = {}): void {
    const mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({ color: opts.color ?? '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    mesh.scale.setScalar(opts.size ?? 1);
    this.group.add(mesh);
    this.markers.push({ mesh, age: 0, life: opts.life ?? 0.5, grow: opts.grow ?? 1.2, opacity: 0.9 });
  }

  update(dt: number): void {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i]!;
      m.age += dt;
      const t = m.age / m.life;
      if (t >= 1) {
        this.group.remove(m.mesh);
        (m.mesh.material as THREE.Material).dispose();
        this.markers.splice(i, 1);
        continue;
      }
      const base = m.mesh.userData.base ?? (m.mesh.userData.base = m.mesh.scale.x);
      m.mesh.scale.setScalar(base * (1 + t * m.grow));
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = m.opacity * (1 - t);
    }
  }
}
