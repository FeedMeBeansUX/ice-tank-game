import * as THREE from 'three';
import type { MineState, MissileState, PowerupState, ProjectileState, TankState, Tuning, WorldEvent } from '@ice-tank-sumo/shared';
import { createArena, type Arena } from './arena';
import { TopDownCamera } from './camera';
import { MineViews, MissileViews, POWERUP_COLORS, PowerupViews } from './powerupViews';
import { GroundMarkers, ProjectileViews, TankView } from './tankView';

/** Everything on the ice at one moment: what the scene draws. */
export interface Frame {
  tanks: TankState[];
  projectiles: ProjectileState[];
  missiles: MissileState[];
  mines: MineState[];
  powerups: PowerupState[];
}

/**
 * The 3D view, shared by practice mode and online matches: renderer, light,
 * arena, tanks, projectiles, powerups, effects and the follow camera.
 */
export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly view: TopDownCamera;
  private readonly sun: THREE.DirectionalLight;
  private arena: Arena | null = null;
  private readonly views = new Map<number, { view: TankView; own: boolean; color: string }>();
  private readonly projectileViews: ProjectileViews;
  private readonly powerupViews = new PowerupViews();
  private readonly missileViews: MissileViews;
  private readonly mineViews: MineViews;
  private readonly markers = new GroundMarkers();
  private readonly minDistanceRing: THREE.Mesh;
  private readonly targetRings = new Map<number, THREE.Mesh>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private tuning: Tuning,
    /** Colour of a tank (player colour, or grey for dummies). */
    private readonly colorOf: (tank: TankState) => string,
    /** Colour for things a tank fired or dropped. */
    private readonly shotColorOf: (tankId: number) => string,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Plain, static dark blue backdrop; soft sky light plus a low sun.
    this.scene.background = new THREE.Color('#06121d');
    this.scene.add(new THREE.HemisphereLight('#d6ecff', '#0a1c2a', 1.1));
    this.sun = new THREE.DirectionalLight('#fff4e6', 1.8);
    this.sun.position.set(-35, 70, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);

    this.view = new TopDownCamera(window.innerWidth / window.innerHeight);
    this.rebuildArena();

    this.projectileViews = new ProjectileViews(shotColorOf);
    this.missileViews = new MissileViews(shotColorOf);
    this.mineViews = new MineViews(shotColorOf);
    for (const g of [this.projectileViews.group, this.powerupViews.group, this.missileViews.group, this.mineViews.group, this.markers.group]) {
      this.scene.add(g);
    }

    // Missile aiming: ring at the minimum target distance around your tank.
    this.minDistanceRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 96),
      new THREE.MeshBasicMaterial({ color: '#ff5b4a', transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.minDistanceRing.rotation.x = -Math.PI / 2;
    this.minDistanceRing.visible = false;
    this.scene.add(this.minDistanceRing);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.view.setAspect(window.innerWidth / window.innerHeight);
    });
  }

  /** Use different tuning values (online: the server's). Rebuilds the arena if its size changed. */
  setTuning(tuning: Tuning): void {
    const resize = tuning.arena.radius !== this.tuning.arena.radius;
    this.tuning = tuning;
    if (resize) this.rebuildArena();
  }

  rebuildArena(): void {
    if (this.arena) {
      this.scene.remove(this.arena.group);
      this.arena.dispose();
    }
    this.arena = createArena(this.tuning.arena.radius);
    this.scene.add(this.arena.group);
    const reach = this.tuning.arena.radius + 4;
    Object.assign(this.sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 200 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.view.arenaRadius = this.tuning.arena.radius;
  }

  /** Remember positions before a physics step (practice mode draws between steps). */
  capture(frame: Frame): void {
    for (const t of frame.tanks) this.views.get(t.id)?.view.capture(t);
    this.projectileViews.capture(frame.projectiles);
    this.missileViews.capture(frame.missiles);
  }

  /** Jump a tank's drawing to its current position (after a respawn). */
  snapTank(tank: TankState): void {
    this.views.get(tank.id)?.view.snap(tank);
  }

  /**
   * Draw a frame. `alpha` blends between the previous and current physics
   * step (practice); online frames are already blended, so they pass 1.
   * Returns where your own tank was drawn, for the camera.
   */
  draw(frame: Frame, ownId: number | null, alpha: number, time: number, dt: number, showRange: boolean): { x: number; z: number } | null {
    this.syncTankViews(frame.tanks, ownId);
    let ownPos: { x: number; z: number } | null = null;
    for (const t of frame.tanks) {
      const entry = this.views.get(t.id);
      if (!entry) continue;
      const p = entry.view.draw(t, alpha, time, this.tuning, showRange, dt);
      if (t.id === ownId) ownPos = p;
    }
    this.projectileViews.draw(frame.projectiles, alpha, time);
    this.powerupViews.draw(frame.powerups, time);
    this.missileViews.draw(frame.missiles, alpha, time, dt);
    this.mineViews.draw(frame.mines, this.tuning, time);
    this.markers.update(dt);
    this.updateSmoke(dt);
    return ownPos;
  }

  /** Follow your tank (it holds still while you fall), then render. */
  render(dt: number, own: TankState | null, ownPos: { x: number; z: number } | null): void {
    if (this.view.mode === 'play' && own && own.status === 'alive' && ownPos) this.view.setFocus(ownPos.x, ownPos.z);
    this.view.update(dt);
    this.renderer.render(this.scene, this.view.camera);
  }

  /** Visual effects for things that happened. */
  effects(events: WorldEvent[], ownId: number | null, frameTanks: TankState[]): void {
    for (const e of events) {
      if (e.type === 'hit') {
        const color = e.powered ? '#ffcc33' : this.shotColorOf(e.shooterId);
        this.markers.add(e.x, e.z, { color, size: e.powered ? 1.6 : 0.9, life: 0.35, grow: 1.6 });
      } else if (e.type === 'missile-hit') {
        this.markers.add(e.x, e.z, { color: '#ff5b4a', size: 2, life: 0.5, grow: 2 });
      } else if (e.type === 'mine-exploded') {
        // Blast ring the size of the blast radius.
        this.markers.add(e.x, e.z, { color: '#ffcc33', size: this.tuning.mine.blastRadius / 0.75, life: 0.6, grow: 0.15 });
        this.markers.add(e.x, e.z, { color: '#ff7a3d', size: 1.5, life: 0.5, grow: 3 });
      } else if (e.type === 'shot') {
        this.views.get(e.tankId)?.view.kick(e.barrel);
      } else if (e.type === 'ability' && e.kind === 'smoke') {
        this.smokeCloud(e.x, e.z);
      } else if (e.type === 'pickup' && e.tankId === ownId) {
        const own = frameTanks.find((t) => t.id === ownId);
        if (own) this.markers.add(own.x, own.z, { color: POWERUP_COLORS[e.kind], size: 2, life: 0.4, grow: 1 });
      }
    }
  }

  // Smoke grenade cloud: grey low-poly puffs that swell and fade.
  private readonly smoke: { mesh: THREE.Mesh; age: number; life: number; vx: number; vz: number; grow: number }[] = [];
  private readonly smokeGeometry = new THREE.IcosahedronGeometry(1, 0);

  private smokeCloud(x: number, z: number): void {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const r = Math.random() * 1.2;
      const mesh = new THREE.Mesh(
        this.smokeGeometry,
        new THREE.MeshStandardMaterial({ color: '#c9d2d8', flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      mesh.position.set(x + Math.cos(a) * r, 0.6 + Math.random() * 0.8, z + Math.sin(a) * r);
      mesh.scale.setScalar(0.5 + Math.random() * 0.4);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.scene.add(mesh);
      this.smoke.push({ mesh, age: 0, life: 1.6 + Math.random() * 0.8, vx: Math.cos(a) * 1.8, vz: Math.sin(a) * 1.8, grow: 1.2 + Math.random() });
    }
  }

  private updateSmoke(dt: number): void {
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i]!;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.smoke.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt * (1 - t);
      p.mesh.position.z += p.vz * dt * (1 - t);
      p.mesh.position.y += dt * 0.4;
      p.mesh.scale.setScalar((0.5 + t * p.grow) * 1.2);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - t * t);
    }
  }

  /** Expanding ring where you clicked. */
  clickMarker(x: number, z: number): void {
    this.markers.add(x, z);
  }

  /** Aiming visuals: min-distance ring around you, pulsing rings on tanks you can pick. */
  showAiming(active: boolean, own: TankState | null, pickable: Set<number>, tanks: TankState[], time: number): void {
    const aiming = active && !!own && own.status === 'alive';
    this.minDistanceRing.visible = aiming;
    if (aiming && own) {
      this.minDistanceRing.position.set(own.x, 0.05, own.z);
      this.minDistanceRing.scale.setScalar(this.tuning.missile.minTargetDistance);
    }
    for (const t of tanks) {
      let ring = this.targetRings.get(t.id);
      const show = aiming && pickable.has(t.id);
      if (!ring && !show) continue;
      if (!ring) {
        ring = new THREE.Mesh(
          new THREE.RingGeometry(1, 1.25, 32),
          new THREE.MeshBasicMaterial({ color: '#ff5b4a', transparent: true, opacity: 0.9, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);
        this.targetRings.set(t.id, ring);
      }
      ring.visible = show;
      if (show) {
        ring.position.set(t.x, 0.06, t.z);
        ring.scale.setScalar(this.tuning.tanks[t.model].radius + 0.5 + Math.sin(time * 8) * 0.15);
      }
    }
  }

  /** Where on the ice a screen point is (for clicks). */
  groundAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.view.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  private syncTankViews(tanks: TankState[], ownId: number | null): void {
    const seen = new Set<number>();
    for (const t of tanks) {
      if (t.status === 'gone') continue;
      seen.add(t.id);
      const own = t.id === ownId;
      const color = this.colorOf(t);
      const entry = this.views.get(t.id);
      if (entry && entry.view.model === t.model && entry.own === own && entry.color === color) continue;
      if (entry) {
        this.scene.remove(entry.view.root);
        entry.view.dispose();
      }
      const view = new TankView(t, color, own);
      this.scene.add(view.root);
      this.views.set(t.id, { view, own, color });
    }
    for (const [id, entry] of this.views) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.view.root);
      entry.view.dispose();
      this.views.delete(id);
    }
  }
}
