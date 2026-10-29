import type { TankModel, Tuning, Upgrades } from '@ice-tank-sumo/shared';

/**
 * Practice setup (P): choose your tank model, spend upgrade points, choose the
 * dummies' model and behaviour, and switch firing on or off. Tank, upgrades and dummies are
 * applied with "Apply" (it puts the tanks back on the ice). Toggles work at once.
 *
 * In real matches the tank and upgrades are chosen in the lobby (milestone 5).
 */

export type DummyChoice = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'modelE' | 'mixed';

export interface PracticeSetup {
  model: TankModel;
  upgrades: Upgrades;
  dummies: DummyChoice;
}

const ATTRIBUTES: { key: keyof Upgrades; label: string; help: string }[] = [
  { key: 'firepower', label: 'Firepower', help: 'Heavier projectiles that push harder' },
  { key: 'speed', label: 'Speed', help: 'More thrust and a higher top speed' },
  { key: 'traction', label: 'Traction', help: 'More grip and faster recovery from sideways sliding' },
];

export class PracticeMenu {
  readonly element: HTMLElement;
  private draft: PracticeSetup;
  private applied: PracticeSetup;

  constructor(
    private readonly tuning: Tuning,
    initial: PracticeSetup,
    private readonly onApply: (setup: PracticeSetup) => void,
    private readonly onToggle: () => void,
  ) {
    this.draft = structuredClone(initial);
    this.applied = structuredClone(initial);
    const el = document.createElement('aside');
    el.id = 'practice';
    this.element = el;
    this.render();
  }

  toggle(): void {
    this.element.classList.toggle('collapsed');
  }

  /** Re-draw (e.g. after F toggled firing from the keyboard). */
  refresh(): void {
    this.render();
  }

  private pointsUsed(): number {
    const u = this.draft.upgrades;
    return u.firepower + u.speed + u.traction;
  }

  private render(): void {
    const T = this.tuning;
    const left = T.upgrades.points - this.pointsUsed();
    const dirty = JSON.stringify(this.draft) !== JSON.stringify(this.applied);
    const seg = (name: string, value: string, options: [string, string][]) =>
      `<div class="seg" data-seg="${name}">${options
        .map(([v, label]) => `<button type="button" data-value="${v}" class="${v === value ? 'on' : ''}">${label}</button>`)
        .join('')}</div>`;

    this.element.innerHTML = `
      <div class="panel-head">
        <span class="panel-title">Practice setup</span>
        <span class="panel-hint"><kbd>P</kbd> hide</span>
      </div>
      <div class="panel-body">
        <h3>Your tank</h3>
        ${seg('model', this.draft.model, [['modelA', 'Agile'], ['modelB', 'Heavy'], ['modelC', 'Stealth']])}
        <div class="seg seg-row2" data-seg="model">${[['modelD', 'Bash'], ['modelE', 'Shotgun']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.model ? 'on' : ''}">${l}</button>`).join('')}</div>
        <h3>Upgrades <span class="muted">${left} of ${T.upgrades.points} points left</span></h3>
        ${ATTRIBUTES.map(({ key, label, help }) => {
          const v = this.draft.upgrades[key];
          const dots = Array.from({ length: T.upgrades.maxPerAttribute }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
          return `<div class="upgrade" title="${help}">
            <span>${label}</span>
            <button type="button" data-up="${key}" data-delta="-1" ${v <= 0 ? 'disabled' : ''}>−</button>
            <span class="dots">${dots}</span>
            <button type="button" data-up="${key}" data-delta="1" ${v >= T.upgrades.maxPerAttribute || left <= 0 ? 'disabled' : ''}>+</button>
          </div>`;
        }).join('')}
        <p class="muted small">Each point adds ${T.upgrades.percentPerPoint}% on top of the model's base value.</p>
        <h3>Dummies</h3>
        ${seg('dummies', this.draft.dummies, [['modelA', 'Agile'], ['modelB', 'Heavy'], ['modelC', 'Stealth']])}
        <div class="seg seg-row2" data-seg="dummies">${[['modelD', 'Bash'], ['modelE', 'Shotgun']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.dummies ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg seg-row2" data-seg="dummies"><button type="button" data-value="mixed" class="${this.draft.dummies === 'mixed' ? 'on' : ''}">Mixed: other tanks</button></div>
        <button type="button" class="apply ${dirty ? 'primary' : ''}" data-action="apply" ${dirty ? '' : 'disabled'}>Apply and respawn</button>
        <label class="toggle"><input type="checkbox" data-toggle="dummies.smart" ${T.dummies.smart ? 'checked' : ''}> Dummies try to stay on the ice</label>
        <h3>Firing</h3>
        <label class="toggle"><input type="checkbox" data-toggle="combat.firingEnabled" ${T.combat.firingEnabled ? 'checked' : ''}> Tanks fire projectiles <kbd>F</kbd></label>
        <label class="toggle"><input type="checkbox" data-toggle="combat.dummiesFire" ${T.combat.dummiesFire ? 'checked' : ''}> Dummies fire back (shots, missiles, mines)</label>
        <h3>Powerups</h3>
        <label class="toggle"><input type="checkbox" data-toggle="powerups.enabled" ${T.powerups.enabled ? 'checked' : ''}> Powerups appear on the ice</label>
      </div>
    `;

    this.element.querySelectorAll<HTMLElement>('[data-seg] button').forEach((b) =>
      b.addEventListener('click', () => {
        const name = b.parentElement!.dataset.seg!;
        if (name === 'model') this.draft.model = b.dataset.value as TankModel;
        if (name === 'dummies') this.draft.dummies = b.dataset.value as DummyChoice;
        this.render();
      }),
    );
    this.element.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) =>
      b.addEventListener('click', () => {
        const key = b.dataset.up as keyof Upgrades;
        const next = this.draft.upgrades[key] + Number(b.dataset.delta);
        if (next < 0 || next > T.upgrades.maxPerAttribute) return;
        if (Number(b.dataset.delta) > 0 && this.pointsUsed() >= T.upgrades.points) return;
        this.draft.upgrades[key] = next;
        this.render();
      }),
    );
    this.element.querySelector('[data-action="apply"]')!.addEventListener('click', () => {
      this.applied = structuredClone(this.draft);
      this.onApply(structuredClone(this.draft));
      this.render();
    });
    this.element.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach((input) =>
      input.addEventListener('change', () => {
        const [group, key] = input.dataset.toggle!.split('.') as [string, string];
        (T as unknown as Record<string, Record<string, boolean>>)[group]![key] = input.checked;
        this.onToggle();
        this.render();
      }),
    );
    // Buttons shouldn't keep keyboard focus (Space/keys belong to the game).
    this.element.querySelectorAll('button, input').forEach((b) => b.addEventListener('mouseup', () => (b as HTMLElement).blur()));
  }
}
