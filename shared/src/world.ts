import type { ModelStats, TankModel, Tuning } from './tuning';
import { locateOnTrack, trackHeading, type Track } from './track';

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

import { NO_UPGRADES, type Upgrades } from './properties';
export type { Upgrades } from './properties';

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
  /** Who dropped it; -1 for a race hazard mine (nobody's, no credit). */
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
  /** Push on a hit and hit size. */
  impact: number;
  radius: number;
  /** A small rocket from the Rocket tank (not the missile powerup). */
  small: boolean;
  /** Distance flown so far (m); the push grows with it. */
  traveled: number;
}

/** Rocket's drone: hovers in one spot and machine-guns enemies of its owner. */
export interface DroneState {
  id: number;
  ownerId: number;
  x: number;
  z: number;
  timeLeft: number;
  /** Where its gun points, and seconds until it can fire again. */
  turret: number;
  shotTimerLeft: number;
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
  /** Laser: seconds the beam has been on since its last pause or rest. */
  beamOn: number;
  /** Laser: seconds the beam has been off in a row. */
  beamOff: number;
  /** Laser: forced beam pause still running (s). */
  beamPauseLeft: number;
  /** Laser: seconds the beam has held its current target without a break (for knockout credit). */
  beamHold: number;
  /** Rocket burst: rockets still to come, seconds to the next, and the tank they go for. */
  salvoLeft: number;
  salvoTimer: number;
  salvoTargetId: number | null;
  /** Race: closest middle-line point, distance driven along the track (negative behind the start line), laps done. */
  raceIndex: number;
  raceDistance: number;
  raceLaps: number;
  /** Race: current position (1 = leading), updated every step. */
  racePlace: number;
  /** Right-click target: this tank only fires at it (null = automatic, closest enemy). Cleared when it falls off. */
  designatedId: number | null;
  /** Artillery ability: seconds of explosive shells left. */
  explosiveLeft: number;
  /** Hit by a Laser EMP: seconds left of being disabled (no control, no firing). */
  disabledLeft: number;
  /** Laser tank: the tank the beam is on right now (null = beam off). */
  laserTargetId: number | null;
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
  /** Distance flown so far, and the most it may fly (0 = no limit). */
  travelled: number;
  maxRange: number;
  /** Gun shots: the shooter's firing range, over which the push falls from shotPushNear to shotPushFar (0 = no fall-off). */
  pushRange?: number;
}

/**
 * Something lobbed through the air that bursts where it lands: a Shotgun
 * grenade, or an Artillery shell.
 */
export interface GrenadeState {
  id: number;
  kind: 'grenade' | 'shell';
  ownerId: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Seconds since thrown, and total flight time. */
  t: number;
  duration: number;
  /** Blast radius and push at the centre. */
  radius: number;
  impact: number;
  /** Artillery shell fired during explosive shells. */
  explosive: boolean;
}

export type TankInput =
  | { type: 'move'; x: number; z: number }
  | { type: 'ability' }
  /** Fire the missile in this slot at a chosen tank. */
  | { type: 'missile'; slot: number; targetId: number }
  /** Drop the mine in this slot. */
  | { type: 'mine'; slot: number }
  /** Use the rapid-fire powerup in this slot. */
  | { type: 'rapidFire'; slot: number }
  /** Shotgun ability: throw a grenade at this spot. */
  | { type: 'grenade'; x: number; z: number }
  /** Rocket ability: place a drone at this spot. */
  | { type: 'drone'; x: number; z: number }
  /** Right-click: only fire at this tank; null (or the same tank again) = back to automatic. */
  | { type: 'target'; targetId: number | null };

export type WorldEvent =
  | { type: 'click-accepted'; tankId: number; x: number; z: number }
  | { type: 'bump'; a: number; b: number; strength: number }
  | { type: 'shot'; tankId: number; projectileId: number; barrel: number }
  | { type: 'hit'; projectileId: number; shooterId: number; targetId: number; x: number; z: number; powered: boolean }
  | { type: 'ability'; tankId: number; kind: 'boost' | 'powerShot' | 'smoke' | 'emp' | 'grenade' | 'explosiveShells' | 'drone'; x: number; z: number }
  /** A Laser EMP went off: these tanks are disabled. */
  | { type: 'emp'; tankId: number; x: number; z: number; radius: number; disabled: number[]; pulse: boolean }
  /** A smoked tank became visible again (it was hit, or the smoke ran out). */
  | { type: 'revealed'; tankId: number }
  | { type: 'powerup-spawned'; powerupId: number; kind: PowerupKind }
  | { type: 'pickup'; tankId: number; kind: PowerupKind; slot: number }
  | { type: 'missile-fired'; tankId: number; targetId: number; missileId: number }
  | { type: 'missile-hit'; missileId: number; shooterId: number; targetId: number; x: number; z: number; small: boolean }
  | { type: 'mine-dropped'; tankId: number; mineId: number }
  | { type: 'rapid-fire'; tankId: number }
  | { type: 'mine-exploded'; mineId: number; ownerId: number; x: number; z: number; pushed: number[] }
  | { type: 'grenade-thrown'; tankId: number; grenadeId: number }
  | { type: 'drone-shot'; droneId: number }
  | { type: 'lap'; tankId: number; laps: number }
  | { type: 'race-won'; tankId: number }
  | { type: 'drone-gone'; droneId: number }
  | { type: 'laser-hit'; tankId: number; targetId: number }
  | { type: 'grenade-exploded'; grenadeId: number; kind: 'grenade' | 'shell'; explosive: boolean; ownerId: number; x: number; z: number; radius: number; pushed: number[] }
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
/** Heavy power shots hit this much wider than normal shots (they look the same size, only yellow). */
export const POWER_SHOT_HIT_SCALE = 1.4;

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

export { NO_UPGRADES } from './properties';

export class World {
  readonly tanks: TankState[] = [];
  projectiles: ProjectileState[] = [];
  powerups: PowerupState[] = [];
  mines: MineState[] = [];
  missiles: MissileState[] = [];
  grenades: GrenadeState[] = [];
  drones: DroneState[] = [];
  /** Race mode: the track (null = Sumo on the round arena). */
  track: Track | null = null;
  /** Race mode: the first tank to finish all laps. */
  raceWinnerId: number | null = null;
  /** Seconds until the next powerup tries to appear. */
  powerupTimer: number;
  /** Simulation time in seconds. */
  time = 0;
  /** Sumo: seconds of play in this match so far, for the shrinking ice (practice: since the last respawn). */
  shrinkTime = 0;

