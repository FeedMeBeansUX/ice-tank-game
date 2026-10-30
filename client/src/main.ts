import { DEFAULT_TUNING, MAX_RATING, cleanUpgrades, type TankModel, type Upgrades } from '@ice-tank-sumo/shared';
import { startOnline } from './online';
import { startPractice, type PracticeMode } from './practice';
import { applyPropertyClick, pointsLeft, propertyRows } from './propertyBars';
import { createStartView, type StartView } from './startView';
import { tankInfo, TANKS } from './tankInfo';

declare const __BUILD_LABEL__: string;

/**
 * Start screen: pick a tank (3D view), see its properties, spend upgrade
 * points, then practice on your own or join the online test room.
 * Online play needs the game server; it is available when this page was
 * opened from the server (`npm start` in the repo), not on GitHub Pages.
 */

const canvas = document.getElementById('game') as HTMLCanvasElement;
const start = document.getElementById('start')!;
const nameInput = document.getElementById('start-name') as HTMLInputElement;
const joinButton = document.getElementById('start-join') as HTMLButtonElement;
const onlineStatus = document.getElementById('start-online-status')!;
const errorText = document.getElementById('start-error')!;
document.getElementById('build')!.textContent = `build ${__BUILD_LABEL__}`;

const NAME_KEY = 'ice-tank-sumo.name';
const MODEL_KEY = 'ice-tank-sumo.model';
const UPGRADES_KEY = 'ice-tank-sumo.upgrades';
const T = DEFAULT_TUNING;

// The picked tank and upgrade points, remembered between visits.
let model: TankModel = 'modelA';
let upgrades: Upgrades = cleanUpgrades({}, T, model);
try {
  const savedModel = localStorage.getItem(MODEL_KEY);
  if (savedModel && TANKS.some((t) => t.model === savedModel)) model = savedModel as TankModel;
  upgrades = cleanUpgrades(JSON.parse(localStorage.getItem(UPGRADES_KEY) ?? '{}'), T, model);
} catch {
  // storage unavailable
}
const remember = () => {
  try {
    localStorage.setItem(MODEL_KEY, model);
    localStorage.setItem(UPGRADES_KEY, JSON.stringify(upgrades));
  } catch {
    // ignore
  }
};

/** The side panel: the picked tank's description, its five properties and the upgrade points. */
function renderPanel(): void {
  const info = tankInfo(model);
  document.getElementById('tp-name')!.textContent = info.name;
  document.getElementById('tp-ability')!.textContent = `Ability: ${info.ability}`;
  document.getElementById('tp-text')!.textContent = info.text;
  document.getElementById('tp-ability-text')!.textContent = `${info.ability} (Shift): ${info.abilityText}`;
  document.getElementById('tp-points')!.textContent = `${pointsLeft(T, upgrades)} of ${T.upgrades.points} upgrade points left`;
  document.getElementById('tp-upgrade-help')!.textContent = `Blue: the tank's own rating. Gold: your upgrade points, each adding ${T.upgrades.percentPerPoint}% to what the property stands for. A property can't go past ${MAX_RATING}.`;
  document.getElementById('tp-props')!.innerHTML = propertyRows(T, model, upgrades);
}
document.getElementById('tp-props')!.addEventListener('click', (e) => {
  const next = applyPropertyClick(e.target, T, model, upgrades);
  if (!next) return;
  upgrades = next;
  remember();
  renderPanel();
});

// The 3D tank line-up behind the panel.
const startCanvas = document.getElementById('start-view') as HTMLCanvasElement;
const startLabels = document.getElementById('start-labels')!;
let view: StartView | null = null;
function showStart(): void {
  start.hidden = false;
  renderPanel();
  const panel = document.getElementById('tank-panel')!;
  // Where the tanks go: left of the panel, or above it on narrow screens.
  const freeArea = () => {
    const c = startCanvas.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    if (r.left > c.left + c.width * 0.4) return { x: 0, y: 0, w: r.left - c.left - 16, h: c.height };
    return { x: 0, y: 0, w: c.width, h: r.top - c.top };
  };
  view ??= createStartView(startCanvas, startLabels, freeArea, model, (m) => {
    model = m;
    // Points that don't fit the new tank (a property at its maximum) drop out.
    upgrades = cleanUpgrades(upgrades, T, model);
    remember();
    renderPanel();
  });
}
showStart();
let mode: PracticeMode = 'sumo';
const modeHelp: Record<PracticeMode, string> = {
  sumo: 'Sumo: knock the others off the round arena.',
  race: 'Race: up to 6 tanks on a new ice track every race; first to 3 laps wins. Fall off and you are put back on the track.',
};
document.querySelectorAll<HTMLButtonElement>('#start-mode button').forEach((b) =>
  b.addEventListener('click', () => {
    mode = b.dataset.value as PracticeMode;
    document.querySelectorAll('#start-mode button').forEach((x) => x.classList.toggle('on', x === b));
    document.getElementById('start-mode-help')!.textContent = modeHelp[mode];
  }),
);
try {
  nameInput.value = localStorage.getItem(NAME_KEY) ?? '';
} catch {
  // storage unavailable
}

function close(): void {
  start.hidden = true;
  view?.dispose();
  view = null;
}

// Mobile mode: remembered, and on by default on touch screens.
const MOBILE_KEY = 'ice-tank-sumo.mobile';
const mobileBox = document.getElementById('start-mobile') as HTMLInputElement;
try {
  const saved = localStorage.getItem(MOBILE_KEY);
  mobileBox.checked = saved !== null ? saved === '1' : window.matchMedia('(pointer: coarse)').matches;
} catch {
  mobileBox.checked = window.matchMedia('(pointer: coarse)').matches;
}
mobileBox.addEventListener('change', () => {
  try {
    localStorage.setItem(MOBILE_KEY, mobileBox.checked ? '1' : '0');
  } catch {
    // ignore
  }
});

document.getElementById('start-practice')!.addEventListener('click', () => {
  close();
  startPractice(canvas, __BUILD_LABEL__, mode, mobileBox.checked, model, upgrades);
});

function join(): void {
  const name = nameInput.value.trim().slice(0, 16);
  if (!name) {
    errorText.textContent = 'Enter a name first.';
    nameInput.focus();
    return;
  }
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
  close();
  startOnline(canvas, name, model, upgrades, mobileBox.checked, (text) => {
    // Couldn't connect: back to the start screen with the reason.
    location.hash = '';
    showStart();
    errorText.textContent = text;
  });
}
joinButton.addEventListener('click', join);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') join();
});

// Is the game server here? (Yes when this page came from `npm start`.)
fetch('./api/info', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then((info: { server?: string }) => {
    if (info.server !== 'ice-tank-sumo') throw new Error('not our server');
    onlineStatus.textContent = 'Game server found. Up to 4 players: open this page in more windows, or share the address with friends on your Wi-Fi.';
    joinButton.disabled = false;
    nameInput.disabled = false;
  })
  .catch(() => {
    onlineStatus.innerHTML =
      'Online play needs the game server, which runs from the repository on your computer: run <code>npm start</code> there (see the README), then open the address it shows.';
    joinButton.disabled = true;
    nameInput.disabled = true;
  });
