/**
 * Match summary: the dialog shown when a Start game match is over. It names
 * the winner, lists the standings, and draws a kills-over-time chart with one
 * step line per tank (in that tank's scoreboard colour), plus two buttons:
 * play again and change tank.
 */

export interface SummaryTank {
  name: string;
  /** The tank's colour on the ice and on the scoreboard (the chart uses it too). */
  color: string;
  isYou: boolean;
  /** Match time (s) of each of this tank's kills, in order. */
  killTimes: number[];
  falls: number;
  /** Race only: the race result for this tank ("winner", "lap 3"). */
  race?: string;
}

export interface SummaryInfo {
  title: string;
  subtitle: string;
  /** Match length (s): where the chart's time axis ends. */
  duration: number;
  /** Tanks in finishing order (first = winner). */
  tanks: SummaryTank[];
  /** Top of the kills axis (at least the most kills anyone got). */
  killGoal: number;
}

/** The card's surface (the chart's dots get a ring in this colour). */
const SURFACE = '#0d1b28';
const SVG_NS = 'http://www.w3.org/2000/svg';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ordinal = (k: number) => `${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'}`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Kills a tank had at match time t. */
const killsAt = (tank: SummaryTank, t: number) => tank.killTimes.filter((k) => k <= t).length;

export class MatchSummary {
  readonly element: HTMLElement;
  private readonly chartBox: HTMLElement;
  private readonly tooltip: HTMLElement;
  private info: SummaryInfo | null = null;

  constructor(onPlayAgain: () => void, onChangeTank: () => void) {
    this.element = document.createElement('div');
    this.element.id = 'match-summary';
    this.element.hidden = true;
    this.element.innerHTML = `
      <div class="ms-card" role="dialog" aria-modal="true" aria-labelledby="ms-title">
        <h2 id="ms-title"></h2>
        <p class="ms-sub"></p>
        <h3>Kills over time</h3>
        <div class="ms-chart"><div class="ms-tip" hidden></div></div>
        <table class="ms-table"></table>
        <div class="ms-actions">
          <button type="button" class="primary" data-action="again">Play again</button>
          <button type="button" data-action="change">Change tank</button>
        </div>
      </div>`;
    this.chartBox = this.element.querySelector('.ms-chart')!;
    this.tooltip = this.element.querySelector('.ms-tip')!;
    this.element.querySelector('[data-action="again"]')!.addEventListener('click', onPlayAgain);
    this.element.querySelector('[data-action="change"]')!.addEventListener('click', onChangeTank);
    // Clicks and keys inside the dialog don't reach the game behind it.
    this.element.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.element.addEventListener('keydown', (e) => e.stopPropagation());
    window.addEventListener('resize', () => {
      if (this.info && !this.element.hidden) this.drawChart(this.info);
    });
    document.body.appendChild(this.element);
  }

  get visible(): boolean {
    return !this.element.hidden;
  }

  show(info: SummaryInfo): void {
    this.info = info;
    this.element.querySelector('#ms-title')!.textContent = info.title;
    this.element.querySelector('.ms-sub')!.textContent = info.subtitle;
    this.element.hidden = false;
    this.drawTable(info);
    this.drawChart(info);
    (this.element.querySelector('[data-action="again"]') as HTMLButtonElement).focus();
  }

  hide(): void {
    this.element.hidden = true;
    this.info = null;
  }

  /** Standings: place, tank, (race result,) kills, falls. Also the chart's table view. */
  private drawTable(info: SummaryInfo): void {
    const race = info.tanks.some((t) => t.race !== undefined);
    const rows = info.tanks
      .map(
        (t, i) =>
          `<tr class="${t.isYou ? 'you' : ''}"><td>${ordinal(i + 1)}</td>` +
          `<td><span class="ms-key" style="--c:${t.color}"></span>${escapeHtml(t.name)}${t.isYou ? ' <span class="ms-you">you</span>' : ''}</td>` +
          (race ? `<td>${escapeHtml(t.race ?? '')}</td>` : '') +
          `<td class="num">${t.killTimes.length}</td><td class="num">${t.falls}</td></tr>`,
      )
      .join('');
    this.element.querySelector('.ms-table')!.innerHTML =
      `<thead><tr><th>Place</th><th>Tank</th>${race ? '<th>Race</th>' : ''}<th class="num">Kills</th><th class="num">Falls</th></tr></thead><tbody>${rows}</tbody>`;
  }

