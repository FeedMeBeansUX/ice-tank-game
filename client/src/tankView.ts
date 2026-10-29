import * as THREE from 'three';
import { BARREL_SPACING, type ProjectileState, type TankModel, type TankState, type Tuning } from '@ice-tank-sumo/shared';

/**
 * Drawing: tanks (low-poly hull, tracks and a turret that turns on its own),
 * projectiles, click and hit markers, and your range ring.
 */

/** Player colours (the requirements ask for a distinct colour per player). */
export const PLAYER_COLORS = ['#ff7a3d', '#3fb5ff', '#7bd65b', '#c77dff'];
export const DUMMY_COLOR = '#8f9ba6';
/** Short letters for markers: Agile, Heavy, Stealth. */
export const MODEL_LETTERS: Record<TankModel, string> = { modelA: 'A', modelB: 'H', modelC: 'S', modelD: 'B', modelE: 'G' };

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
  /** How far forward from the back the tail taper starts. */
  tail: number;
  hullHeight: number;
  /** Track pieces per side: centre position along the hull and length. */
  tracks: { x: number; length: number }[];
  trackWidth: number;
  trackHeight: number;
  turretRadius: number;
  turretHeight: number;
  turretSides: number;
  barrelLength: number;
  barrelThickness: number;
  /** Sideways offsets of the barrels (two for dual barrels). */
  barrelOffsets: number[];
  /** Extra dark top plate (Stealth). */
  topPlate: boolean;
  /** Road wheels per side (Shotgun half-track): centre position along the hull. */
  wheels: number[];
}

/**
 * All three are about the same size (collision radius 1.15 m), nose along +x.
 * - Agile (A): low, pointed wedge; flat turret with two thin barrels.
 * - Heavy (B): taller hull; slightly larger cupola and one slightly bigger barrel.
 * - Stealth (C): faceted hull with a dark top plate, four short tracks, and a
 *   small machine-gun turret.
 */
const SHAPES: Record<TankModel, Shape> = {
  modelA: {
    halfLength: 1.08, halfWidth: 0.5, nose: 0.55, tail: 0.12, hullHeight: 0.26,
    tracks: [{ x: 0, length: 2.15 }], trackWidth: 0.4, trackHeight: 0.36,
    turretRadius: 0.44, turretHeight: 0.24, turretSides: 6,
    barrelLength: 0.9, barrelThickness: 0.1, barrelOffsets: [-BARREL_SPACING, BARREL_SPACING], topPlate: false, wheels: [],
  },
  modelB: {
    halfLength: 1.05, halfWidth: 0.55, nose: 0.35, tail: 0.1, hullHeight: 0.34,
    tracks: [{ x: 0, length: 2.1 }], trackWidth: 0.42, trackHeight: 0.42,
    turretRadius: 0.56, turretHeight: 0.36, turretSides: 6,
    barrelLength: 1.05, barrelThickness: 0.19, barrelOffsets: [0], topPlate: false, wheels: [],
  },
  modelC: {
    halfLength: 1.05, halfWidth: 0.6, nose: 0.45, tail: 0.35, hullHeight: 0.28,
    tracks: [{ x: 0.62, length: 0.78 }, { x: -0.62, length: 0.78 }], trackWidth: 0.38, trackHeight: 0.38,
    turretRadius: 0.34, turretHeight: 0.2, turretSides: 4,
    barrelLength: 0.8, barrelThickness: 0.07, barrelOffsets: [0], topPlate: true, wheels: [],
  },
  // Bash is built separately (round frame); this entry only sizes its ring.
  modelD: {
    halfLength: 1.0, halfWidth: 1.0, nose: 0, tail: 0, hullHeight: 0.3,
    tracks: [], trackWidth: 0.3, trackHeight: 0.36,
    turretRadius: 0.3, turretHeight: 0.2, turretSides: 6,
    barrelLength: 0, barrelThickness: 0, barrelOffsets: [], topPlate: false, wheels: [],
  },
  // Shotgun: half-track. Tracks at the back, two wheels at the front; boxy
  // turret with a short, wide barrel.
  modelE: {
    halfLength: 1.08, halfWidth: 0.55, nose: 0.22, tail: 0.08, hullHeight: 0.32,
    tracks: [{ x: -0.42, length: 1.2 }], trackWidth: 0.42, trackHeight: 0.42,
    turretRadius: 0.5, turretHeight: 0.3, turretSides: 4,
    barrelLength: 0.55, barrelThickness: 0.22, barrelOffsets: [0], topPlate: false, wheels: [0.68],
  },
};

