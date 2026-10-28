import type { ModelStats, TankModel, Tuning } from './tuning';

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

export interface Upgrades {
  firepower: number;
  speed: number;
  traction: number;
}

export interface TankState {
  id: number;
  /** Display name. Kept apart from game logic so accounts can replace it later. */
  name: string;
  model: TankModel;
  /** True for practice dummies: they never send input. */
  isDummy: boolean;
  upgrades: Upgrades;

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
  /** Seconds left of spawn protection (can't be pushed or hit, can't fire). */
  protectionLeft: number;
  /** While falling: seconds since the tank went over the edge. */
  fallTime: number;
  /** Ready for future modes with damage. Sumo doesn't use it. */
  health: number;

  /** Seconds until the next automatic shot can fire. */
  shotTimerLeft: number;
  /** Seconds until the ability (Shift) can be used again. */
  abilityCooldownLeft: number;
  /** Model A boost: seconds of boost left. */
  boostLeft: number;
  /** Model B power shot: charged shots left. */
  powerShotsLeft: number;

  /** Who last hit this tank, and when (simulation time), for knockout credit. */
  lastHitBy: number | null;
  lastHitAt: number;

  knockouts: number;
  eliminations: number;
  selfEliminations: number;
  hitsDealt: number;
  hitsTaken: number;
}

export interface ProjectileState {
  id: number;
  shooterId: number;
  /** Locked on when fired; null once the target is gone (then it flies straight). */
  targetId: number | null;
  x: number;
  z: number;
  /** Direction of travel (radians). Speed stays constant. */
  angle: number;
  speed: number;
  radius: number;
  impact: number;
  /** Fired during a Model B power shot. */
  powered: boolean;
  age: number;
}

export type TankInput = { type: 'move'; x: number; z: number } | { type: 'ability' };

export type WorldEvent =
  | { type: 'click-accepted'; tankId: number; x: number; z: number }
  | { type: 'bump'; a: number; b: number; strength: number }
  | { type: 'shot'; tankId: number; projectileId: number }
  | { type: 'hit'; projectileId: number; shooterId: number; targetId: number; x: number; z: number; powered: boolean }
  | { type: 'ability'; tankId: number; kind: 'boost' | 'powerShot' }
  | { type: 'eliminated'; tankId: number; creditedTo: number | null }
  | { type: 'respawned'; tankId: number };

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
/** Safety net: a projectile that somehow never hits or leaves is removed after this long. */
const PROJECTILE_MAX_AGE = 20;

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

export const NO_UPGRADES: Upgrades = { firepower: 0, speed: 0, traction: 0 };

export class World {
  readonly tanks: TankState[] = [];
  projectiles: ProjectileState[] = [];
  /** Simulation time in seconds. */
  time = 0;
  readonly dt: number;
  private readonly random: () => number;
  private pendingInputs: { tankId: number; input: TankInput }[] = [];
  private events: WorldEvent[] = [];
  private nextProjectileId = 1;

  /** `tuning` is read every step, so live slider changes apply immediately. */
  constructor(
    readonly tuning: Tuning,
    seed = 1,
  ) {
    this.dt = 1 / tuning.simulation.stepsPerSecond;
    this.random = makeRandom(seed);
  }

  addTank(opts: {
    name: string;
    model: TankModel;
    isDummy?: boolean;
    upgrades?: Upgrades;
    x: number;
    z: number;
    heading?: number;
  }): TankState {
    const heading = opts.heading ?? Math.atan2(-opts.z, -opts.x);
    const tank: TankState = {
      id: this.tanks.length,
      name: opts.name,
      model: opts.model,
      isDummy: opts.isDummy ?? false,
      upgrades: { ...(opts.upgrades ?? NO_UPGRADES) },
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
      shotTimerLeft: this.tuning.tanks[opts.model].timeBetweenShots,
      abilityCooldownLeft: 0,
      boostLeft: 0,
      powerShotsLeft: 0,
      lastHitBy: null,
      lastHitAt: -Infinity,
      knockouts: 0,
      eliminations: 0,
      selfEliminations: 0,
      hitsDealt: 0,
      hitsTaken: 0,
    };
    this.tanks.push(tank);
    return tank;
  }

