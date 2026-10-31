# Ice Tank Sumo: project state for Claude

Read this first. It replaces re-reading the full execution plan at the start of a chat.
Open the plan or requirements docs only when a task touches a decision they own.

- Requirements: https://claude.ai/artifact/CmZs5SrBdhFrWtXm3w6Bm6
- Execution plan: https://claude.ai/artifact/41rU5usCsqtKEqY7A9oNhu (the docs win over this file)
- Live practice build: https://feedmebeansux.github.io/ice-tank-game/ (every push to `main` publishes)

## Current state (update when a milestone or round closes)
- Phase 1 (M0–M4) done 31 Oct 2026. The game as it stands is the baseline: 7 tanks (Agile, Heavy, Stealth, Laser, Shotgun, Artillery, Rocket) in the "Glacier" style, 5 powerups, Sumo and Race, practice and Start game, and a local multiplayer room that lacks the newer tanks, powerups and Race (movement a bit jagged).
- Phase 2 milestones: **M5 tuning cleanup (next)** → M6 performance → M7 online catch-up (local room) → M8 internet play → M9 friends playtest and polish.
- Online target: ONE shared room on Robbert's PC, reached via a free tunnel (Cloudflare) with a fixed https link. Sumo up to 4, Race up to 6; mode switchable between matches; late joiners drop in at 0; 30 s rejoin keeps score. No session browser, PINs or rented server (future scope).
- Performance target: steady 60 fps in a fixed stress scene; measure before fixing; no visible look changes without Robbert's OK.
- Tuning target: every shared tank property = common value × share, one naming pattern, unused per-tank values removed, panel grouped (Common / This tank / Weapon / Ability). Feel must stay identical (verify with a before/after sim).
- No new tanks, powerups or modes in phase 2. Balance is judged by kills per class, not match wins.

## Code map
- `shared/src/tuning.ts`: ALL tuning values. Pasted slider values become the defaults here.
- `shared/src/world.ts`: the simulation (physics, combat, powerups), run by both browser and server. `arena.ts`, `track.ts` (Race), `dummyBrain.ts` (practice bots), `protocol.ts` (network messages), `properties.ts` (1–10 ratings).
- `server/src/`: `index.ts` (HTTP + WebSocket), `room.ts` (match room).
- `client/src/`: `practice.ts`, `online.ts`, `scene.ts`, `controls.ts`, `tuningPanel.ts`, `startView.ts`. Tank art is `<tank>Model.ts`, with study pages `<tank>Preview.ts`/`<tank>Variants.ts` and `client/<tank>.html`. Comparison page: `client/tanks.html`.
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
