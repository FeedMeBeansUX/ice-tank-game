import { DEFAULT_TUNING, lossRate, share, type TankModel, type Tuning, type Weapon } from '@ice-tank-sumo/shared';

/**
 * In-game slider panel. Sliders change the live tuning values, so the effect
 * is immediate. "Copy values" puts them on the clipboard to paste in the chat;
 * those then become the new defaults in shared/src/tuning.ts.
 *
 * Values are also remembered in this browser, so a reload keeps your settings.
 *
 * Layout (milestone 5): Common (movement values for all tanks, in real
 * units), then one group per tank with "This tank" (its ±% on the common
 * values), "Weapon" (its own values, no common value) and "Ability".
 */

interface Slider {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  help: string;
  /** Custom display of the value (default: the number). */
  show?: (value: number, tuning: Tuning) => string;
}

/** A sub-heading inside a group. */
interface Heading {
  heading: string;
}

type Row = Slider | Heading;

interface Group {
  title: string;
  open: boolean;
  rows: Row[];
}

const isHeading = (r: Row): r is Heading => 'heading' in r;

const signed = (pct: number) => `${pct > 0 ? '+' : ''}${pct}%`;
const fixed = (v: number, d: number) => v.toFixed(d);
/** A "% lost per second" rate times a share, back as % lost per second. */
const lossPct = (percentPerSecond: number, factor: number) => (100 * (1 - Math.exp(-lossRate(percentPerSecond) * factor))).toFixed(1);

/** A tank's ±% slider: shows the percentage and the value it gives this tank. */
function pct(path: string, label: string, help: string, result?: (factor: number, t: Tuning) => string): Slider {
  return {
    path,
    label,
    min: -50,
    max: 50,
    step: 1,
    help,
    show: (v, t) => (result ? `${signed(v)} · ${result(share(v), t)}` : signed(v)),
  };
}

function thisTank(model: TankModel): Row[] {
  const p = `tanks.${model}`;
  return [
    { heading: 'This tank (± on common)' },
    pct(`${p}.massPct`, 'Mass', 'Mass compared with the common mass. Heavier tanks are pushed less and speed up slower.', (f, t) => `${fixed(t.common.mass * f, 1)} t`),
    pct(`${p}.thrustPct`, 'Thrust', 'Thrust compared with the common thrust.', (f, t) => `${fixed(t.common.thrust * f, 1)} m/s²`),
    pct(`${p}.burstPct`, 'Burst length', 'How long one click keeps pushing, compared with the common burst length.', (f, t) => `${fixed(t.common.burst * f, 3)} s`),
    pct(`${p}.topSpeedPct`, 'Top speed', 'Top speed compared with the common top speed.', (f, t) => `${fixed(t.common.topSpeed * f, 2)} m/s`),
    pct(`${p}.tractionPct`, 'Traction', 'Grip compared with the common traction. Higher = sideways sliding fades faster.', (f, t) => `${lossPct(t.common.traction, f)} %/s`),
    pct(`${p}.dragPct`, 'Drag', 'How fast it slows down on its own, compared with the common drag.', (f, t) => `${lossPct(t.common.drag, f)} %/s`),
    pct(`${p}.hullTurnPct`, 'Hull turn speed', 'How fast the hull turns toward your click, compared with the common hull turn speed.', (f, t) => `${Math.round(t.common.hullTurn * f)} °/s`),
    pct(`${p}.turretTurnPct`, 'Turret turn speed', 'How fast the turret turns toward its target, compared with the common turret turn speed.', (f, t) => `${Math.round(t.common.turretTurn * f)} °/s`),
    pct(`${p}.bumpPct`, 'Bump strength', 'Bumps from this tank push the other tank this much harder (or softer).'),
    pct(`${p}.viewPct`, 'View size', 'How much of the ice your camera shows with this tank. Above 0 = more overview.', (f, t) => `${Math.round(t.camera.playViewMetres * f)} m`),
  ];
}

