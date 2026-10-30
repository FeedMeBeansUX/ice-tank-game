import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * The ice surface ("Polished rink", picked 30 Oct 2026 from three variants):
 * glossy pale-blue ice with soft cloudy patches, fine skate-like scratches,
 * faint resurfacing swirls, snow pushed against the border, and the tanks
 * softly mirrored in the ice.
 *
 * The low-poly facets stay; the texture is painted over them in code (same
 * every load). The Sumo arena gets one texture over the whole disk; the race
 * track repeats a seamless tile, because it is much bigger.
 *
 * (The two variants that weren't picked, Clear lake ice and Snow-dusted ice,
 * are in commit fa7e72e if they're ever wanted.)
 */

export const ICE = {
  /** Brightness spread between facets (the texture brings the colour). */
  facetAmount: 0.08,
  /** 0 = mirror-smooth, 1 = matte. Lower makes the sun's glare spot sharper. */
  roughness: 0.42,
  /** How strongly things above the ice are mirrored in it (0 = off). */
  reflection: 0.5,
  /** Softness of the reflection (blur, in reflection-texture pixels). */
  reflectionBlur: 2.5,
  /** Width of the snow pushed against the border (m). */
  snowWidth: 1.6,
  /** Race track: metres covered by one repeat of the ice texture. */
  tileMetres: 20,
};

/** Facet colour for the textured ice: near white, a little brighter or darker per facet. */
export function iceFacetColor(random: () => number): THREE.Color {
  const l = 1 - ICE.facetAmount / 2 + (random() - 0.5) * ICE.facetAmount;
  return new THREE.Color().setHSL(0, 0, THREE.MathUtils.clamp(l, 0, 1));
}

/** Ice material: texture on top of the facet colours, fairly glossy. */
export function iceMaterial(map: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: ICE.roughness, metalness: 0, map });
}

// ---------------------------------------------------------------------------
// Painting helpers

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

