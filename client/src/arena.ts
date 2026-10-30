import * as THREE from 'three';
import { DEFAULT_TUNING as TUNING } from '@ice-tank-sumo/shared';
import { arenaIceTexture, iceFacetColor, iceMaterial, iceReflection } from './iceSurface';

/**
 * Builds the arena: a faceted ice disk with a dark blue border along the edge.
 * The ice is "Polished rink" ice (iceSurface.ts): a painted texture over the
 * facets, glossy, with tanks softly mirrored in it.
 * The backdrop around it is left empty (just the scene background colour).
 *
 * Everything is made in code from flat-shaded triangles (low-poly look).
 * A fixed random seed keeps the ice looking the same on every load.
 */

const COLORS = {
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

  /** `uvRadius`: also add texture coordinates, (x, z) / (2 × uvRadius) + 0.5. */
  build(uvRadius?: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (uvRadius) {
      const uv: number[] = [];
      for (let i = 0; i < this.positions.length; i += 3) {
        uv.push(this.positions[i]! / (2 * uvRadius) + 0.5, this.positions[i + 2]! / (2 * uvRadius) + 0.5);
      }
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    geometry.computeVertexNormals();
    return geometry;
  }
}

export interface Arena {
  group: THREE.Group;
  dispose(): void;
}

/** Builds the arena for the given radius (the arena-size slider rebuilds it). */
export function createArena(radius: number = TUNING.arena.radius): Arena {
  const random = makeRandom(20261028);
  const { borderWidth, iceThickness } = TUNING.arena;
  const iceRadius = radius - borderWidth;
  const ringCount = Math.max(4, Math.round(iceRadius / 2.65));
  const targetEdge = 3.2;
  const builder = new FacetBuilder();
  const borderBuilder = new FacetBuilder();

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

  // The texture brings the colour; facets only vary a little in brightness.
  const face = () => iceFacetColor(random);

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
    borderBuilder.quad(edge[j]!, edge[k]!, outerEdge[k]!, outerEdge[j]!, COLORS.border);
    // Side wall, so the arena reads as a slab at the camera's slight tilt.
    const a = outerEdge[j]!;
    const b = outerEdge[k]!;
    borderBuilder.quad(a, b, b.clone().setY(-iceThickness), a.clone().setY(-iceThickness), COLORS.borderSide);
  }

  const texture = arenaIceTexture(iceRadius);
  const ice = new THREE.Mesh(builder.build(iceRadius), iceMaterial(texture));
  ice.receiveShadow = true;
  ice.name = 'arena-ice';
  const border = new THREE.Mesh(
    borderBuilder.build(),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0 }),
  );
  border.receiveShadow = true;
  border.name = 'arena-border';

  const group = new THREE.Group();
  group.name = 'arena';
  group.add(ice, border);
  const disk = new THREE.CircleGeometry(iceRadius, 96).rotateX(-Math.PI / 2);
  const reflection = iceReflection(disk);
  disk.dispose();
  group.add(reflection);
  return {
    group,
    dispose() {
      for (const mesh of [ice, border]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      texture.dispose();
      reflection.dispose();
    },
  };
}
