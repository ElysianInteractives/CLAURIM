// The Sim coordinator: owns world state, the tick-phase order, the SimContext
// binding, player command entry points, and save/load. MULTIPLAYER MODEL
// (D-013): one authoritative Sim hosts MANY player characters; every
// per-player concern (input, journal, dialogue, shop, spells, container loot,
// downed state) is keyed by CharacterId. Single-player hosts and legacy tests
// use the primary-character wrappers, which delegate to the same paths.

import { Rng } from './rng';
import {
  DOWNED_TICKS,
  DT,
  ENGAGE_RADIUS,
  GAME_HOURS_PER_SECOND,
  NO_ENTITY,
  RELEASE_HEALTH_FRAC,
  REVIVE_HEALTH_FRAC,
  SPRINT_MULT,
  SNEAK_MULT,
  THREAT_PER_HEAL,
  type Actor,
  type CharacterId,
  type ContentId,
  type DamageChannel,
  type EntityId,
  type PartyId,
  type Position,
  type QuestState,
  type SimEvent,
  type SkillId,
  type SpaceId,
  type Vec3,
} from './types';
import { CONTENT, CONTENT_VERSION, PLAYER_START } from './content';
import { validateContent, type ContentRegistry } from './content/schema';
import {
  CollisionIndex,
  nearestTraversablePoint,
  projectileObstructionT,
  resolveMove,
} from './world/collision';
import { groundHeight } from './world/spaces';
import { isActiveAt } from './world/cells';
import { advanceSprint, localMovementToWorld } from './player/movement';
import { clampAimPitch } from './player/aim';
import {
  PLAYER_RECOVERY_COOLDOWN_TICKS,
  recoveryRejection,
  type PlayerRecoveryRejection,
} from './player/recovery';
import { createActor, recalcActorStats } from './actors/actor';
import { makeBrain, tickBrain } from './ai/brain';
import {
  encounterKeyForActor,
  encounterMembers,
  hasAuthoredEncounter,
} from './ai/encounters';
import {
  dealDamage,
  resetProjectileIds,
  startMelee,
  startRanged,
  startSpell,
  tickAttack,
  tickProjectiles,
} from './combat/combat';
import { applyEffect, tickEffects } from './effects/effects_runtime';
import {
  addItem,
  buyFromMerchant,
  countItem,
  equipItem,
  lootActor,
  removeItem,
  rollLoot,
  sellToMerchant,
  useItem,
} from './inventory/inventory';
import { trainSkill, takePerk, canTakePerk } from './progression/skills';
import { journalFor, onQuestEvent, startQuest, tickReachObjectives } from './quests/quest_runtime';
import {
  beginDialogue,
  chooseOption,
  visibleChoices,
  currentNode,
  type DialogueSession,
} from './dialogue/dialogue_runtime';
import type { GroundAoe, SimContext } from './sim_context';
import {
  CHARACTER_SCHEMA_VERSION,
  SAVE_SCHEMA_VERSION,
  parseSave,
  type ActorSave,
  type CharacterSave,
  type SaveGame,
} from './save/save';

/** Factions hostile to each other (symmetric). Aggressive templates always
 * oppose players; authored faction ids keep members of one encounter allied. */
const HOSTILE_PAIRS: ReadonlySet<string> = new Set([
  'redclaw|fenharrow',
  'fenharrow|redclaw',
  'redclaw|player',
  'player|redclaw',
]);

export const PARTY_INVITE_RADIUS = 30;
export const PARTY_MAX_MEMBERS = 5;

export type PartyInviteResult =
  | 'sent'
  | 'no-player'
  | 'self'
  | 'not-nearby'
  | 'already-party'
  | 'target-in-party'
  | 'party-full';

export type PartyAcceptResult = 'joined' | 'none' | 'stale' | 'already-party' | 'party-full';

export interface PlayerInput {
  /** Normalized move intent in the player's local heading space. */
  moveX: number;
  moveZ: number;
  yaw: number;
  /** Vertical center-reticle angle in radians. */
  pitch: number;
  sprint: boolean;
  sneak: boolean;
  block: boolean;
  jump: boolean;
}

export const IDLE_INPUT: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  pitch: 0,
  sprint: false,
  sneak: false,
  block: false,
  jump: false,
};

interface PlayerTransient {
  vy: number;
  airborne: boolean;
  lastYaw: number;
  recoveryAvailableAtTick: number;
}

export class Sim {
  readonly content: ContentRegistry;
  readonly seed: number;
  readonly rng: Rng;
  readonly colliders: CollisionIndex;
  readonly actors = new Map<EntityId, Actor>();
  readonly projectiles: import('./types').Projectile[] = [];
  readonly groundAoes: GroundAoe[] = [];
  /** Events emitted during the most recent tick (hosts consume, sim clears). */
  events: SimEvent[] = [];
  tickCount = 0;
  nextEntityId = 1;
  private nextGroundAoeId = 1;

  // --- per-character state (D-013) -----------------------------------------
  readonly players = new Map<CharacterId, EntityId>();
  primaryCharId: CharacterId | null = null;
  readonly questLogs = new Map<CharacterId, Map<ContentId, QuestState>>();
  readonly knownSpellsBy = new Map<CharacterId, ContentId[]>();
  readonly containersLootedByChar = new Map<CharacterId, Set<string>>();
  readonly parties = new Map<PartyId, CharacterId[]>();
  readonly characterNames = new Map<CharacterId, string>();
  private readonly partyInvites = new Map<CharacterId, CharacterId>();
  readonly dialogueSessions = new Map<CharacterId, DialogueSession>();
  readonly shopMerchantBy = new Map<CharacterId, EntityId>();
  private transientBy = new Map<CharacterId, PlayerTransient>();

  spawnersSpawned = new Set<string>();
  /** Per-spawner game-hour when its last actor died (respawn bookkeeping). */
  spawnerClearedAt = new Map<string, number>();
  private readonly ctx: SimContext;

  constructor(
    seed: number,
    content: ContentRegistry = CONTENT,
    opts: { skipSpawn?: boolean; noDefaultPlayer?: boolean } = {},
  ) {
    const errors = validateContent(content);
    if (errors.length > 0) {
      throw new Error(`content validation failed:\n${errors.join('\n')}`);
    }
    this.content = content;
    this.seed = seed;
    this.rng = new Rng(seed);
    this.colliders = new CollisionIndex(content);
    resetProjectileIds();
    this.ctx = this.buildContext();
    if (!opts.skipSpawn) {
      this.spawnWorld();
      if (!opts.noDefaultPlayer) this.addPlayer('p1', 'Wanderer');
    }
  }

  // -------------------------------------------------------------------------
  // Context binding
  // -------------------------------------------------------------------------

