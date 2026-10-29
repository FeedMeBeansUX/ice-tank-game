import {
  World,
  createTuning,
  type ClientMessage,
  type MatchPhase,
  type PlayerInfo,
  type ServerMessage,
  type TankInput,
  type TankModel,
  type Tuning,
  type WorldEvent,
} from '@ice-tank-sumo/shared';

/**
 * The milestone 4 test room: one room for up to 4 players.
 *
 * - waiting: fewer than 2 players. A lone player can drive around.
 * - countdown: 3 s, tanks frozen at their spawn spots.
 * - playing: the shared simulation runs here, 60 steps a second.
 * - ended: someone reached 5 knockouts; the winner is shown, then a new match
 *   starts with everyone present.
 *
 * Players who join during the countdown are added (the countdown restarts).
 * Players who join during a match watch until the next one starts.
 * (Lobby, ready-up, sessions and rejoin come in milestone 5.)
 */

/** Anything we can send text to: a WebSocket in production, a fake in tests. */
export interface Connection {
  send(data: string): void;
  close(): void;
}

const PLAYER_COLORS = ['#ff7a3d', '#3fb5ff', '#7bd65b', '#c77dff'];

interface Player {
  id: number;
  name: string;
  color: string;
  model: TankModel;
  connection: Connection;
  tankId: number | null;
}

export class Room {
  readonly tuning: Tuning = createTuning();
  private world = new World(this.tuning, Date.now() & 0xffff);
  private readonly players = new Map<number, Player>();
  private nextPlayerId = 1;
  private phase: MatchPhase = 'waiting';
  private phaseTimeLeft = 0;
  private winnerId: number | null = null;
  private pendingEvents: WorldEvent[] = [];
  /** Server clock in seconds (advances with every simulation step or frozen tick). */
  private clock = 0;
  private sendAccumulator = 0;

  constructor(private readonly log: (text: string) => void = () => {}) {}

