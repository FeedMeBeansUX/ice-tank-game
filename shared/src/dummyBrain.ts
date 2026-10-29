import { trackHeading } from './track';
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
 * Stealth smokes when shots or a missile are locked on to it.
 * Laser fires its EMP when you come within its radius.
 * Shotgun throws a grenade at you when you are within throwing range.
 *
 * Powerups (only when dummies may fire back): they fire a homing missile at
 * you now and then, drop a mine when you are close, and use rapid fire when
 * you are within range.
 *
 * In a race they drive instead, like a player: they click toward a point on
 * the middle of the track ahead to push on, and only brake or correct when
 * they are too fast for the coming bend or sliding sideways.
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
      if (!tank.isDummy || tank.status !== 'alive' || tank.disabledLeft > 0) continue;
      // Spread the dummies' decisions out so they don't all click together.
      const due = this.nextThink.get(tank.id) ?? world.time + (tank.id * D.clickInterval) / 4;
      if (world.time < due) {
        if (!this.nextThink.has(tank.id)) this.nextThink.set(tank.id, due);
        continue;
      }
      this.nextThink.set(tank.id, world.time + (world.track ? T.race.dummyClickInterval : D.clickInterval));

      const r = Math.hypot(tank.x, tank.z);
      const px = tank.x + tank.vx * D.lookAhead;
      const pz = tank.z + tank.vz * D.lookAhead;
      const predicted = Math.hypot(px, pz);
      const safe = R * D.safeZone;

      // Abilities
      if (tank.abilityCooldownLeft <= 0) {
        if (tank.model === 'modelA' && predicted > R * 0.9 && r > safe) {
          world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelG' && world.canFire(tank)) {
          // Drone between it and you, close enough for the drone's gun to reach you.
          const player = world.tanks.find((t) => !t.isDummy && t.status === 'alive' && !world.isHidden(t));
          const Dr = T.abilities.drone;
          const d = player ? Math.hypot(player.x - tank.x, player.z - tank.z) : Infinity;
          if (player && d <= Dr.maxPlace + Dr.range * 0.6 && this.random() < D.skill) {
            const k = Math.min(1, Math.max(0, d - Dr.range * 0.5) / d);
            world.input(tank.id, { type: 'drone', x: tank.x + (player.x - tank.x) * k, z: tank.z + (player.z - tank.z) * k });
          }
        } else if (tank.model === 'modelF' && world.canFire(tank)) {
          // Explosive shells when you're within its range (but not too close to shoot).
          const player = world.tanks.find((t) => !t.isDummy && t.status === 'alive' && !world.isHidden(t));
          const d = player ? Math.hypot(player.x - tank.x, player.z - tank.z) : Infinity;
          if (d <= world.range(tank) && d >= T.tanks.modelF.minRange && this.random() < D.skill) world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelE' && world.canFire(tank)) {
          // Grenade at you, aimed where your slide will take you, when you're within throwing range.
          const player = world.tanks.find((t) => !t.isDummy && t.status === 'alive' && !world.isHidden(t));
          if (player && Math.hypot(player.x - tank.x, player.z - tank.z) <= T.abilities.grenade.maxThrow && this.random() < D.skill) {
            const lead = T.abilities.grenade.flightSeconds * 0.7;
            world.input(tank.id, { type: 'grenade', x: player.x + player.vx * lead, z: player.z + player.vz * lead });
          }
        } else if (tank.model === 'modelD') {
          // EMP when you are within its radius.
          const player = world.tanks.find((t) => !t.isDummy && t.status === 'alive');
          if (player && Math.hypot(player.x - tank.x, player.z - tank.z) <= T.abilities.emp.radius && this.random() < D.skill) {
            world.input(tank.id, { type: 'ability' });
          }
        } else if (tank.model === 'modelC') {
          // Smoke when shots or a missile are locked on to it.
          const lockedOn = world.projectiles.some((p) => p.targetId === tank.id) || world.missiles.some((m) => m.targetId === tank.id);
          if (lockedOn && this.random() < D.skill) world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelB' && world.canFire(tank)) {
          const target = world.closestEnemy(tank);
          if (target && !target.isDummy && Math.hypot(target.x - tank.x, target.z - tank.z) <= T.combat.rangeMetres) {
            world.input(tank.id, { type: 'ability' });
          }
        }
      }

      // Powerups, aimed only at the player (not at other dummies).
      if (world.canFire(tank)) {
        const player = world.tanks.find((t) => !t.isDummy && t.status === 'alive');
        if (player) {
          const missileSlot = tank.slots.indexOf('missile');
          if (missileSlot >= 0 && world.canTargetWithMissile(tank, player) && this.random() < 0.25) {
            world.input(tank.id, { type: 'missile', slot: missileSlot, targetId: player.id });
          }
          const rapidSlot = tank.slots.indexOf('rapidFire');
          // When you are within its range (for Laser this boosts the laser).
          if (rapidSlot >= 0 && tank.rapidFireLeft <= 0 && Math.hypot(player.x - tank.x, player.z - tank.z) <= world.range(tank)) {
            world.input(tank.id, { type: 'rapidFire', slot: rapidSlot });
          }
          const mineSlot = tank.slots.indexOf('mine');
          if (mineSlot >= 0 && Math.hypot(player.x - tank.x, player.z - tank.z) < 7) {
            world.input(tank.id, { type: 'mine', slot: mineSlot });
          }
        }
      }

      if (world.track) {
        this.race(world, tank);
        continue;
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

  /**
   * Race driving, like a player would: click toward a point on the middle of
   * the track ahead to push forward. Only when going too fast for the coming
   * bend, or sliding sideways, click to correct instead (toward the speed and
   * direction wanted, which also brakes).
   */
  private race(world: World, tank: World['tanks'][number]): void {
    const T = world.tuning;
    const D = T.dummies;
    const track = world.track!;
    const n = track.points.length;
    const step = track.length / n;
    const speedNow = Math.hypot(tank.vx, tank.vz);
    // Look further ahead when going faster.
    const lookMetres = T.race.dummyLookAhead * 0.6 + speedNow * 0.6;
    const ahead = Math.max(2, Math.round(lookMetres / step));
    const target = track.points[(tank.raceIndex + ahead) % n]!;
    // How much the track bends over the stretch ahead: slower for sharper bends.
    let bend = 0;
    for (const k of [1, 2, 3]) {
      bend = Math.max(bend, Math.abs(angleBetween(trackHeading(track, tank.raceIndex), trackHeading(track, (tank.raceIndex + ahead * k) % n))) / k);
    }
    bend = Math.min(1, bend / (Math.PI / 2));
    const top = T.physics.topSpeed * T.tanks[tank.model].topSpeedShare;
    const cornerSpeed = top * Math.max(0.4, 1 - 0.65 * bend);
    // Lower skill: a little hesitation and less accurate clicks.
    if (this.random() > 0.5 + D.skill * 0.5) return;
    const dx0 = target.x - tank.x;
    const dz0 = target.z - tank.z;
    const d0 = Math.hypot(dx0, dz0) || 1;
    const ux = dx0 / d0;
    const uz = dz0 / d0;
    const forward = tank.vx * ux + tank.vz * uz;
    const sideways = Math.hypot(tank.vx - ux * forward, tank.vz - uz * forward);
    let angle: number;
    if (forward < cornerSpeed && sideways < 2.5) {
      // Push on toward the point ahead.
      angle = Math.atan2(uz, ux);
    } else {
      // Too fast or sliding: click toward the wanted velocity minus the current one.
      const dx = ux * cornerSpeed - tank.vx;
      const dz = uz * cornerSpeed - tank.vz;
      if (Math.hypot(dx, dz) < 0.5) return;
      angle = Math.atan2(dz, dx);
    }
    angle += (this.random() * 2 - 1) * (1 - D.skill) * (Math.PI / 10);
    world.input(tank.id, { type: 'move', x: tank.x + Math.cos(angle) * 6, z: tank.z + Math.sin(angle) * 6 });
  }
}

function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