  private buildContext(): SimContext {
    const sim = this;
    return {
      get content() {
        return sim.content;
      },
      get rng() {
        return sim.rng;
      },
      get seed() {
        return sim.seed;
      },
      get colliders() {
        return sim.colliders;
      },
      get actors() {
        return sim.actors;
      },
      get projectiles() {
        return sim.projectiles;
      },
      get groundAoes() {
        return sim.groundAoes;
      },
      get events() {
        return sim.events;
      },
      gameHours: () => sim.gameHours(),
      tickCount: () => sim.tickCount,
      playerId: () => sim.primaryEntityId(),
      player: () => sim.player(),
      playerCharIds: () => [...sim.players.keys()],
      actorByCharId: (charId) => {
        const id = sim.players.get(charId);
        return id !== undefined ? (sim.actors.get(id) ?? null) : null;
      },
      charIdOf: (entityId) => {
        for (const [charId, id] of sim.players) if (id === entityId) return charId;
        return null;
      },
      partyMembersOf: (charId) => sim.partyMembersOf(charId),
      questLogOf: (charId) => sim.questLogOf(charId),
      knownSpellsOf: (charId) => sim.knownSpellsBy.get(charId) ?? [],
      containersLootedBy: (charId) => sim.containersLootedOf(charId),
      spawnFromTemplate: (templateId, spaceId, pos, summonedBy) =>
        sim.spawnFromTemplate(templateId, spaceId, pos, summonedBy),
      allocateGroundAoeId: () => sim.nextGroundAoeId++,
      emit: (e) => sim.events.push(e),
      dealDamage: (t, s, a, c, blockable, blockOrigin) =>
        dealDamage(sim.ctx, t, s, a, c, blockable, blockOrigin),
      applyHeal: (t, amount) => {
        const actor = sim.actors.get(t);
        if (!actor || actor.dead || actor.downed) return;
        const before = actor.health;
        actor.health = Math.min(actor.stats.maxHealth, actor.health + amount);
        const healed = actor.health - before;
        if (healed > 0) {
          sim.events.push({ type: 'heal', targetId: t, amount: healed });
          // Healing threat (D-017): enemies fighting the healed actor add
          // threat against the healed target's allies is out of scope; the
          // simple, predictable rule: enemies targeting the healed actor gain
          // threat toward the HEALED actor (staying on their patient), which
          // keeps healers safe but keeps tanks sticky.
          for (const enemy of sim.actors.values()) {
            if (!enemy.brain || enemy.dead) continue;
            if (enemy.brain.state !== 'combat') continue;
            if (enemy.pos.spaceId !== actor.pos.spaceId) continue;
            if (!sim.isHostile(enemy, actor)) continue;
            enemy.brain.threat[t] = (enemy.brain.threat[t] ?? 0) + healed * THREAT_PER_HEAL;
          }
        }
      },
      applyEffect: (t, e, s) => applyEffect(sim.ctx, t, e, s),
      recalcStats: (id) => {
        const a = sim.actors.get(id);
        if (a) recalcActorStats(sim.content, a);
      },
      addItem: (a, i, c) => addItem(sim.ctx, a, i, c),
      removeItem: (a, i, c) => removeItem(sim.ctx, a, i, c),
      countItem: (a, i) => countItem(sim.ctx, a, i),
      trainSkill: (a, s, xp) => trainSkill(sim.ctx, a, s, xp),
      onQuestEvent: (e) => onQuestEvent(sim.ctx, e),
      resetEncounter: (bossId) => sim.resetEncounter(bossId),
      isActorActive: (a) => sim.isActorActive(a),
      isHostile: (a, b) => sim.isHostile(a, b),
      ground: (spaceId, x, z) => groundHeight(sim.content, spaceId, x, z, sim.seed),
      projectileObstruction: (spaceId, from, to) =>
        projectileObstructionT(sim.content, sim.colliders, spaceId, from, to, sim.seed),
    };
  }

  /** Test/tooling access to the seam (headless drivers, debug inspectors). */
  context(): SimContext {
    return this.ctx;
  }

  // -------------------------------------------------------------------------
  // World construction
  // -------------------------------------------------------------------------

  private spawnWorld(): void {
    for (const spawner of this.content.spawners) {
      this.runSpawner(spawner.id);
    }
    // Merchants stock their inventory once at world creation.
    for (const actor of this.actors.values()) {
      const tpl = this.content.actors[actor.templateId];
      if (tpl?.merchant) {
        const table = this.content.lootTables[tpl.merchant.stockTable];
        if (table) {
          const rolled = rollLoot(this.rng.fork(actor.id), table);
          for (const it of rolled.items) addItem(this.ctx, actor.id, it.itemId, it.count);
        }
        actor.gold = tpl.merchant.gold;
      }
    }
  }

  private runSpawner(spawnerId: string): void {
    const spawner = this.content.spawners.find((s) => s.id === spawnerId);
    if (!spawner) return;
    const tpl = this.content.actors[spawner.actorId];
    if (!tpl) return;
    const rng = this.rng.fork(hashString(spawner.id));
    for (let i = 0; i < spawner.count; i++) {
      const x = spawner.x + (spawner.count > 1 ? rng.range(-spawner.radius, spawner.radius) : 0);
      const z = spawner.z + (spawner.count > 1 ? rng.range(-spawner.radius, spawner.radius) : 0);
      const id = this.spawnFromTemplate(
        tpl.id,
        spawner.spaceId,
        { x, y: 0, z },
        0,
      );
      const actor = this.actors.get(id);
      if (actor) actor.spawnerId = spawner.id;
    }
    this.spawnersSpawned.add(spawner.id);
  }

  spawnFromTemplate(templateId: ContentId, spaceId: SpaceId, pos: Vec3, summonedBy: EntityId): EntityId {
    const tpl = this.content.actors[templateId];
    if (!tpl) return NO_ENTITY;
    const safe = nearestTraversablePoint(
      this.content,
      this.colliders,
      spaceId,
      pos.x,
      pos.z,
      this.seed,
      summonedBy === NO_ENTITY ? 8 : 4,
    );
    if (!safe) return NO_ENTITY;
    const id = this.nextEntityId++;
    const position: Position = {
      spaceId,
      x: safe.x,
      y: safe.y,
      z: safe.z,
    };
    const actor = createActor(id, tpl.kind, tpl.id, tpl.name, position);
    actor.factionId = tpl.factionId ?? null;
    actor.brain = makeBrain(position);
    actor.summonedBy = summonedBy;
    this.actors.set(id, actor);
    recalcActorStats(this.content, actor);
    actor.health = actor.stats.maxHealth;
    actor.stamina = actor.stats.maxStamina;
    actor.magicka = actor.stats.maxMagicka;
    // Summons join the summoner's fight immediately.
    if (summonedBy !== NO_ENTITY) {
      const owner = this.actors.get(summonedBy);
      if (owner?.brain && actor.brain) {
        actor.brain.state = 'combat';
        actor.brain.targetId = owner.brain.targetId;
        actor.brain.threat = { ...owner.brain.threat };
        actor.brain.scaledFor = owner.brain.scaledFor;
        recalcActorStats(this.content, actor);
        actor.health = actor.stats.maxHealth;
      }
    }
    return id;
  }

  // -------------------------------------------------------------------------
  // Player lifecycle (D-013 / D-016)
  // -------------------------------------------------------------------------

