/**
 * ALL TUNING VALUES LIVE HERE.
 *
 * This is the single place for numbers that change how the game looks or
 * feels. The browser and the game server both read this file, so practice
 * mode and online matches always use the same values.
 *
 * When Robbert pastes slider values from the in-game panel, they become the
 * new defaults in this file. Last update: 31 Oct 2026 (milestone 5 cleanup).
 *
 * How tank values work (milestone 5):
 * - Movement (mass, thrust, burst, top speed, traction, drag, turn speeds) is a
 *   COMMON value in `common`, in real units. Each tank adds its own percentage
 *   on top: `tanks.<model>.<name>Pct`, from -50 to +50 (0 = the common value).
 * - Weapon values have no common value: each tank's `weapon` block holds its
 *   own numbers, and only the ones that weapon uses.
 *
 * Units: distances in metres, speeds in m/s, time in seconds, angles in
 * degrees, mass in tonnes. Every PUSH in this file is the speed change (m/s)
 * it gives a 30 t tank (PUSH_REFERENCE_TONNES); a 60 t tank gets half.
 */

export type TankModel = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'modelE' | 'modelF' | 'modelG';

/** Gun: projectiles from one or two barrels (Agile, Heavy, Stealth, Shotgun). */
export interface GunWeapon {
  kind: 'gun';
  /** Fires when the closest enemy is this close (m). */
  range: number;
  /** Seconds between automatic shots. */
  timeBetweenShots: number;
  /** Projectile flight speed (m/s). Constant. */
  projectileSpeed: number;
  /** Push of a hit right at the muzzle. */
  push: number;
  /** The push changes by this % of the muzzle push per metre flown (negative = weaker with distance)... */
  pushPerMetre: number;
  /** ...until the shot has flown this far (m); after that it stays the same. */
  pushChangeStops: number;
  /** Shots vanish after flying this far (m). 0 = until they leave the arena. */
  maxDistance: number;
  /** How fast shots steer toward their target (degrees per second). 0 = they fly straight. */
  homingTurn: number;
  /** Projectile size (radius, m). */
  projectileRadius: number;
  /** Push backward on the shooter for each shot (speed change of a 30 t tank). */
  recoil: number;
  /** Barrels on the turret. Two barrels fire in turns: left, right, left, right. */
  barrels: number;
  /** Projectiles per shot. More than 1 fires a spread (shotgun pellets). */
  pellets: number;
  /** Width of the spread when firing several pellets (degrees). */
  spreadDeg: number;
}

/** Laser turret: a beam that pushes the tank it is on away, steadily (Laser). */
export interface LaserWeapon {
  kind: 'laser';
  /** The beam reaches this far (m). */
  range: number;
  /** Push per second while the beam is on a tank. */
  push: number;
  /** The beam stays on a target at most this long (s), then pauses. 0 = no limit. */
  beamSeconds: number;
  /** How long the beam pauses after beamSeconds (s). Being off target this long also resets the beam time. */
  beamPauseSeconds: number;
  /** The beam only earns knockout credit once it has held a tank this long (s). */
  beamCreditSeconds: number;
  /** Focus: the beam's push starts at this share... */
  focusStart: number;
  /** ...and builds up to this share while it stays on the same tank... */
  focusEnd: number;
  /** ...over this many seconds. A new target (or a pause) starts over. 0 = always full. */
  focusSeconds: number;
}

/** Shells lobbed to where the target will be, bursting on landing (Artillery). */
export interface ShellWeapon {
  kind: 'shell';
  /** Fires at enemies up to this far away (m)... */
  range: number;
  /** ...but not at tanks closer than this (m). */
  minRange: number;
  timeBetweenShots: number;
  /** Speed over the ground (m/s), so far shots take longer to land. */
  projectileSpeed: number;
  /** Push at the blast centre; 40% of this at its edge. */
  push: number;
  /** Tanks within this distance of where a shell lands are pushed (m). */
  blastRadius: number;
  /** Aims this far short of its target, toward itself (m), so a direct hit pushes the target away. */
  aimShort: number;
  /** Shell size (drawing). */
  projectileRadius: number;
  recoil: number;
}

