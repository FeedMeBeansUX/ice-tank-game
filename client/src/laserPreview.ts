import { buildIceSkimmer } from './agileModel';
import { buildHeavy } from './heavyModel';
import { buildGlacierLancer } from './laserModel';
import { buildPrism } from './laserVariants';
import { startPreview } from './previewPage';
import { buildFrostPhantom } from './stealthModel';

/** Laser detail study (laser.html): the chosen Glacier Lancer, the Prism alternative, and the finished tanks for comparison. */

startPreview({
  title: 'Laser detail study',
  intro: 'Two Laser variants in the style of the new Heavy, Agile and Stealth, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '2 · Glacier Lancer', sub: 'in the game now', build: buildGlacierLancer },
    { name: '3 · Prism', sub: 'crystal tech', build: buildPrism },
    { name: 'Agile', sub: 'style reference', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
    { name: 'Stealth', sub: 'style reference', build: buildFrostPhantom },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './shotgun.html', label: 'Shotgun detail study →' },
    { href: './stealth.html', label: '← Stealth detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
