import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { SimWorld } from '../src/game/sim_world';
import { renderLoadoutPanel } from '../src/ui/loadout';

describe('authoritative player loadout', () => {
  it('starts uninitiated, then moves learned spells between unique hotkey slots', () => {
    const sim = new Sim(81);

    expect(sim.knownSpellsBy.get('p1')).toEqual([]);
    expect(sim.spellLoadoutFor('p1')).toEqual({});
    expect(sim.castFor('p1', 'flamebolt')).toBe(false);
    expect(sim.learnSpellFor('p1', 'flamebolt')).toBe(true);
    expect(sim.learnSpellFor('p1', 'mend_wounds')).toBe(true);
    expect(sim.equipSpellFor('p1', 'spell1', 'flamebolt')).toBe(true);
    expect(sim.equipSpellFor('p1', 'spell2', 'mend_wounds')).toBe(true);

    expect(sim.equipSpellFor('p1', 'spell1', 'mend_wounds')).toBe(true);
    expect(sim.spellLoadoutFor('p1')).toEqual({ spell1: 'mend_wounds' });
    expect(sim.castFor('p1', 'flamebolt')).toBe(false);
    expect(sim.equipSpellFor('p1', 'spell2', 'not_a_spell')).toBe(false);
    expect(sim.spellLoadoutFor('p1')).toEqual({ spell1: 'mend_wounds' });
  });

  it('unequips owned item slots without removing the carried item', () => {
    const sim = new Sim(82);
    expect(sim.player().equipment.mainHand).toBe('worn_dagger');

    expect(sim.unequipFor('p1', 'mainHand')).toBe(true);
    expect(sim.player().equipment.mainHand).toBeUndefined();
    expect(sim.player().inventory.some((stack) => stack.itemId === 'worn_dagger')).toBe(true);
  });

  it('keeps duplicate unequipped copies visible in the carried list', () => {
    const sim = new Sim(84);
    sim.player().inventory.push({ itemId: 'worn_dagger', count: 1 });
    const daggers = new SimWorld(sim).playerInventory().filter((item) => item.itemId === 'worn_dagger');
    expect(daggers).toEqual([
      expect.objectContaining({ count: 1, equipped: true }),
      expect.objectContaining({ count: 1, equipped: false }),
    ]);
  });

  it('renders categories, separate equipment slots, item details, and spell equip actions', () => {
    const sim = new Sim(83);
    sim.learnSpellFor('p1', 'flamebolt');
    sim.equipSpellFor('p1', 'spell1', 'flamebolt');
    const world = new SimWorld(sim);
    const html = renderLoadoutPanel(
      world.playerResources().gold,
      world.playerEquipment(),
      world.equippedSpells(),
      world.knownSpells(),
      world.playerInventory(),
    );

    expect(html).toContain('data-act="inventory-category"');
    expect(html).toContain('aria-label="Carried items"');
    expect(html).toContain('detail-stats');
    expect(html).toContain('data-act="unequip-item" data-slot="mainHand"');

    const carried = html.slice(html.indexOf('aria-label="Carried items"'));
    expect(carried).toContain('Bread');
    expect(carried).not.toContain('Worn Dagger');
  });
});
