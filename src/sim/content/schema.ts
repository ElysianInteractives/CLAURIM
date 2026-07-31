// Content record types + the tiny dependency-free validator (LOCKED D-006:
// content is data-as-code, validated at test time and at build time by
// scripts/validate_content.ts; a record that fails validation is a build error).

import type {
  ContentId,
  DamageChannel,
  EquipSlot,
  SkillId,
  SpaceId,
  StatKey,
} from '../types';
import type { StatModifier } from '../effects/modifiers';

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type ItemKind = 'weapon' | 'armor' | 'consumable' | 'ingredient' | 'misc' | 'quest';
export type WeaponType = 'sword' | 'axe' | 'dagger' | 'bow';

export interface ItemDef {
  id: ContentId;
  name: string;
  kind: ItemKind;
  weight: number;
  value: number;
  /** weapon fields */
  weaponType?: WeaponType;
  damage?: number;
  damageChannel?: DamageChannel;
  /** armor fields */
  slot?: EquipSlot;
  armor?: number;
  /** consumable: effects applied on use */
  useEffects?: ContentId[];
  /** equipment: passive modifiers while equipped */
  equipMods?: StatModifier[];
  stackable?: boolean;
  /** Governs which skill trains on use (weapons/armor). */
  skill?: SkillId;
}

// ---------------------------------------------------------------------------
// Effects and spells
// ---------------------------------------------------------------------------

export interface EffectDef {
  id: ContentId;
  name: string;
  /** Seconds. Infinity not allowed here; permanent mods come from equipment/perks. */
  duration: number;
  stackRule: 'refresh' | 'stack' | 'ignore';
  maxStacks: number;
  mods: StatModifier[];
  /** Damage over time, per second. */
  dot?: { channel: DamageChannel; perSecond: number };
  /** Heal over time, per second. */
  hot?: { perSecond: number };
}

export type SpellKind = 'projectile' | 'self';

export interface SpellDef {
  id: ContentId;
  name: string;
  kind: SpellKind;
  magickaCost: number;
  /** projectile */
  damage?: number;
  channel?: DamageChannel;
  /** effects applied to target (projectile) or self */
  applyEffects?: ContentId[];
  /** self heal amount */
  heal?: number;
  skill: SkillId;
}

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------

export interface PerkDef {
  id: ContentId;
  name: string;
  description: string;
  skill: SkillId;
  requiredSkillLevel: number;
  requiresPerk?: ContentId;
  mods: StatModifier[];
}

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

export interface LootEntry {
  itemId: ContentId;
  min: number;
  max: number;
  chance: number;
}

export interface LootTableDef {
  id: ContentId;
  entries: LootEntry[];
  goldMin: number;
  goldMax: number;
}

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  fromHour: number;
  toHour: number;
  spaceId: SpaceId;
  x: number;
  z: number;
  activity: 'work' | 'idle' | 'sleep' | 'wander';
}

export interface ActorTemplate {
  id: ContentId;
  name: string;
  kind: 'npc' | 'creature';
  level: number;
  baseStats: Partial<Record<StatKey, number>>;
  attack: 'melee' | 'ranged';
  attackDamage: number;
  attackChannel: DamageChannel;
  aggressive: boolean;
  fleeBelowHealthFrac: number;
  perceptionRange: number;
  lootTable?: ContentId;
  factionId?: ContentId;
  schedule?: ScheduleEntry[];
  dialogueId?: ContentId;
  merchant?: { buys: ItemKind[]; stockTable: ContentId; gold: number };
  /** Visual archetype key for the renderer (not gameplay). */
  archetype: string;
  respawnGameHours: number | 'never';
  moveSpeed?: number;
}

// ---------------------------------------------------------------------------
// World placement
// ---------------------------------------------------------------------------

export interface PropDef {
  id: string;
  spaceId: SpaceId;
  kind: string;
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  sx: number;
  sy: number;
  sz: number;
  solid: boolean;
}

export interface DoorDef {
  id: string;
  spaceId: SpaceId;
  x: number;
  z: number;
  name: string;
  targetSpaceId: SpaceId;
  targetX: number;
  targetZ: number;
  targetYaw: number;
}

export interface SpawnerDef {
  id: string;
  spaceId: SpaceId;
  x: number;
  z: number;
  actorId: ContentId;
  count: number;
  radius: number;
  /** 'never' = cleared stays cleared (dungeon persistence). */
  respawnGameHours: number | 'never';
}

