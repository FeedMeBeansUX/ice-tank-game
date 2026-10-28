/**
 * Elimination rule from the requirements: a tank is out when its centre
 * passes the arena edge. Shared so browser and server agree exactly.
 * Positions are on the ground plane, with (0, 0) at the arena centre.
 */
export function isOffArena(x: number, z: number, radius: number): boolean {
  return x * x + z * z > radius * radius;
}