function weapon(model: TankModel, w: Weapon): Row[] {
  const p = `tanks.${model}.weapon`;
  const range: Slider = { path: `${p}.range`, label: 'Range (m)', min: 2, max: 40, step: 0.1, help: w.kind === 'laser' ? 'The beam reaches this far (m).' : 'Fires when the closest enemy is this close (m).' };
  const shotTime: Slider = { path: `${p}.timeBetweenShots`, label: 'Time between shots (s)', min: 0.05, max: 4, step: 0.01, help: 'Seconds between automatic shots.' };
  const recoil: Slider = { path: `${p}.recoil`, label: 'Recoil', min: 0, max: 10, step: 0.01, help: 'Push backward on the shooter for each shot (speed change of a 30 t tank, m/s).' };
  const perMetre = (what: string): Slider => ({ path: `${p}.pushPerMetre`, label: 'Push change per metre (%)', min: -10, max: 10, step: 0.1, help: `The push changes by this % of the ${what} push for every metre flown. Negative = weaker with distance.` });
  const stops: Slider = { path: `${p}.pushChangeStops`, label: 'Push change stops after (m)', min: 0, max: 60, step: 0.1, help: 'After flying this far the push stays the same.' };
  const heading: Heading = { heading: 'Weapon' };
  switch (w.kind) {
    case 'gun':
      return [
        heading,
        range,
        shotTime,
        { path: `${p}.projectileSpeed`, label: 'Projectile speed (m/s)', min: 4, max: 60, step: 0.5, help: 'Flight speed of its projectiles (m/s). Constant.' },
        { path: `${p}.push`, label: 'Push at the muzzle', min: 0, max: 60, step: 0.1, help: 'Speed change (m/s) a hit right at the muzzle gives a 30 t tank. Pellets: per pellet.' },
        perMetre('muzzle'),
        stops,
        { path: `${p}.maxDistance`, label: 'Shot max distance (m)', min: 0, max: 40, step: 0.5, help: 'Shots vanish after this distance (m). 0 = they fly until they leave the arena.' },
        { path: `${p}.homingTurn`, label: 'Homing (°/s)', min: 0, max: 1440, step: 10, help: 'How fast shots steer toward their target (degrees per second). 0 = they fly straight.' },
        recoil,
        { path: `${p}.pellets`, label: 'Pellets per shot', min: 1, max: 15, step: 1, help: 'More than 1 fires a spread of pellets (shotgun).' },
        { path: `${p}.spreadDeg`, label: 'Spread (°)', min: 0, max: 90, step: 1, help: 'Width of the pellet spread (degrees).' },
      ];
    case 'laser':
      return [
        heading,
        range,
        { path: `${p}.push`, label: 'Laser push (per second)', min: 0, max: 40, step: 0.1, help: 'Speed change per second (m/s) the beam gives a 30 t tank it is on, before focus.' },
        { path: `${p}.beamSeconds`, label: 'Beam time (s)', min: 0, max: 5, step: 0.1, help: 'The beam stays on a target at most this long, then pauses. 0 = no limit.' },
        { path: `${p}.beamPauseSeconds`, label: 'Beam pause (s)', min: 0, max: 5, step: 0.1, help: 'How long the beam pauses after the beam time. Being off target this long also resets the beam time.' },
        { path: `${p}.beamCreditSeconds`, label: 'Beam credit after (s)', min: 0, max: 2, step: 0.05, help: 'The beam only earns knockout credit once it has held a tank this long.' },
        { path: `${p}.focusStart`, label: 'Focus: start push', min: 0, max: 3, step: 0.05, help: "The beam's push starts at this share of the laser push on a new target..." },
        { path: `${p}.focusEnd`, label: 'Focus: full push', min: 0, max: 4, step: 0.05, help: '...and builds up to this share while it stays on the same tank...' },
        { path: `${p}.focusSeconds`, label: 'Focus: build-up time (s)', min: 0, max: 6, step: 0.1, help: '...over this many seconds. A new target or a beam pause starts over. 0 = always full push.' },
      ];
    case 'shell':
      return [
        heading,
        range,
        { path: `${p}.minRange`, label: 'Minimum range (m)', min: 0, max: 20, step: 0.5, help: 'Ignores tanks closer than this and aims at the next closest (m).' },
        shotTime,
        { path: `${p}.projectileSpeed`, label: 'Shell speed (m/s)', min: 4, max: 60, step: 0.5, help: 'Speed over the ground, so far shots take longer to land.' },
        { path: `${p}.push`, label: 'Shell push', min: 0, max: 60, step: 0.1, help: 'Speed change (m/s) at the blast centre for a 30 t tank; 40% at the edge.' },
        { path: `${p}.blastRadius`, label: 'Shell blast radius (m)', min: 0.5, max: 8, step: 0.1, help: 'Tanks within this distance of where a shell lands are pushed.' },
        { path: `${p}.aimShort`, label: 'Aims short by (m)', min: 0, max: 3, step: 0.1, help: 'Shells land this far in front of the target, toward the Artillery, so direct hits push it away.' },
        recoil,
      ];
    case 'rocket':
      return [
        heading,
        range,
        shotTime,
        { path: `${p}.salvo`, label: 'Rockets per burst', min: 1, max: 6, step: 1, help: 'Rockets fired in one quick burst per shot.' },
        { path: `${p}.salvoGap`, label: 'Burst gap (s)', min: 0.05, max: 0.6, step: 0.01, help: 'Seconds between the rockets of one burst.' },
        { path: `${p}.push`, label: 'Push at launch', min: 0, max: 60, step: 0.1, help: 'Speed change (m/s) a rocket gives a 30 t tank when it hits right after launch.' },
        perMetre('launch'),
        stops,
        { path: `${p}.startSpeed`, label: 'Start speed (m/s)', min: 4, max: 40, step: 0.5, help: 'Speed during the first curve toward the target.' },
        { path: `${p}.topSpeed`, label: 'Top speed (m/s)', min: 4, max: 60, step: 0.5, help: 'Speed it reaches after the first curve.' },
        { path: `${p}.acceleration`, label: 'Acceleration (m/s²)', min: 0, max: 120, step: 1, help: 'How fast it gets from start speed to top speed.' },
        { path: `${p}.curveTurn`, label: 'First-curve turn (°/s)', min: 30, max: 720, step: 10, help: 'Turn rate during the first curve.' },
        { path: `${p}.lateTurn`, label: 'Late turn (°/s)', min: 5, max: 360, step: 5, help: 'Turn rate after the first curve. Lower = easier to dodge.' },
      ];
  }
}

