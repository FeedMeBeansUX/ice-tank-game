import * as THREE from 'three';
import { World, createTuning, type TankModel, type TankState } from '@ice-tank-sumo/shared';
import { createArena, type Arena } from './arena';
import { TopDownCamera } from './camera';
import { PracticeMenu, type PracticeSetup } from './practiceMenu';
import { DUMMY_COLOR, GroundMarkers, PLAYER_COLORS, ProjectileViews, TankView } from './tankView';
import { TuningPanel } from './tuningPanel';

declare const __BUILD_LABEL__: string;

/**
 * Practice mode: your tank and three dummy tanks on the ice. The whole game
 * runs here in the browser using the shared simulation.
 */

const canvas = document.getElementById('game') as HTMLCanvasElement;
const camLabel = document.getElementById('hud-cam')!;
const statsLabel = document.getElementById('hud-stats')!;
const banner = document.getElementById('banner')!;
const weaponHud = document.getElementById('weapon')!;
document.getElementById('build')!.textContent = `build ${__BUILD_LABEL__}`;

const OWN_COLOR = PLAYER_COLORS[0]!;
const DUMMY_SHOT_COLOR = '#e4eaef';

// Live tuning values (the slider panel edits this object)
const tuning = createTuning();
const panel = new TuningPanel(tuning, __BUILD_LABEL__, (path) => {
  if (path === 'arena.radius') rebuildArena();
});
document.body.appendChild(panel.element);

// Simulation: you plus three dummies, spread out around the centre
const world = new World(tuning, 20261028);
let setup: PracticeSetup = { model: 'modelA', upgrades: { firepower: 0, speed: 0, traction: 0 }, dummies: 'modelA' };
const dummyModel = (i: number): TankModel =>
  setup.dummies === 'mixed' ? (i % 2 === 1 ? 'modelB' : 'modelA') : setup.dummies;
['You', 'Dummy 1', 'Dummy 2', 'Dummy 3'].forEach((name, i) => {
  const a = Math.PI / 2 + (i * Math.PI) / 2;
  const r = 9;
  world.addTank({ name, model: i === 0 ? setup.model : dummyModel(i), isDummy: i > 0, x: Math.cos(a) * r, z: Math.sin(a) * r });
});
const me = world.tanks[0]!;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// Scene with a plain, static dark blue backdrop
const scene = new THREE.Scene();
scene.background = new THREE.Color('#06121d');

// Light: soft sky light plus a low sun for facet contrast and shadows
scene.add(new THREE.HemisphereLight('#d6ecff', '#0a1c2a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e6', 1.8);
sun.position.set(-35, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun);

let arena: Arena | null = null;
function rebuildArena(): void {
  if (arena) {
    scene.remove(arena.group);
    arena.dispose();
  }
  arena = createArena(tuning.arena.radius);
  scene.add(arena.group);
  const reach = tuning.arena.radius + 4;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 200 });
  sun.shadow.camera.updateProjectionMatrix();
}
rebuildArena();

// Tank drawings (rebuilt when a tank changes model)
const colorOf = (t: TankState) => (t.isDummy ? DUMMY_COLOR : OWN_COLOR);
const views: TankView[] = world.tanks.map((t) => new TankView(t, colorOf(t), t === me));
for (const v of views) scene.add(v.root);
function syncViews(): void {
  world.tanks.forEach((t, i) => {
    if (views[i]!.model === t.model) return;
    scene.remove(views[i]!.root);
    views[i]!.dispose();
    views[i] = new TankView(t, colorOf(t), t === me);
    scene.add(views[i]!.root);
  });
}
const projectileViews = new ProjectileViews((id) => (world.tanks[id]?.isDummy ? DUMMY_SHOT_COLOR : OWN_COLOR));
scene.add(projectileViews.group);
const markers = new GroundMarkers();
scene.add(markers.group);

// Practice menu
const menu = new PracticeMenu(
  tuning,
  setup,
  (next) => {
    setup = next;
    world.projectiles = [];
    world.reconfigure(me, setup.model, setup.upgrades);
    world.tanks.forEach((t, i) => {
      if (t.isDummy) world.reconfigure(t, dummyModel(i), { firepower: 0, speed: 0, traction: 0 });
    });
    syncViews();
    world.tanks.forEach((t, i) => views[i]!.snap(t));
  },
  () => updateCamLabel(),
);
document.body.appendChild(menu.element);

// Camera follows your tank
const view = new TopDownCamera(window.innerWidth / window.innerHeight);
view.setFocus(me.x, me.z);
view.snap();

function updateCamLabel(): void {
  const parts: string[] = [];
  if (view.mode !== 'play') parts.push('Camera: overview (press C to go back)');
  if (!tuning.combat.firingEnabled) parts.push('Firing is off (press F)');
  camLabel.textContent = parts.join(' · ');
  camLabel.style.display = parts.length ? '' : 'none';
}
updateCamLabel();

