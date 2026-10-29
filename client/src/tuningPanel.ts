import { DEFAULT_TUNING, type TankModel, type Tuning } from '@ice-tank-sumo/shared';

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

function modelGroup(model: TankModel, title: string, open: boolean, kind: 'gun' | 'laser' | 'artillery' | 'rocket' = 'gun'): Group {
  const p = `tanks.${model}`;
  const all: Slider[] = [
      { path: `${p}.thrustShare`, label: 'Thrust (share of common)', min: 0.2, max: 3, step: 0.01, help: 'Thrust as a share of the common thrust (Ice and arena group).' },
      { path: `${p}.burstSeconds`, label: 'Burst length', min: 0.05, max: 1, step: 0.05, help: 'How long one click keeps pushing (seconds).' },
      { path: `${p}.topSpeedShare`, label: 'Top speed (share of common)', min: 0.3, max: 2, step: 0.05, help: 'Top speed as a share of the common top speed (Ice and arena group).' },
      { path: `${p}.tractionShare`, label: 'Traction (share of common)', min: 0, max: 4, step: 0.05, help: 'Traction as a share of the common traction (Ice and arena group). Low = drifty, high = grippy.' },
      { path: `${p}.massShare`, label: 'Mass (share of common)', min: 0.2, max: 4, step: 0.05, help: 'Mass as a share of the common mass (Ice and arena group). Heavier tanks are pushed less.' },
      { path: `${p}.timeBetweenShots`, label: 'Time between shots', min: 0.1, max: 4, step: 0.05, help: 'Seconds between automatic shots.' },
      { path: `${p}.projectileSpeed`, label: 'Projectile speed', min: 4, max: 40, step: 0.5, help: 'Flight speed of its projectiles (m/s). Constant.' },
      { path: `${p}.projectileImpact`, label: 'Projectile push', min: 0, max: 30, step: 0.5, help: "Push per hit (Rocket: per rocket; Artillery: at the blast centre). The target's speed changes by this divided by its mass." },
      { path: `${p}.recoil`, label: 'Recoil', min: 0, max: 10, step: 0.1, help: 'Push backward on the shooter for each shot.' },
      { path: `${p}.rangeMultiplier`, label: 'Range (share of common)', min: 0.2, max: 2, step: 0.05, help: 'Firing range as a share of the common firing range (Combat group).' },
      { path: `${p}.pellets`, label: 'Pellets per shot', min: 1, max: 15, step: 1, help: 'More than 1 fires a spread of pellets (shotgun).' },
      { path: `${p}.spreadDeg`, label: 'Spread', min: 0, max: 90, step: 1, help: 'Width of the pellet spread (degrees).' },
      { path: `${p}.homing`, label: 'Homing (1 = on)', min: 0, max: 1, step: 1, help: '1 = shots home in on their target, 0 = they fly straight.' },
      { path: `${p}.projectileMaxRange`, label: 'Shot max distance', min: 0, max: 40, step: 0.5, help: 'Shots vanish after this distance (m). 0 = they fly until they leave the arena.' },
      { path: `${p}.laserForce`, label: 'Laser push', min: 0, max: 30, step: 0.5, help: 'Laser turret: steady push per second on the tank the beam is on (divided by its mass). 0 = no laser.' },
      { path: `${p}.minRange`, label: 'Minimum range', min: 0, max: 20, step: 0.5, help: "Artillery ignores tanks closer than this and aims at the next closest (m)." },
      { path: `${p}.blastRadius`, label: 'Shell blast radius', min: 0.5, max: 8, step: 0.1, help: 'Tanks within this distance of where a shell lands are pushed (m). 40% push at the edge.' },
      { path: `${p}.bumpMultiplier`, label: 'Bump strength', min: 0.5, max: 4, step: 0.05, help: 'Bumps from this tank push the other tank this many times harder.' },
  ];
  // Gun tanks get the gun sliders; the Laser tank gets range and laser push;
  // Artillery gets its shell sliders instead of pellets and homing.
  const gun = ['timeBetweenShots', 'projectileSpeed', 'projectileImpact', 'recoil', 'pellets', 'spreadDeg', 'homing', 'projectileMaxRange'];
  const artilleryOnly = ['minRange', 'blastRadius'];
  const hidden =
    kind === 'laser'
      ? [...gun, ...artilleryOnly]
      : kind === 'artillery'
        ? ['laserForce', 'pellets', 'spreadDeg', 'homing', 'projectileMaxRange']
        : kind === 'rocket'
          ? // Rocket flight comes from the missile sliders (Powerups group).
            ['laserForce', 'pellets', 'spreadDeg', 'homing', 'projectileMaxRange', 'projectileSpeed', 'recoil', ...artilleryOnly]
          : ['laserForce', ...artilleryOnly];
  return { title, open, sliders: all.filter((s) => !hidden.some((w) => s.path.endsWith(`.${w}`))) };
}