/** Each tank's ability (Shift), shown in that tank's own group. */
const ABILITY: Record<TankModel, Slider[]> = {
  modelA: [
    { path: 'abilities.boost.seconds', label: 'Boost length (s)', min: 0.5, max: 6, step: 0.1, help: 'How long boost lasts.' },
    { path: 'abilities.boost.cooldown', label: 'Boost cooldown (s)', min: 1, max: 20, step: 0.5, help: 'Seconds before boost can be used again.' },
    { path: 'abilities.boost.speedMultiplier', label: 'Boost speed (×)', min: 1, max: 3, step: 0.05, help: 'Thrust and top speed are multiplied by this while boosting.' },
  ],
  modelB: [
    { path: 'abilities.powerShot.shots', label: 'Power shots', min: 1, max: 6, step: 1, help: 'How many shots a power shot charges.' },
    { path: 'abilities.powerShot.cooldown', label: 'Power shot cooldown (s)', min: 1, max: 20, step: 0.5, help: 'Seconds before power shot can be used again.' },
    { path: 'abilities.powerShot.pushMultiplier', label: 'Power shot push (×)', min: 1, max: 5, step: 0.05, help: 'Projectile push is multiplied by this for charged shots.' },
  ],
  modelC: [
    { path: 'abilities.smoke.seconds', label: 'Smoke length (s)', min: 0.5, max: 10, step: 0.5, help: 'How long the Stealth tank stays invisible (any hit ends it early).' },
    { path: 'abilities.smoke.cooldown', label: 'Smoke cooldown (s)', min: 1, max: 30, step: 0.5, help: 'Seconds before smoke can be used again.' },
  ],
  modelD: [
    { path: 'abilities.emp.radius', label: 'EMP radius (m)', min: 1, max: 15, step: 0.5, help: 'Other tanks within this distance are disabled.' },
    { path: 'abilities.emp.seconds', label: 'EMP length (s)', min: 0.5, max: 8, step: 0.25, help: 'How long hit tanks stay disabled: no steering, pushing, firing, ability or powerups.' },
    { path: 'abilities.emp.cooldown', label: 'EMP cooldown (s)', min: 1, max: 30, step: 0.5, help: 'Seconds before EMP can be used again.' },
  ],
  modelE: [
    { path: 'abilities.grenade.maxThrow', label: 'Grenade throw range (m)', min: 4, max: 40, step: 0.5, help: 'Farthest a grenade can be thrown.' },
    { path: 'abilities.grenade.flightSeconds', label: 'Grenade flight time (s)', min: 0.2, max: 3, step: 0.05, help: 'Flight time at full range; shorter throws land sooner.' },
    { path: 'abilities.grenade.radius', label: 'Grenade blast radius (m)', min: 1, max: 12, step: 0.5, help: 'Tanks within this distance of the landing spot are pushed.' },
    { path: 'abilities.grenade.push', label: 'Grenade push', min: 0, max: 80, step: 0.1, help: 'Speed change (m/s) at the blast centre for a 30 t tank; 40% at the edge.' },
    { path: 'abilities.grenade.cooldown', label: 'Grenade cooldown (s)', min: 1, max: 30, step: 0.5, help: 'Seconds before the next grenade.' },
  ],
  modelF: [
    { path: 'abilities.explosiveShells.seconds', label: 'Explosive shells length (s)', min: 1, max: 15, step: 0.5, help: 'How long explosive shells last.' },
    { path: 'abilities.explosiveShells.pushMultiplier', label: 'Explosive shells push (×)', min: 1, max: 4, step: 0.1, help: 'Shell push is multiplied by this.' },
    { path: 'abilities.explosiveShells.radiusMultiplier', label: 'Explosive shells radius (×)', min: 1, max: 4, step: 0.1, help: 'Shell blast radius is multiplied by this.' },
    { path: 'abilities.explosiveShells.cooldown', label: 'Explosive shells cooldown (s)', min: 1, max: 30, step: 0.5, help: 'Seconds before it can be used again.' },
  ],
  modelG: [
    { path: 'abilities.drone.maxPlace', label: 'Drone placing range (m)', min: 2, max: 30, step: 0.5, help: 'Farthest spot a drone can be placed.' },
    { path: 'abilities.drone.seconds', label: 'Drone time (s)', min: 1, max: 20, step: 0.5, help: 'How long a drone stays.' },
    { path: 'abilities.drone.range', label: 'Drone gun range (m)', min: 2, max: 20, step: 0.5, help: 'The drone shoots the closest enemy within this distance.' },
    { path: 'abilities.drone.timeBetweenShots', label: 'Drone time between shots (s)', min: 0.05, max: 2, step: 0.05, help: 'Seconds between drone shots.' },
    { path: 'abilities.drone.push', label: 'Drone shot push', min: 0, max: 15, step: 0.1, help: 'Speed change (m/s) per drone hit on a 30 t tank.' },
    { path: 'abilities.drone.cooldown', label: 'Drone cooldown (s)', min: 1, max: 30, step: 0.5, help: 'Seconds before the next drone (counted from placing it).' },
  ],
};

