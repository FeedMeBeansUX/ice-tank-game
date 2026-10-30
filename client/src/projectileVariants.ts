import * as THREE from 'three';
import { add, box, rodX } from './modelKit';
import type { PreviewModel } from './previewPage';
import { mineShape, missileShape } from './powerupViews';
import { pelletShape, canisterShape, DARK, glacierMineShape, glacierMissileShape, glacierShellShape, ICE, ICE_GLOW, LIGHT_STEEL, Mats, slugShape, STEEL, EXPLOSIVE } from './projectileModels';

/**
 * Projectile and mine detail study (projectiles.html): the current (old)
 * shapes, the chosen Glacier models (projectileModels.ts) and the
 * alternatives, at their game sizes, nose along +x. Flying things sit 0.9 m
 * above the ice like in the game. Preview only.
 */

const FLY_HEIGHT = 0.9;

function model(root: THREE.Group, mats: Mats, animate?: (time: number) => void): PreviewModel {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret: new THREE.Group(), materials: mats.list, spinners: [], animate };
}

/** A cylinder lying along x, centred at x. */
function along(parent: THREE.Object3D, m: THREE.Material, r: number, length: number, sides: number, x: number, rBack = r): THREE.Mesh {
  return rodX(parent, m, r, rBack, length, sides, x, 0, 0);
}

/** A cone lying along x, tip pointing +x (or -x with dir = -1). */
function coneX(parent: THREE.Object3D, m: THREE.Material, r: number, length: number, sides: number, x: number, dir = 1): THREE.Mesh {
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, length, sides), m);
  c.rotation.z = -dir * (Math.PI / 2);
  return add(parent, c, x, 0, 0);
}

// ---------------------------------------------------------------- shots

/** Current tank shot: an unlit, spinning ball in the shooter's colour. */
export function shotCurrent(color: THREE.Color, r = 0.22): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const ball = add(root, new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mats.basic(color)), 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => ball.rotation.set(t * 7, t * 5, 0));
}

/**
 * Ice Shard: a stretched, glowing crystal in the shooter's colour, pointing
 * where it flies, with two fading shards trailing behind.
 */
export function shotShard(color: THREE.Color, r = 0.22): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const holder = add(root, new THREE.Group(), 0, FLY_HEIGHT, 0);
  const crystal = add(holder, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mats.std(color, color, 0.9)));
  crystal.scale.set(r * 2.2, r * 0.85, r * 0.85);
  const core = add(holder, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mats.basic('#ffffff', 0.85)));
  core.scale.set(r * 1.2, r * 0.4, r * 0.4);
  for (const [i, opacity] of [0.5, 0.25].entries()) {
    const trail = add(holder, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mats.basic(color, opacity)), -r * (2.6 + i * 1.6), 0, 0);
    trail.scale.set(r * (1.2 - i * 0.3), r * (0.5 - i * 0.12), r * (0.5 - i * 0.12));
  }
  return model(root, mats, (t) => (holder.rotation.x = t * 6));
}

/** Tracer Slug (chosen, in the game): see projectileModels.ts. */
export function shotSlug(color: THREE.Color, r = 0.22): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, slugShape(mats, color), 0, FLY_HEIGHT, 0);
  g.scale.setScalar(r);
  return model(root, mats);
}

// ---------------------------------------------------------------- missiles

/** Current homing missile (powerup size; the Rocket's rockets are the same shape at about half size). */
export function missileCurrent(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  add(root, missileShape(color, 1.4), 0, FLY_HEIGHT, 0);
  return model(root, mats);
}

/** Glacier Missile (chosen, in the game): see projectileModels.ts. */
export function missileGlacier(color: THREE.Color, scale = 1.4): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const { group, glow } = glacierMissileShape(mats, color, scale);
  add(root, group, 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => (glow.opacity = 0.7 + 0.25 * Math.sin(t * 30)));
}

/**
 * Frost Rocket: longer, darker steel body with an ice nose, two bands in the
 * shooter's colour, swept-back fins and an ice-blue exhaust glow.
 */
export function missileFrost(color: THREE.Color, scale = 1.4): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, new THREE.Group(), 0, FLY_HEIGHT, 0);
  const accent = mats.std(color, color, 0.35);
  const dark = mats.std(STEEL);
  along(g, dark, 0.13, 0.92, 6, 0);
  coneX(g, mats.std(ICE), 0.13, 0.36, 6, 0.64);
  for (const x of [0.3, 0.16]) along(g, accent, 0.135, 0.05, 6, x);
  for (const side of [-1, 1]) {
    for (const up of [-1, 1]) {
      const fin = box(g, dark, 0.26, 0.025, 0.18, -0.36, up * 0.07, side * 0.12);
      fin.rotation.y = side * 0.5;
      fin.rotation.x = up * side * 0.6;
    }
  }
  const glow = mats.basic(ICE_GLOW, 0.9);
  along(g, glow, 0.09, 0.05, 6, -0.485);
  g.scale.setScalar(scale);
  return model(root, mats, (t) => (glow.opacity = 0.7 + 0.25 * Math.sin(t * 30)));
}

// ---------------------------------------------------------------- grenades

/** Current Shotgun grenade: a small dark-green ball, tumbling. */
export function grenadeCurrent(): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const ball = add(root, new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mats.std('#3e5a2c')), 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => ball.rotation.set(t * 9, t * 7, 0));
}

/** Canister grenade (chosen, in the game): see projectileModels.ts. */
export function grenadeGlacier(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const { group, fuse } = canisterShape(mats, color);
  add(root, group, 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => {
    group.rotation.set(t * 9, t * 7, 0);
    fuse.color.set(Math.sin(t * 20) > 0 ? ICE_GLOW : '#20414d');
  });
}