  addPlayer(charId: CharacterId, name: string, restore?: CharacterSave): EntityId {
    if (this.players.has(charId)) throw new Error(`character ${charId} already present`);
    const id = this.nextEntityId++;
    const pos: Position = restore
      ? { spaceId: restore.pos.spaceId, x: restore.pos.x, y: restore.pos.y, z: restore.pos.z }
      : { spaceId: PLAYER_START.spaceId, x: PLAYER_START.x, y: 0, z: PLAYER_START.z };
    if (!this.content.spaces[pos.spaceId]) {
      pos.spaceId = PLAYER_START.spaceId;
      pos.x = PLAYER_START.x;
      pos.z = PLAYER_START.z;
    }
    const safe = nearestTraversablePoint(
      this.content,
      this.colliders,
      pos.spaceId,
      pos.x,
      pos.z,
      this.seed,
      8,
    );
    if (safe) {
      pos.x = safe.x;
      pos.y = safe.y;
      pos.z = safe.z;
    } else {
      pos.spaceId = PLAYER_START.spaceId;
      pos.x = PLAYER_START.x;
      pos.z = PLAYER_START.z;
      pos.y = groundHeight(this.content, pos.spaceId, pos.x, pos.z, this.seed);
    }
    const player = createActor(id, 'player', 'player', restore?.name ?? name, pos);
    player.factionId = 'player';
    this.actors.set(id, player);
    this.players.set(charId, id);
    this.characterNames.set(charId, player.name);
    if (!this.primaryCharId) this.primaryCharId = charId;
    this.transientBy.set(charId, {
      vy: 0,
      airborne: false,
      lastYaw: restore?.yaw ?? PLAYER_START.yaw,
      recoveryAvailableAtTick: 0,
    });
    player.yaw = restore?.yaw ?? PLAYER_START.yaw;

    if (restore) {
      player.inventory = restore.inventory.map((s) => ({ ...s }));
      player.equipment = { ...restore.equipment } as Actor['equipment'];
      player.gold = restore.gold;
      player.effects = restore.effects.map((e) => ({ ...e }));
      player.skills = JSON.parse(JSON.stringify(restore.skills));
      player.perks = [...restore.perks];
      player.level = restore.level;
      player.characterXp = restore.characterXp;
      player.perkPoints = restore.perkPoints;
      this.knownSpellsBy.set(charId, [...restore.knownSpells]);
      const log = new Map<ContentId, QuestState>();
      for (const q of restore.quests) log.set(q.questId, JSON.parse(JSON.stringify(q)));
      this.questLogs.set(charId, log);
      this.containersLootedByChar.set(charId, new Set(restore.containersLooted));
      recalcActorStats(this.content, player);
      player.health = Math.min(Math.max(1, restore.health), player.stats.maxHealth);
      player.stamina = Math.min(restore.stamina, player.stats.maxStamina);
      player.magicka = Math.min(restore.magicka, player.stats.maxMagicka);
    } else {
      player.gold = 25;
      recalcActorStats(this.content, player);
      addItem(this.ctx, id, 'worn_dagger', 1);
      addItem(this.ctx, id, 'bread', 2);
      addItem(this.ctx, id, 'healing_draught', 1);
      equipItem(this.ctx, id, 'worn_dagger');
      this.knownSpellsBy.set(charId, ['flamebolt', 'mend_wounds']);
      player.health = player.stats.maxHealth;
      player.stamina = player.stats.maxStamina;
      player.magicka = player.stats.maxMagicka;
    }

    return id;
  }

  /** Remove a character from the live world, returning its durable record. */
  removePlayer(charId: CharacterId, opts: { preserveParty?: boolean } = {}): CharacterSave | null {
    const id = this.players.get(charId);
    if (id === undefined) return null;
    const record = this.extractCharacter(charId);
    this.actors.delete(id);
    this.players.delete(charId);
    this.dialogueSessions.delete(charId);
    this.shopMerchantBy.delete(charId);
    this.transientBy.delete(charId);
    this.clearInvitesFor(charId);
    if (!opts.preserveParty) this.leaveParty(charId);
    if (this.primaryCharId === charId) {
      this.primaryCharId = this.players.size > 0 ? [...this.players.keys()][0] : null;
    }
    return record;
  }

  /** Durable per-character record (server persistence, D-016). */
  extractCharacter(charId: CharacterId): CharacterSave | null {
    const id = this.players.get(charId);
    const a = id !== undefined ? this.actors.get(id) : undefined;
    if (!a) return null;
    return {
      schemaVersion: CHARACTER_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      charId,
      name: a.name,
      pos: { spaceId: a.pos.spaceId, x: a.pos.x, y: a.pos.y, z: a.pos.z },
      yaw: a.yaw,
      health: a.downed ? a.stats.maxHealth * RELEASE_HEALTH_FRAC : a.health,
      stamina: a.stamina,
      magicka: a.magicka,
      inventory: a.inventory.map((s) => ({ ...s })),
      equipment: { ...(a.equipment as Record<string, string>) },
      gold: a.gold,
      effects: a.effects.map((e) => ({ ...e })),
      skills: JSON.parse(JSON.stringify(a.skills)),
      perks: [...a.perks],
      level: a.level,
      characterXp: a.characterXp,
      perkPoints: a.perkPoints,
      knownSpells: [...(this.knownSpellsBy.get(charId) ?? [])],
      quests: JSON.parse(JSON.stringify([...this.questLogOf(charId).values()])),
      containersLooted: [...this.containersLootedOf(charId)],
    };
  }

  joinParty(charId: CharacterId, partyId: PartyId): void {
    const current = this.partyOf(charId);
    if (current === partyId) return;
    if (current) {
      const remaining = this.parties.get(current)!.filter((m) => m !== charId);
      if (remaining.length > 1) this.parties.set(current, remaining);
      else this.parties.delete(current);
    }
    const members = this.parties.get(partyId) ?? [];
    if (!members.includes(charId)) members.push(charId);
    this.parties.set(partyId, members);
  }

  inviteToParty(fromCharId: CharacterId, targetEntityId: EntityId): PartyInviteResult {
    const fail = (result: PartyInviteResult, text: string): PartyInviteResult => {
      this.events.push({ type: 'partyStatus', charId: fromCharId, text });
      return result;
    };
    const from = this.playerActor(fromCharId);
    const targetCharId = this.charIdForEntity(targetEntityId);
    const target = targetCharId ? this.playerActor(targetCharId) : null;
    if (!from || !target || !targetCharId) return fail('no-player', 'That player is no longer available.');
    if (targetCharId === fromCharId) return fail('self', 'You cannot invite yourself.');
    if (
      from.pos.spaceId !== target.pos.spaceId ||
      Math.hypot(from.pos.x - target.pos.x, from.pos.z - target.pos.z) > PARTY_INVITE_RADIUS
    ) return fail('not-nearby', 'Party invitations require a nearby player.');
    const fromParty = this.partyOf(fromCharId);
    const targetParty = this.partyOf(targetCharId);
    if (fromParty && targetParty === fromParty) return fail('already-party', `${target.name} is already in your party.`);
    if (targetParty) return fail('target-in-party', `${target.name} is already in a party.`);
    if (fromParty && (this.parties.get(fromParty)?.length ?? 0) >= PARTY_MAX_MEMBERS) {
      return fail('party-full', 'Your party is full.');
    }
    this.partyInvites.set(targetCharId, fromCharId);
    this.events.push({ type: 'partyStatus', charId: fromCharId, text: `Invitation sent to ${target.name}.` });
    this.events.push({ type: 'partyStatus', charId: targetCharId, text: `${from.name} invited you. Press O to respond.` });
    return 'sent';
  }

  pendingPartyInviteFor(
    charId: CharacterId,
  ): { fromCharId: CharacterId; fromName: string; fromEntityId: EntityId } | null {
    const fromCharId = this.partyInvites.get(charId);
    if (!fromCharId) return null;
    const from = this.playerActor(fromCharId);
    if (!from) return null;
    return { fromCharId, fromName: from.name, fromEntityId: from.id };
  }