  /** Sumo: the ice's current radius. It shrinks late in a match (arena.shrink* tuning). */
  arenaRadius(): number {
    const A = this.tuning.arena;
    if (this.track || !A.shrinkEnabled) return A.radius;
    const k = Math.min(1, Math.max(0, (this.shrinkTime - A.shrinkStartSeconds) / Math.max(1e-6, A.shrinkSeconds)));
    return A.radius * (1 - (1 - A.shrinkMinShare) * k);
  }
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
      beamOn: 0,
      beamOff: 0,
      beamPauseLeft: 0,
      beamHold: 0,
      salvoLeft: 0,
      salvoTimer: 0,
      salvoTargetId: null,
      raceIndex: 0,
      raceDistance: 0,
      raceLaps: 0,
      racePlace: 0,
      designatedId: null,
      explosiveLeft: 0,
      disabledLeft: 0,
      laserTargetId: null,
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
   * of the model's base value: Speed → thrust and top speed, Grip → traction,
   * Firepower → push per hit and laser strength. (Weight and Range work in
   * massOf, bumps and range.) Boost multiplies speed while active.
   */
  stats(tank: TankState): ModelStats {
    const T = this.tuning;
    const base = T.tanks[tank.model];
    const pct = T.upgrades.percentPerPoint / 100;
    const boost = tank.boostLeft > 0 ? T.abilities.boost.speedMultiplier : 1;
    const rapid = tank.rapidFireLeft > 0 ? T.rapidFire.shotTimeMultiplier : 1;
    const speed = (1 + pct * tank.upgrades.speed) * boost;
    const catchUp = 1 - this.racePenalty(tank);
    return {
      ...base,
      mass: T.physics.mass * base.massShare,
      thrust: T.physics.thrust * base.thrustShare * speed,
      topSpeed: T.physics.topSpeed * base.topSpeedShare * speed * catchUp,
      sideGrip: T.physics.sideGrip * base.tractionShare * (1 + pct * tank.upgrades.grip) * catchUp * (this.track ? T.race.tractionShare : 1),
      projectileImpact: base.projectileImpact * (1 + pct * tank.upgrades.firepower),
      laserForce: base.laserForce * (1 + pct * tank.upgrades.firepower),
      timeBetweenShots: base.timeBetweenShots * rapid,
    };
  }

  /**
   * A player left: their tank leaves the arena. Nobody scores for it, and
   * missiles aimed at it fly straight on.
   */
  removeTank(tank: TankState): void {
    this.clearTargetsOn(tank);
    tank.designatedId = null;
    tank.status = 'gone';
    tank.vx = 0;
    tank.vz = 0;
    tank.x = 0;
    tank.z = 0;
    this.projectiles = this.projectiles.filter((p) => p.shooterId !== tank.id);
  }

