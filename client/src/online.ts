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
import { PLAYER_COLORS } from './tankView';

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
  /** Lowest seen (local clock − server clock): our best estimate of the offset. */
  const offsets: number[] = [];
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
    scene = new GameScene(canvas, T, (t) => colorForTank(t.id), colorForTank);
    hud = new Hud((tankId) => controls?.fireMissileAt(tankId));
    hud.setMode(
      'milestone 4 · online test room',
      `<div class="hud-help"><span><kbd>Click</kbd> turn and push</span><span><kbd>Shift</kbd> ability</span><span><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> powerups</span><span><kbd>C</kbd> overview</span></div>`,
    );
    hud.setStats('');
    for (const text of pendingMessages) hud.message(text);
    controls = new Controls(canvas, scene, () => mirror!, ownTank, (input) => send({ type: 'input', input }), {
      instantClickMarker: true,
      enabled: () => latest()?.phase === 'playing' || latest()?.phase === 'waiting',
    });

    const timer = new THREE.Timer();
    let snapped = false;
    let autoOverview = false;
    scene.renderer.setAnimationLoop((timestamp: number) => {
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.25);
      const time = timer.getElapsed();
      const state = latest();
      if (!state || !scene || !hud || !mirror || !controls) return;

      fillMirror(mirror, interpolate(performance.now() / 1000 - Math.min(...offsets) - T.simulation.interpolationDelay));
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
      const ownPos = scene.draw(mirror, own?.id ?? null, 1, time, dt, T.combat.firingEnabled && !!own);
      scene.showAiming(controls.aimingSlot !== null, own, pickable, mirror.tanks, time);

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
      else hud.setBanner(null);

      hud.updateBar(mirror, own, controls.aimingSlot);
      hud.updateOverlays({
        world: mirror,
        own,
        camera: scene.view.camera,
        colorOf: (t) => colorForTank(t.id),
        label: (t) => nameForTank(t.id).slice(0, 1).toUpperCase(),
        aiming: controls.aimingSlot !== null,
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
    const k = Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const tanks = b.tanks.map((tb) => {
      const ta = a.tanks[tb.id];
      if (!ta || ta.status !== tb.status || Math.hypot(tb.x - ta.x, tb.z - ta.z) > 8) return tb;
      return {
        ...tb,
        x: lerp(ta.x, tb.x),
        z: lerp(ta.z, tb.z),
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
    world.powerups = s.powerups;
  }
}
