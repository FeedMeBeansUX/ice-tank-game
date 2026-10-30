import { buildIceSkimmer } from './agileModel';
import { buildHeavy } from './heavyModel';
import { startPreview } from './previewPage';
import { buildFrostPhantom, buildGlacierWraith } from './stealthVariants';
import { buildTank } from './tankView';

/** Stealth detail study (stealth.html): the current Stealth, two Glacier-style variants, and the new Agile and Heavy for comparison. */

startPreview({
  title: 'Stealth detail study',
  intro: 'Two Stealth variants in the style of the new Heavy and Agile, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '1 · Stealth', sub: 'current game model', build: (color) => buildTank('modelC', color) },
    { name: '2 · Glacier Wraith', sub: 'current shape, Glacier style', build: buildGlacierWraith },
    { name: '3 · Frost Phantom', sub: 'stealth-jet look', build: buildFrostPhantom },
    { name: 'Agile', sub: 'style reference', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './agile.html', label: '← Agile detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
