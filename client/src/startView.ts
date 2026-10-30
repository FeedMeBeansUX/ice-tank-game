import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING, type TankModel } from '@ice-tank-sumo/shared';
import { createArena } from './arena';
import type { Spinner } from './modelKit';
import { TANKS } from './tankInfo';
import { buildTank, PLAYER_COLORS } from './tankView';

/**
 * Start screen background: all tanks on the ice, from the in-game compass
 * direction but a lower angle (zoomed in). Click a tank (or its name) to pick it; the picked tank
 * stands on a ring and turns slowly with its tracks running.
 */
export interface StartView {
  select(model: TankModel): void;
  dispose(): void;
}

const SPACING = 3.7;
const ROW_GAP = 3.9;
/** Track speed of the picked tank (m/s). */
const DRIVE_SPEED = 1.2;
/** Camera tilt away from straight down: lower than in the game (22°), to show the tanks' sides. */
const TILT_DEG = 40;
/** Where the tanks face at rest, in degrees counter-clockwise from screen-right (205 = toward the bottom left). */
const REST_FACING = 205;
/** How fast the picked tank turns (degrees per second). */
const SPIN_SPEED = 45;

export function createStartView(
  canvas: HTMLCanvasElement,
  labels: HTMLElement,
  /** The part of the canvas not covered by the panel (canvas pixels), where the tanks go. */
  freeArea: () => { x: number; y: number; w: number; h: number },
  initial: TankModel,
  onPick: (model: TankModel) => void,
): StartView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 300 });
  scene.add(sun);
  const arena = createArena(TUNING.arena.radius);
  scene.add(arena.group);

  // Game camera's compass direction and lens, at a lower angle.
  const cam = TUNING.camera;
  const camera = new THREE.PerspectiveCamera(cam.fovDeg, 1, 0.5, 600);
  const tilt = THREE.MathUtils.degToRad(TILT_DEG);
  const yaw = THREE.MathUtils.degToRad(cam.yawDeg);
  const offsetDir = new THREE.Vector3(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
  const screenUp = new THREE.Vector3(-offsetDir.x, 0, -offsetDir.z).normalize();
  const screenRight = new THREE.Vector3().crossVectors(screenUp, new THREE.Vector3(0, 1, 0)).normalize();
  const angleOnScreen = (deg: number) => {
    const a = THREE.MathUtils.degToRad(deg);
    return Math.atan2(screenRight.z * Math.cos(a) + screenUp.z * Math.sin(a), screenRight.x * Math.cos(a) + screenUp.x * Math.sin(a));
  };

  // The tanks, in the player colour, in two rows (4 + 3).
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.56, 40),
    new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[0], transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
  const entries = TANKS.map((info, i) => {
    const built = buildTank(info.model, new THREE.Color(PLAYER_COLORS[0]));
    const row = i < 4 ? 0 : 1;
    const inRow = row === 0 ? 4 : 3;
    const col = row === 0 ? i : i - 4;
    const u = (col - (inRow - 1) / 2) * SPACING;
    const v = (0.5 - row) * ROW_GAP;
    built.root.position.copy(screenRight).multiplyScalar(u).addScaledVector(screenUp, v);
    scene.add(built.root);
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'start-tank-label';
    label.textContent = info.name;
    label.addEventListener('click', () => pick(info.model));
    labels.appendChild(label);
    return { model: info.model, root: built.root, turret: built.turret, spinners: built.spinners as Spinner[], label, facing: REST_FACING };
  });

  let selected = initial;
  const pick = (model: TankModel) => {
    if (model !== selected) {
      selected = model;
      onPick(model);
    }
    update();
  };
  const update = () => {
    for (const e of entries) {
      e.label.classList.toggle('on', e.model === selected);
      if (e.model !== selected) e.facing = REST_FACING;
    }
    const s = entries.find((e) => e.model === selected);
    if (s) ring.position.set(s.root.position.x, 0.02, s.root.position.z);
  };
  update();

  // Fit both rows into the free area (beside or above the panel), leaving room
  // at the top for the title. The camera is framed for the free area and then
  // widened to the whole canvas (setViewOffset), so the ice runs on under the panel.
  const layout = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const free = freeArea();
    const fw = Math.max(1, free.w);
    const fh = Math.max(1, free.h);
    const aspect = fw / fh;
    const needWidth = 4 * SPACING + 0.6;
    const needHeight = 2 * ROW_GAP + 2.6;
    const verticalSpan = Math.max(needHeight, needWidth / aspect) * 1.18;
    camera.aspect = aspect;
    camera.setViewOffset(fw, fh, -free.x, -free.y, w, h);
    camera.updateProjectionMatrix();
    // Aim a little above the rows' middle, so they sit lower (the title is at the top).
    const focus = screenUp.clone().multiplyScalar(verticalSpan * 0.07);
    camera.position.copy(offsetDir).multiplyScalar(verticalSpan / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fovDeg) / 2)).add(focus);
    camera.lookAt(focus);
  };

  // Click / hover on the canvas: the tank nearest the pointer (on screen).
  const v = new THREE.Vector3();
  const nearest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    let best: (typeof entries)[number] | null = null;
    let bestDist = Infinity;
    for (const e of entries) {
      v.copy(e.root.position).setY(0.5).project(camera);
      const dx = ((v.x + 1) / 2) * rect.width + rect.left - clientX;
      const dy = ((1 - v.y) / 2) * rect.height + rect.top - clientY;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    // Within about a tank's size on screen.
    v.set(0, 0, 0).project(camera);
    const ref = new THREE.Vector3().copy(screenRight).multiplyScalar(1.3).project(camera);
    const reach = (Math.abs(ref.x - v.x) / 2) * rect.width;
    return bestDist <= reach ? best : null;
  };
  const onClick = (e: MouseEvent) => {
    const hit = nearest(e.clientX, e.clientY);
    if (hit) pick(hit.model);
  };
  const onMove = (e: MouseEvent) => {
    canvas.style.cursor = nearest(e.clientX, e.clientY) ? 'pointer' : '';
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);
  const observer = new ResizeObserver(layout);
  observer.observe(canvas);
  window.addEventListener('resize', layout);
  layout();

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const rect = canvas.getBoundingClientRect();
    for (const e of entries) {
      if (e.model === selected) {
        e.facing = (e.facing + dt * SPIN_SPEED) % 360;
        for (const sp of e.spinners) sp.advance(DRIVE_SPEED * dt);
      }
      const heading = angleOnScreen(e.facing);
      e.root.rotation.y = -heading;
      e.turret.rotation.y = 0;
      v.copy(e.root.position).addScaledVector(screenUp, -1.75).project(camera);
      e.label.style.left = `${((v.x + 1) / 2) * rect.width}px`;
      e.label.style.top = `${((1 - v.y) / 2) * rect.height}px`;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    select: (model) => pick(model),
    dispose: () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', layout);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      labels.innerHTML = '';
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      arena.dispose();
      // (No forceContextLoss: in some browsers that also blanks the game's own view.)
      renderer.dispose();
    },
  };
}
