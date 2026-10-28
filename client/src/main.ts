import * as THREE from 'three';
import {
  DummyBrain,
  SLOT_COUNT,
  World,
  createTuning,
  type PowerupKind,
  type TankModel,
  type TankState,
} from '@ice-tank-sumo/shared';
import { createArena, type Arena } from './arena';
import { TopDownCamera } from './camera';
import { Minimap, OffscreenMarkers, type MarkerItem, type MinimapDot } from './overlay';
import { MineViews, MissileViews, POWERUP_COLORS, PowerupViews } from './powerupViews';
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
const aimHint = document.getElementById('aim-hint')!;
const weaponHud = document.getElementById('weapon')!;
document.getElementById('build')!.textContent = `build ${__BUILD_LABEL__}`;

const OWN_COLOR = PLAYER_COLORS[0]!;
const DUMMY_SHOT_COLOR = '#e4eaef';
const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE'];
const SLOT_LABELS = ['Q', 'W', 'E'];
const POWERUP_NAMES: Record<PowerupKind, string> = { missile: 'Missile', mine: 'Mine' };

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
const dummyBrain = new DummyBrain();

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

// Drawings
const colorOf = (t: TankState) => (t.isDummy ? DUMMY_COLOR : OWN_COLOR);
const shotColorOf = (id: number) => (world.tanks[id]?.isDummy ? DUMMY_SHOT_COLOR : OWN_COLOR);
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
const projectileViews = new ProjectileViews(shotColorOf);
const powerupViews = new PowerupViews();
const missileViews = new MissileViews(shotColorOf);
const mineViews = new MineViews(shotColorOf);
const markers = new GroundMarkers();
for (const g of [projectileViews.group, powerupViews.group, missileViews.group, mineViews.group, markers.group]) scene.add(g);