// Input
window.addEventListener('keydown', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (!e.repeat) world.input(me.id, { type: 'ability' });
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyC') {
    view.setMode(view.mode === 'play' ? 'overview' : 'play');
    updateCamLabel();
  } else if (e.code === 'KeyT') {
    panel.toggle();
  } else if (e.code === 'KeyP') {
    menu.toggle();
  } else if (e.code === 'KeyF') {
    tuning.combat.firingEnabled = !tuning.combat.firingEnabled;
    if (!tuning.combat.firingEnabled) world.projectiles = [];
    menu.refresh();
    updateCamLabel();
  }
});

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointer = new THREE.Vector2();
const hit = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, view.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
  world.input(me.id, { type: 'move', x: hit.x, z: hit.z });
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  view.setAspect(window.innerWidth / window.innerHeight);
});

// HUD
const ABILITY_NAMES: Record<TankModel, string> = { modelA: 'Boost', modelB: 'Power shot' };
function bar(fraction: number): string {
  return `<span class="bar"><span style="width:${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%"></span></span>`;
}
function updateHud(): void {
  const dummyFalls = world.tanks.slice(1).reduce((n, t) => n + t.eliminations, 0);
  statsLabel.textContent =
    `You knocked off: ${me.knockouts} · Dummies fell: ${dummyFalls} · You fell: ${me.eliminations}` +
    ` · Hits dealt: ${me.hitsDealt} · Hits taken: ${me.hitsTaken}`;

  if (me.status === 'falling') {
    const left = Math.max(0, tuning.rules.respawnSeconds - me.fallTime);
    banner.textContent = `Back on the ice in ${left.toFixed(1)} s`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }

  // Weapon: next-shot timer and whether anyone is in range
  const stats = world.stats(me);
  let weapon: string;
  if (!tuning.combat.firingEnabled) {
    weapon = `<span class="muted">Firing off</span>`;
  } else {
    const target = world.closestEnemy(me);
    const inRange = !!target && Math.hypot(target.x - me.x, target.z - me.z) <= tuning.combat.rangeMetres;
    const ready = 1 - me.shotTimerLeft / stats.timeBetweenShots;
    weapon = `Next shot ${bar(ready)} <span class="muted">${inRange ? 'target in range' : 'no target in range'}</span>`;
  }

  // Ability: ready, active or cooling down
  const ability = ABILITY_NAMES[me.model];
  const cooldown = me.model === 'modelA' ? tuning.abilities.boost.cooldown : tuning.abilities.powerShot.cooldown;
  let abilityText: string;
  if (me.boostLeft > 0) abilityText = `${ability} <b class="active">active ${me.boostLeft.toFixed(1)} s</b>`;
  else if (me.powerShotsLeft > 0) abilityText = `${ability} <b class="active">${me.powerShotsLeft} charged</b>`;
  else if (me.abilityCooldownLeft > 0) abilityText = `${ability} ${bar(1 - me.abilityCooldownLeft / cooldown)} <span class="muted">${me.abilityCooldownLeft.toFixed(1)} s</span>`;
  else abilityText = `${ability} <b class="ready">ready</b> <kbd>Shift</kbd>`;

  weaponHud.innerHTML = `<div>${weapon}</div><div>${abilityText}</div>`;
}

// Main loop: physics in fixed steps, drawing smoothed in between
const timer = new THREE.Timer();
let accumulator = 0;
renderer.setAnimationLoop((timestamp: number) => {
  timer.update(timestamp);
  const frameDt = Math.min(timer.getDelta(), 0.25);
  accumulator += frameDt;
  while (accumulator >= world.dt) {
    world.tanks.forEach((t, i) => views[i]!.capture(t));
    projectileViews.capture(world.projectiles);
    world.step();
    for (const e of world.takeEvents()) {
      if (e.type === 'click-accepted' && e.tankId === me.id) markers.add(e.x, e.z);
      if (e.type === 'respawned') views[e.tankId]!.snap(world.tanks[e.tankId]!);
      if (e.type === 'hit') {
        const shooter = world.tanks[e.shooterId];
        const color = e.powered ? '#ffcc33' : shooter?.isDummy ? DUMMY_SHOT_COLOR : OWN_COLOR;
        markers.add(e.x, e.z, { color, size: e.powered ? 1.6 : 0.9, life: 0.35, grow: 1.6 });
      }
    }
    accumulator -= world.dt;
  }
  const alpha = accumulator / world.dt;
  const time = timer.getElapsed();
  let mePos = { x: me.x, z: me.z };
  world.tanks.forEach((t, i) => {
    const p = views[i]!.draw(t, alpha, time, tuning, tuning.combat.firingEnabled);
    if (t === me) mePos = p;
  });
  projectileViews.draw(world.projectiles, alpha, time);
  // While you fall, the camera stays where you went over the edge.
  if (view.mode === 'play' && me.status === 'alive') view.setFocus(mePos.x, mePos.z);
  markers.update(frameDt);
  view.update(frameDt);
  updateHud();
  renderer.render(scene, view.camera);
});

// Handy for automated checks in the browser console.
(window as unknown as { __practice: unknown }).__practice = { world, view, tuning };
