import * as THREE from 'three';
import type { TankState, TeslaCoilState, Tuning } from '@ice-tank-sumo/shared';
import { teslaCoilShape } from './pickupModels';
import { Mats } from './projectileModels';

/**
 * Tesla coils (powerup) and electrified tanks:
 * - the coil hovers and bobs where it was placed, with a faint ring on the ice
 *   showing its range; its orb flickers, and it blinks in its last second;
 * - jagged lightning arcs from the orb to every tank it is electrifying,
 *   redrawn many times a second so they crackle;
 * - an electrified tank has small sparks crackling over its hull while the
 *   effect lasts (also after it left the range).
 */

const HOVER = 0.6;
const ARC_SEGMENTS = 7;
/** New arc shapes this often (s), so they crackle. */
const ARC_REFRESH = 0.05;

/** One jagged bolt: a bright core and a soft glow, as chains of thin cylinders. */
class Bolt {
  readonly group = new THREE.Group();
  private readonly core: THREE.Mesh[] = [];
  private readonly glow: THREE.Mesh[] = [];

  constructor(geometry: THREE.CylinderGeometry, coreMat: THREE.Material, glowMat: THREE.Material, segments: number) {
    for (let i = 0; i < segments; i++) {
      const c = new THREE.Mesh(geometry, coreMat);
      const g = new THREE.Mesh(geometry, glowMat);
      this.core.push(c);
      this.glow.push(g);
      this.group.add(c, g);
    }
  }

  /** A fresh jagged path from `a` to `b`, kinking up to `jitter` sideways. */
  shape(a: THREE.Vector3, b: THREE.Vector3, jitter: number, width: number): void {
    const n = this.core.length;
    const points: THREE.Vector3[] = [a.clone()];
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      // Most kink in the middle of the bolt.
      const k = jitter * Math.sin((Math.PI * i) / n);
      p.x += (Math.random() - 0.5) * 2 * k;
      p.y += (Math.random() - 0.5) * k;
      p.z += (Math.random() - 0.5) * 2 * k;
      points.push(p);
    }
    points.push(b.clone());
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const length = from.distanceTo(to) || 1e-3;
      const dir = to.clone().sub(from).divideScalar(length);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      for (const [mesh, w] of [[this.core[i]!, width], [this.glow[i]!, width * 3.2]] as const) {
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(up, dir);
        mesh.scale.set(w, length, w);
      }
    }
  }
}

export class TeslaViews {
  readonly group = new THREE.Group();
  private readonly mats = new Mats(new Map());
  private readonly segment = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  private readonly coreMat = new THREE.MeshBasicMaterial({ color: '#e9fdff', transparent: true, opacity: 0.95, depthWrite: false });
  private readonly glowMat = new THREE.MeshBasicMaterial({ color: '#3fe0ff', transparent: true, opacity: 0.4, depthWrite: false });
  private readonly coils = new Map<number, { group: THREE.Group; model: THREE.Group; orb: THREE.Mesh; ring: THREE.Mesh; shadow: THREE.Mesh }>();
  /** Bolts in use this frame are taken from this pool in order. */
  private readonly bolts: Bolt[] = [];
  private lastArcs = -Infinity;

  constructor(private readonly colorOf: (ownerId: number) => THREE.ColorRepresentation) {}

  draw(coils: TeslaCoilState[], tanks: TankState[], drawn: Map<number, { x: number; z: number }>, tuning: Tuning, time: number): void {
    const C = tuning.teslaCoil;
    const seen = new Set<number>();
    for (const c of coils) {
      seen.add(c.id);
      let v = this.coils.get(c.id);
      if (!v) {
        const group = new THREE.Group();
        const { group: model, orb } = teslaCoilShape(this.mats, this.colorOf(c.ownerId));
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.975, 1, 72),
          new THREE.MeshBasicMaterial({ color: '#3fe0ff', transparent: true, opacity: 0.35, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.45, 12),
          new THREE.MeshBasicMaterial({ color: '#0d2233', transparent: true, opacity: 0.25, depthWrite: false }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.035;
        group.add(model, ring, shadow);
        group.position.set(c.x, 0, c.z);
        this.group.add(group);
        v = { group, model, orb, ring, shadow };
        this.coils.set(c.id, v);
      }
      v.model.position.y = HOVER + Math.sin(time * 2.5 + c.id) * 0.08;
      v.model.rotation.y = time * 0.8;
      v.orb.scale.setScalar(0.85 + 0.35 * Math.random());
      v.ring.scale.setScalar(C.range);
      // Brighter range ring while it is zapping someone.
      (v.ring.material as THREE.MeshBasicMaterial).opacity = c.zapping.length ? 0.55 + 0.2 * Math.sin(time * 30) : 0.3;
      v.model.visible = !(c.timeLeft < 1 && Math.sin(time * 18) < 0);
    }
    for (const [id, v] of this.coils) {
      if (seen.has(id)) continue;
      this.group.remove(v.group);
      for (const o of [v.ring, v.shadow]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      v.model.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      this.coils.delete(id);
    }

    // Arcs and sparks: new shapes every ARC_REFRESH seconds.
    if (time - this.lastArcs < ARC_REFRESH) return;
    this.lastArcs = time;
    let used = 0;
    const bolt = (a: THREE.Vector3, b: THREE.Vector3, jitter: number, width: number) => {
      let bo = this.bolts[used];
      if (!bo) {
        bo = new Bolt(this.segment, this.coreMat, this.glowMat, ARC_SEGMENTS);
        this.bolts.push(bo);
        this.group.add(bo.group);
      }
      bo.group.visible = true;
      bo.shape(a, b, jitter, width);
      used++;
    };
    for (const c of coils) {
      const v = this.coils.get(c.id);
      if (!v) continue;
      const top = new THREE.Vector3(c.x, v.model.position.y + 1.04, c.z);
      for (const id of c.zapping) {
        const p = drawn.get(id);
        if (!p) continue;
        const end = new THREE.Vector3(p.x, 0.7, p.z);
        bolt(top, end, Math.min(0.9, top.distanceTo(end) * 0.12), 0.03);
      }
    }
    // Electrified tanks: two short sparks over the hull.
    for (const t of tanks) {
      if (t.status !== 'alive' || t.shockLeft <= 0 || t.stealthLeft > 0) continue;
      const p = drawn.get(t.id);
      if (!p) continue;
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        const b = a + 1 + Math.random() * 2;
        bolt(
          new THREE.Vector3(p.x + Math.cos(a) * 0.65, 0.55 + Math.random() * 0.3, p.z + Math.sin(a) * 0.65),
          new THREE.Vector3(p.x + Math.cos(b) * 0.65, 0.55 + Math.random() * 0.3, p.z + Math.sin(b) * 0.65),
          0.25,
          0.018,
        );
      }
    }
    for (let i = used; i < this.bolts.length; i++) this.bolts[i]!.group.visible = false;
  }
}