const TANK_GROUPS: [TankModel, string][] = [
  ['modelA', 'Agile'],
  ['modelB', 'Heavy'],
  ['modelC', 'Stealth'],
  ['modelD', 'Laser'],
  ['modelE', 'Shotgun'],
  ['modelF', 'Artillery'],
  ['modelG', 'Rocket'],
];

export const GROUPS: Group[] = [
  {
    title: 'Common (all tanks)',
    open: true,
    rows: [
      { path: 'common.mass', label: 'Mass (t)', min: 10, max: 60, step: 1, help: 'Common mass in tonnes. Heavier = harder to push by hits and bumps (pushes are set for a 30 t tank). Each tank adds its own ± (tank groups).' },
      { path: 'common.thrust', label: 'Thrust (m/s²)', min: 20, max: 100, step: 1, help: "Acceleration while a click's burst pushes, for a tank with 0% mass and thrust. Each tank adds its own ±." },
      { path: 'common.burst', label: 'Burst length (s)', min: 0.1, max: 0.8, step: 0.02, help: 'How long one click keeps pushing. Each tank adds its own ±.' },
      { path: 'common.topSpeed', label: 'Top speed (m/s)', min: 6, max: 20, step: 0.2, help: "A tank's own thrust can't push it faster than this; bumps can. Each tank adds its own ±." },
      { path: 'common.traction', label: 'Traction (%/s)', min: 1, max: 30, step: 0.2, help: 'Share of sideways sliding that fades per second. Low = drifting. Each tank adds its own ±.' },
      { path: 'common.drag', label: 'Drag (%/s)', min: 0, max: 30, step: 0.2, help: 'Share of speed lost per second on the ice. Each tank adds its own ±.' },
      { path: 'common.hullTurn', label: 'Hull turn speed (°/s)', min: 90, max: 900, step: 10, help: 'How fast the hull turns toward your click. Each tank adds its own ±.' },
      { path: 'common.turretTurn', label: 'Turret turn speed (°/s)', min: 90, max: 900, step: 10, help: 'How fast the turret turns toward its target (drones too). Each tank adds its own ±.' },
    ],
  },
  ...TANK_GROUPS.map(([model, title], i): Group => ({
    title,
    open: i === 0,
    rows: [...thisTank(model), ...weapon(model, DEFAULT_TUNING.tanks[model].weapon), { heading: 'Ability (Shift)' }, ...ABILITY[model]],
  })),
  {
    title: 'Ice and arena',
    open: false,
    rows: [
      { path: 'arena.radius', label: 'Arena size (radius, m)', min: 12, max: 60, step: 1, help: 'Radius of the playing field. The camera zoom stays the same.' },
      { path: 'arena.shrinkStartSeconds', label: 'Ice shrinks after (s)', min: 0, max: 300, step: 5, help: 'Sumo: seconds of play before the ice starts shrinking (sandbox: since the last respawn).' },
      { path: 'arena.shrinkSeconds', label: 'Shrinking takes (s)', min: 5, max: 300, step: 5, help: 'Sumo: seconds from full size to the smallest size.' },
      { path: 'arena.shrinkMinShare', label: 'Smallest ice (share)', min: 0.2, max: 1, step: 0.05, help: 'Sumo: the smallest the ice gets, as a share of its full radius.' },
      { path: 'physics.domeStrength', label: 'Dome push (m/s²)', min: 0, max: 6, step: 0.1, help: 'Outward push at the very edge. Zero at the centre.' },
      { path: 'physics.domeCurve', label: 'Dome curve', min: 0.5, max: 5, step: 0.1, help: '1 = push grows evenly from the centre. Higher = push mostly near the edge.' },
      { path: 'physics.bumpBounce', label: 'Bump bounce', min: 1, max: 3, step: 0.05, help: '1 = tanks stop dead on contact, 2 = fully bouncy, above 2 = extra punchy.' },
    ],
  },
  {
    title: 'Combat',
    open: false,
    rows: [
      { path: 'combat.fireAlignDeg', label: 'Fire alignment (°)', min: 0.5, max: 45, step: 0.5, help: 'The turret (and a drone) only fires once it points within this many degrees of its target.' },
      { path: 'upgrades.percentPerPoint', label: 'Upgrade % per point', min: 0, max: 30, step: 1, help: 'Each upgrade point adds this percentage on top of the base value.' },
    ],
  },
  {
    title: 'Powerups',
    open: false,
    rows: [
      { path: 'powerups.spawnInterval', label: 'Spawn every (s)', min: 1, max: 30, step: 1, help: 'A new powerup appears this often.' },
      { path: 'powerups.maxOnField', label: 'Max on the ice', min: 1, max: 8, step: 1, help: 'No new powerup appears while this many are on the ice.' },
      { heading: 'Missile' },
      { path: 'missile.minTargetDistance', label: 'Missile min distance (m)', min: 0, max: 25, step: 0.5, help: 'Only tanks at least this far away can be picked as a missile target.' },
      { path: 'missile.startSpeed', label: 'Missile start speed (m/s)', min: 4, max: 30, step: 0.5, help: 'Speed during its first curve toward the target.' },
      { path: 'missile.curveTurnRateDeg', label: 'Missile first-curve turn (°/s)', min: 30, max: 720, step: 10, help: 'Turn rate during the first curve.' },
      { path: 'missile.topSpeed', label: 'Missile top speed (m/s)', min: 6, max: 50, step: 0.5, help: 'Speed it reaches after the first curve.' },
      { path: 'missile.boostTurnRateDeg', label: 'Missile late turn (°/s)', min: 5, max: 360, step: 5, help: 'Turn rate after the first curve. Lower = easier to dodge.' },
      { path: 'missile.push', label: 'Missile push at launch', min: 0, max: 80, step: 0.1, help: 'Speed change (m/s) a missile gives a 30 t tank when it hits right after launch.' },
      { path: 'missile.pushPerMetre', label: 'Missile push change per metre (%)', min: -10, max: 10, step: 0.1, help: 'The push grows by this % of the launch push for every metre flown.' },
      { path: 'missile.pushChangeStops', label: 'Missile push change stops after (m)', min: 0, max: 60, step: 1, help: 'After flying this far the push stays the same.' },
      { heading: 'Rapid fire' },
      { path: 'rapidFire.seconds', label: 'Rapid fire length (s)', min: 1, max: 15, step: 0.5, help: 'How long rapid fire lasts once used.' },
      { path: 'rapidFire.shotTimeMultiplier', label: 'Rapid fire shot time (×)', min: 0.1, max: 1, step: 0.05, help: 'Time between shots is multiplied by this during rapid fire (0.5 = half).' },
      { path: 'rapidFire.laserMultiplier', label: 'Laser boost (×)', min: 1, max: 5, step: 0.1, help: 'Laser with rapid fire: it pushes this many times harder.' },
      { heading: 'Airstrike' },
      { path: 'airstrike.spawnWeight', label: 'Airstrike rarity', min: 0, max: 1, step: 0.05, help: 'How often an airstrike appears compared with each other powerup (1 = as often, 0 = never). Sumo only.' },
      { path: 'airstrike.delaySeconds', label: 'Airstrike delay (s)', min: 0.5, max: 5, step: 0.1, help: 'Seconds from the click to the first bomb going off.' },
      { path: 'airstrike.spacing', label: 'Airstrike bomb spacing (m)', min: 1, max: 10, step: 0.5, help: 'Distance between neighbouring bombs along the line.' },
      { path: 'airstrike.radius', label: 'Airstrike blast radius (m)', min: 1, max: 10, step: 0.1, help: 'Blast radius of each bomb. Default matches an explosive Artillery shell.' },
      { path: 'airstrike.push', label: 'Airstrike push', min: 0, max: 80, step: 0.1, help: 'Speed change (m/s) at the centre of each blast for a 30 t tank; 40% at the edge.' },
      { heading: 'Tesla coil' },
      { path: 'teslaCoil.spawnWeight', label: 'Tesla coil rarity', min: 0, max: 1, step: 0.05, help: 'How often a tesla coil appears compared with each other powerup (1 = as often, 0 = never).' },
      { path: 'teslaCoil.seconds', label: 'Tesla coil length (s)', min: 1, max: 15, step: 0.5, help: 'Seconds the coil stays on the field.' },
      { path: 'teslaCoil.range', label: 'Tesla coil range (m)', min: 1, max: 12, step: 0.5, help: 'Enemies within this distance of the coil are electrified.' },
      { path: 'teslaCoil.lingerSeconds', label: 'Electrified linger (s)', min: 0, max: 5, step: 0.25, help: 'The effect lasts this long after a tank leaves the range or the coil is gone.' },
      { path: 'teslaCoil.topSpeedShare', label: 'Electrified top speed (share)', min: 0.1, max: 1, step: 0.05, help: 'Electrified tanks keep this share of their top speed.' },
      { path: 'teslaCoil.tractionShare', label: 'Electrified traction (share)', min: 0.05, max: 1, step: 0.05, help: 'Electrified tanks keep this share of their traction (lower = slides more).' },
      { heading: 'Mine' },
      { path: 'mine.triggerRange', label: 'Mine trigger range (m)', min: 0.2, max: 4, step: 0.1, help: "A live mine goes off when a tank's centre comes this close." },
      { path: 'mine.armSeconds', label: 'Mine arm delay (s)', min: 0, max: 5, step: 0.1, help: 'Seconds before a dropped mine goes live.' },
      { path: 'mine.blastRadius', label: 'Mine blast radius (m)', min: 1, max: 15, step: 0.5, help: 'Tanks within this distance of the blast are pushed.' },
      { path: 'mine.push', label: 'Mine push', min: 0, max: 80, step: 0.1, help: 'Speed change (m/s) at the blast centre for a 30 t tank; 40% at the edge.' },
    ],
  },
  {
    title: 'Race',
    open: false,
    rows: [
      { path: 'race.laps', label: 'Laps', min: 1, max: 10, step: 1, help: 'First tank to drive this many laps wins. Applies to the next race.' },
      { path: 'race.trackLength', label: 'Track length (m)', min: 120, max: 800, step: 10, help: 'Length of one lap along the middle of the track. Applies to the next new track.' },
      { path: 'race.trackWidth', label: 'Track width (m)', min: 6, max: 30, step: 0.5, help: 'Width of the track. Applies to the next new track.' },
      { path: 'race.dummyClickInterval', label: 'Dummy click interval (s)', min: 0.25, max: 1, step: 0.05, help: 'How often race dummies click.' },
      { path: 'race.dummyLookAhead', label: 'Dummy look-ahead (m)', min: 4, max: 30, step: 1, help: 'Race dummies click on the middle of the track this far ahead, so they anticipate bends.' },
      { path: 'race.leaderPenalty', label: 'Leader penalty', min: 0, max: 0.4, step: 0.01, help: 'The race leader loses this share of top speed and traction (0.1 = 10%).' },
      { path: 'race.secondPenalty', label: 'Second place penalty', min: 0, max: 0.4, step: 0.01, help: 'Second place loses this share of top speed and traction (with 3 or more tanks).' },
      { path: 'race.lastBonus', label: 'Last place bonus', min: 0, max: 0.4, step: 0.01, help: 'With 4 or more tanks, the last tank gains this share of top speed and traction.' },
      { path: 'race.secondLastBonus', label: 'Second-to-last bonus', min: 0, max: 0.4, step: 0.01, help: 'With 4 or more tanks, second to last gains this share of top speed and traction.' },
      { path: 'race.powerupsOnField', label: 'Powerups on the track', min: 0, max: 20, step: 1, help: 'Most powerups on the track at once.' },
      { path: 'race.tractionShare', label: 'Race traction (share of normal)', min: 0.1, max: 2, step: 0.05, help: 'Traction in a race as a share of the normal traction. Below 1 = more slippery racing; Sumo is not affected.' },
      { path: 'race.hitSlowPerPush', label: 'Hit slowdown per push', min: 0, max: 0.03, step: 0.001, help: "In a race, hits slow the target instead of pushing it: each point of the hit's Sumo push takes this share of its speed (0.009 = 0.9%)." },
      { path: 'race.minePushShare', label: 'Mine push in races', min: 0, max: 1.5, step: 0.05, help: "Mines still push in a race (they don't slow), at this share of their Sumo push." },
      { path: 'race.missilePushShare', label: 'Missile powerup push in races', min: 0, max: 1.5, step: 0.05, help: "The missile powerup still pushes in a race (it doesn't slow), at this share of its Sumo push. Rocket tank rockets slow, like other shots." },
      { path: 'race.maxHitSlow', label: 'Max slowdown per hit', min: 0, max: 0.5, step: 0.01, help: "In a race, hits arriving together take at most this share of a tank's speed (0.15 = 15%)." },
      { path: 'race.hazardMineChance', label: 'Hazard mine chance', min: 0, max: 1, step: 0.05, help: "Share of powerup spawns that are a live mine instead (nobody's; it pushes whoever touches it)." },
      { path: 'race.spawnAheadMin', label: 'Spawn ahead of leader, min (m)', min: 0, max: 200, step: 5, help: 'Powerups and hazard mines appear at least this far ahead of the race leader.' },
      { path: 'race.spawnAheadMax', label: 'Spawn ahead of leader, max (m)', min: 0, max: 300, step: 5, help: '...and at most this far ahead.' },
      { path: 'race.hazardMiddleShare', label: 'Hazard mines: middle share', min: 0, max: 1, step: 0.05, help: 'Hazard mines lie within this share of the half-width from the middle of the track.' },
      { path: 'race.pickupEdgeShare', label: 'Pickups: edge share', min: 0, max: 1, step: 0.05, help: 'Pickups lie at least this share of the half-width away from the middle, toward the edges.' },
      { path: 'race.countdownSeconds', label: 'Countdown (s)', min: 0, max: 5, step: 1, help: 'Seconds before the start.' },
    ],
  },
  {
    title: 'Dummies',
    open: false,
    rows: [
      { path: 'dummies.skill', label: 'Dummy skill', min: 0, max: 1, step: 0.05, help: '0 = never try to save themselves, 1 = react perfectly. Low skill hesitates and clicks less accurately.' },
      { path: 'dummies.clickInterval', label: 'Dummy click interval (s)', min: 0.1, max: 2, step: 0.05, help: 'At most one simulated click per this many seconds.' },
      { path: 'dummies.chaseClickInterval', label: 'Chase click interval (s)', min: 0.25, max: 3, step: 0.05, help: 'Sumo: while safe from the edge, dummies click toward the closest tank at most this often.' },
      { path: 'dummies.powerupReach', label: 'Powerup reach (m)', min: 0, max: 40, step: 1, help: 'Sumo: with a free slot, a dummy drives to a powerup within this distance.' },
      { path: 'dummies.agilePowerupReach', label: 'Agile powerup reach (m)', min: 0, max: 60, step: 1, help: 'Sumo: how far Agile dummies go for a powerup.' },
      { path: 'dummies.keepDistance', label: 'Keep distance (share of range)', min: 0, max: 1, step: 0.05, help: 'Sumo: Heavy and Rocket dummies slip sideways past a tank nearer than this share of their range.' },
      { path: 'dummies.artilleryMargin', label: 'Artillery dodge margin (m)', min: 0, max: 6, step: 0.5, help: 'Sumo: Artillery dummies slip sideways past a tank that comes within their minimum range plus this distance.' },
      { path: 'dummies.homeZone', label: 'Shooter home zone (share)', min: 0, max: 1, step: 0.05, help: 'Sumo: while shooting, Heavy, Artillery and Rocket dummies move back toward the middle when farther out than this share of the arena radius.' },
      { path: 'dummies.flankDistance', label: 'Flank distance (m)', min: 0, max: 8, step: 0.5, help: 'Sumo: chasers first get this far to the inside of their target, so their hits push it outward.' },
      { path: 'dummies.insideMargin', label: 'Inside margin (m)', min: 0, max: 5, step: 0.5, help: 'Sumo: a chaser counts as inside its target when it is at least this much nearer the middle.' },
      { path: 'dummies.laserStandoff', label: 'Laser standoff (share)', min: 0, max: 1, step: 0.05, help: 'Sumo: Laser dummies hold their target at this share of the laser range, from the inside. 0 = they ram it (works best).' },
      { path: 'dummies.chaseLead', label: 'Chase lead (s)', min: 0, max: 1.5, step: 0.05, help: 'Sumo: Stealth, Laser, Shotgun and Agile dummies aim at where their target will be this many seconds ahead.' },
      { path: 'dummies.safeZone', label: 'Dummy safe zone (share)', min: 0.2, max: 0.95, step: 0.05, help: 'Share of the arena radius where dummies feel safe and stop correcting.' },
    ],
  },
  {
    title: 'Looks',
    open: false,
    rows: [
      { path: 'visuals.trackMarkSeconds', label: 'Track marks fade time (s)', min: 0.5, max: 10, step: 0.5, help: 'Seconds before the marks tanks leave on the ice have faded away.' },
      { path: 'visuals.trackMarkOpacity', label: 'Track marks darkness', min: 0, max: 1, step: 0.05, help: 'How dark fresh track marks are (0 = off).' },
      { path: 'visuals.trackSlipSpeed', label: 'Track slip on ice (m/s)', min: 0, max: 8, step: 0.5, help: 'Extra track speed while the engine pushes, so the tracks look like they spin on the ice. 0 = tracks only follow the movement.' },
    ],
  },
  {
    title: 'Rules',
    open: false,
    rows: [
      { path: 'rules.clickCooldown', label: 'Click cooldown (s)', min: 0, max: 1, step: 0.05, help: 'At most one click counts per this many seconds.' },
      { path: 'rules.creditWindowSeconds', label: 'Knockout credit window (s)', min: 1, max: 10, step: 0.5, help: 'A fall counts as your knockout if you hit that tank within this many seconds before it went over the edge.' },
    ],
  },
];

