import * as THREE from 'three';
import { faceted, glacierBarrel, glacierLights, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit, rodX } from './modelKit';

/**
 * Artillery detail study (artillery.html): two takes on the Artillery in the
 * Glacier style of the finished tanks. Both keep the Artillery's character:
 * a long, flat hull on full-length tracks, the turret set toward the back and
 * a gun that points up for lobbing shells. Same footprint (about 2.25 m long,
 * collision radius 1.15 m). Preview only.
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

/**
 * Avalanche: a self-propelled mortar. Long wedge-front hull on full-length
 * tracks under a one-piece skirt, light bars, accent stripes, four steel
 * outrigger legs that brace it on the ice, and racks of ice-tipped shells on
 * the front deck; an armoured ring at the back with a short, fat mortar tube
 * pointing steeply up in a cradle.
 */
export function buildAvalanche(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { length: 2.24, height: 0.36, width: 0.4, z: 0.62, panels: [0], panelLength: 2.0, skirtHeight: 0.2, skirtY: 0.32, skirtZ: 0.84 });

  add(root, faceted(mirrored([[1.14, 0.24], [0.86, 0.52], [-1.04, 0.52], [-1.14, 0.42]]), 0.22, p.body, 0.07), 0, 0.27, 0);
  const hullTop = 0.27 + 0.22 + 0.07;
  for (const side of [-1, 1]) {
    box(root, p.accent, 1.5, 0.045, 0.02, -0.1, 0.42, side * 0.595);
    box(root, p.black, 0.03, 0.05, 0.22, 1.0, 0.45, side * 0.22);
    box(root, p.lamp, 0.02, 0.03, 0.2, 1.015, 0.45, side * 0.22);
  }
  // Outrigger legs at the four corners: an angled arm and a pad on the ice.
  for (const side of [-1, 1]) {
    for (const x of [0.62, -0.78]) {
      const arm = box(root, p.steel, 0.07, 0.06, 0.34, x, 0.3, side * 0.96);
      arm.rotation.x = side * 0.7;
      box(root, p.darker, 0.18, 0.03, 0.18, x, 0.015, side * 1.06);
    }
  }
  // Racks of shells with ice-blue tips on the front deck.
  for (const z of [-0.3, 0.3]) {
    box(root, p.steel, 0.36, 0.04, 0.2, 0.45, hullTop + 0.02, z);
    for (const x of [0.33, 0.45, 0.57]) {
      for (const dz of [-0.05, 0.05]) {
        add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), p.darker), x, hullTop + 0.1, z + dz);
        add(root, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 6), p.ice), x, hullTop + 0.19, z + dz);
      }
    }
  }

  // Armoured ring at the back with the mortar.
  const turret = add(root, new THREE.Group(), -0.38, hullTop, 0);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.26, 8), p.dark), 0, 0.13, 0);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 8), p.black), 0, 0.265, 0);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.565, 0.04, 8), p.accent), 0, 0.16, 0);
  // Short, fat mortar tube pointing steeply up, in a cradle.
  for (const side of [-1, 1]) box(turret, p.darker, 0.24, 0.24, 0.05, 0.02, 0.32, side * 0.2);
  const cradle = add(turret, new THREE.Group(), 0.02, 0.32, 0);
  cradle.rotation.z = 0.95;
  const tube = rodX(cradle, p.dark, 0.15, 0.17, 0.9, 8, 0.3, 0, 0);
  tube.userData.baseX = tube.position.x;
  add(tube, new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 8), p.darker), 0, 0.42, 0);
  add(tube, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8), p.black), 0, 0.465, 0);
  add(tube, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), p.darker), 0, -0.2, 0);

  return { root, turret, barrels: [tube], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
