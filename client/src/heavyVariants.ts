import * as THREE from 'three';
import { faceted, glacierBarrel, glacierLights, glacierPalette, mirrored, type GlacierPalette } from './heavyModel';
import { add, box, buildTrack, discZ, HUB_COLOR, Kit, rodX, rollingWheel, ROAD_WHEEL_COLOR, sideProfile, topProfile, TRACK_COLOR, TREAD_COLOR } from './modelKit';
import type { PreviewModel } from './previewPage';

/**
 * Heavy tank detail study (heavy.html): the alternatives that were compared
 * with the Glacier Ram (now the game's Heavy, see heavyModel.ts):
 * - Ram Lite: a simpler Glacier Ram with a ram blade.
 * - Ram × Tiger: a hybrid of the Glacier Ram and the Tiger.
 * - Tiger: based on the WWII German Tiger I heavy tank.
 * Same footprint as the game Heavy (about 2.1 m long, collision radius
 * 1.15 m). Preview only.
 */

/**
 * Spiked ram blade on two arms. `x` is where the blade sits (just ahead of the
 * hull's nose). Full: folded top lip, angled side wings and five spikes.
 * Simple: plain blade and three spikes.
 */
function ramBlade(root: THREE.Object3D, p: GlacierPalette, x: number, full: boolean): void {
  for (const z of [-0.4, 0.4]) box(root, p.darker, 0.3, 0.1, 0.12, x - 0.16, 0.4, z);
  const blade = box(root, p.bladeSteel, 0.1, 0.52, full ? 1.8 : 1.6, x, 0.3, 0);
  blade.rotation.z = 0.45;
  if (full) {
    const lip = box(root, p.steel, 0.16, 0.05, 1.8, x - 0.06, 0.55, 0);
    lip.rotation.z = -0.3;
    for (const side of [-1, 1]) {
      const wing = box(root, p.bladeSteel, 0.34, 0.44, 0.07, x - 0.12, 0.3, side * 0.92);
      wing.rotation.y = side * 0.55;
      wing.rotation.z = 0.45;
    }
  }
  for (const z of full ? [-0.66, -0.33, 0, 0.33, 0.66] : [-0.5, 0, 0.5]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 4), p.ice);
    spike.rotation.z = -Math.PI / 2;
    add(root, spike, x + 0.16, 0.16, z);
  }
}

/**
 * Ram Lite: the Glacier Ram with fewer parts. Same hull, turret shape and
 * blade, but a plain blade with three spikes, one-piece skirts, normal
 * treads, one heat-sink ring, and no gun pod, sensor or antenna.
 */
export function buildRamLite(color: THREE.Color): PreviewModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  const trackMats = { belt: k.mat(TRACK_COLOR), tread: k.mat(TREAD_COLOR), wheel: k.mat(ROAD_WHEEL_COLOR), hub: k.mat(HUB_COLOR) };
  for (const side of [-1, 1]) {
    const t = buildTrack(2.1, 0.42, 0.44, side, trackMats);
    add(root, t.group, 0, 0, side * 0.66);
    k.spinners.push(...t.spinners);
    const skirt = box(root, p.body, 1.9, 0.2, 0.04, 0, 0.37, side * 0.9);
    skirt.rotation.x = -side * 0.28;
  }
  add(root, faceted(mirrored([[1.0, 0.44], [0.74, 0.7], [-0.9, 0.7], [-1.04, 0.52]]), 0.3, p.body, 0.08), 0, 0.32, 0);
  const hullTop = 0.32 + 0.3 + 0.08;
  ramBlade(root, p, 1.2, false);
  glacierLights(root, p, 0.86, hullTop + 0.04, 0.4);
  const turret = add(root, new THREE.Group(), -0.12, hullTop, 0);
  add(turret, faceted(mirrored([[0.44, 0.22], [0.24, 0.42], [-0.38, 0.42], [-0.5, 0.24]]), 0.24, p.dark, 0.07), 0, 0.07, 0);
  box(turret, p.accent, 0.62, 0.04, 1.04, -0.1, 0.2, 0);
  glacierBarrel(turret, p, { start: 0.45, length: 1.0, thickness: 0.16, y: 0.22, z: 0, rings: 1 });
  return { root, turret, materials: k.materials, spinners: k.spinners };
}

