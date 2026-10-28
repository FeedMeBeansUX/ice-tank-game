# Ice Tank Sumo

A browser game for 2–4 players. Low-poly tanks slide around a circular ice arena and score by knocking each other off the edge. First to 5 knockouts wins.

**Practice (in the browser, nothing to install):** https://feedmebeansux.github.io/ice-tank-game/

## Play multiplayer from this repository

Until the server is put online (milestone 8), the multiplayer server runs on your own computer.

**One-time setup**

1. Install **Node.js** (the "LTS" version) from https://nodejs.org.
2. Get this repository onto your computer: on GitHub, click the green **Code** button → **Download ZIP**, and unzip it. (Or use GitHub Desktop: **Clone**, then **Fetch / Pull** to get updates.)

**Every time you play**

1. Start the server:
   - **Windows:** double-click `start-windows.bat`.
   - **Mac:** double-click `start-mac.command`. If macOS blocks it the first time, right-click it → **Open**.
   - **Or** in a terminal in this folder: `npm install`, then `npm start`.
2. Wait until the window says **"Ice Tank Sumo server is running"**. It shows the addresses to open.
3. Open **http://localhost:8080** in your browser and choose **Join the test room**.
   - **Testing alone:** open a second browser window (or a private window) and join with another name.
   - **Friends on your Wi-Fi:** they open the "Friends on your Wi-Fi" address the window shows (like `http://192.168.1.23:8080`). If Windows asks whether to allow network access for Node.js, choose **Allow** (private networks).
4. Close the window (or press Ctrl+C) to stop the server.

After downloading a newer version, start the server again; it rebuilds the game automatically.

## How the code is organised

| Folder | What's in it |
| --- | --- |
| `shared/` | Game rules, physics and **all tuning values** (`shared/src/tuning.ts`). Used by both the browser and the server, so practice mode and online matches behave the same. |
| `client/` | The browser game: 3D scene (Three.js), input, HUD, practice mode, online mode. Built with Vite. |
| `server/` | The game server: runs the shared simulation and the multiplayer room over a WebSocket (`ws` library), and serves the built game. |

## For developers

```sh
npm install
npm start          # build the game and start the server (http://localhost:8080)
npm run dev        # practice only, with live reload (no server)
npm run typecheck
```

## Milestones

Tracked in the execution plan. Done: 0 (setup), 1 (ice feel), 2 (tanks and combat). Built: 3 (powerups and HUD). Current: **milestone 4 — multiplayer core** on a local server (test room for 2–4 players, first to 5, scoreboard, message box). Server hosting is milestone 8.
