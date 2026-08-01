// Browser host bootstrap: builds Sim -> SimWorld (IWorld) -> Renderer + Hud +
// Input, and runs the fixed-timestep loop (30 Hz sim, rAF render).
// Saves live in localStorage under one slot. The host may touch the DOM;
// the sim never does.

// Browser host. Two modes:
//   OFFLINE (default): local Sim + SimWorld, localStorage save slot.
//   ONLINE  (?ws=wss://host): authenticated ClientWorld over
//   WebSocket; the server owns simulation and persistence (D-014/D-016).

import { Sim } from './sim/sim';
import { SimWorld } from './game/sim_world';
import { ClientWorld } from './net/client_world';
import { AuthenticatedClientSession } from './net/authenticated_session';
import {
  BrowserConnection,
  type ConnectionStatus,
} from './net/browser_connection';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { Input } from './game/input';
import { CombatAudio, parseAudioSettings } from './game/combat_audio';
import { equippedAttackKind } from './game/host_actions';
import { AuthGate } from './ui/auth_gate';
import { DT } from './sim/types';
import type { IWorld } from './world_api';

const WORLD_SEED = 20260730;
const SAVE_KEY = 'claurim_save_v1';
const AUDIO_SETTINGS_KEY = 'claurim_audio_v1';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const wsUrl = params.get('ws');
const online = wsUrl !== null;

let sim: Sim | null = null;
let world: IWorld;
let clientWorld: ClientWorld | null = null;

if (online) {
  clientWorld = new ClientWorld();
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
const combatAudio = new CombatAudio(
  canvas,
  parseAudioSettings(localStorage.getItem(AUDIO_SETTINGS_KEY)),
  (settings) => localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)),
);
const hud = new Hud(
  world,
  (events) => combatAudio.handle(events, world.player().id),
  combatAudio,
);
const input = new Input(canvas);
if (!online) input.yaw = world.player().yaw;

let connection: BrowserConnection | null = null;
let authSession: AuthenticatedClientSession | null = null;
let authGate: AuthGate | null = null;
let networkBadgeAt = 0;
if (clientWorld && wsUrl) {
  const onlineWorld = clientWorld;
  const transportAllowed = browserTransportAllowed(wsUrl);
  authSession = new AuthenticatedClientSession(onlineWorld, (state) => {
    if (state.authenticated) authGate?.hide();
    else authGate?.show(state.error);
  });
  const session = authSession;
  authGate = new AuthGate((credentials) => {
    if (!transportAllowed) {
      authGate?.show('Remote accounts require a secure wss:// connection.');
      return;
    }
    session.setCredentials(credentials);
    authGate?.setError('');
    authGate?.setBusy(true);
    connection?.restart();
  });
  const gate = authGate;
  if (!transportAllowed) {
    gate.show('Remote accounts require a secure wss:// connection.');
  }
  connection = new BrowserConnection(wsUrl, session, {
    onStatus: (status) => {
      const presentation = connectionPresentation(status);
      hud.setConnectionStatus(presentation.text, presentation.tone);
      if (status.phase === 'rejected' || status.phase === 'disconnected') gate.show(status.reason);
      else if (status.phase === 'online') gate.hide();
    },
  });
  const onlineConnection = connection;
  (globalThis as unknown as Record<string, unknown>).__claurimNet = {
    get status() {
      return onlineConnection.status();
    },
    diagnostics: () => onlineWorld.diagnostics(),
    retry: () => onlineConnection.retryNow(),
  };
  addEventListener('beforeunload', () => connection?.stop('page closing'), { once: true });
}

function browserTransportAllowed(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, location.href);
    if (url.protocol === 'wss:') return true;
    if (url.protocol !== 'ws:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

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
    combatAudio,
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
  if (cmd.escape) {
    if (hud.isInputCaptured()) hud.closeAll();
    else hud.toggleSettings();
  }
  if (cmd.toggleInventory) hud.togglePanel('inventory');
  if (cmd.toggleJournal) hud.togglePanel('journal');
  if (cmd.togglePerks) hud.togglePanel('perks');
  if (cmd.toggleSocial) hud.togglePanel('social');
  if (cmd.toggleChat) hud.openChat();
  if (cmd.toggleHelp) hud.toggleControls();
  if (cmd.toggleCamera) renderer.firstPerson = !renderer.firstPerson;
  if (cmd.interact) world.interact();
  const menuOpen = hud.isInputCaptured();
  if (!menuOpen) {
    if (cmd.melee) {
      // Weapon-appropriate: bow fires, otherwise melee swing.
      if (equippedAttackKind(world.playerInventory()) === 'ranged') world.attackRanged();
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
      pitch: input.pitch,
      sprint: !menuOpen && input.sprint(),
      sneak: !menuOpen && input.sneak(),
      block: !menuOpen && input.blockHeld,
      jump: !menuOpen && input.jump(),
    });
  }

  hud.update(dtSec);
  if (connection?.status().phase === 'online' && clientWorld && now >= networkBadgeAt) {
    const latency = Math.round(clientWorld.diagnostics().lastAckLatencyMs);
    hud.setConnectionStatus(latency > 0 ? `Online · ${latency} ms authority` : 'Online', 'online');
    networkBadgeAt = now + 1_000;
  }
  combatAudio.update(world.spaceKind(world.currentSpace()), world.gameHours());
  renderer.render(dtSec, accumulator / DT);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function connectionPresentation(status: ConnectionStatus): {
  text: string | null;
  tone: 'pending' | 'online' | 'error';
} {
  switch (status.phase) {
    case 'idle':
      return { text: null, tone: 'pending' };
    case 'connecting':
      return { text: 'Connecting to server…', tone: 'pending' };
    case 'synchronizing':
      return { text: 'Synchronizing world…', tone: 'pending' };
    case 'online':
      return { text: 'Online', tone: 'online' };
    case 'reconnecting': {
      const seconds = status.retryInMs === undefined ? null : Math.max(0.1, status.retryInMs / 1_000);
      const timing = seconds === null ? '' : ` in ${seconds.toFixed(1)}s`;
      return {
        text: `Connection lost · retry ${status.attempt}/${status.maxAttempts}${timing}`,
        tone: 'pending',
      };
    }
    case 'rejected':
      return { text: `Connection refused · ${status.reason ?? 'session rejected'}`, tone: 'error' };
    case 'disconnected':
      return { text: `Disconnected · ${status.reason ?? 'reload to retry'}`, tone: 'error' };
  }
}
