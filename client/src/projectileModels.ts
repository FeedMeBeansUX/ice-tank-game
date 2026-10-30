import * as THREE from 'three';
import { add, box, flat, rodX } from './modelKit';

/**
 * Projectile and mine models in the Glacier style (chosen in the projectiles
 * study, projectiles.html): Tracer Slug shots, Ice Pellets, Glacier missiles, Canister
 * grenades, Glacier shells and Glacier mines. All built at the origin, nose
 * along +x. Accents in the shooter's colour, steel and ice for the rest,
 * glowing ice blue (orange when explosive) for lights and exhausts.
 */

export const STEEL = '#5d6772';
export const LIGHT_STEEL = '#c9d3db';
export const DARK = '#2e343b';
export const ICE = '#cfe2ee';
export const ICE_GLOW = '#7fe3ff';
export const EXPLOSIVE = '#ff5b2e';
const COPPER = '#b8733d';

/**
 * Makes materials. With `shared`, the same colour settings reuse one material
 * (the game makes many projectiles in a handful of colours); without it, every
 * material is new and listed in `list` so a preview can dispose them.
 */
export class Mats {
  readonly list: THREE.Material[] = [];
  constructor(private readonly shared?: Map<string, THREE.Material>) {}
  std(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, glow = 0.8): THREE.MeshStandardMaterial {
    return this.get(`s|${new THREE.Color(color).getHexString()}|${emissive === undefined ? '' : new THREE.Color(emissive).getHexString()}|${glow}`, () => {
      const m = flat(color);
      if (emissive !== undefined) {
        m.emissive.set(emissive);
        m.emissiveIntensity = glow;
      }
      return m;
    });
  }
  basic(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
    return this.get(`b|${new THREE.Color(color).getHexString()}|${opacity}`, () => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  }
  private get<T extends THREE.Material>(key: string, make: () => T): T {
    const known = this.shared?.get(key);
    if (known) return known as T;
    const m = make();
    this.shared?.set(key, m);
    this.list.push(m);
    return m;
  }
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

function shadows(g: THREE.Object3D): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
}

/**
 * Tracer Slug (tank shots): a faceted bullet in the shooter's colour with a
 * steel nose and a glowing tracer streak behind it. Built for radius 1; scale
 * the group by the shot's radius.
 */
export function slugShape(m: Mats, color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  along(g, m.std(color, color, 0.35), 0.7, 1.6, 6, 0);
  coneX(g, m.std(LIGHT_STEEL), 0.7, 1.2, 6, 1.4);
  along(g, m.std(DARK), 0.74, 0.25, 6, -0.7);
  coneX(g, m.basic(color, 0.55), 0.6, 4, 6, -2.8, -1);
  shadows(g);
  // The tracer streak casts no shadow.
  (g.children[3] as THREE.Mesh).castShadow = false;
  return g;
}

/**
 * Ice Pellet (Shotgun pellets, Stealth machine-gun rounds, drone shots): a
 * small, stretched, glowing crystal in the shooter's colour, pointing where it
 * flies. Built for radius 1; scale the group by the shot's radius. Spin the
 * crystal (the group's only child) around x for a glint.
 */
export function pelletShape(m: Mats, color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const crystal = add(g, new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), m.std(color, color, 0.9)));
  crystal.scale.set(1.9, 0.75, 0.75);
  shadows(g);
  return g;
}

/**
 * Glacier Missile: light faceted body, nose and accent band in the shooter's
 * colour, four fins in an X, a dark nozzle with an ice-blue exhaust glow.
 * `glow` is the exhaust material (pulse its opacity for a flicker).
 */
export function glacierMissileShape(m: Mats, color: THREE.ColorRepresentation, scale: number): { group: THREE.Group; glow: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const accent = m.std(color, color, 0.35);
  along(g, m.std(LIGHT_STEEL), 0.15, 0.8, 8, 0);
  coneX(g, accent, 0.15, 0.32, 8, 0.56);
  along(g, accent, 0.155, 0.06, 8, 0.24);
  for (let i = 0; i < 4; i++) {
    const fin = box(g, accent, 0.24, 0.03, 0.26, -0.3, 0, 0);
    fin.geometry.translate(0, 0, 0.1);
    fin.rotation.x = Math.PI / 4 + (i * Math.PI) / 2;
  }
  along(g, m.std(DARK), 0.11, 0.08, 8, -0.44, 0.13);
  const glow = m.basic(ICE_GLOW, 0.9);
  along(g, glow, 0.08, 0.04, 8, -0.49);
  g.scale.setScalar(scale);
  shadows(g);
  return { group: g, glow };
}

/**
 * Canister grenade (Shotgun): an eight-sided steel canister with grooves, a
 * band in the thrower's colour and a cap with an ice-blue fuse light.
 * `fuse` is the light material (blink its colour).
 */
export function canisterShape(m: Mats, color: THREE.ColorRepresentation): { group: THREE.Group; fuse: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 8), m.std(STEEL)));
  const groove = m.std(DARK);
  for (const y of [-0.1, 0.1]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 8), groove), 0, y, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), m.std(color, color, 0.3)));
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 6), groove), 0, 0.2, 0);
  const fuse = m.basic(ICE_GLOW);
  add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), fuse), 0, 0.25, 0);
  shadows(g);
  return { group: g, fuse };
}

/**
 * Glacier Shell (Artillery): faceted body, pointed nose, copper driving band
 * and a band in the shooter's colour. Explosive shells get a glowing orange
 * nose and band and are a bit bigger. `r` is the shot radius (0.2 = base size).
 */
export function glacierShellShape(m: Mats, color: THREE.ColorRepresentation, explosive: boolean, r: number): THREE.Group {
  const outer = new THREE.Group();
  const g = add(outer, new THREE.Group());
  const glow = m.std('#ff7a3d', EXPLOSIVE, 0.9);
  along(g, m.std(STEEL), 0.16, 0.42, 8, 0);
  coneX(g, explosive ? glow : m.std(DARK), 0.16, 0.3, 8, 0.36);
  along(g, m.std(COPPER), 0.17, 0.05, 8, -0.15);
  along(g, explosive ? glow : m.std(color, color, 0.3), 0.165, 0.05, 8, 0.1);
  outer.scale.setScalar((r / 0.2) * (explosive ? 1.25 : 1));
  shadows(outer);
  return outer;
}

/**
 * Glacier Mine: an eight-sided chamfered disc with a band in the dropper's
 * colour, a steel top plate, four steel prongs and a faceted light dome.
 * `light` is this mine's own material (it blinks on its own schedule).
 */
export function glacierMineShape(m: Mats, color: THREE.ColorRepresentation): { group: THREE.Group; light: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.16, 8), m.std(DARK)), 0, 0.08, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.585, 0.585, 0.04, 8), m.std(color, color, 0.3)), 0, 0.07, 0);
  const steel = m.std('#4a525b');
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.08, 8), steel), 0, 0.2, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const prong = box(g, steel, 0.16, 0.06, 0.06, Math.cos(a) * 0.36, 0.25, Math.sin(a) * 0.36);
    prong.rotation.y = -a;
  }
  const light = new THREE.MeshBasicMaterial({ color: '#888888' });
  add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), light), 0, 0.28, 0);
  shadows(g);
  return { group: g, light };
}

/** Airstrike bomb: a dark, stretched octahedron, falling point down. */
export function bombShape(m: Mats): THREE.Mesh {
  const bomb = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), m.std(DARK));
  bomb.scale.set(1, 1.6, 1);
  bomb.castShadow = true;
  return bomb;
}
