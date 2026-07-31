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
  sentAtMs: number;
}

export interface ClientNetworkDiagnostics {
  ready: boolean;
  snapshots: number;
  lastAckSeq: number;
  pendingInputs: number;
  lastAckLatencyMs: number;
  maxAckLatencyMs: number;
  lastCorrectionMeters: number;
  maxCorrectionMeters: number;
  snapshotBytes: number;
  snapshotBytesPerSecond: number;
}

/** Position error beyond which the client snaps instead of smoothing. */
const SNAP_DISTANCE = 3.0;
/** Remote-actor smoothing factor per frame (exponential interpolation). */
const REMOTE_SMOOTH = 0.35;

export class ClientWorld implements IWorld {
  private transport: ClientTransport | null = null;
  private sessionActive = false;
  private awaitingBaseline = true;
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
  private sessionStartedAtMs = 0;
  private snapshotCount = 0;
  private lastAckSeq = -1;
  private lastAckLatencyMs = 0;
  private maxAckLatencyMs = 0;
  private lastCorrectionMeters = 0;
  private maxCorrectionMeters = 0;
  private snapshotBytes = 0;

  constructor(
    public charId = '',
    public name = '',
    private readonly now: () => number = () => performance.now(),
  ) {}

  setIdentity(charId: string, name: string): void {
    if (this.sessionActive) throw new Error('Cannot replace identity during an active world session');
    this.charId = charId;
    this.name = name;
  }

  /** Start one protocol session. The host calls this only after WebSocket OPEN. */
  beginSession(transport: ClientTransport): void {
    if (!this.charId) throw new Error('Authenticated character identity is required');
    this.transport = transport;
    this.sessionActive = true;
    this.awaitingBaseline = true;
    this.welcome = null;
    this.pending = [];
    this.eventBuffer = [];
    this.seq = 0;
    this.display.clear();
    this.rejectedReason = null;
    this.closed = false;
    this.sessionStartedAtMs = this.now();
    this.snapshotCount = 0;
    this.lastAckSeq = -1;
    this.lastAckLatencyMs = 0;
    this.maxAckLatencyMs = 0;
    this.lastCorrectionMeters = 0;
    this.maxCorrectionMeters = 0;
    this.snapshotBytes = 0;
    this.sendMsg({ t: 'hello', protocol: PROTOCOL_VERSION, charId: this.charId });
  }

  /** Freeze the latest presentation state and reject intent until rejoined. */
  endSession(reason = 'connection closed'): void {
    this.transport = null;
    this.sessionActive = false;
    this.awaitingBaseline = true;
    this.welcome = null;
    this.pending = [];
    this.closed = true;
    this.rejectedReason = reason;
  }

  private sendMsg(msg: ClientMessage): boolean {
    if (!this.transport || !this.sessionActive) return false;
    this.transport.send(JSON.stringify(msg));
    return true;
  }