/**
 * Tiger: based on the WWII German Tiger I heavy tank. Boxy superstructure that
 * overhangs the tracks, a vertical front plate with the driver's visor and a
 * ball-mounted machine gun, interleaved road wheels (two rows), sloped fenders,
 * engine grilles and two exhausts at the back. Horseshoe-shaped turret with a
 * mantlet, a long gun with a two-baffle muzzle brake, commander's cupola,
 * smoke dischargers and a stowage bin at the rear.
 */
export function buildTiger(color: THREE.Color): PreviewModel {
  const k = new Kit();
  const body = k.mat(color);
  const dark = k.mat(color.clone().multiplyScalar(0.55));
  const darker = k.mat(color.clone().multiplyScalar(0.4));
  const black = k.mat('#1b1f24');
  const steel = k.mat('#565f69');
  const iron = k.mat('#2d3339');
  const lamp = k.mat('#e8e2c8', '#fff4d0', 0.5);
  const root = new THREE.Group();

  // Wide tracks; road wheels are added separately (interleaved).
  const trackMats = { belt: k.mat(TRACK_COLOR), tread: k.mat(TREAD_COLOR), wheel: steel, hub: iron };
  for (const side of [-1, 1]) {
    const t = buildTrack(2.14, 0.4, 0.4, side, trackMats, { roadWheels: false, treadPitch: 0.22 });
    add(root, t.group, 0, 0, side * 0.6);
    k.spinners.push(...t.spinners);
    // Interleaved road wheels: an outer row of four and an inner row of three in the gaps.
    const r = 0.165;
    const rows: [number[], number][] = [
      [[-0.72, -0.24, 0.24, 0.72], side * 0.825],
      [[-0.48, 0, 0.48], side * 0.8],
    ];
    for (const [xs, z] of rows) {
      for (const x of xs) {
        const wheel = discZ(root, steel, r, 0.035, 12, x, 0.2, z);
        add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), iron));
        k.spinners.push(rollingWheel(wheel, r, side));
      }
    }
    // Drive sprocket (front, toothed) and idler (back).
    const sprocket = discZ(root, iron, 0.13, 0.06, 10, 0.92, 0.24, side * 0.79);
    add(sprocket, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 5), iron));
    k.spinners.push(rollingWheel(sprocket, 0.13, side));
    const idler = discZ(root, iron, 0.12, 0.06, 10, -0.93, 0.24, side * 0.79);
    k.spinners.push(rollingWheel(idler, 0.12, side));
    // Sloped fenders over the outer wheels, and small front mudguards.
    const fender = box(root, body, 1.9, 0.025, 0.16, -0.04, 0.45, side * 0.79);
    fender.rotation.x = side * 0.35;
    const guard = box(root, body, 0.2, 0.025, 0.3, 1.02, 0.47, side * 0.72);
    guard.rotation.z = -0.25;
  }

  // Lower hull with a sloped glacis, and the boxy superstructure over the tracks.
  add(root, sideProfile([[-1.0, 0.1], [0.86, 0.1], [1.06, 0.3], [1.06, 0.34], [-1.02, 0.34]], 0.84, body));
  box(root, body, 2.04, 0.28, 1.44, 0, 0.48, 0);
  const deck = 0.62;

  // Front plate: driver's visor, ball-mounted machine gun, spare track links, headlights.
  box(root, black, 0.03, 0.05, 0.18, 1.03, 0.55, 0.3);
  add(root, new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), dark), 1.03, 0.52, -0.3);
  rodX(root, black, 0.015, 0.015, 0.12, 5, 1.1, 0.52, -0.3);
  for (const z of [-0.08, 0.08]) box(root, iron, 0.025, 0.07, 0.12, 1.035, 0.44, z);
  for (const side of [-1, 1]) {
    rodX(root, lamp, 0.04, 0.045, 0.08, 8, 0.96, deck + 0.05, side * 0.52);
  }

  // Engine deck: four grilles, tow cables along the sides; two exhausts at the back.
  for (const x of [-0.78, -0.48]) for (const z of [-0.32, 0.32]) box(root, black, 0.24, 0.015, 0.26, x, deck + 0.008, z);
  for (const side of [-1, 1]) rodX(root, iron, 0.015, 0.015, 1.5, 5, -0.1, deck + 0.02, side * 0.66);
  for (const side of [-1, 1]) {
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 6), iron), -1.06, 0.6, side * 0.3);
    box(root, darker, 0.06, 0.18, 0.12, -1.1, 0.56, side * 0.3);
  }
  // Jack on the rear plate.
  box(root, iron, 0.05, 0.08, 0.26, -1.04, 0.42, 0);

  // Turret: horseshoe shape (flat front, rounded back), mantlet and long gun.
  const turret = add(root, new THREE.Group(), -0.05, deck, 0);
  const shoe = new THREE.Shape();
  shoe.moveTo(0.38, -0.4);
  shoe.lineTo(0.38, 0.4);
  shoe.lineTo(-0.1, 0.42);
  shoe.absarc(-0.1, 0, 0.42, Math.PI / 2, (3 * Math.PI) / 2, false);
  shoe.lineTo(0.38, -0.4);
  add(turret, topProfile(shoe, 0.27, dark, 0.03, 3), 0, 0.03, 0);
  box(turret, darker, 0.12, 0.24, 0.46, 0.45, 0.17, 0);
  // Gun: a slightly tapered barrel with a two-baffle muzzle brake.
  rodX(turret, dark, 0.038, 0.05, 1.3, 8, 1.16, 0.17, 0);
  rodX(turret, darker, 0.07, 0.07, 0.06, 8, 1.8, 0.17, 0);
  rodX(turret, darker, 0.05, 0.05, 0.08, 8, 1.87, 0.17, 0);
  rodX(turret, darker, 0.07, 0.07, 0.06, 8, 1.94, 0.17, 0);
  // Commander's cupola with a hatch, loader's hatch.
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.1, 8), darker), -0.26, 0.38, 0.2);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 8), dark), -0.26, 0.44, 0.2);
  box(turret, darker, 0.18, 0.02, 0.18, 0.02, 0.34, -0.2);
  // Smoke dischargers: three small tubes on each front corner.
  for (const side of [-1, 1]) {
    for (const [i, x] of [0.3, 0.22, 0.14].entries()) {
      const tube = add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 6), iron), x, 0.27 + i * 0.01, side * 0.43);
      tube.rotation.x = side * 0.6;
    }
  }
  // Stowage bin on the back of the turret.
  box(turret, dark, 0.2, 0.18, 0.62, -0.62, 0.15, 0);

  return { root, turret, materials: k.materials, spinners: k.spinners };
}

