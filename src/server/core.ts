// ServerCore: the transport-agnostic authoritative server (D-014). Owns THE
// Sim, validates every inbound message, consumes per-client input queues at
// the fixed tick, replicates interest-scoped snapshots, and persists
// characters + world through the storage seam. A WebSocket adapter
// (ws_host.ts) and the in-memory test transport both drive this same class;
// the transport never touches the sim directly.

import { Sim, IDLE_INPUT, type PlayerInput } from '../sim/sim';
import { clampAimPitch } from '../sim/player/aim';
import { SimWorld } from '../game/sim_world';
import { isActiveAt } from '../sim/world/cells';
import type { SimEvent } from '../sim/types';
import { parseCharacterSave } from '../sim/save/save';
import {
  PROTOCOL_VERSION,
  parseClientMessage,
  type ClientMessage,
  type SelfState,
  type ServerMessage,
} from '../net/protocol';
import type { StorageProvider } from './storage';
import type { AuthenticatedIdentity } from './auth';

/** Snapshots every N sim ticks: 30 Hz sim / 3 = 10 Hz replication (D-014). */
export const SNAPSHOT_EVERY = 3;
/** Periodic persistence interval in ticks (30 s). */
export const PERSIST_EVERY = 900;
/** Exterior interest radius in cells matches the sim activity window. */

export type SendFn = (msg: ServerMessage) => void;

interface ClientState {
  connId: string;
  identity: AuthenticatedIdentity;
  charId: string | null;
  send: SendFn;
  inputQueue: { seq: number; input: PlayerInput }[];
  lastInput: PlayerInput;
  lastReceivedSeq: number;
  ackSeq: number;
  pendingEvents: SimEvent[];
  view: SimWorld | null;
  protocolErrors: number;
  lastChatTick: number;
}

export class ServerCore {
  readonly sim: Sim;
  private clients = new Map<string, ClientState>();
  /** connId by charId, to detect reconnect-takeover. */
  private connByChar = new Map<string, string>();

