/**
 * Player settings that live in this browser (not tuning values, not sent to
 * anyone). Remembered between visits when the browser allows it.
 */

const AUTO_POWERUPS_KEY = 'ice-tank-sumo.autoPowerups';

function load(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved === '1' : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // ignore (private mode etc.)
  }
}

export const settings = {
  /** Automatic powerups: picked-up powerups are used for you (abilities stay manual). Off by default. */
  autoPowerups: load(AUTO_POWERUPS_KEY, false),
};

export function setAutoPowerups(on: boolean): void {
  settings.autoPowerups = on;
  save(AUTO_POWERUPS_KEY, on);
}
