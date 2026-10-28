import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING } from '@ice-tank-sumo/shared';

/**
 * Builds the arena: a faceted ice disk with a dark blue border along the edge.
 * The backdrop around it is left empty (just the scene background colour).
 *
 * Everything is made in code from flat-shaded triangles (low-poly look).
 * A fixed random seed keeps the ice looking the same on every load.
 */

const COLORS = {
  ice: new THREE.Color('#a8d6ec'),
  iceAlt: new THREE.Color('#bfe3f3'),
  border: new THREE.Color('#1b4a73'),
  borderSide: new THREE.Color('#123553'),
};

/** Small deterministic random number generator (same arena every time). */
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

/** Collects triangles with one colour per triangle, for a faceted look. */
class FacetBuilder {
  private positions: number[] = [];
  private colors: number[] = [];

  triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color): void {
    for (const v of [a, b, c]) {
      this.positions.push(v.x, v.y, v.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color): void {
    this.triangle(a, b, c, color);
    this.triangle(a, c, d, color);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** Slight random brightness change, so neighbouring facets read as separate. */
function vary(base: THREE.Color, random: () => number, amount: number): THREE.Color {
  const c = base.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + (random() - 0.5) * amount, 0, 1));
  return c;
}

export interface Arena {
  group: THREE.Group;
}

export function createArena(): Arena {
  const random = makeRandom(20261028);
  const { radius, borderWidth, iceThickness } = TUNING.arena;
  const iceRadius = radius - borderWidth;
  const ringCount = 11;
  const targetEdge = 3.2;
  const builder = new FacetBuilder();

  // Rings of points on the ground plane (y = 0). Rings further out get more
  // points so triangles stay similar in size. Inner points get a little jitter;
  // the outermost ring is an exact circle so it lines up with the border.
  const rings: THREE.Vector3[][] = [[new THREE.Vector3(0, 0, 0)]];
  let count = 6;
  for (let i = 1; i <= ringCount; i++) {
    const r = (iceRadius * i) / ringCount;
    while ((2 * Math.PI * r) / count > targetEdge) count *= 2;
    const isEdge = i === ringCount;
    const ring: THREE.Vector3[] = [];
    for (let j = 0; j < count; j++) {
      const a = (j / count) * 2 * Math.PI + (isEdge ? 0 : (random() - 0.5) * (Math.PI / count));
      const rr = r + (isEdge ? 0 : (random() - 0.5) * 0.9);
      ring.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
    }
    rings.push(ring);
  }

  const face = () => vary(random() < 0.5 ? COLORS.ice : COLORS.iceAlt, random, 0.06);

  // Centre fan. Triangles are listed so they face upward.
  const first = rings[1]!;
  const centre = rings[0]![0]!;
  for (let j = 0; j < first.length; j++) {
    builder.triangle(centre, first[(j + 1) % first.length]!, first[j]!, face());
  }

  // Join each ring to the next (same point count, or double).
  for (let i = 1; i < rings.length - 1; i++) {
    const inner = rings[i]!;
    const outer = rings[i + 1]!;
    const n = inner.length;
    const m = outer.length;
    for (let j = 0; j < n; j++) {
      const a = inner[j]!;
      const b = inner[(j + 1) % n]!;
      if (m === n) {
        builder.triangle(a, outer[(j + 1) % m]!, outer[j]!, face());
        builder.triangle(a, b, outer[(j + 1) % m]!, face());
      } else {
        const o0 = outer[(2 * j) % m]!;
        const o1 = outer[(2 * j + 1) % m]!;
        const o2 = outer[(2 * j + 2) % m]!;
        builder.triangle(a, o1, o0, face());
        builder.triangle(a, b, o1, face());
        builder.triangle(b, o2, o1, face());
      }
    }
  }

  // Dark blue border: the last strip of the playing field, out to the exact
  // edge. A tank whose centre passes its outer edge is eliminated.
  const edge = rings[rings.length - 1]!;
  const outerEdge = edge.map((p) => p.clone().setLength(radius));
  for (let j = 0; j < edge.length; j++) {
    const k = (j + 1) % edge.length;
    builder.quad(edge[j]!, edge[k]!, outerEdge[k]!, outerEdge[j]!, COLORS.border);
    // Side wall, so the arena reads as a slab at the camera's slight tilt.
    const a = outerEdge[j]!;
    const b = outerEdge[k]!;
    builder.quad(a, b, b.clone().setY(-iceThickness), a.clone().setY(-iceThickness), COLORS.borderSide);
  }

  const mesh = new THREE.Mesh(
    builder.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0 }),
  );
  mesh.receiveShadow = true;
  mesh.name = 'arena';

  const group = new THREE.Group();
  group.name = 'arena';
  group.add(mesh);
  return { group };
}
