import * as THREE from 'three';
import type { MineState, MissileState, PowerupKind, PowerupState, Tuning } from '@ice-tank-sumo/shared';

/**
 * Drawing for powerups on the ice, homing missiles in flight, and mines.
 */

export const POWERUP_COLORS: Record<PowerupKind, string> = {
  missile: '#ff5b4a',
  mine: '#ffcc33',
  rapidFire: '#4cd964',
};

/** Rapid-fire icon: three bullets side by side. */
function rapidFireShape(color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  for (const offset of [-0.3, 0, 0.3]) {
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 6), flat(color, 0.25));
    casing.position.set(offset, 0, 0);
    g.add(casing);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 6), flat('#e8eef2'));
    tip.position.set(offset, 0.32, 0);
    g.add(tip);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

function flat(color: THREE.ColorRepresentation, emissive = 0): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(emissive), flatShading: true, roughness: 0.5 });
}

/** A small missile shape, nose along +x. */
function missileShape(color: THREE.ColorRepresentation, scale: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 6), flat('#e8eef2'));
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 6), flat(color, 0.4));
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.57;
  g.add(nose);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), flat(color, 0.2));
    fin.position.set(-0.32, 0, side * 0.12);
    g.add(fin);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A small mine shape: flat disc with a light on top. */
function mineShape(): { group: THREE.Group; light: THREE.MeshBasicMaterial } {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.22, 8), flat('#2e343b'));
  disc.position.y = 0.11;
  g.add(disc);
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), flat('#4a525b'));
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.42, 0.2, Math.sin(a) * 0.42);
    spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    g.add(spike);
  }
  const light = new THREE.MeshBasicMaterial({ color: '#888888' });
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), light);
  bulb.position.y = 0.28;
  g.add(bulb);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group: g, light };
}

/** Powerups lying on the ice: a floating, spinning icon on a glowing base ring. */
export class PowerupViews {
  readonly group = new THREE.Group();
  private readonly items = new Map<number, THREE.Group>();

  draw(powerups: PowerupState[], time: number): void {
    const seen = new Set<number>();
    for (const p of powerups) {
      seen.add(p.id);
      let item = this.items.get(p.id);
      if (!item) {
        item = this.build(p.kind);
        item.position.set(p.x, 0, p.z);
        this.group.add(item);
        this.items.set(p.id, item);
      }
      const icon = item.children[1]!;
      icon.position.y = 1.0 + Math.sin(time * 3 + p.id) * 0.15;
      icon.rotation.y = time * 1.6 + p.id;
    }
    for (const [id, item] of this.items) {
      if (!seen.has(id)) {
        this.group.remove(item);
        this.items.delete(id);
      }
    }
  }

  private build(kind: PowerupKind): THREE.Group {
    const color = POWERUP_COLORS[kind];
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    const icon = kind === 'missile' ? missileShape(color, 1.2) : kind === 'mine' ? mineShape().group : rapidFireShape(color);
    if (kind === 'missile') icon.rotation.z = 0.5;
    else if (kind === 'mine') icon.scale.setScalar(1.1);
    else icon.rotation.x = -0.35;
    const holder = new THREE.Group();
    holder.add(icon);
    g.add(holder);
    return g;
  }
}

/** Homing missiles in flight, with a short fading smoke trail. */
export class MissileViews {
  readonly group = new THREE.Group();
  private readonly views = new Map<number, { mesh: THREE.Group; prevX: number; prevZ: number; prevAngle: number; trail: THREE.Mesh[]; lastPuff: number }>();
  private readonly puffs: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly puffGeometry = new THREE.IcosahedronGeometry(0.22, 0);

  constructor(private readonly colorOf: (shooterId: number) => THREE.ColorRepresentation) {}

  capture(missiles: MissileState[]): void {
    for (const m of missiles) {
      const v = this.views.get(m.id);
      if (v) {
        v.prevX = m.x;
        v.prevZ = m.z;
        v.prevAngle = m.angle;
      }
    }
  }

  draw(missiles: MissileState[], alpha: number, time: number, dt: number): void {
    const seen = new Set<number>();
    for (const m of missiles) {
      seen.add(m.id);
      let v = this.views.get(m.id);
      if (!v) {
        // Rocket tank rockets are smaller than the missile powerup.
        const mesh = missileShape(this.colorOf(m.shooterId), m.small ? 0.75 : 1.4);
        this.group.add(mesh);
        v = { mesh, prevX: m.x, prevZ: m.z, prevAngle: m.angle, trail: [], lastPuff: 0 };
        this.views.set(m.id, v);
      }
      const x = v.prevX + (m.x - v.prevX) * alpha;
      const z = v.prevZ + (m.z - v.prevZ) * alpha;
      v.mesh.position.set(x, 0.9, z);
      v.mesh.rotation.y = -m.angle;
      if (time - v.lastPuff > 0.04) {
        v.lastPuff = time;
        const puff = new THREE.Mesh(this.puffGeometry, new THREE.MeshBasicMaterial({ color: '#dfe6ea', transparent: true, opacity: 0.6, depthWrite: false }));
        puff.position.set(x - Math.cos(m.angle) * (m.small ? 0.4 : 0.7), 0.9, z - Math.sin(m.angle) * (m.small ? 0.4 : 0.7));
        puff.userData.base = m.small ? 0.55 : 1;
        this.group.add(puff);
        this.puffs.push({ mesh: puff, age: 0 });
      }
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.group.remove(v.mesh);
        this.views.delete(id);
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!;
      p.age += dt;
      const t = p.age / 0.5;
      if (t >= 1) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      p.mesh.scale.setScalar(((p.mesh.userData.base as number | undefined) ?? 1) * (1 + t * 1.5));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
    }
  }
}

/** Mines on the ice: grey light while arming, blinking red once live, ring in the dropper's colour. */
export class MineViews {
  readonly group = new THREE.Group();
  private readonly views = new Map<number, { group: THREE.Group; light: THREE.MeshBasicMaterial }>();

  constructor(private readonly colorOf: (ownerId: number) => THREE.ColorRepresentation) {}

  draw(mines: MineState[], tuning: Tuning, time: number): void {
    const seen = new Set<number>();
    for (const m of mines) {
      seen.add(m.id);
      let v = this.views.get(m.id);
      if (!v) {
        const shape = mineShape();
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.75, 0.9, 24),
          new THREE.MeshBasicMaterial({ color: this.colorOf(m.ownerId), transparent: true, opacity: 0.8, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        shape.group.add(ring);
        shape.group.position.set(m.x, 0, m.z);
        this.group.add(shape.group);
        v = shape;
        this.views.set(m.id, v);
      }
      const live = m.age >= tuning.mine.armSeconds;
      const endingSoon = tuning.mine.lifeSeconds - m.age < 3;
      const blink = Math.sin(time * (endingSoon ? 18 : 8)) > 0;
      v.light.color.set(live ? (blink ? '#ff3b30' : '#5a1512') : '#9aa3ab');
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.group.remove(v.group);
        this.views.delete(id);
      }
    }
  }
}
