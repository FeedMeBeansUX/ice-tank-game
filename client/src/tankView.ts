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
export const MODEL_LETTERS: Record<TankModel, string> = { modelA: 'A', modelB: 'H', modelC: 'S', modelD: 'B', modelE: 'G', modelF: 'R', modelG: 'M' };

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
  // Bash is built separately (pill-shaped hull, laser turret); this entry only sizes its ring.
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
  // Artillery: tracked howitzer. Long, flat hull on full-length tracks; a big
  // boxy turret set toward the back with a long, raised gun and muzzle brake.
  modelF: {
    halfLength: 1.12, halfWidth: 0.52, nose: 0.18, tail: 0.06, hullHeight: 0.24,
    tracks: [{ x: 0, length: 2.24 }], trackWidth: 0.4, trackHeight: 0.36,
    turretRadius: 0.58, turretHeight: 0.4, turretSides: 4,
    barrelLength: 1.35, barrelThickness: 0.15, barrelOffsets: [0], topPlate: false, wheels: [],
  },
  // Rocket: a rocket-launcher truck. Cab at the front, one wheel per side at
  // the front and two per side at the back, and a turning launcher pod with
  // six rocket tubes on the back.
  modelG: {
    halfLength: 1.1, halfWidth: 0.5, nose: 0.12, tail: 0.05, hullHeight: 0.18,
    tracks: [], trackWidth: 0.3, trackHeight: 0.46,
    turretRadius: 0.42, turretHeight: 0.2, turretSides: 6,
    barrelLength: 0.95, barrelThickness: 0.36, barrelOffsets: [0], topPlate: false, wheels: [0.72, -0.3, -0.8],
  },
};

/**
 * Bash: a pill-shaped hull (rounded front and back, straight sides) on two
 * tracks, with a laser turret: a rounded dome and a thin emitter with a
 * glowing lens.
 */
function buildBash(color: THREE.Color) {
  const body = flat(color);
  const dark = flat(color.clone().multiplyScalar(0.55));
  const tracks = flat('#2b3138');
  const lensMaterial = new THREE.MeshStandardMaterial({ color: '#ff4d6d', emissive: '#ff4d6d', emissiveIntensity: 0.9, flatShading: true });
  const root = new THREE.Group();

  // Six wheels: three along each straight side.
  const hubMaterial = flat('#6b7480');
  for (const side of [-1, 1]) {
    for (const x of [-0.55, 0, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 10), tracks);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.2, side * 0.52);
      root.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 6), hubMaterial);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      root.add(hub);
    }
  }

  // Pill-shaped hull: two half-circles joined by straight sides.
  const r = 0.46;
  const half = 0.4;
  const pill = new THREE.Shape();
  pill.moveTo(-half, -r);
  pill.lineTo(half, -r);
  pill.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
  pill.lineTo(-half, r);
  pill.absarc(-half, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  const hullGeometry = new THREE.ExtrudeGeometry(pill, {
    depth: 0.32,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 1,
    curveSegments: 6,
  });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, body);
  hull.position.y = 0.3;
  root.add(hull);
  const hullTop = 0.3 + 0.32 + 0.06;

  // Laser turret.
  const turret = new THREE.Group();
  turret.position.y = hullTop + 0.16;
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), dark);
  dome.scale.set(1, 0.55, 1);
  turret.add(dome);
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.75, 8), dark);
  emitter.rotation.z = -Math.PI / 2;
  emitter.position.set(0.55, 0.04, 0);
  emitter.userData.baseX = emitter.position.x;
  turret.add(emitter);
  const lens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), lensMaterial);
  lens.position.set(0.95, 0.04, 0);
  turret.add(lens);
  root.add(turret);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret, barrels: [] as THREE.Mesh[], body, dark, materials: [body, dark, tracks, hubMaterial, lensMaterial] };
}

