// World placement data for the vertical slice: spaces, props, doors,
// spawners, containers. Exterior coordinates are meters in the Kaldwyn Reach
// heightfield; interior coordinates are local, floor at y = 0.

import type { ContainerDef, DoorDef, PropDef, SpaceDef, SpawnerDef } from './schema';

export const SPACES: Record<string, SpaceDef> = {
  kaldwyn: { id: 'kaldwyn', name: 'Kaldwyn Reach', kind: 'exterior' },
  duskhollow_mine: {
    id: 'duskhollow_mine',
    name: 'Duskhollow Mine',
    kind: 'interior',
    interior: {
      ceilingY: 4,
      rooms: [
        { x0: -5, z0: 0, x1: 5, z1: 10 }, // entrance hall
        { x0: -1.5, z0: 10, x1: 1.5, z1: 26 }, // first corridor
        { x0: -9, z0: 26, x1: 9, z1: 40 }, // flooded gallery (rats, cache)
        { x0: -1.5, z0: 40, x1: 1.5, z1: 52 }, // deep corridor
        { x0: -11, z0: 52, x1: 11, z1: 70 }, // the pale vault (boss)
      ],
    },
  },
  fenharrow_inn: {
    id: 'fenharrow_inn',
    name: 'The Fenharrow Hearth',
    kind: 'interior',
    interior: {
      ceilingY: 3.5,
      rooms: [
        { x0: -8, z0: 0, x1: 8, z1: 12 }, // common room
        { x0: -8, z0: 12, x1: -2, z1: 18 }, // back room
      ],
    },
  },
};

export const PROPS: PropDef[] = [
  // Fenharrow settlement (exterior shells; inn is enterable via door)
  { id: 'inn_shell', spaceId: 'kaldwyn', kind: 'building_inn', x: 33, z: 152, yaw: 0, sx: 14, sy: 6, sz: 10, solid: true },
  { id: 'smithy_shell', spaceId: 'kaldwyn', kind: 'building_smithy', x: 62, z: 136, yaw: 0.4, sx: 8, sy: 4, sz: 6, solid: true },
  { id: 'house_a', spaceId: 'kaldwyn', kind: 'building_house', x: 22, z: 168, yaw: -0.3, sx: 8, sy: 5, sz: 7, solid: true },
  { id: 'house_b', spaceId: 'kaldwyn', kind: 'building_house', x: 55, z: 170, yaw: 0.2, sx: 7, sy: 5, sz: 7, solid: true },
  { id: 'well', spaceId: 'kaldwyn', kind: 'well', x: 42, z: 158, sx: 2, sy: 1.5, sz: 2, solid: true },
  { id: 'forge', spaceId: 'kaldwyn', kind: 'forge', x: 64, z: 133, sx: 2.5, sy: 1.2, sz: 2, solid: true },

  // Falkmoor Ruin (start area): broken tower ring
  { id: 'ruin_tower', spaceId: 'kaldwyn', kind: 'ruin_tower', x: 40, z: -428, sx: 8, sy: 10, sz: 8, solid: true },
  { id: 'ruin_wall_a', spaceId: 'kaldwyn', kind: 'ruin_wall', x: 28, z: -418, yaw: 0.8, sx: 10, sy: 3, sz: 1.5, solid: true },
  { id: 'ruin_wall_b', spaceId: 'kaldwyn', kind: 'ruin_wall', x: 52, z: -414, yaw: -0.5, sx: 8, sy: 2.5, sz: 1.5, solid: true },
  { id: 'ruin_arch', spaceId: 'kaldwyn', kind: 'ruin_arch', x: 40, z: -404, sx: 6, sy: 5, sz: 2, solid: false },

  // Bandit camp on the road between ruin and Fenharrow
  { id: 'camp_tent_a', spaceId: 'kaldwyn', kind: 'tent', x: 24, z: -296, yaw: 0.3, sx: 4, sy: 2.5, sz: 4, solid: true },
  { id: 'camp_fire', spaceId: 'kaldwyn', kind: 'campfire', x: 30, z: -300, sx: 1.5, sy: 0.5, sz: 1.5, solid: false },

  // Mine entrance framing
  { id: 'mine_arch', spaceId: 'kaldwyn', kind: 'mine_entrance', x: 118, z: 340, sx: 6, sy: 5, sz: 3, solid: false },
  { id: 'mine_cart', spaceId: 'kaldwyn', kind: 'cart', x: 112, z: 332, yaw: 0.5, sx: 3, sy: 1.5, sz: 2, solid: true },

  // Mine interior props
  { id: 'mine_pillar_a', spaceId: 'duskhollow_mine', kind: 'pillar', x: -4, z: 32, sx: 1.5, sy: 4, sz: 1.5, solid: true },
  { id: 'mine_pillar_b', spaceId: 'duskhollow_mine', kind: 'pillar', x: 4, z: 34, sx: 1.5, sy: 4, sz: 1.5, solid: true },
  { id: 'boss_barrow', spaceId: 'duskhollow_mine', kind: 'barrow_slab', x: 0, z: 64, sx: 3, sy: 1, sz: 2, solid: true },

  // Inn interior props
  { id: 'inn_bar', spaceId: 'fenharrow_inn', kind: 'bar_counter', x: 4, z: 2.5, sx: 6, sy: 1.1, sz: 1.2, solid: true },
  { id: 'inn_hearth', spaceId: 'fenharrow_inn', kind: 'hearth', x: -7, z: 6, sx: 1.5, sy: 2.5, sz: 2, solid: true },
  { id: 'inn_table_a', spaceId: 'fenharrow_inn', kind: 'table', x: 0, z: 8, sx: 2, sy: 1, sz: 1.5, solid: true },
  { id: 'inn_table_b', spaceId: 'fenharrow_inn', kind: 'table', x: 5, z: 9, sx: 2, sy: 1, sz: 1.5, solid: true },
];