  /**
   * One step line per tank: flat between kills, a step up at each kill. Tanks
   * with the same count would hide each other, so each line sits a pixel or
   * two apart. End labels name the leaders where they don't collide; the
   * table and the hover tooltip carry the rest.
   */
  private drawChart(info: SummaryInfo): void {
    this.chartBox.querySelector('svg')?.remove();
    const width = Math.max(260, this.chartBox.clientWidth);
    const height = width < 420 ? 190 : 230;
    const labels = width >= 420;
    const m = { top: 10, right: labels ? 96 : 14, bottom: 24, left: 28 };
    const w = width - m.left - m.right;
    const h = height - m.top - m.bottom;
    const duration = Math.max(1, info.duration);
    const yMax = Math.max(1, info.killGoal, ...info.tanks.map((t) => t.killTimes.length));
    const x = (t: number) => m.left + (Math.min(t, duration) / duration) * w;
    const y = (k: number) => m.top + h - (k / yMax) * h;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `Kills over time, ${clock(duration)} match: ` + info.tanks.map((t) => `${t.name} ${t.killTimes.length}`).join(', '),
    );
    const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      if (text !== undefined) el.textContent = text;
      svg.appendChild(el);
      return el;
    };

    // Grid and axes: hairlines, quiet text.
    const yStep = yMax > 10 ? 2 : 1;
    for (let k = 0; k <= yMax; k += yStep) {
      add('line', { x1: m.left, x2: m.left + w, y1: y(k), y2: y(k), class: k === 0 ? 'ms-axis' : 'ms-grid' });
      add('text', { x: m.left - 8, y: y(k) + 4, 'text-anchor': 'end', class: 'ms-tick' }, String(k));
    }
    const xStep = [5, 10, 15, 30, 60, 120, 300].find((s) => duration / s <= (width < 420 ? 4 : 6)) ?? 600;
    for (let t = 0; t <= duration + 0.01; t += xStep) {
      add('text', { x: x(t), y: m.top + h + 17, 'text-anchor': 'middle', class: 'ms-tick' }, clock(t));
    }

    // Lines: yours drawn last, on top.
    const n = info.tanks.length;
    const order = info.tanks.map((t, i) => ({ t, i })).sort((a, b) => Number(a.t.isYou) - Number(b.t.isYou));
    const offset = (i: number) => (i - (n - 1) / 2) * 2;
    for (const { t, i } of order) {
      const dy = offset(i);
      let d = `M${x(0)},${y(0) + dy}`;
      t.killTimes.forEach((time, k) => {
        d += `H${x(time)}V${y(k + 1) + dy}`;
      });
      d += `H${x(duration)}`;
      add('path', { d, class: 'ms-line', stroke: t.color });
    }
    for (const { t, i } of order) {
      add('circle', { cx: x(duration), cy: y(t.killTimes.length) + offset(i), r: 4, fill: t.color, stroke: SURFACE, 'stroke-width': 2 });
    }

    // End labels, leader first; one that would overlap a placed label is skipped.
    if (labels) {
      const placed: number[] = [];
      for (const [i, t] of info.tanks.entries()) {
        const ly = y(t.killTimes.length) + offset(i);
        if (placed.some((p) => Math.abs(p - ly) < 14)) continue;
        placed.push(ly);
        add('text', { x: m.left + w + 10, y: ly + 4, class: t.isYou ? 'ms-end you' : 'ms-end' }, `${t.name} ${t.killTimes.length}`);
      }
    }

    // Hover: a crosshair at the pointer's time and a tooltip with everyone's kills then.
    const cross = add('line', { x1: 0, x2: 0, y1: m.top, y2: m.top + h, class: 'ms-cross', visibility: 'hidden' });
    const hit = add('rect', { x: m.left, y: 0, width: w, height: m.top + h, fill: 'transparent' });
    const hideTip = () => {
      cross.setAttribute('visibility', 'hidden');
      this.tooltip.hidden = true;
    };
    hit.addEventListener('pointermove', (e) => {
      const box = svg.getBoundingClientRect();
      const px = Math.min(m.left + w, Math.max(m.left, (e as PointerEvent).clientX - box.left));
      const time = ((px - m.left) / w) * duration;
      cross.setAttribute('x1', String(px));
      cross.setAttribute('x2', String(px));
      cross.setAttribute('visibility', 'visible');
      const rows = info.tanks
        .map((t) => ({ t, k: killsAt(t, time) }))
        .sort((a, b) => b.k - a.k)
        .map(({ t, k }) => `<div><span class="ms-key" style="--c:${t.color}"></span>${escapeHtml(t.name)}<b>${k}</b></div>`)
        .join('');
      this.tooltip.innerHTML = `<div class="ms-tip-time">${clock(time)}</div>${rows}`;
      this.tooltip.hidden = false;
      const tipW = this.tooltip.offsetWidth;
      this.tooltip.style.left = `${px + 12 + tipW > width ? px - 12 - tipW : px + 12}px`;
      this.tooltip.style.top = `${m.top}px`;
    });
    hit.addEventListener('pointerleave', hideTip);
    hideTip();
    this.chartBox.appendChild(svg);
  }
}
