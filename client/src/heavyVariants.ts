import * as THREE from 'three';
import type { PreviewModel } from './previewPage';
import { buildTrack, flat, HUB_COLOR, rollingWheel, ROAD_WHEEL_COLOR, TRACK_COLOR, TREAD_COLOR, type Spinner } from './tankView';

/**
 * Heavy tank detail study (heavy.html). Two more detailed takes on the Heavy,
 * to compare against the simple low-poly game model:
 * - Glacier Ram: an imagined ice-sumo heavy with a spiked ram blade.
 * - Tiger: based on the WWII German Tiger I heavy tank.
 * Both keep the game Heavy's footprint (about 2.1 m long, collision radius
 * 1.15 m) and the game's colour rule: hull in the player colour, turret darker.
 * These are only for the preview page; the game still uses tankView.ts.
 */

/** Small helper that remembers every material it makes (the preview disposes them). */
class Kit {
  readonly materials: THREE.Material[] = [];
  readonly spinners: Spinner[] = [];
  mat(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, glow = 0.9): THREE.MeshStandardMaterial {
    const m = flat(color);
    if (emissive !== undefined) {
      m.emissive.set(emissive);
      m.emissiveIntensity = glow;
    }
    this.materials.push(m);
    return m;
  }
}

function add<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

function box(parent: THREE.Object3D, m: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.Mesh {
  return add(parent, new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m), x, y, z);
}

/** A cylinder lying along x (for barrels, exhausts pointing back, lights). */
function rodX(parent: THREE.Object3D, m: THREE.Material, rFront: number, rBack: number, length: number, sides: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rFront, rBack, length, sides), m);
  mesh.rotation.z = -Math.PI / 2;
  return add(parent, mesh, x, y, z);
}

/** A disc facing sideways (wheels). */
function discZ(parent: THREE.Object3D, m: THREE.Material, r: number, thickness: number, sides: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, sides), m);
  mesh.rotation.x = Math.PI / 2;
  return add(parent, mesh, x, y, z);
}

/** Extrude a side-view outline (x forward, y up) across the tank, `width` wide. */
function sideProfile(points: [number, number][], width: number, m: THREE.Material, bevel = 0): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  return new THREE.Mesh(g, m);
}

/** Extrude a top-view outline (x forward, second value sideways) upward by `height`. */
function topProfile(shape: THREE.Shape, height: number, m: THREE.Material, bevel = 0, curveSegments = 3): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, m);
}

/**
 * Glacier Ram: an imagined heavy built for ice sumo. A spiked ram blade at the
 * front for pushing, angled armour skirts over wide tracks with steel ice
 * cleats, a two-tier turret with a heat-sink barrel, headlights, a glowing
 * heater grille on the engine deck, and frost-capped exhausts.
 */
