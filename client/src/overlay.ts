import * as THREE from 'three';
import type { Track } from '@ice-tank-sumo/shared';

/**
 * Screen overlays: arrows at the screen edge for things you can't see
 * (opponents, incoming missiles, powerups), and a small minimap.
 */

export interface MarkerItem {
  /** Stable key, e.g. "tank-2" or "powerup-17". */
  key: string;
  x: number;
  z: number;
  kind: 'tank' | 'missile' | 'powerup';
  color: string;
  /** Short label inside the marker. */
  label: string;
  /** Tank id, when the marker can be clicked to pick a missile target. */
  pickableTankId?: number;
}

/** Markers sit inside this frame, above the bottom status bar. */
const MARGIN = { left: 30, right: 30, top: 30, bottom: 84 };

export class OffscreenMarkers {
  readonly element: HTMLElement;
  private readonly pool = new Map<string, HTMLElement>();
  private readonly projected = new THREE.Vector3();

  constructor(private readonly onPick: (tankId: number) => void) {
    this.element = document.createElement('div');
    this.element.id = 'markers';
  }

  update(items: MarkerItem[], camera: THREE.Camera, time: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const left = MARGIN.left;
    const right = w - MARGIN.right;
    const top = MARGIN.top;
    const bottom = h - MARGIN.bottom;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const seen = new Set<string>();

    for (const item of items) {
      this.projected.set(item.x, 0, item.z).project(camera);
      const sx = (this.projected.x + 1) * 0.5 * w;
      const sy = (1 - this.projected.y) * 0.5 * h;
      const onScreen = sx > left && sx < right && sy > top && sy < bottom;
      if (onScreen) continue;
      seen.add(item.key);

      // Place the arrow where the line from the screen centre meets the edge.
      const dx = sx - cx;
      const dy = sy - cy;
      const scale = Math.min((right - cx) / Math.max(Math.abs(dx), 1e-3), (bottom - cy) / Math.max(Math.abs(dy), 1e-3));
      const ex = cx + dx * scale;
      const ey = cy + dy * scale;
      const angle = Math.atan2(dy, dx);

      let el = this.pool.get(item.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'marker';
        el.innerHTML = '<span class="arrow"></span><span class="label"></span>';
        el.addEventListener('pointerdown', (e) => {
          const id = el!.dataset.pick;
          if (id === undefined || id === '') return;
          e.stopPropagation();
          e.preventDefault();
          this.onPick(Number(id));
        });
        this.element.appendChild(el);
        this.pool.set(item.key, el);
      }
      el.dataset.kind = item.kind;
      el.dataset.pick = item.pickableTankId === undefined ? '' : String(item.pickableTankId);
      el.classList.toggle('pickable', item.pickableTankId !== undefined);
      el.classList.toggle('blink', item.kind === 'missile' && Math.sin(time * 14) > 0);
      el.style.setProperty('--c', item.color);
      el.style.transform = `translate(${ex}px, ${ey}px)`;
      // The arrow is a rounded square with one sharp corner (pointing down-left, 135°).
      (el.firstElementChild as HTMLElement).style.transform = `rotate(${angle - (3 * Math.PI) / 4}rad)`;
      (el.lastElementChild as HTMLElement).textContent = item.label;
    }
    for (const [key, el] of this.pool) {
      if (!seen.has(key)) {
        el.remove();
        this.pool.delete(key);
      }
    }
  }
}

export interface MinimapDot {
  x: number;
  z: number;
  color: string;
  kind: 'tank' | 'own' | 'powerup' | 'mine';
}

/** Small top-down map: the ring, every tank in its colour, and the powerups. */
export class Minimap {
  readonly element: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size = 168;

  constructor() {
    this.element = document.createElement('canvas');
    this.element.id = 'minimap';
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.element.width = this.size * ratio;
    this.element.height = this.size * ratio;
    this.element.style.width = `${this.size}px`;
    this.element.style.height = `${this.size}px`;
    this.ctx = this.element.getContext('2d')!;
    this.ctx.scale(ratio, ratio);
  }

  /**
   * `yawDeg` rotates the map to match the camera, so "up" on the minimap
   * is "up" on screen.
   */
  draw(radius: number, dots: MinimapDot[], yawDeg: number, track: Track | null = null): void {
    const ctx = this.ctx;
    const s = this.size;
    const c = s / 2;
    const scale = (c - 10) / radius;
    ctx.clearRect(0, 0, s, s);

    // Match the camera's view direction.
    const yaw = (yawDeg * Math.PI) / 180;
    const toMap = (x: number, z: number): [number, number] => {
      // Screen right / screen down directions for a camera looking from `yaw`.
      const rx = Math.cos(yaw) * x - Math.sin(yaw) * z;
      const dz = Math.sin(yaw) * x + Math.cos(yaw) * z;
      return [c + rx * scale, c + dz * scale];
    };

    if (track) {
      // Race: the track as a thick line, with a white tick at the start line.
      ctx.beginPath();
      track.points.forEach((p, i) => {
        const [px, py] = toMap(p.x, p.z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, track.halfWidth * 2 * scale);
      ctx.strokeStyle = 'rgba(168, 214, 236, 0.35)';
      ctx.stroke();
      const [sx, sy] = toMap(track.points[0]!.x, track.points[0]!.z);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(c, c, radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 214, 236, 0.22)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#2f6a9a';
      ctx.stroke();
    }

    const order: Record<MinimapDot['kind'], number> = { mine: 0, powerup: 1, tank: 2, own: 3 };
    for (const d of [...dots].sort((a, b) => order[a.kind] - order[b.kind])) {
      const [px, py] = toMap(d.x, d.z);
      ctx.beginPath();
      if (d.kind === 'powerup') {
        ctx.rect(px - 3, py - 3, 6, 6);
        ctx.fillStyle = d.color;
        ctx.fill();
      } else if (d.kind === 'mine') {
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
      } else {
        ctx.arc(px, py, d.kind === 'own' ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
        if (d.kind === 'own') {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
      }
    }
  }
}
