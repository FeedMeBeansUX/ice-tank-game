import * as THREE from 'three';
import { airstrikeBomb, airstrikeLine, type AirstrikeState, type TankState, type Tuning } from '@ice-tank-sumo/shared';
import { bomberShape } from './pickupModels';
import { bombShape, Mats } from './projectileModels';

/**
 * Airstrikes (Sumo powerup), drawn from the simulation's airstrike state:
 * - a warning on the ice for everyone until the bombs go off: a dashed line
 *   along the bomb path and a pulsing red circle (the blast size) per bomb;
 * - the stealth bomber flying in along the line, its shadow sliding over the
 *   ice, and bombs dropping from it so each lands right when it goes off;
 * - while you aim one: the same line and circles at the mouse, in violet.
 */

/** How high the bomber flies (m). Low enough to stay in view, high enough to look like a flyover. */
const BOMBER_HEIGHT = 6;
/** A bomb falls this long from the bomber to the ice. */
const BOMB_FALL = 0.4;
/** The bomber is drawn while within this distance of the strike spot (m). */
const BOMBER_REACH = 45;
const WARNING = '#ff3b30';
const AIM = '#a98bff';

/** The ground marking for one strike: a dashed line along the path, and one circle per bomb. */
class StrikeMarking {
  readonly group = new THREE.Group();
  private readonly line: THREE.Line;
  private readonly rings: THREE.Mesh[] = [];
  private readonly ringMaterial: THREE.MeshBasicMaterial;
  private readonly lineMaterial: THREE.LineDashedMaterial;

  constructor(color: THREE.ColorRepresentation, private readonly ringGeometry: THREE.RingGeometry) {
    this.lineMaterial = new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.8, dashSize: 0.6, gapSize: 0.4, depthWrite: false });
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), this.lineMaterial);
    this.ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    this.group.add(this.line);
  }

  /** Place it for a strike at (x, z) flying along (dirX, dirZ); `shown` bombs from `from` on. */
  update(a: { x: number; z: number; dirX: number; dirZ: number }, tuning: Tuning, from: number, opacity: number): void {
    const count = Math.max(1, Math.round(tuning.airstrike.bombs));
    while (this.rings.length < count) {
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      this.group.add(ring);
      this.rings.push(ring);
    }
    this.rings.forEach((ring, i) => {
      ring.visible = i < count && i >= from;
      if (!ring.visible) return;
      const b = airstrikeBomb(a, i, tuning);
      ring.position.set(b.x, 0.05, b.z);
      ring.scale.setScalar(tuning.airstrike.radius);
    });
    // The line runs from one end blast to the other.
    const first = airstrikeBomb(a, 0, tuning);
    const last = airstrikeBomb(a, count - 1, tuning);
    const r = tuning.airstrike.radius;
    const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, first.x - a.dirX * r, 0.06, first.z - a.dirZ * r);
    pos.setXYZ(1, last.x + a.dirX * r, 0.06, last.z + a.dirZ * r);
    pos.needsUpdate = true;
    this.line.geometry.computeBoundingSphere();
    this.line.computeLineDistances();
    this.ringMaterial.opacity = 0.65 * opacity;
    this.lineMaterial.opacity = 0.85 * opacity;
  }

  dispose(): void {
    this.line.geometry.dispose();
    this.lineMaterial.dispose();
    this.ringMaterial.dispose();
  }
}

export class AirstrikeViews {
  readonly group = new THREE.Group();
  private readonly mats = new Mats(new Map());
  private readonly ringGeometry = new THREE.RingGeometry(0.93, 1, 48);
  private readonly views = new Map<number, { marking: StrikeMarking; bomber: THREE.Group; shadow: THREE.Mesh; bombs: THREE.Mesh[] }>();
  private aim: StrikeMarking | null = null;

  constructor(private readonly colorOf: (ownerId: number) => THREE.ColorRepresentation) {}

