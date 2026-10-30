import { buildIceSkimmer } from './agileModel';
import { buildHeavy } from './heavyModel';
import { startPreview } from './previewPage';
import { buildFrostPhantom } from './stealthModel';
import { buildGlacierWraith } from './stealthVariants';

/** Stealth detail study (stealth.html): the chosen Frost Phantom, the Glacier Wraith alternative, and the Agile and Heavy for comparison. */

startPreview({
  title: 'Stealth detail study',
  intro: 'Two Stealth variants in the style of the new Heavy and Agile, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '3 · Frost Phantom', sub: 'in the game now', build: buildFrostPhantom },
    { name: '2 · Glacier Wraith', sub: 'current shape, Glacier style', build: buildGlacierWraith },
    { name: 'Agile', sub: 'style reference', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './laser.html', label: 'Laser detail study →' },
    { href: './agile.html', label: '← Agile detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
