import type { PowerupKind, TankInput, TankState, World } from '@ice-tank-sumo/shared';
import type { GameScene } from './scene';
import { settings } from './settings';

export const SLOT_KEYS = ['KeyQ', 'KeyW', 'KeyE'];

/**
 * Mouse and keyboard, the same in practice and online:
 * - left click: turn toward the point and push (a click on a highlighted tank
 *   while a missile is ready fires the missile instead); holding the button
 *   repeats the push at the click-cooldown pace, toward the pointer (also
 *   while a missile is aimed)
 * - a missile aimed at a tank inside the minimum distance locks on and fires
 *   by itself once that tank is far enough away
 * - Shift: ability · Q/W/E: powerup slots · right-click or Esc: cancel aiming
 *
 * Inputs go to `send`: straight into the simulation in practice, to the
 * server online.
 */
export class Controls {
  /** Slot of the missile being aimed, or null. */
  aimingSlot: number | null = null;
  /**
   * A missile locked on a tank that was too close to fire at: it fires by
   * itself once that tank is at the minimum distance. Dropped if the tank
   * falls or dies first (the missile stays in its slot).
   */
  missileLock: { slot: number; targetId: number } | null = null;
  /** When the locked missile was last sent (s), so it's offered again if the server didn't take it. */
  private lockSentAt = -Infinity;
  /** Slot of the airstrike being aimed (camera zoomed out, click a spot), or null. */
  airstrikeSlot: number | null = null;
  /** Shotgun: choosing where to throw the grenade. */
  aimingGrenade = false;
  /** Where the mouse points on the ice (for the grenade landing circle). */
  pointer: { x: number; z: number } | null = null;
  private lastMarker = -Infinity;
  /** Last mouse position on screen, so `pointer` stays right while the camera moves. */
  private lastClient: { x: number; y: number } | null = null;
  /** Left button held down after a plain move click: keep turning and pushing toward the pointer. */
  private holding = false;
  /** When the last held-down move was sent (s). */
  private lastHoldSend = -Infinity;

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
      this.lastClient = { x: e.clientX, y: e.clientY };
      this.pointer = this.scene.groundAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const release = (e?: PointerEvent) => {
      if (!e || e.button === 0 || e.type === 'pointercancel') this.holding = false;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', () => release());
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
    if (kind === 'mine' || kind === 'rapidFire' || kind === 'teslaCoil') {
      if (this.aimingSlot !== null) this.setAiming(null);
      this.send({ type: kind, slot });
    } else if (kind === 'airstrike') {
      // Sumo only: zoom out and pick a spot; the same key again cancels.
      if (this.world().track) return;
      this.setAirstrike(this.airstrikeSlot === slot ? null : slot);
    } else {
      // Missile: start aiming; the same key again cancels. On a locked missile
      // it drops the lock and goes back to aiming (to pick another tank).
      const locked = this.missileLock?.slot === slot;
      if (locked) this.missileLock = null;
      this.setAiming(this.aimingSlot === slot && !locked ? null : slot);
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
    const picked = best && bestD <= w.tuning.common.radius + 1.5 ? best : null;
    if (!picked && !clearOnIce) return false;
    this.send({ type: 'target', targetId: picked && picked.id !== own.designatedId ? picked.id : null });
    return !!picked;
  }

  /** Tanks you may aim the missile at right now: far enough away to fire, or close enough to lock on. */
  pickable(): Set<number> {
    const own = this.own();
    if (this.aimingSlot === null || !own) return new Set();
    const w = this.world();
    return new Set(w.tanks.filter((t) => this.canLock(w, own, t)).map((t) => t.id));
  }

  /** A tank the missile can be aimed at, ignoring the minimum distance (inside it the missile locks on). */
  private canLock(w: World, own: TankState, t: TankState): boolean {
    return t !== own && t.status === 'alive' && t.protectionLeft <= 0 && !w.isHidden(t);
  }

  /**
   * Fire the aimed missile at a tank (also used by the screen-edge markers).
   * A tank inside the minimum distance gets locked on instead: the missile
   * fires once it's far enough away.
   */
  fireMissileAt(tankId: number): void {
    if (this.aimingSlot === null) return;
    const own = this.own();
    const w = this.world();
    const target = w.tanks[tankId];
    if (!own || !target || !this.canLock(w, own, target)) return;
    if (w.canTargetWithMissile(own, target)) this.send({ type: 'missile', slot: this.aimingSlot, targetId: tankId });
    else {
      this.missileLock = { slot: this.aimingSlot, targetId: tankId };
      this.lockSentAt = -Infinity;
    }
    this.setAiming(null);
  }

  /**
   * A locked missile: fire it the moment its tank is far enough away; drop the
   * lock if that tank falls or dies first, or once the missile has gone.
   * Online it's offered every 200 ms until the server takes it (the mirror
   * can be a little behind the server).
   */
  private updateLock(w: World, own: TankState): void {
    if (!this.missileLock) return;
    const { slot, targetId } = this.missileLock;
    const target = w.tanks[targetId];
    if (own.slots[slot] !== 'missile' || !target || target.status !== 'alive') {
      this.missileLock = null;
      return;
    }
    const now = performance.now() / 1000;
    if (!w.canTargetWithMissile(own, target) || now - this.lockSentAt < 0.2) return;
    this.lockSentAt = now;
    this.send({ type: 'missile', slot, targetId });
  }

  /** Drop aiming if the powerup is gone or you fell, and fire a locked missile. Call every frame. */
  update(): void {
    if (this.lastClient) this.pointer = this.scene.groundAt(this.lastClient.x, this.lastClient.y);
    const own = this.own();
    // Falling off (or watching) ends all aiming and any lock; the powerups stay in their slots.
    if (!own || own.status !== 'alive') {
      if (this.aimingSlot !== null || this.missileLock || this.aimingGrenade || this.airstrikeSlot !== null) this.cancelAiming();
      this.holding = false;
      return;
    }
    if (this.aimingSlot !== null && own.slots[this.aimingSlot] !== 'missile') this.setAiming(null);
    this.updateLock(this.world(), own);
    if (this.aimingGrenade && (!own || own.status !== 'alive' || own.disabledLeft > 0 || own.abilityCooldownLeft > 0)) this.setGrenade(false);
    if (this.airstrikeSlot !== null && (!own || own.status !== 'alive' || own.slots[this.airstrikeSlot] !== 'airstrike')) this.setAirstrike(null);
    this.autoUsePowerups();
    this.repeatHeldMove();
  }

  /**
   * Holding the left button repeats the click at the click-cooldown pace,
   * toward wherever the pointer is now. Practice: sent the moment your tank's
   * cooldown is over. Online the server's cooldown isn't visible here, so the
   * move is offered every 50 ms and the server takes the first one it may.
   */
  private repeatHeldMove(): void {
    if (!this.holding) return;
    const own = this.own();
    if (!this.active() || !own || own.status !== 'alive') {
      this.holding = false;
      return;
    }
    // Aiming a grenade, drone or airstrike: the next click is for that. (While
    // a missile is aimed, holding still drives; only a fresh click fires it.)
    if (this.aimingGrenade || this.airstrikeSlot !== null) return;
    if (!this.pointer) return;
    const now = performance.now() / 1000;
    if (this.opts.instantClickMarker) {
      if (now - this.lastHoldSend < 0.05) return;
    } else if (own.clickCooldownLeft > 0) return;
    this.lastHoldSend = now;
    this.sendMove(this.pointer.x, this.pointer.z);
  }

  private sendMove(x: number, z: number): void {
    this.send({ type: 'move', x, z });
    // Instant feedback online: show the click ring now (respecting the click cooldown).
    const now = performance.now() / 1000;
    if (this.opts.instantClickMarker && now - this.lastMarker >= this.world().tuning.rules.clickCooldown) {
      this.lastMarker = now;
      this.scene.clickMarker(x, z);
    }
  }

  /** When each slot was last used automatically (ms), so a slow server reply doesn't cause repeats. */
  private autoSentAt = [-Infinity, -Infinity, -Infinity];

  /**
   * Automatic powerups (setting): use what's in the slots for the player, as
   * if they pressed Q/W/E at the right moment. Abilities stay manual.
   * Powerups that need an enemy wait in their slot until there is one.
   */
  private autoUsePowerups(): void {
    if (!settings.autoPowerups || !this.active()) return;
    const own = this.own();
    if (!own || own.status !== 'alive' || own.disabledLeft > 0) return;
    const w = this.world();
    const now = performance.now();
    own.slots.forEach((kind, slot) => {
      if (!kind || now - (this.autoSentAt[slot] ?? -Infinity) < 300) return;
      // A missile you locked on by hand waits for its own tank.
      if (this.missileLock?.slot === slot) return;
      const input = this.autoInput(w, own, kind, slot);
      if (!input) return;
      this.autoSentAt[slot] = now;
      if (this.aimingSlot === slot) this.setAiming(null);
      if (this.airstrikeSlot === slot) this.setAirstrike(null);
      this.send(input);
    });
  }

  /** The input that uses this powerup now, or null to keep it for later. */
  private autoInput(w: World, own: TankState, kind: PowerupKind, slot: number): TankInput | null {
    if (kind === 'mine' || kind === 'teslaCoil') return { type: kind, slot };
    if (kind === 'rapidFire') {
      // Once an enemy is in firing range, and not while one is still running (it would only restart the timer).
      const enemy = w.closestEnemy(own);
      if (own.rapidFireLeft > 0 || !enemy || Math.hypot(enemy.x - own.x, enemy.z - own.z) > w.range(own)) return null;
      return { type: 'rapidFire', slot };
    }
    if (kind === 'missile') {
      const target = this.autoTarget(w, own, (t) => w.canTargetWithMissile(own, t));
      return target ? { type: 'missile', slot, targetId: target.id } : null;
    }
    // Airstrike (Sumo only): on where the target will be when the bombs land,
    // but not while that is so close the bombs would hit you too.
    if (w.track) return null;
    const target = this.autoTarget(w, own, (t) => t.status === 'alive' && t.protectionLeft <= 0 && !w.isHidden(t));
    if (!target) return null;
    const A = w.tuning.airstrike;
    const x = target.x + target.vx * A.delaySeconds;
    const z = target.z + target.vz * A.delaySeconds;
    if (Math.hypot(x - own.x, z - own.z) <= A.radius + A.spacing * 1.5) return null;
    return { type: 'airstrike', slot, x, z };
  }

  /**
   * Who an automatic powerup goes to: your right-click target (and only that
   * tank, waiting while it can't be aimed at), else the closest enemy that can.
   */
  private autoTarget(w: World, own: TankState, ok: (t: TankState) => boolean): TankState | null {
    if (own.designatedId !== null) {
      const t = w.tanks[own.designatedId];
      return t && t !== own && ok(t) ? t : null;
    }
    let best: TankState | null = null;
    let bestD = Infinity;
    for (const t of w.tanks) {
      if (t === own || !ok(t)) continue;
      const d = (t.x - own.x) ** 2 + (t.z - own.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  /** Stop any missile, grenade or drone aiming, and drop a missile lock (e.g. when a race restarts). */
  cancelAiming(): void {
    this.missileLock = null;
    this.setAiming(null);
    this.setGrenade(false);
    this.setAirstrike(null);
  }

  private setAiming(slot: number | null): void {
    this.aimingSlot = slot;
    if (slot !== null) {
      this.aimingGrenade = false;
      this.setAirstrike(null);
    }
    this.markAiming();
  }

  private setGrenade(on: boolean): void {
    this.aimingGrenade = on;
    if (on) {
      this.aimingSlot = null;
      this.setAirstrike(null);
    }
    this.markAiming();
  }

  /** Airstrike aiming: the camera zooms out to the whole arena while you pick a spot. */
  private setAirstrike(slot: number | null): void {
    this.airstrikeSlot = slot;
    if (slot !== null) {
      this.aimingSlot = null;
      this.aimingGrenade = false;
    }
    this.scene.view.zoomedOut = slot !== null;
    this.markAiming();
  }

  private markAiming(): void {
    document.body.classList.toggle('aiming', this.aimingSlot !== null || this.aimingGrenade || this.airstrikeSlot !== null);
  }

  private active(): boolean {
    return this.opts.enabled ? this.opts.enabled() : true;
  }

  private onPointer(e: PointerEvent): void {
    if (!this.active()) return;
    if (e.button === 2) {
      // While aiming (missile, grenade, drone, airstrike) or locked on: right-click cancels it.
      if (this.aimingSlot !== null || this.aimingGrenade || this.airstrikeSlot !== null || this.missileLock) {
        this.cancelAiming();
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

    if (this.airstrikeSlot !== null) {
      // Airstrike: the click (anywhere on the map) calls it there.
      this.send({ type: 'airstrike', slot: this.airstrikeSlot, x: hit.x, z: hit.z });
      this.setAirstrike(null);
      return;
    }

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
      // A click on (or near) a highlighted tank fires the missile (or locks
      // on, if it's too close). A click anywhere else still moves your tank,
      // holding keeps pushing, and aiming stays on.
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
      if (best && bestD <= w.tuning.common.radius + 2.5) {
        this.fireMissileAt(best.id);
        return;
      }
    }
    this.sendMove(hit.x, hit.z);
    this.pointer = hit;
    this.holding = true;
    this.lastHoldSend = performance.now() / 1000;
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
      this.cancelAiming();
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
