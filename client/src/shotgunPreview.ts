import { buildIceSkimmer } from './agileModel';
import { buildHeavy } from './heavyModel';
import { buildGlacierLancer } from './laserModel';
import { startPreview } from './previewPage';
import { buildFrostBreaker } from './shotgunModel';
import { buildGlacierBrawler } from './shotgunVariants';
import { buildFrostPhantom } from './stealthModel';

/** Shotgun detail study (shotgun.html): the chosen Frost Breaker, the Glacier Brawler alternative, and the finished tanks for comparison. */

startPreview({
  title: 'Shotgun detail study',
  intro: 'Two Shotgun variants in the style of the finished tanks, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '3 · Frost Breaker', sub: 'in the game now', build: buildFrostBreaker },
    { name: '2 · Glacier Brawler', sub: 'current shape, Glacier style', build: buildGlacierBrawler },
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
