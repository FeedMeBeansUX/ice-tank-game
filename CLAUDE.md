# Ice Tank Sumo: project state for Claude

Read this first. It replaces re-reading the full execution plan at the start of a chat.
Open the plan or requirements docs only when a task touches a decision they own.

- Requirements: https://claude.ai/artifact/CmZs5SrBdhFrWtXm3w6Bm6
- Execution plan: https://claude.ai/artifact/41rU5usCsqtKEqY7A9oNhu (the docs win over this file)
- Live practice build: https://feedmebeansux.github.io/ice-tank-game/ (every push to `main` publishes)

## Current state (update when a milestone or round closes)
- Phase 1 (M0–M4) done 31 Oct 2026. The game as it stands is the baseline: 7 tanks (Agile, Heavy, Stealth, Laser, Shotgun, Artillery, Rocket) in the "Glacier" style, 5 powerups, Sumo and Race, practice and Start game, and a local multiplayer room that lacks the newer tanks, powerups and Race (movement a bit jagged).
- Phase 2 milestones: **M5 tuning cleanup (built 31 Oct, awaiting Robbert's playtest)** → M6 performance → M7 online catch-up (local room) → M8 internet play → M9 friends playtest and polish.
- Online target: ONE shared room on Robbert's PC, reached via a free tunnel (Cloudflare) with a fixed https link. Sumo up to 4, Race up to 6; mode switchable between matches; late joiners drop in at 0; 30 s rejoin keeps score. No session browser, PINs or rented server (future scope).
- Performance target: steady 60 fps in a fixed stress scene; measure before fixing; no visible look changes without Robbert's OK.
- Tuning model (M5, decided 31 Oct 2026):
  - Movement = `common.<name>` in real units × each tank's `tanks.<model>.<name>Pct` (-50…+50, steps of 1). Common units: mass (tonnes, default 30 t), thrust (m/s² at 0% mass and thrust), burst (s), top speed (m/s), traction and drag (% lost per second), hull/turret turn (°/s). Bump and view are ±% too.
  - Weapons: no common value. Each tank has a `weapon` block (`kind`: gun / laser / shell / rocket) with only the values it uses: range (m), shot time, speed, push, push change per metre (%) until a distance, max distance, homing (°/s), etc. Rocket has its own flight values (no longer borrowed from the missile powerup).
  - Every push = speed change (m/s) it gives a 30 t tank (`PUSH_REFERENCE_TONNES`); heavier tanks get proportionally less. Field name is `push` everywhere.
  - Common slider ranges (Robbert, 31 Oct): thrust 20–100 step 1, burst 0.10–0.80 step 0.02, top speed 6–20 step 0.2, drag 0–30 step 0.2, turns 90–900 step 10. Mass range still to decide (now 10–60 t, step 1).
  - Panel: Common, then per tank: This tank (± with the resulting value) / Weapon / Ability, then the other groups.
  - Before/after check: `tsx tools/sim.ts 700 240 out.json [seedBase]` (kills per class) and `tsx tools/ratings.ts` (start-screen ratings). M5 result: ratings identical, kills per class within seed noise.
- No new tanks, powerups or modes in phase 2. Balance is judged by kills per class, not match wins.
- Automatic powerups (31 Oct 2026): each player's own switch, the "Auto" chip after the slots in the in-game bottom bar (`hud.ts`; value in `client/src/settings.ts`, remembered in that browser). `Controls.autoUsePowerups()` sends the same inputs as Q/W/E, so it needs no simulation or server change. Rules: see the requirements doc (Controls, after Mobile mode).

## Code map
- `shared/src/tuning.ts`: ALL tuning values. Pasted slider values become the defaults here.
- `shared/src/world.ts`: the simulation (physics, combat, powerups), run by both browser and server. `arena.ts`, `track.ts` (Race), `dummyBrain.ts` (practice bots), `protocol.ts` (network messages), `properties.ts` (1–10 ratings).
- `server/src/`: `index.ts` (HTTP + WebSocket), `room.ts` (match room).
- `client/src/`: `practice.ts`, `online.ts`, `scene.ts`, `controls.ts` (incl. automatic powerups), `settings.ts` (browser settings), `tuningPanel.ts`, `startView.ts`. Tank art is `<tank>Model.ts`, with study pages `<tank>Preview.ts`/`<tank>Variants.ts` and `client/<tank>.html`. Comparison page: `client/tanks.html`.
- `tools/sim.ts`: headless all-dummy Sumo matches, kills per class. `tools/ratings.ts`: the 1–10 ratings per tank.
- Checks: `npm run typecheck` and `npm run build` (CI runs both).

## Working agreement (short)
Claude writes all code; Robbert playtests and makes the design calls. Explain choices in plain language. Questions are multiple choice with a recommended option. Commit messages in plain English.

## Orchestration (decided 31 Oct 2026)
The main chat orchestrates: it plans, splits the work, reviews what comes back and talks to Robbert. Delegate only when the task is self-contained or produces lots of throwaway output. Keep these in the main chat: multiplayer and networking, cross-cutting architecture, and anything needing a design call.

| Agent | Model | Use for |
| --- | --- | --- |
| `sim-runner` | Haiku | Balance simulations, typecheck/build runs, log reading. Returns a short summary only. |
| `chore` | Haiku | Applying pasted slider values, small exact edits, progress updates in this file and the README. |
| `feature-builder` | Sonnet | One clearly specified feature in a few files (a powerup, a tank, a HUD element). |

When delegating: give the exact files, the acceptance check and the output format. Don't make the agent rediscover context.
One chat per milestone or gameplay round. Long chats are the biggest avoidable cost.
