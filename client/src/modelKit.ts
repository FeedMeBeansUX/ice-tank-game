import * as THREE from 'three';

/**
 * Building blocks for the tank models: flat-shaded materials, tracks with
 * moving treads and rolling wheels, and small helpers for boxes, rods, discs
 * and extruded outlines. Used by the game models and the preview pages.
 */

export function flat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, metalness: 0.05 });
}

/** Shared colours for track details. */
export const TRACK_COLOR = '#2b3138';
export const TREAD_COLOR = '#1b1f24';
export const ROAD_WHEEL_COLOR = '#4a525c';
export const HUB_COLOR = '#6b747d';

/**
 * Something that moves as one side of the tank drives: tread bars and road
 * wheels. `advance` gets how far that side's track surface moved (metres,
 * positive = forward).
 */
export interface Spinner {
  side: number;
  advance: (metres: number) => void;
}

/** A road wheel (cylinder lying on its side) that rolls around its axle. */
export function rollingWheel(wheel: THREE.Mesh, radius: number, side: number): Spinner {
  return { side, advance: (d) => (wheel.rotation.y -= d / radius) };
}

/**
 * One track: a belt with rounded front and back (seen from the side), raised
 * tread bars that run around the belt as it turns, and road wheels with hubs
 * on the outer face. `side` is -1 or 1 (which side of the tank), so the
 * wheels end up on the outside.
 */
export function buildTrack(
  length: number,
  height: number,
  width: number,
  side: number,
  m: { belt: THREE.Material; tread: THREE.Material; wheel: THREE.Material; hub: THREE.Material },
  opts: { roadWheels?: boolean; treadPitch?: number } = {},
): { group: THREE.Group; spinners: Spinner[] } {
  const group = new THREE.Group();
  const spinners: Spinner[] = [];
  const r = height / 2;
  const straight = Math.max(0, length / 2 - r);

  // Belt: a "stadium" outline (two half-circles joined by straight lines), made thick.
  const outline = new THREE.Shape();
  outline.moveTo(-straight, 0);
  outline.lineTo(straight, 0);
  outline.absarc(straight, r, r, -Math.PI / 2, Math.PI / 2, false);
  outline.lineTo(-straight, height);
  outline.absarc(-straight, r, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  const beltGeometry = new THREE.ExtrudeGeometry(outline, { depth: width, bevelEnabled: false, curveSegments: 5 });
  beltGeometry.translate(0, 0, -width / 2);
  group.add(new THREE.Mesh(beltGeometry, m.belt));

  // Tread bars, evenly spread around the whole loop. Moving the loop
  // position makes them run over the top and around the ends.
  const loop = 4 * straight + 2 * Math.PI * r;
  const barCount = Math.max(4, Math.round(loop / (opts.treadPitch ?? 0.3)));
  const pitch = loop / barCount;
  const barGeometry = new THREE.BoxGeometry(0.07, 0.035, width * 1.02);
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < barCount; i++) {
    const bar = new THREE.Mesh(barGeometry, m.tread);
    group.add(bar);
    bars.push(bar);
  }
  /** Place a bar at distance `u` along the loop: top (rear to front), front end, bottom, back end. */
  const place = (bar: THREE.Mesh, u: number) => {
    let a: number; // direction the belt surface faces here (π/2 = up)
    let x: number;
    let y: number;
    if (u < 2 * straight) {
      x = -straight + u;
      y = height;
      a = Math.PI / 2;
    } else if ((u -= 2 * straight) < Math.PI * r) {
      a = Math.PI / 2 - u / r;
      x = straight + Math.cos(a) * r;
      y = r + Math.sin(a) * r;
    } else if ((u -= Math.PI * r) < 2 * straight) {
      x = straight - u;
      y = 0;
      a = -Math.PI / 2;
    } else {
      u -= 2 * straight;
      a = -Math.PI / 2 - u / r;
      x = -straight + Math.cos(a) * r;
      y = r + Math.sin(a) * r;
    }
    bar.position.set(x, y, 0);
    bar.rotation.z = a - Math.PI / 2;
    // The underside is pressed into the ice; skip drawing it.
    bar.visible = y > r * 0.3;
  };
  let travelled = 0;
  const layoutBars = () => {
    bars.forEach((bar, i) => place(bar, (((i * pitch + travelled) % loop) + loop) % loop));
  };
  layoutBars();
  spinners.push({
    side,
    advance: (d) => {
      travelled = (travelled + d) % loop;
      layoutBars();
    },
  });

  // Road wheels with hubs on the outer face; they roll with the belt.
  const wheelRadius = r * 0.62;
  const count = Math.max(2, Math.round((straight * 2) / (wheelRadius * 2.4)) + 1);
  const outer = side * (width / 2 + 0.012);
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.03, 8);
  const hubGeometry = new THREE.CylinderGeometry(wheelRadius * 0.38, wheelRadius * 0.38, 0.05, 6);
  for (let i = 0; i < (opts.roadWheels === false ? 0 : count); i++) {
    const x = count === 1 ? 0 : -straight + (i * straight * 2) / (count - 1);
    const wheel = new THREE.Mesh(wheelGeometry, m.wheel);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, r, outer);
    const hub = new THREE.Mesh(hubGeometry, m.hub);
    hub.position.set(0, side * 0.015, 0);
    wheel.add(hub);
    group.add(wheel);
    spinners.push(rollingWheel(wheel, wheelRadius, side));
  }
  return { group, spinners };
}

/** Small helper that remembers every material it makes (so they can be faded and disposed). */
export class Kit {
  readonly materials: THREE.MeshStandardMaterial[] = [];
  readonly spinners: Spinner[] = [];
  mat(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, glow = 0.9): THREE.MeshStandardMaterial {
    const m = flat(color);
    if (emissive !== undefined) {
      m.emissive.set(emissive);
      m.emissiveIntensity = glow;
    }
    this.materials.push(m);
    return m;
  }
}

export function add<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

export function box(parent: THREE.Object3D, m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.Mesh {
  return add(parent, new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m), x, y, z);
}

/** A cylinder lying along x (for barrels, exhausts pointing back, lights). */
export function rodX(parent: THREE.Object3D, m: THREE.Material, rFront: number, rBack: number, length: number, sides: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rFront, rBack, length, sides), m);
  mesh.rotation.z = -Math.PI / 2;
  return add(parent, mesh, x, y, z);
}

/** A disc facing sideways (wheels). */
export function discZ(parent: THREE.Object3D, m: THREE.Material, r: number, thickness: number, sides: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, sides), m);
  mesh.rotation.x = Math.PI / 2;
  return add(parent, mesh, x, y, z);
}

/** Extrude a side-view outline (x forward, y up) across the tank, `width` wide. */
export function sideProfile(points: [number, number][], width: number, m: THREE.Material, bevel = 0): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  return new THREE.Mesh(g, m);
}

/** Extrude a top-view outline (x forward, second value sideways) upward by `height`. */
export function topProfile(shape: THREE.Shape, height: number, m: THREE.Material, bevel = 0, curveSegments = 3): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, m);
}

