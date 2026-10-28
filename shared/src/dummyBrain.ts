import type { World } from './world';

/**
 * Practice dummies that try to stay on the ice.
 *
 * At most once per `dummies.clickInterval` each dummy looks at where its
 * current slide will take it. If that is outside its safe zone, it "clicks"
 * in the direction that turns its velocity back toward the middle (so it
 * brakes against its own momentum, like a player would). Otherwise it does
 * nothing and keeps sliding.
 *
 * Skill (0–1) makes them beatable: below 1 they sometimes hesitate, and their
 * recovery clicks are less accurate.
 *
 * Abilities: Model A boosts to escape when it is about to slide off.
 * Model B charges power shots when you are within its range.
 *
 * The dummies only send the same inputs a player can (clicks and Shift),
 * so they follow every rule a player does.
 */
export class DummyBrain {
  private nextThink = new Map<number, number>();
  private seed = 12345;

  /** Small deterministic random generator, so practice runs are repeatable. */
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  update(world: World): void {
    const T = world.tuning;
    const D = T.dummies;
    if (!D.smart) return;
    const R = T.arena.radius;

    for (const tank of world.tanks) {
      if (!tank.isDummy || tank.status !== 'alive') continue;
      // Spread the dummies' decisions out so they don't all click together.
      const due = this.nextThink.get(tank.id) ?? world.time + (tank.id * D.clickInterval) / 4;
      if (world.time < due) {
        if (!this.nextThink.has(tank.id)) this.nextThink.set(tank.id, due);
        continue;
      }
      this.nextThink.set(tank.id, world.time + D.clickInterval);

      const r = Math.hypot(tank.x, tank.z);
      const px = tank.x + tank.vx * D.lookAhead;
      const pz = tank.z + tank.vz * D.lookAhead;
      const predicted = Math.hypot(px, pz);
      const safe = R * D.safeZone;

      // Abilities
      if (tank.abilityCooldownLeft <= 0) {
        if (tank.model === 'modelA' && predicted > R * 0.9 && r > safe) {
          world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelB' && world.canFire(tank)) {
          const target = world.closestEnemy(tank);
          if (target && !target.isDummy && Math.hypot(target.x - tank.x, target.z - tank.z) <= T.combat.rangeMetres) {
            world.input(tank.id, { type: 'ability' });
          }
        }
      }

      if (predicted <= safe) continue;
      // Lower skill: sometimes hesitates and does nothing this time.
      if (this.random() > D.skill) continue;

      // Wanted velocity: back toward the middle. Click in the direction of
      // the change needed (wanted minus current), which also brakes.
      const len = r > 1e-3 ? r : 1;
      const wantX = (-tank.x / len) * D.returnSpeed;
      const wantZ = (-tank.z / len) * D.returnSpeed;
      const dx = wantX - tank.vx;
      const dz = wantZ - tank.vz;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) continue;
      // Lower skill: the recovery click is less accurate.
      const error = (this.random() * 2 - 1) * (1 - D.skill) * (Math.PI / 3);
      const angle = Math.atan2(dz, dx) + error;
      world.input(tank.id, { type: 'move', x: tank.x + Math.cos(angle) * 6, z: tank.z + Math.sin(angle) * 6 });
    }
  }
}