  acceptPartyInvite(charId: CharacterId): PartyAcceptResult {
    const fromCharId = this.partyInvites.get(charId);
    this.partyInvites.delete(charId);
    if (!fromCharId) return 'none';
    if (this.partyOf(charId)) {
      this.events.push({ type: 'partyStatus', charId, text: 'Leave your current party before accepting another invitation.' });
      return 'already-party';
    }
    const inviter = this.playerActor(fromCharId);
    const invitee = this.playerActor(charId);
    if (!inviter || !invitee) {
      this.events.push({ type: 'partyStatus', charId, text: 'That party invitation is no longer available.' });
      return 'stale';
    }
    let partyId = this.partyOf(fromCharId);
    if (partyId && (this.parties.get(partyId)?.length ?? 0) >= PARTY_MAX_MEMBERS) {
      this.events.push({ type: 'partyStatus', charId, text: 'That party is now full.' });
      return 'party-full';
    }
    if (!partyId) {
      partyId = `party:${fromCharId}`;
      this.joinParty(fromCharId, partyId);
    }
    this.joinParty(charId, partyId);
    this.clearInvitesFor(charId);
    this.events.push({ type: 'partyStatus', charId, text: `You joined ${inviter.name}'s party.` });
    this.events.push({ type: 'partyStatus', charId: fromCharId, text: `${invitee.name} joined your party.` });
    return 'joined';
  }

  declinePartyInvite(charId: CharacterId): boolean {
    const fromCharId = this.partyInvites.get(charId);
    if (!this.partyInvites.delete(charId)) return false;
    this.events.push({ type: 'partyStatus', charId, text: 'Party invitation declined.' });
    if (fromCharId) {
      const name = this.characterNames.get(charId) ?? charId;
      this.events.push({ type: 'partyStatus', charId: fromCharId, text: `${name} declined your invitation.` });
    }
    return true;
  }

  leaveParty(charId: CharacterId): boolean {
    const partyId = this.partyOf(charId);
    if (!partyId) return false;
    const members = this.parties.get(partyId) ?? [];
    const remaining = members.filter((member) => member !== charId);
    if (remaining.length > 1) this.parties.set(partyId, remaining);
    else this.parties.delete(partyId);
    this.clearInvitesFor(charId);
    this.events.push({ type: 'partyStatus', charId, text: 'You left the party.' });
    const name = this.characterNames.get(charId) ?? charId;
    for (const member of remaining) {
      this.events.push({ type: 'partyStatus', charId: member, text: `${name} left the party.` });
    }
    return true;
  }

  private clearInvitesFor(charId: CharacterId): void {
    this.partyInvites.delete(charId);
    for (const [target, inviter] of this.partyInvites) {
      if (inviter === charId) this.partyInvites.delete(target);
    }
  }

  private charIdForEntity(entityId: EntityId): CharacterId | null {
    for (const [charId, id] of this.players) if (id === entityId) return charId;
    return null;
  }

  partyOf(charId: CharacterId): PartyId | null {
    for (const [pid, members] of this.parties) {
      if (members.includes(charId)) return pid;
    }
    return null;
  }

  partyMembersOf(charId: CharacterId): CharacterId[] {
    const pid = this.partyOf(charId);
    if (!pid) return [charId];
    return [...this.parties.get(pid)!];
  }

  questLogOf(charId: CharacterId): Map<ContentId, QuestState> {
    let log = this.questLogs.get(charId);
    if (!log) {
      log = new Map();
      this.questLogs.set(charId, log);
    }
    return log;
  }

