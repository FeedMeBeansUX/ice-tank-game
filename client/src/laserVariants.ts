import * as THREE from 'three';
import { faceted, glacierLights, glacierPalette, mirrored, type BuiltModel } from './heavyModel';
import { LENS, pill, sixWheels } from './laserModel';
import { add, box, Kit, sideProfile, topProfile } from './modelKit';

/**
 * Laser detail study (laser.html): the Prism, the alternative to the Glacier
 * Lancer (now the game's Laser, see laserModel.ts). Preview only.
 */

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
