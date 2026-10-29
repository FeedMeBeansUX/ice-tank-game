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
  /** Shotgun: choosing where to throw the grenade. */
  aimingGrenade = false;
  /** Where the mouse points on the ice (for the grenade landing circle). */
  pointer: { x: number; z: number } | null = null;
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
      /** Mobile mode: double-tap a tank to pick it as your target (instead of right-click). */
      mobile?: boolean;
    },
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    canvas.addEventListener('pointermove', (e) => {
      this.pointer = this.scene.groundAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** Last tap (mobile double-tap detection). */
  private lastTap = { time: -Infinity, x: 0, y: 0 };

  /** Shift: the tank's ability (Shotgun and Rocket first pick a spot). Also the ability button on mobile. */
  useAbility(): void {
    if (!this.active()) return;
    const own = this.own();
    if (own?.model === 'modelE' || own?.model === 'modelG') {
      // Shotgun and Rocket: start choosing a spot; again cancels.
      if (this.aimingGrenade) this.setGrenade(false);
      else if (own.status === 'alive' && own.abilityCooldownLeft <= 0 && own.disabledLeft <= 0) this.setGrenade(true);
      return;
    }
    this.send({ type: 'ability' });
  }

  /** Q/W/E: use the powerup in a slot (missiles start aiming). Also the slot buttons on mobile. */
  useSlot(slot: number): void {
    if (!this.active()) return;
    const own = this.own();
    const kind = own?.slots[slot];
    if (!own || own.status !== 'alive' || !kind) return;
    if (kind === 'mine' || kind === 'rapidFire') {
      if (this.aimingSlot !== null) this.setAiming(null);
      this.send({ type: kind, slot });
    } else {
      this.setAiming(this.aimingSlot === slot ? null : slot);
    }
  }

  /**
   * Pick or clear your target at a screen point: an enemy tank there becomes
   * the target (the same tank again clears it); empty ice clears it.
   */
  private pickTargetAt(clientX: number, clientY: number, clearOnIce: boolean): boolean {
    const own = this.own();
    const spot = this.scene.groundAt(clientX, clientY);
    if (!own || !spot) return false;
    const w = this.world();
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const t of w.tanks) {
      if (t === own || t.status !== 'alive' || w.isHidden(t)) continue;
      const d = Math.hypot(t.x - spot.x, t.z - spot.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    const picked = best && bestD <= w.tuning.tanks[best.model].radius + 1.5 ? best : null;
    if (!picked && !clearOnIce) return false;
    this.send({ type: 'target', targetId: picked && picked.id !== own.designatedId ? picked.id : null });
    return !!picked;
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
    if (this.aimingGrenade && (!own || own.status !== 'alive' || own.disabledLeft > 0 || own.abilityCooldownLeft > 0)) this.setGrenade(false);
  }

  /** Stop any missile, grenade or drone aiming (e.g. when a race restarts). */
  cancelAiming(): void {
    this.setAiming(null);
    this.setGrenade(false);
  }

  private setAiming(slot: number | null): void {
    this.aimingSlot = slot;
    if (slot !== null) this.aimingGrenade = false;
    document.body.classList.toggle('aiming', slot !== null || this.aimingGrenade);
  }

  private setGrenade(on: boolean): void {
    this.aimingGrenade = on;
    if (on) this.aimingSlot = null;
    document.body.classList.toggle('aiming', on || this.aimingSlot !== null);
  }

  private active(): boolean {
    return this.opts.enabled ? this.opts.enabled() : true;
  }

  private onPointer(e: PointerEvent): void {
    if (!this.active()) return;
    if (e.button === 2) {
      // While aiming (missile, grenade, drone): right-click cancels aiming.
      if (this.aimingSlot !== null || this.aimingGrenade) {
        this.setAiming(null);
        this.setGrenade(false);
        return;
      }
      // Otherwise it picks your target: right-click an enemy to fire only at it;
      // right-click it again, or the ice, to go back to automatic.
      this.pickTargetAt(e.clientX, e.clientY, true);
      return;
    }
    if (e.button !== 0) return;
    const hit = this.scene.groundAt(e.clientX, e.clientY);
    const own = this.own();
    if (!hit || !own || own.status !== 'alive') return;

    if (this.opts.mobile && this.aimingSlot === null && !this.aimingGrenade) {
      // Mobile: a second tap on the same spot right away is a double-tap. On a
      // tank it picks (or clears) your target instead of pushing; on the ice
      // it pushes as usual and also clears your target.
      const now = performance.now();
      const double = now - this.lastTap.time < 400 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 40;
      this.lastTap = double ? { time: -Infinity, x: 0, y: 0 } : { time: now, x: e.clientX, y: e.clientY };
      if (double && this.pickTargetAt(e.clientX, e.clientY, false)) return;
      if (double && own.designatedId !== null) this.send({ type: 'target', targetId: null });
    }

    if (this.aimingGrenade) {
      // Shotgun: the click picks where the grenade lands. Rocket: where the drone goes.
      this.send({ type: own.model === 'modelG' ? 'drone' : 'grenade', x: hit.x, z: hit.z });
      this.setGrenade(false);
      return;
    }

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
      if (e.repeat) return;
      this.useAbility();
      return;
    }
    if (e.repeat) return;
    const slot = SLOT_KEYS.indexOf(e.code);
    if (slot >= 0) {
      this.useSlot(slot);
      return;
    }
    if (e.code === 'Escape') {
      this.setAiming(null);
      this.setGrenade(false);
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
