import type { TankInput, TankState, World } from '@ice-tank-sumo/shared';
import type { GameScene } from './scene';

export const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE'];

/**
 * Mouse and keyboard, the same in practice and online:
 * - left click: turn toward the point and push (a click on a highlighted tank
 *   while a missile is ready fires the missile instead)
 * - Shift: ability · Q/W/E: powerup slots · right-click or Esc: cancel aiming
 *
 * Inputs go to `send`: straight into the simulation in practice, to the
 * server online.
 */
export class Controls {
  /** Slot of the missile being aimed, or null. */
  aimingSlot: number | null = null;
  private lastMarker = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: GameScene,
    /** The world to check rules against (online: a mirror of the server state). */
    private readonly world: () => World,
    private readonly own: () => TankState | null,
    private readonly send: (input: TankInput) => void,
    private readonly opts: {
      /** Show the click ring at once (online), instead of waiting for the simulation. */
      instantClickMarker: boolean;
      /** Other keys (practice shortcuts). Return true if handled. */
      onKey?: (code: string) => boolean;
      /** False while input should be ignored (e.g. a menu is open). */
      enabled?: () => boolean;
    },
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Tanks you may aim the missile at right now. */
  pickable(): Set<number> {
    const own = this.own();
    if (this.aimingSlot === null || !own) return new Set();
    const w = this.world();
    return new Set(w.tanks.filter((t) => w.canTargetWithMissile(own, t)).map((t) => t.id));
  }

  /** Fire the aimed missile at a tank (also used by the screen-edge markers). */
  fireMissileAt(tankId: number): void {
    if (this.aimingSlot === null) return;
    const own = this.own();
    const target = this.world().tanks[tankId];
    if (!own || !target || !this.world().canTargetWithMissile(own, target)) return;
    this.send({ type: 'missile', slot: this.aimingSlot, targetId: tankId });
    this.setAiming(null);
  }

  /** Drop aiming if the missile is gone (used, or you fell). Call every frame. */
  update(): void {
    const own = this.own();
    if (this.aimingSlot !== null && (!own || own.slots[this.aimingSlot] !== 'missile')) this.setAiming(null);
  }

  private setAiming(slot: number | null): void {
    this.aimingSlot = slot;
    document.body.classList.toggle('aiming', slot !== null);
  }

  private active(): boolean {
    return this.opts.enabled ? this.opts.enabled() : true;
  }

  private onPointer(e: PointerEvent): void {
    if (!this.active()) return;
    if (e.button === 2) {
      this.setAiming(null);
      return;
    }
    if (e.button !== 0) return;
    const hit = this.scene.groundAt(e.clientX, e.clientY);
    const own = this.own();
    if (!hit || !own || own.status !== 'alive') return;

    if (this.aimingSlot !== null) {
      // A click on (or near) a highlighted tank fires the missile.
      // A click anywhere else still moves your tank; aiming stays on.
      const w = this.world();
      let best: TankState | null = null;
      let bestD = Infinity;
      for (const id of this.pickable()) {
        const t = w.tanks[id]!;
        const d = Math.hypot(t.x - hit.x, t.z - hit.z);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best && bestD <= w.tuning.tanks[best.model].radius + 2.5) {
        this.fireMissileAt(best.id);
        return;
      }
    }
    this.send({ type: 'move', x: hit.x, z: hit.z });
    // Instant feedback online: show the click ring now (respecting the click cooldown).
    const now = performance.now() / 1000;
    if (this.opts.instantClickMarker && now - this.lastMarker >= this.world().tuning.rules.clickCooldown) {
      this.lastMarker = now;
      this.scene.clickMarker(hit.x, hit.z);
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.active()) return;
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (!e.repeat) this.send({ type: 'ability' });
      return;
    }
    if (e.repeat) return;
    const slot = SLOT_KEYS.indexOf(e.code);
    if (slot >= 0) {
      const own = this.own();
      const kind = own?.slots[slot];
      if (!own || own.status !== 'alive' || !kind) return;
      if (kind === 'mine' || kind === 'rapidFire') {
        if (this.aimingSlot !== null) this.setAiming(null);
        this.send({ type: kind, slot });
      } else {
        this.setAiming(this.aimingSlot === slot ? null : slot);
      }
      return;
    }
    if (e.code === 'Escape') {
      this.setAiming(null);
      return;
    }
    if (e.code === 'KeyC') {
      this.scene.view.setMode(this.scene.view.mode === 'play' ? 'overview' : 'play');
      this.opts.onKey?.(e.code);
      return;
    }
    this.opts.onKey?.(e.code);
  }
}
