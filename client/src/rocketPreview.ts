import { buildIceSkimmer } from './agileModel';
import { buildGlacierHowitzer } from './artilleryModel';
import { buildHeavy } from './heavyModel';
import { buildGlacierLancer } from './laserModel';
import { startPreview } from './previewPage';
import { buildRocket } from './rocketModel';
import { buildBlizzard, buildGlacierLauncher } from './rocketVariants';
import { buildFrostBreaker } from './shotgunModel';
import { buildFrostPhantom } from './stealthModel';

/** Rocket detail study (rocket.html): the chosen Rocket, the two variants it was combined from, and the finished tanks for comparison. */

startPreview({
  title: 'Rocket detail study',
  intro: 'Two Rocket variants in the style of the finished tanks, with the game camera angle and lighting. The inset shows them at real in-game size. Drag to turn the tanks.',
  items: [
    { name: 'Rocket', sub: 'in the game now: Launcher + Blizzard turret', build: buildRocket },
    { name: '2 · Glacier Launcher', sub: 'six-tube pod', build: buildGlacierLauncher },
    { name: '3 · Blizzard', sub: 'tracked, twin pods', build: buildBlizzard },
    { name: 'Agile', sub: 'style reference', build: buildIceSkimmer },
    { name: 'Heavy', sub: 'style reference', build: buildHeavy },
    { name: 'Stealth', sub: 'style reference', build: buildFrostPhantom },
    { name: 'Laser', sub: 'style reference', build: buildGlacierLancer },
    { name: 'Shotgun', sub: 'style reference', build: buildFrostBreaker },
    { name: 'Artillery', sub: 'style reference', build: buildGlacierHowitzer },
  ],
  zooms: [1, 2, 3, 4],
  defaultZoom: 2,
  spacing: 4.2,
  links: [
    { href: './artillery.html', label: '← Artillery detail study' },
    { href: './tanks.html', label: '← All tanks' },
    { href: './', label: '← Back to the game' },
  ],
});
