import { trackHeading } from './track';
import type { World } from './world';

/**
 * Practice dummies that try to stay on the ice.
 *
 * At most once per `dummies.clickInterval` each dummy looks at where its
 * current slide will take it. If that is outside its safe zone, it "clicks"
 * in the direction that turns its velocity back toward the middle (so it
 * brakes against its own momentum, like a player would). Otherwise it plays
 * to its class (see sumoGoal): grab powerups, keep its distance, or chase.
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
 * you now and then (in a race: only at the closest tank ahead of them), drop a mine when you are close, and use rapid fire when
 * you are within range.
 *
 * In a race they drive instead, like a player: they keep clicking on the
 * middle of the track about one firing range ahead, anticipating bends.
 *
 * The dummies only send the same inputs a player can (clicks and Shift),
 * so they follow every rule a player does.
 */
export class DummyBrain {
  /**
   * freeForAll (simulations): every dummy treats its closest other tank as
   * "the player", so all-dummy matches use abilities and powerups fairly.
   */
  constructor(private readonly opts: { freeForAll?: boolean } = {}) {}

  /** Who a dummy aims its abilities and powerups at: you (or, free-for-all, its closest other tank). */
  private foe(world: World, tank: World['tanks'][number], visibleOnly: boolean): World['tanks'][number] | undefined {
    const ok = (t: World['tanks'][number]) => t.status === 'alive' && (!visibleOnly || !world.isHidden(t));
    if (!this.opts.freeForAll) return world.tanks.find((t) => !t.isDummy && ok(t));
    let best: World['tanks'][number] | undefined;
    let bestD = Infinity;
    for (const t of world.tanks) {
      if (t === tank || !ok(t)) continue;
      const d = Math.hypot(t.x - tank.x, t.z - tank.z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private nextThink = new Map<number, number>();
  /** When each dummy may next click toward another tank (Sumo, safe from the edge). */
  private nextChase = new Map<number, number>();
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
    const R = world.arenaRadius();

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
        } else if (tank.model === 'modelA' && !world.track && D.roles && D.agileRamBoost && this.ramChance(world, tank, R)) {
          // Agile: boost into a tank near the edge when it is on the inside and lined up.
          world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelG' && world.canFire(tank)) {
          // Drone between it and you, close enough for the drone's gun to reach you.
          const player = this.foe(world, tank, true);
          const Dr = T.abilities.drone;
          const d = player ? Math.hypot(player.x - tank.x, player.z - tank.z) : Infinity;
          if (player && d <= Dr.maxPlace + Dr.range * 0.6 && this.random() < D.skill) {
            const k = Math.min(1, Math.max(0, d - Dr.range * 0.5) / d);
            world.input(tank.id, { type: 'drone', x: tank.x + (player.x - tank.x) * k, z: tank.z + (player.z - tank.z) * k });
          }
        } else if (tank.model === 'modelF' && world.canFire(tank)) {
          // Explosive shells when you're within its range (but not too close to shoot).
          const player = this.foe(world, tank, true);
          const d = player ? Math.hypot(player.x - tank.x, player.z - tank.z) : Infinity;
          if (d <= world.range(tank) && d >= T.tanks.modelF.minRange && this.random() < D.skill) world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelE' && world.canFire(tank)) {
          // Grenade at you, aimed where your slide will take you, when you're within throwing range.
          const player = this.foe(world, tank, true);
          if (player && Math.hypot(player.x - tank.x, player.z - tank.z) <= T.abilities.grenade.maxThrow && this.random() < D.skill) {
            const lead = T.abilities.grenade.flightSeconds * 0.7;
            world.input(tank.id, { type: 'grenade', x: player.x + player.vx * lead, z: player.z + player.vz * lead });
          }
        } else if (tank.model === 'modelD') {
          // EMP when you are within its radius.
          const player = this.foe(world, tank, false);
          if (player && Math.hypot(player.x - tank.x, player.z - tank.z) <= T.abilities.emp.radius && this.random() < D.skill) {
            world.input(tank.id, { type: 'ability' });
          }
        } else if (tank.model === 'modelC') {
          // Smoke when shots or a missile are locked on to it.
          const lockedOn = world.projectiles.some((p) => p.targetId === tank.id) || world.missiles.some((m) => m.targetId === tank.id);
          if (lockedOn && this.random() < D.skill) world.input(tank.id, { type: 'ability' });
        } else if (tank.model === 'modelB' && world.canFire(tank)) {
          const target = world.closestEnemy(tank);
          if (target && (this.opts.freeForAll || !target.isDummy) && Math.hypot(target.x - tank.x, target.z - tank.z) <= T.combat.rangeMetres) {
            world.input(tank.id, { type: 'ability' });
          }
        }
      }

      // Powerups, aimed only at the player (not at other dummies).
      if (world.canFire(tank)) {
        const player = this.foe(world, tank, false);
        if (player) {
          const missileSlot = tank.slots.indexOf('missile');
          if (missileSlot >= 0 && world.track) {
            // Race: only at a tank ahead of it in the race (the closest one ahead), dummy or you.
            const ahead = world.tanks
              .filter((t) => t !== tank && t.raceDistance > tank.raceDistance && world.canTargetWithMissile(tank, t))
              .sort((a, b) => a.raceDistance - b.raceDistance)[0];
            if (ahead && this.random() < 0.25) world.input(tank.id, { type: 'missile', slot: missileSlot, targetId: ahead.id });
          } else if (missileSlot >= 0 && world.canTargetWithMissile(tank, player) && this.random() < 0.25) {
            world.input(tank.id, { type: 'missile', slot: missileSlot, targetId: player.id });
          }
          const rapidSlot = tank.slots.indexOf('rapidFire');
          // When you are within its range (for Laser this boosts the laser).
          if (rapidSlot >= 0 && tank.rapidFireLeft <= 0 && Math.hypot(player.x - tank.x, player.z - tank.z) <= world.range(tank)) {
            world.input(tank.id, { type: 'rapidFire', slot: rapidSlot });
          }
          // Airstrike (Sumo): on where you will be when the bombs land, if that keeps the dummy clear of the blasts.
          const strikeSlot = tank.slots.indexOf('airstrike');
          if (strikeSlot >= 0 && !world.track && this.random() < 0.25) {
            const lead = T.airstrike.delaySeconds;
            const x = player.x + player.vx * lead;
            const z = player.z + player.vz * lead;
            if (Math.hypot(x - tank.x, z - tank.z) > T.airstrike.radius + T.airstrike.spacing * 1.5) {
              world.input(tank.id, { type: 'airstrike', slot: strikeSlot, x, z });
            }
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

      if (predicted <= safe) {
        // Safe: go after the closest other tank (to bump it), like a player would,
        // but at a calmer pace than recovery clicks. (They still check the edge
        // every click interval.)
        if (world.time < (this.nextChase.get(tank.id) ?? 0)) continue;
        this.nextChase.set(tank.id, world.time + D.chaseClickInterval - 1e-6);
        if (this.random() > D.skill) continue;
        const goal = this.sumoGoal(world, tank, safe);
        if (!goal || Math.hypot(goal.x - tank.x, goal.z - tank.z) < 1) continue;
        const error = (this.random() * 2 - 1) * (1 - D.skill) * (Math.PI / 6);
        const angle = Math.atan2(goal.z - tank.z, goal.x - tank.x) + error;
        world.input(tank.id, { type: 'move', x: tank.x + Math.cos(angle) * 6, z: tank.z + Math.sin(angle) * 6 });
        continue;
      }
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

  /** Agile: is a ram worth a boost? Target close, out toward the edge, Agile on its inside and facing it. */
  private ramChance(world: World, tank: World['tanks'][number], R: number): boolean {
    for (const t of world.tanks) {
      if (t === tank || t.status !== 'alive' || t.protectionLeft > 0 || world.isHidden(t)) continue;
      const dx = t.x - tank.x;
      const dz = t.z - tank.z;
      const d = Math.hypot(dx, dz);
      if (d > 8 || d < 1) continue;
      const tr = Math.hypot(t.x, t.z);
      if (tr < R * 0.4 || Math.hypot(tank.x, tank.z) > tr - 1) continue;
      let a = Math.atan2(dz, dx) - tank.heading;
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      if (Math.abs(a) < Math.PI / 6) return true;
    }
    return false;
  }

  /**
   * Sumo, safe from the edge: where to click next (null = hold still).
   * With roles on, each class plays to its strength:
   * - every dummy with a free slot grabs a nearby powerup (Agile from much farther away),
   * - Heavy, Artillery and Rocket stay near the middle and shoot: they close in on
   *   targets out of range, slip sideways past a tank that gets too close (toward
   *   the middle), and otherwise fire, working back toward the middle when far out,
   * - Stealth, Shotgun (and Agile when no powerup is around) get between the target
   *   and the middle, then go at it, aiming where it is sliding to,
   * - Laser rams its target head-on (optionally: holds it in the beam from a distance),
   * - Agile also boosts into a tank near the edge when it is on its inside and lined up.
   */
  private sumoGoal(world: World, tank: World['tanks'][number], safe: number): { x: number; z: number } | null {
    const T = world.tuning;
    const D = T.dummies;
    let prey: World['tanks'][number] | null = null;
    let best = Infinity;
    for (const t of world.tanks) {
      if (t === tank || t.status !== 'alive' || t.protectionLeft > 0 || world.isHidden(t)) continue;
      const d = Math.hypot(t.x - tank.x, t.z - tank.z);
      if (d < best) {
        best = d;
        prey = t;
      }
    }
    if (!D.roles) return prey && best >= 0.5 ? { x: prey.x, z: prey.z } : null;

    const ranged = tank.model === 'modelB' || tank.model === 'modelF' || tank.model === 'modelG';
    if (tank.slots.includes(null)) {
      const reach = tank.model === 'modelA' ? D.agilePowerupReach : D.powerupReach;
      let pick: { x: number; z: number } | null = null;
      let pickD = reach;
      for (const p of world.powerups) {
        if (Math.hypot(p.x, p.z) > safe * 1.15) continue; // not worth sliding off for
        const d = Math.hypot(p.x - tank.x, p.z - tank.z);
        if (d <= pickD) {
          pickD = d;
          pick = p;
        }
      }
      if (pick) return { x: pick.x, z: pick.z };
    }
    if (!prey || best < 0.5) return null;

    const r = Math.hypot(tank.x, tank.z);
    const mx = r > 1e-3 ? -tank.x / r : 0;
    const mz = r > 1e-3 ? -tank.z / r : 0;

    if (ranged) {
      // Shooters (Heavy, Artillery, Rocket) win by staying near the middle and
      // firing. Close in when the target is out of range; when a tank gets too
      // close, slip sideways past it toward the middle (backing straight away
      // only walks them to the edge); otherwise keep firing, working back toward
      // the middle when they are far out.
      const range = world.range(tank);
      const tooClose = tank.model === 'modelF' ? T.tanks.modelF.minRange + D.artilleryMargin : range * D.keepDistance;
      if (best < tooClose) {
        const ax = (tank.x - prey.x) / best;
        const az = (tank.z - prey.z) / best;
        let px = -az;
        let pz = ax;
        if (px * mx + pz * mz < 0) {
          px = -px;
          pz = -pz;
        }
        const pull = r / safe;
        const gx = px + mx * pull + ax * 0.3;
        const gz = pz + mz * pull + az * 0.3;
        return { x: tank.x + gx * 6, z: tank.z + gz * 6 };
      }
      if (best > range * 0.95) return { x: prey.x, z: prey.z };
      if (r <= world.arenaRadius() * D.homeZone) return null;
      return { x: 0, z: 0 };
    }

    // Chasers (Agile, Stealth, Laser, Shotgun): get between the target and the
    // middle first, so their hits and bumps push it outward, then go at it,
    // aiming where it is sliding to.
    const lead = { x: prey.x + prey.vx * D.chaseLead, z: prey.z + prey.vz * D.chaseLead };
    const pr = Math.hypot(prey.x, prey.z);
    if (pr < 2) return lead; // target in the middle: just go at it
    const ix = -prey.x / pr;
    const iz = -prey.z / pr;
    if (tank.model === 'modelD') {
      // Laser: rams its target head-on (in testing this beat both flanking and
      // holding the target in the beam from a distance).
      if (D.laserStandoff <= 0) return lead;
      const stand = world.range(tank) * D.laserStandoff;
      return { x: lead.x + ix * stand, z: lead.z + iz * stand };
    }
    if (r > pr - D.insideMargin) return { x: prey.x + ix * D.flankDistance, z: prey.z + iz * D.flankDistance };
    return lead;
  }

  /**
   * Race driving the way a good player does it: click on the track's middle
   * line a fixed distance ahead (about one firing range), so bends are
   * anticipated: the click already points into the next bend.
   */
  private race(world: World, tank: World['tanks'][number]): void {
    const T = world.tuning;
    const D = T.dummies;
    const track = world.track!;
    const n = track.points.length;
    const step = track.length / n;
    const ahead = Math.max(2, Math.round(T.race.dummyLookAhead / step));
    const target = track.points[(tank.raceIndex + ahead) % n]!;
    // Lower skill: a little hesitation and less accurate clicks.
    if (this.random() > 0.6 + D.skill * 0.4) return;
    const error = (this.random() * 2 - 1) * (1 - D.skill) * (Math.PI / 12);
    const angle = Math.atan2(target.z - tank.z, target.x - tank.x) + error;
    world.input(tank.id, { type: 'move', x: tank.x + Math.cos(angle) * 6, z: tank.z + Math.sin(angle) * 6 });
  }
}

function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
