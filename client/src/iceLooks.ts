import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * Ice surface looks for the Sumo arena (a study: press I in the game to switch).
 *
 * - classic: the original flat-coloured facets.
 * - rink:    polished rink ice: glossy, skate-like scratches, resurfacing
 *            swirls, snow pushed against the border, soft reflections.
 * - lake:    clear lake ice: deeper blue with white cracks and trapped air
 *            bubbles, frost at the edge, clearer reflections.
 * - frost:   snow-dusted ice: matte, wind-blown snow drifts and streaks with
 *            patches of bare ice, a little sparkle; no reflections.
 *
 * The geometry stays the same low-poly facets; each look paints a texture
 * over the ice (made in code, same every load) and sets how glossy it is.
 */

export type IceStyle = 'classic' | 'rink' | 'lake' | 'frost';

export const ICE_STYLES: { id: IceStyle; name: string }[] = [
  { id: 'classic', name: 'Current' },
  { id: 'rink', name: 'A · Polished rink' },
  { id: 'lake', name: 'B · Clear lake ice' },
  { id: 'frost', name: 'C · Snow-dusted ice' },
];

const STORAGE_KEY = 'ice-tank-sumo.ice-style';

export function loadIceStyle(): IceStyle {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (ICE_STYLES.some((s) => s.id === saved)) return saved as IceStyle;
  } catch {
    // storage unavailable
  }
  return 'classic';
}

export function saveIceStyle(style: IceStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // ignore
  }
}

export function iceStyleName(style: IceStyle): string {
  return ICE_STYLES.find((s) => s.id === style)?.name ?? style;
}

/** Settings per look. */
export interface IceLook {
  /** Facet tint around white (the texture brings the colour); amount = brightness spread between facets. */
  facetAmount: number;
  roughness: number;
  /** How strongly tanks are mirrored in the ice (0 = no reflection). */
  reflection: number;
  /** Softness of the reflection (blur, in reflection-texture pixels). */
  reflectionBlur: number;
}

export const ICE_LOOKS: Record<Exclude<IceStyle, 'classic'>, IceLook> = {
  rink: { facetAmount: 0.08, roughness: 0.42, reflection: 0.5, reflectionBlur: 2.5 },
  lake: { facetAmount: 0.09, roughness: 0.45, reflection: 0.6, reflectionBlur: 1.5 },
  frost: { facetAmount: 0.08, roughness: 0.85, reflection: 0, reflectionBlur: 0 },
};

// ---------------------------------------------------------------------------
// Texture painting

const SIZE = 2048;
const NOISE_RES = 512;