export const DOORS: DoorDef[] = [
  {
    id: 'door_mine_in',
    spaceId: 'kaldwyn',
    x: 118,
    z: 338,
    name: 'Duskhollow Mine',
    targetSpaceId: 'duskhollow_mine',
    targetX: 0,
    targetZ: 2,
    targetYaw: 0,
  },
  {
    id: 'door_mine_out',
    spaceId: 'duskhollow_mine',
    x: 0,
    z: 0.8,
    name: 'Kaldwyn Reach',
    targetSpaceId: 'kaldwyn',
    targetX: 116,
    targetZ: 334,
    targetYaw: Math.PI,
  },
  {
    id: 'door_inn_in',
    spaceId: 'kaldwyn',
    x: 33,
    z: 146.5,
    name: 'The Fenharrow Hearth',
    targetSpaceId: 'fenharrow_inn',
    targetX: 0,
    targetZ: 1.5,
    targetYaw: 0,
  },
  {
    id: 'door_inn_out',
    spaceId: 'fenharrow_inn',
    x: 0,
    z: 0.4,
    name: 'Fenharrow',
    targetSpaceId: 'kaldwyn',
    targetX: 33,
    targetZ: 144,
    targetYaw: Math.PI,
  },
];

export const SPAWNERS: SpawnerDef[] = [
  // Wilderness encounter: wolves near the road bend
  { id: 'sp_wolves_road', spaceId: 'kaldwyn', x: -6, z: 52, actorId: 'frostfang_wolf', count: 2, radius: 12, respawnGameHours: 48 },
  // Bandit camp on the road
  { id: 'sp_camp_raider', spaceId: 'kaldwyn', x: 28, z: -298, actorId: 'redclaw_raider', count: 1, radius: 6, respawnGameHours: 'never' },
  // Mine gate camp (quest stage: clear the entrance)
  { id: 'sp_gate_raiders', spaceId: 'kaldwyn', x: 108, z: 324, actorId: 'redclaw_raider', count: 2, radius: 8, respawnGameHours: 'never' },
  { id: 'sp_gate_archer', spaceId: 'kaldwyn', x: 114, z: 328, actorId: 'redclaw_archer', count: 1, radius: 6, respawnGameHours: 'never' },
  // Mine interior
  { id: 'sp_mine_rats', spaceId: 'duskhollow_mine', x: 0, z: 33, actorId: 'marsh_rat', count: 3, radius: 6, respawnGameHours: 'never' },
  { id: 'sp_mine_boss', spaceId: 'duskhollow_mine', x: 0, z: 60, actorId: 'barrow_wight', count: 1, radius: 2, respawnGameHours: 'never' },
  // Villagers (spawned via schedule system, one per spawner)
  { id: 'sp_maera', spaceId: 'fenharrow_inn', x: 4, z: 3, actorId: 'maera', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_bronn', spaceId: 'kaldwyn', x: 62, z: 133, actorId: 'bronn', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_ysolde', spaceId: 'kaldwyn', x: 12, z: 182, actorId: 'ysolde', count: 1, radius: 1, respawnGameHours: 'never' },
];

export const CONTAINERS: ContainerDef[] = [
  { id: 'mine_supply_cache', spaceId: 'duskhollow_mine', x: -6, z: 36, name: 'Supply Cache', lootTable: 'mine_cache' },
  { id: 'hadrin_pack', spaceId: 'duskhollow_mine', x: 6, z: 66, name: "Hadrin's Pack", lootTable: 'journal_cache' },
  { id: 'ruin_chest', spaceId: 'kaldwyn', x: 44, z: -424, name: 'Weathered Chest', lootTable: 'mine_cache' },
];

/** Player spawn (new game). */
export const PLAYER_START = { spaceId: 'kaldwyn', x: 40, y: 0, z: -416, yaw: 0 };
