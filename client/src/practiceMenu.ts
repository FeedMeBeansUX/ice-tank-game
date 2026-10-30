import { cleanUpgrades, type TankModel, type Tuning, type Upgrades } from '@ice-tank-sumo/shared';
import { applyPropertyClick, pointsLeft, propertyRows } from './propertyBars';

/**
 * Practice setup (P): choose your tank model, spend upgrade points, choose the
 * dummies' model and behaviour, and switch firing on or off. Tank, upgrades and dummies are
 * applied with "Apply" (it puts the tanks back on the ice). Toggles work at once.
 *
 * In real matches the tank and upgrades are chosen in the lobby (milestone 5).
 */

export type DummyChoice = 'modelA' | 'modelB' | 'modelC' | 'modelD' | 'modelE' | 'modelF' | 'modelG' | 'mixed';

export interface PracticeSetup {
  model: TankModel;
  upgrades: Upgrades;
  dummies: DummyChoice;
  /** How many dummy tanks are on the ice (Sumo 0–3, race 0–5). */
  dummyCount: number;
}


export class PracticeMenu {
  readonly element: HTMLElement;
  private draft: PracticeSetup;
  private applied: PracticeSetup;

  constructor(
    private readonly tuning: Tuning,
    initial: PracticeSetup,
    private readonly onApply: (setup: PracticeSetup) => void,
    private readonly onToggle: () => void,
    /** Race mode: up to 5 dummies, and buttons for a new track or a restart. */
    private readonly race: { maxDummies: number; onRace: (action: 'new' | 'same') => void } | null = null,
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


  private render(): void {
    const T = this.tuning;
    const left = pointsLeft(T, this.draft.upgrades);
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
        <div class="seg seg-row2" data-seg="model">${[['modelD', 'Laser'], ['modelE', 'Shotgun']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.model ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg seg-row2" data-seg="model">${[['modelF', 'Artillery'], ['modelG', 'Rocket']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.model ? 'on' : ''}">${l}</button>`).join('')}</div>
        <h3>Upgrades <span class="muted">${left} of ${T.upgrades.points} points left</span></h3>
        ${propertyRows(T, this.draft.model, this.draft.upgrades)}
        <p class="muted small">Blue: the tank's own rating. Gold: upgrade points, ${T.upgrades.percentPerPoint}% each.</p>
        <h3>Dummies <span class="muted">how many, and which tank</span></h3>
        ${seg('dummyCount', String(this.draft.dummyCount), [['0', 'None'], ...Array.from({ length: this.race ? this.race.maxDummies : 3 }, (_, i) => [String(i + 1), String(i + 1)] as [string, string])])}
        ${seg('dummies', this.draft.dummies, [['modelA', 'Agile'], ['modelB', 'Heavy'], ['modelC', 'Stealth']])}
        <div class="seg seg-row2" data-seg="dummies">${[['modelD', 'Laser'], ['modelE', 'Shotgun']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.dummies ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg seg-row2" data-seg="dummies">${[['modelF', 'Artillery'], ['modelG', 'Rocket']].map(([v, l]) => `<button type="button" data-value="${v}" class="${v === this.draft.dummies ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg seg-row2" data-seg="dummies"><button type="button" data-value="mixed" class="${this.draft.dummies === 'mixed' ? 'on' : ''}">Mixed: other tanks</button></div>
        <button type="button" class="apply ${dirty ? 'primary' : ''}" data-action="apply" ${dirty ? '' : 'disabled'}>${this.race ? 'Apply and restart race' : 'Apply and respawn'}</button>
        ${this.race ? `<h3>Race</h3><div class="seg"><button type="button" data-race="new">New track <kbd>Enter</kbd></button><button type="button" data-race="same">Restart <kbd>R</kbd></button></div>` : ''}
        <label class="toggle"><input type="checkbox" data-toggle="dummies.smart" ${T.dummies.smart ? 'checked' : ''}> Dummies try to stay on the ice</label>
        <label class="toggle"><input type="checkbox" data-toggle="arena.shrinkEnabled" ${T.arena.shrinkEnabled ? 'checked' : ''}> Ice shrinks late in a match (Sumo)</label>
        <label class="toggle"><input type="checkbox" data-toggle="dummies.roles" ${T.dummies.roles ? 'checked' : ''}> Dummies play to their class (Sumo)</label>
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
        if (name === 'model') {
          this.draft.model = b.dataset.value as TankModel;
          // Points that don't fit the new tank (a property at its maximum) drop out.
          this.draft.upgrades = cleanUpgrades(this.draft.upgrades, T, this.draft.model);
        }
        if (name === 'dummies') this.draft.dummies = b.dataset.value as DummyChoice;
        if (name === 'dummyCount') this.draft.dummyCount = Number(b.dataset.value);
        this.render();
      }),
    );
    this.element.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) =>
      b.addEventListener('click', () => {
        const next = applyPropertyClick(b, T, this.draft.model, this.draft.upgrades);
        if (!next) return;
        this.draft.upgrades = next;
        this.render();
      }),
    );
    this.element.querySelectorAll<HTMLButtonElement>('[data-race]').forEach((b) =>
      b.addEventListener('click', () => this.race?.onRace(b.dataset.race as 'new' | 'same')),
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
