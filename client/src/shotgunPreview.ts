import { buildIceSkimmer } from './agileModel';
import { buildHeavy } from './heavyModel';
import { buildGlacierLancer } from './laserModel';
import { startPreview } from './previewPage';
import { buildFrostBreaker, buildGlacierBrawler } from './shotgunVariants';
import { buildFrostPhantom } from './stealthModel';
import { buildTank } from './tankView';

/** Shotgun detail study (shotgun.html): the current Shotgun, two Glacier-style variants, and the finished tanks for comparison. */

startPreview({
  title: 'Shotgun detail study',
  intro: 'Two Shotgun variants in the style of the finished tanks, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '1 · Shotgun', sub: 'current game model', build: (color) => buildTank('modelE', color) },
    { name: '2 · Glacier Brawler', sub: 'current shape, Glacier style', build: buildGlacierBrawler },
    { name: '3 · Frost Breaker', sub: 'meaner, double barrel', build: buildFrostBreaker },
    { name: 'Agile', sub: 'style reference', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
    { name: 'Stealth', sub: 'style reference', build: buildFrostPhantom },
    { name: 'Laser', sub: 'style reference', build: buildGlacierLancer },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './laser.html', label: '← Laser detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
