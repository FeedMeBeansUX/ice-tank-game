import * as THREE from 'three';
import { DummyBrain, World, createTuning, type TankModel, type TankState } from '@ice-tank-sumo/shared';
import { Controls } from './controls';
import { Hud } from './hud';
import { PracticeMenu, type PracticeSetup } from './practiceMenu';
import { GameScene } from './scene';
import { DUMMY_COLOR, MODEL_LETTERS, PLAYER_COLORS } from './tankView';
import { TuningPanel } from './tuningPanel';

/**
 * Practice mode: your tank and one to three dummy tanks on the ice. The whole game
 * runs here in the browser using the shared simulation, with the slider
 * panel (T) and practice setup (P).
 */
export function startPractice(canvas: HTMLCanvasElement, buildLabel: string): void {
  const OWN_COLOR = PLAYER_COLORS[0]!;
  const DUMMY_SHOT_COLOR = '#e4eaef';

  const tuning = createTuning();
  const world = new World(tuning, 20261028);
  let setup: PracticeSetup = { model: 'modelA', upgrades: { firepower: 0, speed: 0, traction: 0 }, dummies: 'modelA', dummyCount: 3 };
  // Mixed: one of each tank other than yours.
  const ALL: TankModel[] = ['modelA', 'modelB', 'modelC', 'modelD', 'modelE'];
  const dummyModel = (i: number): TankModel => {
    if (setup.dummies !== 'mixed') return setup.dummies;
    const others = ALL.filter((m) => m !== setup.model);
    return others[(i - 1) % others.length]!;
  };
  ['You', 'Dummy 1', 'Dummy 2', 'Dummy 3'].forEach((name, i) => {
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

  const panel = new TuningPanel(tuning, buildLabel, (path) => {
    if (path === 'arena.radius') scene.rebuildArena();
  });
  document.body.appendChild(panel.element);

  const hud = new Hud((tankId) => controls.fireMissileAt(tankId));
  hud.setMode(
    'practice',
    `<div class="hud-help"><span><kbd>Click</kbd> turn and push</span><span><kbd>Shift</kbd> ability</span><span><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> powerups</span></div>` +
      `<div class="hud-help"><span><kbd>F</kbd> firing on/off</span><span><kbd>P</kbd> practice</span><span><kbd>T</kbd> tuning</span><span><kbd>C</kbd> overview</span></div>`,
  );
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
      world.reconfigure(me, setup.model, setup.upgrades);
      world.tanks.forEach((t, i) => {
        if (!t.isDummy) return;
        // Dummies beyond the chosen count are taken off the ice.
        if (i > setup.dummyCount) world.removeTank(t);
        else world.reconfigure(t, dummyModel(i), { firepower: 0, speed: 0, traction: 0 });
      });
      for (const t of world.tanks) scene.snapTank(t);
    },
    updateNotes,
  );
  document.body.appendChild(menu.element);

  const controls = new Controls(canvas, scene, () => world, () => me, (input) => world.input(me.id, input), {
    instantClickMarker: false,
    onKey: (code) => {
      if (code === 'KeyT') panel.toggle();
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

  // Main loop: physics in fixed steps, drawing smoothed in between
  const timer = new THREE.Timer();
  let accumulator = 0;
  scene.renderer.setAnimationLoop((timestamp: number) => {
    timer.update(timestamp);
    const frameDt = Math.min(timer.getDelta(), 0.25);
    accumulator += frameDt;
    while (accumulator >= world.dt) {
      scene.capture(world);
      dummyBrain.update(world);
      world.step();
      const events = world.takeEvents();
      for (const e of events) {
        if (e.type === 'click-accepted' && e.tankId === me.id) scene.clickMarker(e.x, e.z);
        else if (e.type === 'respawned') scene.snapTank(world.tanks[e.tankId]!);
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
    hud.setStats(
      `You knocked off: ${me.knockouts} · Dummies fell: ${dummyFalls} · You fell: ${me.eliminations} · Hits dealt: ${me.hitsDealt} · Hits taken: ${me.hitsTaken}`,
    );
    hud.setBanner(
      me.status === 'falling'
        ? `Back on the ice in ${Math.max(0, tuning.rules.respawnSeconds - me.fallTime).toFixed(1)} s`
        : me.disabledLeft > 0
          ? `Disabled by EMP · ${me.disabledLeft.toFixed(1)} s`
          : null,
    );
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
  (window as unknown as { __practice: unknown }).__practice = { world, view: scene.view, tuning };
}
