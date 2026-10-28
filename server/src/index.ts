/**
 * Game server — arrives in milestone 4.
 *
 * Plan: a Colyseus server on one EU host. It runs the same shared game code as
 * practice mode (60 steps a second), decides hits, knockouts and scores, and
 * sends positions to players about 20 times a second. Browsers only send inputs.
 */
import { DEFAULT_TUNING as TUNING } from '@ice-tank-sumo/shared';

export const SERVER_PLACEHOLDER = {
  stepsPerSecond: TUNING.simulation.stepsPerSecond,
  sendsPerSecond: TUNING.simulation.serverSendsPerSecond,
};
