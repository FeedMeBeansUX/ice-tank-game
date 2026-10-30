import * as THREE from 'three';
import { faceted, glacierPalette, glacierTracks, mirrored, type BuiltModel, type GlacierPalette } from './heavyModel';
import { add, box, discZ, Kit, rodX, rollingWheel, sideProfile, TRACK_COLOR } from './modelKit';

/**
 * Rocket detail study (rocket.html): two takes on the Rocket in the Glacier
 * style of the finished tanks. Both keep the Rocket's character: a launcher
 * on a turntable that tilts up, full of rocket tubes. Same footprint (about
 * 2.2 m long, collision radius 1.15 m). Preview only.
 */

/** Big wheels with steel hubs at the given positions along the hull; they roll as the tank drives. */
function wheels(root: THREE.Object3D, k: Kit, hub: THREE.Material, xs: number[], z: number): void {
  const tyre = k.mat(TRACK_COLOR);
  for (const side of [-1, 1]) {
    for (const x of xs) {
      const wheel = discZ(root, tyre, 0.27, 0.26, 10, x, 0.27, side * z);
      add(wheel, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 6), hub));
      k.spinners.push(rollingWheel(wheel, 0.27, side));
    }
  }
}

/**
 * Rocket tube openings on the front face of a pod: dark bores with
 * ice-blue rocket noses peeking out. `face`: x of the pod's front face.
 */
function tubes(pod: THREE.Object3D, p: GlacierPalette, face: number, ys: number[], zs: number[], r: number): void {
  for (const y of ys) {
    for (const z of zs) {
      rodX(pod, p.black, r, r, 0.02, 8, face + 0.01, y, z);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, r * 1.8, 6), p.ice);
      nose.rotation.z = -Math.PI / 2;
      add(pod, nose, face + r * 0.5, y, z);
    }
  }
}

/**
 * Glacier Launcher: the current Rocket truck in the Glacier style. Faceted
 * cab with a dark windscreen, light bars and a roof stripe; a flat chamfered
 * bed on three wheels per side with charcoal mudguards and accent stripes; a
 * faceted turntable with an accent band and a tilted launcher pod with six
 * tubes and accent stripes on its sides.
 */
