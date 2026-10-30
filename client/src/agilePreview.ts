import { buildGlacierDart, buildIceSkimmer } from './agileVariants';
import { buildHeavy } from './heavyModel';
import { startPreview } from './previewPage';
import { buildTank } from './tankView';

/** Agile detail study (agile.html): the current Agile, two Glacier-style variants, and the new Heavy for comparison. */

startPreview({
  title: 'Agile detail study',
  intro: 'Two Agile variants in the style of the new Heavy, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '1 · Agile', sub: 'current game model', build: (color) => buildTank('modelA', color) },
    { name: '2 · Glacier Dart', sub: 'Heavy style, low wedge', build: buildGlacierDart },
    { name: '3 · Ice Skimmer', sub: 'sleeker, racier', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './heavy.html', label: '← Heavy detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
