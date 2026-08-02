// Wire protocol v8 (D-014/D-028/D-033/D-034/D-035/D-039/D-042/D-051). Explicit versioned JSON message schemas with
// inbound validation on BOTH ends; nothing serializes runtime objects
// directly. The server rejects any message that fails validation.
// See docs/project/NETWORK_ARCHITECTURE.md.

import type { SimEvent } from '../sim/types';
import type {
  ActorView,
  DialogueView,
  EquipmentSlotView,
  EquippedConsumableView,
  EquippedSpellView,
  GroundAoeView,
  JournalView,
  KnownSpellView,
  PartyInviteView,
  PartyMemberView,
  ProjectileView,
  ShopView,
} from '../world_api';
import type { LootView, PerkView } from '../world_api/menus';

export const PROTOCOL_VERSION = 8;

/** One tick of movement intent. Position is NEVER sent by clients (D-015). */
export interface WireInput {
  seq: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
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
  | 'unequipItem'
  | 'equipSpell'
  | 'unequipSpell'
  | 'equipConsumable'
  | 'unequipConsumable'
  | 'perk'
  | 'interact'
  | 'lootTake'
  | 'lootTakeAll'
  | 'lootClose'
  | 'dialogueChoose'
  | 'dialogueEnd'
  | 'shopBuy'
  | 'shopSell'
  | 'shopClose'
  | 'respawn'
  | 'recover'
  | 'chat'
  | 'partyInvite'
  | 'partyAccept'
  | 'partyDecline'
  | 'partyLeave';

export type ClientMessage =
  | { t: 'hello'; protocol: number; charId: string }
  | { t: 'input'; inputs: WireInput[] }
  | { t: 'cmd'; kind: CommandKind; arg?: string; index?: number; targetId?: number }
  | { t: 'ping'; ts: number };

export type AuthClientMessage =
  | { t: 'auth'; mode: 'register'; username: string; password: string; displayName: string }
  | { t: 'auth'; mode: 'login'; username: string; password: string }
  | { t: 'auth'; mode: 'resume'; sessionToken: string }
  | { t: 'auth'; mode: 'logout'; sessionToken: string };

export interface WireCharacterIdentity {
  charId: string;
  name: string;
}

export type AuthErrorCode =
  | 'authentication_required'
  | 'invalid_request'
  | 'invalid_credentials'
  | 'invalid_session'
  | 'rate_limited'
  | 'username_unavailable'
  | 'password_policy'
  | 'already_authenticated';

export interface SelfState {
  charId: string;
  entityId: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  aimPitch: number;
  spaceId: string;
  spaceKind: 'exterior' | 'interior';
  downed: boolean;
  downedTicks: number;
  /** Authoritative movement state required for deterministic prediction. */
  movement: {
    moveSpeed: number;
    staminaRegen: number;
    sprinting: boolean;
  };
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
  inventory: { itemId: string; name: string; count: number; equipped: boolean; kind: string; value: number; weight: number; detail: string }[];
  equipment: EquipmentSlotView[];
  skills: { id: string; level: number; xp: number; xpForNext: number }[];
  knownSpells: KnownSpellView[];
  equippedSpells: EquippedSpellView[];
  equippedConsumables: EquippedConsumableView[];
  journal: JournalView[];
  perks: PerkView[];
  partyId: string | null;
  party: PartyMemberView[];
  partyInvites: PartyInviteView[];
  dialogue: DialogueView | null;
  shop: ShopView | null;
  loot: LootView | null;
  prompt: string | null;
}

export type ServerMessage =
  | {
      t: 'authOk';
      protocol: number;
      sessionToken: string;
      expiresInSeconds: number;
      characters: WireCharacterIdentity[];
    }
  | { t: 'authError'; code: AuthErrorCode; reason: string; retryAfterSeconds?: number }
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
  'unequipItem',
  'equipSpell',
  'unequipSpell',
  'equipConsumable',
  'unequipConsumable',
  'perk',
  'interact',
  'lootTake',
  'lootTakeAll',
  'lootClose',
  'dialogueChoose',
  'dialogueEnd',
  'shopBuy',
  'shopSell',
  'shopClose',
  'respawn',
  'recover',
  'chat',
  'partyInvite',
  'partyAccept',
  'partyDecline',
  'partyLeave',
]);

export const MAX_INPUTS_PER_MESSAGE = 10;
export const MAX_CHARID_LEN = 40;
export const MAX_NAME_LEN = 24;
export const MAX_ARG_LEN = 200;
export const MIN_PASSWORD_CODEPOINTS = 15;
export const MAX_PASSWORD_CODEPOINTS = 128;
export const MAX_PASSWORD_BYTES = 512;
export const MIN_USERNAME_LEN = 3;
export const MAX_USERNAME_LEN = 24;
export const SESSION_TOKEN_LENGTH = 43;
const AUTH_ERROR_CODES = new Set<AuthErrorCode>([
  'authentication_required',
  'invalid_request',
  'invalid_credentials',
  'invalid_session',
  'rate_limited',
  'username_unavailable',
  'password_policy',
  'already_authenticated',
]);

function validUsername(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MIN_USERNAME_LEN &&
    value.length <= MAX_USERNAME_LEN &&
    /^[a-zA-Z0-9_]+$/.test(value)
  );
}

function validPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const codePoints = [...value].length;
  return (
    codePoints >= MIN_PASSWORD_CODEPOINTS &&
    codePoints <= MAX_PASSWORD_CODEPOINTS &&
    new TextEncoder().encode(value).byteLength <= MAX_PASSWORD_BYTES
  );
}

function validSessionToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === SESSION_TOKEN_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

export function parseAuthClientMessage(json: string): AuthClientMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const message = raw as Record<string, unknown>;
  if (message.t !== 'auth' || typeof message.mode !== 'string') return null;
  switch (message.mode) {
    case 'register': {
      if (!validUsername(message.username) || !validPassword(message.password)) return null;
      if (
        typeof message.displayName !== 'string' ||
        message.displayName.trim().length === 0 ||
        [...message.displayName].length > MAX_NAME_LEN ||
        /[\u0000-\u001f\u007f]/.test(message.displayName)
      ) return null;
      return {
        t: 'auth',
        mode: 'register',
        username: message.username,
        password: message.password,
        displayName: message.displayName.trim(),
      };
    }
    case 'login':
      return validUsername(message.username) && validPassword(message.password)
        ? { t: 'auth', mode: 'login', username: message.username, password: message.password }
        : null;
    case 'resume':
    case 'logout':
      return validSessionToken(message.sessionToken)
        ? { t: 'auth', mode: message.mode, sessionToken: message.sessionToken }
        : null;
    default:
      return null;
  }
}

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
    isFiniteNum(m.pitch) &&
    (m.pitch as number) >= -1.35 &&
    (m.pitch as number) <= 1.1 &&
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
      return { t: 'hello', protocol: m.protocol, charId: m.charId };
    }
    case 'input': {
      if (!Array.isArray(m.inputs) || m.inputs.length === 0 || m.inputs.length > MAX_INPUTS_PER_MESSAGE) return null;
      if (!m.inputs.every(validInput)) return null;
      return { t: 'input', inputs: m.inputs as WireInput[] };
    }
    case 'cmd': {
      if (typeof m.kind !== 'string' || !COMMAND_KINDS.has(m.kind)) return null;
      if (m.arg !== undefined && (typeof m.arg !== 'string' || [...m.arg].length > MAX_ARG_LEN)) return null;
      if (m.index !== undefined && (!Number.isSafeInteger(m.index) || (m.index as number) < 0 || (m.index as number) > 50)) return null;
      if (m.targetId !== undefined && (!Number.isSafeInteger(m.targetId) || (m.targetId as number) <= 0)) return null;
      if (m.kind === 'partyInvite' && m.targetId === undefined) return null;
      if (m.kind !== 'partyInvite' && m.targetId !== undefined) return null;
      if (m.kind === 'equipSpell' && (
        typeof m.arg !== 'string' || m.arg.length === 0 ||
        (m.index !== 0 && m.index !== 1)
      )) return null;
      if (m.kind === 'unequipSpell' && (
        m.arg !== undefined || (m.index !== 0 && m.index !== 1)
      )) return null;
      if (m.kind === 'unequipItem' && (
        m.arg !== undefined || typeof m.index !== 'number' || m.index < 0 || m.index > 5
      )) return null;
      if (m.kind === 'equipConsumable' && (
        typeof m.arg !== 'string' || m.arg.length === 0 ||
        (m.index !== 0 && m.index !== 1 && m.index !== 2)
      )) return null;
      if (m.kind === 'unequipConsumable' && (
        m.arg !== undefined || (m.index !== 0 && m.index !== 1 && m.index !== 2)
      )) return null;
      if (m.kind === 'lootTake' && (typeof m.arg !== 'string' || m.arg.length === 0)) return null;
      if ((m.kind === 'lootTakeAll' || m.kind === 'lootClose') && (m.arg !== undefined || m.index !== undefined)) return null;
      return {
        t: 'cmd',
        kind: m.kind as CommandKind,
        arg: m.arg as string | undefined,
        index: m.index as number | undefined,
        targetId: m.targetId as number | undefined,
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
  if (m.t === 'authOk') {
    if (
      !isFiniteNum(m.protocol) ||
      !validSessionToken(m.sessionToken) ||
      !isFiniteNum(m.expiresInSeconds) ||
      m.expiresInSeconds < 0 ||
      !Array.isArray(m.characters) ||
      m.characters.length === 0 ||
      !m.characters.every(validWireCharacterIdentity)
    ) return null;
    return raw as ServerMessage;
  }
  if (m.t === 'authError') {
    if (
      typeof m.code !== 'string' ||
      !AUTH_ERROR_CODES.has(m.code as AuthErrorCode) ||
      typeof m.reason !== 'string' ||
      m.reason.length === 0 ||
      m.reason.length > MAX_ARG_LEN ||
      (m.retryAfterSeconds !== undefined && (!isFiniteNum(m.retryAfterSeconds) || m.retryAfterSeconds < 0))
    ) return null;
    return raw as ServerMessage;
  }
  if (!['authOk', 'authError', 'welcome', 'reject', 'snapshot', 'pong', 'bye'].includes(m.t)) return null;
  return raw as ServerMessage;
}

function validWireCharacterIdentity(value: unknown): value is WireCharacterIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const character = value as Record<string, unknown>;
  return typeof character.charId === 'string' && character.charId.length > 0 &&
    character.charId.length <= MAX_CHARID_LEN && /^[a-zA-Z0-9_-]+$/.test(character.charId) &&
    typeof character.name === 'string' && character.name.length > 0 &&
    [...character.name].length <= MAX_NAME_LEN && !/[\u0000-\u001f\u007f]/.test(character.name);
}