/**
 * Saved per browser: only values that differ from the defaults, together with
 * the default they replaced. When a default changes in the code (for example
 * after pasted values become the new defaults), the new default wins.
 */
const STORAGE_KEY = 'ice-tank-sumo.tuning.v3';

type Saved = Record<string, { value: number; base: number }>;

function getAt(obj: unknown, path: string): number {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as number;
}

function setAt(obj: unknown, path: string, value: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<string, number>;
  parent[last] = value;
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1]!.length : 0;
}

function loadSaved(): Saved {
  try {
    // Values saved before milestone 5 use old names; drop them.
    localStorage.removeItem('ice-tank-sumo.tuning.v1');
    localStorage.removeItem('ice-tank-sumo.tuning.v2');
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function save(values: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage unavailable: values still work for this visit.
  }
}

export class TuningPanel {
  readonly element: HTMLElement;
  private readonly inputs = new Map<string, { input: HTMLInputElement; output: HTMLElement; slider: Slider }>();
  private readonly status: HTMLElement;
  private readonly fallback: HTMLTextAreaElement;

  constructor(
    private readonly tuning: Tuning,
    private readonly buildLabel: string,
    private readonly onChange: (path: string) => void = () => {},
  ) {
    const el = document.createElement('aside');
    el.id = 'tuning';
    el.innerHTML = `
      <div class="tuning-head">
        <span class="tuning-title">Tuning</span>
        <span class="tuning-hint"><kbd>T</kbd> hide</span>
      </div>
      <div class="tuning-body"></div>
      <div class="tuning-actions">
        <button type="button" data-action="copy" class="primary">Copy values</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="tuning-status" aria-live="polite"></div>
      <textarea class="tuning-fallback" readonly hidden></textarea>
    `;
    const body = el.querySelector('.tuning-body')!;
    this.status = el.querySelector('.tuning-status')!;
    this.fallback = el.querySelector('.tuning-fallback')!;

    const saved = loadSaved();
    // Saved values that were put back; whoever listens (e.g. the arena drawing) hears about them below.
    const restored: string[] = [];
    for (const group of GROUPS) {
      const section = document.createElement('details');
      section.open = group.open;
      section.innerHTML = `<summary>${group.title}</summary>`;
      for (const slider of group.rows) {
        if (isHeading(slider)) {
          const h = document.createElement('h3');
          h.textContent = slider.heading;
          section.appendChild(h);
          continue;
        }
        const stored = saved[slider.path];
        if (stored && stored.base === getAt(DEFAULT_TUNING, slider.path) && stored.value !== getAt(this.tuning, slider.path)) {
          setAt(this.tuning, slider.path, stored.value);
          restored.push(slider.path);
        }
        const row = document.createElement('label');
        row.className = 'tuning-row';
        row.title = slider.help;
        row.innerHTML = `<span class="tuning-label">${slider.label}</span><output></output><input type="range">`;
        const input = row.querySelector('input')!;
        const output = row.querySelector('output')!;
        input.min = String(slider.min);
        input.max = String(slider.max);
        input.step = String(slider.step);
        input.value = String(getAt(this.tuning, slider.path));
        input.addEventListener('input', () => {
          setAt(this.tuning, slider.path, Number(input.value));
          // A common value changes what every tank's ± works out to, so refresh all.
          for (const path of this.inputs.keys()) this.refresh(path);
          this.persist();
          this.onChange(slider.path);
        });
        // Keep the arrow keys and C/T for the game, not the focused slider.
        input.addEventListener('keydown', (e) => {
          if (['KeyC', 'KeyT', 'KeyP', 'KeyF', 'ShiftLeft', 'ShiftRight'].includes(e.code)) input.blur();
        });
        section.appendChild(row);
        this.inputs.set(slider.path, { input, output, slider });
        this.refresh(slider.path);
      }
      body.appendChild(section);
    }

    el.querySelector('[data-action="copy"]')!.addEventListener('click', () => void this.copy());
    el.querySelector('[data-action="reset"]')!.addEventListener('click', () => this.reset());
    this.element = el;
    // Values remembered from an earlier visit change the game just like moving
    // the slider does, so report them the same way. (Without this, a saved
    // arena size changed the edge in the simulation but not the drawn ring.)
    for (const path of restored) this.onChange(path);
  }

  toggle(): void {
    this.element.classList.toggle('collapsed');
  }

  /** Text to paste in the chat: only the values that differ from the defaults. */
  valuesText(): string {
    const lines = [`Ice Tank Sumo tuning changes (build ${this.buildLabel})`];
    for (const { slider } of this.inputs.values()) {
      const value = getAt(this.tuning, slider.path);
      const base = getAt(DEFAULT_TUNING, slider.path);
      if (value === base) continue;
      const d = decimals(slider.step);
      lines.push(`${slider.path} = ${value.toFixed(d)}   (default ${base.toFixed(d)})`);
    }
    if (lines.length === 1) lines.push('No changes from the defaults.');
    return lines.join('\n');
  }

  private refresh(path: string): void {
    const entry = this.inputs.get(path);
    if (!entry) return;
    const value = getAt(this.tuning, path);
    entry.output.textContent = entry.slider.show ? entry.slider.show(value, this.tuning) : value.toFixed(decimals(entry.slider.step));
    const changed = value !== getAt(DEFAULT_TUNING, path);
    entry.output.classList.toggle('changed', changed);
  }

  private persist(): void {
    const values: Saved = {};
    for (const path of this.inputs.keys()) {
      const value = getAt(this.tuning, path);
      const base = getAt(DEFAULT_TUNING, path);
      if (value !== base) values[path] = { value, base };
    }
    save(values);
  }

  private async copy(): Promise<void> {
    const text = this.valuesText();
    try {
      await navigator.clipboard.writeText(text);
      this.fallback.hidden = true;
      this.status.textContent = 'Copied. Paste it in the chat.';
    } catch {
      // Clipboard blocked: show the text so it can be copied by hand.
      this.fallback.hidden = false;
      this.fallback.value = text;
      this.fallback.select();
      this.status.textContent = 'Select the text below and copy it.';
    }
  }

  private reset(): void {
    for (const [path, entry] of this.inputs) {
      const value = getAt(DEFAULT_TUNING, path);
      setAt(this.tuning, path, value);
      entry.input.value = String(value);
      this.refresh(path);
      this.onChange(path);
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.status.textContent = 'Back to the defaults.';
  }
}
