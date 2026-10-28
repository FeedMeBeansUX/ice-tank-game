/**
 * ALL TUNING VALUES LIVE HERE.
 *
 * This is the single place for numbers that change how the game looks or
 * feels. The browser and (from milestone 4) the game server both read this
 * file, so practice mode and online matches always use the same values.
 *
 * When Robbert pastes slider values from the in-game panel, they become the
 * new defaults in this file.
 *
 * Units: distances in metres, speeds in m/s, forces in "newtons" for a game
 * where Model A weighs 1, time in seconds, angles in degrees.
 */
export const DEFAULT_TUNING = {
  arena: {
    /** Radius of the playing field. A tank whose centre passes this is eliminated. */
    radius: 30,
    /** Width of the dark blue border along the edge. It is part of the playing field. Visual only. */
    borderWidth: 0.8,
    /** Thickness of the arena slab, seen at the edge. Visual only. */
    iceThickness: 0.5,
  },

  tanks: {
    modelA: {
      /** Collision radius (size of the tank). */
      radius: 1.1,
      /** Resistance to bumps and hits. Heavier tanks are pushed less. */
      mass: 1,
      /** Force of the thrust burst given on each click. */
      thrust: 24,
      /** How long one click's thrust burst lasts. */
      burstSeconds: 0.3,
      /** The tank's own thrust can't push it faster than this. Bumps can. */
      topSpeed: 11,
      /** Traction: how fast sideways sliding fades, per second. Low = drifting. */
      sideGrip: 1.2,
    },
  },

  physics: {
    /** Slowdown on the ice, per second. Very low, so tanks keep sliding. */
    drag: 0.12,
    /** How fast the hull turns toward a clicked point. Same for all tanks. */
    hullTurnRateDeg: 720,
    /** How fast the turret turns toward the closest enemy. Same for all tanks. */
    turretTurnRateDeg: 540,
    /** Hidden dome: outward push at the very edge (m/s²). Zero at the centre. */
    domeStrength: 1,
    /** Hidden dome: how sharply the push grows toward the edge. 1 = evenly, 2+ = mostly near the edge. */
    domeCurve: 2,
    /** Bumps: 1 = tanks stop dead on contact, 2 = fully bouncy. Above 2 = extra punchy. */
    bumpBounce: 1.6,
  },

  rules: {
    /** At most one click counts per this many seconds. */
    clickCooldown: 0.25,
    /** Time from falling off to reappearing. */
    respawnSeconds: 2,
    /** After respawning, a tank can't be pushed (and later: can't fire) for this long. */
    spawnProtectionSeconds: 1,
    /** A knockout counts for the last tank that hit you within this window. */
    creditWindowSeconds: 3,
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
    /** In-game view: visible width as a share of the arena's diameter (requirements: ~50%). */
    playViewFraction: 0.5,
    /** Overview: how much of the arena fits on screen. */
    overviewFraction: 1.25,
    /** How quickly the camera glides to its target. Higher = snappier. */
    followSharpness: 10,
  },

  /** Used from milestone 2. Tanks fire by themselves at the closest enemy within range. */
  combat: {
    /** Tanks only fire when the closest enemy is within this distance. Same for both models. */
    rangeMetres: 14,
    /** Seconds between automatic shots, per tank model. No magazine, no reloading. */
    timeBetweenShots: {
      modelA: 0.4,
      modelB: 1.5,
    },
  },

  simulation: {
    /** Fixed physics steps per second (execution plan: 60). */
    stepsPerSecond: 60,
    /** How often the server sends positions to players (execution plan: ~20). */
    serverSendsPerSecond: 20,
  },
};

export type Tuning = typeof DEFAULT_TUNING;
export type TankModel = keyof Tuning['tanks'];

/** A fresh, editable copy of the defaults (the slider panel changes this copy). */
export function createTuning(): Tuning {
  return JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
}