function buildTank(model: TankModel, color: THREE.Color): {
  root: THREE.Group;
  turret: THREE.Group;
  barrels: THREE.Mesh[];
  body: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
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
  // Artillery and Rocket: the turret sits toward the back of the hull.
  if (model === 'modelF') turret.position.x = -0.35;
  if (model === 'modelG') {
    turret.position.x = -0.32;
    // Driver's cab at the front, with a dark windscreen.
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.9), body);
    cab.position.set(0.78, hullTop + 0.21, 0);
    root.add(cab);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.78), plate);
    screen.position.set(1.03, hullTop + 0.29, 0);
    root.add(screen);
  }
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
  if (model === 'modelF') {
    // Howitzer: the gun points up a little, with a muzzle brake at the end and a
    // recoil sleeve at its base.
    const gun = barrels[0]!;
    gun.rotation.z = 0.28;
    gun.position.y = 0.12 + Math.sin(0.28) * (gun.position.x - s.turretRadius * 0.6);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.26), dark);
    brake.position.set(s.barrelLength / 2 - 0.05, 0, 0);
    gun.add(brake);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.24), dark);
    sleeve.position.set(-s.barrelLength / 2 + 0.22, 0, 0);
    gun.add(sleeve);
  }
  if (model === 'modelG') {
    // Launcher pod: a wide box on the turntable, tilted up, with six tube openings.
    const pod = barrels[0]!;
    pod.position.set(0.08, 0.24, 0);
    pod.userData.baseX = pod.position.x;
    pod.rotation.z = 0.3;
    pod.scale.z = 1.45;
    const tubeMaterial = flat('#15181c');
    for (const ty of [-0.08, 0.08]) {
      for (const tz of [-0.1, 0, 0.1]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 8), tubeMaterial);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(s.barrelLength / 2 + 0.01, ty, tz);
        pod.add(tube);
      }
    }
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
  /** Recoil kick per barrel (1 = just fired, fades to 0). */
  private readonly kicks: number[];
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly turretMaterial: THREE.MeshStandardMaterial;
  private readonly materials: THREE.MeshStandardMaterial[];
  private readonly color: THREE.Color;
  private ownRing: THREE.Mesh | null = null;
  private rangeRing: THREE.LineLoop | null = null;
  private minRangeRing: THREE.LineLoop | null = null;

  // Previous simulation state, for smooth drawing between physics steps.
  private prev = { x: 0, z: 0, heading: 0, turret: 0 };

  constructor(tank: TankState, color: THREE.ColorRepresentation, isOwn: boolean) {
    this.model = tank.model;
    this.color = new THREE.Color(color);
    const built = buildTank(tank.model, this.color);
    this.body = built.root;
    this.turret = built.turret;
    this.barrels = built.barrels;
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
      // Artillery: a second, inner circle for its minimum range.
      const minRange = new THREE.LineLoop(range.geometry, range.material);
      minRange.position.y = 0.03;
      this.root.add(minRange);
      this.minRangeRing = minRange;
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
    // Orange while Artillery has explosive shells.
    const turretGlow = tank.powerShotsLeft > 0 ? '#ffcc33' : tank.explosiveLeft > 0 ? '#ff7a3d' : tank.rapidFireLeft > 0 ? '#4cd964' : null;
    this.turretMaterial.emissive.set(turretGlow ?? '#000000').multiplyScalar(turretGlow ? pulse : 0);

    const alive = tank.status === 'alive';
    if (this.ownRing) this.ownRing.visible = alive;
    if (this.rangeRing) {
      this.rangeRing.visible = alive && showRange;
      this.rangeRing.scale.setScalar(tuning.combat.rangeMetres * tuning.tanks[tank.model].rangeMultiplier);
    }
    if (this.minRangeRing) {
      const min = tuning.tanks[tank.model].minRange;
      this.minRangeRing.visible = alive && showRange && min > 0;
      this.minRangeRing.scale.setScalar(Math.max(0.01, min));
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
