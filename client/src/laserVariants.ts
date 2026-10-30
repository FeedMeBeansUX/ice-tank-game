import * as THREE from 'three';
import { faceted, glacierLights, glacierPalette, mirrored, type BuiltModel } from './heavyModel';
import { add, box, discZ, Kit, rodX, rollingWheel, sideProfile, topProfile, TRACK_COLOR } from './modelKit';

/**
 * Laser detail study (laser.html): two takes on the Laser in the Glacier style
 * of the Heavy, Agile and Stealth. Both keep the Laser's character: the pill
 * hull with notches front and back, six wheels, and a dome turret with a thin
 * emitter and a glowing red lens. Same footprint (about 2.1 m long, collision
 * radius 1.15 m). Preview only.
 */

const LENS = '#ff4d6d';

/** Pill outline from above (rounded ends, straight sides) with a notch in the middle of both ends. */
function pill(r: number, half: number, notchDeg = 36, notchDepth = 0.2, notchFlat = 0.1): THREE.Shape {
  const a = THREE.MathUtils.degToRad(notchDeg);
  const nx = half + r - notchDepth;
  const s = new THREE.Shape();
  s.moveTo(-half, -r);
  s.lineTo(half, -r);
  s.absarc(half, 0, r, -Math.PI / 2, -a, false);
  s.lineTo(nx, -notchFlat);
  s.lineTo(nx, notchFlat);
  s.absarc(half, 0, r, a, Math.PI / 2, false);
  s.lineTo(-half, r);
  s.absarc(-half, 0, r, Math.PI / 2, Math.PI - a, false);
  s.lineTo(-nx, notchFlat);
  s.lineTo(-nx, -notchFlat);
  s.absarc(-half, 0, r, Math.PI + a, (3 * Math.PI) / 2, false);
  return s;
}

/** Six wheels (three per side) with steel hubs; they roll as the tank drives. */
function sixWheels(root: THREE.Object3D, k: Kit, hub: THREE.Material): void {
  const tyre = k.mat(TRACK_COLOR);
  for (const side of [-1, 1]) {
    for (const x of [-0.62, 0, 0.62]) {
      const wheel = discZ(root, tyre, 0.2, 0.2, 10, x, 0.2, side * 0.62);
      add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 6), hub));
      k.spinners.push(rollingWheel(wheel, 0.2, side));
    }
  }
}

/**
 * Glacier Lancer: the current Laser in the Glacier style. Chamfered pill
 * hull with a dark pill-shaped top plate, angled skirts with a dark trim over
 * the wheels, accent stripes, headlights beside the front notch; a faceted
 * dome turret with an accent ring, capacitor pods with glowing red strips on
 * both sides, and an emitter with three focusing rings and a red lens.
 */
export function buildGlacierLancer(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const plate = k.mat('#3a424b');
  const lens = k.mat(LENS, LENS, 0.9);
  const root = new THREE.Group();

  sixWheels(root, k, p.steel);
  for (const side of [-1, 1]) {
    const skirt = box(root, p.body, 1.3, 0.16, 0.04, 0, 0.34, side * 0.76);
    skirt.rotation.x = -side * 0.28;
    const trim = box(root, p.darker, 1.3, 0.04, 0.045, 0, 0.27, side * 0.79);
    trim.rotation.x = -side * 0.28;
  }

  add(root, topProfile(pill(0.54, 0.48), 0.28, p.body, 0.06, 2), 0, 0.3, 0);
  const hullTop = 0.3 + 0.28 + 0.06;
  add(root, topProfile(pill(0.36, 0.36, 36, 0.14, 0.07), 0.025, plate, 0.015, 2), 0, hullTop, 0);
  for (const side of [-1, 1]) box(root, p.accent, 0.9, 0.04, 0.02, 0, 0.46, side * 0.605);
  glacierLights(root, p, 0.76, hullTop + 0.03, 0.33);

  const turret = add(root, new THREE.Group(), 0, hullTop + 0.16, 0);
  const dome = add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), p.dark));
  dome.scale.set(1, 0.55, 1);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.035, 10), p.accent), 0, -0.02, 0);
  // Capacitor pods with glowing strips.
  for (const side of [-1, 1]) {
    box(turret, p.steel, 0.3, 0.12, 0.1, -0.05, 0.02, side * 0.42);
    box(turret, lens, 0.24, 0.02, 0.012, -0.05, 0.02, side * 0.476);
  }
  // Emitter with focusing rings, tip housing and lens.
  rodX(turret, p.dark, 0.07, 0.1, 0.7, 8, 0.55, 0.04, 0);
  for (const x of [0.42, 0.52, 0.62]) rodX(turret, p.darker, 0.12, 0.12, 0.03, 8, x, 0.04, 0);
  rodX(turret, p.darker, 0.1, 0.1, 0.08, 8, 0.9, 0.04, 0);
  add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), lens), 0.96, 0.04, 0);

  return { root, turret, barrels: [], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}

/**
 * Prism: a crystal-tech take. Sharper pill hull (straight facets instead of
 * curves) with a raised hexagonal deck, charcoal fender pods with accent lines
 * over the wheels (like the Stealth), headlights; a crystal turret (two
 * six-sided pyramids) with a glowing red band, and a diamond-section emitter
 * with cross fins and a glowing crystal tip.
 */
export function buildPrism(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const pod = k.mat('#3a424b');
  const lens = k.mat(LENS, LENS, 0.9);
  const root = new THREE.Group();

  sixWheels(root, k, p.steel);
  for (const side of [-1, 1]) {
    add(root, sideProfile([[-0.86, 0.22], [0.8, 0.22], [0.9, 0.3], [0.76, 0.4], [-0.78, 0.4], [-0.9, 0.3]], 0.3, pod, 0.015), 0, 0, side * 0.64);
    box(root, p.accent, 1.2, 0.012, 0.03, 0, 0.415, side * 0.64);
  }

  add(root, topProfile(pill(0.54, 0.48), 0.24, p.body, 0.07, 1), 0, 0.3, 0);
  const hullTop = 0.3 + 0.24 + 0.07;
  add(root, faceted(mirrored([[0.52, 0.12], [0.3, 0.32], [-0.4, 0.32], [-0.56, 0.16]]), 0.05, p.body, 0.03), 0, hullTop, 0);
  const deckTop = hullTop + 0.05 + 0.03;
  glacierLights(root, p, 0.74, hullTop + 0.03, 0.34);

  // Crystal turret: two six-sided pyramids, glowing band at the widest point.
  const turret = add(root, new THREE.Group(), 0, deckTop + 0.1, 0);
  const lower = add(turret, new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.16, 6), p.darker), 0, -0.08, 0);
  lower.rotation.x = Math.PI;
  add(turret, new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.34, 6), p.dark), 0, 0.17, 0);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.03, 6), lens), 0, 0, 0);
  // Diamond-section emitter with cross fins and a crystal tip.
  const emitter = box(turret, p.dark, 0.8, 0.1, 0.1, 0.66, 0.06, 0);
  emitter.rotation.x = Math.PI / 4;
  for (const x of [0.42, 0.52, 0.62]) {
    box(turret, p.darker, 0.06, 0.22, 0.02, x, 0.06, 0);
    box(turret, p.darker, 0.06, 0.02, 0.22, x, 0.06, 0);
  }
  add(turret, new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), lens), 1.1, 0.06, 0);

  return { root, turret, barrels: [], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
