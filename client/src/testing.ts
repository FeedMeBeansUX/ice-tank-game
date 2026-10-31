import * as THREE from 'three';
import { DEFAULT_TUNING, World, createTuning, type TankModel, type TankState } from '@ice-tank-sumo/shared';
import { GameScene } from './scene';
import { tankInfo } from './tankInfo';
import { PLAYER_COLORS } from './tankView';
import { TuningPanel } from './tuningPanel';

/**
 * Testing area: a test tool, not a game mode (phase 2 exception). One tank of
 * each type, each on its own straight strip of ice without the dome, at the
 * south end facing north (or turned by the start rotation). Nobody drives:
 * the only control is a one-time push from the south for every tank at once,
 * like a projectile hit, to compare how the tanks react in neutral conditions. Tuning sliders (T) work as usual; R puts everyone back.
 * Strip sizes and the push live in tuning.ts (`testing`).
 */
export function startTesting(canvas: HTMLCanvasElement, buildLabel: string): void {
  const tuning = createTuning();
  // Neutral: no firing, no powerups, no shrinking ice.
  tuning.combat.firingEnabled = false;
  tuning.combat.dummiesFire = false;
  tuning.powerups.enabled = false;
  tuning.arena.shrinkEnabled = false;

  const world = new World(tuning, 20261031);
  const MODELS: TankModel[] = ['modelA', 'modelB', 'modelC', 'modelD', 'modelE', 'modelF', 'modelG'];
  for (const model of MODELS) world.addTank({ name: tankInfo(model).name, model, isDummy: true, x: 0, z: 0 });
  world.startTesting();

  const COLORS = [...PLAYER_COLORS, '#ffd23f', '#ff5d8f', '#4de0c8'];
  const colorOf = (t: TankState) => COLORS[t.id % COLORS.length]!;
  const scene = new GameScene(canvas, tuning, colorOf, (id) => COLORS[id % COLORS.length]!);
  scene.setStrips(world.strips);
  // Seen from the south, so north is straight up on screen.
  scene.view.setYaw(0);
  scene.view.setMode('overview');

  // Frame all strips: the overview shows overviewFraction × 2 × arenaRadius on the screen's shorter side.
  const fit = () => {
    const strips = world.strips!;
    const width = 2 * Math.max(...strips.map((s) => Math.abs(s.x) + s.halfWidth)) + 6;
    const length = 2 * Math.max(...strips.map((s) => s.halfLength)) + 10;
    const aspect = window.innerWidth / window.innerHeight;
    const shortSide = aspect >= 1 ? Math.max(length, width / aspect) : Math.max(width, length * aspect);
    scene.view.arenaRadius = shortSide / (2 * DEFAULT_TUNING.camera.overviewFraction);
  };
  fit();
  scene.view.snap();
  window.addEventListener('resize', fit);

  const panel = new TuningPanel(tuning, buildLabel, () => {});
  document.body.appendChild(panel.element);

  // Top-left: what this is and the keys.
  document.getElementById('hud')!.hidden = false;
  document.getElementById('hud-tag')!.textContent = 'testing area';
  document.getElementById('hud-help')!.innerHTML =
    `<div class="hud-help"><span><kbd>Space</kbd> push</span><span><kbd>R</kbd> back to the start</span><span><kbd>T</kbd> tuning</span></div>`;

  // Bottom: the push button, then sliders for the push size and the tanks' start rotation.
  const bar = document.createElement('div');
  bar.id = 'test-bar';
  bar.innerHTML = `
    <button type="button" class="primary" data-action="push">Push from behind <kbd>Space</kbd></button>
    <label>Push <input type="range" data-set="push" min="0" max="40" step="0.5"> <b data-show="push"></b></label>
    <label>Start rotation <input type="range" data-set="rotationDeg" min="-180" max="180" step="5"> <b data-show="rotationDeg"></b></label>`;
  document.body.appendChild(bar);
  const pushButton = bar.querySelector<HTMLButtonElement>('[data-action="push"]')!;
  const pushSlider = bar.querySelector<HTMLInputElement>('[data-set="push"]')!;
  const rotationSlider = bar.querySelector<HTMLInputElement>('[data-set="rotationDeg"]')!;
  const facing = (deg: number) => {
    const names: [number, string][] = [[-180, 'south'], [-90, 'west'], [0, 'north'], [90, 'east'], [180, 'south']];
    const exact = names.find(([d]) => d === deg);
    return exact ? `${deg}° (${exact[1]})` : `${deg}°`;
  };
  const showValues = () => {
    bar.querySelector('[data-show="push"]')!.textContent = `${tuning.testing.push} m/s`;
    bar.querySelector('[data-show="rotationDeg"]')!.textContent = facing(tuning.testing.rotationDeg);
  };
  pushSlider.value = String(tuning.testing.push);
  rotationSlider.value = String(tuning.testing.rotationDeg);
  showValues();
  pushSlider.addEventListener('input', () => {
    tuning.testing.push = Number(pushSlider.value);
    showValues();
  });
  // A new start rotation puts every tank back at its start, turned.
  rotationSlider.addEventListener('input', () => {
    tuning.testing.rotationDeg = Number(rotationSlider.value);
    showValues();
    reset();
  });
  // Space and R belong to the game, not to the slider or button that was clicked last.
  bar.querySelectorAll('button, input').forEach((el) => el.addEventListener('pointerup', () => (el as HTMLElement).blur()));

  const push = () => {
    for (const t of world.tanks) world.testPush(t, tuning.testing.push);
  };
  const reset = () => {
    world.startTesting();
    for (const t of world.tanks) scene.snapTank(t);
  };
  pushButton.addEventListener('click', push);
  window.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    // Typing in the tuning panel's number fields stays there (range sliders don't take typing).
    if (el.closest('textarea, select, input:not([type="range"])')) return;
    if (e.code === 'Space') push();
    else if (e.code === 'KeyR') reset();
    else if (e.code === 'KeyT') panel.toggle();
    else return;
    e.preventDefault();
  });

  // Tank names under each strip.
  const names = world.tanks.map((t) => {
    const el = document.createElement('div');
    el.className = 'test-name';
    el.textContent = t.name;
    el.style.color = colorOf(t);
    document.body.appendChild(el);
    return el;
  });
  const at = new THREE.Vector3();
  const placeNames = () => {
    world.tanks.forEach((t, i) => {
      const s = world.stripOf(t);
      if (!s) return;
      at.set(s.x, 0, s.z + s.halfLength + 1.4).project(scene.view.camera);
      names[i]!.style.left = `${((at.x + 1) / 2) * window.innerWidth}px`;
      names[i]!.style.top = `${((1 - at.y) / 2) * window.innerHeight}px`;
    });
  };

  // Main loop: physics in fixed steps, drawing smoothed in between (as in Sandbox).
  const timer = new THREE.Timer();
  let accumulator = 0;
  scene.renderer.setAnimationLoop((timestamp: number) => {
    timer.update(timestamp);
    const frameDt = Math.min(timer.getDelta(), 0.25);
    accumulator += frameDt;
    while (accumulator >= world.dt) {
      scene.capture(world);
      world.step();
      const events = world.takeEvents();
      for (const e of events) if (e.type === 'respawned') scene.snapTank(world.tanks[e.tankId]!);
      scene.effects(events, null, world.tanks);
      accumulator -= world.dt;
    }
    scene.draw(world, null, accumulator / world.dt, timer.getElapsed(), frameDt, false);
    scene.render(frameDt, null, null);
    placeNames();
  });

  // Handy for automated checks in the browser console.
  (window as unknown as { __testing: unknown }).__testing = { world, view: scene.view, tuning, push, reset };
}