/**
 * Bash: a round frame in the player's colour with two tracks inside it, a
 * spinning buzz-saw ring around the outside, and a little radar dish on top.
 */
function buildBash(color: THREE.Color) {
  const body = flat(color);
  const dark = flat(color.clone().multiplyScalar(0.55));
  const tracks = flat('#2b3138');
  const metal = new THREE.MeshStandardMaterial({ color: '#c3cbd2', flatShading: true, roughness: 0.35, metalness: 0.6 });
  const root = new THREE.Group();

  // Two tracks inside the frame.
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.36, 0.3), tracks);
    track.position.set(0, 0.18, side * 0.42);
    root.add(track);
  }

  // Round frame: a ring with a hole, 16 sides (low-poly).
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, 0.98, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.74, 0, Math.PI * 2, true);
  ringShape.holes.push(hole);
  const frameGeometry = new THREE.ExtrudeGeometry(ringShape, { depth: 0.34, bevelEnabled: false, curveSegments: 16 });
  frameGeometry.rotateX(-Math.PI / 2);
  const frame = new THREE.Mesh(frameGeometry, body);
  frame.position.y = 0.12;
  root.add(frame);

  // Cross brace and hub over the tracks.
  const brace = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.22), dark);
  brace.position.y = 0.5;
  root.add(brace);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.16, 8), dark);
  hub.position.y = 0.56;
  root.add(hub);

  // Buzz-saw ring: teeth around the outside, spins on its own.
  const teeth = 28;
  const sawShape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.65) / teeth) * Math.PI * 2;
    const p0 = [Math.cos(a0) * 1.0, Math.sin(a0) * 1.0];
    const p1 = [Math.cos(a1) * 1.15, Math.sin(a1) * 1.15];
    if (i === 0) sawShape.moveTo(p0[0]!, p0[1]!);
    else sawShape.lineTo(p0[0]!, p0[1]!);
    sawShape.lineTo(p1[0]!, p1[1]!);
  }
  sawShape.closePath();
  const sawHole = new THREE.Path();
  sawHole.absarc(0, 0, 0.9, 0, Math.PI * 2, true);
  sawShape.holes.push(sawHole);
  const sawGeometry = new THREE.ExtrudeGeometry(sawShape, { depth: 0.07, bevelEnabled: false, curveSegments: 16 });
  sawGeometry.rotateX(-Math.PI / 2);
  const saw = new THREE.Mesh(sawGeometry, metal);
  saw.position.y = 0.26;
  root.add(saw);

  // Radar dish on a short mast, turning on top.
  const radar = new THREE.Group();
  radar.position.y = 0.64;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 6), dark);
  mast.position.y = 0.13;
  radar.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.6), metal);
  dish.material.side = THREE.DoubleSide;
  dish.rotation.z = Math.PI / 2.2;
  dish.position.set(0.04, 0.3, 0);
  radar.add(dish);
  root.add(radar);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret: radar, barrels: [] as THREE.Mesh[], body, dark, saw, materials: [body, dark, tracks, metal] };
}

