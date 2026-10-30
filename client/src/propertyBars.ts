import { MAX_RATING, PROPERTIES, baseRatings, upgradeRoom, type TankModel, type Tuning, type Upgrades } from '@ice-tank-sumo/shared';

/**
 * The five property rows (start screen panel and practice menu): a bar of
 * MAX_RATING blips per property, blue for the tank's own rating, gold for the
 * upgrade points put into it, with − and + buttons around it.
 */

export function pointsLeft(tuning: Tuning, upgrades: Upgrades): number {
  return tuning.upgrades.points - PROPERTIES.reduce((n, p) => n + upgrades[p.key], 0);
}

export function propertyRows(tuning: Tuning, model: TankModel, upgrades: Upgrades): string {
  const base = baseRatings(tuning, model);
  const left = pointsLeft(tuning, upgrades);
  return PROPERTIES.map((p) => {
    const b = base[p.key];
    const up = upgrades[p.key];
    const total = b + up;
    const blips = Array.from({ length: MAX_RATING }, (_, i) => `<i class="${i < b ? 'on' : i < total ? 'up' : ''}"></i>`).join('');
    const canAdd = left > 0 && up < upgradeRoom(tuning, model, p.key);
    return `<div class="prop-row" title="${p.help} Upgrade: ${p.upgrade}.">
      <span class="prop-label">${p.label}</span>
      <button type="button" data-up="${p.key}" data-delta="-1" ${up <= 0 ? 'disabled' : ''} aria-label="Remove a point from ${p.label}">−</button>
      <span class="prop-bar" aria-label="${p.label} ${total} of ${MAX_RATING}">${blips}</span>
      <button type="button" data-up="${p.key}" data-delta="1" ${canAdd ? '' : 'disabled'} aria-label="Add a point to ${p.label}">+</button>
    </div>`;
  }).join('');
}

/** Handle a click on a − or + button inside the rows. Returns the new upgrades, or null when nothing changed. */
export function applyPropertyClick(target: EventTarget | null, tuning: Tuning, model: TankModel, upgrades: Upgrades): Upgrades | null {
  const b = (target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-up]');
  if (!b || b.disabled) return null;
  const key = b.dataset.up as keyof Upgrades;
  const next = upgrades[key] + Number(b.dataset.delta);
  if (next < 0 || next > upgradeRoom(tuning, model, key)) return null;
  if (Number(b.dataset.delta) > 0 && pointsLeft(tuning, upgrades) <= 0) return null;
  return { ...upgrades, [key]: next };
}
