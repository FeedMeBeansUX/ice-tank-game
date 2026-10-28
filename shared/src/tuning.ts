/**
 * ALL TUNING VALUES LIVE HERE.
 *
 * This is the single place for numbers that change how the game looks or
 * feels. The browser and (from milestone 4) the game server both read this
 * file, so practice mode and online matches always use the same values.
 *
 * When Robbert pastes slider values from the in-game panel (milestone 1+),
 * they become the new defaults in this file.
 *
 * Units: distances in metres (1 unit = 1 m), time in seconds, angles in degrees.
 */
export const TUNING = {
  arena: {
    /** Radius of the playable ice. A tank whose centre passes this is eliminated. */
    radius: 30,
    /** Width of the dark blue border along the edge. It is part of the playing field. Visual only. */
    borderWidth: 0.8,
    /** Thickness of the arena slab, seen at the edge. Visual only. */
    iceThickness: 0.5,
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
    /** Overview (milestone 0 only): how much of the arena fits on screen. */
    overviewFraction: 1.25,
    /** How quickly the camera glides to its target. Higher = snappier. */
    followSharpness: 6,
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
} as const;

export type Tuning = typeof TUNING;
