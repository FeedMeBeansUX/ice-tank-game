import type { TankModel } from '@ice-tank-sumo/shared';

/** Names, abilities and short descriptions of the tanks, for the start screen. */
export interface TankInfo {
  model: TankModel;
  name: string;
  ability: string;
  /** One or two sentences: how it plays. */
  text: string;
  /** What the ability does. */
  abilityText: string;
}

export const TANKS: TankInfo[] = [
  {
    model: 'modelA',
    name: 'Agile',
    ability: 'Boost',
    text: 'Light and quick, and it slides a lot. Two barrels fire small homing shots in quick turns.',
    abilityText: 'A burst of extra speed for a few seconds.',
  },
  {
    model: 'modelB',
    name: 'Heavy',
    ability: 'Power shot',
    text: 'Heavy and grippy, hard to push around. One big barrel: slow shots with a big push.',
    abilityText: 'Charges the next shots: they push much harder.',
  },
  {
    model: 'modelC',
    name: 'Stealth',
    ability: 'Smoke',
    text: 'Four short tracks and a machine gun: tiny shots at a very high rate, little push each.',
    abilityText: 'Invisible and untargetable for a few seconds; a hit makes it visible again.',
  },
  {
    model: 'modelD',
    name: 'Laser',
    ability: 'EMP',
    text: 'The fastest tank on the ice. Its beam pushes the target steadily while it stays on, at short range.',
    abilityText: 'Disables every tank close by for a moment: no steering, firing or pushing.',
  },
  {
    model: 'modelE',
    name: 'Shotgun',
    ability: 'Grenade',
    text: 'A half-track that fires a cone of pellets: short range, a big push when most of them hit.',
    abilityText: 'Throws a grenade that blasts tanks away where it lands.',
  },
  {
    model: 'modelF',
    name: 'Artillery',
    ability: 'Explosive shells',
    text: 'Lobs shells far across the ice that burst where they land, but can’t hit tanks up close. Sees more of the arena.',
    abilityText: 'For a few seconds its shells push harder and burst wider.',
  },
  {
    model: 'modelG',
    name: 'Rocket',
    ability: 'Drone',
    text: 'A rocket truck that fires homing rockets in pairs.',
    abilityText: 'Places a hovering drone that shoots at nearby tanks.',
  },
];

export const tankInfo = (model: TankModel): TankInfo => TANKS.find((t) => t.model === model) ?? TANKS[0]!;