export interface ContainerDef {
  id: string;
  spaceId: SpaceId;
  x: number;
  z: number;
  name: string;
  lootTable: ContentId;
}

export interface RoomRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface InteriorLayout {
  /** Walkable floor = union of room rects; everything else is solid rock/wall. */
  rooms: RoomRect[];
  ceilingY: number;
}

export interface SpaceDef {
  id: SpaceId;
  name: string;
  kind: 'exterior' | 'interior';
  interior?: InteriorLayout;
}

// ---------------------------------------------------------------------------
// Quests and dialogue
// ---------------------------------------------------------------------------

export type ObjectiveKind = 'kill' | 'collect' | 'talkTo' | 'reach' | 'interact';

export interface ObjectiveDef {
  id: string;
  kind: ObjectiveKind;
  /** kill: actor template id; collect: item id; talkTo: npc template id;
   * reach: "spaceId:x:z:radius"; interact: container/door id. */
  target: string;
  count: number;
  text: string;
  optional?: boolean;
}

export interface QuestStageDef {
  id: string;
  journal: string;
  objectives: ObjectiveDef[];
  /** Stage id to advance to when all non-optional objectives complete.
   * 'done' completes the quest. */
  next: string;
}

export interface QuestRewardDef {
  gold: number;
  items: { itemId: ContentId; count: number }[];
  xp: number;
}

export interface QuestDef {
  id: ContentId;
  name: string;
  stages: QuestStageDef[];
  reward: QuestRewardDef;
}

export type DialogueConditionDef =
  | { kind: 'questAtStage'; questId: ContentId; stageId: string }
  | { kind: 'questNotStarted'; questId: ContentId }
  | { kind: 'questCompleted'; questId: ContentId }
  | { kind: 'hasItem'; itemId: ContentId; count: number }
  | { kind: 'skillAtLeast'; skill: SkillId; level: number };

export type DialogueActionDef =
  | { kind: 'startQuest'; questId: ContentId }
  | { kind: 'advanceQuest'; questId: ContentId; stageId: string }
  | { kind: 'giveItem'; itemId: ContentId; count: number }
  | { kind: 'takeItem'; itemId: ContentId; count: number }
  | { kind: 'giveGold'; amount: number }
  | { kind: 'openShop' }
  | { kind: 'trainSkillXp'; skill: SkillId; amount: number };

export interface DialogueChoiceDef {
  text: string;
  conditions?: DialogueConditionDef[];
  actions?: DialogueActionDef[];
  /** Next node id, or 'end'. */
  next: string;
}

export interface DialogueNodeDef {
  id: string;
  text: string;
  choices: DialogueChoiceDef[];
}

export interface DialogueDef {
  id: ContentId;
  /** Entry node selection: first entry whose conditions pass wins. */
  entries: { conditions?: DialogueConditionDef[]; node: string }[];
  nodes: DialogueNodeDef[];
}

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

export interface ContentRegistry {
  version: string;
  items: Record<ContentId, ItemDef>;
  effects: Record<ContentId, EffectDef>;
  spells: Record<ContentId, SpellDef>;
  perks: Record<ContentId, PerkDef>;
  lootTables: Record<ContentId, LootTableDef>;
  actors: Record<ContentId, ActorTemplate>;
  spaces: Record<SpaceId, SpaceDef>;
  props: PropDef[];
  doors: DoorDef[];
  spawners: SpawnerDef[];
  containers: ContainerDef[];
  quests: Record<ContentId, QuestDef>;
  dialogues: Record<ContentId, DialogueDef>;
}

// ---------------------------------------------------------------------------
// Validator (no external schema dependency; see docs/project/DECISIONS.md D-006)
// ---------------------------------------------------------------------------

