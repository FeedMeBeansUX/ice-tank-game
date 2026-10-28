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
  open: boolean;
  sliders: Slider[];
}

function modelGroup(model: 'modelA' | 'modelB', title: string, open: boolean): Group {
  const p = `tanks.${model}`;
  return {
    title,
    open,
    sliders: [
      { path: `${p}.thrust`, label: 'Thrust', min: 4, max: 120, step: 1, help: 'Force of the push you get on each click.' },
      { path: `${p}.burstSeconds`, label: 'Burst length', min: 0.05, max: 1, step: 0.05, help: 'How long one click keeps pushing (seconds).' },
      { path: `${p}.topSpeed`, label: 'Top speed', min: 2, max: 30, step: 0.5, help: "The tank's own thrust can't push it faster than this (m/s). Bumps can." },
      { path: `${p}.sideGrip`, label: 'Traction', min: 0, max: 10, step: 0.1, help: 'How fast sideways sliding fades. Low = drifty, high = grippy.' },
      { path: `${p}.mass`, label: 'Mass', min: 0.3, max: 5, step: 0.1, help: 'Resistance to bumps and hits. Heavier tanks are pushed less.' },
      { path: `${p}.timeBetweenShots`, label: 'Time between shots', min: 0.1, max: 4, step: 0.05, help: 'Seconds between automatic shots.' },
      { path: `${p}.projectileSpeed`, label: 'Projectile speed', min: 4, max: 40, step: 0.5, help: 'Flight speed of its projectiles (m/s). Constant.' },
      { path: `${p}.projectileImpact`, label: 'Projectile push', min: 0, max: 30, step: 0.5, help: "Push per hit. The target's speed changes by this divided by its mass." },
      { path: `${p}.recoil`, label: 'Recoil', min: 0, max: 10, step: 0.1, help: 'Push backward on the shooter for each shot.' },
    ],
  };
}

const GROUPS: Group[] = [
  modelGroup('modelA', 'Model A · agile', true),
  modelGroup('modelB', 'Model B · heavy', false),
  {
    title: 'Ice and arena',
    open: true,
    sliders: [
      { path: 'arena.radius', label: 'Arena size (radius)', min: 12, max: 60, step: 1, help: 'Radius of the playing field in metres. The camera zoom stays the same.' },
      { path: 'physics.drag', label: 'Drag', min: 0, max: 2, step: 0.01, help: 'How fast tanks slow down on their own (per second).' },
      { path: 'physics.domeStrength', label: 'Dome push', min: 0, max: 6, step: 0.1, help: 'Outward push at the very edge (m/s²). Zero at the centre.' },
      { path: 'physics.domeCurve', label: 'Dome curve', min: 0.5, max: 5, step: 0.1, help: '1 = push grows evenly from the centre. Higher = push mostly near the edge.' },
      { path: 'physics.bumpBounce', label: 'Bump bounce', min: 1, max: 3, step: 0.05, help: '1 = tanks stop dead on contact, 2 = fully bouncy, above 2 = extra punchy.' },
    ],
  },
  {
    title: 'Combat',
    open: false,
    sliders: [
      { path: 'combat.rangeMetres', label: 'Firing range', min: 4, max: 40, step: 0.5, help: 'Tanks only fire when the closest enemy is within this distance (m).' },
      { path: 'combat.homingTurnRateDeg', label: 'Homing turn rate', min: 0, max: 1440, step: 10, help: 'How fast projectiles steer toward their target (degrees per second). High = near-perfect.' },
      { path: 'abilities.boost.seconds', label: 'Boost length (A)', min: 0.5, max: 6, step: 0.1, help: 'How long Model A boost lasts.' },
      { path: 'abilities.boost.cooldown', label: 'Boost cooldown (A)', min: 1, max: 20, step: 0.5, help: 'Seconds before boost can be used again.' },
      { path: 'abilities.boost.speedMultiplier', label: 'Boost speed (A)', min: 1, max: 3, step: 0.05, help: 'Thrust and top speed are multiplied by this while boosting.' },
      { path: 'abilities.powerShot.shots', label: 'Power shots (B)', min: 1, max: 6, step: 1, help: 'How many shots a Model B power shot charges.' },
      { path: 'abilities.powerShot.cooldown', label: 'Power shot cooldown (B)', min: 1, max: 20, step: 0.5, help: 'Seconds before power shot can be used again.' },
      { path: 'abilities.powerShot.impactMultiplier', label: 'Power shot push (B)', min: 1, max: 5, step: 0.1, help: 'Projectile push is multiplied by this for charged shots.' },
      { path: 'upgrades.percentPerPoint', label: 'Upgrade % per point', min: 0, max: 30, step: 1, help: 'Each upgrade point adds this percentage on top of the base value.' },
    ],
  },
  {
    title: 'Steering',
    open: false,
    sliders: [
      { path: 'physics.hullTurnRateDeg', label: 'Hull turn rate', min: 90, max: 1440, step: 10, help: 'How fast the hull turns toward your click (degrees per second).' },
      { path: 'physics.turretTurnRateDeg', label: 'Turret turn rate', min: 90, max: 1440, step: 10, help: 'How fast the turret turns toward the closest enemy (degrees per second).' },
      { path: 'rules.clickCooldown', label: 'Click cooldown', min: 0, max: 1, step: 0.05, help: 'At most one click counts per this many seconds.' },
    ],
  },
  {
    title: 'Rules',
    open: false,
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
    private readonly onChange: (path: string) => void = () => {},
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
      const section = document.createElement('details');
      section.open = group.open;
      section.innerHTML = `<summary>${group.title}</summary>`;
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
          this.onChange(slider.path);
        });
        // Keep the arrow keys and C/T for the game, not the focused slider.
        input.addEventListener('keydown', (e) => {
          if (['KeyC', 'KeyT', 'KeyP', 'KeyF', 'ShiftLeft', 'ShiftRight'].includes(e.code)) input.blur();
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
      this.onChange(path);
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.status.textContent = 'Back to the defaults.';
  }
}
