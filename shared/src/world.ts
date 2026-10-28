import type { TankModel, Tuning } from './tuning';

/**
 * The game simulation. It advances in fixed steps (60 per second), so the
 * same inputs always give the same result. Practice mode runs it in the
 * browser; from milestone 4 the server runs this same code.
 *
 * Coordinates: the arena lies on the ground plane with (0, 0) at its centre.
 * `x` and `z` are ground positions. A heading of 0 points along +x and
 * positive angles turn toward +z.
 */

export type TankStatus = 'alive' | 'falling';

export interface TankState {
  id: number;
  /** Display name. Kept apart from game logic so accounts can replace it later. */
  name: string;
  model: TankModel;
  /** True for practice dummies: they never send input. */
  isDummy: boolean;

  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Hull direction (radians). */
  heading: number;
  /** Direction the hull is turning toward (last click). */
  targetHeading: number;
  /** Turret direction (radians, world space). */
  turret: number;

  status: TankStatus;
  /** Seconds left of the current thrust burst. */
  burstLeft: number;
  /** Seconds until the next click counts. */
  clickCooldownLeft: number;
  /** Seconds left of spawn protection (can't be pushed). */
  protectionLeft: number;
  /** While falling: seconds since the tank went over the edge. */
  fallTime: number;
  /** Ready for future modes with damage. Sumo doesn't use it. */
  health: number;

  /** Who last hit this tank, and when (simulation time), for knockout credit. */
  lastHitBy: number | null;
  lastHitAt: number;

  knockouts: number;
  eliminations: number;
  selfEliminations: number;
}

export type MoveInput = { type: 'move'; x: number; z: number };
export type TankInput = MoveInput;

export type WorldEvent =
  | { type: 'click-accepted'; tankId: number; x: number; z: number }
  | { type: 'bump'; a: number; b: number; strength: number }
  | { type: 'eliminated'; tankId: number; creditedTo: number | null }
  | { type: 'respawned'; tankId: number };

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

