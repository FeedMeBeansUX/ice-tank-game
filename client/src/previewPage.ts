import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING } from '@ice-tank-sumo/shared';
import { createArena } from './arena';
import type { Spinner } from './modelKit';
import { DUMMY_COLOR, PLAYER_COLORS } from './tankView';

/**
 * Shared code for the preview pages (tanks.html, heavy.html): tanks side by
 * side on the ice, seen from the in-game camera angle (same tilt, compass
 * direction, lens and lighting), zoomed in so details are easy to judge.
 * A small inset in the corner shows the same tanks at their real in-game size.
 */

export interface PreviewModel {
  root: THREE.Group;
  turret: THREE.Group;
  materials: THREE.Material[];
  spinners: Spinner[];
}

export interface PreviewItem {
  name: string;
  /** Small grey text after the name. */
  sub?: string;
  build: (color: THREE.Color) => PreviewModel;
}

export interface PreviewOptions {
  title: string;
  intro: string;
  items: PreviewItem[];
  zooms: number[];
  defaultZoom: number;
  /** Space between tanks (metres). */
  spacing: number;
  links?: { href: string; label: string }[];
}

/** Track speed on the preview pages (m/s). */
const DRIVE_SPEED = 1.5;

type ColorMode = 'players' | 'orange' | 'blue' | 'dummy';

