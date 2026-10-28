import { DEFAULT_TUNING, type Tuning } from '@ice-tank-sumo/shared';

/**
 * In-game slider panel. Sliders change the live tuning values, so the effect
 * is immediate. "Copy values" puts them on the clipboard to paste in the chat;
 * those then become the new defaults in shared/src/tuning.ts.
 *
 * Values are also remembered in this browser, so a reload keeps your settings.
 */

interface Slider {
  path: string;
  label: string;
  min: number;
  max: number;
  step: number;
  help: string;
}

interface Group {
  title: string;
  sliders: Slider[];
}

const GROUPS: Group[] = [
  {
    title: 'Model A',
    sliders: [
      { path: 'tanks.modelA.thrust', label: 'Thrust', min: 4, max: 80, step: 1, help: 'Force of the push you get on each click.' },
      { path: 'tanks.modelA.burstSeconds', label: 'Burst length', min: 0.05, max: 1, step: 0.05, help: 'How long one click keeps pushing (seconds).' },
      { path: 'tanks.modelA.topSpeed', label: 'Top speed', min: 2, max: 30, step: 0.5, help: "Your own thrust can't push you faster than this (m/s). Bumps can." },
      { path: 'tanks.modelA.sideGrip', label: 'Traction', min: 0, max: 10, step: 0.1, help: 'How fast sideways sliding fades. Low = drifty, high = grippy.' },
      { path: 'tanks.modelA.mass', label: 'Mass', min: 0.3, max: 4, step: 0.1, help: 'Resistance to bumps. Dummies are Model A too, so this changes them as well.' },
    ],
  },
  {
    title: 'Ice and arena',
    sliders: [
      { path: 'physics.drag', label: 'Drag', min: 0, max: 2, step: 0.01, help: 'How fast tanks slow down on their own (per second).' },
      { path: 'physics.domeStrength', label: 'Dome push', min: 0, max: 6, step: 0.1, help: 'Outward push at the very edge (m/s²). Zero at the centre.' },
      { path: 'physics.domeCurve', label: 'Dome curve', min: 0.5, max: 5, step: 0.1, help: '1 = push grows evenly from the centre. Higher = push mostly near the edge.' },
      { path: 'physics.bumpBounce', label: 'Bump bounce', min: 1, max: 3, step: 0.05, help: '1 = tanks stop dead on contact, 2 = fully bouncy, above 2 = extra punchy.' },
    ],
  },
  {
    title: 'Steering',
    sliders: [
      { path: 'physics.hullTurnRateDeg', label: 'Hull turn rate', min: 90, max: 1440, step: 10, help: 'How fast the hull turns toward your click (degrees per second).' },
      { path: 'physics.turretTurnRateDeg', label: 'Turret turn rate', min: 90, max: 1440, step: 10, help: 'How fast the turret turns toward the closest enemy (degrees per second).' },
      { path: 'rules.clickCooldown', label: 'Click cooldown', min: 0, max: 1, step: 0.05, help: 'At most one click counts per this many seconds.' },
    ],
  },
  {
    title: 'Rules',
    sliders: [
      { path: 'rules.creditWindowSeconds', label: 'Knockout credit window', min: 1, max: 10, step: 0.5, help: 'A fall counts as your knockout if you hit that tank within this many seconds before it went over the edge.' },
    ],
  },
];

const STORAGE_KEY = 'ice-tank-sumo.tuning.v1';

function getAt(obj: unknown, path: string): number {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as number;
}

function setAt(obj: unknown, path: string, value: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as Record<string, number>;
  parent[last] = value;
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1]!.length : 0;
}

function loadSaved(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function save(values: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage unavailable: values still work for this visit.
  }
}

export class TuningPanel {
  readonly element: HTMLElement;
  private readonly inputs = new Map<string, { input: HTMLInputElement; output: HTMLElement; slider: Slider }>();
  private readonly status: HTMLElement;
  private readonly fallback: HTMLTextAreaElement;