export function buildGlacierRam(color: THREE.Color): PreviewModel {
  const k = new Kit();
  const body = k.mat(color);
  const accent = k.mat(color.clone().lerp(new THREE.Color('#ffffff'), 0.35));
  const dark = k.mat(color.clone().multiplyScalar(0.55));
  const darker = k.mat(color.clone().multiplyScalar(0.38));
  const steel = k.mat('#5d6772');
  const bladeSteel = k.mat('#7d8995');
  const ice = k.mat('#cfe2ee');
  const black = k.mat('#15181c');
  const plate = k.mat('#3a424b');
  const lamp = k.mat('#d8fbff', '#bff4ff', 1.2);
  const heater = k.mat('#ff8a3d', '#ff7a2a', 1.1);
  const root = new THREE.Group();

  // Wide tracks with steel ice cleats.
  const trackMats = { belt: k.mat(TRACK_COLOR), tread: k.mat('#6f7b87'), wheel: k.mat(ROAD_WHEEL_COLOR), hub: k.mat(HUB_COLOR) };
  for (const side of [-1, 1]) {
    const t = buildTrack(2.1, 0.42, 0.44, side, trackMats, { treadPitch: 0.24 });
    add(root, t.group, 0, 0, side * 0.66);
    k.spinners.push(...t.spinners);
    // Angled armour skirts in three panels; the gaps show the wheels.
    for (const x of [-0.68, 0, 0.68]) {
      const panel = box(root, body, 0.62, 0.22, 0.04, x, 0.36, side * 0.9);
      panel.rotation.x = -side * 0.28;
      const trim = box(root, darker, 0.62, 0.04, 0.045, x, 0.26, side * 0.93);
      trim.rotation.x = -side * 0.28;
    }
  }

  // Faceted hull (big chamfers), blunt front.
  const hullShape = new THREE.Shape();
  const outline: [number, number][] = [[1.0, 0.44], [0.74, 0.7], [-0.9, 0.7], [-1.04, 0.52], [-1.04, -0.52], [-0.9, -0.7], [0.74, -0.7], [1.0, -0.44]];
  hullShape.moveTo(outline[0]![0], outline[0]![1]);
  for (const [x, y] of outline.slice(1)) hullShape.lineTo(x, y);
  hullShape.closePath();
  add(root, topProfile(hullShape, 0.3, body, 0.08), 0, 0.32, 0);
  const hullTop = 0.32 + 0.3 + 0.08;
  // Accent stripe along both sides of the hull.
  for (const side of [-1, 1]) box(root, accent, 1.5, 0.05, 0.02, -0.08, 0.5, side * 0.785);

  // Engine deck: dark plate with a glowing heater grille, exhausts with frost caps.
  box(root, plate, 0.6, 0.03, 1.1, -0.66, hullTop + 0.01, 0);
  for (const z of [-0.24, 0, 0.24]) box(root, heater, 0.42, 0.02, 0.06, -0.66, hullTop + 0.03, z);
  for (const side of [-1, 1]) {
    const pipe = rodX(root, steel, 0.05, 0.06, 0.32, 6, -0.98, hullTop + 0.08, side * 0.36);
    pipe.rotation.z = Math.PI / 2 - 0.5;
    const cap = rodX(root, ice, 0.065, 0.065, 0.05, 6, -1.12, hullTop + 0.17, side * 0.36);
    cap.rotation.z = Math.PI / 2 - 0.5;
  }

  // Ram blade with ice spikes, on two arms.
  for (const z of [-0.4, 0.4]) box(root, darker, 0.3, 0.1, 0.12, 1.04, 0.4, z);
  const blade = box(root, bladeSteel, 0.1, 0.52, 1.8, 1.2, 0.3, 0);
  blade.rotation.z = 0.45;
  // Top lip of the blade, folded forward.
  const lip = box(root, steel, 0.16, 0.05, 1.8, 1.14, 0.55, 0);
  lip.rotation.z = -0.3;
  for (const side of [-1, 1]) {
    const wing = box(root, bladeSteel, 0.34, 0.44, 0.07, 1.08, 0.3, side * 0.92);
    wing.rotation.y = side * 0.55;
    wing.rotation.z = 0.45;
  }
  for (const z of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 4), ice);
    spike.rotation.z = -Math.PI / 2;
    add(root, spike, 1.36, 0.16, z);
  }
  // Headlights in dark housings.
  for (const side of [-1, 1]) {
    box(root, black, 0.08, 0.09, 0.16, 0.86, hullTop + 0.04, side * 0.4);
    box(root, lamp, 0.02, 0.06, 0.12, 0.905, hullTop + 0.04, side * 0.4);
  }

  // Turret: hexagonal base, angular upper block, heat-sink barrel.
  const turret = add(root, new THREE.Group(), -0.12, hullTop, 0);
  const base = add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.16, 6), darker), 0, 0.08, 0);
  base.rotation.y = Math.PI / 6;
  add(turret, sideProfile([[-0.42, 0], [0.3, 0], [0.42, 0.12], [0.3, 0.22], [-0.36, 0.22], [-0.46, 0.1]], 0.66, dark, 0.02), 0, 0.16, 0);
  box(turret, accent, 0.5, 0.035, 0.71, -0.08, 0.3, 0);
  // Barrel with three heat-sink rings and a squared muzzle.
  box(turret, dark, 1.0, 0.16, 0.16, 0.92, 0.27, 0);
  for (const x of [0.6, 0.7, 0.8]) box(turret, darker, 0.05, 0.24, 0.24, x, 0.27, 0);
  box(turret, darker, 0.16, 0.22, 0.22, 1.38, 0.27, 0);
  box(turret, black, 0.02, 0.1, 0.1, 1.465, 0.27, 0);
  // Side gun pod, sensor with a glowing lens, antenna.
  box(turret, steel, 0.3, 0.1, 0.12, 0.3, 0.3, 0.42);
  rodX(turret, black, 0.02, 0.02, 0.2, 5, 0.55, 0.3, 0.42);
  box(turret, darker, 0.14, 0.1, 0.12, -0.12, 0.43, -0.2);
  box(turret, lamp, 0.02, 0.05, 0.08, -0.04, 0.43, -0.2);
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), black), -0.34, 0.7, 0.24);
  add(turret, new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), k.mat(color, color, 0.8)), -0.34, 1.06, 0.24);

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
