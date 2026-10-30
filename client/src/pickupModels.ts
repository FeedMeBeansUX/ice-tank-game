import * as THREE from 'three';
import { faceted, mirrored } from './heavyModel';
import { add, box, rodX } from './modelKit';
import { DARK, glacierMineShape, glacierMissileShape, ICE, ICE_GLOW, LIGHT_STEEL, Mats, slugShape, STEEL } from './projectileModels';

/**
 * Glacier-style models for the Rocket's drone and the powerups on the ice.
 */

/**
 * Drone (Rocket ability): a faceted hexagonal body in the owner's colour with
 * a dark canopy and an accent stripe, four faceted rotor guards attached
 * straight to the body's corners with two-blade rotors, a sensor eye with a
 * glowing ice lens at the front, and a small gun underneath that turns to its target.
 * `body` turns slowly, `gun` aims, `rotors` spin (rotation.y).
 */
export function droneShape(m: Mats, color: THREE.ColorRepresentation): { group: THREE.Group; body: THREE.Group; gun: THREE.Group; rotors: THREE.Object3D[] } {
  const c = new THREE.Color(color);
  const bodyMat = m.std(c, c, 0.2);
  const darker = m.std(c.clone().multiplyScalar(0.4));
  const accent = m.std(c.clone().lerp(new THREE.Color('#ffffff'), 0.35));
  const steel = m.std(STEEL);
  const dark = m.std(DARK);
  const blade = m.basic('#dfe6ea', 0.55);
  const group = new THREE.Group();
  const body = add(group, new THREE.Group());

  add(body, faceted(mirrored([[0.26, 0.1], [0.12, 0.22], [-0.14, 0.22], [-0.26, 0.1]]), 0.08, bodyMat, 0.03), 0, -0.04, 0);
  add(body, faceted(mirrored([[0.14, 0.06], [0.06, 0.12], [-0.1, 0.12], [-0.16, 0.06]]), 0.04, darker, 0.02), 0, 0.07, 0);
  box(body, accent, 0.5, 0.02, 0.04, 0, 0.075, 0);
  // Sensor eye at the front.
  box(body, dark, 0.06, 0.06, 0.1, 0.28, 0, 0);
  box(body, m.basic(ICE_GLOW), 0.02, 0.04, 0.06, 0.31, 0, 0);

  const rotors: THREE.Object3D[] = [];
  for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    // Rotor guard touching the body's corner (no arm).
    const guard = add(body, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 4, 8), dark), ax * 0.3, 0.02, az * 0.3);
    guard.rotation.x = Math.PI / 2;
    add(body, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 6), dark), ax * 0.3, 0.04, az * 0.3);
    const rotor = add(body, new THREE.Group(), ax * 0.3, 0.075, az * 0.3);
    box(rotor, blade, 0.3, 0.01, 0.05, 0, 0, 0);
    box(rotor, blade, 0.05, 0.01, 0.3, 0, 0, 0);
    rotors.push(rotor);
  }

  const gun = add(group, new THREE.Group(), 0, -0.12, 0);
  box(gun, dark, 0.14, 0.08, 0.12, 0, 0, 0);
  rodX(gun, steel, 0.025, 0.03, 0.34, 6, 0.24, 0, 0);
  box(gun, darker, 0.06, 0.07, 0.07, 0.4, 0, 0);

  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== blade) o.castShadow = true;
  });
  return { group, body, gun, rotors };
}

/**
 * Stealth bomber (airstrike powerup): a dark, faceted flying wing with a
 * sawtooth trailing edge, a raised middle with a slim cockpit strip, accent
 * stripes along the leading edges in `color`, and two glowing exhaust slits.
 * Nose along +x, about 7 m across at scale 1.
 */
export function bomberShape(m: Mats, color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const skin = m.std('#2a3038');
  const ridge = m.std('#363d46');
  const dark = m.std('#14181d');
  const accent = m.std(color, color, 0.35);
  const glow = m.basic(ICE_GLOW);
  // Wing: nose, leading edge out to the tips, sawtooth back to the middle.
  const wing: [number, number][] = [[2.0, 0.12], [-0.7, 3.6], [-1.05, 3.3], [-0.55, 2.3], [-1.1, 1.4], [-0.6, 0.7], [-0.85, 0.12]];
  add(g, faceted(mirrored(wing), 0.08, skin, 0.04), 0, 0, 0);
  // Raised middle section and the cockpit strip on it.
  add(g, faceted(mirrored([[1.75, 0.08], [0.6, 0.75], [-0.6, 0.7], [-0.8, 0.08]]), 0.18, ridge, 0.05), 0, 0.06, 0);
  add(g, faceted(mirrored([[1.45, 0.04], [1.05, 0.28], [0.85, 0.24], [0.95, 0.04]]), 0.04, dark, 0.01), 0, 0.28, 0);
  // Accent stripes along the leading edges.
  for (const side of [-1, 1]) {
    const stripe = box(g, accent, 2.6, 0.03, 0.08, 0.65, 0.13, side * 1.85);
    stripe.rotation.y = side * Math.atan2(3.48, 2.7);
    // Exhaust slits on top, near the back.
    box(g, glow, 0.08, 0.03, 0.42, -0.45, 0.31, side * 0.38);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== glow) o.castShadow = true;
  });
  return g;
}

