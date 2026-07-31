// The Sim coordinator: owns world state, the tick-phase order, the SimContext
// binding, player command entry points, and save/load. System behavior lives
// in the sibling modules (combat/, ai/, quests/, inventory/, ...) behind the
// SimContext seam; this file stays a thin conductor. LOCKED D-001/D-002.

import { Rng } from './rng';
import {
  DT,
  GAME_HOURS_PER_SECOND,
  SPRINT_MULT,
  SPRINT_STAMINA_PER_SEC,
  SNEAK_MULT,
  NO_ENTITY,
  type Actor,
  type ContentId,
  type DamageChannel,
  type EntityId,
  type Position,
  type QuestState,
  type SimEvent,
  type SkillId,
  type SpaceId,
} from './types';
import { CONTENT, CONTENT_VERSION, PLAYER_START } from './content';
import { validateContent, type ContentRegistry } from './content/schema';
import { CollisionIndex, resolveMove } from './world/collision';
import { groundHeight } from './world/spaces';
import { isActiveAt } from './world/cells';
import { createActor, recalcActorStats } from './actors/actor';
import { makeBrain, tickBrain } from './ai/brain';
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
import type { SimContext } from './sim_context';
import { SAVE_SCHEMA_VERSION, parseSave, type ActorSave, type SaveGame } from './save/save';

/** Factions hostile to each other (symmetric). Wild creatures (factionId null,
 * aggressive) are hostile to everything but their own template. */
const HOSTILE_PAIRS: ReadonlySet<string> = new Set(['redclaw|fenharrow', 'fenharrow|redclaw', 'redclaw|player', 'player|redclaw']);

export interface PlayerInput {
  /** Normalized move intent in the player's local heading space. */
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint: boolean;
  sneak: boolean;
  block: boolean;
  jump: boolean;
}

export class Sim {
  readonly content: ContentRegistry;
  readonly seed: number;
  readonly rng: Rng;
  readonly colliders: CollisionIndex;
  readonly actors = new Map<EntityId, Actor>();
  readonly projectiles: import('./types').Projectile[] = [];
  readonly quests = new Map<ContentId, QuestState>();
  /** Events emitted during the most recent tick (hosts consume, sim clears). */
  events: SimEvent[] = [];
  tickCount = 0;
  nextEntityId = 1;
  playerIdValue: EntityId = NO_ENTITY;
  playerKnownSpells: ContentId[] = [];
  spawnersSpawned = new Set<string>();
  containersLooted = new Set<string>();
  /** Per-spawner game-hour when its last actor died (respawn bookkeeping). */
  spawnerClearedAt = new Map<string, number>();
  dialogue: DialogueSession | null = null;
  /** Merchant the open shop belongs to (0 = closed). */
  shopMerchantId: EntityId = NO_ENTITY;
  private playerVy = 0;
  private playerAirborne = false;
  private readonly ctx: SimContext;

  constructor(seed: number, content: ContentRegistry = CONTENT, opts: { skipSpawn?: boolean } = {}) {
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
      this.spawnPlayer();
      this.spawnWorld();
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
      get quests() {
        return sim.quests;
      },
      get events() {
        return sim.events;
      },
      gameHours: () => sim.gameHours(),
      playerId: () => sim.playerIdValue,
      player: () => sim.player(),
      emit: (e) => sim.events.push(e),
      dealDamage: (t, s, a, c) => dealDamage(sim.ctx, t, s, a, c),
      applyHeal: (t, amount) => {
        const actor = sim.actors.get(t);
        if (!actor || actor.dead) return;
        const before = actor.health;
        actor.health = Math.min(actor.stats.maxHealth, actor.health + amount);
        if (actor.health > before) sim.events.push({ type: 'heal', targetId: t, amount: actor.health - before });
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
      isActorActive: (a) => sim.isActorActive(a),
      isHostile: (a, b) => sim.isHostile(a, b),
      ground: (spaceId, x, z) => groundHeight(sim.content, spaceId, x, z, sim.seed),
    };
  }