export function startPreview(opts: PreviewOptions): void {
  document.title = `Ice Tank Sumo · ${opts.title}`;
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: #06121d; font-family: system-ui, sans-serif; color: #e6f2fa; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #labels { position: fixed; inset: 0; pointer-events: none; }
    .label { position: absolute; transform: translate(-50%, 0); font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
      padding: 2px 8px; border-radius: 10px; background: rgba(6, 18, 29, 0.72); white-space: nowrap; }
    .label small { opacity: 0.6; font-weight: 500; margin-left: 4px; }
    #panel { position: fixed; top: 12px; left: 12px; background: rgba(6, 18, 29, 0.85); border: 1px solid #1d3346;
      border-radius: 10px; padding: 10px 12px; font-size: 13px; display: grid; gap: 8px; width: 250px; }
    #panel h1 { font-size: 14px; margin: 0; }
    #panel label { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    #panel .seg { display: flex; gap: 4px; flex-wrap: wrap; }
    #panel .seg button { flex: 1; background: #12263a; color: inherit; border: 1px solid #1d3346; border-radius: 6px; padding: 3px 6px; cursor: pointer; font: inherit; }
    #panel .seg button.on { background: #2b6a96; border-color: #3fb5ff; }
    #panel input[type='range'] { width: 120px; }
    #panel a { color: #8fd0ff; }
    #panel .muted { opacity: 0.6; font-size: 12px; }
    #inset-frame { position: fixed; right: 12px; bottom: 12px; border: 1px solid #3fb5ff; border-radius: 6px; pointer-events: none; }
    #inset-frame span { position: absolute; left: 6px; top: 4px; font-size: 11px; background: rgba(6, 18, 29, 0.8); padding: 1px 6px; border-radius: 6px; }
  `;
  document.head.appendChild(style);
  const seg = (key: string, options: [string, string][]) =>
    `<div class="seg" data-seg="${key}">${options.map(([v, l]) => `<button type="button" data-value="${v}">${l}</button>`).join('')}</div>`;
  document.body.innerHTML = `
    <canvas id="view"></canvas>
    <div id="labels"></div>
    <div id="inset-frame"><span>Real in-game size</span></div>
    <div id="panel">
      <h1>${opts.title}</h1>
      <div class="muted">${opts.intro}</div>
      <div>Zoom ${seg('zoom', opts.zooms.map((z) => [String(z), z === 1 ? '1× (game)' : `${z}×`]))}</div>
      <div>Colours ${seg('colors', [['players', 'Players'], ['orange', 'Orange'], ['blue', 'Blue'], ['dummy', 'Grey']])}</div>
      <label>Facing <input id="heading" type="range" min="0" max="360" step="5" value="0" /></label>
      <label>Turret <input id="turret" type="range" min="-180" max="180" step="5" value="0" /></label>
      <label>Spin slowly <input id="spin" type="checkbox" /></label>
      <label>Tracks running <input id="drive" type="checkbox" checked /></label>
      <label>Game-size inset <input id="inset" type="checkbox" checked /></label>
      ${(opts.links ?? []).map((l) => `<a href="${l.href}">${l.label}</a>`).join('')}
    </div>`;

  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const labelLayer = document.getElementById('labels')!;
  const insetFrame = document.getElementById('inset-frame')!;
  const headingInput = document.getElementById('heading') as HTMLInputElement;
  const turretInput = document.getElementById('turret') as HTMLInputElement;
  const spinInput = document.getElementById('spin') as HTMLInputElement;
  const driveInput = document.getElementById('drive') as HTMLInputElement;
  const insetInput = document.getElementById('inset') as HTMLInputElement;

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
  const insetCamera = new THREE.PerspectiveCamera(cam.fovDeg, 1, 0.5, 600);
  const tilt = THREE.MathUtils.degToRad(cam.tiltDeg);
  const yaw = THREE.MathUtils.degToRad(cam.yawDeg);
  const offsetDir = new THREE.Vector3(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
  // Directions on the ice that look like "right" and "up" on screen.
  const screenUp = new THREE.Vector3(-offsetDir.x, 0, -offsetDir.z).normalize();
  const screenRight = new THREE.Vector3().crossVectors(screenUp, new THREE.Vector3(0, 1, 0)).normalize();
  const halfFovTan = Math.tan(THREE.MathUtils.degToRad(cam.fovDeg) / 2);

  let zoom = opts.defaultZoom;
  let colorMode: ColorMode = 'players';
  let facingDeg = 0;
  let turretDeg = 0;
  /** Inset size in CSS pixels. */
  const inset = { w: 0, h: 0 };

  interface Entry extends PreviewModel {
    label: HTMLDivElement;
  }
  let entries: Entry[] = [];

  const colorFor = (i: number): string => {
    if (colorMode === 'orange') return PLAYER_COLORS[0]!;
    if (colorMode === 'blue') return PLAYER_COLORS[1]!;
    if (colorMode === 'dummy') return DUMMY_COLOR;
    return PLAYER_COLORS[i % PLAYER_COLORS.length]!;
  };

  const buildAll = (): void => {
    for (const e of entries) {
      scene.remove(e.root);
      e.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      e.materials.forEach((m) => m.dispose());
      e.label.remove();
    }
    entries = opts.items.map((item, i) => {
      const built = item.build(new THREE.Color(colorFor(i)));
      built.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = true;
      });
      scene.add(built.root);
      const label = document.createElement('div');
      label.className = 'label';
      label.innerHTML = `${item.name}${item.sub ? `<small>${item.sub}</small>` : ''}`;
      labelLayer.appendChild(label);
      return { ...built, label };
    });
    layout();
  };

  /** Ground direction that looks like `deg` degrees counter-clockwise from screen-right. */
  const screenAngle = (deg: number): number => {
    const a = THREE.MathUtils.degToRad(deg);
    const x = screenRight.x * Math.cos(a) + screenUp.x * Math.sin(a);
    const z = screenRight.z * Math.cos(a) + screenUp.z * Math.sin(a);
    return Math.atan2(z, x);
  };

  const place = (c: THREE.PerspectiveCamera, aspect: number, verticalSpan: number, focus = new THREE.Vector3()) => {
    c.aspect = aspect;
    c.updateProjectionMatrix();
    c.position.copy(offsetDir).multiplyScalar(verticalSpan / 2 / halfFovTan).add(focus);
    c.lookAt(focus);
  };
  /** Screen width (px) kept free on the left for the settings panel. */
  const PANEL_SPACE = 290;

  const layout = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    const n = entries.length;
    const indices = [...Array(n).keys()];
    // The game's zoom rule: the screen's shorter side shows playViewMetres; here divided by the zoom.
    const span = cam.playViewMetres / zoom;
    const verticalSpan = aspect >= 1 ? span : span / aspect;
    const mainMetresPerPixel = verticalSpan / h;
    // As few rows as needed to fit next to the panel.
    const rowCount = Math.max(1, Math.ceil((n * opts.spacing) / ((w - PANEL_SPACE) * mainMetresPerPixel)));
    const perRow = Math.ceil(n / rowCount);
    const rows: number[][] = [];
    for (let i = 0; i < n; i += perRow) rows.push(indices.slice(i, i + perRow));
    const rowGap = opts.spacing * 1.05;
    // Centre the rows; if they don't all fit, keep the first row (the candidates) at the top of the screen.
    const overflow = rows.length * rowGap > verticalSpan;
    const topV = overflow ? verticalSpan / 2 - rowGap * 0.5 : ((rows.length - 1) / 2) * rowGap;
    rows.forEach((row, r) => {
      const v = topV - r * rowGap;
      row.forEach((index, c) => {
        const u = (c - (row.length - 1) / 2) * opts.spacing;
        entries[index]!.root.position.copy(screenRight).multiplyScalar(u).addScaledVector(screenUp, v);
      });
    });
    // Shift the view so the tanks sit centred in the space right of the panel.
    place(camera, aspect, verticalSpan, screenRight.clone().multiplyScalar((-PANEL_SPACE / 2) * mainMetresPerPixel));

    // Inset: same metres per pixel as the game in this window.
    const metresPerPixel = cam.playViewMetres / Math.min(w, h);
    const tanksWidth = (rows[0]!.length - 1) * opts.spacing + opts.spacing * 1.1;
    inset.w = Math.min(Math.round(tanksWidth / metresPerPixel) + 24, Math.round(w * 0.45));
    inset.h = Math.round((rows.length * opts.spacing * 1.2) / metresPerPixel) + 30;
    place(insetCamera, inset.w / inset.h, inset.h * metresPerPixel);
    Object.assign(insetFrame.style, { width: `${inset.w}px`, height: `${inset.h}px` });
  };

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    layout();
  };

  const v = new THREE.Vector3();
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (spinInput.checked) {
      facingDeg = (facingDeg + dt * 30) % 360;
      headingInput.value = String(Math.round(facingDeg));
    }
    const heading = screenAngle(facingDeg);
    const turretAngle = screenAngle(facingDeg + turretDeg);
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const e of entries) {
      e.root.rotation.y = -heading;
      e.turret.rotation.y = -(turretAngle - heading);
      if (driveInput.checked) for (const sp of e.spinners) sp.advance(DRIVE_SPEED * dt);
      // Label just below the tank on screen.
      v.copy(e.root.position).addScaledVector(screenUp, -opts.spacing * 0.45).project(camera);
      e.label.style.left = `${((v.x + 1) / 2) * w}px`;
      e.label.style.top = `${((1 - v.y) / 2) * h}px`;
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    renderer.render(scene, camera);
    insetFrame.style.display = insetInput.checked ? '' : 'none';
    if (insetInput.checked) {
      renderer.setScissorTest(true);
      renderer.setViewport(w - 12 - inset.w, 12, inset.w, inset.h);
      renderer.setScissor(w - 12 - inset.w, 12, inset.w, inset.h);
      renderer.render(scene, insetCamera);
      renderer.setScissorTest(false);
    }
    requestAnimationFrame(frame);
  };

  // Controls.
  const markSegs = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-seg="zoom"] button').forEach((b) => b.classList.toggle('on', Number(b.dataset.value) === zoom));
    document.querySelectorAll<HTMLButtonElement>('[data-seg="colors"] button').forEach((b) => b.classList.toggle('on', b.dataset.value === colorMode));
  };
  document.querySelectorAll<HTMLDivElement>('[data-seg]').forEach((s) => {
    s.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        if (s.dataset.seg === 'zoom') {
          zoom = Number(b.dataset.value);
          layout();
        } else {
          colorMode = b.dataset.value as ColorMode;
          buildAll();
        }
        markSegs();
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
  // Optional URL settings for screenshots: ?zoom=3&facing=30&turret=20&colors=orange&drive=0&inset=0
  const params = new URLSearchParams(location.search);
  if (params.has('zoom')) zoom = Number(params.get('zoom'));
  if (params.has('facing')) facingDeg = Number(params.get('facing'));
  if (params.has('turret')) turretDeg = Number(params.get('turret'));
  if (params.has('drive')) driveInput.checked = params.get('drive') !== '0';
  if (params.has('inset')) insetInput.checked = params.get('inset') !== '0';
  if (params.has('colors')) colorMode = params.get('colors') as ColorMode;
  headingInput.value = String(facingDeg);
  turretInput.value = String(turretDeg);
  markSegs();

  window.addEventListener('resize', resize);
  buildAll();
  resize();
  requestAnimationFrame(frame);
}