/**
 * Tesla coil (powerup): a small hovering coil. A faceted dark hover base with
 * a glowing ice ring underneath, a steel column wound with copper rings, an
 * accent band in `color`, a light-steel toroid on top and a glowing ice orb
 * in the middle of it. Stands about 1.2 m tall at scale 1, base at y = 0.
 * `orb` is returned so the game can flicker it.
 */
export function teslaCoilShape(m: Mats, color: THREE.ColorRepresentation): { group: THREE.Group; orb: THREE.Mesh; glow: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const steel = m.std(STEEL);
  const dark = m.std(DARK);
  const copper = m.std('#b8733d', '#5a2f12', 0.3);
  const accent = m.std(color, color, 0.3);
  const glow = m.basic(ICE_GLOW);
  // Hover base: faceted disc with an ice-blue glow ring under it.
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.14, 6), dark), 0, 0.07, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.06, 6), steel), 0, 0.17, 0);
  const under = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 12), glow), 0, -0.01, 0);
  under.rotation.x = Math.PI / 2;
  // Column with copper windings and an accent band.
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.72, 6), steel), 0, 0.56, 0);
  for (let i = 0; i < 5; i++) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.15 - i * 0.008, 0.15 - i * 0.008, 0.05, 8), copper), 0, 0.32 + i * 0.1, 0);
  add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 6), accent), 0, 0.86, 0);
  // Toroid on top, with the glowing orb.
  const torus = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 5, 8), m.std(LIGHT_STEEL)), 0, 1.02, 0);
  torus.rotation.x = Math.PI / 2;
  const orb = add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), glow), 0, 1.04, 0);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== glow) o.castShadow = true;
  });
  return { group: g, orb, glow };
}

/** A see-through ice crystal around a floating powerup icon. */
export function powerupCrystal(m: Mats): THREE.Mesh {
  const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), m.basic(ICE, 0.16));
  crystal.scale.y = 1.15;
  return crystal;
}

/**
 * Powerup icons, in the powerup's colour, in the Glacier style: the homing
 * missile (a Glacier missile, tilted up), the mine (a small Glacier mine with
 * a lit light), rapid fire (three Tracer Slugs lying side by side in a clip),
 * the airstrike (a small stealth bomber) and the tesla coil (a small coil).
 */
export function powerupIcon(m: Mats, kind: 'missile' | 'mine' | 'rapidFire' | 'airstrike' | 'teslaCoil', color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'teslaCoil') {
    // A small tesla coil, centred in the crystal.
    const { group } = teslaCoilShape(m, color);
    group.scale.setScalar(0.85);
    group.position.y = -0.46;
    g.add(group);
  } else if (kind === 'airstrike') {
    // A small stealth bomber, banking a little.
    const bomber = bomberShape(m, color);
    bomber.scale.setScalar(0.17);
    bomber.position.set(0.05, -0.05, 0);
    bomber.rotation.set(0.35, 0, 0.15);
    g.add(bomber);
  } else if (kind === 'missile') {
    const { group } = glacierMissileShape(m, color, 1.25);
    group.rotation.z = 0.5;
    g.add(group);
  } else if (kind === 'mine') {
    const { group, light } = glacierMineShape(m, color);
    light.color.set('#ff3b30');
    group.scale.setScalar(0.9);
    group.position.y = -0.14;
    group.rotation.x = -0.3;
    g.add(group);
  } else {
    // Lying flat side by side, so they read as bullets from above.
    for (const offset of [-0.26, 0, 0.26]) {
      const slug = slugShape(m, color);
      slug.scale.setScalar(0.17);
      slug.position.set(-0.05, 0, offset);
      // No tracer streak on a standing bullet.
      slug.children[3]!.visible = false;
      g.add(slug);
    }
    // Light-steel clip across them.
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.78), m.std(LIGHT_STEEL)), -0.12, -0.12, 0);
  }
  return g;
}
