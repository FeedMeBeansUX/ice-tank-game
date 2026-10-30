import * as THREE from 'three';
import type { TankModel } from '@ice-tank-sumo/shared';

/**
 * Firing effects at a barrel's muzzle: a short flash cone pointing where the
 * shot goes, a white-hot core, and a few smoke puffs that drift forward and up
 * and fade. Rockets, missiles and grenades get mostly exhaust smoke.
 */

export interface FlashStyle {
  /** Overall size (1 = a normal tank shot). */
  size: number;
  /** Flash cone: length and width (× size). 0 = no cone. */
  length: number;
  width: number;
  /** How many smoke puffs, and how big (× size). */
  puffs: number;
  puffSize: number;
  /** Flash colour. */
  color: THREE.ColorRepresentation;
}

/** Firing effect per tank (and for the drone's gun). */
export const FLASH_STYLES: Record<TankModel | 'drone' | 'missile' | 'grenade', FlashStyle> = {
  modelA: { size: 0.7, length: 1.1, width: 0.45, puffs: 2, puffSize: 1, color: '#ffd27a' },
  modelB: { size: 1.15, length: 1.2, width: 0.55, puffs: 4, puffSize: 1.1, color: '#ffc36a' },
  modelC: { size: 0.45, length: 1.2, width: 0.4, puffs: 1, puffSize: 0.8, color: '#ffe3a0' },
  modelD: { size: 0, length: 0, width: 0, puffs: 0, puffSize: 0, color: '#ff4d6d' },
  modelE: { size: 1.25, length: 0.8, width: 1.0, puffs: 4, puffSize: 1, color: '#ffc36a' },
  modelF: { size: 1.6, length: 1.1, width: 0.6, puffs: 7, puffSize: 1.3, color: '#ffb35c' },
  modelG: { size: 0.8, length: 0.6, width: 0.35, puffs: 5, puffSize: 1.1, color: '#ffd27a' },
  drone: { size: 0.35, length: 1.2, width: 0.4, puffs: 1, puffSize: 0.7, color: '#ffe3a0' },
  missile: { size: 1, length: 0, width: 0, puffs: 6, puffSize: 1.2, color: '#ffd27a' },
  grenade: { size: 0.7, length: 0.5, width: 0.6, puffs: 3, puffSize: 1, color: '#ffd27a' },
};

const FLASH_LIFE = 0.11;
const PUFF_LIFE = 0.6;
const UP = new THREE.Vector3(0, 1, 0);

interface Live {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  /** Start scale and how much it grows over its life (× start). */
  scale: THREE.Vector3;
  grow: number;
  opacity: number;
  velocity: THREE.Vector3 | null;
}

export class MuzzleFlashes {
  readonly group = new THREE.Group();
  private readonly live: Live[] = [];
  private readonly cone = new THREE.ConeGeometry(0.5, 1, 6);
  private readonly core = new THREE.IcosahedronGeometry(0.5, 0);
  private readonly puff = new THREE.IcosahedronGeometry(0.5, 0);

  constructor() {
    // Point the cone's tip along +y from its base at the origin (so it can be aimed with one rotation).
    this.cone.translate(0, 0.5, 0);
  }

  /** Fire effect at `at`, pointing along `dir` (both in world space). */
  spawn(at: THREE.Vector3, dir: THREE.Vector3, style: FlashStyle): void {
    if (style.size <= 0) return;
    const d = dir.clone().normalize();
    const s = style.size;
    if (style.length > 0) {
      const flash = this.add(this.cone, style.color, 0.95, FLASH_LIFE, new THREE.Vector3(style.width * s, style.length * s, style.width * s), 0.6);
      flash.mesh.position.copy(at);
      flash.mesh.quaternion.setFromUnitVectors(UP, d);
    }
    const core = this.add(this.core, '#fff6dc', 1, FLASH_LIFE, new THREE.Vector3(0.45, 0.45, 0.45).multiplyScalar(s), 0.5);
    core.mesh.position.copy(at);
    for (let i = 0; i < style.puffs; i++) {
      const size = 0.28 * s * style.puffSize * (0.7 + Math.random() * 0.6);
      const p = this.add(this.puff, '#b9c4cd', 0.6, PUFF_LIFE * (0.8 + Math.random() * 0.5), new THREE.Vector3(size, size, size), 2.2);
      p.mesh.position.copy(at).addScaledVector(d, 0.1 * i * s);
      p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      const side = new THREE.Vector3().crossVectors(d, UP).normalize().multiplyScalar((Math.random() - 0.5) * 0.8);
      p.velocity = d.clone().multiplyScalar(1.2 + Math.random() * 1.2).add(side).add(new THREE.Vector3(0, 0.5 + Math.random() * 0.5, 0));
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      l.age += dt;
      const t = l.age / l.life;
      if (t >= 1) {
        this.group.remove(l.mesh);
        l.material.dispose();
        this.live.splice(i, 1);
        continue;
      }
      l.mesh.scale.copy(l.scale).multiplyScalar(1 + l.grow * t);
      l.material.opacity = l.opacity * (1 - t);
      if (l.velocity) {
        l.mesh.position.addScaledVector(l.velocity, dt);
        l.velocity.multiplyScalar(Math.max(0, 1 - dt * 3));
      }
    }
  }

  private add(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, opacity: number, life: number, scale: THREE.Vector3, grow: number): Live {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.copy(scale);
    this.group.add(mesh);
    const l: Live = { mesh, material, age: 0, life, scale: scale.clone(), grow, opacity, velocity: null };
    this.live.push(l);
    return l;
  }
}