export function buildGlacierLauncher(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const guard = k.mat('#3a424b');
  const root = new THREE.Group();

  wheels(root, k, p.steel, [0.72, -0.3, -0.8], 0.58);
  for (const side of [-1, 1]) {
    // Front mudguard (flat top, sloped front) and one long guard over the rear pair.
    box(root, guard, 0.44, 0.04, 0.3, 0.7, 0.6, side * 0.62);
    const slope = box(root, guard, 0.2, 0.04, 0.3, 0.98, 0.52, side * 0.62);
    slope.rotation.z = -0.7;
    box(root, p.accent, 0.36, 0.012, 0.03, 0.68, 0.625, side * 0.62);
    box(root, guard, 0.96, 0.04, 0.3, -0.55, 0.6, side * 0.62);
    box(root, p.accent, 0.86, 0.012, 0.03, -0.55, 0.625, side * 0.62);
  }

  // Flat bed and the cab at the front.
  add(root, faceted(mirrored([[1.12, 0.36], [0.96, 0.46], [-1.02, 0.46], [-1.1, 0.38]]), 0.16, p.body, 0.05), 0, 0.34, 0);
  const bedTop = 0.34 + 0.16 + 0.05;
  add(root, sideProfile([[0.5, 0], [1.04, 0], [1.1, 0.1], [1.0, 0.36], [0.56, 0.38]], 0.86, p.body, 0.03), 0, bedTop, 0);
  const screen = box(root, p.black, 0.03, 0.14, 0.72, 1.06, bedTop + 0.23, 0);
  screen.rotation.z = 0.37;
  box(root, p.accent, 0.44, 0.015, 0.1, 0.78, bedTop + 0.415, 0);
  for (const side of [-1, 1]) {
    box(root, p.black, 0.03, 0.05, 0.2, 1.13, bedTop + 0.05, side * 0.24);
    box(root, p.lamp, 0.02, 0.03, 0.18, 1.145, bedTop + 0.05, side * 0.24);
  }

  // Faceted turntable with an accent band, and the tilted launcher pod.
  const turret = add(root, new THREE.Group(), -0.32, bedTop, 0);
  add(turret, faceted(mirrored([[0.36, 0.2], [0.22, 0.36], [-0.3, 0.36], [-0.4, 0.2]]), 0.1, p.dark, 0.04), 0, 0.04, 0);
  box(turret, p.accent, 0.36, 0.035, 0.82, -0.04, 0.1, 0);
  const tilt = add(turret, new THREE.Group(), 0, 0.3, 0);
  tilt.rotation.z = 0.3;
  const pod = box(tilt, p.dark, 0.95, 0.36, 0.54, 0.08, 0, 0);
  pod.userData.baseX = pod.position.x;
  box(pod, p.darker, 0.04, 0.4, 0.58, 0.47, 0, 0);
  tubes(pod, p, 0.49, [-0.08, 0.08], [-0.16, 0, 0.16], 0.055);
  for (const side of [-1, 1]) box(pod, p.accent, 0.7, 0.04, 0.012, -0.05, 0.08, side * 0.276);
  // Pod supports.
  for (const side of [-1, 1]) box(turret, p.darker, 0.2, 0.24, 0.05, 0.0, 0.2, side * 0.2);

  return { root, turret, barrels: [pod], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}

/**
 * Blizzard: a tracked rocket platform. Low wedge hull on full-length cleated
 * tracks under three skirt panels, light bars and accent stripes; a faceted
 * turntable with a targeting dome (glowing lens) between two tilted
 * four-tube pods.
 */
export function buildBlizzard(color: THREE.Color): BuiltModel {
  const k = new Kit();
  const p = glacierPalette(k, color);
  const root = new THREE.Group();

  glacierTracks(root, k, p, { length: 2.1, height: 0.36, width: 0.36, z: 0.6, panels: [-0.68, 0, 0.68], panelLength: 0.6, skirtHeight: 0.18, skirtY: 0.31, skirtZ: 0.8 });

  add(root, faceted(mirrored([[1.1, 0.22], [0.8, 0.5], [-0.98, 0.5], [-1.08, 0.4]]), 0.2, p.body, 0.07), 0, 0.28, 0);
  const hullTop = 0.28 + 0.2 + 0.07;
  for (const side of [-1, 1]) {
    box(root, p.accent, 1.4, 0.045, 0.02, -0.15, 0.42, side * 0.575);
    box(root, p.black, 0.03, 0.05, 0.22, 0.96, 0.45, side * 0.2);
    box(root, p.lamp, 0.02, 0.03, 0.2, 0.975, 0.45, side * 0.2);
  }

  // Turntable with a targeting dome between two pods.
  const turret = add(root, new THREE.Group(), -0.2, hullTop, 0);
  add(turret, faceted(mirrored([[0.4, 0.18], [0.2, 0.38], [-0.3, 0.38], [-0.44, 0.2]]), 0.1, p.dark, 0.05), 0, 0.05, 0);
  box(turret, p.accent, 0.4, 0.035, 0.86, -0.06, 0.12, 0);
  const dome = add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), p.darker), 0.02, 0.26, 0);
  dome.scale.set(1, 0.75, 1);
  box(turret, p.lamp, 0.03, 0.05, 0.08, 0.18, 0.27, 0);
  // Two tilted pods on one frame (they kick back together).
  const tilt = add(turret, new THREE.Group(), -0.02, 0.28, 0);
  tilt.rotation.z = 0.35;
  const pod = box(tilt, p.dark, 0.8, 0.26, 0.26, 0.12, 0, -0.32);
  pod.userData.baseX = pod.position.x;
  const other = box(pod, p.dark, 0.8, 0.26, 0.26, 0, 0, 0.64);
  for (const part of [pod, other]) {
    box(part, p.darker, 0.04, 0.3, 0.3, 0.4, 0, 0);
    tubes(part, p, 0.42, [-0.06, 0.06], [-0.06, 0.06], 0.045);
    box(part, p.accent, 0.6, 0.012, 0.06, -0.06, 0.136, 0);
  }

  return { root, turret, barrels: [pod], body: p.body, dark: p.dark, materials: k.materials, spinners: k.spinners };
}
