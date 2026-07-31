// ClientWorld: the online implementation of IWorld (D-015). Mirrors
// server snapshots, predicts LOCAL movement from the same deterministic
// movement code the server runs, reconciles against acknowledged input
// sequences, and smooths remote actors. It never resolves gameplay outcomes:
// every command is a message to the authoritative server.

import { CONTENT } from '../sim/content';
import { CollisionIndex, resolveMove } from '../sim/world/collision';
import { groundHeight } from '../sim/world/spaces';
import { BASE_WALK_SPEED, DT, SNEAK_MULT, SPRINT_MULT, type SimEvent } from '../sim/types';
import {
  PROTOCOL_VERSION,
  parseServerMessage,
  type ClientMessage,
  type SelfState,
  type ServerMessage,
  type WireInput,
} from './protocol';
import type {
  ActorView,
  DialogueView,
  GroundAoeView,
  IWorld,
  JournalView,
  PartyMemberView,
  ProjectileView,
  ShopView,
} from '../world_api';
import type { PerkView } from '../world_api/menus';

export interface ClientTransport {
  send(json: string): void;
}

interface PendingInput {
  seq: number;
  input: WireInput;
}

/** Position error beyond which the client snaps instead of smoothing. */
const SNAP_DISTANCE = 3.0;
/** Remote-actor smoothing factor per frame (exponential interpolation). */
const REMOTE_SMOOTH = 0.35;

export class ClientWorld implements IWorld {
  private colliders = new CollisionIndex(CONTENT);
  private snapshot: Extract<ServerMessage, { t: 'snapshot' }> | null = null;
  private welcome: Extract<ServerMessage, { t: 'welcome' }> | null = null;
  private eventBuffer: SimEvent[] = [];
  private pending: PendingInput[] = [];
  private seq = 0;
  private predicted = { x: 0, y: 0, z: 0 };
  private predictedSpace = '';
  /** Smoothed display positions for remote actors. */
  private display = new Map<number, { x: number; y: number; z: number; yaw: number }>();
  rejectedReason: string | null = null;
  closed = false;

  constructor(
    private transport: ClientTransport,
    readonly charId: string,
    readonly name: string,
  ) {
    this.sendMsg({ t: 'hello', protocol: PROTOCOL_VERSION, charId, name });
  }

  private sendMsg(msg: ClientMessage): void {
    this.transport.send(JSON.stringify(msg));
  }

  /** Transport delivers raw server data here. */
  onMessage(json: string): void {
    const msg = parseServerMessage(json);
    if (!msg) return;
    switch (msg.t) {
      case 'welcome':
        this.welcome = msg;
        break;
      case 'reject':
        this.rejectedReason = msg.reason;
        break;
      case 'bye':
        this.closed = true;
        this.rejectedReason = msg.reason;
        break;
      case 'snapshot': {
        const first = this.snapshot === null;
        this.snapshot = msg;
        this.eventBuffer.push(...msg.events);
        // Reconciliation (D-015): drop acknowledged inputs, then re-run the
        // remaining pending inputs from the server's authoritative position.
        this.pending = this.pending.filter((p) => p.seq > msg.ackSeq);
        const serverPos = { x: msg.self.x, y: msg.self.y, z: msg.self.z };
        if (first || msg.self.spaceId !== this.predictedSpace) {
          // Space transitions and late joins snap (never lerp across doors).
          this.predicted = serverPos;
          this.predictedSpace = msg.self.spaceId;
          this.pending = [];
        } else {
          let replay = { ...serverPos };
          for (const p of this.pending) {
            replay = this.stepMovement(replay, msg.self.spaceId, p.input, msg.self);
          }
          const err = Math.hypot(replay.x - this.predicted.x, replay.z - this.predicted.z);
          if (err > SNAP_DISTANCE) {
            this.predicted = replay;
          } else {
            // Gentle correction toward the reconciled position.
            this.predicted.x += (replay.x - this.predicted.x) * 0.4;
            this.predicted.z += (replay.z - this.predicted.z) * 0.4;
            this.predicted.y = replay.y;
          }
        }
        break;
      }
      case 'pong':
        break;
    }
  }

