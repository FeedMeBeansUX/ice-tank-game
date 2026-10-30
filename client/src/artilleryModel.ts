import * as THREE from 'three';
import { faceted, glacierBarrel, glacierLights, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit } from './modelKit';

/**
 * The Artillery ("Glacier Howitzer", chosen in the Artillery detail study),
 * in the Glacier style: a long, flat hull on full-length tracks, the turret
 * set toward the back and a long gun raised for lobbing shells.
 */

/**
 * Glacier Howitzer: the current Artillery in the Glacier style. Long
 * chamfered hull, full-length cleated tracks under three skirt panels,
 * headlights, accent stripes; a big faceted turret set back with an accent
 * band, a mantlet, a long raised square gun with heat-sink rings and a
 * two-baffle muzzle brake, storage boxes on both sides, a rangefinder across
 * the roof with glowing lenses, and an antenna.
 */
export function buildGlacierHowitzer(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { length: 2.24, height: 0.36, width: 0.4, z: 0.62, panels: [-0.72, 0, 0.72], panelLength: 0.64, skirtHeight: 0.2, skirtY: 0.32, skirtZ: 0.84 });

  add(root, faceted(mirrored([[1.14, 0.36], [0.92, 0.52], [-1.04, 0.52], [-1.14, 0.42]]), 0.22, p.body, 0.07), 0, 0.27, 0);
  const hullTop = 0.27 + 0.22 + 0.07;
  for (const side of [-1, 1]) box(root, p.accent, 1.6, 0.045, 0.02, -0.05, 0.42, side * 0.595);
  glacierLights(root, p, 0.95, hullTop + 0.03, 0.36);

  // Big faceted turret, set toward the back.
  const turret = add(root, new THREE.Group(), -0.35, hullTop, 0);
  add(turret, faceted(mirrored([[0.52, 0.36], [0.4, 0.48], [-0.46, 0.48], [-0.56, 0.38]]), 0.3, p.dark, 0.06), 0, 0.06, 0);
  box(turret, p.accent, 0.7, 0.04, 1.1, -0.06, 0.26, 0);
  box(turret, p.darker, 0.14, 0.3, 0.42, 0.56, 0.24, 0);
  // Long gun, raised for lobbing: heat-sink rings and a two-baffle muzzle brake.
  const cradle = add(turret, new THREE.Group(), 0.6, 0.24, 0);
  cradle.rotation.z = 0.28;
  const gun = glacierBarrel(cradle, p, { start: 0, length: 1.35, thickness: 0.15, y: 0, z: 0, rings: 3 });
  box(gun, p.darker, 0.08, 0.22, 0.26, 1.35 / 2 - 0.2, 0, 0);
  // Storage boxes on both sides, rangefinder across the roof, antenna.
  for (const side of [-1, 1]) box(turret, p.steel, 0.5, 0.14, 0.08, -0.08, 0.2, side * 0.57);
  box(turret, p.darker, 0.12, 0.1, 0.62, 0.16, 0.48, 0);
  for (const side of [-1, 1]) box(turret, p.lamp, 0.02, 0.06, 0.06, 0.225, 0.48, side * 0.26);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), p.black), -0.4, 0.72, 0.3);
  add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), k.mat(color, color, 0.8)), -0.4, 1.08, 0.3);

  return { root, turret, barrels: [gun], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