/** Small homing rockets in quick bursts, flying like the missile powerup (Rocket). */
export interface RocketWeapon {
  kind: 'rocket';
  range: number;
  timeBetweenShots: number;
  /** Rockets per shot, fired in a quick burst... */
  salvo: number;
  /** ...this many seconds apart. */
  salvoGap: number;
  /** Push of a hit right after launch. */
  push: number;
  /** The push grows by this % of the launch push per metre flown... */
  pushPerMetre: number;
  /** ...until the rocket has flown this far (m). */
  pushChangeStops: number;
  /** Rocket size for hits (radius, m). */
  projectileRadius: number;
  /** Flight: speed during the first curve toward the target (m/s)... */
  startSpeed: number;
  /** ...then it speeds up to this (m/s)... */
  topSpeed: number;
  /** ...with this acceleration (m/s²). */
  acceleration: number;
  /** Turn rate during the first curve (degrees per second). */
  curveTurn: number;
  /** The first curve ends once it points within this angle of the target. */
  curveDoneDeg: number;
  /** Turn rate after the first curve, so sharp dodges can make it miss. */
  lateTurn: number;
}

export type Weapon = GunWeapon | LaserWeapon | ShellWeapon | RocketWeapon;

/**
 * One tank. The ...Pct values are this tank's difference from the common
 * value, in percent (-50 to +50; 0 = the common value, +20 = 20% more).
 */
export interface TankTuning {
  massPct: number;
  thrustPct: number;
  burstPct: number;
  topSpeedPct: number;
  /** Higher = grips harder (sideways sliding fades faster). */
  tractionPct: number;
  /** Higher = slows down faster on its own. */
  dragPct: number;
  hullTurnPct: number;
  turretTurnPct: number;
  /** Bumps from this tank push the other tank this much harder. */
  bumpPct: number;
  /** How much of the ice the camera shows when you drive this tank. +20 = 20% more overview. */
  viewPct: number;
  weapon: Weapon;
}