  /**
   * A tank's stats after upgrades. Each upgrade point adds a percentage on top
   * of the model's base value: Speed → thrust and top speed, Traction → grip,
   * Firepower → projectile push. Boost multiplies speed while active.
   */
  stats(tank: TankState): ModelStats {
    const T = this.tuning;
    const base = T.tanks[tank.model];
    const pct = T.upgrades.percentPerPoint / 100;
    const boost = tank.boostLeft > 0 ? T.abilities.boost.speedMultiplier : 1;
    const speed = (1 + pct * tank.upgrades.speed) * boost;
    return {
      ...base,
      thrust: base.thrust * speed,
      topSpeed: base.topSpeed * speed,
      sideGrip: base.sideGrip * (1 + pct * tank.upgrades.traction),
      projectileImpact: base.projectileImpact * (1 + pct * tank.upgrades.firepower),
    };
  }

  /** Change a tank's model or upgrades (practice menu). Puts it back on the ice. */
  reconfigure(tank: TankState, model: TankModel, upgrades: Upgrades): void {
    tank.model = model;
    tank.upgrades = { ...upgrades };
    this.respawn(tank);
  }

  /** Queue an input. It is applied at the start of the next step. */
  input(tankId: number, input: TankInput): void {
    this.pendingInputs.push({ tankId, input });
  }

  /** Events since the last call. */
  takeEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  canFire(tank: TankState): boolean {
    const c = this.tuning.combat;
    return c.firingEnabled && (!tank.isDummy || c.dummiesFire);
  }

  step(): void {
    const dt = this.dt;
    const T = this.tuning;
    this.time += dt;

    this.applyInputs();

    // Movement
    const R = T.arena.radius;
    const hullStep = T.physics.hullTurnRateDeg * DEG * dt;
    const turretStep = T.physics.turretTurnRateDeg * DEG * dt;
    for (const tank of this.tanks) {
      if (tank.status === 'falling') {
        this.stepFalling(tank);
        continue;
      }
      tank.clickCooldownLeft = Math.max(0, tank.clickCooldownLeft - dt);
      tank.protectionLeft = Math.max(0, tank.protectionLeft - dt);
      tank.abilityCooldownLeft = Math.max(0, tank.abilityCooldownLeft - dt);
      tank.boostLeft = Math.max(0, tank.boostLeft - dt);
      const model = this.stats(tank);

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

      // Turret turns toward the closest enemy, and fires automatically when
      // that enemy is within range.
      const target = this.closestEnemy(tank);
      if (target) tank.turret = turnToward(tank.turret, Math.atan2(target.z - tank.z, target.x - tank.x), turretStep);
      tank.shotTimerLeft = Math.max(0, tank.shotTimerLeft - dt);
      if (target && tank.shotTimerLeft <= 0 && tank.protectionLeft <= 0 && this.canFire(tank)) {
        const dist = Math.hypot(target.x - tank.x, target.z - tank.z);
        if (dist <= T.combat.rangeMetres) this.fire(tank, target, model);
      }
    }

    this.stepProjectiles();
    this.resolveBumps();

    // Falling off the edge
    for (const tank of this.tanks) {
      if (tank.status === 'alive' && tank.x * tank.x + tank.z * tank.z > R * R) this.eliminate(tank);
    }
  }