export function validateContent(c: ContentRegistry): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const ids = new Set<string>();
  const uniq = (scope: string, id: string) => {
    const key = `${scope}:${id}`;
    if (ids.has(key)) err(`duplicate ${scope} id: ${id}`);
    ids.add(key);
  };

  for (const [id, item] of Object.entries(c.items)) {
    uniq('item', id);
    if (item.id !== id) err(`item ${id}: id mismatch (${item.id})`);
    if (!item.name) err(`item ${id}: missing name`);
    if (item.weight < 0) err(`item ${id}: negative weight`);
    if (item.value < 0) err(`item ${id}: negative value`);
    if (item.kind === 'weapon') {
      if (item.damage === undefined || item.damage <= 0) err(`item ${id}: weapon needs damage > 0`);
      if (!item.weaponType) err(`item ${id}: weapon needs weaponType`);
      if (!item.skill) err(`item ${id}: weapon needs governing skill`);
    }
    if (item.kind === 'armor') {
      if (!item.slot) err(`item ${id}: armor needs slot`);
      if (item.armor === undefined || item.armor < 0) err(`item ${id}: armor needs armor >= 0`);
    }
    for (const e of item.useEffects ?? []) {
      if (!c.effects[e]) err(`item ${id}: unknown useEffect ${e}`);
    }
  }

  for (const [id, ef] of Object.entries(c.effects)) {
    uniq('effect', id);
    if (ef.id !== id) err(`effect ${id}: id mismatch`);
    if (!(ef.duration > 0)) err(`effect ${id}: duration must be > 0`);
    if (ef.maxStacks < 1) err(`effect ${id}: maxStacks must be >= 1`);
  }

  for (const [id, sp] of Object.entries(c.spells)) {
    uniq('spell', id);
    if (sp.id !== id) err(`spell ${id}: id mismatch`);
    if (sp.magickaCost < 0) err(`spell ${id}: negative cost`);
    if (sp.kind === 'projectile' && (sp.damage === undefined || !sp.channel))
      err(`spell ${id}: projectile needs damage + channel`);
    for (const e of sp.applyEffects ?? []) {
      if (!c.effects[e]) err(`spell ${id}: unknown effect ${e}`);
    }
  }

  for (const [id, p] of Object.entries(c.perks)) {
    uniq('perk', id);
    if (p.id !== id) err(`perk ${id}: id mismatch`);
    if (p.requiresPerk && !c.perks[p.requiresPerk]) err(`perk ${id}: unknown prereq ${p.requiresPerk}`);
    if (p.requiredSkillLevel < 1) err(`perk ${id}: requiredSkillLevel must be >= 1`);
  }

  for (const [id, lt] of Object.entries(c.lootTables)) {
    uniq('lootTable', id);
    if (lt.id !== id) err(`lootTable ${id}: id mismatch`);
    for (const e of lt.entries) {
      if (!c.items[e.itemId]) err(`lootTable ${id}: unknown item ${e.itemId}`);
      if (e.min > e.max) err(`lootTable ${id}: min > max for ${e.itemId}`);
      if (e.chance < 0 || e.chance > 1) err(`lootTable ${id}: chance out of range for ${e.itemId}`);
    }
    if (lt.goldMin > lt.goldMax) err(`lootTable ${id}: goldMin > goldMax`);
  }

  for (const [id, a] of Object.entries(c.actors)) {
    uniq('actor', id);
    if (a.id !== id) err(`actor ${id}: id mismatch`);
    if (a.lootTable && !c.lootTables[a.lootTable]) err(`actor ${id}: unknown lootTable`);
    if (a.dialogueId && !c.dialogues[a.dialogueId]) err(`actor ${id}: unknown dialogue`);
    if (a.merchant && !c.lootTables[a.merchant.stockTable]) err(`actor ${id}: unknown stockTable`);
    if (a.level < 1) err(`actor ${id}: level must be >= 1`);
    for (const s of a.schedule ?? []) {
      if (!c.spaces[s.spaceId]) err(`actor ${id}: schedule references unknown space ${s.spaceId}`);
      if (s.fromHour < 0 || s.toHour > 24) err(`actor ${id}: schedule hours out of range`);
    }
  }

  for (const [id, s] of Object.entries(c.spaces)) {
    uniq('space', id);
    if (s.id !== id) err(`space ${id}: id mismatch`);
    if (s.kind === 'interior' && !s.interior) err(`space ${id}: interior needs layout`);
    if (s.kind === 'interior' && s.interior && s.interior.rooms.length === 0)
      err(`space ${id}: interior needs at least one room`);
  }

  const propIds = new Set<string>();
  for (const p of c.props) {
    if (propIds.has(p.id)) err(`duplicate prop id ${p.id}`);
    propIds.add(p.id);
    if (!c.spaces[p.spaceId]) err(`prop ${p.id}: unknown space ${p.spaceId}`);
  }

  for (const d of c.doors) {
    uniq('door', d.id);
    if (!c.spaces[d.spaceId]) err(`door ${d.id}: unknown space`);
    if (!c.spaces[d.targetSpaceId]) err(`door ${d.id}: unknown target space`);
  }

  for (const s of c.spawners) {
    uniq('spawner', s.id);
    if (!c.spaces[s.spaceId]) err(`spawner ${s.id}: unknown space`);
    if (!c.actors[s.actorId]) err(`spawner ${s.id}: unknown actor ${s.actorId}`);
    if (s.count < 1) err(`spawner ${s.id}: count must be >= 1`);
  }

  for (const ct of c.containers) {
    uniq('container', ct.id);
    if (!c.spaces[ct.spaceId]) err(`container ${ct.id}: unknown space`);
    if (!c.lootTables[ct.lootTable]) err(`container ${ct.id}: unknown lootTable`);
  }

  for (const [id, q] of Object.entries(c.quests)) {
    uniq('quest', id);
    if (q.id !== id) err(`quest ${id}: id mismatch`);
    if (q.stages.length === 0) err(`quest ${id}: needs stages`);
    const stageIds = new Set(q.stages.map((s) => s.id));
    for (const st of q.stages) {
      if (st.next !== 'done' && !stageIds.has(st.next))
        err(`quest ${id}: stage ${st.id} next '${st.next}' unknown`);
      const objIds = new Set<string>();
      for (const o of st.objectives) {
        if (objIds.has(o.id)) err(`quest ${id}: duplicate objective ${o.id} in ${st.id}`);
        objIds.add(o.id);
        if (o.count < 1) err(`quest ${id}: objective ${o.id} count must be >= 1`);
        if (o.kind === 'kill' && !c.actors[o.target]) err(`quest ${id}: objective ${o.id} unknown actor ${o.target}`);
        if (o.kind === 'collect' && !c.items[o.target]) err(`quest ${id}: objective ${o.id} unknown item ${o.target}`);
        if (o.kind === 'talkTo' && !c.actors[o.target]) err(`quest ${id}: objective ${o.id} unknown npc ${o.target}`);
        if (o.kind === 'reach') {
          const parts = o.target.split(':');
          if (parts.length !== 4 || !c.spaces[parts[0]]) err(`quest ${id}: objective ${o.id} bad reach target`);
        }
      }
    }
    for (const it of q.reward.items) {
      if (!c.items[it.itemId]) err(`quest ${id}: unknown reward item ${it.itemId}`);
    }
  }

  for (const [id, d] of Object.entries(c.dialogues)) {
    uniq('dialogue', id);
    if (d.id !== id) err(`dialogue ${id}: id mismatch`);
    const nodeIds = new Set(d.nodes.map((n) => n.id));
    for (const e of d.entries) {
      if (!nodeIds.has(e.node)) err(`dialogue ${id}: entry node '${e.node}' unknown`);
    }
    if (d.entries.length === 0) err(`dialogue ${id}: needs at least one entry`);
    for (const n of d.nodes) {
      for (const ch of n.choices) {
        if (ch.next !== 'end' && !nodeIds.has(ch.next))
          err(`dialogue ${id}: node ${n.id} choice next '${ch.next}' unknown`);
        for (const a of ch.actions ?? []) {
          if (a.kind === 'startQuest' && !c.quests[a.questId]) err(`dialogue ${id}: unknown quest ${a.questId}`);
          if (a.kind === 'advanceQuest' && !c.quests[a.questId]) err(`dialogue ${id}: unknown quest ${a.questId}`);
          if ((a.kind === 'giveItem' || a.kind === 'takeItem') && !c.items[a.itemId])
            err(`dialogue ${id}: unknown item ${a.itemId}`);
        }
        for (const cond of ch.conditions ?? []) {
          if ((cond.kind === 'questAtStage' || cond.kind === 'questNotStarted' || cond.kind === 'questCompleted') && !c.quests[cond.questId])
            err(`dialogue ${id}: condition references unknown quest ${cond.questId}`);
          if (cond.kind === 'hasItem' && !c.items[cond.itemId]) err(`dialogue ${id}: condition references unknown item`);
        }
      }
    }
  }

  return errors;
}
