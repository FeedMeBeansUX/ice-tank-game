import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING, type TankModel } from '@ice-tank-sumo/shared';
import { createArena } from './arena';
import { buildTank, DUMMY_COLOR, PLAYER_COLORS } from './tankView';

/**
 * Tank line-up (tanks.html): every tank model side by side on the ice, seen
 * from the in-game camera angle (same tilt, compass direction, lens and
 * lighting), but zoomed in so the details are easy to judge.
 */

const MODELS: { model: TankModel; name: string }[] = [
  { model: 'modelA', name: 'Agile' },
  { model: 'modelB', name: 'Heavy' },
  { model: 'modelC', name: 'Stealth' },
  { model: 'modelD', name: 'Laser' },
  { model: 'modelE', name: 'Shotgun' },
  { model: 'modelF', name: 'Artillery' },
  { model: 'modelG', name: 'Rocket' },
];

const canvas = document.getElementById('view') as HTMLCanvasElement;
const labelLayer = document.getElementById('labels')!;
const headingInput = document.getElementById('heading') as HTMLInputElement;
const turretInput = document.getElementById('turret') as HTMLInputElement;
const spinInput = document.getElementById('spin') as HTMLInputElement;

// Same renderer, backdrop and lights as the game (scene.ts).
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#06121d');
scene.add(new THREE.HemisphereLight('#d6ecff', '#0a1c2a', 1.1));
const sun = new THREE.DirectionalLight('#fff4e6', 1.8);
sun.position.set(-35, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
const reach = TUNING.arena.radius + 4;
Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 300 });
scene.add(sun);
scene.add(createArena(TUNING.arena.radius).group);

// Same camera as the game (camera.ts), aimed at the arena centre.
const cam = TUNING.camera;
const camera = new THREE.PerspectiveCamera(cam.fovDeg, 1, 0.5, 600);
const tilt = THREE.MathUtils.degToRad(cam.tiltDeg);
const yaw = THREE.MathUtils.degToRad(cam.yawDeg);
const offsetDir = new THREE.Vector3(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
// Directions on the ice that look like "right" and "up" on screen.
const screenUp = new THREE.Vector3(-offsetDir.x, 0, -offsetDir.z).normalize();
const screenRight = new THREE.Vector3().crossVectors(screenUp, new THREE.Vector3(0, 1, 0)).normalize();

let zoom = 2;
let colorMode: 'players' | 'orange' | 'dummy' = 'players';
let facingDeg = 0;
let turretDeg = 0;

interface Entry {
  name: string;
  root: THREE.Group;
  turret: THREE.Group;
  materials: THREE.Material[];
  label: HTMLDivElement;
}
let entries: Entry[] = [];

function colorFor(i: number): string {
  if (colorMode === 'orange') return PLAYER_COLORS[0]!;
  if (colorMode === 'dummy') return DUMMY_COLOR;
  return PLAYER_COLORS[i % PLAYER_COLORS.length]!;
}

function buildAll(): void {
  for (const e of entries) {
    scene.remove(e.root);
    e.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    e.materials.forEach((m) => m.dispose());
    e.label.remove();
  }
  entries = MODELS.map(({ model, name }, i) => {
    const built = buildTank(model, new THREE.Color(colorFor(i)));
    scene.add(built.root);
    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `${name}<small>${model.replace('model', '')}</small>`;
    labelLayer.appendChild(label);
    return { name, root: built.root, turret: built.turret, materials: built.materials, label };
  });
  layout();
}

/** Ground direction that looks like `deg` degrees counter-clockwise from screen-right. */
function screenAngle(deg: number): number {
  const a = THREE.MathUtils.degToRad(deg);
  const x = screenRight.x * Math.cos(a) + screenUp.x * Math.sin(a);
  const z = screenRight.z * Math.cos(a) + screenUp.z * Math.sin(a);
  return Math.atan2(z, x);
}

function layout(): void {
  const aspect = window.innerWidth / window.innerHeight;
  // One row on wide screens, two rows (4 + 3) on narrow ones.
  const rows: number[][] = aspect >= 1.35 ? [[0, 1, 2, 3, 4, 5, 6]] : [[0, 1, 2, 3], [4, 5, 6]];
  const spacing = 3.5;
  const rowGap = 4.2;
  rows.forEach((row, r) => {
    const v = ((rows.length - 1) / 2 - r) * rowGap;
    row.forEach((index, c) => {
      const u = (c - (row.length - 1) / 2) * spacing;
      const e = entries[index]!;
      e.root.position.copy(screenRight).multiplyScalar(u).addScaledVector(screenUp, v);
    });
  });
  // The game's zoom rule: the screen's shorter side shows playViewMetres; here divided by the zoom.
  const span = cam.playViewMetres / zoom;
  const verticalSpan = aspect >= 1 ? span : span / aspect;
  const distance = verticalSpan / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fovDeg) / 2);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.position.copy(offsetDir).multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  layout();
}

const v = new THREE.Vector3();
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (spinInput.checked) {
    facingDeg = (facingDeg + dt * 30) % 360;
    headingInput.value = String(Math.round(facingDeg));
  }
  const heading = screenAngle(facingDeg);
  const turretAngle = screenAngle(facingDeg + turretDeg);
  for (const e of entries) {
    e.root.rotation.y = -heading;
    e.turret.rotation.y = -(turretAngle - heading);
    // Label just below the tank on screen.
    v.copy(e.root.position).addScaledVector(screenUp, -1.55).project(camera);
    e.label.style.left = `${((v.x + 1) / 2) * window.innerWidth}px`;
    e.label.style.top = `${((1 - v.y) / 2) * window.innerHeight}px`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Controls.
document.querySelectorAll<HTMLDivElement>('[data-seg]').forEach((seg) => {
  seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (seg.dataset.seg === 'zoom') {
        zoom = Number(b.dataset.value);
        layout();
      } else {
        colorMode = b.dataset.value as typeof colorMode;
        buildAll();
      }
    }),
  );
});
headingInput.addEventListener('input', () => (facingDeg = Number(headingInput.value)));
turretInput.addEventListener('input', () => (turretDeg = Number(turretInput.value)));
let dragX: number | null = null;
canvas.addEventListener('pointerdown', (e) => (dragX = e.clientX));
window.addEventListener('pointerup', () => (dragX = null));
window.addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  facingDeg = (((facingDeg - (e.clientX - dragX) * 0.5) % 360) + 360) % 360;
  headingInput.value = String(Math.round(facingDeg));
  dragX = e.clientX;
});
// Optional URL settings for screenshots: ?zoom=3&facing=30&turret=20&colors=orange
const params = new URLSearchParams(location.search);
if (params.has('zoom')) zoom = Number(params.get('zoom'));
if (params.has('facing')) facingDeg = Number(params.get('facing'));
if (params.has('turret')) turretDeg = Number(params.get('turret'));
if (params.has('colors')) colorMode = params.get('colors') as typeof colorMode;
headingInput.value = String(facingDeg);
turretInput.value = String(turretDeg);
document.querySelectorAll<HTMLButtonElement>('[data-seg="zoom"] button').forEach((b) => b.classList.toggle('on', Number(b.dataset.value) === zoom));
document.querySelectorAll<HTMLButtonElement>('[data-seg="colors"] button').forEach((b) => b.classList.toggle('on', b.dataset.value === colorMode));

window.addEventListener('resize', resize);
buildAll();
resize();
requestAnimationFrame(frame);
