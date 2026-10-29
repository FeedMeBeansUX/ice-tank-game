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

/** 'gone' = the player left; the tank is out of the arena and takes no part. */
export type TankStatus = 'alive' | 'falling' | 'gone';

export interface Upgrades {
  firepower: number;
  speed: number;
  traction: number;
}

export type PowerupKind = 'missile' | 'mine' | 'rapidFire';
export const POWERUP_KINDS: PowerupKind[] = ['missile', 'mine', 'rapidFire'];

/** A powerup lying on the ice, waiting to be driven over. */
export interface PowerupState {
  id: number;
  kind: PowerupKind;
  x: number;
  z: number;
}

export interface MineState {
  id: number;
  ownerId: number;
  x: number;
  z: number;
  age: number;
}

export interface MissileState {
  id: number;
  shooterId: number;
  /** Null once the target is gone (then it flies straight on, out of the arena). */
  targetId: number | null;
  x: number;
  z: number;
  angle: number;
  speed: number;
  /** 'curve' = first turn toward the target; 'boost' = faster but turns slowly. */
  phase: 'curve' | 'boost';
  age: number;
  /** A tank this missile can no longer hit: it was locked on when that tank smoked. */
  missesTankId: number | null;
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
  /** Stealth smoke: seconds of invisibility left (0 = visible). */
  stealthLeft: number;
  /** Rapid-fire powerup: seconds left (time between shots is shorter). */
  rapidFireLeft: number;
  /** Which barrel fires next on a dual-barrel turret (0 = left, 1 = right). */
  nextBarrel: number;
  /** Powerup slots Q, W, E (null = empty). Kept when respawning. */
  slots: (PowerupKind | null)[];

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
  /** A tank this projectile can no longer hit: it was locked on when that tank smoked. */
  missesTankId: number | null;
}

export type TankInput =
  | { type: 'move'; x: number; z: number }
  | { type: 'ability' }
  /** Fire the missile in this slot at a chosen tank. */
  | { type: 'missile'; slot: number; targetId: number }
  /** Drop the mine in this slot. */
  | { type: 'mine'; slot: number }
  /** Use the rapid-fire powerup in this slot. */
  | { type: 'rapidFire'; slot: number };