function buildTank(model: TankModel, color: THREE.Color): {
  root: THREE.Group;
  turret: THREE.Group;
  barrels: THREE.Mesh[];
  body: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  saw?: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
} {
  if (model === 'modelD') return buildBash(color);
  const s = SHAPES[model];
  const body = flat(color);
  const dark = flat(color.clone().multiplyScalar(0.55));
  const tracks = flat('#2b3138');
  const plate = flat('#3a424b');
  const root = new THREE.Group();

  for (const side of [-1, 1]) {
    for (const piece of s.tracks) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(piece.length, s.trackHeight, s.trackWidth), tracks);
      track.position.set(piece.x, s.trackHeight / 2, side * (s.halfWidth + s.trackWidth * 0.25));
      root.add(track);
    }
    for (const x of s.wheels) {
      // Front road wheel with a lighter hub.
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.26, 10), tracks);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.27, side * (s.halfWidth + s.trackWidth * 0.25));
      root.add(wheel);
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 6), flat('#6b747d'));
      hubCap.rotation.x = Math.PI / 2;
      hubCap.position.copy(wheel.position);
      root.add(hubCap);
    }
  }

  // Hull: a six-sided plate seen from above.
  const outline = new THREE.Shape();
  outline.moveTo(s.halfLength, 0);
  outline.lineTo(s.halfLength - s.nose, s.halfWidth);
  outline.lineTo(-s.halfLength + s.tail, s.halfWidth);
  outline.lineTo(-s.halfLength, 0);
  outline.lineTo(-s.halfLength + s.tail, -s.halfWidth);
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
  const hullTop = s.trackHeight * 0.75 + s.hullHeight + 0.06;

  if (s.topPlate) {
    // Faceted dark plate on top (stealth look).
    const p = new THREE.Shape();
    const L = s.halfLength * 0.62;
    const W = s.halfWidth * 0.62;
    p.moveTo(L, 0);
    p.lineTo(L * 0.2, W);
    p.lineTo(-L, W * 0.7);
    p.lineTo(-L, -W * 0.7);
    p.lineTo(L * 0.2, -W);
    p.closePath();
    const g = new THREE.ExtrudeGeometry(p, { depth: 0.05, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, plate);
    m.position.y = hullTop;
    root.add(m);
  }

  const turret = new THREE.Group();
  turret.position.y = hullTop + 0.06 + s.turretHeight / 2;
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(s.turretRadius * 0.82, s.turretRadius, s.turretHeight, s.turretSides), dark);
  dome.rotation.y = Math.PI / s.turretSides;
  turret.add(dome);
  const barrels: THREE.Mesh[] = [];
  for (const offset of s.barrelOffsets) {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(s.barrelLength, s.barrelThickness, s.barrelThickness), dark);
    barrel.position.set(s.turretRadius * 0.6 + s.barrelLength / 2, 0.02, offset);
    barrel.userData.baseX = barrel.position.x;
    turret.add(barrel);
    barrels.push(barrel);
  }
  if (model === 'modelE') {
    // Shotgun muzzle: a wider flare at the end of the short barrel.
    const flare = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.3), dark);
    flare.position.set(s.barrelLength / 2 + 0.04, 0, 0);
    barrels[0]!.add(flare);
  }
  if (model === 'modelC') {
    // Machine-gun body at the base of the thin barrel.
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.18), dark);
    box.position.set(s.turretRadius * 0.6 + 0.12, 0.02, 0);
    turret.add(box);
  }
  root.add(turret);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret, barrels, body, dark, materials: [body, dark, tracks, plate] };
}

export class TankView {
  readonly root = new THREE.Group();
  readonly model: TankModel;
  private readonly body: THREE.Group;
  private readonly turret: THREE.Group;
  private readonly barrels: THREE.Mesh[];
  /** Bash's buzz-saw ring (spins). */
  private readonly saw: THREE.Mesh | null;
  /** Recoil kick per barrel (1 = just fired, fades to 0). */
  private readonly kicks: number[];
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly turretMaterial: THREE.MeshStandardMaterial;
  private readonly materials: THREE.MeshStandardMaterial[];
  private readonly color: THREE.Color;
  private ownRing: THREE.Mesh | null = null;
  private rangeRing: THREE.LineLoop | null = null;

