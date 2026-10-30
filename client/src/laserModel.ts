import * as THREE from 'three';
import { glacierLights, glacierPalette, type BuiltModel } from './heavyModel';
import { add, box, discZ, Kit, rodX, rollingWheel, topProfile, TRACK_COLOR } from './modelKit';

/**
 * The Laser ("Glacier Lancer", chosen in the Laser detail study), in the
 * Glacier style: pill hull with notches front and back, six wheels, a dome
 * turret with a thin emitter and a glowing red lens. The lens tip sits about
 * 0.95 m ahead of the centre and 0.85 m up, where the beam starts (scene.ts).
 */

export const LENS = '#ff4d6d';

/** Pill outline from above (rounded ends, straight sides) with a notch in the middle of both ends. */
export function pill(r: number, half: number, notchDeg = 36, notchDepth = 0.2, notchFlat = 0.1): THREE.Shape {
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
export function sixWheels(root: THREE.Object3D, k: Kit, hub: THREE.Material): void {
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

