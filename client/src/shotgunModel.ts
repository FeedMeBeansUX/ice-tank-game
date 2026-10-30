import * as THREE from 'three';
import { addMuzzle, faceted, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, discZ, Kit, rodX, rollingWheel, sideProfile, TRACK_COLOR } from './modelKit';

/**
 * The Shotgun ("Frost Breaker", chosen in the Shotgun detail study), in the
 * Glacier style: a half-track (tracks at the back, two big wheels at the
 * front), a short wide double barrel and a grenade launcher for its ability.
 */

/** Two big front wheels with steel hubs; they roll as the tank drives. */
export function frontWheels(root: THREE.Object3D, k: Kit, hub: THREE.Material, x: number, z: number): void {
  const tyre = k.mat(TRACK_COLOR);
  for (const side of [-1, 1]) {
    const wheel = discZ(root, tyre, 0.27, 0.26, 10, x, 0.27, side * z);
    add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 6), hub));
    k.spinners.push(rollingWheel(wheel, 0.27, side));
  }
}

/**
 * Frost Breaker: wedge-front hull with a raised armoured cab, narrower at the
 * back where the rear tracks sit closer together; charcoal mudguards with
 * accent stripes over the front wheels, one-piece rear skirt, light bars in
 * the nose, accent stripes; a low, wide wedge
 * turret with a side-by-side double barrel and a top rib, a drum magazine,
 * and a four-tube grenade pod on the right.
 */
export function buildFrostBreaker(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const guard = k.mat('#3a424b');
  const root = new THREE.Group();

  glacierTracks(root, k, p, { pods: [-0.42], length: 1.2, height: 0.42, width: 0.42, z: 0.56, panels: [0], panelLength: 1.1, skirtHeight: 0.2, skirtY: 0.36, skirtZ: 0.8 });
  frontWheels(root, k, p.steel, 0.68, 0.66);
  for (const side of [-1, 1]) {
    // Mudguard over the front wheel: flat top, sloped front, accent stripe.
    box(root, guard, 0.44, 0.04, 0.32, 0.66, 0.6, side * 0.72);
    const slope = box(root, guard, 0.2, 0.04, 0.32, 0.94, 0.52, side * 0.72);
    slope.rotation.z = -0.7;
    box(root, p.accent, 0.36, 0.012, 0.03, 0.64, 0.625, side * 0.72);
  }

  // Wedge-front hull, wide at the front wheels, narrower at the back; raised cab behind the nose.
  add(root, faceted(mirrored([[1.1, 0.2], [0.8, 0.52], [0.34, 0.52], [0.16, 0.42], [-0.98, 0.42], [-1.08, 0.34]]), 0.26, p.body, 0.07), 0, 0.32, 0);
  const hullTop = 0.32 + 0.26 + 0.07;
  add(root, sideProfile([[0.34, 0], [0.72, 0], [0.65, 0.05], [0.38, 0.06]], 0.6, p.body, 0.02), 0, hullTop, 0);
  box(root, p.black, 0.03, 0.03, 0.48, 0.69, hullTop + 0.035, 0);
  for (const side of [-1, 1]) {
    box(root, p.accent, 1.0, 0.045, 0.02, -0.45, 0.47, side * 0.495);
    box(root, p.black, 0.03, 0.05, 0.22, 1.02, 0.5, side * 0.2);
    box(root, p.lamp, 0.02, 0.03, 0.2, 1.035, 0.5, side * 0.2);
  }

  // Low, wide wedge turret with a double barrel side by side.
  const turret = add(root, new THREE.Group(), -0.22, hullTop, 0);
  add(turret, sideProfile([[-0.4, 0], [0.3, 0], [0.4, 0.07], [0.26, 0.2], [-0.32, 0.2], [-0.42, 0.1]], 0.78, p.dark, 0.02));
  box(turret, p.accent, 0.46, 0.012, 0.08, -0.06, 0.225, 0);
  const barrel = box(turret, p.dark, 0.55, 0.15, 0.15, 0.62, 0.13, -0.085);
  barrel.userData.baseX = barrel.position.x;
  box(barrel, p.dark, 0.55, 0.15, 0.15, 0, 0, 0.17);
  box(barrel, p.darker, 0.55, 0.04, 0.06, 0, 0.09, 0.085);
  for (const z of [0, 0.17]) {
    box(barrel, p.darker, 0.1, 0.19, 0.19, 0.23, 0, z);
    box(barrel, p.black, 0.02, 0.1, 0.1, 0.285, 0, z);
    addMuzzle(barrel, 0.3, 0, z);
  }
  // Drum magazine under the barrels' base.
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8), p.steel), 0.42, 0.04, 0);
  // Four-tube grenade pod on the right.
  box(turret, p.steel, 0.26, 0.2, 0.2, 0.0, 0.28, 0.3);
  for (const y of [0.23, 0.33]) for (const z of [0.25, 0.35]) rodX(turret, p.black, 0.035, 0.035, 0.02, 8, 0.13, y, z);

  return { root, turret, barrels: [barrel], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