// Practice menu
const menu = new PracticeMenu(
  tuning,
  setup,
  (next) => {
    setup = next;
    world.projectiles = [];
    world.missiles = [];
    world.mines = [];
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
  if (!tuning.powerups.enabled) parts.push('Powerups are off');
  camLabel.textContent = parts.join(' · ');
  camLabel.style.display = parts.length ? '' : 'none';
}
updateCamLabel();

// ---------------------------------------------------------------------------
// Missile aiming: press the missile's key, then click a highlighted tank (or
// its marker at the screen edge). Same key again, Esc or right-click cancels.
// ---------------------------------------------------------------------------
let aimingSlot: number | null = null;

const minDistanceRing = new THREE.Mesh(
  new THREE.RingGeometry(0.985, 1, 96),
  new THREE.MeshBasicMaterial({ color: '#ff5b4a', transparent: true, opacity: 0.6, depthWrite: false }),
);
minDistanceRing.rotation.x = -Math.PI / 2;
minDistanceRing.position.y = 0.05;
minDistanceRing.visible = false;
scene.add(minDistanceRing);

const targetRings = world.tanks.map(() => {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.25, 32),
    new THREE.MeshBasicMaterial({ color: '#ff5b4a', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.visible = false;
  scene.add(ring);
  return ring;
});

function pickableTanks(): TankState[] {
  return world.tanks.filter((t) => world.canTargetWithMissile(me, t));
}

function setAiming(slot: number | null): void {
  aimingSlot = slot;
  document.body.classList.toggle('aiming', slot !== null);
}

function fireMissileAt(tankId: number): void {
  if (aimingSlot === null) return;
  const target = world.tanks[tankId];
  if (!target || !world.canTargetWithMissile(me, target)) return;
  world.input(me.id, { type: 'missile', slot: aimingSlot, targetId: tankId });
  setAiming(null);
}

function useSlot(slot: number): void {
  const kind = me.slots[slot];
  if (me.status !== 'alive' || !kind) return;
  if (kind === 'mine') {
    if (aimingSlot !== null) setAiming(null);
    world.input(me.id, { type: 'mine', slot });
  } else {
    setAiming(aimingSlot === slot ? null : slot);
  }
}

// Input
window.addEventListener('keydown', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (!e.repeat) world.input(me.id, { type: 'ability' });
    return;
  }
  if (e.repeat) return;
  const slot = SLOT_KEYS.indexOf(e.code);
  if (slot >= 0) {
    useSlot(slot);
    return;
  }
  if (e.code === 'Escape') setAiming(null);
  else if (e.code === 'KeyC') {
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
  if (e.button === 2) {
    setAiming(null);
    return;
  }
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, view.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
  if (aimingSlot !== null) {
    // While aiming, a click picks the nearest highlighted tank instead of moving.
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const t of pickableTanks()) {
      const d = Math.hypot(t.x - hit.x, t.z - hit.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best && bestD <= tuning.tanks[best.model].radius + 2.5) fireMissileAt(best.id);
    else flashAimHint();
    return;
  }
  world.input(me.id, { type: 'move', x: hit.x, z: hit.z });
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let aimHintFlash = 0;
function flashAimHint(): void {
  aimHintFlash = 0.6;
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  view.setAspect(window.innerWidth / window.innerHeight);
});

// Overlays: off-screen markers and minimap
const offscreen = new OffscreenMarkers((tankId) => fireMissileAt(tankId));
document.body.appendChild(offscreen.element);
const minimap = new Minimap();
document.body.appendChild(minimap.element);

function updateOverlays(time: number): void {
  const pickable = new Set(aimingSlot !== null ? pickableTanks().map((t) => t.id) : []);
  const items: MarkerItem[] = [];
  for (const t of world.tanks) {
    if (t === me || t.status !== 'alive') continue;
    items.push({
      key: `tank-${t.id}`,
      x: t.x,
      z: t.z,
      kind: 'tank',
      color: colorOf(t),
      label: t.model === 'modelB' ? 'B' : 'A',
      pickableTankId: pickable.has(t.id) ? t.id : undefined,
    });
  }
  for (const m of world.missiles) {
    if (m.targetId !== me.id) continue;
    items.push({ key: `missile-${m.id}`, x: m.x, z: m.z, kind: 'missile', color: '#ff3b30', label: '!' });
  }
  for (const p of world.powerups) {
    items.push({ key: `powerup-${p.id}`, x: p.x, z: p.z, kind: 'powerup', color: POWERUP_COLORS[p.kind], label: p.kind === 'missile' ? 'M' : '●' });
  }
  offscreen.update(items, view.camera, time);

  const dots: MinimapDot[] = [];
  for (const p of world.powerups) dots.push({ x: p.x, z: p.z, color: POWERUP_COLORS[p.kind], kind: 'powerup' });
  for (const m of world.mines) dots.push({ x: m.x, z: m.z, color: '#ff3b30', kind: 'mine' });
  for (const t of world.tanks) {
    if (t.status !== 'alive') continue;
    dots.push({ x: t.x, z: t.z, color: colorOf(t), kind: t === me ? 'own' : 'tank' });
  }
  minimap.draw(tuning.arena.radius, dots, tuning.camera.yawDeg);

  // Aiming visuals in the scene
  const aiming = aimingSlot !== null && me.status === 'alive';
  if (aimingSlot !== null && me.slots[aimingSlot] !== 'missile') setAiming(null);
  minDistanceRing.visible = aiming;
  if (aiming) {
    minDistanceRing.position.set(me.x, 0.05, me.z);
    minDistanceRing.scale.setScalar(tuning.missile.minTargetDistance);
  }
  world.tanks.forEach((t, i) => {
    const ring = targetRings[i]!;
    ring.visible = aiming && pickable.has(t.id);
    if (ring.visible) {
      const r = tuning.tanks[t.model].radius + 0.5 + Math.sin(time * 8) * 0.15;
      ring.position.set(t.x, 0.06, t.z);
      ring.scale.setScalar(r);
    }
  });
  aimHint.hidden = !aiming;
  if (aiming) {
    aimHint.textContent = pickable.size
      ? 'Click a highlighted tank to fire the missile · right-click or the same key cancels'
      : `No tank far enough away (at least ${tuning.missile.minTargetDistance} m) · right-click cancels`;
    aimHint.classList.toggle('flash', aimHintFlash > 0);
  }
}

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
    weapon = `Next shot ${bar(ready)} <span class="muted">${inRange ? 'in range' : 'no target'}</span>`;
  }

  // Ability: ready, active or cooling down
  const ability = ABILITY_NAMES[me.model];
  const cooldown = me.model === 'modelA' ? tuning.abilities.boost.cooldown : tuning.abilities.powerShot.cooldown;
  let abilityText: string;
  if (me.boostLeft > 0) abilityText = `${ability} <b class="active">active ${me.boostLeft.toFixed(1)} s</b>`;
  else if (me.powerShotsLeft > 0) abilityText = `${ability} <b class="active">${me.powerShotsLeft} charged</b>`;
  else if (me.abilityCooldownLeft > 0) abilityText = `${ability} ${bar(1 - me.abilityCooldownLeft / cooldown)} <span class="muted">${me.abilityCooldownLeft.toFixed(1)} s</span>`;
  else abilityText = `${ability} <b class="ready">ready</b> <kbd>Shift</kbd>`;

  // Powerup slots Q, W, E
  let slots = '<div class="slots">';
  for (let i = 0; i < SLOT_COUNT; i++) {
    const kind = me.slots[i];
    const cls = ['slot', kind ? `has-${kind}` : 'empty', aimingSlot === i ? 'aiming' : ''].join(' ');
    slots += `<span class="${cls}"><kbd>${SLOT_LABELS[i]}</kbd>${kind ? POWERUP_NAMES[kind] : '<span class="muted">empty</span>'}</span>`;
  }
  slots += '</div>';

  weaponHud.innerHTML = `<div>${weapon}</div><div>${abilityText}</div>${slots}`;
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
    missileViews.capture(world.missiles);
    dummyBrain.update(world);
    world.step();
    for (const e of world.takeEvents()) {
      if (e.type === 'click-accepted' && e.tankId === me.id) markers.add(e.x, e.z);
      else if (e.type === 'respawned') views[e.tankId]!.snap(world.tanks[e.tankId]!);
      else if (e.type === 'hit') {
        const color = e.powered ? '#ffcc33' : shotColorOf(e.shooterId);
        markers.add(e.x, e.z, { color, size: e.powered ? 1.6 : 0.9, life: 0.35, grow: 1.6 });
      } else if (e.type === 'missile-hit') {
        markers.add(e.x, e.z, { color: '#ff5b4a', size: 2, life: 0.5, grow: 2 });
      } else if (e.type === 'mine-exploded') {
        // Blast ring the size of the blast radius.
        markers.add(e.x, e.z, { color: '#ffcc33', size: tuning.mine.blastRadius / 0.75, life: 0.6, grow: 0.15 });
        markers.add(e.x, e.z, { color: '#ff7a3d', size: 1.5, life: 0.5, grow: 3 });
      } else if (e.type === 'pickup' && e.tankId === me.id) {
        markers.add(me.x, me.z, { color: POWERUP_COLORS[e.kind], size: 2, life: 0.4, grow: 1 });
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
  powerupViews.draw(world.powerups, time);
  missileViews.draw(world.missiles, alpha, time, frameDt);
  mineViews.draw(world.mines, tuning, time);
  // While you fall, the camera stays where you went over the edge.
  if (view.mode === 'play' && me.status === 'alive') view.setFocus(mePos.x, mePos.z);
  markers.update(frameDt);
  view.update(frameDt);
  aimHintFlash = Math.max(0, aimHintFlash - frameDt);
  updateOverlays(time);
  updateHud();
  renderer.render(scene, view.camera);
});

// Handy for automated checks in the browser console.
(window as unknown as { __practice: unknown }).__practice = { world, view, tuning };
