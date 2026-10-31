# Ice Tank Sumo: project state for Claude

Read this first. It replaces re-reading the full execution plan at the start of a chat.
Open the plan or requirements docs only when a task touches a decision they own.

- Requirements: https://claude.ai/artifact/CmZs5SrBdhFrWtXm3w6Bm6
- Execution plan: https://claude.ai/artifact/41rU5usCsqtKEqY7A9oNhu (the docs win over this file)
- Live practice build: https://feedmebeansux.github.io/ice-tank-game/ (every push to `main` publishes)

## Current state (update when a milestone or round closes)
- Done: M0 setup, M1 ice feel, M2 tanks and combat. Built, awaiting Robbert's OK: M3 powerups/HUD, M4 multiplayer core (local server; online movement a bit jagged, parked).
- Now: gameplay rounds in practice mode. Seven tanks (Heavy, Agile, Stealth, Laser, Shotgun, Artillery, Rocket), all in the "Glacier" art style. Two modes: Sumo and Race (Race is practice only).
- Next: the multiplayer catch-up brings everything online (incl. online Race, up to 6 players), then M5 lobby.
- Balance is judged by kills per class, not match wins.

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