  /** Test/tooling access to the seam (headless drivers, debug inspectors). */
  context(): SimContext {
    return this.ctx;
  }

  // -------------------------------------------------------------------------
  // World construction
  // -------------------------------------------------------------------------

  private spawnPlayer(): void {
    const id = this.nextEntityId++;
    const pos: Position = {
      spaceId: PLAYER_START.spaceId,
      x: PLAYER_START.x,
      y: 0,
      z: PLAYER_START.z,
    };
    pos.y = groundHeight(this.content, pos.spaceId, pos.x, pos.z, this.seed);
    const player = createActor(id, 'player', 'player', 'Wanderer', pos);
    player.yaw = PLAYER_START.yaw;
    player.factionId = 'player';
    player.gold = 25;
    this.actors.set(id, player);
    this.playerIdValue = id;
    recalcActorStats(this.content, player);
    // Starting kit.
    addItem(this.ctx, id, 'worn_dagger', 1);
    addItem(this.ctx, id, 'bread', 2);
    addItem(this.ctx, id, 'healing_draught', 1);
    equipItem(this.ctx, id, 'worn_dagger');
    this.playerKnownSpells = ['flamebolt', 'mend_wounds'];
    player.health = player.stats.maxHealth;
    player.stamina = player.stats.maxStamina;
    player.magicka = player.stats.maxMagicka;
  }

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
      const id = this.nextEntityId++;
      const x = spawner.x + (spawner.count > 1 ? rng.range(-spawner.radius, spawner.radius) : 0);
      const z = spawner.z + (spawner.count > 1 ? rng.range(-spawner.radius, spawner.radius) : 0);
      const pos: Position = {
        spaceId: spawner.spaceId,
        x,
        y: groundHeight(this.content, spawner.spaceId, x, z, this.seed),
        z,
      };
      const actor = createActor(id, tpl.kind, tpl.id, tpl.name, pos);
      actor.factionId = tpl.factionId ?? null;
      actor.spawnerId = spawner.id;
      actor.brain = makeBrain(pos);
      this.actors.set(id, actor);
      recalcActorStats(this.content, actor);
      actor.health = actor.stats.maxHealth;
      actor.stamina = actor.stats.maxStamina;
      actor.magicka = actor.stats.maxMagicka;
    }
    this.spawnersSpawned.add(spawner.id);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  player(): Actor {
    const p = this.actors.get(this.playerIdValue);
    if (!p) throw new Error('player missing');
    return p;
  }

  gameHours(): number {
    return 8 + this.tickCount * DT * GAME_HOURS_PER_SECOND;
  }

  isActorActive(a: Actor): boolean {
    const player = this.actors.get(this.playerIdValue);
    if (!player) return false;
    const exterior = this.content.spaces[player.pos.spaceId]?.kind === 'exterior';
    return isActiveAt(player.pos.spaceId, player.pos.x, player.pos.z, a.pos.spaceId, a.pos.x, a.pos.z, exterior);
  }

  isHostile(a: Actor, b: Actor): boolean {
    if (a.id === b.id || a.dead || b.dead) return false;
    const fa = a.factionId ?? `wild:${a.templateId}`;
    const fb = b.factionId ?? `wild:${b.templateId}`;
    if (fa === fb) return false;
    if (HOSTILE_PAIRS.has(`${fa}|${fb}`)) return true;
    // Wild aggressive creatures attack everyone outside their own template.
    const ta = this.content.actors[a.templateId];
    const tb = this.content.actors[b.templateId];
    if (a.factionId === null && ta?.aggressive) return true;
    if (b.factionId === null && tb?.aggressive) return true;
    return false;
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  tick(input: PlayerInput): void {
    this.events = [];
    this.tickCount++;

    this.tickPlayer(input);

    // Deterministic actor order: ascending entity id (Map preserves insertion,
    // which is ascending here; sort defensively after loads).
    const ids = [...this.actors.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const a = this.actors.get(id);
      if (!a || a.dead) continue;
      tickEffects(this.ctx, id);
      if (a.kind !== 'player') tickBrain(this.ctx, id);
      tickAttack(this.ctx, id);
      this.tickRegen(a);
    }
    tickProjectiles(this.ctx);

    if (this.tickCount % 10 === 0) tickReachObjectives(this.ctx);
    if (this.tickCount % 300 === 0) this.tickRespawns();
  }

  private tickPlayer(input: PlayerInput): void {
    const p = this.player();
    if (p.dead) return;
    p.yaw = input.yaw;
    p.sneaking = input.sneak;
    p.blocking = input.block && p.stamina > 0;
    p.sprinting = input.sprint && p.stamina > 0 && !input.sneak;

    let speed = p.stats.moveSpeed;
    if (p.sprinting) speed *= SPRINT_MULT;
    if (p.sneaking) speed *= SNEAK_MULT;
    if (p.blocking) speed *= 0.55;

    const len = Math.hypot(input.moveX, input.moveZ);
    if (len > 0.01) {
      const nx = input.moveX / Math.max(1, len);
      const nz = input.moveZ / Math.max(1, len);
      // Rotate local intent into world space by yaw.
      const wx = nx * Math.cos(p.yaw) + nz * Math.sin(p.yaw);
      const wz = -nx * Math.sin(p.yaw) + nz * Math.cos(p.yaw);
      const moved = resolveMove(this.content, this.colliders, p.pos.spaceId, p.pos, wx * speed * DT, wz * speed * DT, this.seed);
      p.pos.x = moved.x;
      p.pos.z = moved.z;
      if (!this.playerAirborne) p.pos.y = moved.y;
      if (p.sprinting) {
        p.stamina = Math.max(0, p.stamina - SPRINT_STAMINA_PER_SEC * DT);
        if (p.stamina === 0) p.sprinting = false;
      }
      if (p.sneaking && this.tickCount % 30 === 0) trainSkill(this.ctx, p.id, 'sneak', 1);
    }

    // Jump / gravity.
    const ground = groundHeight(this.content, p.pos.spaceId, p.pos.x, p.pos.z, this.seed);
    if (input.jump && !this.playerAirborne && p.stamina >= 5) {
      this.playerVy = 5.2;
      this.playerAirborne = true;
      p.stamina -= 5;
    }
    if (this.playerAirborne) {
      this.playerVy -= 14 * DT;
      p.pos.y += this.playerVy * DT;
      if (p.pos.y <= ground) {
        p.pos.y = ground;
        this.playerVy = 0;
        this.playerAirborne = false;
      }
    } else {
      p.pos.y = ground;
    }

    if (p.interactCooldown > 0) p.interactCooldown--;
  }

  private tickRegen(a: Actor): void {
    if (a.dead) return;
    a.health = Math.min(a.stats.maxHealth, a.health + a.stats.healthRegen * DT);
    if (!a.sprinting) a.stamina = Math.min(a.stats.maxStamina, a.stamina + a.stats.staminaRegen * DT);
    a.magicka = Math.min(a.stats.maxMagicka, a.magicka + a.stats.magickaRegen * DT);
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
        // Remove old corpses of this spawner, then respawn.
        for (const [id, a] of [...this.actors]) {
          if (a.spawnerId === spawner.id) this.actors.delete(id);
        }
        this.spawnerClearedAt.delete(spawner.id);
        this.runSpawner(spawner.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Player commands (hosts call these; the renderer never resolves outcomes)
  // -------------------------------------------------------------------------

  playerMelee(): boolean {
    return startMelee(this.ctx, this.playerIdValue);
  }

  playerRanged(): boolean {
    return startRanged(this.ctx, this.playerIdValue);
  }

  playerCast(spellId: ContentId): boolean {
    if (!this.playerKnownSpells.includes(spellId)) return false;
    return startSpell(this.ctx, this.playerIdValue, spellId);
  }

  playerUseItem(itemId: ContentId): boolean {
    return useItem(this.ctx, this.playerIdValue, itemId);
  }

  playerEquip(itemId: ContentId): boolean {
    return equipItem(this.ctx, this.playerIdValue, itemId);
  }

  playerTakePerk(perkId: ContentId): boolean {
    return takePerk(this.ctx, this.playerIdValue, perkId);
  }

  playerCanTakePerk(perkId: ContentId): { ok: boolean; reason: string } {
    return canTakePerk(this.ctx, this.playerIdValue, perkId);
  }

  playerStartQuest(questId: ContentId): boolean {
    return startQuest(this.ctx, questId);
  }

  journal() {
    return journalFor(this.ctx);
  }

  /** The nearest interactable within reach: door, container, npc, or corpse. */
  nearestInteractable(): { kind: 'door' | 'container' | 'npc' | 'corpse'; id: string; name: string } | null {
    const p = this.player();
    const reach = 3.0;
    let best: { kind: 'door' | 'container' | 'npc' | 'corpse'; id: string; name: string; d: number } | null = null;
    for (const door of this.content.doors) {
      if (door.spaceId !== p.pos.spaceId) continue;
      const d = Math.hypot(door.x - p.pos.x, door.z - p.pos.z);
      if (d < reach && (!best || d < best.d)) best = { kind: 'door', id: door.id, name: door.name, d };
    }
    for (const c of this.content.containers) {
      if (c.spaceId !== p.pos.spaceId || this.containersLooted.has(c.id)) continue;
      const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
      if (d < reach && (!best || d < best.d)) best = { kind: 'container', id: c.id, name: c.name, d };
    }
    for (const a of this.actors.values()) {
      if (a.id === this.playerIdValue || a.pos.spaceId !== p.pos.spaceId) continue;
      const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z);
      if (d >= reach) continue;
      if (a.dead && (a.inventory.length > 0 || a.gold > 0)) {
        if (!best || d < best.d) best = { kind: 'corpse', id: String(a.id), name: a.name, d };
      } else if (!a.dead && a.kind === 'npc' && !this.isHostile(this.player(), a)) {
        if (!best || d < best.d) best = { kind: 'npc', id: String(a.id), name: a.name, d };
      }
    }
    if (!best) return null;
    return { kind: best.kind, id: best.id, name: best.name };
  }

  /** Execute the context interaction. Returns what happened for the host UI. */
  interact(): 'none' | 'door' | 'container' | 'dialogue' | 'loot' {
    const p = this.player();
    if (p.dead || p.interactCooldown > 0) return 'none';
    const target = this.nearestInteractable();
    if (!target) return 'none';
    p.interactCooldown = 8;
    switch (target.kind) {
      case 'door': {
        const door = this.content.doors.find((d) => d.id === target.id)!;
        this.transitionTo(door.targetSpaceId, door.targetX, door.targetZ, door.targetYaw);
        this.events.push({ type: 'interacted', actorId: p.id, targetKind: 'door', targetId: door.id });
        onQuestEvent(this.ctx, { type: 'interacted', actorId: p.id, targetKind: 'door', targetId: door.id });
        return 'door';
      }
      case 'container': {
        const c = this.content.containers.find((x) => x.id === target.id)!;
        const table = this.content.lootTables[c.lootTable];
        if (table) {
          const rolled = rollLoot(this.rng, table);
          for (const it of rolled.items) addItem(this.ctx, p.id, it.itemId, it.count);
          p.gold += rolled.gold;
        }
        this.containersLooted.add(c.id);
        this.events.push({ type: 'interacted', actorId: p.id, targetKind: 'container', targetId: c.id });
        onQuestEvent(this.ctx, { type: 'interacted', actorId: p.id, targetKind: 'container', targetId: c.id });
        return 'container';
      }
      case 'corpse': {
        lootActor(this.ctx, p.id, Number(target.id));
        return 'loot';
      }
      case 'npc': {
        const session = beginDialogue(this.ctx, Number(target.id));
        if (session) {
          this.dialogue = session;
          return 'dialogue';
        }
        return 'none';
      }
    }
  }

  transitionTo(spaceId: SpaceId, x: number, z: number, yaw: number): void {
    const p = this.player();
    p.pos.spaceId = spaceId;
    p.pos.x = x;
    p.pos.z = z;
    p.pos.y = groundHeight(this.content, spaceId, x, z, this.seed);
    p.yaw = yaw;
    this.playerAirborne = false;
    this.playerVy = 0;
    this.events.push({ type: 'spaceEntered', spaceId });
    onQuestEvent(this.ctx, { type: 'spaceEntered', spaceId });
  }

  // Dialogue passthroughs for hosts.
  dialogueNode() {
    return this.dialogue ? currentNode(this.ctx, this.dialogue) : null;
  }

  dialogueChoices() {
    return this.dialogue ? visibleChoices(this.ctx, this.dialogue) : [];
  }

  dialogueChoose(index: number): void {
    if (!this.dialogue) return;
    const npcId = this.dialogue.npcId;
    const alive = chooseOption(this.ctx, this.dialogue, index);
    if (this.dialogue.shopRequested) {
      this.shopMerchantId = npcId;
    }
    if (!alive) this.dialogue = null;
  }

  dialogueEnd(): void {
    this.dialogue = null;
  }

  shopBuy(itemId: ContentId): boolean {
    if (this.shopMerchantId === NO_ENTITY) return false;
    return buyFromMerchant(this.ctx, this.playerIdValue, this.shopMerchantId, itemId);
  }

  shopSell(itemId: ContentId): boolean {
    if (this.shopMerchantId === NO_ENTITY) return false;
    return sellToMerchant(this.ctx, this.playerIdValue, this.shopMerchantId, itemId);
  }

  shopClose(): void {
    this.shopMerchantId = NO_ENTITY;
  }

  /** Respawn after death: back to the start, resources restored, gold kept. */
  respawnPlayer(): void {
    const p = this.player();
    if (!p.dead) return;
    p.dead = false;
    p.health = p.stats.maxHealth * 0.5;
    p.stamina = p.stats.maxStamina;
    p.magicka = p.stats.maxMagicka;
    this.transitionTo(PLAYER_START.spaceId, PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw);
  }

  // -------------------------------------------------------------------------
  // Save / load
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
      playerId: this.playerIdValue,
      actors,
      quests: JSON.parse(JSON.stringify([...this.quests.values()])),
      spawnersSpawned: [...this.spawnersSpawned],
      containersLooted: [...this.containersLooted],
      // Extension field (not schema-critical): known spells.
      ...({ playerKnownSpells: [...this.playerKnownSpells] } as object),
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
    sim.playerIdValue = save.playerId;
    sim.spawnersSpawned = new Set(save.spawnersSpawned);
    sim.containersLooted = new Set(save.containersLooted);
    const extra = save as unknown as { playerKnownSpells?: string[] };
    sim.playerKnownSpells = extra.playerKnownSpells ?? ['flamebolt', 'mend_wounds'];
    for (const as of save.actors) {
      // Skip actors whose template no longer exists (content removal safety).
      if (as.kind !== 'player' && !content.actors[as.templateId]) continue;
      const actor = createActor(as.id, as.kind, as.templateId, as.name, {
        spaceId: as.pos.spaceId,
        x: as.pos.x,
        y: as.pos.y,
        z: as.pos.z,
      });
      actor.yaw = as.yaw;
      actor.dead = as.dead;
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
    for (const q of save.quests) {
      sim.quests.set(q.questId, JSON.parse(JSON.stringify(q)));
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

export type { DamageChannel, SkillId };