  /** Transport delivers raw server data here. */
  onMessage(json: string): ServerMessage | null {
    const msg = parseServerMessage(json);
    if (!msg) return null;
    switch (msg.t) {
      case 'welcome':
        if (!this.sessionActive) return msg;
        this.welcome = msg;
        break;
      case 'reject':
        this.rejectedReason = msg.reason;
        this.endSession(msg.reason);
        break;
      case 'bye':
        this.endSession(msg.reason);
        break;
      case 'snapshot': {
        if (!this.sessionActive) return msg;
        const first = this.awaitingBaseline;
        const receivedAtMs = this.now();
        this.snapshotCount++;
        this.snapshotBytes += new TextEncoder().encode(json).byteLength;
        this.lastAckSeq = msg.ackSeq;
        const acknowledged = this.pending.filter((pending) => pending.seq <= msg.ackSeq);
        const latestAcknowledged = acknowledged[acknowledged.length - 1];
        if (latestAcknowledged) {
          this.lastAckLatencyMs = Math.max(0, receivedAtMs - latestAcknowledged.sentAtMs);
          this.maxAckLatencyMs = Math.max(this.maxAckLatencyMs, this.lastAckLatencyMs);
        }
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
          this.lastCorrectionMeters = 0;
        } else {
          let replay = { ...serverPos };
          for (const p of this.pending) {
            replay = this.stepMovement(replay, msg.self.spaceId, p.input, msg.self);
          }
          const err = Math.hypot(replay.x - this.predicted.x, replay.z - this.predicted.z);
          this.lastCorrectionMeters = err;
          this.maxCorrectionMeters = Math.max(this.maxCorrectionMeters, err);
          if (err > SNAP_DISTANCE) {
            this.predicted = replay;
          } else {
            // Gentle correction toward the reconciled position.
            this.predicted.x += (replay.x - this.predicted.x) * 0.4;
            this.predicted.z += (replay.z - this.predicted.z) * 0.4;
            this.predicted.y = replay.y;
          }
        }
        this.awaitingBaseline = false;
        break;
      }
      case 'pong':
        break;
    }
    return msg;
  }

  ready(): boolean {
    return this.sessionActive && !this.awaitingBaseline && this.welcome !== null && this.snapshot !== null;
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
    const pending = { seq: wire.seq, input: wire, sentAtMs: this.now() };
    this.pending.push(pending);
    if (this.pending.length > 120) this.pending.splice(0, this.pending.length - 120);
    if (!this.sendMsg({ t: 'input', inputs: [wire] })) {
      this.pending = this.pending.filter((entry) => entry !== pending);
      return;
    }
    // Predict own movement locally (position only; resources are server truth).
    if (!this.snapshot.self.downed) {
      this.predicted = this.stepMovement(this.predicted, this.predictedSpace, wire, this.snapshot.self);
    }
  }

  attackMelee(): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'melee' });
  }

  attackRanged(): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'ranged' });
  }

  castSpell(spellId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'cast', arg: spellId });
  }

  interact(): 'none' | 'door' | 'container' | 'dialogue' | 'loot' {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'interact' });
    return 'none'; // authoritative result arrives via snapshot state
  }

  useItem(itemId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'useItem', arg: itemId });
  }

  equipItem(itemId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'equip', arg: itemId });
  }

  takePerk(perkId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'perk', arg: perkId });
  }

  respawn(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'respawn' });
  }

  saveGame(): string {
    // Online characters are server-persisted (D-016); nothing to save locally.
    return '';
  }

  chat(text: string): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'chat', arg: text });
  }

  partyInvite(targetEntityId: number): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'partyInvite', targetId: targetEntityId });
  }

  partyAccept(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'partyAccept' });
  }

  partyDecline(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'partyDecline' });
  }

  partyLeave(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'partyLeave' });
  }

  dialogueChoose(index: number): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'dialogueChoose', index });
  }

  dialogueEnd(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'dialogueEnd' });
  }

  shopBuy(itemId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'shopBuy', arg: itemId });
  }

  shopSell(itemId: string): boolean {
    return this.ready() && this.sendMsg({ t: 'cmd', kind: 'shopSell', arg: itemId });
  }

  shopClose(): void {
    if (this.ready()) this.sendMsg({ t: 'cmd', kind: 'shopClose' });
  }

  diagnostics(): ClientNetworkDiagnostics {
    const elapsedSeconds = Math.max(0.001, (this.now() - this.sessionStartedAtMs) / 1_000);
    return {
      ready: this.ready(),
      snapshots: this.snapshotCount,
      lastAckSeq: this.lastAckSeq,
      pendingInputs: this.pending.length,
      lastAckLatencyMs: this.lastAckLatencyMs,
      maxAckLatencyMs: this.maxAckLatencyMs,
      lastCorrectionMeters: this.lastCorrectionMeters,
      maxCorrectionMeters: this.maxCorrectionMeters,
      snapshotBytes: this.snapshotBytes,
      snapshotBytesPerSecond: this.snapshotBytes / elapsedSeconds,
    };
  }

  // --- read ---------------------------------------------------------------

  seed(): number {
    return this.welcome?.seed ?? 0;
  }

  currentSpace(): string {
    return this.snapshot?.self.spaceId ?? 'kaldwyn';
  }

  spaceName(spaceId: string): string {
    return CONTENT.spaces[spaceId]?.name ?? spaceId;
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

  partyId(): string | null {
    return this.snapshot?.self.partyId ?? null;
  }

  party(): PartyMemberView[] {
    return this.snapshot?.self.party ?? [];
  }

  partyInvites() {
    return this.snapshot?.self.partyInvites ?? [];
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
