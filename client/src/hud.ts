import {
  SLOT_COUNT,
  type PowerupKind,
  type TankModel,
  type TankState,
  type World,
} from '@ice-tank-sumo/shared';
import type * as THREE from 'three';
import { Minimap, OffscreenMarkers, type MarkerItem, type MinimapDot } from './overlay';
import { POWERUP_COLORS } from './powerupViews';

/**
 * The screen overlay, shared by practice and online: weapon, ability and
 * powerup slots (bottom), banner (respawn, countdown, winner), aim hint,
 * off-screen markers, minimap, and online the scoreboard and message box.
 */

const SLOT_LABELS = ['Q', 'W', 'E'];
const POWERUP_NAMES: Record<PowerupKind, string> = { missile: 'Missile', mine: 'Mine', rapidFire: 'Rapid fire' };
const POWERUP_LABELS: Record<PowerupKind, string> = { missile: 'M', mine: '●', rapidFire: 'R' };
const ABILITY_NAMES: Record<TankModel, string> = { modelA: 'Boost', modelB: 'Power shot', modelC: 'Smoke', modelD: 'EMP' };

function bar(fraction: number): string {
  return `<span class="bar"><span style="width:${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%"></span></span>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface ScoreRow {
  name: string;
  color: string;
  score: number;
  isYou: boolean;
  watching: boolean;
}

export class Hud {
  private readonly weapon = document.getElementById('weapon')!;
  private readonly banner = document.getElementById('banner')!;
  private readonly aimHint = document.getElementById('aim-hint')!;
  private readonly stats = document.getElementById('hud-stats')!;
  private readonly cam = document.getElementById('hud-cam')!;
  private readonly help = document.getElementById('hud-help')!;
  private readonly tag = document.getElementById('hud-tag')!;
  private readonly scoreboard = document.getElementById('scoreboard')!;
  private readonly messages = document.getElementById('messages')!;
  private readonly offscreen: OffscreenMarkers;
  private readonly minimap = new Minimap();

  constructor(onPickTank: (tankId: number) => void) {
    this.offscreen = new OffscreenMarkers(onPickTank);
    document.body.appendChild(this.offscreen.element);
    document.body.appendChild(this.minimap.element);
    document.getElementById('hud')!.hidden = false;
    this.weapon.hidden = false;
  }

  setMode(tag: string, helpHtml: string): void {
    this.tag.textContent = tag;
    this.help.innerHTML = helpHtml;
  }

  setStats(text: string): void {
    this.stats.textContent = text;
    this.stats.hidden = !text;
  }

  /** Notes under the help text (camera mode, firing off...). */
  setNotes(parts: string[]): void {
    this.cam.textContent = parts.join(' · ');
    this.cam.style.display = parts.length ? '' : 'none';
  }

  /** Big centred text, or null to hide it. */
  setBanner(text: string | null, big = false): void {
    this.banner.hidden = text === null;
    this.banner.classList.toggle('big', big);
    if (text !== null) this.banner.textContent = text;
  }

  setScoreboard(rows: ScoreRow[], pointsToWin: number): void {
    this.scoreboard.hidden = rows.length === 0;
    this.scoreboard.innerHTML =
      `<div class="sb-title">First to ${pointsToWin}</div>` +
      rows
        .map(
          (r) =>
            `<div class="sb-row${r.isYou ? ' you' : ''}"><i style="background:${r.color}"></i><span class="sb-name">${escapeHtml(r.name)}${r.isYou ? ' (you)' : ''}${r.watching ? ' <span class="muted">watching</span>' : ''}</span><b>${r.score}</b></div>`,
        )
        .join('');
  }

  /** Add a line to the message box (knockouts, joins...). */
  message(text: string): void {
    this.messages.hidden = false;
    const line = document.createElement('div');
    line.textContent = text;
    this.messages.appendChild(line);
    while (this.messages.childElementCount > 6) this.messages.firstElementChild!.remove();
    setTimeout(() => line.classList.add('old'), 8000);
  }

  /** Bottom bar: next shot, ability and the three powerup slots. */
  updateBar(world: World, own: TankState | null, aimingSlot: number | null): void {
    this.weapon.hidden = !own;
    if (!own) return;
    const T = world.tuning;
    const stats = world.stats(own);
    let weapon: string;
    if (T.tanks[own.model].barrels <= 0) {
      weapon = `<span class="muted">No gun · bumps push ${T.tanks[own.model].bumpMultiplier}× harder</span>`;
      if (own.empPulsesLeft > 0) weapon += ` <b class="rapid">EMP pulses: ${own.empPulsesLeft} to go</b>`;
    } else if (!T.combat.firingEnabled) {
      weapon = `<span class="muted">Firing off</span>`;
    } else {
      const target = world.closestEnemy(own);
      const inRange = !!target && Math.hypot(target.x - own.x, target.z - own.z) <= T.combat.rangeMetres;
      weapon = `Next shot ${bar(1 - own.shotTimerLeft / stats.timeBetweenShots)} <span class="muted">${inRange ? 'in range' : 'no target'}</span>`;
      if (own.rapidFireLeft > 0) weapon += ` <b class="rapid">rapid fire ${own.rapidFireLeft.toFixed(1)} s</b>`;
    }

    const ability = ABILITY_NAMES[own.model];
    const cooldowns: Record<TankModel, number> = {
      modelA: T.abilities.boost.cooldown,
      modelB: T.abilities.powerShot.cooldown,
      modelC: T.abilities.smoke.cooldown,
      modelD: T.abilities.emp.cooldown,
    };
    const cooldown = cooldowns[own.model];
    let abilityText: string;
    if (own.disabledLeft > 0) abilityText = `<b class="disabled">Disabled by EMP ${own.disabledLeft.toFixed(1)} s</b>`;
    else if (own.stealthLeft > 0) abilityText = `${ability} <b class="active">hidden ${own.stealthLeft.toFixed(1)} s</b>`;
    else if (own.boostLeft > 0) abilityText = `${ability} <b class="active">active ${own.boostLeft.toFixed(1)} s</b>`;
    else if (own.powerShotsLeft > 0) abilityText = `${ability} <b class="active">${own.powerShotsLeft} charged</b>`;
    else if (own.abilityCooldownLeft > 0) abilityText = `${ability} ${bar(1 - own.abilityCooldownLeft / cooldown)} <span class="muted">${own.abilityCooldownLeft.toFixed(1)} s</span>`;
    else abilityText = `${ability} <b class="ready">ready</b> <kbd>Shift</kbd>`;

    let slots = '<div class="slots">';
    for (let i = 0; i < SLOT_COUNT; i++) {
      const kind = own.slots[i];
      const cls = ['slot', kind ? `has-${kind}` : 'empty', aimingSlot === i ? 'aiming' : ''].join(' ');
      slots += `<span class="${cls}"><kbd>${SLOT_LABELS[i]}</kbd>${kind ? POWERUP_NAMES[kind] : '<span class="muted">empty</span>'}</span>`;
    }
    slots += '</div>';
    this.weapon.innerHTML = `<div>${weapon}</div><div>${abilityText}</div>${slots}`;
  }

  /** Aim hint, off-screen markers and minimap. */
  updateOverlays(args: {
    world: World;
    own: TankState | null;
    camera: THREE.Camera;
    colorOf: (t: TankState) => string;
    label: (t: TankState) => string;
    aiming: boolean;
    pickable: Set<number>;
    time: number;
  }): void {
    const { world, own, camera, colorOf, label, aiming, pickable, time } = args;
    const T = world.tuning;
    const items: MarkerItem[] = [];
    for (const t of world.tanks) {
      if (t === own || t.status !== 'alive' || t.stealthLeft > 0) continue;
      items.push({ key: `tank-${t.id}-${colorOf(t)}`, x: t.x, z: t.z, kind: 'tank', color: colorOf(t), label: label(t), pickableTankId: pickable.has(t.id) ? t.id : undefined });
    }
    for (const m of world.missiles) {
      if (!own || m.targetId !== own.id) continue;
      items.push({ key: `missile-${m.id}`, x: m.x, z: m.z, kind: 'missile', color: '#ff3b30', label: '!' });
    }
    for (const p of world.powerups) {
      items.push({ key: `powerup-${p.id}`, x: p.x, z: p.z, kind: 'powerup', color: POWERUP_COLORS[p.kind], label: POWERUP_LABELS[p.kind] });
    }
    this.offscreen.update(items, camera, time);

    const dots: MinimapDot[] = [];
    for (const p of world.powerups) dots.push({ x: p.x, z: p.z, color: POWERUP_COLORS[p.kind], kind: 'powerup' });
    for (const m of world.mines) dots.push({ x: m.x, z: m.z, color: '#ff3b30', kind: 'mine' });
    for (const t of world.tanks) {
      if (t.status !== 'alive' || (t !== own && t.stealthLeft > 0)) continue;
      dots.push({ x: t.x, z: t.z, color: colorOf(t), kind: t === own ? 'own' : 'tank' });
    }
    this.minimap.draw(T.arena.radius, dots, T.camera.yawDeg);

    const showHint = aiming && !!own && own.status === 'alive';
    this.aimHint.hidden = !showHint;
    if (showHint) {
      this.aimHint.textContent = pickable.size
        ? 'Missile ready: click a highlighted tank to fire · click the ice to keep moving · right-click or the same key cancels'
        : `Missile ready: no tank at least ${T.missile.minTargetDistance} m away yet · right-click or the same key cancels`;
    }
  }
}