function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth random "cloud" values (0..1), tileable grid of value noise summed over octaves. */
function makeNoise(seed: number): (x: number, y: number) => number {
  const random = makeRandom(seed);
  const N = 256;
  const table = new Float32Array(N * N);
  for (let i = 0; i < table.length; i++) table[i] = random();
  const at = (x: number, y: number) => table[(((y % N) + N) % N) * N + (((x % N) + N) % N)]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp;
    norm += amp;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 31.7;
    amp *= 0.5;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type RGB = [number, number, number];
/** '#rrggbb' as 0..255 values (as written, no colour-space conversion: the canvas is sRGB). */
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Paints a smooth colour field at low resolution and draws it scaled up over
 * the whole texture. `colorAt` gets texture coordinates 0..1 and returns RGBA (0..255).
 */
function paintField(ctx: CanvasRenderingContext2D, colorAt: (u: number, v: number) => [number, number, number, number]): void {
  const small = document.createElement('canvas');
  small.width = small.height = NOISE_RES;
  const sctx = small.getContext('2d')!;
  const img = sctx.createImageData(NOISE_RES, NOISE_RES);
  for (let y = 0; y < NOISE_RES; y++) {
    for (let x = 0; x < NOISE_RES; x++) {
      const [r, g, b, a] = colorAt((x + 0.5) / NOISE_RES, (y + 0.5) / NOISE_RES);
      const i = (y * NOISE_RES + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, SIZE, SIZE);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The texture covers a square around the ice disk: 1 texture unit = the ice
 * diameter. `m` converts metres to texture pixels.
 */
interface Paint {
  ctx: CanvasRenderingContext2D;
  random: () => number;
  /** Pixels per metre. */
  m: number;
  /** Ice radius in metres. */
  radius: number;
  /** A random point on the ice (pixels), at most `maxShare` of the radius from the centre. */
  point(maxShare?: number): [number, number];
  /** Distance from the centre as a share of the radius, for a texture coordinate. */
  share(u: number, v: number): number;
}

function makePaint(radius: number, seed: number): { canvas: HTMLCanvasElement; p: Paint } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const random = makeRandom(seed);
  const p: Paint = {
    ctx,
    random,
    m: SIZE / (2 * radius),
    radius,
    point(maxShare = 1) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * maxShare * (SIZE / 2);
      return [SIZE / 2 + Math.cos(a) * r, SIZE / 2 + Math.sin(a) * r];
    },
    share(u, v) {
      return Math.hypot(u - 0.5, v - 0.5) * 2;
    },
  };
  return { canvas, p };
}

/** A gently curving line (like a skate or blade mark). */
function strokeCurve(p: Paint, x: number, y: number, heading: number, lengthPx: number, bend: number, steps = 8): void {
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const step = lengthPx / steps;
  for (let i = 0; i < steps; i++) {
    heading += bend;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Snow or frost packed against the border (last `widthM` metres of the ice). */
function edgeBand(p: Paint, widthM: number, color: string, alpha: number): void {
  const { ctx } = p;
  const outer = SIZE / 2;
  const inner = outer - widthM * p.m;
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, inner, SIZE / 2, SIZE / 2, outer);
  const rgb = hex(color).join(',');
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(0.55, `rgba(${rgb},${alpha * 0.45})`);
  g.addColorStop(1, `rgba(${rgb},${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

/** A: polished rink ice. */
function paintRink(p: Paint): void {
  const { ctx, random, m } = p;
  const noise = makeNoise(11);
  const light = hex('#dcf0f9');
  const shade = hex('#a9d2e8');
  const blue = hex('#8fc1de');
  paintField(ctx, (u, v) => {
    const f = fbm(noise, u * 5, v * 5, 5);
    const d = fbm(noise, u * 14 + 40, v * 14, 3);
    let c = mix(shade, light, smoothstep(0.3, 0.7, f));
    c = mix(c, blue, smoothstep(0.5, 0.8, d) * 0.5);
    return [c[0], c[1], c[2], 255];
  });

  // Resurfacing passes: wide, faint, slightly wobbly loops.
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const r = (0.15 + random() * 0.8) * (SIZE / 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + random() * 0.05})`;
    ctx.lineWidth = (0.6 + random() * 0.9) * m;
    ctx.beginPath();
    const wob = random() * 10;
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      const rr = r * (1 + 0.04 * Math.sin(a * 3 + wob) + 0.02 * Math.sin(a * 7 + wob * 2));
      const x = SIZE / 2 + Math.cos(a) * rr;
      const y = SIZE / 2 + Math.sin(a) * rr * (0.92 + 0.08 * Math.cos(wob));
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Scratches: clusters of thin curved marks running roughly the same way.
  for (let c = 0; c < 90; c++) {
    const [cx, cy] = p.point(0.97);
    const base = random() * Math.PI * 2;
    const n = 3 + Math.floor(random() * 9);
    for (let i = 0; i < n; i++) {
      const x = cx + (random() - 0.5) * 1.6 * m;
      const y = cy + (random() - 0.5) * 1.6 * m;
      const white = random() < 0.8;
      ctx.strokeStyle = white ? `rgba(255,255,255,${0.2 + random() * 0.3})` : `rgba(110,140,160,${0.06 + random() * 0.08})`;
      ctx.lineWidth = 0.5 + random() * 0.8;
      strokeCurve(p, x, y, base + (random() - 0.5) * 0.4, (0.4 + random() * 3) * m, (random() - 0.5) * 0.08);
    }
  }
  // A few long sweeping marks.
  for (let i = 0; i < 25; i++) {
    const [x, y] = p.point(0.9);
    ctx.strokeStyle = `rgba(255,255,255,${0.14 + random() * 0.18})`;
    ctx.lineWidth = 0.6 + random() * 0.8;
    strokeCurve(p, x, y, random() * Math.PI * 2, (4 + random() * 8) * m, (random() - 0.5) * 0.12, 16);
  }

  edgeBand(p, 1.6, '#ffffff', 0.6);
}

/** Branching crack: a random walk with occasional side branches. */
function crack(p: Paint, x: number, y: number, heading: number, lengthM: number, depth: number, segs: number[][]): void {
  const { random, m } = p;
  let travelled = 0;
  const path: number[] = [x, y];
  while (travelled < lengthM) {
    const seg = 0.4 + random() * 0.9;
    heading += (random() - 0.5) * 0.9;
    x += Math.cos(heading) * seg * m;
    y += Math.sin(heading) * seg * m;
    travelled += seg;
    path.push(x, y);
    if (Math.hypot(x - SIZE / 2, y - SIZE / 2) > SIZE / 2) break;
    if (depth < 2 && random() < 0.12) {
      crack(p, x, y, heading + (random() < 0.5 ? 1 : -1) * (0.5 + random() * 0.8), lengthM * (0.15 + random() * 0.3), depth + 1, segs);
    }
  }
  segs.push([depth, ...path]);
}

/** B: clear lake ice. */
function paintLake(p: Paint): void {
  const { ctx, random, m } = p;
  const noise = makeNoise(23);
  const deep = hex('#5ea5c9');
  const mid = hex('#8ac4de');
  const milky = hex('#d6edf6');
  paintField(ctx, (u, v) => {
    const depth = fbm(noise, u * 3.2, v * 3.2, 5);
    const cloud = fbm(noise, u * 9 + 50, v * 9 + 20, 4);
    let c = mix(deep, mid, smoothstep(0.32, 0.62, depth));
    c = mix(c, milky, smoothstep(0.55, 0.78, cloud) * 0.55);
    // Frosty near the edge.
    c = mix(c, milky, smoothstep(0.82, 1, p.share(u, v)) * 0.5);
    return [c[0], c[1], c[2], 255];
  });

  // Cracks: soft glow, then a sharper white core.
  const segs: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const [x, y] = p.point(0.85);
    crack(p, x, y, random() * Math.PI * 2, 8 + random() * 14, 0, segs);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [glow, core] of [
    [4, 0.07],
    [2, 0.2],
    [0.9, 0.65],
  ] as const) {
    for (const s of segs) {
      const depth = s[0]!;
      ctx.lineWidth = glow * (depth === 0 ? 1 : depth === 1 ? 0.7 : 0.5);
      ctx.strokeStyle = `rgba(240,250,255,${core})`;
      ctx.beginPath();
      ctx.moveTo(s[1]!, s[2]!);
      for (let k = 3; k < s.length; k += 2) ctx.lineTo(s[k]!, s[k + 1]!);
      ctx.stroke();
    }
  }

  // Trapped air bubbles in clusters, some in short rising columns.
  for (let c = 0; c < 45; c++) {
    const [cx, cy] = p.point(0.95);
    const spread = (0.3 + random() * 1.1) * m;
    const n = 4 + Math.floor(random() * 22);
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * spread;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const size = 0.6 + random() * random() * 2.6;
      ctx.fillStyle = `rgba(245,252,255,${0.3 + random() * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * (0.7 + random() * 0.3), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  edgeBand(p, 1.2, '#ffffff', 0.55);
}

/** C: snow-dusted ice. */
function paintFrost(p: Paint): void {
  const { ctx, random, m } = p;
  const noise = makeNoise(37);
  const bare = hex('#8cc1dc');
  const thin = hex('#cde5f0');
  const snow = hex('#eef5f9');
  const wind = 0.6; // radians: direction the wind blew the snow
  const cw = Math.cos(wind);
  const sw = Math.sin(wind);
  paintField(ctx, (u, v) => {
    // Rotate into the wind direction and stretch along it: long drifts.
    const a = (u - 0.5) * cw + (v - 0.5) * sw;
    const b = -(u - 0.5) * sw + (v - 0.5) * cw;
    const drift = fbm(noise, a * 5, b * 16, 5);
    const powder = fbm(noise, u * 22 + 9, v * 22 + 3, 3);
    const edge = smoothstep(0.75, 1, p.share(u, v)) * 0.25;
    const s = smoothstep(0.42, 0.62, drift + edge);
    let c = mix(bare, thin, smoothstep(0.3, 0.55, drift + powder * 0.2));
    c = mix(c, snow, s * 0.85);
    return [c[0], c[1], c[2], 255];
  });

  // Wind streaks.
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const [x, y] = p.point(1);
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + random() * 0.14})`;
    ctx.lineWidth = 0.8 + random() * 1.6;
    const len = (0.5 + random() * 2.5) * m;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cw * len, y + sw * len);
    ctx.stroke();
  }
  // Frost sparkle: tiny bright specks.
  for (let i = 0; i < 4000; i++) {
    const [x, y] = p.point(1);
    ctx.fillStyle = `rgba(255,255,255,${0.5 + random() * 0.5})`;
    const s = random() < 0.85 ? 1 : 2;
    ctx.fillRect(x, y, s, s);
  }

  edgeBand(p, 2, '#f8fbfd', 0.7);
}

/** The texture for a look, mapped so (u, v) = (x, z) / ice diameter + 0.5. */
export function makeIceTexture(style: Exclude<IceStyle, 'classic'>, iceRadius: number): THREE.CanvasTexture {
  const { canvas, p } = makePaint(iceRadius, style === 'rink' ? 101 : style === 'lake' ? 202 : 303);
  if (style === 'rink') paintRink(p);
  else if (style === 'lake') paintLake(p);
  else paintFrost(p);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  return texture;
}

// ---------------------------------------------------------------------------
// Reflections

/**
 * A see-through mirror disk lying just above the ice: it shows the tanks
 * (and anything else above the ice) mirrored, softened, and only where there
 * is something to mirror, so the empty backdrop doesn't darken the ice.
 */
export function makeIceReflection(iceRadius: number, look: IceLook): Reflector {
  const shader = {
    name: 'IceReflection',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      strength: { value: look.reflection },
      blur: { value: look.reflectionBlur / 1024 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float strength;
      uniform float blur;
      varying vec4 vUv;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 uv = vUv.xy / vUv.w;
        vec4 c = texture2D(tDiffuse, uv) * 0.36;
        c += texture2D(tDiffuse, uv + vec2(blur, 0.0)) * 0.16;
        c += texture2D(tDiffuse, uv - vec2(blur, 0.0)) * 0.16;
        c += texture2D(tDiffuse, uv + vec2(0.0, blur)) * 0.16;
        c += texture2D(tDiffuse, uv - vec2(0.0, blur)) * 0.16;
        // Colour is stored with alpha already applied; undo that before mixing.
        vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
        gl_FragColor = vec4(rgb, c.a * strength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const reflector = new Reflector(new THREE.CircleGeometry(iceRadius, 96), {
    textureWidth: 1024,
    textureHeight: 1024,
    clipBias: 0.003,
    shader,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0.004;
  reflector.renderOrder = -2;
  const material = reflector.material as THREE.ShaderMaterial;
  material.transparent = true;
  material.depthWrite = false;

  // Render the mirrored view without the backdrop (transparent where empty).
  const base = reflector.onBeforeRender.bind(reflector);
  const clear = new THREE.Color();
  reflector.onBeforeRender = (renderer, scene, camera, geometry, mat, group) => {
    const background = scene.background;
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    scene.background = null;
    renderer.setClearColor(clear, 0);
    base(renderer, scene, camera, geometry, mat, group);
    scene.background = background;
    renderer.setClearColor(clear, alpha);
  };
  return reflector;
}