const TANKS: Record<TankModel, TankTuning> = {
  /** Agile: light, fast and slippery. Dual barrels, rapid small homing shots. */
  modelA: {
    massPct: -10,
    thrustPct: 4,
    burstPct: 17,
    topSpeedPct: 2,
    tractionPct: 5,
    dragPct: 5,
    hullTurnPct: 20,
    turretTurnPct: -10,
    bumpPct: -5,
    viewPct: 0,
    weapon: {
      kind: 'gun',
      range: 12.6,
      timeBetweenShots: 0.4,
      projectileSpeed: 18,
      push: 15.6,
      pushPerMetre: -2.5,
      pushChangeStops: 12.6,
      maxDistance: 29,
      homingTurn: 740,
      projectileRadius: 0.22,
      recoil: 0.33,
      barrels: 2,
      pellets: 1,
      spreadDeg: 0,
    },
  },
  /** Heavy: heavy and grippy. One slightly bigger barrel, slow shots with a big push. */
  modelB: {
    massPct: 20,
    thrustPct: 4,
    burstPct: 0,
    topSpeedPct: -4,
    tractionPct: 25,
    dragPct: -10,
    hullTurnPct: -10,
    turretTurnPct: -20,
    bumpPct: 10,
    viewPct: 0,
    weapon: {
      kind: 'gun',
      range: 15.4,
      timeBetweenShots: 1.3,
      projectileSpeed: 16,
      push: 20.8,
      pushPerMetre: -2.1,
      pushChangeStops: 15.4,
      maxDistance: 34,
      homingTurn: 740,
      projectileRadius: 0.28,
      recoil: 0.33,
      barrels: 1,
      pellets: 1,
      spreadDeg: 0,
    },
  },
  /** Stealth: machine gun with tiny shots, a very high fire rate and little push. */
  modelC: {
    massPct: -10,
    thrustPct: 8,
    burstPct: 0,
    topSpeedPct: 10,
    tractionPct: -5,
    dragPct: 0,
    hullTurnPct: 10,
    turretTurnPct: 20,
    bumpPct: 0,
    viewPct: 0,
    weapon: {
      kind: 'gun',
      range: 11.9,
      timeBetweenShots: 0.14,
      projectileSpeed: 19,
      push: 7.3,
      pushPerMetre: -2.7,
      pushChangeStops: 11.9,
      maxDistance: 28,
      homingTurn: 740,
      projectileRadius: 0.16,
      recoil: 0,
      barrels: 1,
      pellets: 1,
      spreadDeg: 0,
    },
  },
  /** Laser: a laser turret instead of a gun; the beam pushes the tank it is on away steadily. */
  modelD: {
    massPct: -10,
    thrustPct: 15,
    burstPct: 34,
    topSpeedPct: 8,
    tractionPct: -5,
    dragPct: -10,
    hullTurnPct: 0,
    turretTurnPct: 10,
    bumpPct: -5,
    viewPct: 0,
    weapon: {
      kind: 'laser',
      range: 7,
      push: 9.2,
      beamSeconds: 3.5,
      beamPauseSeconds: 1.5,
      beamCreditSeconds: 0.3,
      focusStart: 0.9,
      focusEnd: 1.95,
      focusSeconds: 0.8,
    },
  },
  /** Shotgun: a cone of pellets that fly straight. Short range, big push when most pellets hit, slow to reload. */
  modelE: {
    massPct: -10,
    thrustPct: 10,
    burstPct: 0,
    topSpeedPct: 8,
    tractionPct: -5,
    dragPct: -5,
    hullTurnPct: -10,
    turretTurnPct: -10,
    bumpPct: 0,
    viewPct: 0,
    weapon: {
      kind: 'gun',
      range: 9.8,
      timeBetweenShots: 2.25,
      projectileSpeed: 34,
      push: 7.3,
      pushPerMetre: -3.3,
      pushChangeStops: 9.8,
      maxDistance: 12.5,
      homingTurn: 0,
      projectileRadius: 0.12,
      recoil: 0,
      barrels: 1,
      pellets: 5,
      spreadDeg: 18,
    },
  },
  /** Artillery: shells fly high to where the target will be and push every tank in a small blast. Longest range, with a minimum range. */
  modelF: {
    massPct: 15,
    thrustPct: 4,
    burstPct: 0,
    topSpeedPct: 2,
    tractionPct: 10,
    dragPct: -5,
    hullTurnPct: -5,
    turretTurnPct: -20,
    bumpPct: 0,
    viewPct: 20,
    weapon: {
      kind: 'shell',
      range: 25.2,
      minRange: 4.5,
      timeBetweenShots: 1.9,
      projectileSpeed: 34,
      push: 15,
      blastRadius: 2.8,
      aimShort: 0.5,
      projectileRadius: 0.2,
      recoil: 2,
    },
  },
  /** Rocket: a rocket-launcher truck firing bursts of small homing rockets that push harder the farther they fly. */
  modelG: {
    massPct: -10,
    thrustPct: 0,
    burstPct: 0,
    topSpeedPct: 5,
    tractionPct: 0,
    dragPct: 10,
    hullTurnPct: 5,
    turretTurnPct: -10,
    bumpPct: -5,
    viewPct: 5,
    weapon: {
      kind: 'rocket',
      range: 15.4,
      timeBetweenShots: 1.5,
      salvo: 2,
      salvoGap: 0.15,
      push: 12,
      pushPerMetre: 2.6,
      pushChangeStops: 26,
      projectileRadius: 0.22,
      startSpeed: 14,
      topSpeed: 26,
      acceleration: 30,
      curveTurn: 310,
      curveDoneDeg: 12,
      lateTurn: 80,
    },
  },
};

