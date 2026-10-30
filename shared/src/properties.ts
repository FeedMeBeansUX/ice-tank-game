import type { TankModel, Tuning } from './tuning';

/**
 * The five tank properties shown on the start screen. Each one sums up
 * several tuning values into a rating from 1 to 10, and is also what upgrade
 * points go into (each point adds upgrades.percentPerPoint % to the values
 * behind it, see World).
 *
 * The ratings are worked out from the tank's current tuning values, on fixed
 * scales (so changing one tank never moves another tank's rating). 5 = the
 * common value (a share of 1); each step is a fixed amount above or below it.
 * Upgrade points add to the rating, up to MAX_RATING. Base ratings stop one
 * below that, so every tank can put at least one point into every property.
 */

/** A property's rating can't go above this (base rating plus upgrade points). */
export const MAX_RATING = 10;

export type PropertyKey = 'speed' | 'grip' | 'weight' | 'firepower' | 'range';

export interface PropertyInfo {
  key: PropertyKey;
  label: string;
  /** What it means, in plain words. */
  help: string;
  /** What an upgrade point improves. */
  upgrade: string;
}

export const PROPERTIES: PropertyInfo[] = [
  { key: 'speed', label: 'Speed', help: 'How quickly the tank gets going, and its top speed.', upgrade: 'more thrust and top speed' },
  { key: 'grip', label: 'Grip', help: 'How fast sideways sliding fades. Low grip = drifting.', upgrade: 'more traction' },
  { key: 'weight', label: 'Weight', help: 'How hard the tank is to push, and how hard its bumps hit.', upgrade: 'harder to push, harder bumps' },
  { key: 'firepower', label: 'Firepower', help: 'How hard it pushes others with its weapon: push per shot and shots per second.', upgrade: 'more push per hit (laser: stronger beam)' },
  { key: 'range', label: 'Range', help: 'How far away it can hit others.', upgrade: 'longer firing range' },
];

export type Upgrades = Record<PropertyKey, number>;

export const NO_UPGRADES: Upgrades = { speed: 0, grip: 0, weight: 0, firepower: 0, range: 0 };

/** How many points can go into one property of this tank: up to the rating maximum, and at most maxPerAttribute. */
export function upgradeRoom(tuning: Tuning, model: TankModel, key: PropertyKey): number {
  return Math.max(0, Math.min(tuning.upgrades.maxPerAttribute, MAX_RATING - baseRatings(tuning, model)[key]));
}

/** Upgrades from untrusted input (a client) for this tank: whole numbers, within the per-property and total limits. */
export function cleanUpgrades(raw: unknown, tuning: Tuning, model: TankModel): Upgrades {
  const out: Upgrades = { ...NO_UPGRADES };
  if (!raw || typeof raw !== 'object') return out;
  let left = tuning.upgrades.points;
  for (const { key } of PROPERTIES) {
    const v = Math.floor(Number((raw as Record<string, unknown>)[key]) || 0);
    const take = Math.max(0, Math.min(v, upgradeRoom(tuning, model, key), left));
    out[key] = take;
    left -= take;
  }
  return out;
}

const clampRating = (v: number) => Math.max(1, Math.min(MAX_RATING - 1, Math.round(v)));

/**
 * How much of an ability's effect counts toward the base ratings: the share
 * of the rating gain the ability gives while it is active. Abilities are used
 * at the key moment but aren't always on, so they count for part.
 */
export const ABILITY_WEIGHT = 0.75;
/** An ability adds at most this many rating steps to a property. */
export const ABILITY_MAX_BONUS = 2;