const GROUPS: Group[] = [
  modelGroup('modelA', 'Agile', true),
  modelGroup('modelB', 'Heavy', false),
  modelGroup('modelC', 'Stealth', false),
  modelGroup('modelD', 'Laser', false, 'laser'),
  modelGroup('modelE', 'Shotgun', false),
  modelGroup('modelF', 'Artillery', false, 'artillery'),
  modelGroup('modelG', 'Rocket', false, 'rocket'),
  {
    title: 'Race',
    open: false,
    sliders: [
      { path: 'race.laps', label: 'Laps', min: 1, max: 10, step: 1, help: 'First tank to drive this many laps wins. Applies to the next race.' },
      { path: 'race.trackLength', label: 'Track length', min: 120, max: 800, step: 10, help: 'Length of one lap along the middle of the track (m). Applies to the next new track.' },
      { path: 'race.trackWidth', label: 'Track width', min: 6, max: 30, step: 0.5, help: 'Width of the track (m). Applies to the next new track.' },
      { path: 'race.dummyClickInterval', label: 'Dummy click interval', min: 0.25, max: 1, step: 0.05, help: 'How often race dummies click (seconds).' },
      { path: 'race.dummyLookAhead', label: 'Dummy look-ahead', min: 4, max: 30, step: 1, help: 'Race dummies click on the middle of the track this far ahead (m), so they anticipate bends.' },
      { path: 'race.leaderPenalty', label: 'Leader penalty', min: 0, max: 0.4, step: 0.01, help: 'The race leader loses this share of top speed and traction (0.1 = 10%).' },
      { path: 'race.lastBonus', label: 'Last place bonus', min: 0, max: 0.4, step: 0.01, help: 'With 4 or more tanks, the last tank gains this share of top speed and traction.' },
      { path: 'race.secondLastBonus', label: 'Second-to-last bonus', min: 0, max: 0.4, step: 0.01, help: 'With 4 or more tanks, second to last gains this share of top speed and traction.' },
      { path: 'race.secondPenalty', label: 'Second place penalty', min: 0, max: 0.4, step: 0.01, help: 'Second place loses this share of top speed and traction (with 3 or more tanks).' },
      { path: 'race.powerupsOnField', label: 'Powerups on the track', min: 0, max: 20, step: 1, help: 'Most powerups on the track at once.' },
      { path: 'race.hazardMineChance', label: 'Hazard mine chance', min: 0, max: 1, step: 0.05, help: 'Share of powerup spawns that are a live mine instead (nobody\'s; it pushes whoever touches it).' },
      { path: 'race.spawnAheadMin', label: 'Spawn ahead of leader (min)', min: 0, max: 200, step: 5, help: 'Powerups and hazard mines appear at least this far ahead of the race leader (m).' },
      { path: 'race.spawnAheadMax', label: 'Spawn ahead of leader (max)', min: 0, max: 300, step: 5, help: 'and at most this far ahead (m).' },
      { path: 'race.hazardMiddleShare', label: 'Hazard mines: middle share', min: 0, max: 1, step: 0.05, help: 'Hazard mines lie within this share of the half-width from the middle of the track.' },
      { path: 'race.pickupEdgeShare', label: 'Pickups: edge share', min: 0, max: 1, step: 0.05, help: 'Pickups lie at least this share of the half-width away from the middle, toward the edges.' },
      { path: 'race.countdownSeconds', label: 'Countdown', min: 0, max: 5, step: 1, help: 'Seconds before the start.' },
    ],
  },
  {
    title: 'Ice and arena',
    open: true,
    sliders: [
      { path: 'arena.radius', label: 'Arena size (radius)', min: 12, max: 60, step: 1, help: 'Radius of the playing field in metres. The camera zoom stays the same.' },
      { path: 'physics.mass', label: 'Mass (all tanks)', min: 0.3, max: 5, step: 0.05, help: 'Common mass: resistance to bumps and hits. Each tank gets its share (tank groups).' },
      { path: 'physics.thrust', label: 'Thrust (all tanks)', min: 4, max: 120, step: 1, help: 'Common thrust: force of the push on each click. Each tank gets its share (tank groups).' },
      { path: 'physics.topSpeed', label: 'Top speed (all tanks)', min: 2, max: 30, step: 0.5, help: "Common top speed (m/s); each tank gets its share (tank groups). Their own thrust can't push them faster; bumps can." },
      { path: 'physics.sideGrip', label: 'Traction (all tanks)', min: 0, max: 10, step: 0.1, help: 'Common traction: how fast sideways sliding fades. Each tank gets its share (tank groups).' },
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
      { path: 'combat.fireAlignDeg', label: 'Fire alignment', min: 0.5, max: 45, step: 0.5, help: 'The turret only fires once it points within this many degrees of its target.' },
      { path: 'combat.homingTurnRateDeg', label: 'Homing turn rate', min: 0, max: 1440, step: 10, help: 'How fast projectiles steer toward their target (degrees per second). High = near-perfect.' },
      { path: 'abilities.boost.seconds', label: 'Boost length (Agile)', min: 0.5, max: 6, step: 0.1, help: 'How long Model A boost lasts.' },
      { path: 'abilities.boost.cooldown', label: 'Boost cooldown (Agile)', min: 1, max: 20, step: 0.5, help: 'Seconds before boost can be used again.' },
      { path: 'abilities.boost.speedMultiplier', label: 'Boost speed (Agile)', min: 1, max: 3, step: 0.05, help: 'Thrust and top speed are multiplied by this while boosting.' },
      { path: 'abilities.powerShot.shots', label: 'Power shots (Heavy)', min: 1, max: 6, step: 1, help: 'How many shots a Model B power shot charges.' },
      { path: 'abilities.powerShot.cooldown', label: 'Power shot cooldown (Heavy)', min: 1, max: 20, step: 0.5, help: 'Seconds before power shot can be used again.' },
      { path: 'abilities.powerShot.impactMultiplier', label: 'Power shot push (Heavy)', min: 1, max: 5, step: 0.1, help: 'Projectile push is multiplied by this for charged shots.' },
      { path: 'abilities.smoke.seconds', label: 'Smoke length (Stealth)', min: 0.5, max: 10, step: 0.5, help: 'How long the Stealth tank stays invisible (any hit ends it early).' },
      { path: 'abilities.emp.radius', label: 'EMP radius (Laser)', min: 1, max: 15, step: 0.5, help: 'Other tanks within this distance are disabled (m).' },
      { path: 'abilities.emp.seconds', label: 'EMP length (Laser)', min: 0.5, max: 8, step: 0.25, help: 'How long hit tanks stay disabled: no steering, pushing, firing, ability or powerups.' },
      { path: 'abilities.emp.cooldown', label: 'EMP cooldown (Laser)', min: 1, max: 30, step: 0.5, help: 'Seconds before EMP can be used again.' },
      { path: 'abilities.grenade.maxThrow', label: 'Grenade throw range (Shotgun)', min: 4, max: 40, step: 0.5, help: 'Farthest a grenade can be thrown (m).' },
      { path: 'abilities.grenade.flightSeconds', label: 'Grenade flight time (Shotgun)', min: 0.2, max: 3, step: 0.05, help: 'Flight time at full range; shorter throws land sooner.' },
      { path: 'abilities.grenade.radius', label: 'Grenade blast radius (Shotgun)', min: 1, max: 12, step: 0.5, help: 'Tanks within this distance of the landing spot are pushed (m).' },
      { path: 'abilities.grenade.impact', label: 'Grenade push (Shotgun)', min: 0, max: 50, step: 0.5, help: 'Push at the blast centre (divided by mass); 40% at the edge.' },
      { path: 'combat.artilleryAimShort', label: 'Artillery aims short by', min: 0, max: 3, step: 0.1, help: 'Shells land this far in front of the target, toward the Artillery (m), so direct hits push it away.' },
      { path: 'abilities.explosiveShells.seconds', label: 'Explosive shells length (Artillery)', min: 1, max: 15, step: 0.5, help: 'How long explosive shells last.' },
      { path: 'abilities.explosiveShells.impactMultiplier', label: 'Explosive shells push (Artillery)', min: 1, max: 4, step: 0.1, help: 'Shell push is multiplied by this.' },
      { path: 'abilities.explosiveShells.radiusMultiplier', label: 'Explosive shells radius (Artillery)', min: 1, max: 4, step: 0.1, help: 'Shell blast radius is multiplied by this.' },
      { path: 'abilities.explosiveShells.cooldown', label: 'Explosive shells cooldown (Artillery)', min: 1, max: 30, step: 0.5, help: 'Seconds before it can be used again.' },
      { path: 'abilities.drone.maxPlace', label: 'Drone placing range (Rocket)', min: 2, max: 30, step: 0.5, help: 'Farthest spot a drone can be placed (m).' },
      { path: 'abilities.drone.seconds', label: 'Drone time (Rocket)', min: 1, max: 20, step: 0.5, help: 'How long a drone stays.' },
      { path: 'abilities.drone.range', label: 'Drone gun range (Rocket)', min: 2, max: 20, step: 0.5, help: 'The drone shoots the closest enemy within this distance (m).' },
      { path: 'abilities.drone.timeBetweenShots', label: 'Drone time between shots (Rocket)', min: 0.05, max: 2, step: 0.05, help: 'Seconds between drone shots.' },
      { path: 'abilities.drone.impact', label: 'Drone shot push (Rocket)', min: 0, max: 10, step: 0.1, help: 'Push per drone hit (divided by mass).' },
      { path: 'abilities.drone.cooldown', label: 'Drone cooldown (Rocket)', min: 1, max: 30, step: 0.5, help: 'Seconds before the next drone (counted from placing it).' },
      { path: 'abilities.grenade.cooldown', label: 'Grenade cooldown (Shotgun)', min: 1, max: 30, step: 0.5, help: 'Seconds before the next grenade.' },
      { path: 'abilities.smoke.cooldown', label: 'Smoke cooldown (Stealth)', min: 1, max: 30, step: 0.5, help: 'Seconds before smoke can be used again.' },
      { path: 'upgrades.percentPerPoint', label: 'Upgrade % per point', min: 0, max: 30, step: 1, help: 'Each upgrade point adds this percentage on top of the base value.' },
    ],
  },
  {
    title: 'Powerups',
    open: false,
    sliders: [
      { path: 'powerups.spawnInterval', label: 'Spawn every', min: 1, max: 30, step: 1, help: 'A new powerup appears this often (seconds).' },
      { path: 'powerups.maxOnField', label: 'Max on the ice', min: 1, max: 8, step: 1, help: 'No new powerup appears while this many are on the ice.' },
      { path: 'missile.minTargetDistance', label: 'Missile min distance', min: 0, max: 25, step: 0.5, help: 'Only tanks at least this far away can be picked as a missile target (m).' },
      { path: 'missile.startSpeed', label: 'Missile start speed', min: 4, max: 30, step: 0.5, help: 'Speed during its first curve toward the target (m/s).' },
      { path: 'missile.curveTurnRateDeg', label: 'Missile first-curve turn', min: 30, max: 720, step: 10, help: 'Turn rate during the first curve (degrees per second).' },
      { path: 'missile.topSpeed', label: 'Missile top speed', min: 6, max: 50, step: 0.5, help: 'Speed it reaches after the first curve (m/s).' },
      { path: 'missile.boostTurnRateDeg', label: 'Missile late turn', min: 5, max: 360, step: 5, help: 'Turn rate after the first curve. Lower = easier to dodge.' },
      { path: 'missile.impact', label: 'Missile push', min: 0, max: 40, step: 0.5, help: 'Push on a hit (divided by the target mass).' },
      { path: 'rapidFire.seconds', label: 'Rapid fire length', min: 1, max: 15, step: 0.5, help: 'How long rapid fire lasts once used (seconds).' },
      { path: 'rapidFire.shotTimeMultiplier', label: 'Rapid fire shot time', min: 0.1, max: 1, step: 0.05, help: 'Time between shots is multiplied by this during rapid fire (0.5 = half).' },
      { path: 'rapidFire.laserMultiplier', label: 'Laser boost', min: 1, max: 5, step: 0.1, help: 'Laser with rapid fire: it pushes this many times harder.' },
      { path: 'mine.triggerRange', label: 'Mine trigger range', min: 0.2, max: 4, step: 0.1, help: "A live mine goes off when a tank's centre comes this close (m). 1 = you have to drive over it." },
      { path: 'mine.armSeconds', label: 'Mine arm delay', min: 0, max: 5, step: 0.1, help: 'Seconds before a dropped mine goes live.' },
      { path: 'mine.blastRadius', label: 'Mine blast radius', min: 1, max: 15, step: 0.5, help: 'Tanks within this distance of the blast are pushed (m).' },
      { path: 'mine.impact', label: 'Mine push', min: 0, max: 40, step: 0.5, help: 'Push at the blast centre (divided by mass); 40% of this at the edge.' },
    ],
  },
  {
    title: 'Dummies',
    open: true,
    sliders: [
      { path: 'dummies.skill', label: 'Dummy skill', min: 0, max: 1, step: 0.05, help: '0 = never try to save themselves, 1 = react perfectly. Low skill hesitates and clicks less accurately.' },
      { path: 'dummies.clickInterval', label: 'Dummy click interval', min: 0.1, max: 2, step: 0.05, help: 'At most one simulated click per this many seconds.' },
      { path: 'dummies.safeZone', label: 'Dummy safe zone', min: 0.2, max: 0.95, step: 0.05, help: 'Share of the arena radius where dummies feel safe and stop correcting.' },
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

/**
 * Saved per browser: only values that differ from the defaults, together with
 * the default they replaced. When a default changes in the code (for example
 * after pasted values become the new defaults), the new default wins.
 */
const STORAGE_KEY = 'ice-tank-sumo.tuning.v2';

type Saved = Record<string, { value: number; base: number }>;

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

function loadSaved(): Saved {
  try {
    localStorage.removeItem('ice-tank-sumo.tuning.v1');
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
}

function save(values: Saved): void {
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
        const stored = saved[slider.path];
        if (stored && stored.base === getAt(DEFAULT_TUNING, slider.path)) setAt(this.tuning, slider.path, stored.value);
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

  /** Text to paste in the chat: only the values that differ from the defaults. */
  valuesText(): string {
    const lines = [`Ice Tank Sumo tuning changes (build ${this.buildLabel})`];
    for (const { slider } of this.inputs.values()) {
      const value = getAt(this.tuning, slider.path);
      const base = getAt(DEFAULT_TUNING, slider.path);
      if (value === base) continue;
      const d = decimals(slider.step);
      lines.push(`${slider.path} = ${value.toFixed(d)}   (default ${base.toFixed(d)})`);
    }
    if (lines.length === 1) lines.push('No changes from the defaults.');
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
    const values: Saved = {};
    for (const path of this.inputs.keys()) {
      const value = getAt(this.tuning, path);
      const base = getAt(DEFAULT_TUNING, path);
      if (value !== base) values[path] = { value, base };
    }
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