  /** A tank fell off or left: anyone who had picked it as their target goes back to automatic. */
  private clearTargetsOn(tank: TankState): void {
    for (const t of this.tanks) if (t.designatedId === tank.id) t.designatedId = null;
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

  /** This tank's firing range (the common range times its model's share, plus Range upgrades). */
  range(tank: TankState): number {
    const pct = this.tuning.upgrades.percentPerPoint / 100;
    return this.tuning.combat.rangeMetres * this.tuning.tanks[tank.model].rangeMultiplier * (1 + pct * tank.upgrades.range);
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
    const model = this.tuning.tanks[tank.model];
    if (model.barrels <= 0 && model.laserForce <= 0) return false; // no gun and no laser
    return c.firingEnabled && (!tank.isDummy || c.dummiesFire);
  }

  step(): void {
    const dt = this.dt;
    const T = this.tuning;
    this.time += dt;
    if (!this.track) this.shrinkTime += dt;

    this.applyInputs();
    if (this.track) this.raceOrder().forEach((t, i) => (t.racePlace = i + 1));

    // Movement (Sumo: the edge moves in once the ice starts shrinking)
    const R = this.arenaRadius();
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
      tank.explosiveLeft = Math.max(0, tank.explosiveLeft - dt);
      tank.disabledLeft = Math.max(0, tank.disabledLeft - dt);
      const disabled = tank.disabledLeft > 0;
      if (disabled) tank.burstLeft = 0;
      if (tank.stealthLeft > 0) {
        tank.stealthLeft = Math.max(0, tank.stealthLeft - dt);
        if (tank.stealthLeft === 0) this.events.push({ type: 'revealed', tankId: tank.id });
      }
      const model = this.stats(tank);

      // Hull turns toward the last click (not while disabled by an EMP).
      if (!disabled) tank.heading = turnToward(tank.heading, tank.targetHeading, hullStep * T.tanks[tank.model].hullTurnShare);
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

      // Hidden dome: small outward push that grows toward the edge
      // (in a race: away from the track's middle line, toward its edges).
      if (this.track) {
        const spot = locateOnTrack(this.track, tank.x, tank.z, tank.raceIndex);
        const push = T.physics.domeStrength * Math.pow(Math.min(spot.offset / this.track.halfWidth, 1), T.physics.domeCurve);
        tank.vx += spot.outX * push * dt;
        tank.vz += spot.outZ * push * dt;
      }
      const r = Math.hypot(tank.x, tank.z);
      if (!this.track && r > 1e-4) {
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
      const keep = Math.exp(-T.physics.drag * T.tanks[tank.model].dragShare * dt);
      tank.vx *= keep;
      tank.vz *= keep;

      tank.x += tank.vx * dt;
      tank.z += tank.vz * dt;

      // Turret turns toward the closest enemy, and fires automatically when
      // that enemy is within range.
      const target = disabled ? null : this.closestEnemy(tank);
      if (target) tank.turret = turnToward(tank.turret, Math.atan2(target.z - tank.z, target.x - tank.x), turretStep * T.tanks[tank.model].turretTurnShare);
      tank.shotTimerLeft = Math.max(0, tank.shotTimerLeft - dt);
      // Laser turret: a steady push on the target while the beam is on it.
      if (model.laserForce > 0) {
        this.stepLaser(tank, target, model);
        continue;
      }

      // Rocket bursts carry on between shots.
      if (model.rockets > 0) this.stepSalvo(tank, model);

      // A smoked (hidden) tank doesn't fire.
      if (target && tank.shotTimerLeft <= 0 && tank.protectionLeft <= 0 && tank.stealthLeft <= 0 && this.canFire(tank)) {
        const dist = Math.hypot(target.x - tank.x, target.z - tank.z);
        // Only fire once the turret points at the target, so shots leave the barrel straight.
        const aim = Math.abs(angleDelta(tank.turret, Math.atan2(target.z - tank.z, target.x - tank.x)));
        if (dist <= this.range(tank) && aim <= T.combat.fireAlignDeg * DEG) this.fire(tank, target, model);
      }
    }

    this.stepDrones();
    this.stepProjectiles();
    this.stepMissiles();
    this.resolveBumps();
    this.stepMines();
    this.stepGrenades();
    this.stepPowerups();

    // Falling off the edge
    for (const tank of this.tanks) {
      if (tank.status !== 'alive') continue;
      if (this.track) {
        if (this.stepRaceProgress(tank)) this.eliminate(tank);
      } else if (tank.x * tank.x + tank.z * tank.z > R * R) this.eliminate(tank);
    }
  }

  /**
   * Race: follow the tank along the track (distance driven, laps) and say
   * whether it is off the track (its centre past the edge).
   */
  private stepRaceProgress(tank: TankState): boolean {
    const track = this.track!;
    const spot = locateOnTrack(track, tank.x, tank.z, tank.raceIndex);
    let delta = track.along[spot.index]! - track.along[tank.raceIndex]!;
    if (delta > track.length / 2) delta -= track.length;
    if (delta < -track.length / 2) delta += track.length;
    tank.raceIndex = spot.index;
    tank.raceDistance += delta;
    const laps = Math.max(0, Math.floor(tank.raceDistance / track.length + 1e-9));
    if (laps > tank.raceLaps) {
      tank.raceLaps = laps;
      this.events.push({ type: 'lap', tankId: tank.id, laps });
      if (laps >= this.tuning.race.laps && this.raceWinnerId === null) {
        this.raceWinnerId = tank.id;
        this.events.push({ type: 'race-won', tankId: tank.id });
      }
    }
    return spot.offset > track.halfWidth;
  }

  /** Race: how much each tank has been slowed by its latest burst of hits, and when that burst began (for the cap). */
  private slowed = new Map<number, { amount: number; since: number }>();

  /**
   * A hit from a weapon, powerup or blast. In Sumo it pushes the tank along
   * (dirX, dirZ) by `push` divided by its mass. In a race it slows the tank
   * instead (pushing a tank ahead forward would help it): the slowdown is
   * the hit's Sumo push times race.hitSlowPerPush, and hits on one tank
   * within 0.1 s of each other (a shotgun blast, a rocket burst) together
   * take at most race.maxHitSlow of its speed.
   * Bumps between tanks never come through here.
   */
  private applyHit(t: TankState, dirX: number, dirZ: number, push: number, racePush?: number): void {
    if (!this.track || racePush !== undefined) {
      // Sumo: a push. Race: also a push for hits that keep pushing (mines), at their race share.
      const share = this.track ? (racePush ?? 1) : 1;
      const mass = this.massOf(t);
      t.vx += (dirX * push * share) / mass;
      t.vz += (dirZ * push * share) / mass;
      return;
    }
    const R = this.tuning.race;
    let entry = this.slowed.get(t.id);
    if (!entry || this.time - entry.since > 0.1) {
      entry = { amount: 0, since: this.time };
      this.slowed.set(t.id, entry);
    }
    const already = entry.amount;
    const slow = Math.min(push * R.hitSlowPerPush, Math.max(0, R.maxHitSlow - already));
    if (slow <= 0) return;
    entry.amount += slow;
    // Take that share of the speed the tank had before this burst of hits.
    const keep = 1 - slow / Math.max(1e-6, 1 - already);
    t.vx *= keep;
    t.vz *= keep;
  }

  /**
   * How hard a tank is to push (hits, bumps): the common mass times its
   * model's share, plus Weight upgrades. Its own acceleration uses the model's
   * mass without upgrades, so Weight doesn't slow it down.
   */
  massOf(tank: TankState): number {
    const pct = this.tuning.upgrades.percentPerPoint / 100;
    return this.tuning.physics.mass * this.tuning.tanks[tank.model].massShare * (1 + pct * tank.upgrades.weight);
  }

  /** How hard this tank's bumps push others: its model's bump multiplier, plus Weight upgrades. */
  private bumpOf(tank: TankState): number {
    const pct = this.tuning.upgrades.percentPerPoint / 100;
    return this.tuning.tanks[tank.model].bumpMultiplier * (1 + pct * tank.upgrades.weight);
  }

  /**
   * Race catch-up: share of top speed and traction a tank loses (negative =
   * gains). The leader and second place lose some; with 4 or more tanks the
   * last two gain some.
   */
  racePenalty(tank: TankState): number {
    if (!this.track || this.raceWinnerId !== null) return 0;
    const R = this.tuning.race;
    const racing = this.tanks.filter((t) => t.status !== 'gone').length;
    if (racing < 2) return 0;
    if (tank.racePlace === 1) return R.leaderPenalty;
    if (tank.racePlace === 2 && racing >= 3) return R.secondPenalty;
    if (racing >= 4 && tank.racePlace === racing) return -R.lastBonus;
    if (racing >= 4 && tank.racePlace === racing - 1) return -R.secondLastBonus;
    return 0;
  }

  /** Race: how far each tank is (laps and distance), best first. */
  raceOrder(): TankState[] {
    return this.tanks.filter((t) => t.status !== 'gone').sort((a, b) => b.raceDistance - a.raceDistance);
  }

  /**
   * Race: put every tank on the starting grid behind the line (two per row),
   * facing along the track, and clear everything from the last race.
   */
  startRace(track: Track): void {
    this.track = track;
    this.raceWinnerId = null;
    this.projectiles = [];
    this.missiles = [];
    this.mines = [];
    this.grenades = [];
    this.drones = [];
    this.powerups = [];
    const n = track.points.length;
    const step = track.length / n;
    let slot = 0;
    for (const tank of this.tanks) {
      if (tank.status === 'gone') continue;
      const row = Math.floor(slot / 2);
      const side = slot % 2 === 0 ? -1 : 1;
      slot++;
      const back = 5 + row * 6;
      const index = (n - Math.round(back / step) + n) % n;
      const p = track.points[index]!;
      const h = trackHeading(track, index);
      const lateral = side * track.halfWidth * 0.35;
      this.respawn(tank);
      tank.x = p.x - Math.sin(h) * lateral;
      tank.z = p.z + Math.cos(h) * lateral;
      tank.heading = tank.targetHeading = tank.turret = h;
      tank.raceIndex = index;
      tank.raceDistance = -back;
      tank.raceLaps = 0;
      tank.protectionLeft = 0;
      tank.knockouts = 0;
      tank.eliminations = 0;
      tank.slots = tank.slots.map(() => null);
    }
  }

  /** Projectiles, missiles and drones are gone once they get this far from the middle. */
  private areaRadius(): number {
    return this.track ? this.track.bound : this.tuning.arena.radius;
  }

  /** Closest other tank that is on the ice and can be hit. */
  /**
   * The tank this one aims at: the closest visible enemy. Artillery skips
   * tanks inside its minimum range and aims at the next closest instead.
   * With a right-click target it aims only at that tank (none while that
   * tank is hidden, spawn-protected, or inside Artillery's minimum range).
   */
  closestEnemy(tank: TankState): TankState | null {
    const min = this.tuning.tanks[tank.model].minRange;
    if (tank.designatedId !== null) {
      const t = this.tanks[tank.designatedId];
      if (!t || t.status !== 'alive' || t.protectionLeft > 0 || this.isHidden(t)) return null;
      if (min > 0 && Math.hypot(t.x - tank.x, t.z - tank.z) < min) return null;
      return t;
    }
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const other of this.tanks) {
      if (other === tank || other.status !== 'alive' || other.protectionLeft > 0 || this.isHidden(other)) continue;
      const d = (other.x - tank.x) ** 2 + (other.z - tank.z) ** 2;
      if (min > 0 && d < min * min) continue;
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
      if (input.type === 'target') {
        // Choosing a target works even while disabled; it only changes what you fire at.
        const t = input.targetId === null ? null : this.tanks[input.targetId];
        const valid = !!t && t !== tank && t.status === 'alive' && !this.isHidden(t);
        tank.designatedId = valid && t.id !== tank.designatedId ? t.id : null;
        continue;
      }
      // Disabled by an EMP: no control at all.
      if (tank.disabledLeft > 0) continue;
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
        } else if (tank.model === 'modelE') {
          // Shotgun: the grenade needs a spot; it comes as a 'grenade' input.
          continue;
        } else if (tank.model === 'modelG') {
          // Rocket: the drone needs a spot; it comes as a 'drone' input.
          continue;
        } else if (tank.model === 'modelF') {
          // Artillery: explosive shells for a while.
          const X = T.abilities.explosiveShells;
          tank.explosiveLeft = X.seconds;
          tank.abilityCooldownLeft = X.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'explosiveShells', ...at });
        } else if (tank.model === 'modelD') {
          // EMP: disable every other tank nearby.
          const E = T.abilities.emp;
          tank.abilityCooldownLeft = E.cooldown;
          this.events.push({ type: 'ability', tankId, kind: 'emp', ...at });
          this.emp(tank, E.radius, E.seconds, false);
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
      } else if (input.type === 'drone') {
        // Rocket ability: a drone hovers at a spot (capped at the placing range, and over the ice).
        if (tank.model !== 'modelG' || tank.abilityCooldownLeft > 0 || !Number.isFinite(input.x) || !Number.isFinite(input.z)) continue;
        const D = T.abilities.drone;
        let dx = input.x - tank.x;
        let dz = input.z - tank.z;
        const d = Math.hypot(dx, dz);
        if (d > D.maxPlace) {
          dx *= D.maxPlace / d;
          dz *= D.maxPlace / d;
        }
        let x = tank.x + dx;
        let z = tank.z + dz;
        const r = Math.hypot(x, z);
        const inside = this.arenaRadius() - 1;
        if (!this.track && r > inside) {
          x *= inside / r;
          z *= inside / r;
        }
        tank.abilityCooldownLeft = D.cooldown;
        this.drones.push({ id: this.nextObjectId++, ownerId: tank.id, x, z, timeLeft: D.seconds, turret: tank.turret, shotTimerLeft: 0 });
        this.events.push({ type: 'ability', tankId, kind: 'drone', x, z });
      } else if (input.type === 'grenade') {
        // Shotgun ability: throw a grenade at a spot (capped at the throw range).
        if (tank.model !== 'modelE' || tank.abilityCooldownLeft > 0 || !Number.isFinite(input.x) || !Number.isFinite(input.z)) continue;
        const G = T.abilities.grenade;
        let dx = input.x - tank.x;
        let dz = input.z - tank.z;
        const d = Math.hypot(dx, dz);
        if (d > G.maxThrow) {
          dx *= G.maxThrow / d;
          dz *= G.maxThrow / d;
        }
        tank.abilityCooldownLeft = G.cooldown;
        const grenade: GrenadeState = {
          id: this.nextObjectId++,
          kind: 'grenade',
          ownerId: tank.id,
          fromX: tank.x,
          fromZ: tank.z,
          toX: tank.x + dx,
          toZ: tank.z + dz,
          t: 0,
          duration: G.flightSeconds * Math.max(0.5, Math.hypot(dx, dz) / G.maxThrow),
          radius: G.radius,
          impact: G.impact,
          explosive: false,
        };
        this.grenades.push(grenade);
        this.events.push({ type: 'ability', tankId, kind: 'grenade', x: tank.x, z: tank.z });
        this.events.push({ type: 'grenade-thrown', tankId, grenadeId: grenade.id });
      } else if (input.type === 'rapidFire') {
        if (tank.slots[input.slot] !== 'rapidFire') continue;
        tank.slots[input.slot] = null;
        // Laser: the same timer makes its laser push harder (see stepLaser).
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
    if (model.lobbed > 0) {
      this.lob(tank, target, model);
      return;
    }
    if (model.rockets > 0) {
      this.fireRocket(tank, target, model);
      return;
    }
    const powered = tank.powerShotsLeft > 0;
    if (powered) tank.powerShotsLeft--;
    const angle = tank.turret;
    const muzzle = model.radius + model.projectileRadius + 0.1;
    // Dual barrels fire in turns: left, right, left, right.
    const barrel = model.barrels > 1 ? tank.nextBarrel : 0;
    if (model.barrels > 1) tank.nextBarrel = 1 - tank.nextBarrel;
    const side = model.barrels > 1 ? (barrel === 0 ? -1 : 1) * BARREL_SPACING : 0;
    // Several pellets fan out evenly across the spread, with a little scatter.
    const pellets = Math.max(1, Math.round(model.pellets));
    const spread = model.spreadDeg * DEG;
    let firstId = 0;
    for (let i = 0; i < pellets; i++) {
      const fan = pellets > 1 ? -spread / 2 + (spread * i) / (pellets - 1) + (this.random() - 0.5) * (spread / pellets) * 0.5 : 0;
      const projectile: ProjectileState = {
        id: this.nextProjectileId++,
        shooterId: tank.id,
        targetId: model.homing ? target.id : null,
        x: tank.x + Math.cos(angle) * muzzle - Math.sin(angle) * side,
        z: tank.z + Math.sin(angle) * muzzle + Math.cos(angle) * side,
        angle: angle + fan,
        speed: model.projectileSpeed * (pellets > 1 ? 0.92 + this.random() * 0.16 : 1),
        radius: model.projectileRadius * (powered ? POWER_SHOT_HIT_SCALE : 1),
        impact: model.projectileImpact * (powered ? this.tuning.abilities.powerShot.impactMultiplier : 1),
        powered,
        age: 0,
        missesTankId: null,
        travelled: 0,
        maxRange: model.projectileMaxRange,
        pushRange: this.range(tank),
      };
      if (i === 0) firstId = projectile.id;
      this.projectiles.push(projectile);
    }
    tank.shotTimerLeft = model.timeBetweenShots;

    // Recoil: pushed backward, opposite the shot (Model B).
    if (model.recoil > 0) {
      tank.vx -= (Math.cos(angle) * model.recoil) / model.mass;
      tank.vz -= (Math.sin(angle) * model.recoil) / model.mass;
    }
    this.events.push({ type: 'shot', tankId: tank.id, projectileId: firstId, barrel });
  }

  /**
   * Rocket: a burst of small homing rockets (salvo) from the launcher, flying
   * like the missile powerup. The first goes now, the rest follow
   * salvoGapSeconds apart (see stepSalvo).
   */
  private fireRocket(tank: TankState, target: TankState, model: ModelStats): void {
    const count = Math.max(1, Math.round(model.salvo));
    tank.salvoLeft = count - 1;
    tank.salvoTimer = this.tuning.combat.salvoGapSeconds;
    tank.salvoTargetId = target.id;
    this.launchRocket(tank, target, model, 0, count);
    tank.shotTimerLeft = model.timeBetweenShots;
  }

  /** Rocket burst: the next rockets, while the tank can still fire. */
  private stepSalvo(tank: TankState, model: ModelStats): void {
    if (tank.salvoLeft <= 0) return;
    if (tank.disabledLeft > 0 || !this.canFire(tank)) {
      tank.salvoLeft = 0;
      return;
    }
    tank.salvoTimer -= this.dt;
    if (tank.salvoTimer > 0) return;
    // Same target if it is still there and visible, else whoever it aims at now.
    const first = tank.salvoTargetId !== null ? this.tanks[tank.salvoTargetId] : undefined;
    const target = first && first.status === 'alive' && !this.isHidden(first) ? first : this.closestEnemy(tank);
    if (!target) {
      tank.salvoLeft = 0;
      return;
    }
    const count = Math.max(1, Math.round(model.salvo));
    this.launchRocket(tank, target, model, count - tank.salvoLeft, count);
    tank.salvoLeft--;
    tank.salvoTimer = this.tuning.combat.salvoGapSeconds;
  }

  /** One rocket; rockets of a burst leave fanned out a little (left, middle, right). */
  private launchRocket(tank: TankState, target: TankState, model: ModelStats, index: number, count: number): void {
    const M = this.tuning.missile;
    const r = model.radius + model.projectileRadius + 0.2;
    const fan = count > 1 ? (index / (count - 1) - 0.5) * 20 * DEG : 0;
    const angle = tank.turret + fan;
    const rocket: MissileState = {
      id: this.nextObjectId++,
      shooterId: tank.id,
      targetId: target.id,
      x: tank.x + Math.cos(angle) * r,
      z: tank.z + Math.sin(angle) * r,
      angle,
      speed: M.startSpeed,
      phase: 'curve',
      age: 0,
      missesTankId: null,
      impact: model.projectileImpact,
      radius: model.projectileRadius,
      small: true,
      traveled: 0,
    };
    this.missiles.push(rocket);
    this.events.push({ type: 'shot', tankId: tank.id, projectileId: rocket.id, barrel: 0 });
  }

  /**
   * Drones hover in place for a while and machine-gun the closest visible
   * enemy of their owner within range. Their shots count as the owner's, so
   * they never hit the owner.
   */
  private stepDrones(): void {
    const T = this.tuning;
    const D = T.abilities.drone;
    const dt = this.dt;
    const kept: DroneState[] = [];
    for (const drone of this.drones) {
      drone.timeLeft -= dt;
      if (drone.timeLeft <= 0) {
        this.events.push({ type: 'drone-gone', droneId: drone.id });
        continue;
      }
      kept.push(drone);
      drone.shotTimerLeft = Math.max(0, drone.shotTimerLeft - dt);
      const owner = this.tanks[drone.ownerId];
      let target: TankState | null = null;
      let bestD = D.range * D.range;
      for (const other of this.tanks) {
        if (other.id === drone.ownerId || other.status !== 'alive' || other.protectionLeft > 0 || this.isHidden(other)) continue;
        const d = (other.x - drone.x) ** 2 + (other.z - drone.z) ** 2;
        if (d <= bestD) {
          bestD = d;
          target = other;
        }
      }
      if (!target) continue;
      const want = Math.atan2(target.z - drone.z, target.x - drone.x);
      drone.turret = turnToward(drone.turret, want, T.physics.turretTurnRateDeg * DEG * dt);
      const allowed = T.combat.firingEnabled && (!owner?.isDummy || T.combat.dummiesFire);
      if (!allowed || drone.shotTimerLeft > 0 || Math.abs(angleDelta(drone.turret, want)) > T.combat.fireAlignDeg * DEG) continue;
      drone.shotTimerLeft = D.timeBetweenShots;
      this.projectiles.push({
        id: this.nextProjectileId++,
        shooterId: drone.ownerId,
        targetId: target.id,
        x: drone.x + Math.cos(drone.turret) * 0.4,
        z: drone.z + Math.sin(drone.turret) * 0.4,
        angle: drone.turret,
        speed: D.projectileSpeed,
        radius: D.projectileRadius,
        impact: D.impact,
        powered: false,
        age: 0,
        missesTankId: null,
        travelled: 0,
        maxRange: D.range + 3,
      });
      this.events.push({ type: 'drone-shot', droneId: drone.id });
    }
    this.drones = kept;
  }

  /**
   * Artillery: a shell flies high to where the target will be when it lands,
   * judged from the target's slide at the moment of firing (no tracking after
   * that; aimed slightly short) and bursts there. Flight time grows with distance.
   */
  private lob(tank: TankState, target: TankState, model: ModelStats): void {
    const X = this.tuning.abilities.explosiveShells;
    const explosive = tank.explosiveLeft > 0;
    const angle = tank.turret;
    const muzzle = model.radius + 0.3;
    const fromX = tank.x + Math.cos(angle) * muzzle;
    const fromZ = tank.z + Math.sin(angle) * muzzle;
    // Lead the target: aim where its current slide takes it by the time the
    // shell lands (flight time depends on the distance, so refine a few times).
    const speed = Math.max(1, model.projectileSpeed);
    let aimX = target.x;
    let aimZ = target.z;
    for (let k = 0; k < 4; k++) {
      const t = Math.max(0.35, Math.hypot(aimX - fromX, aimZ - fromZ) / speed);
      aimX = target.x + target.vx * t;
      aimZ = target.z + target.vz * t;
    }
    // Aim a little short of that spot, toward the Artillery.
    const full = Math.hypot(aimX - fromX, aimZ - fromZ) || 1;
    const short = Math.min(this.tuning.combat.artilleryAimShort, full * 0.5);
    const toX = aimX - ((aimX - fromX) / full) * short;
    const toZ = aimZ - ((aimZ - fromZ) / full) * short;
    const dist = full - short;
    const shell: GrenadeState = {
      id: this.nextObjectId++,
      kind: 'shell',
      ownerId: tank.id,
      fromX,
      fromZ,
      toX,
      toZ,
      t: 0,
      duration: Math.max(0.35, dist / Math.max(1, model.projectileSpeed)),
      radius: model.blastRadius * (explosive ? X.radiusMultiplier : 1),
      impact: model.projectileImpact * (explosive ? X.impactMultiplier : 1),
      explosive,
    };
    this.grenades.push(shell);
    tank.shotTimerLeft = model.timeBetweenShots;
    if (model.recoil > 0) {
      tank.vx -= (Math.cos(angle) * model.recoil) / model.mass;
      tank.vz -= (Math.sin(angle) * model.recoil) / model.mass;
    }
    this.events.push({ type: 'shot', tankId: tank.id, projectileId: shell.id, barrel: 0 });
  }

  private stepProjectiles(): void {
    const dt = this.dt;
    const T = this.tuning;
    const turn = T.combat.homingTurnRateDeg * DEG * dt;
    const outside = this.areaRadius() + 3;
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
      p.travelled += p.speed * dt;
      if (p.maxRange > 0 && p.travelled > p.maxRange) continue;

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
        // Gun shots push harder up close: shotPushNear at the muzzle to shotPushFar at the shooter's range.
        let push = p.impact;
        if (p.pushRange && p.pushRange > 0) {
          const k = Math.min(1, p.travelled / p.pushRange);
          push *= T.combat.shotPushNear + (T.combat.shotPushFar - T.combat.shotPushNear) * k;
        }
        this.applyHit(hit, Math.cos(p.angle), Math.sin(p.angle), push);
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
      impact: M.impact,
      radius: M.radius,
      small: false,
      traveled: 0,
    };
    this.missiles.push(missile);
    this.events.push({ type: 'missile-fired', tankId: tank.id, targetId: target.id, missileId: missile.id });
  }

  private stepMissiles(): void {
    const dt = this.dt;
    const T = this.tuning;
    const M = T.missile;
    const outside = this.areaRadius() + 4;
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
      m.traveled += m.speed * dt;

      // Hits the first tank it touches (not the shooter, not spawn-protected tanks).
      let hit: TankState | null = null;
      for (const tank of this.tanks) {
        if (tank.id === m.shooterId || tank.id === m.missesTankId || tank.status !== 'alive' || tank.protectionLeft > 0) continue;
        const reach = T.tanks[tank.model].radius + m.radius;
        if ((tank.x - m.x) ** 2 + (tank.z - m.z) ** 2 <= reach * reach) {
          hit = tank;
          break;
        }
      }
      if (hit) {
        // The missile powerup still pushes in a race (at race.missilePushShare of its Sumo push);
        // Rocket tank rockets slow the target, like other shots.
        // Push grows with the distance flown (distancePushMin at launch to distancePushMax at distancePushMetres).
        const k = M.distancePushMetres > 0 ? Math.min(1, (m.traveled ?? 0) / M.distancePushMetres) : 1;
        const flown = M.distancePushMin + (M.distancePushMax - M.distancePushMin) * k;
        this.applyHit(hit, Math.cos(m.angle), Math.sin(m.angle), m.impact * flown, m.small ? undefined : this.tuning.race.missilePushShare);
        hit.lastHitBy = m.shooterId;
        hit.lastHitAt = this.time;
        hit.hitsTaken++;
        this.reveal(hit);
        const shooter = this.tanks[m.shooterId];
        if (shooter) shooter.hitsDealt++;
        this.events.push({ type: 'missile-hit', missileId: m.id, shooterId: m.shooterId, targetId: hit.id, x: m.x, z: m.z, small: m.small });
        continue;
      }
      // A missile that misses flies out of the arena and is gone.
      if (m.x * m.x + m.z * m.z > outside * outside || m.age > MISSILE_MAX_AGE) continue;
      kept.push(m);
    }
    this.missiles = kept;
  }

  /** Mines go live after a moment; any tank but its owner touching a live mine sets it off. */
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
          // The tank that dropped the mine can drive over it safely.
          if (t.status !== 'alive' || t.protectionLeft > 0 || t.id === mine.ownerId) return false;
          return (t.x - mine.x) ** 2 + (t.z - mine.z) ** 2 <= B.triggerRange * B.triggerRange;
        });
      if (!triggered) {
        kept.push(mine);
        continue;
      }
      // Less push in a race (dropped and hazard mines alike).
      // Mines still push in a race (at race.minePushShare of their Sumo push) instead of slowing.
      const pushed = this.blast(mine.x, mine.z, B.blastRadius, B.impact, mine.ownerId, true, undefined, this.tuning.race.minePushShare);
      this.events.push({ type: 'mine-exploded', mineId: mine.id, ownerId: mine.ownerId, x: mine.x, z: mine.z, pushed });
    }
    this.mines = kept;
  }

  /**
   * Push every tank within `radius` away from (x, z): full strength at the
   * centre, 40% at the edge. The owner gets the credit for every other tank.
   * `hitsOwner`: mines also push the tank that dropped them; grenades don't.
   * Returns the ids of the tanks pushed.
   */
  private blast(x: number, z: number, radius: number, impact: number, ownerId: number, hitsOwner: boolean, fallback?: { x: number; z: number }, racePush?: number): number[] {
    const T = this.tuning;
    const pushed: number[] = [];
    for (const t of this.tanks) {
      if (t.status !== 'alive' || t.protectionLeft > 0) continue;
      if (!hitsOwner && t.id === ownerId) continue;
      let dx = t.x - x;
      let dz = t.z - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const strength = impact * (1 - 0.6 * Math.min(1, d / radius));
      // Almost dead centre: push along the given direction (or the tank's heading).
      const fl = fallback ? Math.hypot(fallback.x, fallback.z) : 0;
      if (d < 0.5 && fl > 1e-3) {
        dx = fallback!.x / fl;
        dz = fallback!.z / fl;
      } else if (d < 1e-3) {
        dx = Math.cos(t.heading);
        dz = Math.sin(t.heading);
      } else {
        dx /= d;
        dz /= d;
      }
      this.applyHit(t, dx, dz, strength, racePush);
      this.reveal(t);
      if (t.id !== ownerId && ownerId >= 0) {
        t.lastHitBy = ownerId;
        t.lastHitAt = this.time;
        t.hitsTaken++;
        const owner = this.tanks[ownerId];
        if (owner) owner.hitsDealt++;
      }
      pushed.push(t.id);
    }
    return pushed;
  }

  /** Grenades and shells fly to where they were aimed, then explode there. */
  private stepGrenades(): void {
    const kept: GrenadeState[] = [];
    for (const g of this.grenades) {
      g.t += this.dt;
      if (g.t < g.duration) {
        kept.push(g);
        continue;
      }
      // Never affects the tank that threw or fired it. A direct hit pushes the
      // tank along the flight direction.
      // Shells and grenades push less in a race.
      const pushed = this.blast(g.toX, g.toZ, g.radius, g.impact, g.ownerId, false, { x: g.toX - g.fromX, z: g.toZ - g.fromZ });
      this.events.push({ type: 'grenade-exploded', grenadeId: g.id, kind: g.kind, explosive: g.explosive, ownerId: g.ownerId, x: g.toX, z: g.toZ, radius: g.radius, pushed });
    }
    this.grenades = kept;
  }

  /** Spawning (every few seconds, max a few on the ice) and pickup. */
  private stepPowerups(): void {
    const T = this.tuning;
    const P = T.powerups;

    // Sumo: powerups and mines left outside the shrinking ice fall off and are gone.
    if (!this.track && T.arena.shrinkEnabled) {
      const R = this.arenaRadius();
      const onIce = (o: { x: number; z: number }) => o.x * o.x + o.z * o.z <= R * R;
      if (!this.powerups.every(onIce)) this.powerups = this.powerups.filter(onIce);
      if (!this.mines.every(onIce)) this.mines = this.mines.filter(onIce);
    }

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
    const hazards = this.mines.filter((m) => m.ownerId < 0).length;
    if (this.powerups.length + hazards >= (this.track ? T.race.powerupsOnField : P.maxOnField)) return;

    // Race: sometimes a live mine instead of a powerup (a hazard, nobody's).
    const R = T.race;
    const hazard = !!this.track && this.random() < R.hazardMineChance;
    // Race: ahead of the leader somewhere along the track. Pickups toward the
    // edges of the track, hazard mines toward the middle.
    const leader = this.track ? this.raceOrder()[0] : undefined;

    // Anywhere except the strip along the edge, never on a tank, mine or powerup.
    const nowR = this.arenaRadius();
    const maxR = Math.max(1, nowR - Math.min(P.edgeStrip, nowR * 0.4));
    for (let attempt = 0; attempt < 30; attempt++) {
      let x: number;
      let z: number;
      if (this.track) {
        const track = this.track;
        const n = track.points.length;
        const step = track.length / n;
        const ahead = R.spawnAheadMin + this.random() * Math.max(0, R.spawnAheadMax - R.spawnAheadMin);
        const from = leader ? leader.raceIndex : Math.floor(this.random() * n);
        const i = (from + Math.round(ahead / step)) % n;
        const p = track.points[i]!;
        const h = trackHeading(track, i);
        // Keep 1.5 m clear of the edge, so a pickup is reachable without falling off.
        const usable = Math.max(0, track.halfWidth - 1.5);
        const side = this.random() < 0.5 ? -1 : 1;
        // Mines: within the middle share of the track. Pickups: in the outer part, near the edges.
        const share = hazard ? this.random() * R.hazardMiddleShare : 1 - this.random() * (1 - R.pickupEdgeShare);
        const lateral = side * share * usable;
        x = p.x - Math.sin(h) * lateral;
        z = p.z + Math.cos(h) * lateral;
      } else {
        const a = this.random() * Math.PI * 2;
        const r = Math.sqrt(this.random()) * maxR;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }
      const clear =
        this.tanks.every((t) => t.status !== 'alive' || Math.hypot(t.x - x, t.z - z) >= P.clearance) &&
        this.mines.every((m) => Math.hypot(m.x - x, m.z - z) >= P.clearance) &&
        this.powerups.every((p) => Math.hypot(p.x - x, p.z - z) >= P.clearance);
      if (!clear) continue;
      if (hazard) {
        // Already live: it goes off as soon as a tank touches it.
        const mine: MineState = { id: this.nextObjectId++, ownerId: -1, x, z, age: T.mine.armSeconds };
        this.mines.push(mine);
        this.events.push({ type: 'mine-dropped', tankId: -1, mineId: mine.id });
        return;
      }
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
        const ma = this.massOf(a);
        const mb = this.massOf(b);
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
        // Laser's buzz-saw edge: the tank it hits gets a bigger push.
        const onA = impulse * this.bumpOf(b);
        const onB = impulse * this.bumpOf(a);
        a.vx -= nx * onA * invA;
        a.vz -= nz * onA * invA;
        b.vx += nx * onB * invB;
        b.vz += nz * onB * invB;

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

  /**
   * Laser: when the turret points at the closest enemy within range, the beam
   * is on and pushes that tank away from the laser, a little every step
   * (a continuous bump). It counts as a hit for knockout credit.
   * The beam stays on for at most beamSeconds, then pauses for
   * beamPauseSeconds; being off target that long also resets the beam time.
   */
  private stepLaser(tank: TankState, target: TankState | null, model: ModelStats): void {
    const previous = tank.laserTargetId;
    if (tank.beamPauseLeft > 0) {
      // Forced pause after beamSeconds of beam: the laser stays off.
      tank.beamPauseLeft = Math.max(0, tank.beamPauseLeft - this.dt);
      tank.laserTargetId = null;
      tank.beamHold = 0;
      return;
    }
    this.stepLaserBeam(tank, target, model, previous);
    if (tank.laserTargetId === null) tank.beamHold = 0;
    if (tank.laserTargetId !== null) {
      tank.beamOff = 0;
      tank.beamOn += this.dt;
      if (model.beamSeconds > 0 && tank.beamOn >= model.beamSeconds) {
        tank.beamOn = 0;
        tank.beamPauseLeft = model.beamPauseSeconds;
      }
    } else {
      tank.beamOff += this.dt;
      if (tank.beamOff >= model.beamPauseSeconds) tank.beamOn = 0;
    }
  }

  /** Laser focus: push share, from beamFocusStart to beamFocusEnd over beamFocusSeconds on the same tank. */
  laserFocus(tank: TankState, model: { beamFocusStart: number; beamFocusEnd: number; beamFocusSeconds: number }): number {
    if (model.beamFocusSeconds <= 0) return model.beamFocusEnd;
    const k = Math.min(1, tank.beamHold / model.beamFocusSeconds);
    return model.beamFocusStart + (model.beamFocusEnd - model.beamFocusStart) * k;
  }

  private stepLaserBeam(tank: TankState, target: TankState | null, model: ModelStats, previous: number | null): void {
    const T = this.tuning;
    tank.laserTargetId = null;
    if (!target || tank.protectionLeft > 0 || tank.stealthLeft > 0 || !this.canFire(tank)) return;
    const dx = target.x - tank.x;
    const dz = target.z - tank.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.range(tank) || dist < 1e-3) return;
    const aim = Math.abs(angleDelta(tank.turret, Math.atan2(dz, dx)));
    if (aim > T.combat.fireAlignDeg * DEG) return;
    const boost = tank.rapidFireLeft > 0 ? T.rapidFire.laserMultiplier : 1;
    tank.beamHold = previous === target.id ? tank.beamHold + this.dt : this.dt;
    // A steady push in Sumo; a steady slowdown in a race. It builds up
    // (focus) the longer the beam stays on the same tank.
    const focus = this.laserFocus(tank, model);
    this.applyHit(target, dx / dist, dz / dist, model.laserForce * boost * focus * this.dt);
    // Knockout credit only once the beam has held this tank for a moment.
    if (tank.beamHold >= model.beamCreditSeconds - 1e-9) {
      target.lastHitBy = tank.id;
      target.lastHitAt = this.time;
    }
    tank.laserTargetId = target.id;
    if (previous !== target.id) {
      // A new beam contact counts as one hit.
      target.hitsTaken++;
      tank.hitsDealt++;
      this.events.push({ type: 'laser-hit', tankId: tank.id, targetId: target.id });
    }
  }

  /** Disable every other tank within `radius` of this tank for `seconds`. */
  private emp(tank: TankState, radius: number, seconds: number, pulse: boolean): void {
    const T = this.tuning;
    const disabled: number[] = [];
    for (const other of this.tanks) {
      if (other === tank || other.status !== 'alive' || other.protectionLeft > 0) continue;
      if (Math.hypot(other.x - tank.x, other.z - tank.z) > radius + T.tanks[other.model].radius) continue;
      // A weaker pulse never shortens a longer EMP that is already running.
      other.disabledLeft = Math.max(other.disabledLeft, seconds);
      other.burstLeft = 0;
      disabled.push(other.id);
    }
    this.events.push({ type: 'emp', tankId: tank.id, x: tank.x, z: tank.z, radius, disabled, pulse });
  }

  /** Any hit (shot, missile, mine blast or bump) ends a smoke screen. */
  private reveal(tank: TankState): void {
    if (tank.stealthLeft <= 0) return;
    tank.stealthLeft = 0;
    this.events.push({ type: 'revealed', tankId: tank.id });
  }

  private eliminate(tank: TankState): void {
    this.clearTargetsOn(tank);
    tank.status = 'falling';
    tank.fallTime = 0;
    tank.burstLeft = 0;
    tank.boostLeft = 0;
    tank.stealthLeft = 0;
    tank.rapidFireLeft = 0;
    tank.explosiveLeft = 0;
    tank.disabledLeft = 0;
    tank.salvoLeft = 0;
    tank.laserTargetId = null;
    tank.beamOn = 0;
    tank.beamOff = 0;
    tank.beamPauseLeft = 0;
    tank.beamHold = 0;
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
    // On shrunk ice the margin shrinks too, so respawns don't all land in the middle.
    const nowR = this.arenaRadius();
    const maxR = Math.max(1, nowR - Math.min(T.rules.respawnEdgeMargin, nowR * 0.45));
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
    if (this.track) {
      // Race: back on the middle of the track where it fell off, facing along
      // the track. If another tank is right there, a little further back.
      const track = this.track;
      const n = track.points.length;
      let index = tank.raceIndex;
      for (let k = 0; k < 6; k++) {
        const p = track.points[index]!;
        if (this.tanks.every((o) => o === tank || o.status !== 'alive' || Math.hypot(o.x - p.x, o.z - p.z) >= 3)) break;
        index = (index - 3 + n) % n;
      }
      let back = track.along[tank.raceIndex]! - track.along[index]!;
      if (back < 0) back += track.length;
      tank.raceIndex = index;
      tank.raceDistance -= back;
      const p = track.points[index]!;
      tank.x = p.x;
      tank.z = p.z;
      tank.heading = tank.targetHeading = tank.turret = trackHeading(track, index);
    }
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
    tank.explosiveLeft = 0;
    tank.salvoLeft = 0;
    tank.stealthLeft = 0;
    tank.disabledLeft = 0;
    tank.nextBarrel = 0;
    this.events.push({ type: 'respawned', tankId: tank.id });
  }
}
