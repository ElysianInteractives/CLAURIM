// Wire protocol v1 (D-014). Explicit versioned JSON message schemas with
// inbound validation on BOTH ends; nothing serializes runtime objects
// directly. The server rejects any message that fails validation.
// See docs/project/NETWORK_ARCHITECTURE.md.

import type { SimEvent } from '../sim/types';
import type {
  ActorView,
  DialogueView,
  GroundAoeView,
  JournalView,
  PartyMemberView,
  ProjectileView,
  ShopView,
} from '../world_api';
import type { PerkView } from '../world_api/menus';

export const PROTOCOL_VERSION = 1;

/** One tick of movement intent. Position is NEVER sent by clients (D-015). */
export interface WireInput {
  seq: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint: boolean;
  sneak: boolean;
  block: boolean;
  jump: boolean;
}

export type CommandKind =
  | 'melee'
  | 'ranged'
  | 'cast'
  | 'useItem'
  | 'equip'
  | 'perk'
  | 'interact'
  | 'dialogueChoose'
  | 'dialogueEnd'
  | 'shopBuy'
  | 'shopSell'
  | 'shopClose'
  | 'respawn'
  | 'chat';

export type ClientMessage =
  | { t: 'hello'; protocol: number; charId: string; name: string }
  | { t: 'input'; inputs: WireInput[] }
  | { t: 'cmd'; kind: CommandKind; arg?: string; index?: number }
  | { t: 'ping'; ts: number };

export interface SelfState {
  charId: string;
  entityId: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  spaceId: string;
  spaceKind: 'exterior' | 'interior';
  downed: boolean;
  downedTicks: number;
  resources: {
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    magicka: number;
    maxMagicka: number;
    level: number;
    xp: number;
    xpForNext: number;
    perkPoints: number;
    gold: number;
  };
  inventory: { itemId: string; name: string; count: number; equipped: boolean; kind: string; value: number }[];
  skills: { id: string; level: number; xp: number; xpForNext: number }[];
  knownSpells: { id: string; name: string; cost: number }[];
  journal: JournalView[];
  perks: PerkView[];
  party: PartyMemberView[];
  dialogue: DialogueView | null;
  shop: ShopView | null;
  prompt: string | null;
}

export type ServerMessage =
  | {
      t: 'welcome';
      protocol: number;
      charId: string;
      entityId: number;
      seed: number;
      tick: number;
      /** Ticks between snapshots (replication rate; D-014). */
      snapshotEvery: number;
    }
  | { t: 'reject'; reason: string }
  | {
      t: 'snapshot';
      tick: number;
      /** Highest input seq the server has applied for this client (D-015). */
      ackSeq: number;
      gameHours: number;
      self: SelfState;
      actors: ActorView[];
      projectiles: ProjectileView[];
      aoes: GroundAoeView[];
      events: SimEvent[];
    }
  | { t: 'pong'; ts: number }
  | { t: 'bye'; reason: string };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

const COMMAND_KINDS: ReadonlySet<string> = new Set([
  'melee',
  'ranged',
  'cast',
  'useItem',
  'equip',
  'perk',
  'interact',
  'dialogueChoose',
  'dialogueEnd',
  'shopBuy',
  'shopSell',
  'shopClose',
  'respawn',
  'chat',
]);

export const MAX_INPUTS_PER_MESSAGE = 10;
export const MAX_CHARID_LEN = 40;
export const MAX_NAME_LEN = 24;
export const MAX_ARG_LEN = 200;

function validInput(raw: unknown): raw is WireInput {
  if (typeof raw !== 'object' || raw === null) return false;
  const m = raw as Record<string, unknown>;
  return (
    isFiniteNum(m.seq) &&
    isFiniteNum(m.moveX) &&
    Math.abs(m.moveX as number) <= 1.001 &&
    isFiniteNum(m.moveZ) &&
    Math.abs(m.moveZ as number) <= 1.001 &&
    isFiniteNum(m.yaw) &&
    isBool(m.sprint) &&
    isBool(m.sneak) &&
    isBool(m.block) &&
    isBool(m.jump)
  );
}

/** Parse + validate an inbound client message. Returns null on anything
 * malformed; callers must treat null as a protocol violation. */
export function parseClientMessage(json: string): ClientMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case 'hello': {
      if (!isFiniteNum(m.protocol)) return null;
      if (typeof m.charId !== 'string' || m.charId.length === 0 || m.charId.length > MAX_CHARID_LEN) return null;
      if (!/^[a-zA-Z0-9_-]+$/.test(m.charId)) return null;
      if (typeof m.name !== 'string' || m.name.length === 0 || m.name.length > MAX_NAME_LEN) return null;
      return { t: 'hello', protocol: m.protocol, charId: m.charId, name: m.name };
    }
    case 'input': {
      if (!Array.isArray(m.inputs) || m.inputs.length === 0 || m.inputs.length > MAX_INPUTS_PER_MESSAGE) return null;
      if (!m.inputs.every(validInput)) return null;
      return { t: 'input', inputs: m.inputs as WireInput[] };
    }
    case 'cmd': {
      if (typeof m.kind !== 'string' || !COMMAND_KINDS.has(m.kind)) return null;
      if (m.arg !== undefined && (typeof m.arg !== 'string' || m.arg.length > MAX_ARG_LEN)) return null;
      if (m.index !== undefined && (!isFiniteNum(m.index) || m.index < 0 || m.index > 50)) return null;
      return {
        t: 'cmd',
        kind: m.kind as CommandKind,
        arg: m.arg as string | undefined,
        index: m.index as number | undefined,
      };
    }
    case 'ping':
      return isFiniteNum(m.ts) ? { t: 'ping', ts: m.ts } : null;
    default:
      return null;
  }
}

/** Client-side parse of server messages (trust but verify the envelope). */
export function parseServerMessage(json: string): ServerMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.t !== 'string') return null;
  if (!['welcome', 'reject', 'snapshot', 'pong', 'bye'].includes(m.t)) return null;
  return raw as ServerMessage;
}
