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

  tanks: {
    /** Model A · agile: light, fast and slippery. Dual barrels, rapid small shots. */
    modelA: {
      /** Collision radius (size of the tank). */
      radius: 1.15,
      /** Resistance to bumps and hits. Heavier tanks are pushed less. */
      /** Share of the common mass (Ice and arena group). */
      massShare: 0.9,
      /** Force of the thrust burst given on each click. */
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.04,
      /** How long one click's thrust burst lasts. */
      burstSeconds: 0.35,
      /** The tank's own thrust can't push it faster than this. Bumps can. */
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1.02,
      /** Traction: how fast sideways sliding fades, per second. Low = drifting. */
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 1.05,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 1.05,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 0.9,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 1.2,
      /** Seconds between automatic shots. */
      timeBetweenShots: 0.4,
      /** Projectile flight speed (m/s). Constant; a bit slower than the homing missile. */
      projectileSpeed: 18,
      /** Push a hit gives: the target's speed changes by this divided by its mass. */
      projectileImpact: 7.5,
      /** Projectile size (radius). */
      projectileRadius: 0.22,
      /** Push backward on the shooter for each shot. */
      recoil: 0.2,
      /** Barrels on the turret. Two barrels fire in turns: left, right, left, right. 0 = no gun. */
      barrels: 2,
      /** Bumps from this tank push the other tank this many times harder. */
      bumpMultiplier: 0.95,
      /** Firing range as a share of the common range (combat.rangeMetres). */
      rangeMultiplier: 0.9,
      /** Projectiles per shot. More than 1 fires a spread (shotgun pellets). */
      pellets: 1,
      /** Width of the spread when firing several pellets (degrees). */
      spreadDeg: 0,
      /** 1 = shots home in on their target; 0 = they fly straight. */
      homing: 1,
      /** Shots vanish after flying this far (m). 0 = until they leave the arena. */
      projectileMaxRange: 29,
      /** Laser turret: steady push per second on the tank the beam is on (divided by its mass). 0 = no laser. */
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      /** Ready for health modes. Sumo doesn't use it. */
      projectileDamage: 5,
      /** Artillery only: no shots at tanks closer than this (m). */
      minRange: 0,
      /** 1 = shells are lobbed to where the target was and burst on landing (Artillery). */
      lobbed: 0,
      /** Lobbed shells: tanks within this distance of the landing spot are pushed (m). */
      blastRadius: 0,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1,
    },
    /** Model B · heavy: heavy and grippy. One slightly bigger barrel, slow shots with a big push. */
    modelB: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 1.2,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.04,
      burstSeconds: 0.3,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 0.96,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 1.25,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 0.9,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 0.8,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 0.9,
      timeBetweenShots: 1.3,
      projectileSpeed: 16,
      projectileImpact: 10,
      projectileRadius: 0.28,
      recoil: 0.2,
      barrels: 1,
      bumpMultiplier: 1.1,
      /** Firing range as a share of the common range (combat.rangeMetres). */
      rangeMultiplier: 1.1,
      /** Projectiles per shot. More than 1 fires a spread (shotgun pellets). */
      pellets: 1,
      /** Width of the spread when firing several pellets (degrees). */
      spreadDeg: 0,
      /** 1 = shots home in on their target; 0 = they fly straight. */
      homing: 1,
      /** Shots vanish after flying this far (m). 0 = until they leave the arena. */
      projectileMaxRange: 34,
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      projectileDamage: 15,
      /** Artillery only: no shots at tanks closer than this (m). */
      minRange: 0,
      /** 1 = shells are lobbed to where the target was and burst on landing (Artillery). */
      lobbed: 0,
      /** Lobbed shells: tanks within this distance of the landing spot are pushed (m). */
      blastRadius: 0,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1,
    },
    /** Stealth: medium weight. Machine gun: tiny shots, very high fire rate, little push. */
    modelC: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 0.9,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.08,
      burstSeconds: 0.3,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1.1,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 0.95,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 1,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 1.2,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 1.1,
      timeBetweenShots: 0.1,
      projectileSpeed: 19,
      projectileImpact: 3.5,
      projectileRadius: 0.16,
      recoil: 0,
      barrels: 1,
      bumpMultiplier: 1,
      /** Firing range as a share of the common range (combat.rangeMetres). */
      rangeMultiplier: 0.85,
      /** Projectiles per shot. More than 1 fires a spread (shotgun pellets). */
      pellets: 1,
      /** Width of the spread when firing several pellets (degrees). */
      spreadDeg: 0,
      /** 1 = shots home in on their target; 0 = they fly straight. */
      homing: 1,
      /** Shots vanish after flying this far (m). 0 = until they leave the arena. */
      projectileMaxRange: 28,
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      projectileDamage: 2,
      /** Artillery only: no shots at tanks closer than this (m). */
      minRange: 0,
      /** 1 = shells are lobbed to where the target was and burst on landing (Artillery). */
      lobbed: 0,
      /** Lobbed shells: tanks within this distance of the landing spot are pushed (m). */
      blastRadius: 0,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1,
    },
    /**
     * Laser: rounded front and back, straight sides. A laser turret instead of a
     * gun: while the beam is on a tank it pushes that tank away steadily.
     */
    modelD: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 0.9,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.15,
      burstSeconds: 0.4,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1.08,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 0.95,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 0.9,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 1.1,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 1,
      timeBetweenShots: 1,
      projectileSpeed: 0,
      projectileImpact: 0,
      projectileRadius: 0,
      recoil: 0,
      barrels: 0,
      bumpMultiplier: 0.95,
      rangeMultiplier: 0.5,
      pellets: 1,
      spreadDeg: 0,
      homing: 1,
      projectileMaxRange: 0,
      laserForce: 5.5,
      /** Laser: the beam stays on a target at most this long (s), then pauses. 0 = no limit. */
      beamSeconds: 3.5,
      /** Laser: how long the beam pauses after beamSeconds (s). Being off target this long also resets the beam time. */
      beamPauseSeconds: 1.5,
      /** Laser: the beam only earns knockout credit once it has held a tank this long (s), so it can't steal knockouts with a quick touch. */
      beamCreditSeconds: 0.3,
      /** Laser focus: the beam's push starts at this share... */
      beamFocusStart: 0.9,
      /** ...and builds up to this share while it stays on the same tank... */
      beamFocusEnd: 1.95,
      /** ...over this many seconds. A new target (or a pause) starts over. */
      beamFocusSeconds: 0.8,
      projectileDamage: 0,
      /** Artillery only: no shots at tanks closer than this (m). */
      minRange: 0,
      /** 1 = shells are lobbed to where the target was and burst on landing (Artillery). */
      lobbed: 0,
      /** Lobbed shells: tanks within this distance of the landing spot are pushed (m). */
      blastRadius: 0,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1,
    },
    /**
     * Shotgun: half-track (tracks at the back, wheels at the front). Fires a
     * cone of pellets that fly straight (no homing). Short range, big push
     * when most pellets hit, slow to reload.
     */
    modelE: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 0.9,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.1,
      burstSeconds: 0.3,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1.08,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 0.95,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 0.95,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 0.9,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 0.9,
      timeBetweenShots: 2.25,
      projectileSpeed: 34,
      projectileImpact: 3.5,
      projectileRadius: 0.12,
      recoil: 0,
      barrels: 1,
      bumpMultiplier: 1,
      rangeMultiplier: 0.7,
      pellets: 5,
      spreadDeg: 18,
      homing: 0,
      projectileMaxRange: 12.5,
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      projectileDamage: 3,
      /** Artillery only: no shots at tanks closer than this (m). */
      minRange: 0,
      /** 1 = shells are lobbed to where the target was and burst on landing (Artillery). */
      lobbed: 0,
      /** Lobbed shells: tanks within this distance of the landing spot are pushed (m). */
      blastRadius: 0,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1,
    },
    /**
     * Artillery: a tracked howitzer. Shells fly high to the spot where the
     * target was when fired (no tracking) and push every tank in a small blast.
     * A minimum range: it can't shoot tanks that are close by. Longest range.
     * Projectile speed = speed over the ground, so far shots take longer to land.
     */
    modelF: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 1.15,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1.04,
      burstSeconds: 0.3,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 1.1,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 0.95,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 0.8,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 0.95,
      timeBetweenShots: 1.9,
      projectileSpeed: 34,
      projectileImpact: 9,
      projectileRadius: 0.2,
      recoil: 1.2,
      barrels: 1,
      bumpMultiplier: 1,
      rangeMultiplier: 1.8,
      pellets: 1,
      spreadDeg: 0,
      homing: 0,
      projectileMaxRange: 0,
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      projectileDamage: 10,
      minRange: 4.5,
      lobbed: 1,
      blastRadius: 2.8,
      /** 1 = fires small homing rockets that fly like the missile powerup (Rocket). */
      rockets: 0,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 1,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1.2,
    },
    /**
     * Rocket: a rocket-launcher truck. Fires small homing rockets that fly like
     * the missile powerup (Powerups: missile sliders) but are smaller and push
     * less: projectile push = rocket push, projectile size = rocket hit size.
     */
    modelG: {
      radius: 1.15,
      /** Share of the common mass (Ice and arena group). */
      massShare: 0.9,
      /** Share of the common thrust (Ice and arena group). */
      thrustShare: 1,
      burstSeconds: 0.3,
      /** Share of the common top speed (Ice and arena group). */
      topSpeedShare: 1.05,
      /** Share of the common traction (Ice and arena group). */
      tractionShare: 1,
      /** Share of the common drag (Ice and arena group): how fast this tank slows down on its own. */
      dragShare: 1.1,
      /** Turret turn speed as a share of the common turret turn rate (Steering group). */
      turretTurnShare: 0.9,
      /** Hull turn speed as a share of the common hull turn rate (Steering group). */
      hullTurnShare: 1.05,
      timeBetweenShots: 1.5,
      projectileSpeed: 14,
      projectileImpact: 9,
      projectileRadius: 0.22,
      recoil: 0,
      barrels: 1,
      bumpMultiplier: 0.95,
      rangeMultiplier: 1.1,
      pellets: 1,
      spreadDeg: 0,
      homing: 1,
      projectileMaxRange: 0,
      laserForce: 0,
      beamSeconds: 0,
      beamPauseSeconds: 0,
      beamCreditSeconds: 0,
      beamFocusStart: 1,
      beamFocusEnd: 1,
      beamFocusSeconds: 0,
      projectileDamage: 8,
      minRange: 0,
      lobbed: 0,
      blastRadius: 0,
      rockets: 1,
      /** Rockets per shot, fired in a quick burst (Rocket). */
      salvo: 2,
      /** How much of the ice your camera shows when you drive this tank, as a share of the common view (camera.playViewMetres). 1.2 = 20% more overview. */
      viewShare: 1.05,
    },
  },

  physics: {
    /** Common mass for all tanks: resistance to bumps and hits (heavier = pushed less, slower to speed up). Each tank gets its share (massShare). */
    mass: 0.6,
    /** Common thrust for all tanks: force of the push on each click. Each tank gets its share (thrustShare). */
    thrust: 35,
    /** Common top speed for all tanks (m/s); each tank gets its share (topSpeedShare). Their own thrust can't push them faster; bumps can. */
    topSpeed: 9,
    /** Common traction for all tanks: how fast sideways sliding fades. Each tank gets its share (tractionShare). */
    sideGrip: 0.5,
    /** Slowdown on the ice, per second. Very low, so tanks keep sliding. */
    drag: 0.06,
    /** How fast the hull turns toward a clicked point. Same for all tanks. */
    hullTurnRateDeg: 620,
    /** How fast the turret turns toward the closest enemy. Same for all tanks. */
    turretTurnRateDeg: 780,
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
    dummiesFire: true,
    /** Tanks only fire when the closest enemy is within this distance. Same for both models. */
    rangeMetres: 14,
    /** Gun shots (Agile, Heavy, Stealth, Shotgun) push harder up close: this share right at the muzzle... */
    shotPushNear: 1.25,
    /** ...falling evenly to this share at the tank's firing range, and staying there beyond it. */
    shotPushFar: 0.85,
    /** How fast a homing projectile turns toward its target. High = near-perfect tracking. */
    homingTurnRateDeg: 740,
    /** The turret only fires once it points within this angle of its target. */
    fireAlignDeg: 6,
    /** Rocket bursts: seconds between the rockets of one burst. */
    salvoGapSeconds: 0.15,
    /**
     * Artillery aims this far short of its target, toward itself (m), so a
     * direct hit pushes the target away from the Artillery.
     */
    artilleryAimShort: 0.5,
  },

  abilities: {
    /** Model A, Shift: more speed for a short time, so bumps hit harder. */
    boost: { seconds: 1.4, cooldown: 9.5, speedMultiplier: 1.2 },
    /** Model B, Shift: the next few shots push much harder. */
    powerShot: { shots: 3, cooldown: 9, impactMultiplier: 1.45 },
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
    grenade: { maxThrow: 14, flightSeconds: 0.9, radius: 4, impact: 19, cooldown: 7, damage: 30 },
    /** Artillery: for a while its shells push harder and burst wider. */
    explosiveShells: { seconds: 5, cooldown: 10, impactMultiplier: 2.4, radiusMultiplier: 1.3 },
    /**
     * Rocket: press Shift, click a spot (up to maxPlace m away) and a drone
     * hovers there for a while, machine-gunning the closest enemy within its
     * range. It never shoots the player who placed it; that player gets the credit.
     */
    drone: { maxPlace: 13, seconds: 7.5, cooldown: 12, range: 8, timeBetweenShots: 0.1, projectileSpeed: 18, impact: 1.6, projectileRadius: 0.12 },
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
    /** Push on a hit, along its direction of travel (divided by the target's mass). */
    impact: 18,
    /** Missiles and Rocket-tank rockets push harder the farther they flew: this share of their push right after launch... */
    distancePushMin: 0.8,
    /** ...rising evenly to this share... */
    distancePushMax: 1.35,
    /** ...after flying this far (m), and staying there beyond it. */
    distancePushMetres: 26,
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
    /** Laser has no gun: rapid fire multiplies its laser push by this instead (2 = twice as hard). */
    laserMultiplier: 2.2,
  },

  /**
   * Airstrike powerup (Sumo only): click a spot, and after a short delay a
   * stealth bomber drops bombs on a line through it, at right angles to the
   * line from the arena's middle to that spot. The bombs push like an
   * Artillery explosive shell (9 × 2.4 push, 3 m × 1.3 blast), and also push
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
    /** Push at the centre of each blast (divided by mass); 40% of this at its edge. */
    impact: 21.6,
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
    /** Push at the centre of the blast (divided by mass). Falls to 40% at the blast's edge. */
    impact: 26,
    /** Ready for health modes. Sumo doesn't use it. */
    damage: 40,
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
     * of the hit's Sumo push takes this share of its speed (0.012 = 1.2%), so a
     * Heavy shot (push 8.5) slows about 10% and a Stealth bullet (2.5) 3%.
     * Applies to shots, rockets, shells, grenades, the laser, missiles and
     * mines; bumps between tanks still push as usual.
     */
    hitSlowPerPush: 0.015,
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
export type TankModel = keyof Tuning['tanks'];
/** A tank's stats in play: its model values plus its actual mass, thrust, top speed and traction. */
export type ModelStats = Tuning['tanks']['modelA'] & { mass: number; thrust: number; topSpeed: number; sideGrip: number };

/** A fresh, editable copy of the defaults (the slider panel changes this copy). */
export function createTuning(): Tuning {
  return JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
}