  /** A new connection. Returns a handler for its messages and one for closing. */
  connect(connection: Connection): { onMessage(text: string): void; onClose(): void } {
    let playerId: number | null = null;
    return {
      onMessage: (text: string) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(text) as ClientMessage;
        } catch {
          return;
        }
        if (msg.type === 'join' && playerId === null) playerId = this.join(connection, msg.name, msg.model);
        else if (msg.type === 'input' && playerId !== null) this.input(playerId, msg.input);
      },
      onClose: () => {
        if (playerId !== null) this.leave(playerId);
      },
    };
  }

  /** Advance the room by `seconds` (called by a timer about 60 times a second). */
  advance(seconds: number): void {
    const dt = this.world.dt;
    this.stepAccumulator += Math.min(seconds, 0.25);
    while (this.stepAccumulator >= dt) {
      this.stepAccumulator -= dt;
      this.tick(dt);
    }
    this.sendAccumulator += Math.min(seconds, 0.25);
    const sendEvery = 1 / this.tuning.simulation.serverSendsPerSecond;
    if (this.sendAccumulator >= sendEvery) {
      this.sendAccumulator %= sendEvery;
      this.broadcastState();
    }
  }
  private stepAccumulator = 0;

  // -------------------------------------------------------------------------

  private join(connection: Connection, rawName: string, rawModel: TankModel): number | null {
    if (this.players.size >= this.tuning.simulation.maxPlayers) {
      this.sendTo(connection, { type: 'error', text: `The room is full (${this.tuning.simulation.maxPlayers} players).` });
      connection.close();
      return null;
    }
    const model: TankModel = rawModel === 'modelB' || rawModel === 'modelC' ? rawModel : 'modelA';
    const name = this.uniqueName(String(rawName ?? '').trim().slice(0, 16) || 'Player');
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0]!;
    const player: Player = { id: this.nextPlayerId++, name, color, model, connection, tankId: null };
    this.players.set(player.id, player);
    this.sendTo(connection, { type: 'welcome', playerId: player.id, tuning: this.tuning, pointsToWin: this.tuning.rules.pointsToWin });
    this.log(`${name} joined (${this.players.size} in the room)`);
    this.message(`${name} joined`);

    if (this.phase === 'waiting') {
      player.tankId = this.addTankFor(player, this.players.size - 1).id;
      if (this.players.size >= 2) this.startCountdown();
    } else if (this.phase === 'countdown') {
      // Not started yet: restart the countdown with everyone included.
      this.startCountdown();
    } else {
      this.sendTo(connection, { type: 'message', text: 'A match is running. You join the next one.' });
    }
    this.broadcastState();
    return player.id;
  }

  private leave(playerId: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    if (player.tankId !== null) {
      const tank = this.world.tanks[player.tankId];
      if (tank) this.world.removeTank(tank);
    }
    this.log(`${player.name} left (${this.players.size} in the room)`);
    this.message(`${player.name} left`);
    const inMatch = [...this.players.values()].filter((p) => p.tankId !== null).length;
    if ((this.phase === 'playing' || this.phase === 'countdown') && inMatch < 2) {
      this.message('Not enough players: back to waiting');
      this.resetToWaiting();
    }
    if (this.players.size === 0) this.resetToWaiting();
  }

  private input(playerId: number, input: TankInput): void {
    const player = this.players.get(playerId);
    if (!player || player.tankId === null || !input || typeof input !== 'object') return;
    if (this.phase !== 'playing' && this.phase !== 'waiting') return;
    // Only pass on well-formed inputs; the simulation checks the game rules.
    if (input.type === 'move' && Number.isFinite(input.x) && Number.isFinite(input.z)) {
      this.world.input(player.tankId, { type: 'move', x: input.x, z: input.z });
    } else if (input.type === 'ability') {
      this.world.input(player.tankId, { type: 'ability' });
    } else if (input.type === 'missile' && Number.isInteger(input.slot) && Number.isInteger(input.targetId)) {
      this.world.input(player.tankId, { type: 'missile', slot: input.slot, targetId: input.targetId });
    } else if (input.type === 'mine' && Number.isInteger(input.slot)) {
      this.world.input(player.tankId, { type: 'mine', slot: input.slot });
    } else if (input.type === 'rapidFire' && Number.isInteger(input.slot)) {
      this.world.input(player.tankId, { type: 'rapidFire', slot: input.slot });
    }
  }

  private tick(dt: number): void {
    this.clock += dt;
    if (this.phase === 'countdown' || this.phase === 'ended') {
      this.phaseTimeLeft -= dt;
      if (this.phaseTimeLeft > 0) return;
      if (this.phase === 'countdown') {
        this.phase = 'playing';
        this.message('Go!');
      } else if (this.players.size >= 2) {
        this.startCountdown();
      } else {
        this.resetToWaiting();
      }
      return;
    }

    this.world.step();
    const events = this.world.takeEvents();
    this.pendingEvents.push(...events);
    for (const e of events) {
      if (e.type === 'eliminated') {
        const victim = this.playerForTank(e.tankId);
        const scorer = e.creditedTo !== null ? this.playerForTank(e.creditedTo) : null;
        if (victim) this.message(scorer ? `${scorer.name} knocked ${victim.name} off` : `${victim.name} fell off`);
      }
    }

    if (this.phase === 'playing') {
      for (const player of this.players.values()) {
        if (player.tankId === null) continue;
        const tank = this.world.tanks[player.tankId];
        if (tank && tank.knockouts >= this.tuning.rules.pointsToWin) {
          this.phase = 'ended';
          this.phaseTimeLeft = this.tuning.rules.endScreenSeconds;
          this.winnerId = player.id;
          this.message(`${player.name} wins!`);
          this.log(`${player.name} won`);
          this.broadcastState();
          break;
        }
      }
    }
  }

  /** New match with everyone in the room: tanks spread out around the centre. */
  private startCountdown(): void {
    this.world = new World(this.tuning, (Date.now() & 0xffff) + this.clock);
    this.pendingEvents = [];
    this.winnerId = null;
    let i = 0;
    for (const player of this.players.values()) player.tankId = this.addTankFor(player, i++).id;
    this.phase = 'countdown';
    this.phaseTimeLeft = this.tuning.rules.countdownSeconds;
    this.message(`New match: first to ${this.tuning.rules.pointsToWin} knockouts`);
  }

  private resetToWaiting(): void {
    this.world = new World(this.tuning, (Date.now() & 0xffff) + this.clock);
    this.pendingEvents = [];
    this.phase = 'waiting';
    this.phaseTimeLeft = 0;
    this.winnerId = null;
    let i = 0;
    for (const player of this.players.values()) player.tankId = this.addTankFor(player, i++).id;
  }

  /**
   * Spawn spots spread evenly around the centre, far enough apart that
   * tanks start just outside each other's firing range (when the arena allows).
   */
  private addTankFor(player: Player, index: number, count = this.players.size) {
    const n = Math.max(2, count);
    const T = this.tuning;
    const apart = T.combat.rangeMetres + 1;
    const r = Math.min(T.arena.radius - 8, Math.max(9, apart / (2 * Math.sin(Math.PI / n))));
    const a = Math.PI / 2 + (index * 2 * Math.PI) / n;
    return this.world.addTank({ name: player.name, model: player.model, x: Math.cos(a) * r, z: Math.sin(a) * r });
  }

  private playerForTank(tankId: number): Player | null {
    for (const p of this.players.values()) if (p.tankId === tankId) return p;
    return null;
  }

  private uniqueName(name: string): string {
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`.toLowerCase())) return `${name} ${n}`;
  }

  private message(text: string): void {
    this.broadcast({ type: 'message', text });
  }

  private broadcastState(): void {
    const players: PlayerInfo[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      model: p.model,
      tankId: p.tankId,
      score: p.tankId !== null ? (this.world.tanks[p.tankId]?.knockouts ?? 0) : 0,
    }));
    const w = this.world;
    this.broadcast({
      type: 'state',
      time: this.clock,
      phase: this.phase,
      phaseTimeLeft: Math.max(0, this.phaseTimeLeft),
      winnerId: this.winnerId,
      players,
      tanks: w.tanks,
      projectiles: w.projectiles,
      missiles: w.missiles,
      mines: w.mines,
      powerups: w.powerups,
      events: this.pendingEvents,
    });
    this.pendingEvents = [];
  }

  private broadcast(msg: ServerMessage): void {
    const text = JSON.stringify(msg);
    for (const p of this.players.values()) {
      try {
        p.connection.send(text);
      } catch {
        // A broken connection is cleaned up when it closes.
      }
    }
  }

  private sendTo(connection: Connection, msg: ServerMessage): void {
    try {
      connection.send(JSON.stringify(msg));
    } catch {
      // ignore
    }
  }
}
