import * as THREE from 'three';
import { faceted, glacierLights, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, discZ, Kit, rodX, rollingWheel, sideProfile, TRACK_COLOR } from './modelKit';

/**
 * Shotgun detail study (shotgun.html): two takes on the Shotgun in the
 * Glacier style of the finished tanks. Both keep the Shotgun's character: a
 * half-track (tracks at the back, two big wheels at the front), a boxy body
 * and a short, wide barrel, plus a grenade launcher for its ability. Same
 * footprint (about 2.15 m long, collision radius 1.15 m). Preview only.
 */

/** Two big front wheels with steel hubs; they roll as the tank drives. */
function frontWheels(root: THREE.Object3D, k: Kit, hub: THREE.Material, x: number, z: number): void {
  const tyre = k.mat(TRACK_COLOR);
  for (const side of [-1, 1]) {
    const wheel = discZ(root, tyre, 0.27, 0.26, 10, x, 0.27, side * z);
    add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 6), hub));
    k.spinners.push(rollingWheel(wheel, 0.27, side));
  }
}

/**
 * Glacier Brawler: the current Shotgun in the Glacier style. Boxy chamfered
 * hull, rear track under a skirt panel, angled mudguards over the front
 * wheels, a slatted front grille, headlights and accent stripes; a faceted
 * box turret with an accent band, a short wide barrel with a flared muzzle,
 * a grenade launcher on the right and a shell box on the left.
 */
export function buildGlacierBrawler(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { pods: [-0.42], length: 1.2, height: 0.42, width: 0.42, z: 0.66, panels: [0], panelLength: 1.0, skirtHeight: 0.2, skirtY: 0.36, skirtZ: 0.9 });
  frontWheels(root, k, p.steel, 0.68, 0.66);
  for (const side of [-1, 1]) {
    // Angled mudguard over the front wheel: a flat top and a sloped front.
    box(root, p.body, 0.44, 0.04, 0.32, 0.66, 0.6, side * 0.72);
    const slope = box(root, p.body, 0.2, 0.04, 0.32, 0.94, 0.52, side * 0.72);
    slope.rotation.z = -0.7;
    box(root, p.darker, 0.44, 0.03, 0.02, 0.66, 0.58, side * 0.885);
  }

  add(root, faceted(mirrored([[1.08, 0.34], [0.86, 0.56], [-0.98, 0.56], [-1.08, 0.46]]), 0.28, p.body, 0.07), 0, 0.32, 0);
  const hullTop = 0.32 + 0.28 + 0.07;
  for (const side of [-1, 1]) box(root, p.accent, 1.1, 0.045, 0.02, -0.35, 0.48, side * 0.635);
  // Slatted front grille.
  box(root, p.black, 0.03, 0.16, 0.44, 1.13, 0.46, 0);
  for (const z of [-0.15, -0.05, 0.05, 0.15]) box(root, p.steel, 0.035, 0.16, 0.03, 1.14, 0.46, z);
  glacierLights(root, p, 0.9, hullTop + 0.03, 0.38);

  // Faceted box turret with an accent band.
  const turret = add(root, new THREE.Group(), -0.1, hullTop, 0);
  add(turret, faceted(mirrored([[0.36, 0.3], [0.26, 0.4], [-0.34, 0.4], [-0.42, 0.3]]), 0.2, p.dark, 0.06), 0, 0.06, 0);
  box(turret, p.accent, 0.5, 0.04, 0.94, -0.06, 0.18, 0);
  // Short, wide barrel with a flared muzzle and a dark bore.
  const barrel = box(turret, p.dark, 0.5, 0.2, 0.2, 0.62, 0.2, 0);
  barrel.userData.baseX = barrel.position.x;
  box(barrel, p.darker, 0.14, 0.3, 0.3, 0.26, 0, 0);
  box(barrel, p.black, 0.02, 0.16, 0.16, 0.335, 0, 0);
  box(turret, p.darker, 0.08, 0.26, 0.26, 0.4, 0.2, 0);
  // Grenade launcher (right) and shell box (left).
  box(turret, p.steel, 0.28, 0.12, 0.12, 0.18, 0.3, 0.3);
  rodX(turret, p.black, 0.045, 0.045, 0.02, 8, 0.33, 0.3, 0.3);
  box(turret, p.steel, 0.2, 0.12, 0.12, -0.12, 0.24, -0.46);

  return { root, turret, barrels: [barrel], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}

