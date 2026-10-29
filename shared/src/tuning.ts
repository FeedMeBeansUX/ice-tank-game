/**
 * ALL TUNING VALUES LIVE HERE.
 *
 * This is the single place for numbers that change how the game looks or
 * feels. The browser and (from milestone 4) the game server both read this
 * file, so practice mode and online matches always use the same values.
 *
 * When Robbert pastes slider values from the in-game panel, they become the
 * new defaults in this file. Last update: 28 Oct 2026 (milestone 3 playtest).
 *
 * Units: distances in metres, speeds in m/s, forces in "newtons" for a game
 * where Model A weighs 1, time in seconds, angles in degrees.
 */
export const DEFAULT_TUNING = {
  arena: {
    /** Radius of the playing field. A tank whose centre passes this is eliminated. */
    radius: 27,
    /** Width of the dark blue border along the edge. It is part of the playing field. Visual only. */
    borderWidth: 0.8,
    /** Thickness of the arena slab, seen at the edge. Visual only. */
    iceThickness: 0.5,
  },

  tanks: {
    /** Model A · agile: light, fast and slippery. Dual barrels, rapid small shots. */
    modelA: {
      /** Collision radius (size of the tank). */
      radius: 1.15,
      /** Resistance to bumps and hits. Heavier tanks are pushed less. */
      mass: 1,
      /** Force of the thrust burst given on each click. */
      thrust: 24,
      /** How long one click's thrust burst lasts. */
      burstSeconds: 0.3,
      /** The tank's own thrust can't push it faster than this. Bumps can. */
      topSpeed: 11,
      /** Traction: how fast sideways sliding fades, per second. Low = drifting. */
      sideGrip: 0.9,
      /** Seconds between automatic shots. */
      timeBetweenShots: 0.4,
      /** Projectile flight speed (m/s). Constant; a bit slower than the homing missile. */
      projectileSpeed: 16,
      /** Push a hit gives: the target's speed changes by this divided by its mass. */
      projectileImpact: 2.5,
      /** Projectile size (radius). */
      projectileRadius: 0.22,
      /** Push backward on the shooter for each shot. */
      recoil: 0,
      /** Barrels on the turret. Two barrels fire in turns: left, right, left, right. 0 = no gun. */
      barrels: 2,
      /** Bumps from this tank push the other tank this many times harder. */
      bumpMultiplier: 1,
      /** Ready for health modes. Sumo doesn't use it. */
      projectileDamage: 5,
    },
    /** Model B · heavy: heavy and grippy. One slightly bigger barrel, slow shots with a big push. */
    modelB: {
      radius: 1.15,
      mass: 2.2,
      thrust: 40,
      burstSeconds: 0.3,
      topSpeed: 9,
      sideGrip: 3.5,
      timeBetweenShots: 1.5,
      projectileSpeed: 12,
      projectileImpact: 9,
      projectileRadius: 0.28,
      recoil: 0,
      barrels: 1,
      bumpMultiplier: 1,
      projectileDamage: 15,
    },
    /** Stealth: medium weight. Machine gun: tiny shots, very high fire rate, little push. */
    modelC: {
      radius: 1.15,
      mass: 1.4,
      thrust: 30,
      burstSeconds: 0.3,
      topSpeed: 10,
      sideGrip: 1.8,
      timeBetweenShots: 0.15,
      projectileSpeed: 18,
      projectileImpact: 0.8,
      projectileRadius: 0.16,
      recoil: 0,
      barrels: 1,
      bumpMultiplier: 1,
      projectileDamage: 2,
    },
    /** Bash: round frame with a buzz-saw edge. No gun; its bumps hit much harder. */
    modelD: {
      radius: 1.15,
      mass: 1.6,
      thrust: 32,
      burstSeconds: 0.3,
      topSpeed: 10.5,
      sideGrip: 2,
      timeBetweenShots: 1,
      projectileSpeed: 0,
      projectileImpact: 0,
      projectileRadius: 0,
      recoil: 0,
      barrels: 0,
      bumpMultiplier: 1.8,
      projectileDamage: 0,
    },
  },

  physics: {
    /** Slowdown on the ice, per second. Very low, so tanks keep sliding. */
    drag: 0.01,
    /** How fast the hull turns toward a clicked point. Same for all tanks. */
    hullTurnRateDeg: 720,
    /** How fast the turret turns toward the closest enemy. Same for all tanks. */
    turretTurnRateDeg: 880,
    /** Hidden dome: outward push at the very edge (m/s²). Zero at the centre. */
    domeStrength: 1.5,
    /** Hidden dome: how sharply the push grows toward the edge. 1 = evenly, 2+ = mostly near the edge. */
    domeCurve: 1.5,
    /** Bumps: 1 = tanks stop dead on contact, 2 = fully bouncy. Above 2 = extra punchy. */
    bumpBounce: 1.25,
  },

  rules: {
    /** The first player to this many knockouts wins the match. */
    pointsToWin: 5,
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
    creditWindowSeconds: 9,
    /** Respawn spots stay at least this far from the edge... */
    respawnEdgeMargin: 10,
    /** ...and at least this far from other tanks. */
    respawnClearance: 6,
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
     * arena's diameter (requirements: ~50%).
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
    dummiesFire: false,
    /** Tanks only fire when the closest enemy is within this distance. Same for both models. */
    rangeMetres: 14,
    /** How fast a homing projectile turns toward its target. High = near-perfect tracking. */
    homingTurnRateDeg: 720,
    /** The turret only fires once it points within this angle of its target. */
    fireAlignDeg: 6,
  },

  abilities: {
    /** Model A, Shift: more speed for a short time, so bumps hit harder. */
    boost: { seconds: 2, cooldown: 8, speedMultiplier: 1.6 },
    /** Model B, Shift: the next few shots push much harder. */
    powerShot: { shots: 3, cooldown: 10, impactMultiplier: 2 },
    /**
     * Stealth, Shift: smoke grenade. Invisible and untargetable for the others
     * for a few seconds; still hittable, and any hit makes it visible again.
     */
    smoke: { seconds: 3, cooldown: 10 },
    /**
     * Bash, Shift: EMP. Disables every other tank within the radius for a few
     * seconds: no steering, pushing, firing, ability or powerups. They keep sliding.
     */
    emp: { radius: 6, seconds: 2.5, cooldown: 12 },
  },

  powerups: {
    /** Practice toggle: powerups appear on the ice. */
    enabled: true,
    /** A new powerup appears this often (seconds)... */
    spawnInterval: 3,
    /** ...unless this many are already on the ice. Powerups never disappear on their own. */
    maxOnField: 3,
    /** No powerups in this strip along the edge (metres). */
    edgeStrip: 3,
    /** Pickup size: a tank picks it up when touching this radius. */
    radius: 0.8,
    /** New powerups keep at least this distance from tanks and mines. */
    clearance: 3,
  },

  missile: {
    /** Only tanks at least this far from you can be picked as a target (m). */
    minTargetDistance: 8,
    /** Speed when launched, during its first curve toward the target (m/s). */
    startSpeed: 14,
    /** Turn rate during the first curve (degrees per second). */
    curveTurnRateDeg: 260,
    /** The first curve ends once it points within this angle of the target. */
    curveDoneDeg: 12,
    /** After the first curve it speeds up to this (m/s)... */
    topSpeed: 26,
    /** ...with this acceleration (m/s²)... */
    acceleration: 30,
    /** ...and turns only this fast, so sharp dodges can make it miss. */
    boostTurnRateDeg: 60,
    /** Push on a hit, along its direction of travel (divided by the target's mass). */
    impact: 16,
    /** Size (radius) for hits. */
    radius: 0.35,
    /** Ready for health modes. Sumo doesn't use it. */
    damage: 35,
  },

  rapidFire: {
    /** How long a rapid-fire powerup lasts once used. Using another restarts it. */
    seconds: 5,
    /** Time between shots is multiplied by this while active (0.5 = half). */
    shotTimeMultiplier: 0.5,
    /**
     * Bash has no gun: rapid fire gives it a series of small EMP pulses instead,
     * each with a smaller radius and a shorter effect than its normal EMP.
     */
    bashPulses: { count: 3, interval: 1, radius: 4, seconds: 1.2 },
  },

  mine: {
    /** Seconds after dropping before it goes live. */
    armSeconds: 1,
    /** An untouched mine disappears after this long. */
    lifeSeconds: 30,
    /** Size of the mine itself; touching it sets it off. */
    radius: 0.5,
    /** Tanks within this distance of the blast are pushed. */
    blastRadius: 6,
    /** Push at the centre of the blast (divided by mass). Falls to 40% at the blast's edge. */
    impact: 30,
    /** Ready for health modes. Sumo doesn't use it. */
    damage: 40,
  },

  /** Practice dummies: how they try to stay on the ice. */
  dummies: {
    /** Practice toggle: dummies steer to stay on the ice and use abilities. Off = they just slide. */
    smart: true,
    /** One simulated click per this many seconds, at most. */
    clickInterval: 0.5,
    /**
     * 0 to 1. Chance that a dummy reacts at each decision, and how accurate its
     * recovery click is (low skill = up to 60° off). 1 = reacts perfectly every time.
     */
    skill: 0.5,
    /** They feel safe inside this share of the arena radius. */
    safeZone: 0.6,
    /** How far ahead (seconds) they look when judging where their slide takes them. */
    lookAhead: 1.5,
    /** Speed (m/s) they aim for when heading back toward the middle. */
    returnSpeed: 4,
  },

  upgrades: {
    /** Points to spend in the lobby (here: practice menu). */
    points: 5,
    /** At most this many points in one attribute. */
    maxPerAttribute: 3,
    /** Each point adds this percentage on top of the model's base value. */
    percentPerPoint: 10,
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
export type TankModel = keyof Tuning['tanks'];
export type ModelStats = Tuning['tanks']['modelA'];

/** A fresh, editable copy of the defaults (the slider panel changes this copy). */
export function createTuning(): Tuning {
  return JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
}
