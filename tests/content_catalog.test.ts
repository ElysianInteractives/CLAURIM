// Plan 8 content contract: volume may grow only through proven schemas, and
// every catalog family keeps exemplar-derived sanity and reachability checks.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { STAT_KEYS } from '../src/sim/effects/modifiers';
import { Sim } from '../src/sim/sim';
import { SimWorld } from '../src/game/sim_world';

const PLAN_8_GEAR = [
  'iron_axe',
  'iron_dagger',
  'iron_mace',
  'ironbound_bow',
  'hide_cuirass',
  'hide_cap',
  'hide_boots',
  'hide_shield',
  'fur_cuirass',
  'fur_hood',
  'fur_boots',
  'fur_mantle',
] as const;

describe('content catalog sanity', () => {
  it('keeps every item and spell inside the established numeric envelope', () => {
    for (const [id, item] of Object.entries(CONTENT.items)) {
      expect(item.id, id).toBe(id);
      expect(item.weight, id).toBeGreaterThanOrEqual(0);
      expect(item.value, id).toBeGreaterThanOrEqual(0);
      if (item.kind === 'weapon') {
        expect(item.damage, id).toBeGreaterThanOrEqual(1);
        expect(item.damage, id).toBeLessThanOrEqual(40);
      }
      if (item.kind === 'armor') {
        expect(item.armor, id).toBeGreaterThanOrEqual(0);
        expect(item.armor, id).toBeLessThanOrEqual(80);
      }
    }
    for (const [id, spell] of Object.entries(CONTENT.spells)) {
      expect(spell.id, id).toBe(id);
      expect(spell.magickaCost, id).toBeGreaterThanOrEqual(0);
      if (spell.damage !== undefined) expect(spell.damage, id).toBeGreaterThan(0);
      for (const effectId of spell.applyEffects ?? []) expect(CONTENT.effects[effectId], `${id}:${effectId}`).toBeDefined();
    }
  });

  it('stocks all twelve Plan 8 equipment records through the existing merchant table', () => {
    const stock = CONTENT.lootTables.merchant_stock.entries;
    for (const id of PLAN_8_GEAR) {
      expect(CONTENT.items[id], id).toBeDefined();
      expect(stock.some((entry) => entry.itemId === id && entry.chance === 1), id).toBe(true);
    }
  });

  it('keeps loot, merchants, actor abilities, and modifier sources resolvable', () => {
    for (const [id, table] of Object.entries(CONTENT.lootTables)) {
      expect(table.entries.length, id).toBeGreaterThan(0);
      for (const entry of table.entries) expect(CONTENT.items[entry.itemId], `${id}:${entry.itemId}`).toBeDefined();
    }
    for (const [id, actor] of Object.entries(CONTENT.actors)) {
      expect(actor.id, id).toBe(id);
      expect(actor.level, id).toBeGreaterThanOrEqual(1);
      expect(actor.baseStats.maxHealth ?? 100, id).toBeGreaterThan(0);
      if (actor.lootTable) expect(CONTENT.lootTables[actor.lootTable], id).toBeDefined();
      if (actor.merchant) expect(CONTENT.lootTables[actor.merchant.stockTable]?.entries.length, id).toBeGreaterThan(0);
    }
    for (const [id, perk] of Object.entries(CONTENT.perks)) {
      expect(perk.mods.length, id).toBeGreaterThan(0);
      for (const mod of perk.mods) {
        expect(STAT_KEYS, `${id}:${mod.stat}`).toContain(mod.stat);
        expect(mod.source, id).toBe(`perk:${id}`);
      }
    }
  });

  it('keeps every perk prerequisite chain acyclic, same-skill, and increasingly gated', () => {
    for (const [id, perk] of Object.entries(CONTENT.perks)) {
      const seen = new Set([id]);
      let cursor = perk;
      while (cursor.requiresPerk) {
        const parent = CONTENT.perks[cursor.requiresPerk];
        expect(parent, `${id}:${cursor.requiresPerk}`).toBeDefined();
        expect(parent.skill, id).toBe(perk.skill);
        expect(parent.requiredSkillLevel, id).toBeLessThan(cursor.requiredSkillLevel);
        expect(seen.has(parent.id), `${id} cycle`).toBe(false);
        seen.add(parent.id);
        cursor = parent;
      }
    }
  });

  it('makes every dialogue node reachable from an authored entry', () => {
    for (const [id, dialogue] of Object.entries(CONTENT.dialogues)) {
      const nodes = new Map(dialogue.nodes.map((node) => [node.id, node]));
      const pending = dialogue.entries.map((entry) => entry.node);
      const reached = new Set<string>();
      while (pending.length > 0) {
        const nodeId = pending.pop()!;
        if (reached.has(nodeId)) continue;
        reached.add(nodeId);
        for (const choice of nodes.get(nodeId)?.choices ?? []) {
          if (choice.next !== 'end') pending.push(choice.next);
        }
      }
      expect([...reached].sort(), id).toEqual([...nodes.keys()].sort());
    }
  });
});