export const DEFAULT_TUNING = {
  arena: {
    /** Radius of the playing field. A tank whose centre passes this is eliminated. */
    radius: 28,
    /** Width of the dark blue border along the edge. It is part of the playing field. Visual only. */
    borderWidth: 0.8,
    /** Thickness of the arena slab, seen at the edge. Visual only. */
    iceThickness: 0.5,
    /** Sumo: the ice shrinks late in a match, so standoffs can't last. */
    shrinkEnabled: true,
    /** Sumo: seconds of play before the ice starts shrinking. */
    shrinkStartSeconds: 200,
    /** Sumo: seconds the shrinking takes, from full size to the smallest size. */
    shrinkSeconds: 240,
    /** Sumo: smallest size, as a share of the full radius. */
    shrinkMinShare: 0.75,
  },

  /** Common values for all tanks. Each tank adds its own percentage (tanks.<model>.<name>Pct). */
  common: {
    /** Common mass in tonnes. Heavier = harder to push by hits and bumps (pushes are set for a 30 t tank). Acceleration stays as Thrust sets it. */
    mass: 30,
    /** Acceleration while a click's burst pushes (m/s²), for a tank with the common mass and thrust. */
    thrust: 58,
    /** How long one click's push lasts (s). */
    burst: 0.3,
    /** A tank's own thrust can't push it faster than this (m/s). Bumps can. */
    topSpeed: 9,
    /** Traction: share of sideways sliding that fades per second (%). Low = drifting. */
    traction: 39.3,
    /** Drag: share of speed lost per second on the ice (%). Very low, so tanks keep sliding. */
    drag: 5.8,
    /** How fast the hull turns toward a clicked point (degrees per second). */
    hullTurn: 620,
    /** How fast the turret turns toward the closest enemy (degrees per second). */
    turretTurn: 780,
    /** Collision size of every tank (radius, m). Not in the panel: the tank models are drawn at this size. */
    radius: 1.15,
  },

  tanks: TANKS,

  physics: {
    /** Hidden dome: outward push at the very edge (m/s²). Zero at the centre. */
    domeStrength: 2,
    /** Hidden dome: how sharply the push grows toward the edge. 1 = evenly, 2+ = mostly near the edge. */
    domeCurve: 1.8,
    /** Bumps: 1 = tanks stop dead on contact, 2 = fully bouncy. Above 2 = extra punchy. */
    bumpBounce: 1.8,
  },

  rules: {
    /** The first player to this many knockouts wins the match. */
    pointsToWin: 10,
    /** Countdown at the start of a match; tanks can only move once it ends. */
    countdownSeconds: 3,
    /** How long the winner is shown before the next match starts (milestone 4 test room). */
    endScreenSeconds: 6,
    /** At most one click counts per this many seconds. */
    clickCooldown: 0.25,
    /** Time from falling off to reappearing. */
    respawnSeconds: 2,
    /** After respawning, a tank can't be pushed (and later: can't fire) for this long. */
    spawnProtectionSeconds: 1,
    /** A knockout counts for the last tank that hit you within this window. */
    creditWindowSeconds: 5,
    /** Respawn spots stay at least this far from the edge... */
    respawnEdgeMargin: 10,
    /** ...and at least this far from other tanks. */
    respawnClearance: 6,
  },

  /** Looks only (no effect on play). */
  visuals: {
    /** Track marks behind tanks fade out over this many seconds. */
    trackMarkSeconds: 2,
    /** How dark fresh track marks are (0 = invisible, 1 = solid). */
    trackMarkOpacity: 0.35,
    /** Extra track speed (m/s) while the engine pushes, so tracks look like they slip on the ice. 0 = tracks only follow the movement. */
    trackSlipSpeed: 2.5,
  },

  camera: {
    /**
     * Tilt away from straight down. 0 = straight down, 90 = looking at the horizon.
     * The requirements ask for "almost straight down with a slight isometric tilt".
     */
    tiltDeg: 22,
    /** Fixed compass direction the camera looks from (rotates the whole view). */
    yawDeg: 45,
    /** Lens angle. Lower = flatter, more map-like look. */
    fovDeg: 40,
    /**
     * In-game view: metres visible across the screen's shorter side. Fixed, so
     * changing the arena size doesn't change the zoom. 30 m is about half the
     * arena's diameter (requirements: ~50%). Each tank adds its viewPct.
     */
    playViewMetres: 30,
    /** Overview: how much of the arena fits on screen. */
    overviewFraction: 1.25,
    /** How quickly the camera glides to its target. Higher = snappier. */
    followSharpness: 10,
  },

  combat: {
    /** Practice toggle: tanks fire automatically (off = pure sumo, no projectiles). */
    firingEnabled: true,
    /** Practice toggle: dummies shoot back at you. */
    dummiesFire: true,
    /** The turret (and a drone) only fires once it points within this angle of its target. */
    fireAlignDeg: 6,
  },

  abilities: {
    /** Agile, Shift: more speed for a short time, so bumps hit harder. */
    boost: { seconds: 1.4, cooldown: 9.5, speedMultiplier: 1.2 },
    /** Heavy, Shift: the next few shots push much harder. */
    powerShot: { shots: 3, cooldown: 9, pushMultiplier: 1.45 },
    /**
     * Stealth, Shift: smoke grenade. Invisible and untargetable for the others
     * for a few seconds; still hittable, and any hit makes it visible again.
     */
    smoke: { seconds: 5, cooldown: 10 },
    /**
     * Laser, Shift: EMP. Disables every other tank within the radius for a few
     * seconds: no steering, pushing, firing, ability or powerups. They keep sliding.
     */
    emp: { radius: 3.5, seconds: 1.25, cooldown: 13 },
    /**
     * Shotgun, Shift then click: throw a grenade at a spot. It lands after a
     * short flight and blasts tanks away from where it lands.
     */
    grenade: { maxThrow: 14, flightSeconds: 0.9, radius: 4, push: 31.7, cooldown: 7 },
    /** Artillery: for a while its shells push harder and burst wider. */
    explosiveShells: { seconds: 5, cooldown: 10, pushMultiplier: 2.4, radiusMultiplier: 1.3 },
    /**
     * Rocket: press Shift, click a spot (up to maxPlace m away) and a drone
     * hovers there for a while, machine-gunning the closest enemy within its
     * range. It never shoots the player who placed it; that player gets the credit.
     */
    drone: { maxPlace: 13, seconds: 7.5, cooldown: 12, range: 8, timeBetweenShots: 0.1, projectileSpeed: 18, homingTurn: 740, push: 2.7, projectileRadius: 0.12 },
  },

  powerups: {
    /** Practice toggle: powerups appear on the ice. */
    enabled: true,
    /** A new powerup appears this often (seconds)... */
    spawnInterval: 3,
    /** ...unless this many are already on the ice. Powerups never disappear on their own. */
    maxOnField: 5,
    /** No powerups in this strip along the edge (metres). */
    edgeStrip: 3,
    /** Pickup size: a tank picks it up when touching this radius. */
    radius: 0.8,
    /** New powerups keep at least this distance from tanks and mines. */
    clearance: 3,
  },

  /** Missile powerup. (The Rocket tank has its own flight values in its weapon block.) */
  missile: {
    /** Only tanks at least this far from you can be picked as a target (m). */
    minTargetDistance: 4,
    /** Speed when launched, during its first curve toward the target (m/s). */
    startSpeed: 14,
    /** Turn rate during the first curve (degrees per second). */
    curveTurnRateDeg: 310,
    /** The first curve ends once it points within this angle of the target. */
    curveDoneDeg: 12,
    /** After the first curve it speeds up to this (m/s)... */
    topSpeed: 26,
    /** ...with this acceleration (m/s²)... */
    acceleration: 30,
    /** ...and turns only this fast, so sharp dodges can make it miss. */
    boostTurnRateDeg: 80,
    /** Push of a hit right after launch, along its direction of travel. */
    push: 24,
    /** The push grows by this % of the launch push per metre flown... */
    pushPerMetre: 2.6,
    /** ...until it has flown this far (m). */
    pushChangeStops: 26,
    /** Size (radius) for hits. */
    radius: 0.35,
  },

  rapidFire: {
    /** How long a rapid-fire powerup lasts once used. Using another restarts it. */
    seconds: 5,
    /** Time between shots is multiplied by this while active (0.5 = half). */
    shotTimeMultiplier: 0.5,
    /** Laser has no gun: rapid fire multiplies its laser push by this instead (2 = twice as hard). */
    laserMultiplier: 2.2,
  },

  /**
   * Airstrike powerup (Sumo only): click a spot, and after a short delay a
   * stealth bomber drops bombs on a line through it, at right angles to the
   * line from the arena's middle to that spot. The bombs push like an
   * Artillery explosive shell (15 × 2.4 push, 3 m × 1.3 blast), and also push
   * the player who called it.
   */
  airstrike: {
    /** How often it appears compared with each other powerup (1 = as often; 0.4 = 40% as often). */
    spawnWeight: 0.4,
    /** Seconds from the click to the first bomb going off. */
    delaySeconds: 2,
    /** Number of bombs along the line. */
    bombs: 3,
    /** Distance between neighbouring bombs (m). */
    spacing: 4,
    /** Seconds between neighbouring bombs going off (the bomber flies from one to the next). */
    bombGapSeconds: 0.15,
    /** Blast radius of each bomb (m). */
    radius: 3.9,
    /** Push at the centre of each blast; 40% of this at its edge. */
    push: 36,
  },

  /**
   * Tesla coil powerup: dropped where your tank is, it floats there for a few
   * seconds and electrifies every enemy within range (never the one who
   * placed it). Electrified tanks lose top speed and traction, and it lingers
   * a moment after they leave the range or the coil is gone.
   */
  teslaCoil: {
    /** How often it appears compared with each other powerup (1 = as often). */
    spawnWeight: 1,
    /** Seconds it stays on the field. */
    seconds: 6,
    /** Enemies whose centre is within this distance are electrified (m). */
    range: 6,
    /** The effect lasts this long after a tank leaves the range (s). */
    lingerSeconds: 1.75,
    /** Electrified tanks keep this share of their top speed... */
    topSpeedShare: 0.55,
    /** ...and this share of their traction (lower = slides more). */
    tractionShare: 0.4,
  },

  mine: {
    /** Seconds after dropping before it goes live. */
    armSeconds: 1,
    /** An untouched mine disappears after this long. */
    lifeSeconds: 30,
    /** Size of the mine itself (drawing). */
    radius: 0.5,
    /** A live mine goes off when a tank's centre comes this close (m): a tank has to drive over it. */
    triggerRange: 2.5,
    /** Tanks within this distance of the blast are pushed. */
    blastRadius: 6,
    /** Push at the centre of the blast. Falls to 40% at the blast's edge. */
    push: 43.3,
  },

  /** Practice dummies: how they try to stay on the ice. */
  dummies: {
    /** Practice toggle: dummies steer to stay on the ice and use abilities. Off = they just slide. */
    smart: true,
    /** One simulated click per this many seconds, at most. */
    clickInterval: 0.3,
    /** Sumo: while safe from the edge they click toward the closest tank at most this often (half as often as clickInterval). */
    chaseClickInterval: 0.6,
    /**
     * 0 to 1. Chance that a dummy reacts at each decision, and how accurate its
     * recovery click is (low skill = up to 60° off). 1 = reacts perfectly every time.
     */
    skill: 0.9,
    /** They feel safe inside this share of the arena radius. */
    safeZone: 0.6,
    /** How far ahead (seconds) they look when judging where their slide takes them. */
    lookAhead: 1.5,
    /** Speed (m/s) they aim for when heading back toward the middle. */
    returnSpeed: 4,
    /**
     * Sumo: dummies play to their class while safe from the edge. Agile goes for
     * powerups; Heavy, Artillery and Rocket keep their distance; Stealth, Laser and
     * Shotgun chase. Off = all of them just chase the closest tank.
     */
    roles: true,
    /** Sumo: with a free slot, a dummy drives to a powerup within this distance (m). */
    powerupReach: 10,
    /** Sumo: Agile's reach for powerups (m); it uses its speed to collect them. */
    agilePowerupReach: 40,
    /** Sumo: Heavy and Rocket slip sideways past a tank nearer than this share of their range. */
    keepDistance: 0.4,
    /** Sumo: chasers aim at where their target will be this many seconds from now. */
    chaseLead: 0.4,
    /** Sumo: Artillery dummies slip sideways past a tank that comes within its minimum range plus this (m). */
    artilleryMargin: 1.5,
    /** Sumo: while shooting, Heavy, Artillery and Rocket dummies move back toward the middle when farther out than this share of the arena radius. */
    homeZone: 0.3,
    /** Sumo: chasers first get this far (m) to the inside of their target (between it and the middle), so their hits push it outward. */
    flankDistance: 3,
    /** Sumo: a chaser counts as inside its target when it is at least this much (m) nearer the middle. */
    insideMargin: 1,
    /** Sumo: Laser dummies hold their target at this share of the laser's range, from the inside (0 = they ram it, which works better). */
    laserStandoff: 0,
    /** Sumo: Agile dummies also use their boost to ram a tank near the edge from the inside. */
    agileRamBoost: true,
  },

  upgrades: {
    /** Points to spend on the five properties (start screen, practice menu). */
    points: 3,
    /** At most this many points in one attribute. */
    maxPerAttribute: 3,
    /** Each point adds this percentage on top of the model's base value. */
    percentPerPoint: 3,
  },

  race: {
    /** First tank to drive this many laps wins. */
    laps: 5,
    /** Length of a lap along the middle of the track (m). Every new track is about this long. */
    trackLength: 420,
    /** Width of the track (m). */
    trackWidth: 14,
    /** Most dummies in a race (6 tanks in all). Sumo stays at 3 (4 tanks). */
    maxDummies: 5,
    /** Race dummies click this often (seconds); they need to keep pushing to race. */
    dummyClickInterval: 0.3,
    /** Race dummies click on the middle line this far ahead (m), about one firing range, to anticipate bends. */
    dummyLookAhead: 14,
    /** Catch-up: the race leader loses this share of top speed and traction (0.1 = 10%). */
    leaderPenalty: 0.1,
    /** Catch-up: second place loses this share of top speed and traction. */
    secondPenalty: 0.04,
    /** Catch-up with 4 or more tanks: the last tank gains this share of top speed and traction. */
    lastBonus: 0.14,
    /** Catch-up with 4 or more tanks: second to last gains this share. */
    secondLastBonus: 0.08,
    /**
     * In a race, hits don't push: they slow the tank that is hit. Each point
     * of the hit's Sumo push takes this share of its speed (0.009 = 0.9%), so a
     * Heavy shot (push about 17 at range) slows about 15% and a Stealth bullet 5%.
     * Applies to shots, rockets, shells, grenades, the laser, missiles and
     * mines; bumps between tanks still push as usual.
     */
    hitSlowPerPush: 0.009,
    /** Mines (dropped and hazard) still push in a race, at this share of their Sumo push (0.5 = half). */
    minePushShare: 0.5,
    /** The missile powerup still pushes in a race, at this share of its Sumo push (Rocket tank rockets slow instead). */
    missilePushShare: 0.5,
    /** At most this share of a tank's speed is taken by hits in one moment (0.15 = 15%). */
    maxHitSlow: 0.08,
    /** Traction in a race as a share of the normal (Sumo) traction: below 1 = more slippery racing. */
    tractionShare: 1.1,
    /** Most powerups (and hazard mines) on the track at once. */
    powerupsOnField: 8,
    /** Powerups and hazard mines appear this far ahead of the race leader, along the track (m). */
    spawnAheadMin: 25,
    spawnAheadMax: 90,
    /** Chance that a powerup spawn is a live hazard mine instead (nobody's; it pushes whoever touches it). */
    hazardMineChance: 0.3,
    /** Hazard mines lie within this share of the track's half-width from the middle (0.35 = the middle third or so). */
    hazardMiddleShare: 0.35,
    /** Pickups lie at least this share of the half-width away from the middle (toward the edges). */
    pickupEdgeShare: 0.55,
    /** Countdown before the start (seconds). */
    countdownSeconds: 3,
  },

  simulation: {
    /** Fixed physics steps per second (execution plan: 60). */
    stepsPerSecond: 60,
    /** How often the server sends positions to players (execution plan: ~20). */
    serverSendsPerSecond: 20,
    /** Browsers draw other tanks this far in the past (seconds), blending between updates. */
    interpolationDelay: 0.1,
    /** Players in one room. */
    maxPlayers: 4,
  },
};