  constructor(
    private readonly tuning: Tuning,
    private readonly buildLabel: string,
  ) {
    const el = document.createElement('aside');
    el.id = 'tuning';
    el.innerHTML = `
      <div class="tuning-head">
        <span class="tuning-title">Tuning</span>
        <span class="tuning-hint"><kbd>T</kbd> hide</span>
      </div>
      <div class="tuning-body"></div>
      <div class="tuning-actions">
        <button type="button" data-action="copy" class="primary">Copy values</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="tuning-status" aria-live="polite"></div>
      <textarea class="tuning-fallback" readonly hidden></textarea>
    `;
    const body = el.querySelector('.tuning-body')!;
    this.status = el.querySelector('.tuning-status')!;
    this.fallback = el.querySelector('.tuning-fallback')!;

    const saved = loadSaved();
    for (const group of GROUPS) {
      const section = document.createElement('section');
      section.innerHTML = `<h3>${group.title}</h3>`;
      for (const slider of group.sliders) {
        if (typeof saved[slider.path] === 'number') setAt(this.tuning, slider.path, saved[slider.path]!);
        const row = document.createElement('label');
        row.className = 'tuning-row';
        row.title = slider.help;
        row.innerHTML = `<span class="tuning-label">${slider.label}</span><output></output><input type="range">`;
        const input = row.querySelector('input')!;
        const output = row.querySelector('output')!;
        input.min = String(slider.min);
        input.max = String(slider.max);
        input.step = String(slider.step);
        input.value = String(getAt(this.tuning, slider.path));
        input.addEventListener('input', () => {
          setAt(this.tuning, slider.path, Number(input.value));
          this.refresh(slider.path);
          this.persist();
        });
        // Keep the arrow keys and C/T for the game, not the focused slider.
        input.addEventListener('keydown', (e) => {
          if (e.code === 'KeyC' || e.code === 'KeyT') input.blur();
        });
        section.appendChild(row);
        this.inputs.set(slider.path, { input, output, slider });
        this.refresh(slider.path);
      }
      body.appendChild(section);
    }

    el.querySelector('[data-action="copy"]')!.addEventListener('click', () => void this.copy());
    el.querySelector('[data-action="reset"]')!.addEventListener('click', () => this.reset());
    this.element = el;
  }

  toggle(): void {
    this.element.classList.toggle('collapsed');
  }

  /** Text to paste in the chat. */
  valuesText(): string {
    const lines = [`Ice Tank Sumo tuning values (build ${this.buildLabel})`];
    for (const { slider } of this.inputs.values()) {
      const value = getAt(this.tuning, slider.path);
      const changed = value !== getAt(DEFAULT_TUNING, slider.path);
      lines.push(`${slider.path} = ${value.toFixed(decimals(slider.step))}${changed ? '   (changed)' : ''}`);
    }
    return lines.join('\n');
  }

  private refresh(path: string): void {
    const entry = this.inputs.get(path);
    if (!entry) return;
    const value = getAt(this.tuning, path);
    entry.output.textContent = value.toFixed(decimals(entry.slider.step));
    const changed = value !== getAt(DEFAULT_TUNING, path);
    entry.output.classList.toggle('changed', changed);
  }

  private persist(): void {
    const values: Record<string, number> = {};
    for (const path of this.inputs.keys()) values[path] = getAt(this.tuning, path);
    save(values);
  }

  private async copy(): Promise<void> {
    const text = this.valuesText();
    try {
      await navigator.clipboard.writeText(text);
      this.fallback.hidden = true;
      this.status.textContent = 'Copied. Paste it in the chat.';
    } catch {
      // Clipboard blocked: show the text so it can be copied by hand.
      this.fallback.hidden = false;
      this.fallback.value = text;
      this.fallback.select();
      this.status.textContent = 'Select the text below and copy it.';
    }
  }

  private reset(): void {
    for (const [path, entry] of this.inputs) {
      const value = getAt(DEFAULT_TUNING, path);
      setAt(this.tuning, path, value);
      entry.input.value = String(value);
      this.refresh(path);
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.status.textContent = 'Back to the defaults.';
  }
}
