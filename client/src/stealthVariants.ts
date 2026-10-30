import * as THREE from 'three';
import { faceted, glacierBarrel, glacierLights, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit } from './modelKit';

/**
 * Stealth detail study (stealth.html): the Glacier Wraith, the alternative to
 * the Frost Phantom (now the game's Stealth, see stealthModel.ts). Preview only.
 */

/**
 * Glacier Wraith: the current Stealth in the Glacier style. X-shaped
 * chamfered hull, dark faceted top plate, four short cleated tracks each under
 * its own skirt panel, accent stripes on the four arms, small headlights; a
 * low faceted turret with an accent band, a machine gun with cooling rings,
 * an ammo box, smoke dischargers on both sides and a sensor.
 */
export function buildGlacierWraith(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const plate = k.mat('#3a424b');
  const root = new THREE.Group();

  glacierTracks(root, k, p, { pods: [-0.62, 0.62], length: 0.78, height: 0.38, width: 0.38, z: 0.68, panels: [0], panelLength: 0.66, skirtHeight: 0.2, skirtY: 0.33, skirtZ: 0.9 });

  // X-shaped hull: notches in the middle of both sides, small flat front face.
  add(root, faceted(mirrored([[1.05, 0.14], [0.6, 0.6], [0.36, 0.6], [0.12, 0.44], [-0.12, 0.44], [-0.36, 0.6], [-0.7, 0.6], [-1.05, 0.2]]), 0.2, p.body, 0.07), 0, 0.29, 0);
  const hullTop = 0.29 + 0.2 + 0.07;
  // Dark faceted top plate.
  add(root, faceted(mirrored([[0.68, 0.06], [0.14, 0.36], [-0.66, 0.27]]), 0.025, plate, 0.015), 0, hullTop, 0);
  // Accent stripes along the outer edge of the four arms.
  for (const side of [-1, 1]) for (const x of [0.48, -0.53]) box(root, p.accent, 0.3, 0.04, 0.02, x, 0.42, side * 0.675);
  glacierLights(root, p, 0.62, hullTop + 0.02, 0.3);

  // Low faceted turret with an accent band and a machine gun.
  const turret = add(root, new THREE.Group(), -0.06, hullTop + 0.03, 0);
  add(turret, faceted(mirrored([[0.28, 0.14], [0.16, 0.27], [-0.22, 0.27], [-0.32, 0.15]]), 0.12, p.dark, 0.05), 0, 0.05, 0);
  box(turret, p.accent, 0.36, 0.035, 0.66, -0.06, 0.12, 0);
  box(turret, p.darker, 0.34, 0.14, 0.18, 0.36, 0.13, 0);
  const gun = glacierBarrel(turret, p, { start: 0.5, length: 0.65, thickness: 0.065, y: 0.13, z: 0, rings: 3 });
  // Ammo box on the left of the gun.
  box(turret, p.steel, 0.16, 0.1, 0.1, 0.3, 0.12, -0.17);
  // Smoke dischargers (the Stealth's ability): two tubes on each side.
  for (const side of [-1, 1]) {
    for (const x of [0.08, -0.04]) {
      const tube = add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), p.steel), x, 0.17, side * 0.31);
      tube.rotation.x = side * 0.7;
    }
  }
  box(turret, p.darker, 0.1, 0.07, 0.09, -0.2, 0.22, 0.12);
  box(turret, p.lamp, 0.02, 0.04, 0.06, -0.145, 0.22, 0.12);

  return { root, turret, barrels: [gun], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