/** Smooth random values (0..1). With `period`, the pattern repeats every `period` units (for seamless tiles). */
function makeNoise(seed: number): (x: number, y: number, period?: number) => number {
  const random = makeRandom(seed);
  const N = 256;
  const table = new Float32Array(N * N);
  for (let i = 0; i < table.length; i++) table[i] = random();
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y, period = N) => {
    const wrap = (i: number) => ((i % period) + period) % period;
    const at = (i: number, j: number) => table[wrap(j) * N + wrap(i)]!;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Cloud-like values: noise summed over octaves (arena texture). */
function fbmFree(noise: ReturnType<typeof makeNoise>, x: number, y: number, octaves: number): number {
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

/**
 * Cloud-like values over a tile (u, v in 0..1): `cells` noise cells across,
 * finer octaves on top. Every octave repeats exactly over the tile, so it has
 * no seams.
 */
function fbmTile(noise: ReturnType<typeof makeNoise>, u: number, v: number, cells: number, octaves: number, offset = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = cells;
  for (let o = 0; o < octaves; o++) {
    sum += noise(u * f + offset + o * 37, v * f + offset + o * 53, f) * amp;
    norm += amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type RGB = [number, number, number];
/** '#rrggbb' as 0..255 values (as written: the canvas is sRGB). */
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const COLORS = { light: hex('#dcf0f9'), shade: hex('#a9d2e8'), blue: hex('#8fc1de') };

/**
 * Base colour: soft cloudy patches of lighter and bluer ice, painted small and
 * scaled up. `tileCells` > 0 makes it a seamless tile with that many noise cells across.
 */
function paintBase(ctx: CanvasRenderingContext2D, size: number, tileCells: number): void {
  const noise = makeNoise(11);
  const small = document.createElement('canvas');
  small.width = small.height = NOISE_RES;
  const sctx = small.getContext('2d')!;
  const img = sctx.createImageData(NOISE_RES, NOISE_RES);
  for (let y = 0; y < NOISE_RES; y++) {
    for (let x = 0; x < NOISE_RES; x++) {
      const u = (x + 0.5) / NOISE_RES;
      const v = (y + 0.5) / NOISE_RES;
      const f = tileCells ? fbmTile(noise, u, v, tileCells, 5) : fbmFree(noise, u * 5, v * 5, 5);
      const d = tileCells ? fbmTile(noise, u, v, tileCells * 3, 3, 40) : fbmFree(noise, u * 14 + 40, v * 14, 3);
      let c = mix(COLORS.shade, COLORS.light, smoothstep(0.3, 0.7, f));
      c = mix(c, COLORS.blue, smoothstep(0.5, 0.8, d) * 0.5);
      const i = (y * NOISE_RES + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, size, size);
}

/** A gently curving line (a skate or blade mark), drawn at each of `copies` offsets. */
function strokeCurve(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, length: number, bend: number, steps: number, copies: [number, number][]): void {
  const pts: number[] = [x, y];
  const step = length / steps;
  for (let i = 0; i < steps; i++) {
    heading += bend;
    x += Math.cos(heading) * step;
    y += Math.sin(heading) * step;
    pts.push(x, y);
  }
  for (const [ox, oy] of copies) {
    ctx.beginPath();
    ctx.moveTo(pts[0]! + ox, pts[1]! + oy);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k]! + ox, pts[k + 1]! + oy);
    ctx.stroke();
  }
}

/**
 * Scratches: clusters of thin curved marks running roughly the same way,
 * plus a few long sweeping ones. `m` = pixels per metre; `point` picks a spot.
 */
function paintScratches(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  m: number,
  clusters: number,
  sweeps: number,
  point: () => [number, number],
  sweepPoint: () => [number, number],
  copies: [number, number][],
): void {
  ctx.lineCap = 'round';
  for (let c = 0; c < clusters; c++) {
    const [cx, cy] = point();
    const base = random() * Math.PI * 2;
    const n = 3 + Math.floor(random() * 9);
    for (let i = 0; i < n; i++) {
      const x = cx + (random() - 0.5) * 1.6 * m;
      const y = cy + (random() - 0.5) * 1.6 * m;
      const white = random() < 0.8;
      ctx.strokeStyle = white ? `rgba(255,255,255,${0.2 + random() * 0.3})` : `rgba(110,140,160,${0.06 + random() * 0.08})`;
      ctx.lineWidth = 0.5 + random() * 0.8;
      strokeCurve(ctx, x, y, base + (random() - 0.5) * 0.4, (0.4 + random() * 3) * m, (random() - 0.5) * 0.08, 8, copies);
    }
  }
  for (let i = 0; i < sweeps; i++) {
    const [x, y] = sweepPoint();
    ctx.strokeStyle = `rgba(255,255,255,${0.14 + random() * 0.18})`;
    ctx.lineWidth = 0.6 + random() * 0.8;
    strokeCurve(ctx, x, y, random() * Math.PI * 2, (4 + random() * 8) * m, (random() - 0.5) * 0.12, 16, copies);
  }
}

function finish(canvas: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.flipY = false;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Sumo arena texture, covering the ice disk: (u, v) = (x, z) / ice diameter + 0.5.
 * Includes resurfacing swirls around the centre and snow along the border.
 */
export function arenaIceTexture(iceRadius: number): THREE.CanvasTexture {
  const SIZE = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const random = makeRandom(101);
  const m = SIZE / (2 * iceRadius);
  paintBase(ctx, SIZE, 0);

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

  const inDisk = (share: number) => (): [number, number] => {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * share * (SIZE / 2);
    return [SIZE / 2 + Math.cos(a) * r, SIZE / 2 + Math.sin(a) * r];
  };
  paintScratches(ctx, random, m, 90, 25, inDisk(0.97), inDisk(0.9), [[0, 0]]);

  // Snow pushed against the border.
  const outer = SIZE / 2;
  const g = ctx.createRadialGradient(outer, outer, outer - ICE.snowWidth * m, outer, outer, outer);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.27)');
  g.addColorStop(1, 'rgba(255,255,255,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return finish(canvas, false);
}

/** Race track texture: a seamless tile, repeated every ICE.tileMetres (u, v = x, z / tileMetres). */
export function trackIceTexture(): THREE.CanvasTexture {
  const SIZE = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const random = makeRandom(202);
  const m = SIZE / ICE.tileMetres;
  // About as many noise cells per metre as the arena texture.
  paintBase(ctx, SIZE, 2);
  // Draw every scratch at the 9 tile offsets, so marks crossing an edge continue on the other side.
  const copies: [number, number][] = [];
  for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) copies.push([ox, oy]);
  const anywhere = (): [number, number] => [random() * SIZE, random() * SIZE];
  paintScratches(ctx, random, m, 30, 8, anywhere, anywhere, copies);
  return finish(canvas, true);
}

// ---------------------------------------------------------------------------
// Snow along the track's borders

/**
 * A soft white strip along a border edge, fading towards the middle of the
 * track (the arena paints this into its texture instead). Pass the points
 * of the ice edge and, for each, the direction pointing into the track.
 */
export class SnowStrip {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];

  /** One piece between two edge points (a, b) with inward directions (na, nb). */
  piece(a: THREE.Vector3, b: THREE.Vector3, na: THREE.Vector3, nb: THREE.Vector3): void {
    const w = ICE.snowWidth;
    const ia = a.clone().addScaledVector(na, w);
    const ib = b.clone().addScaledVector(nb, w);
    const y = 0.01;
    // Two triangles; colour alpha 0.55 at the edge, 0 inside. Wound to face up.
    const quad: [THREE.Vector3, number][] = [
      [a, 0.55],
      [b, 0.55],
      [ib, 0],
      [a, 0.55],
      [ib, 0],
      [ia, 0],
    ];
    for (let t = 0; t < 6; t += 3) {
      const [p0, p1, p2] = [quad[t]!, quad[t + 1]!, quad[t + 2]!];
      const ny = (p1[0].z - p0[0].z) * (p2[0].x - p0[0].x) - (p1[0].x - p0[0].x) * (p2[0].z - p0[0].z);
      const tri = ny < 0 ? [p0, p2, p1] : [p0, p1, p2];
      for (const [p, alpha] of tri) {
        this.positions.push(p.x, y, p.z);
        this.colors.push(1, 1, 1, alpha);
      }
    }
  }

  build(): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 4));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0 }),
    );
    mesh.receiveShadow = true;
    mesh.renderOrder = -1;
    return mesh;
  }
}

