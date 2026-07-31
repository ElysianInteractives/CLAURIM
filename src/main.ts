// Browser host bootstrap: builds Sim -> SimWorld (IWorld) -> Renderer + Hud +
// Input, and runs the fixed-timestep loop (30 Hz sim, rAF render).
// Saves live in localStorage under one slot. The host may touch the DOM;
// the sim never does.

// Browser host. Two modes:
//   OFFLINE (default): local Sim + SimWorld, localStorage save slot.
//   ONLINE  (?ws=ws://host:8787&char=<id>&name=<display>): ClientWorld over
//   WebSocket; the server owns simulation and persistence (D-014/D-016).

import { Sim } from './sim/sim';
import { SimWorld } from './game/sim_world';
import { ClientWorld } from './net/client_world';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { Input } from './game/input';
import { DT } from './sim/types';
import type { IWorld } from './world_api';

const WORLD_SEED = 20260730;
const SAVE_KEY = 'claurim_save_v1';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const wsUrl = params.get('ws');
const online = wsUrl !== null;

let sim: Sim | null = null;
let world: IWorld;
let clientWorld: ClientWorld | null = null;

if (online) {
  const charId = params.get('char') ?? `guest_${Math.floor(Math.random() * 1e6)}`;
  const name = params.get('name') ?? charId;
  const socket = new WebSocket(wsUrl!);
  clientWorld = new ClientWorld({ send: (json) => socket.send(json) }, charId, name);
  socket.addEventListener('message', (ev) => clientWorld!.onMessage(String(ev.data)));
  socket.addEventListener('close', () => console.warn('[claurim] server connection closed'));
  world = clientWorld;
} else {
  const stored = localStorage.getItem(SAVE_KEY);
  if (stored) {
    try {
      sim = Sim.load(stored);
    } catch (err) {
      console.warn('save rejected, starting fresh:', err);
      sim = new Sim(WORLD_SEED);
    }
  } else {
    sim = new Sim(WORLD_SEED);
  }
  world = new SimWorld(sim);
}

const renderer = new Renderer(world, canvas);
const hud = new Hud(world);
const input = new Input(canvas);
if (!online) input.yaw = world.player().yaw;

// Offline-only debug/inspection handle (screenshot tours, manual QA).
// Never exposed online: the server is authoritative there and the client
// holds nothing worth cheating with.
if (!online) {
  (globalThis as unknown as Record<string, unknown>).__claurim = {
    get sim() {
      return sim;
    },
    world,
    renderer,
    input,
  };
}

addEventListener('resize', () => renderer.resize());

let accumulator = 0;
let last = performance.now();

function frame(now: number): void {
  const dtSec = Math.min(0.1, (now - last) / 1000);
  last = now;

  // One-shot commands.
  const cmd = input.drainCommands();
  if (cmd.escape) hud.closeAll();
  if (cmd.toggleInventory) hud.togglePanel('inventory');
  if (cmd.toggleJournal) hud.togglePanel('journal');
  if (cmd.togglePerks) hud.togglePanel('perks');
  if (cmd.toggleCamera) renderer.firstPerson = !renderer.firstPerson;
  if (cmd.interact) world.interact();
  const menuOpen = hud.isMenuOpen();
  if (!menuOpen) {
    if (cmd.melee) {
      // Weapon-appropriate: bow fires, otherwise melee swing.
      const inv = world.playerInventory();
      const mainHand = inv.find((i) => i.equipped && i.kind === 'weapon');
      if (mainHand && mainHand.itemId === 'hunting_bow') world.attackRanged();
      else world.attackMelee();
    }
    if (cmd.spell1) world.castSpell('flamebolt');
    if (cmd.spell2) world.castSpell('mend_wounds');
  }
  if (cmd.save) {
    if (online) {
      hud.notify('Online: the server saves your character');
    } else {
      localStorage.setItem(SAVE_KEY, world.saveGame());
      hud.notify('Game saved');
    }
  }
  if (cmd.load && !online) {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        sim = Sim.load(raw);
        world = new SimWorld(sim);
        // Rebind observers to the new world instance.
        (renderer as unknown as { world: IWorld }).world = world;
        (hud as unknown as { world: IWorld }).world = world;
        input.yaw = world.player().yaw;
        hud.notify('Game loaded');
      } catch (err) {
        hud.notify('Save could not be loaded');
        console.warn(err);
      }
    }
  }

  // Camera zoom.
  const wheel = input.drainWheel();
  if (wheel !== 0) {
    renderer.cameraDistance = Math.max(2.2, Math.min(14, renderer.cameraDistance + wheel * 0.01));
  }
  renderer.cameraYaw = input.yaw;
  renderer.cameraPitch = input.pitch;

  // Fixed-step simulation (offline: advances the local sim; online: sends the
  // input to the server and advances local prediction).
  accumulator += dtSec;
  const axes = menuOpen ? { x: 0, z: 0 } : input.moveAxes();
  const worldReady = !clientWorld || clientWorld.ready();
  while (accumulator >= DT) {
    accumulator -= DT;
    if (!worldReady) continue;
    world.step({
      moveX: axes.x,
      moveZ: axes.z,
      yaw: input.yaw,
      sprint: !menuOpen && input.sprint(),
      sneak: !menuOpen && input.sneak(),
      block: !menuOpen && input.blockHeld,
      jump: !menuOpen && input.jump(),
    });
  }

  hud.update(dtSec);
  renderer.render(dtSec);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
