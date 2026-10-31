/** Prints each tank's 1–10 property ratings (start screen), to compare versions. */
import { DEFAULT_TUNING, baseRatings, type TankModel } from '../shared/src/index';
const out: Record<string, unknown> = {};
for (const m of Object.keys(DEFAULT_TUNING.tanks) as TankModel[]) out[m] = baseRatings(DEFAULT_TUNING, m);
console.log(JSON.stringify(out));