/** Unrounded property scores (1 = the common value) of a tank, optionally with its ability active. */
function scores(tuning: Tuning, model: TankModel, abilityOn: boolean): Record<PropertyKey, number> {
  const t = tuning.tanks[model];
  const A = tuning.abilities;
  // Speed: half the push of one click (thrust × burst length, per mass), half the top speed.
  // Agile's Boost multiplies both.
  const boost = abilityOn && model === 'modelA' ? A.boost.speedMultiplier : 1;
  const kick = (t.thrustShare * boost * (t.burstSeconds / 0.3)) / t.massShare;
  const speed = 0.5 * kick + 0.5 * t.topSpeedShare * boost;
  // Weight: mass, and how hard its bumps hit.
  const weight = t.massShare * t.bumpMultiplier;
  // Firepower: half the push of one shot (all pellets / the whole salvo / one beam),
  // half the push per second. Lobbed shells hit an area, which counts a bit extra.
  // Power shot (Heavy) and explosive shells (Artillery) multiply the push; a grenade
  // (Shotgun) adds one big blast per cooldown; a drone (Rocket) adds its gun's push.
  const shotBoost =
    abilityOn && model === 'modelB' ? A.powerShot.impactMultiplier : abilityOn && model === 'modelF' ? A.explosiveShells.impactMultiplier : 1;
  let perShot =
    t.laserForce > 0
      ? t.laserForce * t.beamSeconds
      : t.projectileImpact * shotBoost * Math.max(1, t.pellets) * Math.max(1, t.salvo) * (t.lobbed ? 1.25 : 1);
  const cycle = t.laserForce > 0 ? t.beamSeconds + t.beamPauseSeconds : t.timeBetweenShots;
  let perSecond = perShot / Math.max(0.05, cycle);
  if (abilityOn && model === 'modelE') {
    perShot = Math.max(perShot, A.grenade.impact);
    perSecond += A.grenade.impact / A.grenade.cooldown;
  }
  if (abilityOn && model === 'modelG') perSecond += A.drone.impact / A.drone.timeBetweenShots;
  const firepower = 0.5 * (perShot / 10) + 0.5 * (perSecond / 12);
  // Range: its firing range; a grenade throw (Shotgun) or a placed drone (Rocket) reaches further.
  let range = t.rangeMultiplier;
  const common = tuning.combat.rangeMetres;
  if (abilityOn && model === 'modelE') range = Math.max(range, A.grenade.maxThrow / common);
  if (abilityOn && model === 'modelG') range = Math.max(range, (A.drone.maxPlace + A.drone.range) / common);
  return { speed, grip: t.tractionShare, weight, firepower, range };
}

/** Score → rating steps (5 = the common value), unrounded. */
function toSteps(s: Record<PropertyKey, number>): Record<PropertyKey, number> {
  return {
    speed: 5 + (s.speed - 1) * 10,
    grip: 5 + (s.grip - 1) * 12,
    weight: 5 + (s.weight - 1) * 10,
    firepower: 5 + (s.firepower - 1) * 6,
    range: 5 + (s.range - 1) * 6,
  };
}

/**
 * A tank's base ratings (1–9) for the five properties, from its tuning values,
 * including part of what its ability adds (ABILITY_WEIGHT, at most
 * ABILITY_MAX_BONUS steps): Boost → Speed,
 * Power shot and Explosive shells → Firepower, Grenade and Drone → Firepower
 * and Range. Smoke (Stealth) and EMP (Laser) don't map onto a property.
 */
export function baseRatings(tuning: Tuning, model: TankModel): Upgrades {
  const off = toSteps(scores(tuning, model, false));
  const on = toSteps(scores(tuning, model, true));
  const out = { ...NO_UPGRADES };
  for (const { key } of PROPERTIES) out[key] = clampRating(off[key] + Math.min(ABILITY_MAX_BONUS, ABILITY_WEIGHT * Math.max(0, on[key] - off[key])));
  return out;
}

/** Ratings without the ability's share (for comparison). */
export function ratingsWithoutAbility(tuning: Tuning, model: TankModel): Upgrades {
  const off = toSteps(scores(tuning, model, false));
  const out = { ...NO_UPGRADES };
  for (const { key } of PROPERTIES) out[key] = clampRating(off[key]);
  return out;
}
