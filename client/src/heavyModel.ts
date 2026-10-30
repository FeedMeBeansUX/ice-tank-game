import * as THREE from 'three';
import { add, box, buildTrack, HUB_COLOR, Kit, rodX, ROAD_WHEEL_COLOR, topProfile, TRACK_COLOR, type Spinner } from './modelKit';

/**
 * The Heavy ("Glacier Ram" style, chosen in the Heavy detail study) and the
 * building blocks of that style, which the Agile variants reuse:
 * faceted hulls with big chamfers, angled armour skirts over tracks with steel
 * ice cleats, light accent stripes, headlights in dark housings, a one-piece
 * faceted turret with an accent band and square barrels with heat-sink rings
 * and squared muzzles. Colour rule as in the rest of the game: hull in the
 * player colour, turret darker.
 */

/** What a tank model hands to TankView. */
export interface BuiltModel {
  root: THREE.Group;
  turret: THREE.Group;
  /** Meshes that kick back when firing. */
  barrels: THREE.Mesh[];
  /** Hull material (glows while boosting) and turret material (glows with power shots). */
  body: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  materials: THREE.MeshStandardMaterial[];
  spinners: Spinner[];
}

/** Colours of the Glacier style. */
export function glacierPalette(k: Kit, color: THREE.Color) {
  return {
    body: k.mat(color),
    accent: k.mat(color.clone().lerp(new THREE.Color('#ffffff'), 0.35)),
    dark: k.mat(color.clone().multiplyScalar(0.55)),
    darker: k.mat(color.clone().multiplyScalar(0.38)),
    steel: k.mat('#5d6772'),
    bladeSteel: k.mat('#7d8995'),
    ice: k.mat('#cfe2ee'),
    black: k.mat('#15181c'),
    lamp: k.mat('#d8fbff', '#bff4ff', 1.2),
    cleats: k.mat('#6f7b87'),
  };
}
export type GlacierPalette = ReturnType<typeof glacierPalette>;

/** Extrude a top-view outline (list of points, mirrored is up to the caller) into a chamfered hull. */
export function faceted(points: [number, number][], height: number, m: THREE.Material, bevel: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return topProfile(shape, height, m, bevel);
}

/** Mirror one side of an outline (front to back, positive side) into a full closed outline. */
export function mirrored(side: [number, number][]): [number, number][] {
  return [...side, ...[...side].reverse().map(([x, y]) => [x, -y] as [number, number])];
}

/**
 * Tracks with steel ice cleats on both sides, under angled armour skirts in
 * panels (with a dark trim); the gaps between panels show the wheels.
 */
export function glacierTracks(
  root: THREE.Object3D,
  k: Kit,
  p: GlacierPalette,
  t: { length: number; height: number; width: number; z: number; panels: number[]; panelLength: number; skirtHeight: number; skirtY: number; skirtZ: number },
): void {
  const mats = { belt: k.mat(TRACK_COLOR), tread: p.cleats, wheel: k.mat(ROAD_WHEEL_COLOR), hub: k.mat(HUB_COLOR) };
  for (const side of [-1, 1]) {
    const built = buildTrack(t.length, t.height, t.width, side, mats, { treadPitch: 0.24 });
    add(root, built.group, 0, 0, side * t.z);
    k.spinners.push(...built.spinners);
    for (const x of t.panels) {
      const panel = box(root, p.body, t.panelLength, t.skirtHeight, 0.04, x, t.skirtY, side * t.skirtZ);
      panel.rotation.x = -side * 0.28;
      const trim = box(root, p.darker, t.panelLength, 0.04, 0.045, x, t.skirtY - t.skirtHeight / 2 + 0.01, side * (t.skirtZ + 0.03));
      trim.rotation.x = -side * 0.28;
    }
  }
}

/** Headlights in dark housings, mirrored on both sides. */
export function glacierLights(root: THREE.Object3D, p: GlacierPalette, x: number, y: number, z: number): void {
  for (const side of [-1, 1]) {
    box(root, p.black, 0.08, 0.09, 0.16, x, y, side * z);
    box(root, p.lamp, 0.02, 0.06, 0.12, x + 0.045, y, side * z);
  }
}

/**
 * A square barrel with heat-sink rings at its base and a squared muzzle.
 * The barrel (with its muzzle) is returned so it can kick back; the rings stay.
 */
export function glacierBarrel(
  turret: THREE.Group,
  p: GlacierPalette,
  b: { start: number; length: number; thickness: number; y: number; z: number; rings: number },
): THREE.Mesh {
  const barrel = box(turret, p.dark, b.length, b.thickness, b.thickness, b.start + b.length / 2, b.y, b.z);
  barrel.userData.baseX = barrel.position.x;
  const ring = b.thickness * 1.5;
  for (let i = 0; i < b.rings; i++) box(turret, p.darker, 0.05, ring, ring, b.start + 0.08 + i * 0.1, b.y, b.z);
  const muzzle = b.thickness * 1.38;
  box(barrel, p.darker, 0.16, muzzle, muzzle, b.length / 2 - 0.04, 0, 0);
  box(barrel, p.black, 0.02, b.thickness * 0.62, b.thickness * 0.62, b.length / 2 + 0.045, 0, 0);
  return barrel;
}

/**
 * Heavy: blunt, wide faceted hull on wide cleated tracks with three-panel
 * skirts, headlights, accent stripes; a one-piece faceted turret with an
 * accent band, one big barrel with three heat-sink rings, a side gun pod, a
 * sensor with a glowing lens and an antenna.
 */
export function buildHeavy(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { length: 2.1, height: 0.42, width: 0.44, z: 0.66, panels: [-0.68, 0, 0.68], panelLength: 0.62, skirtHeight: 0.22, skirtY: 0.36, skirtZ: 0.9 });

  // Hull: blunt front with chamfered corners.
  add(root, faceted(mirrored([[1.0, 0.44], [0.74, 0.7], [-0.9, 0.7], [-1.04, 0.52]]), 0.3, p.body, 0.08), 0, 0.32, 0);
  const hullTop = 0.32 + 0.3 + 0.08;
  for (const side of [-1, 1]) box(root, p.accent, 1.5, 0.05, 0.02, -0.08, 0.5, side * 0.785);
  glacierLights(root, p, 0.86, hullTop + 0.04, 0.4);

  // Turret: one faceted shape with an accent band.
  const turret = add(root, new THREE.Group(), -0.12, hullTop, 0);
  add(turret, faceted(mirrored([[0.44, 0.22], [0.24, 0.42], [-0.38, 0.42], [-0.5, 0.24]]), 0.24, p.dark, 0.07), 0, 0.07, 0);
  box(turret, p.accent, 0.62, 0.04, 1.04, -0.1, 0.2, 0);
  const barrel = glacierBarrel(turret, p, { start: 0.45, length: 1.0, thickness: 0.16, y: 0.22, z: 0, rings: 3 });
  // Side gun pod, sensor with a glowing lens, antenna with a glowing tip.
  box(turret, p.steel, 0.3, 0.1, 0.12, 0.28, 0.26, 0.5);
  rodX(turret, p.black, 0.02, 0.02, 0.2, 5, 0.53, 0.26, 0.5);
  box(turret, p.darker, 0.14, 0.1, 0.12, -0.16, 0.36, -0.22);
  box(turret, p.lamp, 0.02, 0.05, 0.08, -0.08, 0.36, -0.22);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), p.black), -0.36, 0.66, 0.24);
  add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), k.mat(color, color, 0.8)), -0.36, 1.02, 0.24);

  return { root, turret, barrels: [barrel], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
