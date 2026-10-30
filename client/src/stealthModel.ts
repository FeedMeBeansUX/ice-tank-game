import * as THREE from 'three';
import { faceted, glacierBarrel, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit, sideProfile } from './modelKit';

/**
 * The Stealth ("Frost Phantom", chosen in the Stealth detail study), in the
 * Glacier style of the Heavy and Agile: X-like hull on four short tracks, a
 * dark top and a small machine-gun turret.
 */

/** Line a thin strip from (x1, z1) to (x2, z2) on top of the hull at height y. */
function edgeStrip(parent: THREE.Object3D, m: THREE.Material, x1: number, z1: number, x2: number, z2: number, y: number, width = 0.04): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const strip = box(parent, m, Math.hypot(dx, dz), 0.015, width, (x1 + x2) / 2, y, (z1 + z2) / 2);
  strip.rotation.y = Math.atan2(-dz, dx);
}

/**
 * Frost Phantom: a stealth-jet take. Flat, sharply faceted hull with a
 * saw-tooth back edge, a dark diamond canopy with accent lines along its
 * leading edges, charcoal angular fender pods (with an accent line) that hide
 * most of the four tracks, smoke
 * vents along the sides, no lights; a very low turret with a glowing visor
 * slit and a long, thin machine gun.
 */
export function buildFrostPhantom(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const visor = k.mat('#bff4ff', '#7fe3ff', 1.3);
  const pod = k.mat('#3a424b');
  const root = new THREE.Group();

  // Four short tracks, mostly hidden under angular fender pods.
  glacierTracks(root, k, p, { pods: [-0.62, 0.62], length: 0.78, height: 0.36, width: 0.36, z: 0.66, panels: [], panelLength: 0, skirtHeight: 0, skirtY: 0, skirtZ: 0 });
  for (const side of [-1, 1]) {
    for (const x of [-0.62, 0.62]) {
      add(root, sideProfile([[-0.44, 0.2], [0.38, 0.2], [0.48, 0.27], [0.34, 0.37], [-0.38, 0.37], [-0.48, 0.28]], 0.38, pod, 0.015), x, 0, side * 0.68);
      box(root, p.accent, 0.5, 0.012, 0.03, x - 0.03, 0.39, side * 0.68);
    }
  }

  // Flat faceted hull: X-like waist, saw-tooth back edge.
  add(root, faceted(mirrored([[1.1, 0.1], [0.62, 0.52], [0.2, 0.38], [-0.2, 0.38], [-0.62, 0.56], [-1.04, 0.42], [-0.92, 0.27], [-1.04, 0.13]]), 0.14, p.body, 0.06), 0, 0.27, 0);
  const hullTop = 0.27 + 0.14 + 0.06;
  // Dark diamond canopy with accent lines along its leading edges.
  add(root, faceted(mirrored([[0.78, 0.06], [0.1, 0.3], [-0.55, 0.22], [-0.72, 0.1]]), 0.04, p.darker, 0.02), 0, hullTop, 0);
  const canopyTop = hullTop + 0.04 + 0.02;
  for (const side of [-1, 1]) edgeStrip(root, p.accent, 0.8, side * 0.07, 0.12, side * 0.33, canopyTop + 0.004);
  // Smoke vents: two dark slits on each side.
  for (const side of [-1, 1]) for (const x of [-0.08, 0.08]) box(root, p.black, 0.1, 0.05, 0.03, x, 0.37, side * 0.43);

  // Very low turret with a glowing visor slit and a long, thin machine gun.
  const turret = add(root, new THREE.Group(), -0.12, canopyTop, 0);
  add(turret, sideProfile([[-0.34, 0], [0.26, 0], [0.36, 0.05], [0.22, 0.12], [-0.28, 0.12], [-0.36, 0.06]], 0.44, p.dark, 0.015));
  box(turret, visor, 0.02, 0.025, 0.3, 0.3, 0.085, 0);
  const gun = glacierBarrel(turret, p, { start: 0.3, length: 0.85, thickness: 0.06, y: 0.05, z: 0, rings: 2 });

  return { root, turret, barrels: [gun], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
