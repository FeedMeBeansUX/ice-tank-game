import * as THREE from 'three';
import {
  SOCKET_PATH,
  World,
  angleDelta,
  type ClientMessage,
  type ServerMessage,
  type StateMessage,
  type TankModel,
  type TankState,
  type Tuning,
} from '@ice-tank-sumo/shared';
import { Controls } from './controls';
import { Hud } from './hud';
import { GameScene } from './scene';
import { MODEL_LETTERS, PLAYER_COLORS } from './tankView';

/**
 * Online test room (milestone 4). The server runs the game; this browser
 * sends clicks and keys, and draws what the server reports. Other tanks are
 * drawn slightly in the past (0.1 s), blending between server updates so they
 * glide instead of jumping. Your click ring shows at once.
 */
export function startOnline(canvas: HTMLCanvasElement, name: string, model: TankModel, onFail: (text: string) => void): void {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${SOCKET_PATH}`;
  const socket = new WebSocket(url);
  const send = (msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };

  let playerId: number | null = null;
  let tuning: Tuning | null = null;
  let pointsToWin = 5;
  let started = false;
  const buffer: { msg: StateMessage; recv: number }[] = [];
  /** Recent (local arrival time − server time) values. The lowest is our best clock estimate. */
  const offsets: number[] = [];
  /** The clock offset actually used for drawing: follows the estimate gently, so time never jumps. */
  let clockOffset: number | null = null;
  // Network stats for the diagnostics panel (N).
  let updatesThisSecond = 0;
  let updatesPerSecond = 0;
  let lateFrames = 0;
  const pendingMessages: string[] = [];

  let scene: GameScene | null = null;
  let hud: Hud | null = null;
  let controls: Controls | null = null;
  let mirror: World | null = null;

  const latest = () => buffer[buffer.length - 1]?.msg ?? null;
  const me = () => latest()?.players.find((p) => p.id === playerId) ?? null;
  const colorForTank = (tankId: number) => latest()?.players.find((p) => p.tankId === tankId)?.color ?? PLAYER_COLORS[0]!;
  const nameForTank = (tankId: number) => latest()?.players.find((p) => p.tankId === tankId)?.name ?? '?';
  const ownTank = (): TankState | null => {
    const p = me();
    return p && p.tankId !== null && mirror ? (mirror.tanks[p.tankId] ?? null) : null;
  };

  socket.addEventListener('open', () => send({ type: 'join', name, model }));
  socket.addEventListener('close', () => {
    if (!started) onFail('Could not reach the game server. Is it running? (See the README: "npm start".)');
    else hud?.setBanner('Disconnected from the server. Reload the page to join again.', false);
  });
  socket.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data)) as ServerMessage;
    if (msg.type === 'welcome') {
      playerId = msg.playerId;
      tuning = msg.tuning;
      pointsToWin = msg.pointsToWin;
      begin();
    } else if (msg.type === 'error') {
      if (!started) onFail(msg.text);
      else hud?.message(msg.text);
    } else if (msg.type === 'message') {
      if (hud) hud.message(msg.text);
      else pendingMessages.push(msg.text);
    } else if (msg.type === 'state') {
      const now = performance.now() / 1000;
      // A new match restarts the server's tank list: forget the old states.
      const prev = latest();
      if (prev && (msg.tanks.length < prev.tanks.length || (prev.phase !== 'countdown' && msg.phase === 'countdown'))) buffer.length = 0;
      buffer.push({ msg, recv: now });
      updatesThisSecond++;
      while (buffer.length > 40) buffer.shift();
      offsets.push(now - msg.time);
      while (offsets.length > 60) offsets.shift();
      if (scene && mirror) scene.effects(msg.events, me()?.tankId ?? null, msg.tanks);
    }
  });

  function begin(): void {
    if (!tuning) return;
    started = true;
    const T = tuning;
    mirror = new World(T);
    // Handy for automated checks in the browser console.
    (window as unknown as { __online: unknown }).__online = { mirror, view: () => scene?.view };
    scene = new GameScene(canvas, T, (t) => colorForTank(t.id), colorForTank);
    hud = new Hud((tankId) => controls?.fireMissileAt(tankId));
    hud.setMode(
      'milestone 4 · online test room',
      `<div class="hud-help"><span><kbd>Click</kbd> turn and push</span><span><kbd>Shift</kbd> ability</span><span><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> powerups</span><span><kbd>C</kbd> overview</span><span><kbd>N</kbd> diagnostics</span></div>`,
    );
    hud.setStats('');
    for (const text of pendingMessages) hud.message(text);
    controls = new Controls(canvas, scene, () => mirror!, ownTank, (input) => send({ type: 'input', input }), {
      instantClickMarker: true,
      enabled: () => latest()?.phase === 'playing' || latest()?.phase === 'waiting',
    });

    const timer = new THREE.Timer();
    let snapped = false;
    let fpsFrames = 0;
    let fps = 0;
    let worstFrame = 0;
    let worstFrameShown = 0;
    let statsClock = 0;
    let statsStart = 0;
    let skip = 0;
    const diag = document.getElementById('diagnostics')!;
    let showDiag = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' && !e.repeat) {
        showDiag = !showDiag;
        diag.hidden = !showDiag;
      }
    });
    let autoOverview = false;
    scene.renderer.setAnimationLoop((timestamp: number) => {
      // A game window without focus (e.g. your second test window) draws at
      // about 15 frames a second, leaving the graphics card to the one you play in.
      if (!document.hasFocus() && skip++ % 4 !== 0) return;
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.25);
      const time = timer.getElapsed();
      const state = latest();
      if (!state || !scene || !hud || !mirror || !controls) return;

      // Frame and update stats, once a second.
      fpsFrames++;
      worstFrame = Math.max(worstFrame, timer.getDelta());
      const wall = performance.now() / 1000;
      if (statsStart === 0) statsStart = wall;
      statsClock = wall - statsStart;
      if (statsClock >= 1) {
        statsStart = wall;
        fps = fpsFrames / statsClock;
        updatesPerSecond = updatesThisSecond / statsClock;
        worstFrameShown = worstFrame;
        fpsFrames = 0;
        updatesThisSecond = 0;
        worstFrame = 0;
        if (showDiag) {
          diag.textContent =
            `${fps.toFixed(0)} fps (slowest frame ${(worstFrameShown * 1000).toFixed(0)} ms) · ` +
            `${updatesPerSecond.toFixed(0)} server updates/s · drawn ${(T.simulation.interpolationDelay * 1000).toFixed(0)} ms behind · ` +
            `frames that ran out of updates: ${lateFrames}${document.hasFocus() ? '' : ' · window not focused (drawing slower)'}`;
        }
      }

      // Clock: follow the best estimate gently (at most 1 ms per frame), so
      // the drawing time never jumps; snap if far off (e.g. after a hidden tab).
      const target = Math.min(...offsets);
      if (clockOffset === null || Math.abs(target - clockOffset) > 0.25) clockOffset = target;
      else clockOffset += Math.max(-0.001, Math.min(0.001, target - clockOffset));
      const drawTime = performance.now() / 1000 - clockOffset - T.simulation.interpolationDelay;
      if (drawTime > buffer[buffer.length - 1]!.msg.time) lateFrames++;
      fillMirror(mirror, interpolate(drawTime));
      const own = ownTank();
      if (own && !snapped) {
        scene.view.setFocus(own.x, own.z);
        scene.view.snap();
        snapped = true;
      }
      // While watching (no tank of your own), show the whole arena.
      if (!own && scene.view.mode === 'play') {
        scene.view.setMode('overview');
        autoOverview = true;
      } else if (own && autoOverview) {
        scene.view.setMode('play');
        autoOverview = false;
      }

      controls.update();
      const pickable = controls.pickable();
      const ownPos = scene.draw(mirror, own?.id ?? null, 1, time, dt, !!own && mirror.canFire(own));
      scene.showAiming(controls.aimingSlot !== null, own, pickable, mirror.tanks, time);
      scene.showGrenadeAim(controls.aimingGrenade, own, controls.pointer);

      // Scoreboard and banner
      hud.setScoreboard(
        state.players.map((p) => ({ name: p.name, color: p.color, score: p.score, isYou: p.id === playerId, watching: p.tankId === null })),
        pointsToWin,
      );
      const age = performance.now() / 1000 - buffer[buffer.length - 1]!.recv;
      const left = Math.max(0, state.phaseTimeLeft - age);
      const watching = me()?.tankId === null;
      if (state.phase === 'waiting') hud.setBanner('Waiting for another player · open this page in a second window, or share the address with a friend on your Wi-Fi');
      else if (state.phase === 'countdown') hud.setBanner(watching ? `Next match in ${Math.ceil(left)}` : String(Math.ceil(left)), !watching);
      else if (state.phase === 'ended') {
        const winner = state.players.find((p) => p.id === state.winnerId);
        hud.setBanner(`${winner ? (winner.id === playerId ? 'You win!' : `${winner.name} wins!`) : 'Match over'} · next match in ${Math.ceil(left)} s`, true);
      } else if (watching) hud.setBanner('A match is running · you join the next one');
      else if (own && own.status === 'falling') hud.setBanner(`Back on the ice in ${Math.max(0, T.rules.respawnSeconds - own.fallTime).toFixed(1)} s`);
      else if (own && own.disabledLeft > 0) hud.setBanner(`Disabled by EMP · ${own.disabledLeft.toFixed(1)} s`);
      else hud.setBanner(null);

      hud.updateBar(mirror, own, controls.aimingSlot);
      hud.updateOverlays({
        world: mirror,
        own,
        camera: scene.view.camera,
        colorOf: (t) => colorForTank(t.id),
        label: (t) => nameForTank(t.id).slice(0, 1).toUpperCase() || MODEL_LETTERS[t.model],
        aiming: controls.aimingSlot !== null,
        aimingGrenade: controls.aimingGrenade,
        pickable,
        time,
      });
      scene.render(dt, own, ownPos);
    });
  }

  /** The state at server time `t`, blended between the two updates around it. */
  function interpolate(t: number): StateMessage {
    let i = buffer.length - 1;
    while (i > 0 && buffer[i - 1]!.msg.time > t) i--;
    const b = buffer[i]!.msg;
    const a = i > 0 ? buffer[i - 1]!.msg : null;
    if (!a || b.time <= a.time || t >= b.time) return b;
    const h = b.time - a.time;
    const k = Math.max(0, Math.min(1, (t - a.time) / h));
    const lerp = (x: number, y: number) => x + (y - x) * k;
    // Curve blending (Hermite): uses each update's position and velocity, so
    // speed changes smoothly through every update instead of in small steps.
    const k2 = k * k;
    const k3 = k2 * k;
    const h00 = 2 * k3 - 3 * k2 + 1;
    const h10 = (k3 - 2 * k2 + k) * h;
    const h01 = -2 * k3 + 3 * k2;
    const h11 = (k3 - k2) * h;
    const curve = (p0: number, v0: number, p1: number, v1: number) => h00 * p0 + h10 * v0 + h01 * p1 + h11 * v1;
    const tanks = b.tanks.map((tb) => {
      const ta = a.tanks[tb.id];
      if (!ta || ta.status !== tb.status || Math.hypot(tb.x - ta.x, tb.z - ta.z) > 8) return tb;
      const alive = tb.status === 'alive';
      return {
        ...tb,
        x: alive ? curve(ta.x, ta.vx, tb.x, tb.vx) : lerp(ta.x, tb.x),
        z: alive ? curve(ta.z, ta.vz, tb.z, tb.vz) : lerp(ta.z, tb.z),
        heading: ta.heading + angleDelta(ta.heading, tb.heading) * k,
        turret: ta.turret + angleDelta(ta.turret, tb.turret) * k,
        fallTime: lerp(ta.fallTime, tb.fallTime),
      };
    });
    const byId = <T extends { id: number; x: number; z: number }>(listA: T[], listB: T[]) => {
      const old = new Map(listA.map((o) => [o.id, o]));
      return listB.map((o) => {
        const p = old.get(o.id);
        return p ? { ...o, x: lerp(p.x, o.x), z: lerp(p.z, o.z) } : o;
      });
    };
    return { ...b, tanks, projectiles: byId(a.projectiles, b.projectiles), missiles: byId(a.missiles, b.missiles) };
  }

  function fillMirror(world: World, s: StateMessage): void {
    world.tanks.length = 0;
    world.tanks.push(...s.tanks);
    world.projectiles = s.projectiles;
    world.missiles = s.missiles;
    world.mines = s.mines;
    world.grenades = s.grenades ?? [];
    world.drones = s.drones ?? [];
    world.powerups = s.powerups;
  }
}