/**
 * Ram × Tiger hybrid: the Tiger's build (boxy upper hull over the tracks,
 * interleaved road wheels, sloped fenders, horseshoe turret with a mantlet and
 * a long gun with a muzzle brake, stowage bin) with the Glacier Ram's ice-sumo
 * kit (spiked ram blade, ice-cleat tracks, headlights, accent stripes,
 * heat-sink rings). The fussy Tiger extras (grilles, cables, exhausts, smoke
 * dischargers) are left off.
 */
export function buildRamTiger(color: THREE.Color): PreviewModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const steel = k.mat('#565f69');
  const iron = k.mat('#2d3339');
  const root = new THREE.Group();

  const trackMats = { belt: k.mat(TRACK_COLOR), tread: k.mat('#6f7b87'), wheel: steel, hub: iron };
  for (const side of [-1, 1]) {
    const t = buildTrack(2.14, 0.4, 0.4, side, trackMats, { roadWheels: false, treadPitch: 0.24 });
    add(root, t.group, 0, 0, side * 0.6);
    k.spinners.push(...t.spinners);
    // Interleaved road wheels: outer row of four, inner row of three.
    const r = 0.165;
    const rows: [number[], number][] = [
      [[-0.72, -0.24, 0.24, 0.72], side * 0.825],
      [[-0.48, 0, 0.48], side * 0.8],
    ];
    for (const [xs, z] of rows) {
      for (const x of xs) {
        const wheel = discZ(root, steel, r, 0.035, 12, x, 0.2, z);
        add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), iron));
        k.spinners.push(rollingWheel(wheel, r, side));
      }
    }
    const sprocket = discZ(root, iron, 0.13, 0.06, 10, 0.92, 0.24, side * 0.79);
    add(sprocket, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 5), iron));
    k.spinners.push(rollingWheel(sprocket, 0.13, side));
    const idler = discZ(root, iron, 0.12, 0.06, 10, -0.93, 0.24, side * 0.79);
    k.spinners.push(rollingWheel(idler, 0.12, side));
    // Sloped fenders with an accent edge.
    const fender = box(root, p.body, 1.9, 0.025, 0.16, -0.04, 0.45, side * 0.79);
    fender.rotation.x = side * 0.35;
    const edge = box(root, p.accent, 1.9, 0.03, 0.02, -0.04, 0.42, side * 0.865);
    edge.rotation.x = side * 0.35;
  }

  // Lower hull with a sloped glacis; upper hull over the tracks with chamfered front corners.
  add(root, sideProfile([[-1.0, 0.1], [0.86, 0.1], [1.06, 0.3], [1.06, 0.34], [-1.02, 0.34]], 0.84, p.body));
  const upper = new THREE.Shape();
  const pts: [number, number][] = [[1.02, 0.54], [0.84, 0.72], [-0.94, 0.72], [-1.02, 0.62], [-1.02, -0.62], [-0.94, -0.72], [0.84, -0.72], [1.02, -0.54]];
  upper.moveTo(pts[0]![0], pts[0]![1]);
  for (const [x, y] of pts.slice(1)) upper.lineTo(x, y);
  upper.closePath();
  add(root, topProfile(upper, 0.24, p.body, 0.04), 0, 0.34, 0);
  const deck = 0.34 + 0.24 + 0.04;
  for (const side of [-1, 1]) box(root, p.accent, 1.6, 0.05, 0.02, -0.05, 0.5, side * 0.765);

  // Front: driver's visor, headlights, ram blade.
  box(root, p.black, 0.03, 0.05, 0.18, 1.06, 0.52, 0.3);
  glacierLights(root, p, 0.9, deck + 0.04, 0.46);
  ramBlade(root, p, 1.26, false);

  // Turret: horseshoe shape with a mantlet, accent band, long gun with
  // heat-sink rings and a muzzle brake, one-piece cupola, stowage bin.
  const turret = add(root, new THREE.Group(), -0.08, deck, 0);
  const shoe = new THREE.Shape();
  shoe.moveTo(0.38, -0.4);
  shoe.lineTo(0.38, 0.4);
  shoe.lineTo(-0.1, 0.42);
  shoe.absarc(-0.1, 0, 0.42, Math.PI / 2, (3 * Math.PI) / 2, false);
  shoe.lineTo(0.38, -0.4);
  add(turret, topProfile(shoe, 0.27, p.dark, 0.03, 3), 0, 0.03, 0);
  box(turret, p.accent, 0.46, 0.04, 0.96, -0.1, 0.2, 0);
  box(turret, p.darker, 0.12, 0.24, 0.46, 0.45, 0.17, 0);
  rodX(turret, p.dark, 0.04, 0.05, 1.25, 8, 1.13, 0.17, 0);
  for (const x of [0.62, 0.72]) rodX(turret, p.darker, 0.08, 0.08, 0.05, 8, x, 0.17, 0);
  rodX(turret, p.darker, 0.07, 0.07, 0.06, 8, 1.76, 0.17, 0);
  rodX(turret, p.darker, 0.05, 0.05, 0.08, 8, 1.83, 0.17, 0);
  rodX(turret, p.darker, 0.07, 0.07, 0.06, 8, 1.9, 0.17, 0);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.12, 8), p.darker), -0.26, 0.39, 0.2);
  box(turret, p.dark, 0.2, 0.18, 0.62, -0.62, 0.15, 0);

  return { root, turret, materials: k.materials, spinners: k.spinners };
}
