import * as THREE from 'three';
import { TUNING, isOffArena } from '@ice-tank-sumo/shared';
import { createArena } from './arena';
import { TopDownCamera } from './camera';

declare const __BUILD_LABEL__: string;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const camLabel = document.getElementById('hud-cam')!;
const clickHelp = document.getElementById('hud-click-help')!;
document.getElementById('build')!.textContent = `build ${__BUILD_LABEL__}`;

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
const shadowReach = TUNING.arena.radius + 12;
Object.assign(sun.shadow.camera, {
  left: -shadowReach,
  right: shadowReach,
  top: shadowReach,
  bottom: -shadowReach,
  near: 1,
  far: 200,
});
sun.shadow.bias = -0.0005;
scene.add(sun);

// Arena
const arena = createArena();
scene.add(arena.group);

// Camera
const view = new TopDownCamera(window.innerWidth / window.innerHeight);

function updateHud(): void {
  const play = view.mode === 'play';
  camLabel.textContent = play
    ? `Camera: in-game distance (${Math.round(TUNING.camera.playViewFraction * 100)}% of the arena)`
    : 'Camera: overview (whole arena)';
  clickHelp.style.display = play ? '' : 'none';
}
updateHud();

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && !e.repeat) {
    view.setMode(view.mode === 'play' ? 'overview' : 'play');
    updateHud();
  }
});

// In the in-game view, clicking the ice moves the camera there. This previews
// the follow camera before there is a tank to follow (milestone 1).
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointer = new THREE.Vector2();
const hit = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || view.mode !== 'play') return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, view.camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return;
  // Keep the focus on the ice, so the camera never wanders off over the water.
  if (isOffArena(hit.x, hit.z)) hit.setLength(TUNING.arena.radius);
  view.setFocus(hit.x, hit.z);
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  view.setAspect(window.innerWidth / window.innerHeight);
});

// Main loop
const timer = new THREE.Timer();
renderer.setAnimationLoop((timestamp: number) => {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1);
  view.update(dt);
  renderer.render(scene, view.camera);
});
