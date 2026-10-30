import type { TankModel } from '@ice-tank-sumo/shared';
import { startPreview } from './previewPage';
import { buildTank } from './tankView';

/** Tank line-up (tanks.html): every tank model side by side. */

const MODELS: [TankModel, string][] = [
  ['modelA', 'Agile'],
  ['modelB', 'Heavy'],
  ['modelC', 'Stealth'],
  ['modelD', 'Laser'],
  ['modelE', 'Shotgun'],
  ['modelF', 'Artillery'],
  ['modelG', 'Rocket'],
];

startPreview({
  title: 'Tank line-up',
  intro: 'Game camera angle and lighting. Drag to turn the tanks.',
  items: MODELS.map(([model, name]) => ({ name, sub: model.replace('model', ''), build: (color) => buildTank(model, color) })),
  zooms: [1, 2, 3],
  defaultZoom: 2,
  spacing: 3.5,
  links: [
    { href: './heavy.html', label: 'Heavy detail study →' },
    { href: './agile.html', label: 'Agile detail study →' },
    { href: './stealth.html', label: 'Stealth detail study →' },
    { href: './', label: '← Back to the game' },
  ],
});