  ready(): boolean {
    return this.welcome !== null && this.snapshot !== null;
  }

  /** Deterministic client-side movement: the same resolveMove + terrain the
   * server uses, driven by intent only. */
  private stepMovement(
    from: { x: number; y: number; z: number },
    spaceId: string,
    input: WireInput,
    self: SelfState,
  ): { x: number; y: number; z: number } {
    let speed = BASE_WALK_SPEED;
    if (input.sprint && !input.sneak) speed *= SPRINT_MULT;
    if (input.sneak) speed *= SNEAK_MULT;
    if (input.block) speed *= 0.55;
    void self;
    const len = Math.hypot(input.moveX, input.moveZ);
    if (len < 0.01) {
      return { ...from, y: groundHeight(CONTENT, spaceId, from.x, from.z, this.seed()) };
    }
    const nx = input.moveX / Math.max(1, len);
    const nz = input.moveZ / Math.max(1, len);
    const wx = nx * Math.cos(input.yaw) + nz * Math.sin(input.yaw);
    const wz = -nx * Math.sin(input.yaw) + nz * Math.cos(input.yaw);
    return resolveMove(CONTENT, this.colliders, spaceId, from, wx * speed * DT, wz * speed * DT, this.seed());
  }

  // --- intent -------------------------------------------------------------

  step(input: Parameters<IWorld['step']>[0]): void {
    if (!this.ready() || !this.snapshot) return;
    const wire: WireInput = { seq: ++this.seq, ...input };
    this.pending.push({ seq: wire.seq, input: wire });
    if (this.pending.length > 120) this.pending.splice(0, this.pending.length - 120);
    this.sendMsg({ t: 'input', inputs: [wire] });
    // Predict own movement locally (position only; resources are server truth).
    if (!this.snapshot.self.downed) {
      this.predicted = this.stepMovement(this.predicted, this.predictedSpace, wire, this.snapshot.self);
    }
  }

  attackMelee(): boolean {
    this.sendMsg({ t: 'cmd', kind: 'melee' });
    return true;
  }

  attackRanged(): boolean {
    this.sendMsg({ t: 'cmd', kind: 'ranged' });
    return true;
  }

