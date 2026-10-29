import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING, trackHeading, type Track } from '@ice-tank-sumo/shared';
import type { Arena } from './arena';

/**
 * Builds a race track: a faceted ice ribbon along the track's middle line,
 * with the same dark blue border and slab sides as the Sumo arena, a
 * chequered start line, and faint arrows showing the driving direction.
 * Flat-shaded triangles, one colour each (low-poly look).
 */

const COLORS = {
  ice: new THREE.Color('#a8d6ec'),
  iceAlt: new THREE.Color('#bfe3f3'),
  border: new THREE.Color('#1b4a73'),
  borderSide: new THREE.Color('#123553'),
  arrow: new THREE.Color('#d7eef8'),
  checkDark: new THREE.Color('#1d2833'),
  checkLight: new THREE.Color('#f2f6f8'),
};

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

class FacetBuilder {
  private positions: number[] = [];
  private colors: number[] = [];

  /** A triangle, flipped if needed so it faces up (or outward, for walls). */
  triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, wall = false): void {
    if (!wall) {
      const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      if (ny < 0) [b, c] = [c, b];
    }
    for (const v of [a, b, c]) {
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color, wall = false): void {
    this.triangle(a, b, c, color, wall);
    this.triangle(a, c, d, color, wall);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
}

function vary(base: THREE.Color, random: () => number, amount: number): THREE.Color {
  const c = base.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + (random() - 0.5) * amount, 0, 1));
  return c;
}

export function createTrackMesh(track: Track): Arena {
  const random = makeRandom(track.seed);
  const { borderWidth, iceThickness } = TUNING.arena;
  const builder = new FacetBuilder();
  const pts = track.points;
  const n = pts.length;
  const hw = track.halfWidth;
  const iceHalf = hw - borderWidth;
  // Cross-sections every ~3 m, each split into lanes across the width.
  const every = Math.max(1, Math.round(3 / (track.length / n)));
  const lanes = 5;
  const sections: { left: THREE.Vector3[]; outerL: THREE.Vector3; outerR: THREE.Vector3; ix: number }[] = [];
  for (let i = 0; i < n; i += every) {
    const p = pts[i]!;
    const h = trackHeading(track, i);
    const nx = -Math.sin(h);
    const nz = Math.cos(h);
    const row: THREE.Vector3[] = [];
    for (let k = 0; k <= lanes; k++) {
      const edge = k === 0 || k === lanes;
      const across = -iceHalf + (2 * iceHalf * k) / lanes + (edge ? 0 : (random() - 0.5) * 0.8);
      const along = edge ? 0 : (random() - 0.5) * 0.8;
      row.push(new THREE.Vector3(p.x + nx * across + Math.cos(h) * along, 0, p.z + nz * across + Math.sin(h) * along));
    }
    sections.push({ left: row, outerL: new THREE.Vector3(p.x - nx * hw, 0, p.z - nz * hw), outerR: new THREE.Vector3(p.x + nx * hw, 0, p.z + nz * hw), ix: i });
  }
  const face = () => vary(random() < 0.5 ? COLORS.ice : COLORS.iceAlt, random, 0.06);
  const down = (v: THREE.Vector3) => v.clone().setY(-iceThickness);
  for (let s = 0; s < sections.length; s++) {
    const a = sections[s]!;
    const b = sections[(s + 1) % sections.length]!;
    for (let k = 0; k < lanes; k++) {
      builder.triangle(a.left[k]!, b.left[k]!, b.left[k + 1]!, face());
      builder.triangle(a.left[k]!, b.left[k + 1]!, a.left[k + 1]!, face());
    }
    // Borders on both sides, and the slab's side walls below them.
    builder.quad(a.outerL, b.outerL, b.left[0]!, a.left[0]!, COLORS.border);
    builder.quad(a.left[lanes]!, b.left[lanes]!, b.outerR, a.outerR, COLORS.border);
    builder.quad(a.outerL, b.outerL, down(b.outerL), down(a.outerL), COLORS.borderSide, true);
    builder.quad(a.outerR, b.outerR, down(b.outerR), down(a.outerR), COLORS.borderSide, true);
  }

  // Overlays just above the ice: chequered start line, and direction arrows.
  const overlay = new FacetBuilder();
  const at = (i: number, across: number, along: number, y = 0.02) => {
    const p = pts[((i % n) + n) % n]!;
    const h = trackHeading(track, ((i % n) + n) % n);
    return new THREE.Vector3(p.x - Math.sin(h) * across + Math.cos(h) * along, y, p.z + Math.cos(h) * across + Math.sin(h) * along);
  };
  const squares = 8;
  const size = (2 * iceHalf) / squares;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < squares; k++) {
      const x0 = -iceHalf + k * size;
      const y0 = (row - 1) * size;
      const color = (k + row) % 2 === 0 ? COLORS.checkDark : COLORS.checkLight;
      overlay.quad(at(0, x0, y0), at(0, x0 + size, y0), at(0, x0 + size, y0 + size), at(0, x0, y0 + size), color);
    }
  }
  const step = track.length / n;
  const arrowEvery = Math.round(40 / step);
  for (let i = arrowEvery; i < n - arrowEvery / 2; i += arrowEvery) {
    for (const lane of [-iceHalf * 0.5, iceHalf * 0.5]) {
      // A flat chevron pointing along the track.
      overlay.triangle(at(i, lane, 1.6), at(i, lane - 1.2, -0.6), at(i, lane, 0.2), COLORS.arrow);
      overlay.triangle(at(i, lane, 1.6), at(i, lane, 0.2), at(i, lane + 1.2, -0.6), COLORS.arrow);
    }
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0 });
  const mesh = new THREE.Mesh(builder.build(), material);
  mesh.receiveShadow = true;
  const overlayMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, transparent: true, opacity: 0.85 });
  const overlayMesh = new THREE.Mesh(overlay.build(), overlayMaterial);
  overlayMesh.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'track';
  group.add(mesh, overlayMesh);
  return {
    group,
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      overlayMesh.geometry.dispose();
      overlayMaterial.dispose();
    },
  };
}