/**
 * Ice Puck: a flat, eight-sided disc with an edge band in the thrower's colour
 * and a glowing ice dome on top; it spins flat through the air.
 */
export function grenadePuck(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, new THREE.Group(), 0, FLY_HEIGHT, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 8), mats.std(DARK)));
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.04, 8), mats.std(color, color, 0.3)));
  const dome = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mats.std(ICE, ICE_GLOW, 0.7)), 0, 0.07, 0);
  dome.scale.y = 0.6;
  return model(root, mats, (t) => {
    g.rotation.y = t * 12;
    g.rotation.z = Math.sin(t * 3) * 0.25;
  });
}

// ---------------------------------------------------------------- artillery shells

/** Current Artillery shell: a grey (or glowing orange, when explosive) ball, tumbling. */
export function shellCurrent(explosive: boolean, r = 0.2): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const m = explosive ? mats.std('#ff7a3d', EXPLOSIVE, 0.6) : mats.std('#4a4f57');
  const ball = add(root, new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), m), 0, FLY_HEIGHT, 0);
  ball.scale.setScalar(r * (explosive ? 1.4 : 1));
  return model(root, mats, (t) => ball.rotation.set(t * 9, t * 7, 0));
}

/** Glacier Shell (chosen, in the game): see projectileModels.ts. */
export function shellGlacier(color: THREE.Color, explosive: boolean, r = 0.2): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, glacierShellShape(mats, color, explosive, r), 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => (g.children[0]!.rotation.x = t * 8));
}

/**
 * Mortar Bomb: a teardrop body with a tail boom and four fins, a band in the
 * shooter's colour (glowing orange when explosive), nose along its flight path.
 */
export function shellBomb(color: THREE.Color, explosive: boolean, r = 0.2): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, new THREE.Group(), 0, FLY_HEIGHT, 0);
  const body = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), explosive ? mats.std('#ff7a3d', EXPLOSIVE, 0.8) : mats.std(STEEL)), 0.08, 0, 0);
  body.scale.set(1.45, 1, 1);
  along(g, mats.std(DARK), 0.05, 0.26, 6, -0.24);
  const fins = mats.std(DARK);
  for (let i = 0; i < 4; i++) {
    const fin = box(g, fins, 0.14, 0.02, 0.2, -0.32, 0, 0);
    fin.rotation.x = (i * Math.PI) / 2;
  }
  along(g, explosive ? mats.std('#ffd2a8', EXPLOSIVE, 1) : mats.std(color, color, 0.3), 0.175, 0.04, 8, 0.0);
  g.scale.setScalar((r / 0.2) * (explosive ? 1.25 : 1));
  return model(root, mats, (t) => (g.rotation.x = t * 8));
}

// ---------------------------------------------------------------- mines

/** Blinks a mine light like the game: red once live, faster near the end. */
function blink(light: THREE.MeshBasicMaterial): (t: number) => void {
  return (t) => light.color.set(Math.sin(t * 8) > 0 ? '#ff3b30' : '#5a1512');
}

function ownerRing(root: THREE.Object3D, mats: Mats, color: THREE.Color): void {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 24), mats.basic(color, 0.8));
  ring.rotation.x = -Math.PI / 2;
  add(root, ring, 0, 0.03, 0);
}

/** Current mine: flat disc with six spikes and a light on top; ring in the dropper's colour. */
export function mineCurrent(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const shape = mineShape();
  ownerRing(shape.group, mats, color);
  mats.list.push(shape.light);
  return model(shape.group, mats, blink(shape.light));
}

/** Glacier Mine (chosen, in the game): see projectileModels.ts. */
export function mineGlacier(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const { group, light } = glacierMineShape(mats, color);
  mats.list.push(light);
  ownerRing(group, mats, color);
  return model(group, mats, blink(light));
}

/**
 * Frost Mine: a low six-sided plate with an inner ring in the dropper's
 * colour, six ice-crystal spikes leaning outward and a light in the middle.
 */
export function mineFrost(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.12, 6), mats.std(DARK)), 0, 0.06, 0);
  add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 6), mats.std(color, color, 0.35)), 0, 0.125, 0);
  const ice = mats.std(ICE, ICE_GLOW, 0.25);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const spike = add(root, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), ice), Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4);
    spike.scale.set(0.05, 0.16, 0.05);
    spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  const light = mats.basic('#888888');
  add(root, new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), light), 0, 0.2, 0);
  ownerRing(root, mats, color);
  return model(root, mats, blink(light));
}

// ---------------------------------------------------------------- pellets and machine-gun rounds

/** Current Shotgun pellet / machine-gun round: the same spinning ball as a tank shot, smaller. */
export function pelletCurrent(color: THREE.Color, r = 0.14): PreviewModel {
  return shotCurrent(color, r);
}

/** Ice Pellet (chosen, in the game): see projectileModels.ts. */
export function pelletShard(color: THREE.Color, r = 0.14): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, pelletShape(mats, color), 0, FLY_HEIGHT, 0);
  g.scale.setScalar(r);
  return model(root, mats, (t) => (g.children[0]!.rotation.x = t * 6));
}

/** Mini Tracer: a short bullet in the shooter's colour with a steel tip and a short tracer streak. */
export function pelletTracer(color: THREE.Color, r = 0.14): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, new THREE.Group(), 0, FLY_HEIGHT, 0);
  along(g, mats.std(color, color, 0.35), 0.7, 1.2, 6, 0);
  coneX(g, mats.std(LIGHT_STEEL), 0.7, 0.9, 6, 1.05);
  coneX(g, mats.basic(color, 0.5), 0.55, 2.2, 6, -1.7, -1);
  g.scale.setScalar(r);
  return model(root, mats);
}