  castSpell(spellId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'cast', arg: spellId });
    return true;
  }

  interact(): 'none' | 'door' | 'container' | 'dialogue' | 'loot' {
    this.sendMsg({ t: 'cmd', kind: 'interact' });
    return 'none'; // authoritative result arrives via snapshot state
  }

  useItem(itemId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'useItem', arg: itemId });
    return true;
  }

  equipItem(itemId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'equip', arg: itemId });
    return true;
  }

  takePerk(perkId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'perk', arg: perkId });
    return true;
  }

  respawn(): void {
    this.sendMsg({ t: 'cmd', kind: 'respawn' });
  }

  saveGame(): string {
    // Online characters are server-persisted (D-016); nothing to save locally.
    return '';
  }

  chat(text: string): void {
    this.sendMsg({ t: 'cmd', kind: 'chat', arg: text });
  }

  dialogueChoose(index: number): void {
    this.sendMsg({ t: 'cmd', kind: 'dialogueChoose', index });
  }

  dialogueEnd(): void {
    this.sendMsg({ t: 'cmd', kind: 'dialogueEnd' });
  }

  shopBuy(itemId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'shopBuy', arg: itemId });
    return true;
  }

  shopSell(itemId: string): boolean {
    this.sendMsg({ t: 'cmd', kind: 'shopSell', arg: itemId });
    return true;
  }

  shopClose(): void {
    this.sendMsg({ t: 'cmd', kind: 'shopClose' });
  }

  // --- read ---------------------------------------------------------------

  seed(): number {
    return this.welcome?.seed ?? 0;
  }

  currentSpace(): string {
    return this.snapshot?.self.spaceId ?? 'kaldwyn';
  }

  spaceKind(spaceId: string): 'exterior' | 'interior' {
    return CONTENT.spaces[spaceId]?.kind ?? 'exterior';
  }

  gameHours(): number {
    return this.snapshot?.gameHours ?? 8;
  }

  actorsInSpace(): ActorView[] {
    if (!this.snapshot) return [];
    const selfId = this.snapshot.self.entityId;
    const out: ActorView[] = [];
    const seen = new Set<number>();
    for (const a of this.snapshot.actors) {
      seen.add(a.id);
      if (a.id === selfId) {
        // Local player renders at the PREDICTED position.
        out.push({ ...a, x: this.predicted.x, y: this.predicted.y, z: this.predicted.z });
        continue;
      }
      // Remote smoothing: move the display position toward the latest server
      // position each frame.
      let d = this.display.get(a.id);
      if (!d) {
        d = { x: a.x, y: a.y, z: a.z, yaw: a.yaw };
        this.display.set(a.id, d);
      } else {
        d.x += (a.x - d.x) * REMOTE_SMOOTH;
        d.y += (a.y - d.y) * REMOTE_SMOOTH;
        d.z += (a.z - d.z) * REMOTE_SMOOTH;
        const dy = ((a.yaw - d.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        d.yaw += dy * REMOTE_SMOOTH;
      }
      out.push({ ...a, x: d.x, y: d.y, z: d.z, yaw: d.yaw });
    }
    for (const id of [...this.display.keys()]) {
      if (!seen.has(id)) this.display.delete(id);
    }
    return out;
  }

  projectilesInSpace(): ProjectileView[] {
    return this.snapshot?.projectiles ?? [];
  }

  groundAoesInSpace(): GroundAoeView[] {
    return this.snapshot?.aoes ?? [];
  }

  player(): ActorView {
    const selfId = this.snapshot?.self.entityId ?? 0;
    const found = this.actorsInSpace().find((a) => a.id === selfId);
    if (found) return found;
    const s = this.snapshot?.self;
    return {
      id: selfId,
      templateId: 'player',
      archetype: 'player',
      name: s?.charId ?? this.charId,
      x: this.predicted.x,
      y: this.predicted.y,
      z: this.predicted.z,
      yaw: s?.yaw ?? 0,
      dead: false,
      downed: s?.downed ?? false,
      health: s?.resources.health ?? 1,
      maxHealth: s?.resources.maxHealth ?? 1,
      sneaking: false,
      blocking: false,
      attacking: false,
      attackKind: null,
      attackPhase: null,
      telegraphTicks: 0,
      isPlayer: true,
      isRemotePlayer: false,
      hostileToPlayer: false,
      hasDialogue: false,
      tier: 'standard',
    };
  }

  party(): PartyMemberView[] {
    return this.snapshot?.self.party ?? [];
  }

  playerResources() {
    return (
      this.snapshot?.self.resources ?? {
        health: 1,
        maxHealth: 1,
        stamina: 0,
        maxStamina: 1,
        magicka: 0,
        maxMagicka: 1,
        level: 1,
        xp: 0,
        xpForNext: 1,
        perkPoints: 0,
        gold: 0,
      }
    );
  }

  playerSkills() {
    return (this.snapshot?.self.skills ?? []) as ReturnType<IWorld['playerSkills']>;
  }

  playerInventory() {
    return this.snapshot?.self.inventory ?? [];
  }

  knownSpells() {
    return this.snapshot?.self.knownSpells ?? [];
  }

  drainEvents(): SimEvent[] {
    const events = this.eventBuffer;
    this.eventBuffer = [];
    return events;
  }

  nearestInteractablePrompt(): string | null {
    return this.snapshot?.self.prompt ?? null;
  }

  groundHeight(x: number, z: number): number {
    return groundHeight(CONTENT, this.currentSpace(), x, z, this.seed());
  }

  playerDowned(): boolean {
    return this.snapshot?.self.downed ?? false;
  }

  downedTicksLeft(): number {
    return this.snapshot?.self.downedTicks ?? 0;
  }

  dialogueView(): DialogueView | null {
    return this.snapshot?.self.dialogue ?? null;
  }

  shopView(): ShopView | null {
    return this.snapshot?.self.shop ?? null;
  }

  journal(): JournalView[] {
    return this.snapshot?.self.journal ?? [];
  }

  perks(): PerkView[] {
    return this.snapshot?.self.perks ?? [];
  }
}