export type Tuning = typeof DEFAULT_TUNING;

/** Pushes are the speed change (m/s) they give a tank of this mass (tonnes). */
export const PUSH_REFERENCE_TONNES = 30;

/** A ...Pct value as a factor: +20 → 1.2, -10 → 0.9. */
export function share(pct: number): number {
  return 1 + pct / 100;
}

/** A "% lost per second" value as the decay rate the physics uses (per second). */
export function lossRate(percentPerSecond: number): number {
  return -Math.log(1 - Math.min(99.9, Math.max(0, percentPerSecond)) / 100);
}

/**
 * A tank's movement values before upgrades and effects: the common value
 * times its share, in the units the physics uses.
 */
export interface TankBase {
  /** Mass relative to PUSH_REFERENCE_TONNES (1 = a 30 t tank), as the physics uses it. */
  mass: number;
  /** Force of a burst (acceleration × mass). */
  thrust: number;
  burst: number;
  topSpeed: number;
  /** Decay rate of sideways sliding (per second). */
  sideGrip: number;
  /** Decay rate of speed (per second). */
  drag: number;
  /** Degrees per second. */
  hullTurn: number;
  turretTurn: number;
  bump: number;
  view: number;
}

export function tankBase(tuning: Tuning, model: TankModel): TankBase {
  const C = tuning.common;
  const t = tuning.tanks[model];
  return {
    mass: (C.mass / PUSH_REFERENCE_TONNES) * share(t.massPct),
    thrust: C.thrust * (C.mass / PUSH_REFERENCE_TONNES) * share(t.thrustPct),
    burst: C.burst * share(t.burstPct),
    topSpeed: C.topSpeed * share(t.topSpeedPct),
    sideGrip: lossRate(C.traction) * share(t.tractionPct),
    drag: lossRate(C.drag) * share(t.dragPct),
    hullTurn: C.hullTurn * share(t.hullTurnPct),
    turretTurn: C.turretTurn * share(t.turretTurnPct),
    bump: share(t.bumpPct),
    view: share(t.viewPct),
  };
}

/** Push share after flying `distance` m: 1 at launch, changing by pushPerMetre % per metre until pushChangeStops. */
export function pushOverDistance(w: { pushPerMetre: number; pushChangeStops: number }, distance: number): number {
  return Math.max(0, 1 + (w.pushPerMetre / 100) * Math.min(distance, w.pushChangeStops));
}

/** Artillery's minimum range (0 for every other weapon). */
export function minRangeOf(tuning: Tuning, model: TankModel): number {
  const w = tuning.tanks[model].weapon;
  return w.kind === 'shell' ? w.minRange : 0;
}

/** Size of this model's projectiles (radius, m; 0 for the laser). */
export function projectileRadiusOf(tuning: Tuning, model: TankModel): number {
  const w = tuning.tanks[model].weapon;
  return w.kind === 'laser' ? 0 : w.projectileRadius;
}

/** A fresh, editable copy of the defaults (the slider panel changes this copy). */
export function createTuning(): Tuning {
  return JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
}
