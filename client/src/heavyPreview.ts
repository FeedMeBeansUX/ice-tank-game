import { buildGlacierRam, buildTiger } from './heavyVariants';
import { startPreview } from './previewPage';
import { buildTank } from './tankView';

/** Heavy detail study (heavy.html): three levels of detail for the Heavy, side by side. */

startPreview({
  title: 'Heavy detail study',
  intro: 'Three levels of detail for the Heavy, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: '1 · Low poly', sub: 'current game model', build: (color) => buildTank('modelB', color) },
    { name: '2 · Glacier Ram', sub: 'imagined', build: buildGlacierRam },
    { name: '3 · Tiger', sub: 'based on Tiger I', build: buildTiger },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 3,
  spacing: 4.2,
  twoRowsBelowAspect: 0.9,
  links: [
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
