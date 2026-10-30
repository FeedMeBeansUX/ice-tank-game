import * as THREE from 'three';
import { BARREL_SPACING } from '@ice-tank-sumo/shared';
import { faceted, glacierBarrel, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit, rodX, sideProfile } from './modelKit';

/**
 * The Agile ("Ice Skimmer", chosen in the Agile detail study), in the Glacier
 * style of the Heavy. Low and pointed, two thin barrels side by side.
 */

/**
 * Ice Skimmer: a sleeker, racier Agile. Layered hull (wedge plus a raised
 * spine), one-piece skirts, side air intakes, racing stripes over the spine and
 * turret, slim light bars in the nose, a wedge-shaped turret with longer twin
 * barrels, and two boost thrusters at the back that glow ice blue.
 */
export function buildIceSkimmer(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { length: 2.05, height: 0.34, width: 0.34, z: 0.56, panels: [0], panelLength: 1.9, skirtHeight: 0.16, skirtY: 0.3, skirtZ: 0.76 });

  // Layered hull: low wedge, and a narrower raised spine on top.
  add(root, faceted(mirrored([[1.12, 0.14], [0.45, 0.52], [-0.9, 0.52], [-1.05, 0.36]]), 0.16, p.body, 0.06), 0, 0.26, 0);
  const hullTop = 0.26 + 0.16 + 0.06;
  add(root, faceted(mirrored([[0.85, 0.1], [0.45, 0.26], [-0.7, 0.26], [-0.85, 0.16]]), 0.06, p.body, 0.04), 0, hullTop, 0);
  const spineTop = hullTop + 0.06 + 0.04;
  // Racing stripes along the spine.
  for (const z of [-0.08, 0.08]) box(root, p.accent, 1.5, 0.012, 0.06, -0.02, spineTop + 0.005, z);
  // Side air intakes and slim light bars in the nose.
  for (const side of [-1, 1]) {
    const intake = box(root, p.black, 0.34, 0.06, 0.04, 0.3, 0.38, side * 0.535);
    intake.rotation.y = side * 0.1;
    box(root, p.black, 0.03, 0.05, 0.2, 0.86, 0.4, side * 0.22);
    box(root, p.lamp, 0.02, 0.03, 0.18, 0.875, 0.4, side * 0.22);
  }
  // Boost thrusters at the back, glowing inside.
  const glow = k.mat('#bff4ff', '#7fe3ff', 1.4);
  for (const side of [-1, 1]) {
    rodX(root, p.steel, 0.08, 0.1, 0.16, 8, -1.08, 0.38, side * 0.3);
    rodX(root, glow, 0.06, 0.06, 0.02, 8, -1.165, 0.38, side * 0.3);
  }

  // Wedge-shaped turret on the spine, racing stripes continued, longer twin barrels.
  const turret = add(root, new THREE.Group(), -0.15, spineTop, 0);
  add(turret, sideProfile([[-0.36, 0], [0.3, 0], [0.42, 0.06], [0.2, 0.16], [-0.32, 0.16], [-0.4, 0.08]], 0.62, p.dark, 0.02));
  for (const z of [-0.08, 0.08]) box(turret, p.accent, 0.5, 0.012, 0.06, -0.06, 0.185, z);
  const barrels = [-BARREL_SPACING, BARREL_SPACING].map((z) => glacierBarrel(turret, p, { start: 0.34, length: 0.95, thickness: 0.08, y: 0.08, z, rings: 2 }));
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.45, 4), p.black), -0.3, 0.4, -0.22);

  return { root, turret, barrels, body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
