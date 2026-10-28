import type { TankModel } from '@ice-tank-sumo/shared';
import { startOnline } from './online';
import { startPractice } from './practice';

declare const __BUILD_LABEL__: string;

/**
 * Start screen: practice on your own, or join the online test room.
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
let model: TankModel = 'modelA';
try {
  nameInput.value = localStorage.getItem(NAME_KEY) ?? '';
} catch {
  // storage unavailable
}

document.querySelectorAll<HTMLButtonElement>('#start-model button').forEach((b) =>
  b.addEventListener('click', () => {
    model = b.dataset.value as TankModel;
    document.querySelectorAll('#start-model button').forEach((x) => x.classList.toggle('on', x === b));
  }),
);

function close(): void {
  start.hidden = true;
}

document.getElementById('start-practice')!.addEventListener('click', () => {
  close();
  startPractice(canvas, __BUILD_LABEL__);
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
  startOnline(canvas, name, model, (text) => {
    // Couldn't connect: back to the start screen with the reason.
    location.hash = '';
    start.hidden = false;
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