  private sawAngle = 0;

  // Previous simulation state, for smooth drawing between physics steps.
  private prev = { x: 0, z: 0, heading: 0, turret: 0 };

  constructor(tank: TankState, color: THREE.ColorRepresentation, isOwn: boolean) {
    this.model = tank.model;
    this.color = new THREE.Color(color);
    const built = buildTank(tank.model, this.color);
    this.body = built.root;
    this.turret = built.turret;
    this.barrels = built.barrels;
    this.saw = built.saw ?? null;
    this.kicks = built.barrels.map(() => 0);
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

  /** A barrel just fired: kick it back briefly. */
  kick(barrel: number): void {
    const i = Math.min(barrel, this.kicks.length - 1);
    this.kicks[i] = 1;
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
  draw(tank: TankState, alpha: number, time: number, tuning: Tuning, showRange: boolean, dt = 1 / 60): { x: number; z: number } {
    const x = this.prev.x + (tank.x - this.prev.x) * alpha;
    const z = this.prev.z + (tank.z - this.prev.z) * alpha;
    const heading = this.prev.heading + angleLerp(this.prev.heading, tank.heading, alpha);
    const turret = this.prev.turret + angleLerp(this.prev.turret, tank.turret, alpha);

    this.root.position.set(x, 0, z);
    this.body.rotation.set(0, -heading, 0);
    if (this.saw) {
      // Bash: saw spins (faster at speed), radar dish turns slowly.
      const speed = Math.hypot(tank.vx, tank.vz);
      this.sawAngle += dt * (6 + speed * 1.5);
      this.saw.rotation.y = this.sawAngle;
      this.turret.rotation.y = time * 2.2;
    } else {
      this.turret.rotation.y = -(turret - heading);
    }

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
    // Smoke (Stealth): invisible to everyone else; shimmering see-through to yourself.
    if (tank.status === 'alive' && tank.stealthLeft > 0) {
      opacity = this.ownRing ? 0.3 + 0.12 * Math.sin(time * 9) : 0;
    }
    this.setOpacity(opacity);
    this.root.visible = opacity > 0.01;

    // Barrel recoil kick.
    this.barrels.forEach((b, i) => {
      this.kicks[i] = Math.max(0, this.kicks[i]! - dt * 7);
      b.position.x = (b.userData.baseX as number) - this.kicks[i]! * 0.18;
    });

    // Glow while boosting (hull) or while power shots are charged (turret).
    const pulse = 0.55 + 0.25 * Math.sin(time * 14);
    if (tank.status === 'alive' && tank.disabledLeft > 0) {
      // Disabled by an EMP: electric blue flicker.
      this.bodyMaterial.emissive.set('#3fb5ff').multiplyScalar(Math.sin(time * 40) > 0.2 ? 0.9 : 0.15);
    } else {
      this.bodyMaterial.emissive.copy(this.color).multiplyScalar(tank.boostLeft > 0 ? pulse : 0);
    }
    // Turret glow: yellow while power shots are charged, green during rapid fire.
    const turretGlow = tank.powerShotsLeft > 0 ? '#ffcc33' : tank.rapidFireLeft > 0 ? '#4cd964' : null;
    this.turretMaterial.emissive.set(turretGlow ?? '#000000').multiplyScalar(turretGlow ? pulse : 0);

    const alive = tank.status === 'alive';
    if (this.ownRing) this.ownRing.visible = alive;
    if (this.rangeRing) {
      this.rangeRing.visible = alive && showRange;
      this.rangeRing.scale.setScalar(tuning.combat.rangeMetres * tuning.tanks[tank.model].rangeMultiplier);
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