  /** Closest other tank that is on the ice and can be hit. */
  closestEnemy(tank: TankState): TankState | null {
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const other of this.tanks) {
      if (other === tank || other.status !== 'alive' || other.protectionLeft > 0) continue;
      const d = (other.x - tank.x) ** 2 + (other.z - tank.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = other;
      }
    }
    return best;
  }

  private applyInputs(): void {
    const T = this.tuning;
    for (const { tankId, input } of this.pendingInputs) {
      const tank = this.tanks[tankId];
      if (!tank || tank.status !== 'alive') continue;
      if (input.type === 'move') {
        if (tank.clickCooldownLeft > 0) continue;
        const dx = input.x - tank.x;
        const dz = input.z - tank.z;
        if (dx * dx + dz * dz < 1e-6) continue;
        tank.targetHeading = Math.atan2(dz, dx);
        tank.burstLeft = T.tanks[tank.model].burstSeconds;
        tank.clickCooldownLeft = T.rules.clickCooldown;
        this.events.push({ type: 'click-accepted', tankId, x: input.x, z: input.z });
      } else if (input.type === 'ability' && tank.abilityCooldownLeft <= 0) {
        if (tank.model === 'modelA') {
          tank.boostLeft = T.abilities.boost.seconds;
          tank.abilityCooldownLeft = T.abilities.boost.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'boost' });
        } else {
          tank.powerShotsLeft = T.abilities.powerShot.shots;
          tank.abilityCooldownLeft = T.abilities.powerShot.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'powerShot' });
        }
      }
    }
    this.pendingInputs = [];
  }

  private fire(tank: TankState, target: TankState, model: ModelStats): void {
    const powered = tank.powerShotsLeft > 0;
    if (powered) tank.powerShotsLeft--;
    const angle = tank.turret;
    const muzzle = model.radius + model.projectileRadius + 0.1;
    const projectile: ProjectileState = {
      id: this.nextProjectileId++,
      shooterId: tank.id,
      targetId: target.id,
      x: tank.x + Math.cos(angle) * muzzle,
      z: tank.z + Math.sin(angle) * muzzle,
      angle,
      speed: model.projectileSpeed,
      radius: model.projectileRadius * (powered ? 1.4 : 1),
      impact: model.projectileImpact * (powered ? this.tuning.abilities.powerShot.impactMultiplier : 1),
      powered,
      age: 0,
    };
    this.projectiles.push(projectile);
    tank.shotTimerLeft = model.timeBetweenShots;

    // Recoil: pushed backward, opposite the shot (Model B).
    if (model.recoil > 0) {
      tank.vx -= (Math.cos(angle) * model.recoil) / model.mass;
      tank.vz -= (Math.sin(angle) * model.recoil) / model.mass;
    }
    this.events.push({ type: 'shot', tankId: tank.id, projectileId: projectile.id });
  }

  private stepProjectiles(): void {
    const dt = this.dt;
    const T = this.tuning;
    const turn = T.combat.homingTurnRateDeg * DEG * dt;
    const outside = T.arena.radius + 3;
    const kept: ProjectileState[] = [];
    for (const p of this.projectiles) {
      p.age += dt;

      // Homing: steer toward the locked target. If it fell off, fly straight on.
      if (p.targetId !== null) {
        const target = this.tanks[p.targetId];
        if (!target || target.status !== 'alive') p.targetId = null;
        else p.angle = turnToward(p.angle, Math.atan2(target.z - p.z, target.x - p.x), turn);
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.z += Math.sin(p.angle) * p.speed * dt;

      // Hits any tank it touches, except the shooter and spawn-protected tanks.
      let hit: TankState | null = null;
      for (const tank of this.tanks) {
        if (tank.id === p.shooterId || tank.status !== 'alive' || tank.protectionLeft > 0) continue;
        const reach = T.tanks[tank.model].radius + p.radius;
        if ((tank.x - p.x) ** 2 + (tank.z - p.z) ** 2 <= reach * reach) {
          hit = tank;
          break;
        }
      }
      if (hit) {
        const mass = T.tanks[hit.model].mass;
        hit.vx += (Math.cos(p.angle) * p.impact) / mass;
        hit.vz += (Math.sin(p.angle) * p.impact) / mass;
        hit.lastHitBy = p.shooterId;
        hit.lastHitAt = this.time;
        hit.hitsTaken++;
        const shooter = this.tanks[p.shooterId];
        if (shooter) shooter.hitsDealt++;
        this.events.push({ type: 'hit', projectileId: p.id, shooterId: p.shooterId, targetId: hit.id, x: p.x, z: p.z, powered: p.powered });
        continue;
      }

      // Gone once it leaves the arena.
      if (p.x * p.x + p.z * p.z > outside * outside || p.age > PROJECTILE_MAX_AGE) continue;
      kept.push(p);
    }
    this.projectiles = kept;
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
    tank.boostLeft = 0;
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
    // Try random spots and keep the first one clear of other tanks
    // (or the one furthest from them).
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
    tank.burstLeft = 0;
    tank.protectionLeft = T.rules.spawnProtectionSeconds;
    tank.clickCooldownLeft = 0;
    // Requirements: shot timer starts fresh, ability ready, powerups kept.
    tank.shotTimerLeft = T.tanks[tank.model].timeBetweenShots;
    tank.abilityCooldownLeft = 0;
    tank.boostLeft = 0;
    tank.powerShotsLeft = 0;
    this.events.push({ type: 'respawned', tankId: tank.id });
  }
}