  containersLootedOf(charId: CharacterId): Set<string> {
    let set = this.containersLootedByChar.get(charId);
    if (!set) {
      set = new Set();
      this.containersLootedByChar.set(charId, set);
    }
    return set;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  primaryEntityId(): EntityId {
    return this.primaryCharId ? (this.players.get(this.primaryCharId) ?? NO_ENTITY) : NO_ENTITY;
  }

  /** Primary character's actor (offline host + legacy tests). */
  player(): Actor {
    const p = this.actors.get(this.primaryEntityId());
    if (!p) throw new Error('no primary player');
    return p;
  }

  playerActor(charId: CharacterId): Actor | null {
    const id = this.players.get(charId);
    return id !== undefined ? (this.actors.get(id) ?? null) : null;
  }

  gameHours(): number {
    return 8 + this.tickCount * DT * GAME_HOURS_PER_SECOND;
  }

  /** Active = within the streaming window of ANY player character. */
  isActorActive(a: Actor): boolean {
    for (const id of this.players.values()) {
      const p = this.actors.get(id);
      if (!p) continue;
      const exterior = this.content.spaces[p.pos.spaceId]?.kind === 'exterior';
      if (isActiveAt(p.pos.spaceId, p.pos.x, p.pos.z, a.pos.spaceId, a.pos.x, a.pos.z, exterior)) {
        return true;
      }
    }
    return false;
  }

  isHostile(a: Actor, b: Actor): boolean {
    if (a.id === b.id || a.dead || b.dead) return false;
    const fa = a.factionId ?? `wild:${a.templateId}`;
    const fb = b.factionId ?? `wild:${b.templateId}`;
    if (fa === fb) return false;
    if (HOSTILE_PAIRS.has(`${fa}|${fb}`)) return true;
    const ta = this.content.actors[a.templateId];
    const tb = this.content.actors[b.templateId];
    if (ta?.aggressive && b.kind === 'player') return true;
    if (tb?.aggressive && a.kind === 'player') return true;
    if (a.factionId === null && ta?.aggressive) return true;
    if (b.factionId === null && tb?.aggressive) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  /** Advance one tick. Accepts a per-character input map; a bare PlayerInput
   * drives the primary character (single-player hosts, legacy tests). */
  tick(inputs: PlayerInput | Map<CharacterId, PlayerInput>): void {
    // Commands arrive between fixed ticks. Preserve rejection feedback until
    // the host gets a chance to drain it; all tick-generated events remain
    // current-tick only as before.
    this.events = this.events.filter(
      (event) =>
        event.type === 'actionRejected' ||
        event.type === 'chat' ||
        event.type === 'partyStatus' ||
        event.type === 'playerRecovered' ||
        event.type === 'recoveryRejected',
    );
    this.tickCount++;

    const inputMap: Map<CharacterId, PlayerInput> =
      inputs instanceof Map
        ? inputs
        : new Map(this.primaryCharId ? [[this.primaryCharId, inputs]] : []);

    // Deterministic player order: sorted character id.
    const charIds = [...this.players.keys()].sort();
    for (const charId of charIds) {
      this.tickPlayer(charId, inputMap.get(charId) ?? { ...IDLE_INPUT, yaw: this.playerActor(charId)?.yaw ?? 0 });
    }

    // Deterministic actor order: ascending entity id.
    const ids = [...this.actors.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const a = this.actors.get(id);
      if (!a || a.dead) continue;
      tickEffects(this.ctx, id);
      if (a.kind !== 'player') tickBrain(this.ctx, id);
      if (!a.downed) tickAttack(this.ctx, id);
      this.tickRegen(a);
    }
    tickProjectiles(this.ctx);
    this.tickGroundAoes();
    this.tickDownedAndWipes();

    if (this.tickCount % 10 === 0) tickReachObjectives(this.ctx);
    if (this.tickCount % 300 === 0) this.tickRespawns();
  }

  private tickPlayer(charId: CharacterId, input: PlayerInput): void {
    const p = this.playerActor(charId);
    const tr = this.transientBy.get(charId);
    if (!p || !tr || p.dead) return;
    if (p.downed) {
      p.moveIntent.x = 0;
      p.moveIntent.z = 0;
      if (p.interactCooldown > 0) p.interactCooldown--;
      return;
    }
    p.yaw = input.yaw;
    p.aimPitch = clampAimPitch(input.pitch);
    tr.lastYaw = input.yaw;
    p.sneaking = input.sneak;
    // Defensive cancel is intentionally limited to recovery. Windup/active
    // frames remain committed, and block can never overlap an attack.
    if (input.block && p.attack?.phase === 'recover') p.attack = null;
    p.blocking = input.block && p.stamina > 0 && p.attack === null;
    const direction = localMovementToWorld(input.moveX, input.moveZ, p.yaw);
    const sprint = advanceSprint(
      input.sprint,
      input.sneak,
      direction.moving,
      p.sprinting,
      p.stamina,
      p.stats.maxStamina,
    );
    p.sprinting = sprint.active;
    p.stamina = sprint.stamina;

    let speed = p.stats.moveSpeed;
    if (sprint.applied) speed *= SPRINT_MULT;
    if (p.sneaking) speed *= SNEAK_MULT;
    if (p.blocking) speed *= 0.55;

    if (direction.moving) {
      const moved = resolveMove(
        this.content,
        this.colliders,
        p.pos.spaceId,
        p.pos,
        direction.x * speed * DT,
        direction.z * speed * DT,
        this.seed,
      );
      p.pos.x = moved.x;
      p.pos.z = moved.z;
      if (!tr.airborne) p.pos.y = moved.y;
      if (p.sneaking && this.tickCount % 30 === 0) trainSkill(this.ctx, p.id, 'sneak', 1);
    }

    const ground = groundHeight(this.content, p.pos.spaceId, p.pos.x, p.pos.z, this.seed);
    if (input.jump && !tr.airborne && p.stamina >= 5) {
      tr.vy = 5.2;
      tr.airborne = true;
      p.stamina -= 5;
    }
    if (tr.airborne) {
      tr.vy -= 14 * DT;
      p.pos.y += tr.vy * DT;
      if (p.pos.y <= ground) {
        p.pos.y = ground;
        tr.vy = 0;
        tr.airborne = false;
      }
    } else {
      p.pos.y = ground;
    }

    if (p.interactCooldown > 0) p.interactCooldown--;
  }

  private tickRegen(a: Actor): void {
    if (a.dead || a.downed) return;
    a.health = Math.min(a.stats.maxHealth, a.health + a.stats.healthRegen * DT);
    if (!a.sprinting) a.stamina = Math.min(a.stats.maxStamina, a.stamina + a.stats.staminaRegen * DT);
    a.magicka = Math.min(a.stats.maxMagicka, a.magicka + a.stats.magickaRegen * DT);
  }

  private tickGroundAoes(): void {
    for (let i = this.groundAoes.length - 1; i >= 0; i--) {
      const aoe = this.groundAoes[i];
      if (this.tickCount >= aoe.expiresAtTick) {
        this.groundAoes.splice(i, 1);
        continue;
      }
      for (const id of this.players.values()) {
        const p = this.actors.get(id);
        if (!p || p.dead || p.downed) continue;
        if (p.pos.spaceId !== aoe.spaceId) continue;
        const d = Math.hypot(p.pos.x - aoe.x, p.pos.z - aoe.z);
        if (d <= aoe.radius) {
          dealDamage(this.ctx, id, aoe.sourceId, aoe.dps * DT, aoe.channel, false);
        }
      }
    }
  }

  private tickDownedAndWipes(): void {
    // Downed timers.
    for (const [charId, entityId] of this.players) {
      const p = this.actors.get(entityId);
      if (!p || !p.downed) continue;
      p.downedTicks--;
      if (p.downedTicks <= 0) this.releasePlayer(charId);
    }
    // Wipe detection (per space): if a boss is engaged and every player in
    // its space is downed or absent, the encounter resets and the downed
    // players release immediately (D-021).
    if (this.tickCount % 15 !== 0) return;
    const checkedEncounters = new Set<string>();
    for (const boss of this.actors.values()) {
      const tpl = this.content.actors[boss.templateId];
      if (!tpl || (tpl.tier !== 'boss' && tpl.tier !== 'elite')) continue;
      if (!boss.brain || boss.brain.state !== 'combat' || boss.dead) continue;
      const encounterKey = encounterKeyForActor(this.content, this.actors, boss);
      if (checkedEncounters.has(encounterKey)) continue;
      checkedEncounters.add(encounterKey);
      let anyUp = false;
      const downedHere: CharacterId[] = [];
      for (const [charId, entityId] of this.players) {
        const p = this.actors.get(entityId);
        if (!p || p.pos.spaceId !== boss.pos.spaceId) continue;
        if (p.downed) downedHere.push(charId);
        else if (!p.dead) anyUp = true;
      }
      if (!anyUp && downedHere.length > 0) {
        this.events.push({ type: 'encounterWipe', bossId: boss.id });
        this.resetEncounter(boss.id);
        for (const charId of downedHere) this.releasePlayer(charId);
      }
    }
  }

  /** Reset one authored encounter atomically: remove owned transient state,
   * restore every preplaced member, and unlock scaling for the next pull. */
  resetEncounter(bossId: EntityId): void {
    const boss = this.actors.get(bossId);
    if (!boss) return;
    const group = encounterMembers(this.content, this.actors, boss);
    const ownedIds = new Set(group.map((actor) => actor.id));
    const revivePreplaced = group.some(
      (actor) => actor.summonedBy === NO_ENTITY && hasAuthoredEncounter(this.content, actor),
    );

    // Pools/projectiles disappear before their sources are removed.
    for (let index = this.groundAoes.length - 1; index >= 0; index--) {
      if (ownedIds.has(this.groundAoes[index].sourceId)) this.groundAoes.splice(index, 1);
    }
    for (let index = this.projectiles.length - 1; index >= 0; index--) {
      if (ownedIds.has(this.projectiles[index].sourceId)) this.projectiles.splice(index, 1);
    }

    // Summons and summon descendants are transient encounter state.
    for (const member of group) {
      if (member.summonedBy !== NO_ENTITY) this.actors.delete(member.id);
    }

    for (const a of group) {
      if (a.summonedBy !== NO_ENTITY || !a.brain) continue;
      if (a.dead && !revivePreplaced) continue;
      a.dead = false;
      a.downed = false;
      a.downedTicks = 0;
      a.brain.state = 'idle';
      a.brain.targetId = 0;
      a.brain.lastKnownPos = null;
      a.brain.threat = {};
      a.brain.phase = 0;
      a.brain.abilityCooldowns = {};
      a.brain.scaledFor = 0;
      a.brain.timer = 0;
      a.brain.path = null;
      a.brain.pathIdx = 0;
      a.brain.repathCooldown = 0;
      a.brain.stuckTicks = 0;
      a.attack = null;
      const home = nearestTraversablePoint(
        this.content,
        this.colliders,
        a.brain.homePos.spaceId,
        a.brain.homePos.x,
        a.brain.homePos.z,
        this.seed,
      );
      if (home) a.pos = { spaceId: a.brain.homePos.spaceId, ...home };
      a.effects = [];
      if (a.lootRolled) {
        a.inventory = [];
        a.gold = 0;
        a.lootRolled = false;
      }
      recalcActorStats(this.content, a);
      a.health = a.stats.maxHealth;
      a.stamina = a.stats.maxStamina;
      a.magicka = a.stats.maxMagicka;
      if (a.spawnerId) this.spawnerClearedAt.delete(a.spawnerId);
    }
  }

  /** Downed player releases: teleport to the space's recovery point with
   * reduced resources. */
  releasePlayer(charId: CharacterId): void {
    const p = this.playerActor(charId);
    if (!p || !p.downed) return;
    p.downed = false;
    p.downedTicks = 0;
    recalcActorStats(this.content, p);
    p.health = p.stats.maxHealth * RELEASE_HEALTH_FRAC;
    p.stamina = p.stats.maxStamina * 0.5;
    p.magicka = p.stats.maxMagicka * 0.5;
    const respawn = this.respawnPosition(p.pos.spaceId);
    this.movePlayerTo(charId, respawn.spaceId, respawn.x, respawn.z, respawn.yaw);
    this.events.push({ type: 'playerReleased', playerId: p.id });
  }

  /** Player-requested escape from invalid or inescapable terrain. This uses
   * the established space recovery point without applying death penalties. */
  recoverPlayer(charId: CharacterId): 'recovered' | PlayerRecoveryRejection {
    const player = this.playerActor(charId);
    const transient = this.transientBy.get(charId);
    if (!player || !transient) return 'incapacitated';
    const rejected = recoveryRejection(this.ctx, player, transient.recoveryAvailableAtTick);
    if (rejected) {
      this.events.push({
        type: 'recoveryRejected',
        playerId: player.id,
        reason: rejected,
        secondsRemaining: rejected === 'cooldown'
          ? Math.ceil((transient.recoveryAvailableAtTick - this.tickCount) * DT)
          : 0,
      });
      return rejected;
    }

    const recovery = this.respawnPosition(player.pos.spaceId);
    this.movePlayerTo(charId, recovery.spaceId, recovery.x, recovery.z, recovery.yaw);
    transient.recoveryAvailableAtTick = this.tickCount + PLAYER_RECOVERY_COOLDOWN_TICKS;
    this.events.push({ type: 'playerRecovered', playerId: player.id });
    return 'recovered';
  }

  /** Recovery point: interiors release at their exit door; exteriors at the
   * starting ruin (the milestone's one graveyard-equivalent). */
  respawnPosition(spaceId: SpaceId): { spaceId: SpaceId; x: number; z: number; yaw: number } {
    const space = this.content.spaces[spaceId];
    if (space?.kind === 'interior') {
      const exit = this.content.doors.find((d) => d.spaceId === spaceId);
      if (exit) return { spaceId, x: exit.x, z: exit.z + 1.2, yaw: 0 };
    }
    return { spaceId: PLAYER_START.spaceId, x: PLAYER_START.x, z: PLAYER_START.z, yaw: PLAYER_START.yaw };
  }

  private tickRespawns(): void {
    const now = this.gameHours();
    for (const spawner of this.content.spawners) {
      if (spawner.respawnGameHours === 'never') continue;
      const alive = [...this.actors.values()].some((a) => a.spawnerId === spawner.id && !a.dead);
      if (alive) continue;
      const clearedAt = this.spawnerClearedAt.get(spawner.id);
      if (clearedAt === undefined) {
        this.spawnerClearedAt.set(spawner.id, now);
        continue;
      }
      if (now - clearedAt >= spawner.respawnGameHours) {
        for (const [id, a] of [...this.actors]) {
          if (a.spawnerId === spawner.id) this.actors.delete(id);
        }
        this.spawnerClearedAt.delete(spawner.id);
        this.runSpawner(spawner.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Per-character commands (hosts submit intent; sim resolves outcomes)
  // -------------------------------------------------------------------------

  meleeFor(charId: CharacterId): boolean {
    const p = this.playerActor(charId);
    if (!p) return false;
    return startMelee(this.ctx, p.id);
  }

  rangedFor(charId: CharacterId): boolean {
    const p = this.playerActor(charId);
    if (!p) return false;
    return startRanged(this.ctx, p.id);
  }

  castFor(charId: CharacterId, spellId: ContentId): boolean {
    const p = this.playerActor(charId);
    if (!p) return false;
    if (!(this.knownSpellsBy.get(charId) ?? []).includes(spellId)) {
      this.events.push({ type: 'actionRejected', actorId: p.id, action: 'spell', reason: 'unknown' });
      return false;
    }
    return startSpell(this.ctx, p.id, spellId);
  }

  useItemFor(charId: CharacterId, itemId: ContentId): boolean {
    const p = this.playerActor(charId);
    if (!p || p.downed) return false;
    return useItem(this.ctx, p.id, itemId);
  }

  equipFor(charId: CharacterId, itemId: ContentId): boolean {
    const p = this.playerActor(charId);
    if (!p || p.downed) return false;
    return equipItem(this.ctx, p.id, itemId);
  }

  takePerkFor(charId: CharacterId, perkId: ContentId): boolean {
    const p = this.playerActor(charId);
    if (!p) return false;
    return takePerk(this.ctx, p.id, perkId);
  }

  canTakePerkFor(charId: CharacterId, perkId: ContentId): { ok: boolean; reason: string } {
    const p = this.playerActor(charId);
    if (!p) return { ok: false, reason: 'no character' };
    return canTakePerk(this.ctx, p.id, perkId);
  }

  startQuestFor(charId: CharacterId, questId: ContentId): boolean {
    return startQuest(this.ctx, charId, questId);
  }

  journalOf(charId: CharacterId) {
    return journalFor(this.ctx, charId);
  }

  chatFrom(charId: CharacterId, text: string): boolean {
    const p = this.playerActor(charId);
    if (!p) return false;
    const clean = [...text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ')]
      .slice(0, 200)
      .join('');
    if (!clean) return false;
    this.events.push({ type: 'chat', playerId: p.id, text: clean });
    return true;
  }

  /** The nearest interactable within reach for one character: door,
   * container (not yet looted BY THIS CHARACTER), npc, corpse, or a downed
   * party member (revive). */
  nearestInteractableFor(
    charId: CharacterId,
  ): { kind: 'door' | 'container' | 'npc' | 'corpse' | 'revive'; id: string; name: string } | null {
    const p = this.playerActor(charId);
    if (!p) return null;
    const party = new Set(this.partyMembersOf(charId));
    const reach = 3.0;
    const looted = this.containersLootedOf(charId);
    let best: { kind: 'door' | 'container' | 'npc' | 'corpse' | 'revive'; id: string; name: string; d: number } | null =
      null;
    for (const door of this.content.doors) {
      if (door.spaceId !== p.pos.spaceId) continue;
      const d = Math.hypot(door.x - p.pos.x, door.z - p.pos.z);
      if (d < reach && (!best || d < best.d)) best = { kind: 'door', id: door.id, name: door.name, d };
    }
    for (const c of this.content.containers) {
      if (c.spaceId !== p.pos.spaceId || looted.has(c.id)) continue;
      const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
      if (d < reach && (!best || d < best.d)) best = { kind: 'container', id: c.id, name: c.name, d };
    }
    for (const a of this.actors.values()) {
      if (a.id === p.id || a.pos.spaceId !== p.pos.spaceId) continue;
      const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      if (d >= reach) continue;
      if (a.kind === 'player' && a.downed && party.has(this.charIdForEntity(a.id) ?? '')) {
        if (!best || d < best.d) best = { kind: 'revive', id: String(a.id), name: a.name, d };
      } else if (a.dead && (a.inventory.length > 0 || a.gold > 0)) {
        if (!best || d < best.d) best = { kind: 'corpse', id: String(a.id), name: a.name, d };
      } else if (!a.dead && a.kind === 'npc' && !this.isHostile(p, a)) {
        if (!best || d < best.d) best = { kind: 'npc', id: String(a.id), name: a.name, d };
      }
    }
    if (!best) return null;
    return { kind: best.kind, id: best.id, name: best.name };
  }

  /** Execute the context interaction for one character. */
  interactFor(charId: CharacterId): 'none' | 'door' | 'container' | 'dialogue' | 'loot' | 'revive' {
    const p = this.playerActor(charId);
    if (!p || p.dead || p.downed || p.interactCooldown > 0) return 'none';
    const target = this.nearestInteractableFor(charId);
    if (!target) return 'none';
    p.interactCooldown = 8;
    switch (target.kind) {
      case 'door': {
        const door = this.content.doors.find((d) => d.id === target.id)!;
        this.movePlayerTo(charId, door.targetSpaceId, door.targetX, door.targetZ, door.targetYaw);
        this.events.push({ type: 'interacted', actorId: p.id, targetKind: 'door', targetId: door.id });
        onQuestEvent(this.ctx, { type: 'interacted', actorId: p.id, targetKind: 'door', targetId: door.id });
        return 'door';
      }
      case 'container': {
        const c = this.content.containers.find((x) => x.id === target.id)!;
        const table = this.content.lootTables[c.lootTable];
        if (table) {
          // Personal container loot (D-019): deterministic per character via a
          // forked stream keyed by container + character.
          const rolled = rollLoot(this.rng.fork(hashString(c.id + ':' + charId)), table);
          for (const it of rolled.items) addItem(this.ctx, p.id, it.itemId, it.count);
          p.gold += rolled.gold;
        }
        this.containersLootedOf(charId).add(c.id);
        this.events.push({ type: 'interacted', actorId: p.id, targetKind: 'container', targetId: c.id });
        onQuestEvent(this.ctx, { type: 'interacted', actorId: p.id, targetKind: 'container', targetId: c.id });
        return 'container';
      }
      case 'corpse': {
        lootActor(this.ctx, p.id, Number(target.id));
        return 'loot';
      }
      case 'revive': {
        const downed = this.actors.get(Number(target.id));
        if (downed?.downed) {
          downed.downed = false;
          downed.downedTicks = 0;
          downed.health = downed.stats.maxHealth * REVIVE_HEALTH_FRAC;
          this.events.push({ type: 'playerRevived', playerId: downed.id, by: p.id });
        }
        return 'revive';
      }
      case 'npc': {
        const session = beginDialogue(this.ctx, charId, Number(target.id));
        if (session) {
          this.dialogueSessions.set(charId, session);
          return 'dialogue';
        }
        return 'none';
      }
    }
  }

  movePlayerTo(charId: CharacterId, spaceId: SpaceId, x: number, z: number, yaw: number): void {
    const p = this.playerActor(charId);
    const tr = this.transientBy.get(charId);
    if (!p) return;
    const safe = nearestTraversablePoint(this.content, this.colliders, spaceId, x, z, this.seed, 4);
    if (!safe) return;
    p.pos.spaceId = spaceId;
    p.pos.x = safe.x;
    p.pos.z = safe.z;
    p.pos.y = safe.y;
    p.yaw = yaw;
    p.vel.x = 0;
    p.vel.y = 0;
    p.vel.z = 0;
    p.moveIntent.x = 0;
    p.moveIntent.z = 0;
    p.attack = null;
    p.blocking = false;
    p.sprinting = false;
    if (tr) {
      tr.airborne = false;
      tr.vy = 0;
    }
    this.dialogueSessions.delete(charId);
    this.shopMerchantBy.delete(charId);
    this.events.push({ type: 'spaceEntered', playerId: p.id, spaceId });
    onQuestEvent(this.ctx, { type: 'spaceEntered', playerId: p.id, spaceId });
  }

  // Dialogue/shop per character.
  dialogueNodeFor(charId: CharacterId) {
    const session = this.dialogueSessions.get(charId);
    return session ? currentNode(this.ctx, session) : null;
  }

  dialogueChoicesFor(charId: CharacterId) {
    const session = this.dialogueSessions.get(charId);
    return session ? visibleChoices(this.ctx, session) : [];
  }

  dialogueChooseFor(charId: CharacterId, index: number): void {
    const session = this.dialogueSessions.get(charId);
    if (!session) return;
    const npcId = session.npcId;
    const alive = chooseOption(this.ctx, session, index);
    if (session.shopRequested) {
      this.shopMerchantBy.set(charId, npcId);
    }
    if (!alive) this.dialogueSessions.delete(charId);
  }

  dialogueEndFor(charId: CharacterId): void {
    this.dialogueSessions.delete(charId);
  }

  shopBuyFor(charId: CharacterId, itemId: ContentId): boolean {
    const merchantId = this.shopMerchantBy.get(charId);
    const p = this.playerActor(charId);
    if (!merchantId || !p) return false;
    return buyFromMerchant(this.ctx, p.id, merchantId, itemId);
  }

  shopSellFor(charId: CharacterId, itemId: ContentId): boolean {
    const merchantId = this.shopMerchantBy.get(charId);
    const p = this.playerActor(charId);
    if (!merchantId || !p) return false;
    return sellToMerchant(this.ctx, p.id, merchantId, itemId);
  }

  shopCloseFor(charId: CharacterId): void {
    this.shopMerchantBy.delete(charId);
  }

  // -------------------------------------------------------------------------
  // Legacy single-player wrappers (primary character). Kept so the offline
  // host and the original test fixtures keep exercising the same code paths.
  // -------------------------------------------------------------------------

  private primary(): CharacterId {
    if (!this.primaryCharId) throw new Error('no primary character');
    return this.primaryCharId;
  }

  playerMelee(): boolean {
    return this.meleeFor(this.primary());
  }

  playerRanged(): boolean {
    return this.rangedFor(this.primary());
  }

  playerCast(spellId: ContentId): boolean {
    return this.castFor(this.primary(), spellId);
  }

  playerUseItem(itemId: ContentId): boolean {
    return this.useItemFor(this.primary(), itemId);
  }

  playerEquip(itemId: ContentId): boolean {
    return this.equipFor(this.primary(), itemId);
  }

  playerTakePerk(perkId: ContentId): boolean {
    return this.takePerkFor(this.primary(), perkId);
  }

  playerCanTakePerk(perkId: ContentId): { ok: boolean; reason: string } {
    return this.canTakePerkFor(this.primary(), perkId);
  }

  playerStartQuest(questId: ContentId): boolean {
    return this.startQuestFor(this.primary(), questId);
  }

  journal() {
    return this.journalOf(this.primary());
  }

  nearestInteractable() {
    return this.nearestInteractableFor(this.primary());
  }

  interact() {
    return this.interactFor(this.primary());
  }

  transitionTo(spaceId: SpaceId, x: number, z: number, yaw: number): void {
    this.movePlayerTo(this.primary(), spaceId, x, z, yaw);
  }

  /** Back-compat view used by the offline host. */
  get dialogue(): DialogueSession | null {
    return this.dialogueSessions.get(this.primary()) ?? null;
  }

  set dialogue(session: DialogueSession | null) {
    if (session) this.dialogueSessions.set(this.primary(), session);
    else this.dialogueSessions.delete(this.primary());
  }

  get shopMerchantId(): EntityId {
    return this.shopMerchantBy.get(this.primary()) ?? NO_ENTITY;
  }

  get playerKnownSpells(): ContentId[] {
    return this.knownSpellsBy.get(this.primary()) ?? [];
  }

  dialogueNode() {
    return this.dialogueNodeFor(this.primary());
  }

  dialogueChoices() {
    return this.dialogueChoicesFor(this.primary());
  }

  dialogueChoose(index: number): void {
    this.dialogueChooseFor(this.primary(), index);
  }

  dialogueEnd(): void {
    this.dialogueEndFor(this.primary());
  }

  shopBuy(itemId: ContentId): boolean {
    return this.shopBuyFor(this.primary(), itemId);
  }

  shopSell(itemId: ContentId): boolean {
    return this.shopSellFor(this.primary(), itemId);
  }

  shopClose(): void {
    this.shopCloseFor(this.primary());
  }

  /** Offline host: instant release when downed (no party to revive). */
  respawnPlayer(): void {
    const p = this.player();
    if (p.downed) this.releasePlayer(this.primary());
  }

  // -------------------------------------------------------------------------
  // Save / load (world save, schema v3)
  // -------------------------------------------------------------------------

  serialize(): SaveGame {
    const actors: ActorSave[] = [];
    for (const a of this.actors.values()) {
      const save: ActorSave = {
        id: a.id,
        templateId: a.templateId,
        kind: a.kind,
        name: a.name,
        pos: { ...a.pos },
        yaw: a.yaw,
        health: a.health,
        stamina: a.stamina,
        magicka: a.magicka,
        dead: a.dead,
        inventory: a.inventory.map((s) => ({ ...s })),
        equipment: { ...(a.equipment as Record<string, string>) },
        gold: a.gold,
        effects: a.effects.map((e) => ({ ...e })),
        spawnerId: a.spawnerId,
        lootRolled: a.lootRolled,
      };
      if (a.downed) {
        save.downed = true;
        save.downedTicks = a.downedTicks;
      }
      if (a.brain) {
        save.brainState = { state: a.brain.state, homePos: { ...a.brain.homePos } };
      }
      if (a.kind === 'player') {
        save.skills = JSON.parse(JSON.stringify(a.skills));
        save.perks = [...a.perks];
        save.level = a.level;
        save.characterXp = a.characterXp;
        save.perkPoints = a.perkPoints;
      }
      actors.push(save);
    }
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      contentVersion: CONTENT_VERSION,
      seed: this.seed,
      tick: this.tickCount,
      rngState: this.rng.getState(),
      nextEntityId: this.nextEntityId,
      players: [...this.players].map(([charId, entityId]) => ({ charId, entityId })),
      primaryCharId: this.primaryCharId,
      actors,
      questLogs: [...this.questLogs].map(([charId, log]) => ({
        charId,
        quests: JSON.parse(JSON.stringify([...log.values()])),
      })),
      knownSpells: [...this.knownSpellsBy].map(([charId, spells]) => ({ charId, spells: [...spells] })),
      containersLootedBy: [...this.containersLootedByChar].map(([charId, ids]) => ({ charId, ids: [...ids] })),
      characterNames: [...this.characterNames].map(([charId, name]) => ({ charId, name })),
      parties: [...this.parties].map(([partyId, members]) => ({ partyId, members: [...members] })),
      spawnersSpawned: [...this.spawnersSpawned],
    };
  }

  saveToJson(): string {
    return JSON.stringify(this.serialize());
  }

  static load(json: string, content: ContentRegistry = CONTENT): Sim {
    const save = parseSave(json);
    const sim = new Sim(save.seed, content, { skipSpawn: true });
    sim.tickCount = save.tick;
    sim.rng.setState(save.rngState);
    sim.nextEntityId = save.nextEntityId;
    sim.primaryCharId = save.primaryCharId;
    sim.spawnersSpawned = new Set(save.spawnersSpawned);
    for (const as of save.actors) {
      if (as.kind !== 'player' && !content.actors[as.templateId]) continue;
      const actor = createActor(as.id, as.kind, as.templateId, as.name, {
        spaceId: as.pos.spaceId,
        x: as.pos.x,
        y: as.pos.y,
        z: as.pos.z,
      });
      actor.yaw = as.yaw;
      actor.dead = as.dead;
      actor.downed = as.downed ?? false;
      actor.downedTicks = as.downedTicks ?? 0;
      actor.inventory = as.inventory.map((s) => ({ ...s }));
      actor.equipment = { ...as.equipment } as Actor['equipment'];
      actor.gold = as.gold;
      actor.effects = as.effects.map((e) => ({ ...e }));
      actor.spawnerId = as.spawnerId;
      actor.lootRolled = as.lootRolled;
      actor.factionId = as.kind === 'player' ? 'player' : (content.actors[as.templateId]?.factionId ?? null);
      if (as.brainState) {
        actor.brain = makeBrain({
          spaceId: as.brainState.homePos.spaceId,
          x: as.brainState.homePos.x,
          y: as.brainState.homePos.y,
          z: as.brainState.homePos.z,
        });
        if (as.dead) actor.brain.state = 'dead';
      }
      if (as.kind === 'player') {
        if (as.skills) actor.skills = as.skills as Actor['skills'];
        actor.perks = as.perks ?? [];
        actor.level = as.level ?? 1;
        actor.characterXp = as.characterXp ?? 0;
        actor.perkPoints = as.perkPoints ?? 0;
      }
      sim.actors.set(actor.id, actor);
      recalcActorStats(content, actor);
      actor.health = Math.min(as.health, actor.stats.maxHealth);
      actor.stamina = Math.min(as.stamina, actor.stats.maxStamina);
      actor.magicka = Math.min(as.magicka, actor.stats.maxMagicka);
    }
    for (const p of save.players) {
      sim.players.set(p.charId, p.entityId);
      sim.transientBy.set(p.charId, { vy: 0, airborne: false, lastYaw: 0, recoveryAvailableAtTick: 0 });
    }
    for (const entry of save.questLogs) {
      const log = new Map<ContentId, QuestState>();
      for (const q of entry.quests) log.set(q.questId, JSON.parse(JSON.stringify(q)));
      sim.questLogs.set(entry.charId, log);
    }
    for (const entry of save.knownSpells) {
      sim.knownSpellsBy.set(entry.charId, [...entry.spells]);
    }
    for (const entry of save.containersLootedBy) {
      sim.containersLootedByChar.set(entry.charId, new Set(entry.ids));
    }
    for (const entry of save.characterNames) {
      sim.characterNames.set(entry.charId, entry.name);
    }
    for (const entry of save.parties) {
      sim.parties.set(entry.partyId, [...entry.members]);
    }
    return sim;
  }
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type { DamageChannel, SkillId, CharacterId };
