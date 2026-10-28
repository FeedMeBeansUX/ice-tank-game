import * as THREE from 'three';
import { World, createTuning } from '@ice-tank-sumo/shared';
import { createArena } from './arena';
import { TopDownCamera } from './camera';
import { ClickMarkers, DUMMY_COLOR, PLAYER_COLORS, TankView } from './tankView';
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
document.getElementById('build')!.textContent = `build ${__BUILD_LABEL__}`;

// Live tuning values (the slider panel edits this object)
const tuning = createTuning();
const panel = new TuningPanel(tuning, __BUILD_LABEL__);
document.body.appendChild(panel.element);

// Simulation: you plus three dummies, spread out around the centre
const world = new World(tuning, 20261028);
const spawnRadius = 9;
const names = ['You', 'Dummy 1', 'Dummy 2', 'Dummy 3'];
names.forEach((name, i) => {
  const a = Math.PI / 2 + (i * Math.PI) / 2;
  world.addTank({ name, model: 'modelA', isDummy: i > 0, x: Math.cos(a) * spawnRadius, z: Math.sin(a) * spawnRadius });
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
const shadowReach = tuning.arena.radius + 4;
Object.assign(sun.shadow.camera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun);

scene.add(createArena().group);

const views = world.tanks.map((t, i) => new TankView(t, i === 0 ? PLAYER_COLORS[0]! : DUMMY_COLOR, i === 0));
for (const v of views) scene.add(v.root);
const markers = new ClickMarkers();
scene.add(markers.group);

// Camera follows your tank
const view = new TopDownCamera(window.innerWidth / window.innerHeight);
view.setFocus(me.x, me.z);
view.snap();

function updateCamLabel(): void {
  camLabel.textContent = view.mode === 'play' ? '' : 'Camera: overview (press C to go back)';
  camLabel.style.display = view.mode === 'play' ? 'none' : '';
}
updateCamLabel();

// Input
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyC') {
    view.setMode(view.mode === 'play' ? 'overview' : 'play');
    updateCamLabel();
  } else if (e.code === 'KeyT') {
    panel.toggle();
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
function updateHud(): void {
  const dummyFalls = world.tanks.slice(1).reduce((n, t) => n + t.eliminations, 0);
  statsLabel.textContent = `You knocked off: ${me.knockouts} · Dummies fell: ${dummyFalls} · You fell: ${me.eliminations}`;
  if (me.status === 'falling') {
    const left = Math.max(0, tuning.rules.respawnSeconds - me.fallTime);
    banner.textContent = `Back on the ice in ${left.toFixed(1)} s`;
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
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
    world.step();
    for (const e of world.takeEvents()) {
      if (e.type === 'click-accepted' && e.tankId === me.id) markers.add(e.x, e.z);
      if (e.type === 'respawned') views[e.tankId]!.snap(world.tanks[e.tankId]!);
    }
    accumulator -= world.dt;
  }
  const alpha = accumulator / world.dt;
  const time = timer.getElapsed();
  let mePos = { x: me.x, z: me.z };
  world.tanks.forEach((t, i) => {
    const p = views[i]!.draw(t, alpha, time);
    if (i === 0) mePos = p;
  });
  // While you fall, the camera stays where you went over the edge.
  if (view.mode === 'play' && me.status === 'alive') view.setFocus(mePos.x, mePos.z);
  markers.update(frameDt);
  view.update(frameDt);
  updateHud();
  renderer.render(scene, view.camera);
});

// Handy for automated checks in the browser console.
(window as unknown as { __practice: unknown }).__practice = { world, view };
