import type { TankModel, Tuning } from './tuning';
import type { DroneState, GrenadeState, MineState, MissileState, PowerupState, ProjectileState, TankInput, TankState, Upgrades, WorldEvent } from './world';

/**
 * Messages between the browser and the game server (sent as JSON over a
 * WebSocket). Browsers only send inputs; the server decides everything else
 * and sends the state about 20 times a second.
 */

export type MatchPhase = 'waiting' | 'countdown' | 'playing' | 'ended';

export interface PlayerInfo {
  /** Stable for this visit. Separate from the name, so accounts can replace names later. */
  id: number;
  name: string;
  color: string;
  model: TankModel;
  /** This player's tank in the current match, or null while watching (joined mid-match). */
  tankId: number | null;
  /** Knockouts in the current match. */
  score: number;
}

export interface StateMessage {
  type: 'state';
  /** Server clock (seconds) when this state was taken. */
  time: number;
  phase: MatchPhase;
  /** Seconds left in the countdown or on the end screen. */
  phaseTimeLeft: number;
  winnerId: number | null;
  players: PlayerInfo[];
  tanks: TankState[];
  projectiles: ProjectileState[];
  missiles: MissileState[];
  mines: MineState[];
  grenades: GrenadeState[];
  drones: DroneState[];
  powerups: PowerupState[];
  /** Sumo: seconds of play in this match, for the shrinking ice. */
  shrinkTime?: number;
  /** Everything that happened since the previous state (hits, knockouts...). */
  events: WorldEvent[];
}

export type ServerMessage =
  | { type: 'welcome'; playerId: number; tuning: Tuning; pointsToWin: number }
  | { type: 'message'; text: string }
  | { type: 'error'; text: string }
  | StateMessage;

export type ClientMessage =
  | { type: 'join'; name: string; model: TankModel; upgrades?: Upgrades }
  | { type: 'input'; input: TankInput };

/** WebSocket path on the game server. */
export const SOCKET_PATH = '/ws';
