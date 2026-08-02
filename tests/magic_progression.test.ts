import { describe, expect, it } from 'vitest';
import { Sim, IDLE_INPUT } from '../src/sim/sim';
import { CONTENT } from '../src/sim/content';
import { MAGIC_SCHOOL_IDS } from '../src/sim/content/schema';
import { SPELL_WINDUP_TICKS } from '../src/sim/types';
import { SimWorld } from '../src/game/sim_world';
import { renderLoadoutPanel, renderMagicPanel } from '../src/ui/loadout';

describe('QA Phase J magic initiation and disciplines', () => {
  it('starts new characters without magic and learns a spell by consuming its primer', () => {
    const sim = new Sim(4201);
    const player = sim.player();

    expect(sim.knownSpellsBy.get('p1')).toEqual([]);
    expect(sim.spellLoadoutFor('p1')).toEqual({});
    expect(sim.castFor('p1', 'flamebolt')).toBe(false);

    sim.context().addItem(player.id, 'primer_flamebolt', 2);
    expect(sim.useItemFor('p1', 'primer_flamebolt')).toBe(true);
    expect(sim.knownSpellsBy.get('p1')).toEqual(['flamebolt']);
    expect(sim.spellLoadoutFor('p1')).toEqual({});
    expect(sim.context().countItem(player.id, 'primer_flamebolt')).toBe(1);
    expect(sim.events).toContainEqual({ type: 'spellLearned', charId: 'p1', spellId: 'flamebolt' });

    expect(sim.useItemFor('p1', 'primer_flamebolt')).toBe(false);
    expect(sim.context().countItem(player.id, 'primer_flamebolt')).toBe(1);
    expect(sim.equipSpellFor('p1', 'spell1', 'flamebolt')).toBe(true);
    expect(sim.castFor('p1', 'flamebolt')).toBe(true);
  });

  it('authors all four Claurim disciplines and school-specific progression', () => {
    const schools = new Set(Object.values(CONTENT.spells).map((spell) => spell.school));
    expect([...schools].sort()).toEqual([...MAGIC_SCHOOL_IDS].sort());
    expect(CONTENT.spells.stoneward.skill).toBe('alteration');
    expect(CONTENT.spells.veilstep.skill).toBe('illusion');
    const stock = new Set(CONTENT.lootTables.merchant_stock.entries.map((entry) => entry.itemId));
    for (const item of Object.values(CONTENT.items).filter((candidate) => candidate.kind === 'tome')) {
      expect(stock.has(item.id), item.id).toBe(true);
    }

    const sim = new Sim(4202);
    const player = sim.player();
    sim.learnSpellFor('p1', 'stoneward');
    sim.equipSpellFor('p1', 'spell1', 'stoneward');
    const armorBefore = player.stats.armor;
    expect(sim.castFor('p1', 'stoneward')).toBe(true);
    for (let tick = 0; tick < SPELL_WINDUP_TICKS; tick++) sim.tick(IDLE_INPUT);

    expect(player.effects.some((effect) => effect.effectId === 'stoneward')).toBe(true);
    expect(player.stats.armor).toBeGreaterThan(armorBefore);
    expect(player.stats.resistPhysical).toBeGreaterThan(0);
    expect(player.skills.alteration.xp).toBe(6);
  });

  it('preserves learned magic and supplies newly added skill keys to older saves', () => {
    const sim = new Sim(4203);
    sim.learnSpellFor('p1', 'veilstep');
    sim.equipSpellFor('p1', 'spell2', 'veilstep');
    const raw = sim.serialize();
    const playerSave = raw.actors.find((actor) => actor.kind === 'player')!;
    delete playerSave.skills?.alteration;
    delete playerSave.skills?.illusion;

    const loaded = Sim.load(JSON.stringify(raw));
    expect(loaded.knownSpellsBy.get('p1')).toEqual(['veilstep']);
    expect(loaded.spellLoadoutFor('p1')).toEqual({ spell2: 'veilstep' });
    expect(loaded.player().skills.alteration).toEqual({ level: 1, xp: 0 });
    expect(loaded.player().skills.illusion).toEqual({ level: 1, xp: 0 });
  });

  it('groups the spell list by discipline and presents primers as Study actions', () => {
    const sim = new Sim(4204);
    sim.learnSpellFor('p1', 'veilstep');
    sim.learnSpellFor('p1', 'flamebolt');
    sim.context().addItem(sim.player().id, 'primer_stoneward', 1);
    const world = new SimWorld(sim);
    const inventoryHtml = renderLoadoutPanel(
      world.playerResources().gold,
      world.playerEquipment(),
      world.equippedSpells(),
      world.knownSpells(),
      world.playerInventory(),
    );
    const magicHtml = renderMagicPanel(world.equippedSpells(), world.knownSpells());

    expect(magicHtml).toContain('Ruinweaving');
    expect(magicHtml).toContain('Veilcraft');
    expect(inventoryHtml).toContain("Stonebinder&#039;s Primer: Stoneward");
    expect(renderLoadoutPanel(
      world.playerResources().gold,
      world.playerEquipment(),
      world.equippedSpells(),
      world.knownSpells(),
      world.playerInventory(),
      [],
      'all',
      'primer_stoneward',
    )).toContain('Study');
  });
});