// ---------------------------------------------------------------------------
// Reflections

/**
 * A see-through mirror lying just above the ice, in the shape of `shape`
 * (flat geometry in the ground plane, y = 0). It shows the tanks and anything
 * else above the ice mirrored and softened, only where there is something to
 * mirror, so the empty backdrop doesn't darken the ice.
 */
export function iceReflection(shape: THREE.BufferGeometry): Reflector {
  const shader = {
    name: 'IceReflection',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      strength: { value: ICE.reflection },
      blur: { value: ICE.reflectionBlur / 1024 },
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
  // A Reflector mirrors along its own +Z axis: stand the shape up, then lay the mirror flat.
  const geometry = shape.clone().rotateX(Math.PI / 2);
  const reflector = new Reflector(geometry, { textureWidth: 1024, textureHeight: 1024, clipBias: 0.003, shader });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0.004;
  reflector.renderOrder = -2;
  const material = reflector.material as THREE.ShaderMaterial;
  material.transparent = true;
  material.depthWrite = false;

  // Render the mirrored view without the backdrop (transparent where empty).
  const base = reflector.onBeforeRender.bind(reflector);
  const clear = new THREE.Color();
  reflector.onBeforeRender = (renderer, scene, camera, geom, mat, group) => {
    const background = scene.background;
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    scene.background = null;
    renderer.setClearColor(clear, 0);
    base(renderer, scene, camera, geom, mat, group);
    scene.background = background;
    renderer.setClearColor(clear, alpha);
  };
  const dispose = reflector.dispose.bind(reflector);
  reflector.dispose = () => {
    dispose();
    geometry.dispose();
  };
  return reflector;
}