export type WorldEvent =
  | { type: 'click-accepted'; tankId: number; x: number; z: number }
  | { type: 'bump'; a: number; b: number; strength: number }
  | { type: 'shot'; tankId: number; projectileId: number; barrel: number }
  | { type: 'hit'; projectileId: number; shooterId: number; targetId: number; x: number; z: number; powered: boolean }
  | { type: 'ability'; tankId: number; kind: 'boost' | 'powerShot' | 'smoke'; x: number; z: number }
  /** A smoked tank became visible again (it was hit, or the smoke ran out). */
  | { type: 'revealed'; tankId: number }
  | { type: 'powerup-spawned'; powerupId: number; kind: PowerupKind }
  | { type: 'pickup'; tankId: number; kind: PowerupKind; slot: number }
  | { type: 'missile-fired'; tankId: number; targetId: number; missileId: number }
  | { type: 'missile-hit'; missileId: number; shooterId: number; targetId: number; x: number; z: number }
  | { type: 'mine-dropped'; tankId: number; mineId: number }
  | { type: 'rapid-fire'; tankId: number }
  | { type: 'mine-exploded'; mineId: number; ownerId: number; x: number; z: number; pushed: number[] }
  | { type: 'eliminated'; tankId: number; creditedTo: number | null }
  | { type: 'respawned'; tankId: number };

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
/** Safety net: a projectile that somehow never hits or leaves is removed after this long. */
const PROJECTILE_MAX_AGE = 20;
const MISSILE_MAX_AGE = 12;
export const SLOT_COUNT = 3;
/** Sideways distance of each barrel from the turret's centre line, on dual-barrel turrets. */
export const BARREL_SPACING = 0.17;

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
  powerups: PowerupState[] = [];
  mines: MineState[] = [];
  missiles: MissileState[] = [];
  /** Seconds until the next powerup tries to appear. */
  powerupTimer: number;
  /** Simulation time in seconds. */
  time = 0;
  readonly dt: number;
  private readonly random: () => number;
  private pendingInputs: { tankId: number; input: TankInput }[] = [];
  private events: WorldEvent[] = [];
  private nextProjectileId = 1;
  private nextObjectId = 1;

  /** `tuning` is read every step, so live slider changes apply immediately. */
  constructor(
    readonly tuning: Tuning,
    seed = 1,
  ) {
    this.dt = 1 / tuning.simulation.stepsPerSecond;
    this.random = makeRandom(seed);
    this.powerupTimer = tuning.powerups.spawnInterval;
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
      stealthLeft: 0,
      rapidFireLeft: 0,
      nextBarrel: 0,
      slots: Array.from({ length: SLOT_COUNT }, () => null),
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
    const rapid = tank.rapidFireLeft > 0 ? T.rapidFire.shotTimeMultiplier : 1;
    const speed = (1 + pct * tank.upgrades.speed) * boost;
    return {
      ...base,
      thrust: base.thrust * speed,
      topSpeed: base.topSpeed * speed,
      sideGrip: base.sideGrip * (1 + pct * tank.upgrades.traction),
      projectileImpact: base.projectileImpact * (1 + pct * tank.upgrades.firepower),
      timeBetweenShots: base.timeBetweenShots * rapid,
    };
  }

  /**
   * A player left: their tank leaves the arena. Nobody scores for it, and
   * missiles aimed at it fly straight on.
   */
  removeTank(tank: TankState): void {
    tank.status = 'gone';
    tank.vx = 0;
    tank.vz = 0;
    tank.x = 0;
    tank.z = 0;
    this.projectiles = this.projectiles.filter((p) => p.shooterId !== tank.id);
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

  /** Smoked (Stealth ability) tanks are invisible and untargetable for everyone else. */
  isHidden(tank: TankState): boolean {
    return tank.stealthLeft > 0;
  }

  /** A tank you may aim a missile at: another visible tank on the ice, far enough away. */
  canTargetWithMissile(shooter: TankState, target: TankState): boolean {
    if (target === shooter || target.status !== 'alive' || target.protectionLeft > 0 || this.isHidden(target)) return false;
    return Math.hypot(target.x - shooter.x, target.z - shooter.z) >= this.tuning.missile.minTargetDistance;
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
      if (tank.status === 'gone') continue;
      if (tank.status === 'falling') {
        this.stepFalling(tank);
        continue;
      }
      tank.clickCooldownLeft = Math.max(0, tank.clickCooldownLeft - dt);
      tank.protectionLeft = Math.max(0, tank.protectionLeft - dt);
      tank.abilityCooldownLeft = Math.max(0, tank.abilityCooldownLeft - dt);
      tank.boostLeft = Math.max(0, tank.boostLeft - dt);
      tank.rapidFireLeft = Math.max(0, tank.rapidFireLeft - dt);
      if (tank.stealthLeft > 0) {
        tank.stealthLeft = Math.max(0, tank.stealthLeft - dt);
        if (tank.stealthLeft === 0) this.events.push({ type: 'revealed', tankId: tank.id });
      }
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
      // A smoked (hidden) tank doesn't fire.
      if (target && tank.shotTimerLeft <= 0 && tank.protectionLeft <= 0 && tank.stealthLeft <= 0 && this.canFire(tank)) {
        const dist = Math.hypot(target.x - tank.x, target.z - tank.z);
        // Only fire once the turret points at the target, so shots leave the barrel straight.
        const aim = Math.abs(angleDelta(tank.turret, Math.atan2(target.z - tank.z, target.x - tank.x)));
        if (dist <= T.combat.rangeMetres && aim <= T.combat.fireAlignDeg * DEG) this.fire(tank, target, model);
      }
    }

    this.stepProjectiles();
    this.stepMissiles();
    this.resolveBumps();
    this.stepMines();
    this.stepPowerups();

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
      if (other === tank || other.status !== 'alive' || other.protectionLeft > 0 || this.isHidden(other)) continue;
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
        const at = { x: tank.x, z: tank.z };
        if (tank.model === 'modelA') {
          tank.boostLeft = T.abilities.boost.seconds;
          tank.abilityCooldownLeft = T.abilities.boost.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'boost', ...at });
        } else if (tank.model === 'modelB') {
          tank.powerShotsLeft = T.abilities.powerShot.shots;
          tank.abilityCooldownLeft = T.abilities.powerShot.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'powerShot', ...at });
        } else {
          // Smoke grenade: hidden from everyone else. Anything locked on loses its
          // target, keeps flying straight, and passes this tank by. New shots and
          // shots aimed at someone else can still hit it.
          tank.stealthLeft = T.abilities.smoke.seconds;
          tank.abilityCooldownLeft = T.abilities.smoke.cooldown;
          for (const p of this.projectiles) {
            if (p.targetId !== tank.id) continue;
            p.targetId = null;
            p.missesTankId = tank.id;
          }
          for (const m of this.missiles) {
            if (m.targetId !== tank.id) continue;
            m.targetId = null;
            m.missesTankId = tank.id;
          }
          this.events.push({ type: 'ability', tankId, kind: 'smoke', ...at });
        }
      } else if (input.type === 'missile') {
        const target = this.tanks[input.targetId];
        if (tank.slots[input.slot] !== 'missile' || !target || !this.canTargetWithMissile(tank, target)) continue;
        tank.slots[input.slot] = null;
        this.launchMissile(tank, target);
      } else if (input.type === 'mine') {
        if (tank.slots[input.slot] !== 'mine') continue;
        tank.slots[input.slot] = null;
        const mine: MineState = { id: this.nextObjectId++, ownerId: tank.id, x: tank.x, z: tank.z, age: 0 };
        this.mines.push(mine);
        this.events.push({ type: 'mine-dropped', tankId, mineId: mine.id });
      } else if (input.type === 'rapidFire') {
        if (tank.slots[input.slot] !== 'rapidFire') continue;
        tank.slots[input.slot] = null;
        // Using another one while active restarts the timer (it doesn't stack).
        tank.rapidFireLeft = T.rapidFire.seconds;
        // A shot waiting on the old, longer timer can go sooner.
        tank.shotTimerLeft = Math.min(tank.shotTimerLeft, this.stats(tank).timeBetweenShots);
        this.events.push({ type: 'rapid-fire', tankId });
      }
    }
    this.pendingInputs = [];
  }

  private fire(tank: TankState, target: TankState, model: ModelStats): void {
    const powered = tank.powerShotsLeft > 0;
    if (powered) tank.powerShotsLeft--;
    const angle = tank.turret;
    const muzzle = model.radius + model.projectileRadius + 0.1;
    // Dual barrels fire in turns: left, right, left, right.
    const barrel = model.barrels > 1 ? tank.nextBarrel : 0;
    if (model.barrels > 1) tank.nextBarrel = 1 - tank.nextBarrel;
    const side = model.barrels > 1 ? (barrel === 0 ? -1 : 1) * BARREL_SPACING : 0;
    const projectile: ProjectileState = {
      id: this.nextProjectileId++,
      shooterId: tank.id,
      targetId: target.id,
      x: tank.x + Math.cos(angle) * muzzle - Math.sin(angle) * side,
      z: tank.z + Math.sin(angle) * muzzle + Math.cos(angle) * side,
      angle,
      speed: model.projectileSpeed,
      radius: model.projectileRadius * (powered ? 1.4 : 1),
      impact: model.projectileImpact * (powered ? this.tuning.abilities.powerShot.impactMultiplier : 1),
      powered,
      age: 0,
      missesTankId: null,
    };
    this.projectiles.push(projectile);
    tank.shotTimerLeft = model.timeBetweenShots;

    // Recoil: pushed backward, opposite the shot (Model B).
    if (model.recoil > 0) {
      tank.vx -= (Math.cos(angle) * model.recoil) / model.mass;
      tank.vz -= (Math.sin(angle) * model.recoil) / model.mass;
    }
    this.events.push({ type: 'shot', tankId: tank.id, projectileId: projectile.id, barrel });
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
        if (!target || target.status !== 'alive' || this.isHidden(target)) p.targetId = null;
        else p.angle = turnToward(p.angle, Math.atan2(target.z - p.z, target.x - p.x), turn);
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.z += Math.sin(p.angle) * p.speed * dt;

      // Hits any tank it touches, except the shooter and spawn-protected tanks.
      let hit: TankState | null = null;
      for (const tank of this.tanks) {
        if (tank.id === p.shooterId || tank.id === p.missesTankId || tank.status !== 'alive' || tank.protectionLeft > 0) continue;
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
        this.reveal(hit);
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

  private launchMissile(tank: TankState, target: TankState): void {
    const M = this.tuning.missile;
    const r = this.tuning.tanks[tank.model].radius + M.radius + 0.2;
    // Leaves along the hull's facing, then curves toward the target.
    const missile: MissileState = {
      id: this.nextObjectId++,
      shooterId: tank.id,
      targetId: target.id,
      x: tank.x + Math.cos(tank.heading) * r,
      z: tank.z + Math.sin(tank.heading) * r,
      angle: tank.heading,
      speed: M.startSpeed,
      phase: 'curve',
      age: 0,
      missesTankId: null,
    };
    this.missiles.push(missile);
    this.events.push({ type: 'missile-fired', tankId: tank.id, targetId: target.id, missileId: missile.id });
  }

  private stepMissiles(): void {
    const dt = this.dt;
    const T = this.tuning;
    const M = T.missile;
    const outside = T.arena.radius + 4;
    const kept: MissileState[] = [];
    for (const m of this.missiles) {
      m.age += dt;
      if (m.targetId !== null) {
        const target = this.tanks[m.targetId];
        if (!target || target.status !== 'alive' || this.isHidden(target)) m.targetId = null;
        else {
          const want = Math.atan2(target.z - m.z, target.x - m.x);
          const rate = (m.phase === 'curve' ? M.curveTurnRateDeg : M.boostTurnRateDeg) * DEG * dt;
          m.angle = turnToward(m.angle, want, rate);
          if (m.phase === 'curve' && Math.abs(angleDelta(m.angle, want)) <= M.curveDoneDeg * DEG) m.phase = 'boost';
        }
      }
      // After the first curve (or once the target is gone) it speeds up.
      if (m.phase === 'boost' || m.targetId === null) m.speed = Math.min(M.topSpeed, m.speed + M.acceleration * dt);
      m.x += Math.cos(m.angle) * m.speed * dt;
      m.z += Math.sin(m.angle) * m.speed * dt;

      // Hits the first tank it touches (not the shooter, not spawn-protected tanks).
      let hit: TankState | null = null;
      for (const tank of this.tanks) {
        if (tank.id === m.shooterId || tank.id === m.missesTankId || tank.status !== 'alive' || tank.protectionLeft > 0) continue;
        const reach = T.tanks[tank.model].radius + M.radius;
        if ((tank.x - m.x) ** 2 + (tank.z - m.z) ** 2 <= reach * reach) {
          hit = tank;
          break;
        }
      }
      if (hit) {
        const mass = T.tanks[hit.model].mass;
        hit.vx += (Math.cos(m.angle) * M.impact) / mass;
        hit.vz += (Math.sin(m.angle) * M.impact) / mass;
        hit.lastHitBy = m.shooterId;
        hit.lastHitAt = this.time;
        hit.hitsTaken++;
        this.reveal(hit);
        const shooter = this.tanks[m.shooterId];
        if (shooter) shooter.hitsDealt++;
        this.events.push({ type: 'missile-hit', missileId: m.id, shooterId: m.shooterId, targetId: hit.id, x: m.x, z: m.z });
        continue;
      }
      // A missile that misses flies out of the arena and is gone.
      if (m.x * m.x + m.z * m.z > outside * outside || m.age > MISSILE_MAX_AGE) continue;
      kept.push(m);
    }
    this.missiles = kept;
  }

  /** Mines go live after a moment; a tank touching a live mine sets it off. */
  private stepMines(): void {
    const T = this.tuning;
    const B = T.mine;
    const kept: MineState[] = [];
    for (const mine of this.mines) {
      mine.age += this.dt;
      if (mine.age >= B.lifeSeconds) continue;
      const live = mine.age >= B.armSeconds;
      const triggered =
        live &&
        this.tanks.some((t) => {
          if (t.status !== 'alive' || t.protectionLeft > 0) return false;
          const reach = T.tanks[t.model].radius + B.radius;
          return (t.x - mine.x) ** 2 + (t.z - mine.z) ** 2 <= reach * reach;
        });
      if (!triggered) {
        kept.push(mine);
        continue;
      }
      // Blast: push every tank nearby away from the centre. Stronger up close.
      const pushed: number[] = [];
      for (const t of this.tanks) {
        if (t.status !== 'alive' || t.protectionLeft > 0) continue;
        let dx = t.x - mine.x;
        let dz = t.z - mine.z;
        let d = Math.hypot(dx, dz);
        if (d > B.blastRadius) continue;
        if (d < 1e-3) {
          dx = Math.cos(t.heading);
          dz = Math.sin(t.heading);
          d = 1;
        }
        const strength = B.impact * (1 - 0.6 * Math.min(1, d / B.blastRadius));
        const mass = T.tanks[t.model].mass;
        t.vx += (dx / d) * (strength / mass);
        t.vz += (dz / d) * (strength / mass);
        this.reveal(t);
        // The dropper gets the credit for every other tank the blast knocks off.
        if (t.id !== mine.ownerId) {
          t.lastHitBy = mine.ownerId;
          t.lastHitAt = this.time;
          t.hitsTaken++;
          const owner = this.tanks[mine.ownerId];
          if (owner) owner.hitsDealt++;
        }
        pushed.push(t.id);
      }
      this.events.push({ type: 'mine-exploded', mineId: mine.id, ownerId: mine.ownerId, x: mine.x, z: mine.z, pushed });
    }
    this.mines = kept;
  }

  /** Spawning (every few seconds, max a few on the ice) and pickup. */
  private stepPowerups(): void {
    const T = this.tuning;
    const P = T.powerups;

    // Pickup: drive over it to put it in your first free slot. Full slots: it stays.
    if (this.powerups.length) {
      const kept: PowerupState[] = [];
      for (const p of this.powerups) {
        let taken = false;
        for (const t of this.tanks) {
          if (t.status !== 'alive') continue;
          const reach = T.tanks[t.model].radius + P.radius;
          if ((t.x - p.x) ** 2 + (t.z - p.z) ** 2 > reach * reach) continue;
          const slot = t.slots.indexOf(null);
          if (slot < 0) continue;
          t.slots[slot] = p.kind;
          this.events.push({ type: 'pickup', tankId: t.id, kind: p.kind, slot });
          taken = true;
          break;
        }
        if (!taken) kept.push(p);
      }
      this.powerups = kept;
    }

    if (!P.enabled) return;
    this.powerupTimer -= this.dt;
    if (this.powerupTimer > 0) return;
    this.powerupTimer = P.spawnInterval;
    if (this.powerups.length >= P.maxOnField) return;

    // Anywhere except the strip along the edge, never on a tank, mine or powerup.
    const maxR = Math.max(1, T.arena.radius - P.edgeStrip);
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = this.random() * Math.PI * 2;
      const r = Math.sqrt(this.random()) * maxR;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const clear =
        this.tanks.every((t) => t.status !== 'alive' || Math.hypot(t.x - x, t.z - z) >= P.clearance) &&
        this.mines.every((m) => Math.hypot(m.x - x, m.z - z) >= P.clearance) &&
        this.powerups.every((p) => Math.hypot(p.x - x, p.z - z) >= P.clearance);
      if (!clear) continue;
      // Each kind is equally likely.
      const kind: PowerupKind = POWERUP_KINDS[Math.min(POWERUP_KINDS.length - 1, Math.floor(this.random() * POWERUP_KINDS.length))]!;
      const powerup = { id: this.nextObjectId++, kind, x, z };
      this.powerups.push(powerup);
      this.events.push({ type: 'powerup-spawned', powerupId: powerup.id, kind });
      return;
    }
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
        this.reveal(a);
        this.reveal(b);
        this.events.push({ type: 'bump', a: a.id, b: b.id, strength: impulse });
      }
    }
  }

  /** Any hit (shot, missile, mine blast or bump) ends a smoke screen. */
  private reveal(tank: TankState): void {
    if (tank.stealthLeft <= 0) return;
    tank.stealthLeft = 0;
    this.events.push({ type: 'revealed', tankId: tank.id });
  }

  private eliminate(tank: TankState): void {
    tank.status = 'falling';
    tank.fallTime = 0;
    tank.burstLeft = 0;
    tank.boostLeft = 0;
    tank.stealthLeft = 0;
    tank.rapidFireLeft = 0;
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
      // Stay well away from mines too.
      for (const mine of this.mines) nearest = Math.min(nearest, Math.hypot(mine.x - x, mine.z - z) * 0.75);
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
    // Requirements: shot timer starts fresh, ability ready, powerups (slots) kept.
    tank.shotTimerLeft = T.tanks[tank.model].timeBetweenShots;
    tank.abilityCooldownLeft = 0;
    tank.boostLeft = 0;
    tank.powerShotsLeft = 0;
    tank.stealthLeft = 0;
    tank.nextBarrel = 0;
    this.events.push({ type: 'respawned', tankId: tank.id });
  }
}
