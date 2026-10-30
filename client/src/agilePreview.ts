import { buildIceSkimmer } from './agileModel';
import { buildGlacierDart } from './agileVariants';
import { buildHeavy } from './heavyModel';
import { startPreview } from './previewPage';

/** Agile detail study (agile.html): the chosen Ice Skimmer, the Glacier Dart alternative, and the Heavy for comparison. */

startPreview({
  title: 'Agile detail study',
  intro: 'Two Agile variants in the style of the new Heavy, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '3 · Ice Skimmer', sub: 'in the game now', build: buildIceSkimmer },
    { name: '2 · Glacier Dart', sub: 'Heavy style, low wedge', build: buildGlacierDart },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './stealth.html', label: 'Stealth detail study →' },
    { href: './heavy.html', label: '← Heavy detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