/** Shortest signed angle from a to b, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  return d;
}

function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

/** Small deterministic random number generator, so server and replays agree. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  readonly tanks: TankState[] = [];
  /** Simulation time in seconds. */
  time = 0;
  readonly dt: number;
  private readonly random: () => number;
  private pendingInputs: { tankId: number; input: TankInput }[] = [];
  private events: WorldEvent[] = [];

  /** `tuning` is read every step, so live slider changes apply immediately. */
  constructor(
    readonly tuning: Tuning,
    seed = 1,
  ) {
    this.dt = 1 / tuning.simulation.stepsPerSecond;
    this.random = makeRandom(seed);
  }

  addTank(opts: { name: string; model: TankModel; isDummy?: boolean; x: number; z: number; heading?: number }): TankState {
    const heading = opts.heading ?? Math.atan2(-opts.z, -opts.x);
    const tank: TankState = {
      id: this.tanks.length,
      name: opts.name,
      model: opts.model,
      isDummy: opts.isDummy ?? false,
      x: opts.x,
      z: opts.z,
      vx: 0,
      vz: 0,
      heading,
      targetHeading: heading,
      turret: heading,
      status: 'alive',
      burstLeft: 0,
      clickCooldownLeft: 0,
      protectionLeft: 0,
      fallTime: 0,
      health: 100,
      lastHitBy: null,
      lastHitAt: -Infinity,
      knockouts: 0,
      eliminations: 0,
      selfEliminations: 0,
    };
    this.tanks.push(tank);
    return tank;
  }

  /** Queue an input. It is applied at the start of the next step. */
  input(tankId: number, input: TankInput): void {
    this.pendingInputs.push({ tankId, input });
  }

  /** Events since the last call (clicks accepted, bumps, eliminations, respawns). */
  takeEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  isProtected(tank: TankState): boolean {
    return tank.status === 'alive' && tank.protectionLeft > 0;
  }

  step(): void {
    const dt = this.dt;
    const T = this.tuning;
    this.time += dt;

    // 1. Inputs
    for (const { tankId, input } of this.pendingInputs) {
      const tank = this.tanks[tankId];
      if (!tank || tank.status !== 'alive') continue;
      if (input.type === 'move' && tank.clickCooldownLeft <= 0) {
        const dx = input.x - tank.x;
        const dz = input.z - tank.z;
        if (dx * dx + dz * dz < 1e-6) continue;
        tank.targetHeading = Math.atan2(dz, dx);
        tank.burstLeft = T.tanks[tank.model].burstSeconds;
        tank.clickCooldownLeft = T.rules.clickCooldown;
        this.events.push({ type: 'click-accepted', tankId, x: input.x, z: input.z });
      }
    }
    this.pendingInputs = [];

    // 2. Movement
    const R = T.arena.radius;
    const hullStep = T.physics.hullTurnRateDeg * DEG * dt;
    const turretStep = T.physics.turretTurnRateDeg * DEG * dt;
    for (const tank of this.tanks) {
      if (tank.status === 'falling') {
        this.stepFalling(tank);
        continue;
      }
      const model = T.tanks[tank.model];
      tank.clickCooldownLeft = Math.max(0, tank.clickCooldownLeft - dt);
      tank.protectionLeft = Math.max(0, tank.protectionLeft - dt);

      // Hull turns toward the last click.
      tank.heading = turnToward(tank.heading, tank.targetHeading, hullStep);
      const fx = Math.cos(tank.heading);
      const fz = Math.sin(tank.heading);

      // Thrust burst along the hull. It only grips as far as the hull already
      // faces the clicked direction, so sharp turns lose some of the push.
      if (tank.burstLeft > 0) {
        tank.burstLeft = Math.max(0, tank.burstLeft - dt);
        const alignment = Math.max(0, Math.cos(angleDelta(tank.heading, tank.targetHeading)));
        const forwardSpeed = tank.vx * fx + tank.vz * fz;
        if (forwardSpeed < model.topSpeed) {
          const accel = (model.thrust / model.mass) * alignment;
          tank.vx += fx * accel * dt;
          tank.vz += fz * accel * dt;
        }
      }

      // Hidden dome: small outward push that grows toward the edge.
      const r = Math.hypot(tank.x, tank.z);
      if (r > 1e-4) {
        const push = T.physics.domeStrength * Math.pow(Math.min(r / R, 1), T.physics.domeCurve);
        tank.vx += (tank.x / r) * push * dt;
        tank.vz += (tank.z / r) * push * dt;
      }

      // Traction: sideways sliding (relative to the hull) fades out over time.
      const sx = -fz;
      const sz = fx;
      const sideSpeed = tank.vx * sx + tank.vz * sz;
      const sideLoss = sideSpeed * (1 - Math.exp(-model.sideGrip * dt));
      tank.vx -= sx * sideLoss;
      tank.vz -= sz * sideLoss;

      // Drag: very low on ice.
      const keep = Math.exp(-T.physics.drag * dt);
      tank.vx *= keep;
      tank.vz *= keep;

      tank.x += tank.vx * dt;
      tank.z += tank.vz * dt;

      // Turret turns toward the closest other tank on the ice.
      const target = this.closestEnemy(tank);
      if (target) tank.turret = turnToward(tank.turret, Math.atan2(target.z - tank.z, target.x - tank.x), turretStep);
    }

    // 3. Bumps between tanks
    this.resolveBumps();

    // 4. Falling off the edge
    for (const tank of this.tanks) {
      if (tank.status === 'alive' && tank.x * tank.x + tank.z * tank.z > R * R) this.eliminate(tank);
    }
  }

  closestEnemy(tank: TankState): TankState | null {
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const other of this.tanks) {
      if (other === tank || other.status !== 'alive') continue;
      const d = (other.x - tank.x) ** 2 + (other.z - tank.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  private resolveBumps(): void {
    const T = this.tuning;
    const list = this.tanks.filter((t) => t.status === 'alive' && t.protectionLeft <= 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const ma = T.tanks[a.model].mass;
        const mb = T.tanks[b.model].mass;
        const minDist = T.tanks[a.model].radius + T.tanks[b.model].radius;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let dist = Math.hypot(dx, dz);
        if (dist >= minDist) continue;
        if (dist < 1e-6) {
          dx = 1;
          dz = 0;
          dist = 1e-6;
        }
        const nx = dx / dist;
        const nz = dz / dist;

        // Push them apart so they don't overlap (heavier one moves less).
        const overlap = minDist - dist;
        const invA = 1 / ma;
        const invB = 1 / mb;
        const share = overlap / (invA + invB);
        a.x -= nx * share * invA;
        a.z -= nz * share * invA;
        b.x += nx * share * invB;
        b.z += nz * share * invB;

        // Bounce: impulse from relative speed along the contact line and both masses.
        const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (closing >= 0) continue;
        const impulse = (-T.physics.bumpBounce * closing) / (invA + invB);
        a.vx -= nx * impulse * invA;
        a.vz -= nz * impulse * invA;
        b.vx += nx * impulse * invB;
        b.vz += nz * impulse * invB;

        a.lastHitBy = b.id;
        a.lastHitAt = this.time;
        b.lastHitBy = a.id;
        b.lastHitAt = this.time;
        this.events.push({ type: 'bump', a: a.id, b: b.id, strength: impulse });
      }
    }
  }

  private eliminate(tank: TankState): void {
    tank.status = 'falling';
    tank.fallTime = 0;
    tank.burstLeft = 0;
    tank.eliminations++;
    const recent = tank.lastHitBy !== null && this.time - tank.lastHitAt <= this.tuning.rules.creditWindowSeconds;
    const creditedTo = recent ? tank.lastHitBy : null;
    if (creditedTo !== null) {
      const scorer = this.tanks[creditedTo];
      if (scorer) scorer.knockouts++;
    } else {
      tank.selfEliminations++;
    }
    tank.lastHitBy = null;
    this.events.push({ type: 'eliminated', tankId: tank.id, creditedTo });
  }

  private stepFalling(tank: TankState): void {
    const dt = this.dt;
    tank.fallTime += dt;
    // Keep drifting outward while dropping (the client draws the fall).
    tank.x += tank.vx * dt;
    tank.z += tank.vz * dt;
    if (tank.fallTime >= this.tuning.rules.respawnSeconds) this.respawn(tank);
  }

  private respawn(tank: TankState): void {
    const T = this.tuning;
    const maxR = Math.max(1, T.arena.radius - T.rules.respawnEdgeMargin);
    let bestX = 0;
    let bestZ = 0;
    let bestScore = -Infinity;
    // Try random spots and keep the one furthest from other tanks.
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = this.random() * Math.PI * 2;
      const r = Math.sqrt(this.random()) * maxR;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      let nearest = Infinity;
      for (const other of this.tanks) {
        if (other === tank || other.status !== 'alive') continue;
        nearest = Math.min(nearest, Math.hypot(other.x - x, other.z - z));
      }
      if (nearest >= T.rules.respawnClearance) {
        bestX = x;
        bestZ = z;
        break;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        bestX = x;
        bestZ = z;
      }
    }
    tank.x = bestX;
    tank.z = bestZ;
    tank.vx = 0;
    tank.vz = 0;
    tank.heading = tank.targetHeading = tank.turret = Math.atan2(-bestZ, -bestX);
    tank.status = 'alive';
    tank.fallTime = 0;
    tank.protectionLeft = T.rules.spawnProtectionSeconds;
    tank.clickCooldownLeft = 0;
    this.events.push({ type: 'respawned', tankId: tank.id });
  }
}
