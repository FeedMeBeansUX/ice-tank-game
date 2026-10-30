import * as THREE from 'three';
import { faceted, glacierLights, glacierPalette, glacierTracks, mirrored, type BuiltModel } from './heavyModel';
import { add, box, Kit, rodX } from './modelKit';
import { frontWheels } from './shotgunModel';

/**
 * Shotgun detail study (shotgun.html): the Glacier Brawler, the alternative to
 * the Frost Breaker (now the game's Shotgun, see shotgunModel.ts). Preview only.
 */

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