/**
 * Frost Breaker: a meaner take. Wedge-front hull with a raised armoured cab,
 * charcoal angular pods over the front wheels (like the Stealth's), one-piece
 * rear skirt, light bars in the nose, accent stripes; a low, wide wedge
 * turret with a side-by-side double barrel and a top rib, a drum magazine,
 * and a four-tube grenade pod on the right.
 */
export function buildFrostBreaker(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const pod = k.mat('#3a424b');
  const root = new THREE.Group();

  glacierTracks(root, k, p, { pods: [-0.42], length: 1.2, height: 0.42, width: 0.42, z: 0.66, panels: [0], panelLength: 1.1, skirtHeight: 0.2, skirtY: 0.36, skirtZ: 0.9 });
  frontWheels(root, k, p.steel, 0.68, 0.66);
  for (const side of [-1, 1]) {
    add(root, sideProfile([[0.3, 0.44], [0.92, 0.44], [1.04, 0.34], [0.94, 0.56], [0.38, 0.62], [0.26, 0.52]], 0.34, pod, 0.015), 0, 0, side * 0.72);
    box(root, p.accent, 0.4, 0.012, 0.03, 0.64, 0.605, side * 0.72);
  }

  // Wedge-front hull, raised cab behind the nose.
  add(root, faceted(mirrored([[1.1, 0.2], [0.8, 0.52], [-0.98, 0.52], [-1.08, 0.42]]), 0.26, p.body, 0.07), 0, 0.32, 0);
  const hullTop = 0.32 + 0.26 + 0.07;
  add(root, sideProfile([[0.34, 0], [0.72, 0], [0.62, 0.14], [0.36, 0.16]], 0.6, p.body, 0.02), 0, hullTop, 0);
  box(root, p.black, 0.03, 0.06, 0.48, 0.66, hullTop + 0.08, 0);
  for (const side of [-1, 1]) {
    box(root, p.accent, 1.0, 0.045, 0.02, -0.42, 0.47, side * 0.595);
    box(root, p.black, 0.03, 0.05, 0.22, 1.02, 0.5, side * 0.2);
    box(root, p.lamp, 0.02, 0.03, 0.2, 1.035, 0.5, side * 0.2);
  }

  // Low, wide wedge turret with a double barrel side by side.
  const turret = add(root, new THREE.Group(), -0.22, hullTop, 0);
  add(turret, sideProfile([[-0.4, 0], [0.3, 0], [0.4, 0.07], [0.26, 0.2], [-0.32, 0.2], [-0.42, 0.1]], 0.78, p.dark, 0.02));
  box(turret, p.accent, 0.46, 0.012, 0.08, -0.06, 0.225, 0);
  const barrel = box(turret, p.dark, 0.55, 0.15, 0.15, 0.62, 0.11, -0.085);
  barrel.userData.baseX = barrel.position.x;
  box(barrel, p.dark, 0.55, 0.15, 0.15, 0, 0, 0.17);
  box(barrel, p.darker, 0.55, 0.04, 0.06, 0, 0.09, 0.085);
  for (const z of [0, 0.17]) {
    box(barrel, p.darker, 0.1, 0.19, 0.19, 0.23, 0, z);
    box(barrel, p.black, 0.02, 0.1, 0.1, 0.285, 0, z);
  }
  // Drum magazine under the barrels' base.
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8), p.steel), 0.42, 0.02, 0);
  // Four-tube grenade pod on the right.
  box(turret, p.steel, 0.26, 0.2, 0.2, 0.0, 0.28, 0.3);
  for (const y of [0.23, 0.33]) for (const z of [0.25, 0.35]) rodX(turret, p.black, 0.035, 0.035, 0.02, 8, 0.13, y, z);

  return { root, turret, barrels: [barrel], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
