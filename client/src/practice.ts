import * as THREE from 'three';
import { DummyBrain, World, createTuning, generateTrack, type TankModel, type TankState, type Track } from '@ice-tank-sumo/shared';
import { Controls } from './controls';
import { Hud } from './hud';
import { PracticeMenu, type PracticeSetup } from './practiceMenu';
import { GameScene } from './scene';
import { DUMMY_COLOR, MODEL_LETTERS, PLAYER_COLORS } from './tankView';
import { TuningPanel } from './tuningPanel';

export type PracticeMode = 'sumo' | 'race';

/**
 * Practice mode: your tank and dummy tanks, in Sumo (round arena, up to 3
 * dummies) or Race (a generated track, up to 5 dummies, first to N laps).
 * The whole game runs here in the browser using the shared simulation, with
 * the slider panel (T) and practice setup (P).
 */
export function startPractice(canvas: HTMLCanvasElement, buildLabel: string, mode: PracticeMode = 'sumo', mobile = false): void {
  const racing = mode === 'race';
  const OWN_COLOR = PLAYER_COLORS[0]!;
  const DUMMY_SHOT_COLOR = '#e4eaef';

  const tuning = createTuning();
  const world = new World(tuning, 20261028);
  const maxDummies = racing ? tuning.race.maxDummies : 3;
  let setup: PracticeSetup = { model: 'modelA', upgrades: { firepower: 0, speed: 0, traction: 0 }, dummies: racing ? 'mixed' : 'modelA', dummyCount: maxDummies };
  // Mixed: one of each tank other than yours.
  const ALL: TankModel[] = ['modelA', 'modelB', 'modelC', 'modelD', 'modelE', 'modelF', 'modelG'];
  const dummyModel = (i: number): TankModel => {
    if (setup.dummies !== 'mixed') return setup.dummies;
    const others = ALL.filter((m) => m !== setup.model);
    return others[(i - 1) % others.length]!;
  };
  ['You', ...Array.from({ length: maxDummies }, (_, i) => `Dummy ${i + 1}`)].forEach((name, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 2;
    world.addTank({ name, model: i === 0 ? setup.model : dummyModel(i), isDummy: i > 0, x: Math.cos(a) * 9, z: Math.sin(a) * 9 });
  });
  const me = world.tanks[0]!;
  const dummyBrain = new DummyBrain();

  const colorOf = (t: TankState) => (t.isDummy ? DUMMY_COLOR : OWN_COLOR);
  const shotColorOf = (id: number) => (world.tanks[id]?.isDummy ? DUMMY_SHOT_COLOR : OWN_COLOR);
  const scene = new GameScene(canvas, tuning, colorOf, shotColorOf);
  scene.view.setFocus(me.x, me.z);
  scene.view.snap();

  // Race: the track, and where the race is (countdown, racing, finished).
  let track: Track | null = null;
  let phase: 'countdown' | 'racing' | 'finished' = 'racing';
  let countdownLeft = 0;
  let goShownUntil = 0;
  const newRace = (freshTrack: boolean) => {
    if (freshTrack || !track) {
      track = generateTrack(Math.floor(Math.random() * 1e9), tuning.race.trackLength, tuning.race.trackWidth);
      scene.setTrack(track);
    }
    world.startRace(track);
    for (const t of world.tanks) scene.snapTank(t);
    scene.view.setFocus(me.x, me.z);
    scene.view.snap();
    controls.cancelAiming();
    phase = 'countdown';
    countdownLeft = tuning.race.countdownSeconds;
  };

  const panel = new TuningPanel(tuning, buildLabel, (path) => {
    if (path === 'arena.radius') scene.rebuildArena();
  });
  document.body.appendChild(panel.element);

  const hud = new Hud((tankId) => controls.fireMissileAt(tankId));
  if (mobile) {
    hud.setMode(
      racing ? 'race' : 'practice',
      `<div class="hud-help"><span>Tap: turn and push</span><span>Double-tap a tank: target</span><span>Tap the bar: ability and powerups</span></div>` +
        (racing ? `<div class="hud-help"><span>Tap after the finish: next race</span></div>` : ''),
    );
  } else {
    hud.setMode(
      racing ? 'practice race' : 'practice',
      `<div class="hud-help"><span><kbd>Click</kbd> turn and push</span><span><kbd>Shift</kbd> ability</span><span><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> powerups</span></div>` +
        `<div class="hud-help"><span><kbd>Right-click</kbd> pick target</span><span><kbd>F</kbd> firing on/off</span><span><kbd>P</kbd> practice</span><span><kbd>T</kbd> tuning</span><span><kbd>C</kbd> overview</span></div>` +
        (racing ? `<div class="hud-help"><span><kbd>Enter</kbd> new track</span><span><kbd>R</kbd> restart race</span></div>` : ''),
    );
  }
  const updateNotes = () => {
    const parts: string[] = [];
    if (scene.view.mode !== 'play') parts.push('Camera: overview (press C to go back)');
    if (!tuning.combat.firingEnabled) parts.push('Firing is off (press F)');
    if (!tuning.powerups.enabled) parts.push('Powerups are off');
    hud.setNotes(parts);
  };

  const menu = new PracticeMenu(
    tuning,
    setup,
    (next) => {
      setup = next;
      world.projectiles = [];
      world.missiles = [];
      world.mines = [];
      world.grenades = [];
      world.drones = [];
      world.reconfigure(me, setup.model, setup.upgrades);
      world.tanks.forEach((t, i) => {
        if (!t.isDummy) return;
        // Dummies beyond the chosen count are taken off the ice.
        if (i > setup.dummyCount) world.removeTank(t);
        else world.reconfigure(t, dummyModel(i), { firepower: 0, speed: 0, traction: 0 });
      });
      for (const t of world.tanks) scene.snapTank(t);
      if (racing) newRace(false);
    },
    updateNotes,
    racing ? { maxDummies, onRace: (action) => newRace(action === 'new') } : null,
  );
  document.body.appendChild(menu.element);

  // In a race nothing moves before the start or after the finish.
  const send = (input: Parameters<World['input']>[1]) => {
    if (!racing || phase === 'racing') world.input(me.id, input);
  };
  const controls = new Controls(canvas, scene, () => world, () => me, send, {
    instantClickMarker: false,
    mobile,
    onKey: (code) => {
      if (racing && code === 'Enter') newRace(true);
      else if (racing && code === 'KeyR') newRace(false);
      else if (code === 'KeyT') panel.toggle();
      else if (code === 'KeyP') menu.toggle();
      else if (code === 'KeyF') {
        tuning.combat.firingEnabled = !tuning.combat.firingEnabled;
        if (!tuning.combat.firingEnabled) world.projectiles = [];
        menu.refresh();
      } else if (code !== 'KeyC') return false;
      updateNotes();
      return true;
    },
  });
  updateNotes();
  if (mobile) {
    hud.enableBarTaps(() => controls.useAbility(), (slot) => controls.useSlot(slot));
    // No Enter or R on a phone: a tap after the finish starts the next race.
    canvas.addEventListener('pointerdown', () => {
      if (racing && phase === 'finished') newRace(true);
    });
  }

  // Main loop: physics in fixed steps, drawing smoothed in between
  const timer = new THREE.Timer();
  let accumulator = 0;
  scene.renderer.setAnimationLoop((timestamp: number) => {
    timer.update(timestamp);
    const frameDt = Math.min(timer.getDelta(), 0.25);
    accumulator += frameDt;
    if (racing && phase !== 'racing') {
      // Countdown (or finished): the world waits.
      accumulator = 0;
      if (phase === 'countdown') {
        countdownLeft -= frameDt;
        if (countdownLeft <= 0) {
          phase = 'racing';
          goShownUntil = timer.getElapsed() + 0.9;
        }
      }
    }
    while (accumulator >= world.dt) {
      scene.capture(world);
      dummyBrain.update(world);
      world.step();
      const events = world.takeEvents();
      for (const e of events) {
        if (e.type === 'click-accepted' && e.tankId === me.id) scene.clickMarker(e.x, e.z);
        else if (e.type === 'respawned') scene.snapTank(world.tanks[e.tankId]!);
        else if (e.type === 'race-won') phase = 'finished';
      }
      scene.effects(events, me.id, world.tanks);
      accumulator -= world.dt;
    }
    const time = timer.getElapsed();
    controls.update();
    const pickable = controls.pickable();
    const ownPos = scene.draw(world, me.id, accumulator / world.dt, time, frameDt, world.canFire(me));
    scene.showAiming(controls.aimingSlot !== null, me, pickable, world.tanks, time);
    scene.showGrenadeAim(controls.aimingGrenade, me, controls.pointer);

    const dummyFalls = world.tanks.slice(1).reduce((n, t) => n + t.eliminations, 0);
    const fallBanner =
      me.status === 'falling'
        ? `Back on the ${racing ? 'track' : 'ice'} in ${Math.max(0, tuning.rules.respawnSeconds - me.fallTime).toFixed(1)} s`
        : me.disabledLeft > 0
          ? `Disabled by EMP · ${me.disabledLeft.toFixed(1)} s`
          : null;
    if (racing) {
      const laps = tuning.race.laps;
      const order = world.raceOrder();
      const place = order.indexOf(me) + 1;
      const penalty = world.racePenalty(me);
      hud.setStats(
        `Lap ${Math.min(laps, me.raceLaps + 1)} of ${laps} · Position ${place} of ${order.length}${penalty > 0 ? ` (−${Math.round(penalty * 100)}% speed and traction)` : ''} · You fell: ${me.eliminations} · Hits dealt: ${me.hitsDealt}`,
      );
      hud.setScoreboard(
        order.map((t) => ({
          name: t.name,
          color: colorOf(t),
          score: t.id === world.raceWinnerId ? 'winner' : `lap ${Math.min(laps, t.raceLaps + 1)}`,
          isYou: t === me,
          watching: false,
        })),
        `Race · ${laps} laps`,
        true,
      );
      if (phase === 'countdown') hud.setBanner(String(Math.max(1, Math.ceil(countdownLeft))), true);
      else if (phase === 'finished') {
        const winner = world.raceWinnerId !== null ? world.tanks[world.raceWinnerId] : undefined;
        const ordinal = (k: number) => `${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'}`;
        hud.setBanner(
          `${winner === me ? 'You win!' : `${winner?.name ?? 'Someone'} wins`} · you finished ${ordinal(place)} of ${order.length} · ${mobile ? 'tap for the next race' : 'Enter: new track · R: same track again'}`,
        );
      } else if (time < goShownUntil) hud.setBanner('GO!', true);
      else hud.setBanner(fallBanner);
    } else {
      hud.setStats(
        `You knocked off: ${me.knockouts} · Dummies fell: ${dummyFalls} · You fell: ${me.eliminations} · Hits dealt: ${me.hitsDealt} · Hits taken: ${me.hitsTaken}`,
      );
      hud.setBanner(fallBanner);
    }
    hud.updateBar(world, me, controls.aimingSlot);
    hud.updateOverlays({
      world,
      own: me,
      camera: scene.view.camera,
      colorOf,
      label: (t) => MODEL_LETTERS[t.model],
      aiming: controls.aimingSlot !== null,
      aimingGrenade: controls.aimingGrenade,
      pickable,
      time,
    });
    scene.render(frameDt, me, ownPos);
  });

  // Handy for automated checks in the browser console.
  (window as unknown as { __practice: unknown }).__practice = { world, view: scene.view, tuning, newRace, phase: () => phase };
  if (racing) {
    // Race: dummies beyond the default count stay off, then the first race starts.
    world.tanks.forEach((t, i) => {
      if (t.isDummy && i > setup.dummyCount) world.removeTank(t);
    });
    newRace(true);
  }
}