describe('Plan 8 proven-schema exemplars', () => {
  it('exposes the authored cave name through the host-neutral world seam', () => {
    const sim = new Sim(42);
    const world = new SimWorld(sim);
    sim.movePlayerTo('p1', 'siltroot_burrow', 0, 2, 0);
    expect(world.currentSpace()).toBe('siltroot_burrow');
    expect(world.spaceName(world.currentSpace())).toBe('Siltroot Burrow');
  });

  it('adds one veteran cone creature and one veteran ground-effect thrall', () => {
    const alpha = CONTENT.actors.frostfang_alpha;
    expect(alpha.tier).toBe('veteran');
    expect(alpha.abilities?.some((ability) => ability.kind === 'frontal_cone')).toBe(true);
    const sentinel = CONTENT.actors.barrow_sentinel;
    expect(sentinel.tier).toBe('veteran');
    expect(sentinel.abilities?.some((ability) => ability.kind === 'ground_aoe')).toBe(true);
  });

  it('applies the expanded archery chain through the existing modifier hook', () => {
    const sim = new Sim(42);
    const player = sim.player();
    player.skills.archery.level = 10;
    player.perkPoints = 3;
    sim.context().addItem(player.id, 'ironbound_bow', 1);
    expect(sim.playerEquip('ironbound_bow')).toBe(true);
    const before = player.stats.rangedDamage;
    expect(sim.playerTakePerk('eagle_eye')).toBe(true);
    expect(sim.playerTakePerk('eagle_eye_2')).toBe(true);
    expect(sim.playerTakePerk('eagle_eye_3')).toBe(true);
    expect(player.stats.rangedDamage).toBeGreaterThan(before);
  });

  it('keeps the road alpha beatable by a prepared solo character', () => {
    const sim = new Sim(42, CONTENT, { skipSpawn: true });
    sim.addPlayer('p1', 'Wanderer');
    const player = sim.player();
    sim.movePlayerTo('p1', 'kaldwyn', 0, 60, 0);
    sim.context().addItem(player.id, 'iron_sword', 1);
    sim.context().addItem(player.id, 'wooden_shield', 1);
    sim.context().addItem(player.id, 'healing_draught', 2);
    expect(sim.playerEquip('iron_sword')).toBe(true);
    expect(sim.playerEquip('wooden_shield')).toBe(true);
    const alphaId = sim.spawnFromTemplate('frostfang_alpha', 'kaldwyn', { x: 0, y: player.pos.y, z: 64 }, 0);
    const alpha = sim.actors.get(alphaId)!;

    for (let tick = 0; tick < 1_800 && !alpha.dead && !player.downed; tick++) {
      if (player.health / player.stats.maxHealth < 0.4) sim.useItemFor('p1', 'healing_draught');
      const dx = alpha.pos.x - player.pos.x;
      const dz = alpha.pos.z - player.pos.z;
      const distance = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const block = !!alpha.attack?.telegraph && alpha.attack.t <= 8 && distance <= 3.6;
      if (!block && distance <= 2) sim.playerMelee();
      player.stamina = Math.max(player.stamina, 40);
      sim.tick({
        moveX: 0,
        moveZ: distance > 2 ? 1 : 0,
        yaw,
        pitch: 0,
        sprint: distance > 8,
        sneak: false,
        block,
        jump: false,
      });
    }

    expect(player.downed).toBe(false);
    expect(alpha.dead).toBe(true);
  });
});
