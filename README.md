# Ice Tank Sumo

A browser game for 2–4 players. Low-poly tanks slide around a circular ice arena and score by knocking each other off the edge. First to 5 knockouts wins.

**Play the latest build:** https://feedmebeansux.github.io/ice-tank-game/ (published automatically on every push to `main`).

## How the code is organised

| Folder | What's in it |
| --- | --- |
| `shared/` | Game rules, physics and **all tuning values** (`shared/src/tuning.ts`). Used by both the browser and the server, so practice mode and online matches behave the same. |
| `client/` | The browser game: 3D scene (Three.js), input, HUD, practice mode. Built with Vite. |
| `server/` | The Colyseus game server. Placeholder until milestone 4. |

## Running it locally

Needs Node 22 or newer.

```sh
npm install
npm run dev        # opens a local dev server with live reload
npm run build      # production build into client/dist
npm run typecheck
```

## Milestones

Tracked in the execution plan. Done: milestones 0 (setup) and 1 (ice feel). Current: **milestone 2 — tanks and combat** (Model B, automatic homing fire, recoil, abilities, upgrades, practice menu).