  draw(strikes: AirstrikeState[], tuning: Tuning, time: number): void {
    const A = tuning.airstrike;
    const count = Math.max(1, Math.round(A.bombs));
    // Bomber speed: from one bomb to the next in one bomb gap.
    const speed = A.spacing / Math.max(0.02, A.bombGapSeconds);
    const seen = new Set<number>();
    for (const a of strikes) {
      seen.add(a.id);
      let v = this.views.get(a.id);
      if (!v) {
        const marking = new StrikeMarking(WARNING, this.ringGeometry);
        const bomber = bomberShape(this.mats, this.colorOf(a.ownerId));
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(1, 3),
          new THREE.MeshBasicMaterial({ color: '#0d2233', transparent: true, opacity: 0.28, depthWrite: false }),
        );
        shadow.rotation.x = -Math.PI / 2;
        const bombs = Array.from({ length: count }, () => {
          const bomb = bombShape(this.mats);
          bomb.visible = false;
          return bomb;
        });
        this.group.add(marking.group, bomber, shadow, ...bombs);
        v = { marking, bomber, shadow, bombs };
        this.views.set(a.id, v);
      }

      // Warning: pulses faster as the bombs get close; each circle goes once its bomb has gone off.
      const left = A.delaySeconds - a.t;
      const pulse = 0.65 + 0.35 * Math.sin(time * (left < 0.8 ? 22 : 10));
      v.marking.group.visible = a.dropped < count;
      if (v.marking.group.visible) v.marking.update(a, tuning, a.dropped, pulse);

      // Bomber: over bomb i when that bomb is released (BOMB_FALL before it goes off).
      const releaseFirst = airstrikeBomb(a, 0, tuning).at - BOMB_FALL;
      const start = (-(count - 1) / 2) * A.spacing;
      const s = start + (a.t - releaseFirst) * speed;
      const bx = a.x + a.dirX * s;
      const bz = a.z + a.dirZ * s;
      const flying = Math.abs(s) < BOMBER_REACH;
      v.bomber.visible = v.shadow.visible = flying;
      if (flying) {
        const heading = Math.atan2(a.dirZ, a.dirX);
        v.bomber.position.set(bx, BOMBER_HEIGHT, bz);
        v.bomber.rotation.set(0, -heading, 0);
        // The shadow: a soft triangle under the wing, offset away from the sun a little.
        v.shadow.position.set(bx + 1.2, 0.04, bz - 0.8);
        v.shadow.rotation.z = -heading;
        v.shadow.scale.set(3.2, 3.6, 1);
      }

      // Bombs: released from the bomber, falling (faster and faster) onto their spot.
      v.bombs.forEach((bomb, i) => {
        const b = airstrikeBomb(a, i, tuning);
        const k = (a.t - (b.at - BOMB_FALL)) / BOMB_FALL;
        bomb.visible = k >= 0 && i >= a.dropped && k < 1.05;
        if (!bomb.visible) return;
        const kk = Math.min(1, k);
        bomb.position.set(b.x, BOMBER_HEIGHT * (1 - kk * kk) + 0.2, b.z);
      });
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.group.remove(v.marking.group, v.bomber, v.shadow, ...v.bombs);
      v.marking.dispose();
      v.shadow.geometry.dispose();
      (v.shadow.material as THREE.Material).dispose();
      v.bomber.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const b of v.bombs) b.geometry.dispose();
      this.views.delete(id);
    }
  }

  /** While you aim an airstrike: where it would go if you clicked now (null = hide). */
  showAim(spot: { x: number; z: number } | null, own: TankState | null, tuning: Tuning, arenaRadius: number, time: number): void {
    if (!this.aim) {
      this.aim = new StrikeMarking(AIM, this.ringGeometry);
      this.group.add(this.aim.group);
    }
    this.aim.group.visible = !!spot && !!own;
    if (!spot || !own) return;
    const strike = airstrikeLine(spot.x, spot.z, arenaRadius, own);
    this.aim.update(strike, tuning, 0, 0.75 + 0.25 * Math.sin(time * 6));
  }
}