  constructor(
    readonly storage: StorageProvider,
    seed = 20260731,
  ) {
    const worldJson = storage.loadWorld();
    if (worldJson) {
      let loaded: Sim | null = null;
      try {
        loaded = Sim.load(worldJson);
      } catch (err) {
        // Corrupt world save: refuse to half-load; start a fresh world and
        // keep the bad file untouched for operator inspection.
        console.error('[server] world save rejected, starting fresh:', err);
      }
      if (loaded) {
        // Characters persist individually; the world save only carries world
        // deltas. Remove any character actors that were resident at save time.
        for (const charId of [...loaded.players.keys()]) loaded.removePlayer(charId, { preserveParty: true });
        this.sim = loaded;
      } else {
        this.sim = new Sim(seed, undefined, { noDefaultPlayer: true });
      }
    } else {
      this.sim = new Sim(seed, undefined, { noDefaultPlayer: true });
    }
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  connect(connId: string, send: SendFn, identity: AuthenticatedIdentity): void {
    this.clients.set(connId, {
      connId,
      identity,
      charId: null,
      send,
      inputQueue: [],
      lastInput: { ...IDLE_INPUT },
      lastReceivedSeq: -1,
      ackSeq: -1,
      pendingEvents: [],
      view: null,
      protocolErrors: 0,
      lastChatTick: Number.NEGATIVE_INFINITY,
    });
  }

  disconnect(connId: string): void {
    const client = this.clients.get(connId);
    if (!client) return;
    if (client.charId) {
      this.persistCharacter(client.charId);
      // Character leaves the live world on disconnect (linkdead policy:
      // immediate despawn; documented in MULTIPLAYER_STATE_MODEL.md).
      this.sim.removePlayer(client.charId, { preserveParty: true });
      this.connByChar.delete(client.charId);
      this.storage.saveWorld(this.sim.saveToJson());
    }
    this.clients.delete(connId);
  }

  /** Raw inbound data from the transport. */
  onMessage(connId: string, data: string): void {
    const client = this.clients.get(connId);
    if (!client) return;
    const msg = parseClientMessage(data);
    if (!msg) {
      client.protocolErrors++;
      client.send({ t: 'reject', reason: 'malformed message' });
      if (client.protocolErrors > 20) {
        client.send({ t: 'bye', reason: 'protocol violations' });
        this.disconnect(connId);
      }
      return;
    }
    if (msg.t === 'hello') {
      this.handleHello(client, msg);
      return;
    }
    if (!client.charId) {
      client.send({ t: 'reject', reason: 'not joined' });
      return;
    }
    switch (msg.t) {
      case 'input': {
        for (const input of msg.inputs) {
          if (input.seq <= client.lastReceivedSeq) continue; // duplicate/replay
          client.lastReceivedSeq = input.seq;
          // Bound the queue: a client cannot bank unlimited future movement.
          if (client.inputQueue.length >= 12) continue;
          client.inputQueue.push({
            seq: input.seq,
            input: {
              moveX: clamp(input.moveX, -1, 1),
              moveZ: clamp(input.moveZ, -1, 1),
              yaw: input.yaw % (Math.PI * 2),
              pitch: clampAimPitch(input.pitch),
              sprint: input.sprint,
              sneak: input.sneak,
              block: input.block,
              jump: input.jump,
            },
          });
        }
        break;
      }
      case 'cmd':
        this.handleCommand(client, msg);
        break;
      case 'ping':
        client.send({ t: 'pong', ts: msg.ts });
        break;
    }
  }

  private handleHello(client: ClientState, msg: Extract<ClientMessage, { t: 'hello' }>): void {
    if (msg.protocol !== PROTOCOL_VERSION) {
      client.send({ t: 'reject', reason: `protocol ${msg.protocol} unsupported (server: ${PROTOCOL_VERSION})` });
      return;
    }
    if (client.charId) {
      client.send({ t: 'reject', reason: 'already joined' });
      return;
    }
    const character = client.identity.characters.find((owned) => owned.charId === msg.charId);
    if (!character) {
      client.send({ t: 'reject', reason: 'character not owned by account' });
      return;
    }
    // Reconnect-takeover: a live connection for the same character is
    // superseded (old socket gets bye; character state persists in place).
    const existingConn = this.connByChar.get(msg.charId);
    if (existingConn) {
      const old = this.clients.get(existingConn);
      if (old) {
        if (old.identity.accountId !== client.identity.accountId) {
          client.send({ t: 'reject', reason: 'character already active' });
          return;
        }
        old.send({ t: 'bye', reason: 'session superseded by new connection' });
        old.charId = null;
        this.clients.delete(existingConn);
      }
      this.connByChar.delete(msg.charId);
      // Keep the actor in-world: seamless takeover.
      if (!this.sim.players.has(msg.charId)) {
        this.spawnCharacter(msg.charId, character.name);
      }
    } else if (!this.sim.players.has(msg.charId)) {
      this.spawnCharacter(msg.charId, character.name);
    }
    client.charId = msg.charId;
    client.view = new SimWorld(this.sim, msg.charId);
    this.connByChar.set(msg.charId, client.connId);
    const entityId = this.sim.players.get(msg.charId)!;
    client.send({
      t: 'welcome',
      protocol: PROTOCOL_VERSION,
      charId: msg.charId,
      entityId,
      seed: this.sim.seed,
      tick: this.sim.tickCount,
      snapshotEvery: SNAPSHOT_EVERY,
    });
  }

  private spawnCharacter(charId: string, name: string): void {
    const saved = this.storage.loadCharacter(charId);
    if (saved) {
      try {
        const record = parseCharacterSave(saved);
        this.sim.addPlayer(charId, record.name, record);
        return;
      } catch (err) {
        console.error(`[server] character ${charId} save rejected, creating fresh:`, err);
      }
    }
    this.sim.addPlayer(charId, name);
    this.persistCharacter(charId);
  }

  private handleCommand(client: ClientState, msg: Extract<ClientMessage, { t: 'cmd' }>): void {
    const charId = client.charId!;
    const sim = this.sim;
    switch (msg.kind) {
      case 'melee':
        sim.meleeFor(charId);
        break;
      case 'ranged':
        sim.rangedFor(charId);
        break;
      case 'cast':
        if (msg.arg) sim.castFor(charId, msg.arg);
        break;
      case 'useItem':
        if (msg.arg) sim.useItemFor(charId, msg.arg);
        break;
      case 'equip':
        if (msg.arg) sim.equipFor(charId, msg.arg);
        break;
      case 'perk':
        if (msg.arg) sim.takePerkFor(charId, msg.arg);
        break;
      case 'interact':
        sim.interactFor(charId);
        break;
      case 'dialogueChoose':
        if (msg.index !== undefined) sim.dialogueChooseFor(charId, msg.index);
        break;
      case 'dialogueEnd':
        sim.dialogueEndFor(charId);
        break;
      case 'shopBuy':
        if (msg.arg) sim.shopBuyFor(charId, msg.arg);
        break;
      case 'shopSell':
        if (msg.arg) sim.shopSellFor(charId, msg.arg);
        break;
      case 'shopClose':
        sim.shopCloseFor(charId);
        break;
      case 'respawn':
        sim.releasePlayer(charId);
        break;
      case 'recover':
        sim.recoverPlayer(charId);
        break;
      case 'chat':
        if (msg.arg && sim.tickCount - client.lastChatTick >= 15) {
          if (sim.chatFrom(charId, msg.arg)) client.lastChatTick = sim.tickCount;
        }
        break;
      case 'partyInvite':
        if (msg.targetId !== undefined) sim.inviteToParty(charId, msg.targetId);
        break;
      case 'partyAccept':
        if (sim.acceptPartyInvite(charId) === 'joined') this.storage.saveWorld(sim.saveToJson());
        break;
      case 'partyDecline':
        sim.declinePartyInvite(charId);
        break;
      case 'partyLeave':
        if (sim.leaveParty(charId)) this.storage.saveWorld(sim.saveToJson());
        break;
    }
  }

  // -------------------------------------------------------------------------
  // The authoritative tick
  // -------------------------------------------------------------------------

  /** Advance one fixed tick: consume one queued input per connected player
   * (repeating the last input on starvation, holding position on none),
   * advance the sim, distribute events, and emit snapshots on cadence. */
  tick(): void {
    const inputs = new Map<string, PlayerInput>();
    for (const client of this.clients.values()) {
      if (!client.charId) continue;
      const next = client.inputQueue.shift();
      if (next) {
        client.lastInput = next.input;
        client.ackSeq = next.seq;
      }
      // Starvation policy: reuse last MOVEMENT-neutral form of the input
      // (keep yaw/stances, stop translation) after a short gap.
      const input = next?.input ?? { ...client.lastInput, moveX: 0, moveZ: 0, jump: false };
      inputs.set(client.charId, input);
    }
    this.sim.tick(inputs);

    // Distribute this tick's events to interested clients.
    const events = this.sim.events;
    this.sim.events = [];
    for (const client of this.clients.values()) {
      if (!client.charId || !client.view) continue;
      for (const e of events) {
        if (this.eventVisibleTo(client, e)) client.pendingEvents.push(e);
      }
      if (client.pendingEvents.length > 200) {
        client.pendingEvents.splice(0, client.pendingEvents.length - 200);
      }
    }

    if (this.sim.tickCount % SNAPSHOT_EVERY === 0) this.broadcastSnapshots();
    if (this.sim.tickCount % PERSIST_EVERY === 0) this.persistAll();
  }

  private eventVisibleTo(client: ClientState, e: SimEvent): boolean {
    const charId = client.charId!;
    const self = this.sim.playerActor(charId);
    if (!self) return false;
    const selfId = self.id;
    switch (e.type) {
      case 'skillUp':
      case 'levelUp':
        return e.playerId === selfId;
      case 'questStarted':
      case 'questAdvanced':
      case 'questCompleted':
      case 'objectiveProgress':
        return e.charId === charId;
      case 'partyStatus':
        return e.charId === charId;
      case 'itemAdded':
      case 'itemRemoved':
        return e.actorId === selfId;
      case 'actionRejected':
        return e.actorId === selfId;
      case 'spaceEntered':
      case 'talkedTo':
      case 'playerRecovered':
      case 'recoveryRejected':
        return e.playerId === selfId;
      case 'interacted':
        return e.actorId === selfId;
      case 'damage':
      case 'heal':
      case 'death':
      case 'effectApplied': {
        // Local combat feed: only when the subject shares the player's space.
        const subject = this.sim.actors.get('targetId' in e ? e.targetId : selfId);
        return !!subject && subject.pos.spaceId === self.pos.spaceId;
      }
      case 'telegraph':
      case 'interrupted':
      case 'bossPhase':
      case 'encounterWipe': {
        const src = this.sim.actors.get('sourceId' in e ? e.sourceId : 'bossId' in e ? e.bossId : 0);
        return !!src && src.pos.spaceId === self.pos.spaceId;
      }
      case 'chat': {
        const speaker = this.sim.actors.get(e.playerId);
        return !!speaker && speaker.pos.spaceId === self.pos.spaceId;
      }
      case 'playerDowned':
      case 'playerRevived':
      case 'playerReleased': {
        // Party-wide + same-space observers.
        const subject = this.sim.actors.get(e.playerId);
        if (!subject) return false;
        if (subject.pos.spaceId === self.pos.spaceId) return true;
        const subjectChar = [...this.sim.players].find(([, id]) => id === e.playerId)?.[0];
        return !!subjectChar && this.sim.partyMembersOf(charId).includes(subjectChar);
      }
      default:
        return true;
    }
  }

  private broadcastSnapshots(): void {
    for (const client of this.clients.values()) {
      if (!client.charId || !client.view) continue;
      const self = this.sim.playerActor(client.charId);
      if (!self) continue;
      const view = client.view;
      const exterior = this.sim.content.spaces[self.pos.spaceId]?.kind === 'exterior';
      // Interest management (D-014): same space, and for exteriors within the
      // cell activity window around the player.
      const actors = view.actorsInSpace().filter((a) =>
        isActiveAt(self.pos.spaceId, self.pos.x, self.pos.z, self.pos.spaceId, a.x, a.z, exterior),
      );
      const selfState: SelfState = {
        charId: client.charId,
        entityId: self.id,
        x: self.pos.x,
        y: self.pos.y,
        z: self.pos.z,
        yaw: self.yaw,
        aimPitch: self.aimPitch,
        spaceId: self.pos.spaceId,
        spaceKind: exterior ? 'exterior' : 'interior',
        downed: self.downed,
        downedTicks: self.downedTicks,
        movement: {
          moveSpeed: self.stats.moveSpeed,
          staminaRegen: self.stats.staminaRegen,
          sprinting: self.sprinting,
        },
        resources: view.playerResources(),
        inventory: view.playerInventory(),
        skills: view.playerSkills(),
        knownSpells: view.knownSpells(),
        journal: view.journal(),
        perks: view.perks(),
        partyId: view.partyId(),
        party: view.party(),
        partyInvites: view.partyInvites(),
        dialogue: view.dialogueView(),
        shop: view.shopView(),
        prompt: view.nearestInteractablePrompt(),
      };
      client.send({
        t: 'snapshot',
        tick: this.sim.tickCount,
        ackSeq: client.ackSeq,
        gameHours: this.sim.gameHours(),
        self: selfState,
        actors,
        projectiles: view.projectilesInSpace(),
        aoes: view.groundAoesInSpace(),
        events: client.pendingEvents.splice(0),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  persistCharacter(charId: string): void {
    const record = this.sim.extractCharacter(charId);
    if (record) this.storage.saveCharacter(charId, JSON.stringify(record));
  }

  persistAll(): void {
    for (const client of this.clients.values()) {
      if (client.charId) this.persistCharacter(client.charId);
    }
    this.storage.saveWorld(this.sim.saveToJson());
  }

  /** Clean shutdown: persist everything and notify clients. */
  shutdown(): void {
    for (const client of this.clients.values()) {
      client.send({ t: 'bye', reason: 'server shutting down' });
    }
    this.persistAll();
  }

  connectedCount(): number {
    let n = 0;
    for (const c of this.clients.values()) if (c.charId) n++;
    return n;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
