import { startPreview } from './previewPage';
import * as P from './projectileVariants';

/** Projectile and mine detail study (projectiles.html): per row the current shape and two Glacier-style variants. */

startPreview({
  title: 'Projectiles & mines study',
  intro: 'Per object: the current shape, then two variants in the Glacier style of the tanks. Shots, missiles, grenades and shells fly 0.9 m up, nose to the right; mines lie on the ice. The inset shows real in-game size.',
  items: [
    { name: 'Shot', sub: 'current', build: (c) => P.shotCurrent(c) },
    { name: 'Shot A · Ice Shard', build: (c) => P.shotShard(c) },
    { name: 'Shot B · Tracer Slug', build: (c) => P.shotSlug(c) },
    { name: 'Missile', sub: 'current', build: (c) => P.missileCurrent(c) },
    { name: 'Missile A · Glacier', build: (c) => P.missileGlacier(c) },
    { name: 'Missile B · Frost Rocket', build: (c) => P.missileFrost(c) },
    { name: 'Grenade', sub: 'current', build: () => P.grenadeCurrent() },
    { name: 'Grenade A · Canister', build: (c) => P.grenadeGlacier(c) },
    { name: 'Grenade B · Ice Puck', build: (c) => P.grenadePuck(c) },
    { name: 'Shell', sub: 'current', build: () => P.shellCurrent(false) },
    { name: 'Shell A · Glacier Shell', build: (c) => P.shellGlacier(c, false) },
    { name: 'Shell B · Mortar Bomb', build: (c) => P.shellBomb(c, false) },
    { name: 'Explosive shell', sub: 'current', build: () => P.shellCurrent(true) },
    { name: 'Explosive A', build: (c) => P.shellGlacier(c, true) },
    { name: 'Explosive B', build: (c) => P.shellBomb(c, true) },
    { name: 'Mine', sub: 'current', build: (c) => P.mineCurrent(c) },
    { name: 'Mine A · Glacier Mine', build: (c) => P.mineGlacier(c) },
    { name: 'Mine B · Frost Mine', build: (c) => P.mineFrost(c) },
  ],
  zooms: [1, 3, 5, 8],
  defaultZoom: 3,
  spacing: 2.1,
  perRow: 6,
  defaultColors: 'orange',
  insetOnStart: false,
  links: [
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
