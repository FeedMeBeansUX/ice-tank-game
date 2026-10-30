import * as THREE from 'three';
import { DEFAULT_TUNING as T } from '@ice-tank-sumo/shared';
import { add } from './modelKit';
import { bomberShape, droneShape, powerupCrystal, powerupIcon } from './pickupModels';
import { POWERUP_COLORS } from './powerupViews';
import type { PreviewModel } from './previewPage';
import { bombShape, canisterShape, glacierMineShape, glacierMissileShape, glacierShellShape, ICE_GLOW, Mats, pelletShape, slugShape } from './projectileModels';
import { SLUG_LOOK_SCALE } from './tankView';

/**
 * The projectiles page (projectiles.html): every projectile, mine, drone,
 * powerup and plane the game uses, built with the game's own models
 * (projectileModels.ts, pickupModels.ts) at their in-game sizes, nose along +x.
 * Flying things sit at their in-game height. Preview only.
 */

const FLY_HEIGHT = 0.9;

function model(root: THREE.Group, mats: Mats, animate?: (time: number) => void): PreviewModel {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, turret: new THREE.Group(), materials: mats.list, spinners: [], animate };
}

/** A Tracer Slug as the game draws it for this shot radius (power shots: yellow, same size). */
export function slug(color: THREE.ColorRepresentation, radius: number): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, slugShape(mats, color), 0, FLY_HEIGHT, 0);
  g.scale.setScalar(radius * SLUG_LOOK_SCALE);
  return model(root, mats);
}

/** An Ice Pellet for this shot radius (Shotgun pellets, machine-gun rounds, drone shots). */
export function pellet(color: THREE.Color, radius: number): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, pelletShape(mats, color), 0, FLY_HEIGHT, 0);
  g.scale.setScalar(radius);
  return model(root, mats, (t) => (g.children[0]!.rotation.x = t * 6));
}

/** The homing missile (powerup, scale 1.4) or a Rocket tank rocket (scale 0.75). */
export function missile(color: THREE.Color, scale: number): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const { group, glow } = glacierMissileShape(mats, color, scale);
  add(root, group, 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => (glow.opacity = 0.7 + 0.25 * Math.sin(t * 30)));
}

/** Shotgun grenade (Canister), tumbling, with its blinking fuse. */
export function grenade(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const { group, fuse } = canisterShape(mats, color);
  add(root, group, 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => {
    group.rotation.set(t * 9, t * 7, 0);
    fuse.color.set(Math.sin(t * 20) > 0 ? ICE_GLOW : '#20414d');
  });
}

/** Artillery shell (normal or explosive), rolling along its flight path. */
export function shell(color: THREE.Color, explosive: boolean): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const g = add(root, glacierShellShape(mats, color, explosive, T.tanks.modelF.projectileRadius), 0, FLY_HEIGHT, 0);
  return model(root, mats, (t) => (g.children[0]!.rotation.x = t * 8));
}

/** Airstrike bomb, falling point down. */
export function bomb(): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  add(root, bombShape(mats), 0, FLY_HEIGHT, 0);
  return model(root, mats);
}

/** Mine on the ice (live: blinking red), with the ring in the dropper's colour. */
export function mine(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const { group, light } = glacierMineShape(mats, color);
  mats.list.push(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 24), mats.basic(color, 0.8));
  ring.rotation.x = -Math.PI / 2;
  add(group, ring, 0, 0.03, 0);
  return model(group, mats, (t) => light.color.set(Math.sin(t * 8) > 0 ? '#ff3b30' : '#5a1512'));
}

/** Rocket drone, hovering (lower than in the game, to fit the page). */
export function drone(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  const { group, body, rotors } = droneShape(mats, color);
  add(root, group, 0, 1.2, 0);
  return model(root, mats, (t) => {
    body.rotation.y = t * 0.6;
    for (const r of rotors) r.rotation.y = t * 40;
    group.position.y = 1.2 + Math.sin(t * 3) * 0.08;
  });
}

/** A powerup as it lies on the ice in the game (colour by kind). */
export function powerup(kind: 'missile' | 'mine' | 'rapidFire' | 'airstrike'): PreviewModel {
  const mats = new Mats();
  const color = POWERUP_COLORS[kind];
  const root = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 24), mats.basic(color, 0.7));
  ring.rotation.x = -Math.PI / 2;
  add(root, ring, 0, 0.03, 0);
  const holder = add(root, new THREE.Group(), 0, 1, 0);
  const spin = add(holder, new THREE.Group());
  spin.add(powerupIcon(mats, kind, color));
  const crystal = holder.add(powerupCrystal(mats)).children[1]!;
  return model(root, mats, (t) => {
    holder.position.y = 1 + Math.sin(t * 3) * 0.15;
    spin.rotation.y = t * 1.6;
    crystal.rotation.y = -t * 0.7;
  });
}

/** The airstrike's stealth bomber, at full size (lower than in the game, to fit the page). */
export function bomber(color: THREE.Color): PreviewModel {
  const mats = new Mats();
  const root = new THREE.Group();
  add(root, bomberShape(mats, color), 0, 1.6, 0);
  return model(root, mats);
}
