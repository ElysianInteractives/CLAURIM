import { describe, expect, it } from 'vitest';
import { Sim, CONSUMABLE_COOLDOWN_TICKS, IDLE_INPUT } from '../src/sim/sim';
import { SimWorld } from '../src/game/sim_world';
import { parseClientMessage, PROTOCOL_VERSION } from '../src/net/protocol';
import { renderLoadoutPanel, renderLootPanel, renderQuickbar } from '../src/ui/loadout';
import { renderMenuShell } from '../src/ui/menu_shell';

function moveToRuinChest(sim: Sim, charId = 'p1'): void {
  const player = sim.playerActor(charId)!;
  player.pos.spaceId = 'kaldwyn';
  player.pos.x = 44;
  player.pos.z = -424;
}

describe('selective authoritative loot', () => {
  it('opens without transferring and persists partially looted personal contents', () => {
    const sim = new Sim(5101);
    moveToRuinChest(sim);
    const beforeInventory = JSON.stringify(sim.player().inventory);
    const beforeGold = sim.player().gold;

    expect(sim.interactFor('p1')).toBe('container');
    expect(JSON.stringify(sim.player().inventory)).toBe(beforeInventory);
    expect(sim.player().gold).toBe(beforeGold);

    // Replace the deterministic roll with a known multi-entry state so this
    // test proves a true partial transfer independently of loot-table tuning.
    sim.containerLootOf('p1').set('ruin_chest', {
      items: [{ itemId: 'bread', count: 2 }, { itemId: 'healing_draught', count: 1 }],
      gold: 9,
    });
    expect(sim.lootTakeFor('p1', 'bread')).toBe(true);
    expect(sim.containersLootedOf('p1').has('ruin_chest')).toBe(false);

    const loaded = Sim.load(sim.saveToJson());
    moveToRuinChest(loaded);
    expect(loaded.interactFor('p1')).toBe('container');
    expect(loaded.lootSessionFor('p1')?.contents).toEqual({
      items: [{ itemId: 'healing_draught', count: 1 }],
      gold: 9,
    });
    expect(loaded.lootTakeAllFor('p1')).toBe(true);
    expect(loaded.containersLootedOf('p1').has('ruin_chest')).toBe(true);
    expect(loaded.nearestInteractableFor('p1')?.id).not.toBe('ruin_chest');
  });

  it('takes shared corpse stacks atomically instead of duplicating them', () => {
    const sim = new Sim(5102, undefined, { noDefaultPlayer: true });
    sim.addPlayer('p1', 'Alva');
    sim.addPlayer('p2', 'Brona');
    const corpse = [...sim.actors.values()].find((actor) => actor.kind !== 'player')!;
    corpse.dead = true;
    corpse.inventory = [{ itemId: 'bread', count: 3 }];
    corpse.gold = 5;
    for (const charId of ['p1', 'p2']) {
      const player = sim.playerActor(charId)!;
      player.pos = { ...corpse.pos };
    }
    expect(sim.interactFor('p1')).toBe('loot');
    expect(sim.interactFor('p2')).toBe('loot');
    expect(sim.lootTakeFor('p1', 'bread')).toBe(true);
    expect(sim.lootTakeFor('p2', 'bread')).toBe(false);
    expect(corpse.inventory).toEqual([]);
  });

  it('closes an open source when the player moves out of range', () => {
    const sim = new Sim(5103);
    moveToRuinChest(sim);
    expect(sim.interactFor('p1')).toBe('container');
    sim.player().pos.x += 10;
    expect(sim.lootSessionFor('p1')).toBeNull();
  });
});

describe('consumable battle loadout', () => {
  it('moves unique assignments, enforces cooldown, and retains zero-count assignments', () => {
    const sim = new Sim(5201);
    expect(sim.equipConsumableFor('p1', 'consumable1', 'bread')).toBe(true);
    expect(sim.equipConsumableFor('p1', 'consumable2', 'bread')).toBe(true);
    expect(sim.consumableLoadoutFor('p1')).toEqual({ consumable2: 'bread' });

    expect(sim.useItemFor('p1', 'bread')).toBe(true);
    expect(sim.useItemFor('p1', 'bread')).toBe(false);
    for (let tick = 0; tick < CONSUMABLE_COOLDOWN_TICKS; tick++) sim.tick(IDLE_INPUT);
    expect(sim.useItemFor('p1', 'bread')).toBe(true);
    expect(new SimWorld(sim).equippedConsumables().find((slot) => slot.slot === 'consumable2')).toEqual(
      expect.objectContaining({ itemId: 'bread', count: 0, hotkey: '4' }),
    );

    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.consumableLoadoutFor('p1')).toEqual({ consumable2: 'bread' });
  });

  it('replicates only validated quick-slot and loot commands in protocol v8', () => {
    expect(PROTOCOL_VERSION).toBe(8);
    expect(parseClientMessage(JSON.stringify({ t: 'cmd', kind: 'equipConsumable', arg: 'bread', index: 2 }))).toEqual(
      { t: 'cmd', kind: 'equipConsumable', arg: 'bread', index: 2, targetId: undefined },
    );
    expect(parseClientMessage(JSON.stringify({ t: 'cmd', kind: 'equipConsumable', arg: 'bread', index: 3 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'cmd', kind: 'lootTake', arg: '__gold' }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'cmd', kind: 'lootTakeAll', arg: 'unexpected' }))).toBeNull();
  });
});

describe('cohesive menu presentation', () => {
  it('renders category/list/detail inventory, selective loot, and a five-slot quickbar', () => {
    const sim = new Sim(5301);
    sim.equipConsumableFor('p1', 'consumable1', 'bread');
    const world = new SimWorld(sim);
    const inventory = renderLoadoutPanel(
      world.playerResources().gold,
      world.playerEquipment(),
      world.equippedSpells(),
      world.knownSpells(),
      world.playerInventory(),
      world.equippedConsumables(),
      'consumable',
      'bread',
    );
    expect(inventory).toContain('data-category="consumable" aria-pressed="true"');
    expect(inventory).toContain('data-act="equip-consumable"');
    expect(inventory).toContain('Assign 3');

    const shell = renderMenuShell('inventory', 'Inventory', inventory, '25 gold');
    expect(shell).toContain('aria-label="Main menu"');
    expect(shell).toContain('data-panel="magic"');
    expect(shell).toContain('The world remains active');

    const loot = renderLootPanel({ sourceKind: 'corpse', sourceName: '<Bandit>', items: [
      { itemId: 'bread', name: 'Bread', count: 2, kind: 'consumable', value: 3, weight: 0.3, detail: 'Food' },
    ] });
    expect(loot).toContain('&lt;Bandit&gt;');
    expect(loot).toContain('data-act="loot-take"');
    expect(loot).toContain('<kbd>R</kbd> take all');

    const bar = renderQuickbar(world.equippedSpells(), world.equippedConsumables());
    for (const key of ['1', '2', '3', '4', '5']) expect(bar).toContain(`quickbar-key">${key}`);
  });
});
