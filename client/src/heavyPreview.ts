import { buildHeavy } from './heavyModel';
import { buildRamLite, buildRamTiger, buildTiger } from './heavyVariants';
import { startPreview } from './previewPage';

/** Heavy detail study (heavy.html): three levels of detail for the Heavy, side by side. */

startPreview({
  title: 'Heavy detail study',
  intro: 'Levels of detail for the Heavy, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '2 · Glacier Ram', sub: 'in the game now', build: buildHeavy },
    { name: '3 · Ram Lite', sub: 'simpler Glacier Ram', build: buildRamLite },
    { name: '4 · Ram × Tiger', sub: 'hybrid', build: buildRamTiger },
    { name: '5 · Tiger', sub: 'based on Tiger I', build: buildTiger },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.4,
  links: [
    { href: './agile.html', label: 'Agile detail study →' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
