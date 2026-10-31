/**
 * Headless Sumo simulation: all-dummy matches with the real game code.
 * Judges balance by knockouts (kills) per tank class.
 *
 *   tsx tools/sim.ts [matches=140] [seconds=240] [out.json]
 *
 * Each match puts 4 different classes on the ice (rotating through all
 * combinations), so every class meets every other class equally often.
 * Also prints a short position trace of the first match, to compare two
 * versions of the code step for step.
 */
import { writeFileSync } from 'node:fs';
import { World, DummyBrain, createTuning, type TankModel } from '../shared/src/index';

const MODELS: TankModel[] = ['modelA', 'modelB', 'modelC', 'modelD', 'modelE', 'modelF', 'modelG'];
const NAMES: Record<TankModel, string> = { modelA: 'Agile', modelB: 'Heavy', modelC: 'Stealth', modelD: 'Laser', modelE: 'Shotgun', modelF: 'Artillery', modelG: 'Rocket' };

const matches = Number(process.argv[2] ?? 140);
const seconds = Number(process.argv[3] ?? 240);
const out = process.argv[4];
const seedBase = Number(process.argv[5] ?? 1000);

// All 35 combinations of 4 classes out of 7.
const combos: TankModel[][] = [];
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++) for (let d = c + 1; d < 7; d++) combos.push([MODELS[a]!, MODELS[b]!, MODELS[c]!, MODELS[d]!]);

const kills: Record<string, number> = {};
const deaths: Record<string, number> = {};
const played: Record<string, number> = {};
for (const m of MODELS) kills[m] = deaths[m] = played[m] = 0;
const trace: number[] = [];

for (let i = 0; i < matches; i++) {
  const tuning = createTuning();
  tuning.rules.pointsToWin = 999;
  const world = new World(tuning, seedBase + i);
  const lineup = combos[i % combos.length]!;
  lineup.forEach((model, k) => {
    const a = (k / lineup.length) * Math.PI * 2 + i;
    world.addTank({ name: NAMES[model], model, isDummy: true, x: Math.cos(a) * 9, z: Math.sin(a) * 9 });
    played[model]!++;
  });
  const brain = new DummyBrain({ freeForAll: true });
  const steps = seconds * tuning.simulation.stepsPerSecond;
  for (let s = 0; s < steps; s++) {
    brain.update(world);
    world.step();
    world.takeEvents();
    if (i === 0 && s % 60 === 0 && s <= 60 * 30) for (const t of world.tanks) trace.push(Math.round(t.x * 1e4) / 1e4, Math.round(t.z * 1e4) / 1e4);
  }
  for (const t of world.tanks) {
    kills[t.model]! += t.knockouts;
    deaths[t.model]! += t.eliminations;
  }
}

const rows = MODELS.map((m) => ({ class: NAMES[m], kills: kills[m]!, deaths: deaths[m]!, killsPerMatch: +(kills[m]! / played[m]!).toFixed(2) }));
console.table(rows);
if (out) writeFileSync(out, JSON.stringify({ rows, trace }, null, 1));
