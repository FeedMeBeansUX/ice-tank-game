import { DEFAULT_TUNING as T, projectileRadiusOf } from '@ice-tank-sumo/shared';
import { startPreview } from './previewPage';
import * as P from './projectileVariants';

/** Projectiles page (projectiles.html): everything the tanks fire or drop, the drone, powerups and the bomber, as in the game. */

startPreview({
  title: 'Projectiles & pickups',
  intro: 'Everything the tanks fire or drop, the drone, the powerups and the airstrike bomber, at their in-game sizes. Flying things nose to the right. The inset shows real in-game size.',
  items: [
    { name: 'Agile shot', build: (c) => P.slug(c, projectileRadiusOf(T, 'modelA')) },
    { name: 'Heavy shot', build: (c) => P.slug(c, projectileRadiusOf(T, 'modelB')) },
    { name: 'Power shot', sub: 'Heavy', build: () => P.slug('#ffcc33', projectileRadiusOf(T, 'modelB')) },
    { name: 'MG round', sub: 'Stealth', build: (c) => P.pellet(c, projectileRadiusOf(T, 'modelC')) },
    { name: 'Pellet', sub: 'Shotgun', build: (c) => P.pellet(c, projectileRadiusOf(T, 'modelE')) },
    { name: 'Drone shot', build: (c) => P.pellet(c, T.abilities.drone.projectileRadius) },
    { name: 'Rocket', build: (c) => P.missile(c, 0.75) },
    { name: 'Missile', sub: 'powerup', build: (c) => P.missile(c, 1.4) },
    { name: 'Grenade', sub: 'Shotgun', build: (c) => P.grenade(c) },
    { name: 'Shell', sub: 'Artillery', build: (c) => P.shell(c, false) },
    { name: 'Explosive shell', build: (c) => P.shell(c, true) },
    { name: 'Bomb', sub: 'airstrike', build: () => P.bomb() },
    { name: 'Mine', sub: 'powerup', build: (c) => P.mine(c) },
    { name: 'Drone', sub: 'Rocket', build: (c) => P.drone(c) },
    { name: 'Missile powerup', build: () => P.powerup('missile') },
    { name: 'Mine powerup', build: () => P.powerup('mine') },
    { name: 'Rapid-fire powerup', build: () => P.powerup('rapidFire') },
    { name: 'Airstrike powerup', build: () => P.powerup('airstrike') },
    { name: 'Stealth bomber', sub: 'airstrike', build: (c) => P.bomber(c), ownRow: 6.8 },
  ],
  zooms: [1, 2, 3, 5],
  defaultZoom: 2,
  spacing: 2.45,
  perRow: 6,
  defaultColors: 'orange',
  insetOnStart: false,
  links: [
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
