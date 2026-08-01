// World placement data for the vertical slice: spaces, props, doors,
// spawners, containers. Exterior coordinates are meters in the Kaldwyn Reach
// heightfield; interior coordinates are local, floor at y = 0.

import type { ContainerDef, DoorAnchorDef, DoorDef, PropDef, SpaceDef, SpawnerDef } from './schema';

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
  siltroot_burrow: {
    id: 'siltroot_burrow',
    name: 'Siltroot Burrow',
    kind: 'interior',
    interior: {
      ceilingY: 3.8,
      rooms: [
        { x0: -5, z0: 0, x1: 5, z1: 10 }, // root-cut entry
        { x0: -1.75, z0: 10, x1: 1.75, z1: 22 }, // descending throat
        { x0: -9, z0: 22, x1: 9, z1: 36 }, // feeding chamber
        { x0: -1.75, z0: 36, x1: 1.75, z1: 44 }, // narrow run
        { x0: -8, z0: 44, x1: 8, z1: 58 }, // brood hollow
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
  gloamroot_hollow: {
    id: 'gloamroot_hollow',
    name: 'Gloamroot Hollow',
    kind: 'interior',
    interior: {
      ceilingY: 4.2,
      rooms: [
        { x0: -5, z0: 0, x1: 5, z1: 10 },
        { x0: -1.75, z0: 10, x1: 1.75, z1: 21 },
        { x0: -9, z0: 21, x1: 9, z1: 35 },
        { x0: -1.75, z0: 35, x1: 1.75, z1: 43 },
        { x0: -8, z0: 43, x1: 8, z1: 57 },
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
  { id: 'house_c', spaceId: 'kaldwyn', kind: 'building_house', x: 75, z: 185, yaw: -0.25, sx: 8, sy: 5, sz: 7, solid: true },
  { id: 'fenharrow_storehouse', spaceId: 'kaldwyn', kind: 'building_storehouse', x: 8, z: 140, yaw: 0.12, sx: 10, sy: 5, sz: 7, solid: true },
  { id: 'fenharrow_watch', spaceId: 'kaldwyn', kind: 'building_watchtower', x: 72, z: 115, yaw: 0.32, sx: 6, sy: 8, sz: 6, solid: true },

  // Thornmere Crossing: an original south-road hamlet and trade stop.
  { id: 'thornmere_lodge', spaceId: 'kaldwyn', kind: 'building_lodge', x: -32, z: -184, yaw: 0.1, sx: 11, sy: 5.5, sz: 8, solid: true },
  { id: 'thornmere_house_a', spaceId: 'kaldwyn', kind: 'building_house', x: 12, z: -190, yaw: -0.2, sx: 8, sy: 5, sz: 7, solid: true },
  { id: 'thornmere_granary', spaceId: 'kaldwyn', kind: 'building_storehouse', x: -28, z: -152, yaw: -0.18, sx: 9, sy: 5, sz: 7, solid: true },
  { id: 'thornmere_house_b', spaceId: 'kaldwyn', kind: 'building_house', x: 15, z: -155, yaw: 0.24, sx: 8, sy: 5, sz: 7, solid: true },
  { id: 'thornmere_stable', spaceId: 'kaldwyn', kind: 'building_stable', x: -8, z: -213, yaw: 0.04, sx: 12, sy: 4.5, sz: 7, solid: true },
  { id: 'thornmere_well', spaceId: 'kaldwyn', kind: 'well', x: -3, z: -168, sx: 2, sy: 1.5, sz: 2, solid: true },

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

  // Riverbank entrance to the repeatable cave exemplar.
  { id: 'siltroot_arch', spaceId: 'kaldwyn', kind: 'mine_entrance', x: -33, z: 75, yaw: Math.PI / 2, sx: 5, sy: 3.5, sz: 2, solid: false },

  // Gloamroot Hollow: a roadside animal den north of Thornmere.
  { id: 'gloamroot_arch', spaceId: 'kaldwyn', kind: 'mine_entrance', x: -10, z: -105, yaw: 0, sx: 5, sy: 3.8, sz: 2, solid: false },

  // Weeping Stones: a non-dungeon wilderness point of interest.
  { id: 'weeping_stone_a', spaceId: 'kaldwyn', kind: 'standing_stone', x: 92, z: 269, yaw: 0.2, sx: 1.8, sy: 7, sz: 1.5, solid: true },
  { id: 'weeping_stone_b', spaceId: 'kaldwyn', kind: 'standing_stone', x: 99, z: 274, yaw: -0.35, sx: 1.5, sy: 5.5, sz: 1.4, solid: true },
  { id: 'weeping_stone_c', spaceId: 'kaldwyn', kind: 'standing_stone', x: 87, z: 277, yaw: 0.55, sx: 1.4, sy: 4.8, sz: 1.3, solid: true },
  { id: 'weeping_basin', spaceId: 'kaldwyn', kind: 'shrine_basin', x: 93, z: 276, sx: 2.2, sy: 0.8, sz: 2.2, solid: true },

  // Mine interior props
  { id: 'mine_pillar_a', spaceId: 'duskhollow_mine', kind: 'pillar', x: -4, z: 32, sx: 1.5, sy: 4, sz: 1.5, solid: true },
  { id: 'mine_pillar_b', spaceId: 'duskhollow_mine', kind: 'pillar', x: 4, z: 34, sx: 1.5, sy: 4, sz: 1.5, solid: true },
  { id: 'boss_barrow', spaceId: 'duskhollow_mine', kind: 'barrow_slab', x: 0, z: 64, sx: 3, sy: 1, sz: 2, solid: true },

  // Gloamroot interior roots and feeding remains.
  { id: 'gloamroot_root_a', spaceId: 'gloamroot_hollow', kind: 'root_column', x: -5, z: 28, sx: 1.2, sy: 4.2, sz: 1.2, solid: true },
  { id: 'gloamroot_root_b', spaceId: 'gloamroot_hollow', kind: 'root_column', x: 5, z: 30, sx: 1.1, sy: 4.2, sz: 1.1, solid: true },
  { id: 'gloamroot_nest', spaceId: 'gloamroot_hollow', kind: 'nest', x: 0, z: 51, sx: 4, sy: 0.5, sz: 3, solid: false },
  { id: 'gloamroot_caps_entry', spaceId: 'gloamroot_hollow', kind: 'glowcaps', x: 2.5, z: 7, sx: 1.5, sy: 0.8, sz: 1.5, solid: false },
  { id: 'gloamroot_caps_den', spaceId: 'gloamroot_hollow', kind: 'glowcaps', x: -7, z: 30, sx: 1.8, sy: 0.9, sz: 1.8, solid: false },
  { id: 'gloamroot_caps_heart', spaceId: 'gloamroot_hollow', kind: 'glowcaps', x: 4, z: 50, sx: 2, sy: 1, sz: 2, solid: false },

  // Inn interior props
  { id: 'inn_bar', spaceId: 'fenharrow_inn', kind: 'bar_counter', x: 4, z: 2.5, sx: 6, sy: 1.1, sz: 1.2, solid: true },
  { id: 'inn_hearth', spaceId: 'fenharrow_inn', kind: 'hearth', x: -7, z: 6, sx: 1.5, sy: 2.5, sz: 2, solid: true },
  { id: 'inn_table_a', spaceId: 'fenharrow_inn', kind: 'table', x: 0, z: 8, sx: 2, sy: 1, sz: 1.5, solid: true },
  { id: 'inn_table_b', spaceId: 'fenharrow_inn', kind: 'table', x: 5, z: 9, sx: 2, sy: 1, sz: 1.5, solid: true },
];

function anchoredDoor(
  anchor: DoorAnchorDef,
  door: Omit<DoorDef, 'anchor' | 'x' | 'z' | 'yaw'>,
): DoorDef {
  const parent = PROPS.find((prop) => prop.id === anchor.propId);
  if (!parent) throw new Error(`door ${door.id}: missing anchor prop ${anchor.propId}`);
  if (parent.spaceId !== door.spaceId) throw new Error(`door ${door.id}: anchor prop must share its space`);
  const yaw = parent.yaw ?? 0;
  return {
    ...door,
    x: parent.x + anchor.localX * Math.cos(yaw) + anchor.localZ * Math.sin(yaw),
    z: parent.z - anchor.localX * Math.sin(yaw) + anchor.localZ * Math.cos(yaw),
    yaw: yaw + anchor.yawOffset,
    anchor,
  };
}

export const DOORS: DoorDef[] = [
  anchoredDoor({ propId: 'mine_arch', localX: 0, localZ: -2, yawOffset: 0 }, {
    id: 'door_mine_in',
    spaceId: 'kaldwyn',
    name: 'Duskhollow Mine',
    targetSpaceId: 'duskhollow_mine',
    targetX: 0,
    targetZ: 2,
    targetYaw: 0,
  }),
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
  anchoredDoor({ propId: 'siltroot_arch', localX: 0, localZ: 3, yawOffset: 0 }, {
    id: 'door_siltroot_in',
    spaceId: 'kaldwyn',
    name: 'Siltroot Burrow',
    targetSpaceId: 'siltroot_burrow',
    targetX: 0,
    targetZ: 2,
    targetYaw: 0,
  }),
  {
    id: 'door_siltroot_out',
    spaceId: 'siltroot_burrow',
    x: 0,
    z: 0.8,
    name: 'Kaldwyn Reach',
    targetSpaceId: 'kaldwyn',
    targetX: -28,
    targetZ: 75,
    targetYaw: Math.PI,
  },
  anchoredDoor({ propId: 'inn_shell', localX: 0, localZ: -5.5, yawOffset: 0 }, {
    id: 'door_inn_in',
    spaceId: 'kaldwyn',
    name: 'The Fenharrow Hearth',
    targetSpaceId: 'fenharrow_inn',
    targetX: 0,
    targetZ: 1.5,
    targetYaw: 0,
  }),
  {
    id: 'door_inn_out',
    spaceId: 'fenharrow_inn',
    x: 0,
    z: 0.8,
    name: 'Fenharrow',
    targetSpaceId: 'kaldwyn',
    targetX: 33,
    targetZ: 144,
    targetYaw: Math.PI,
  },
  anchoredDoor({ propId: 'gloamroot_arch', localX: 0, localZ: -2, yawOffset: 0 }, {
    id: 'door_gloamroot_in',
    spaceId: 'kaldwyn',
    name: 'Gloamroot Hollow',
    targetSpaceId: 'gloamroot_hollow',
    targetX: 0,
    targetZ: 7,
    targetYaw: 0,
  }),
  {
    id: 'door_gloamroot_out',
    spaceId: 'gloamroot_hollow',
    x: 0,
    z: 0.8,
    name: 'Kaldwyn Reach',
    targetSpaceId: 'kaldwyn',
    targetX: -10,
    targetZ: -112,
    targetYaw: Math.PI,
  },
];

export const SPAWNERS: SpawnerDef[] = [
  // Wilderness encounter: wolves near the road bend
  { id: 'sp_wolves_road', spaceId: 'kaldwyn', x: -6, z: 52, actorId: 'frostfang_wolf', count: 2, radius: 12, encounterId: 'road_wolves', respawnGameHours: 48 },
  { id: 'sp_wolves_alpha', spaceId: 'kaldwyn', x: 4, z: 56, actorId: 'frostfang_alpha', count: 1, radius: 3, encounterId: 'road_wolves', respawnGameHours: 48 },
  // Bandit camp on the road
  { id: 'sp_camp_raider', spaceId: 'kaldwyn', x: 28, z: -298, actorId: 'redclaw_raider', count: 1, radius: 6, encounterId: 'road_camp', respawnGameHours: 'never' },
  // Mine gate camp (quest stage: clear the entrance)
  { id: 'sp_gate_raiders', spaceId: 'kaldwyn', x: 108, z: 324, actorId: 'redclaw_raider', count: 2, radius: 8, encounterId: 'mine_gate', respawnGameHours: 'never' },
  { id: 'sp_gate_archer', spaceId: 'kaldwyn', x: 114, z: 328, actorId: 'redclaw_archer', count: 1, radius: 6, encounterId: 'mine_gate', respawnGameHours: 'never' },
  // Mine gate veteran (target-priority + interrupt teaching pull)
  { id: 'sp_gate_reaver', spaceId: 'kaldwyn', x: 111, z: 327, actorId: 'redclaw_reaver', count: 1, radius: 3, encounterId: 'mine_gate', respawnGameHours: 'never' },
  // Mine interior: rat pack guarded by a healing matron (priority target)
  { id: 'sp_mine_rats', spaceId: 'duskhollow_mine', x: 0, z: 33, actorId: 'marsh_rat', count: 5, radius: 6, encounterId: 'flooded_gallery', respawnGameHours: 'never' },
  { id: 'sp_mine_matron', spaceId: 'duskhollow_mine', x: -5, z: 36, actorId: 'mire_matron', count: 1, radius: 2, encounterId: 'flooded_gallery', respawnGameHours: 'never' },
  // Deep corridor thralls (multi-enemy pull before the vault)
  { id: 'sp_mine_thralls', spaceId: 'duskhollow_mine', x: 0, z: 46, actorId: 'barrow_thrall', count: 2, radius: 3, encounterId: 'deep_corridor', respawnGameHours: 'never' },
  { id: 'sp_mine_sentinel', spaceId: 'duskhollow_mine', x: 0, z: 47, actorId: 'barrow_sentinel', count: 1, radius: 1, encounterId: 'deep_corridor', respawnGameHours: 'never' },
  { id: 'sp_mine_boss', spaceId: 'duskhollow_mine', x: 0, z: 60, actorId: 'barrow_wight', count: 1, radius: 2, encounterId: 'pale_vault', respawnGameHours: 'never' },
  // Second cave exemplar: a compact rat den with one proven support veteran.
  { id: 'sp_burrow_rats', spaceId: 'siltroot_burrow', x: 0, z: 29, actorId: 'marsh_rat', count: 3, radius: 5, encounterId: 'siltroot_feeding', respawnGameHours: 36 },
  { id: 'sp_burrow_matron', spaceId: 'siltroot_burrow', x: 0, z: 50, actorId: 'mire_matron', count: 1, radius: 3, encounterId: 'siltroot_brood', respawnGameHours: 36 },
  // Gloamroot Hollow wildlife dungeon.
  { id: 'sp_gloamroot_boars', spaceId: 'gloamroot_hollow', x: 0, z: 28, actorId: 'briarboar', count: 4, radius: 6, encounterId: 'gloamroot_sounder', respawnGameHours: 48 },
  { id: 'sp_gloamroot_matriarch', spaceId: 'gloamroot_hollow', x: 0, z: 50, actorId: 'briarboar_matriarch', count: 1, radius: 2, encounterId: 'gloamroot_heart', respawnGameHours: 48 },
  // Ambient wildlife. Non-aggressive harts wander around authored anchors.
  { id: 'sp_harts_thornmere', spaceId: 'kaldwyn', x: 24, z: -220, actorId: 'ridge_hart', count: 3, radius: 7, respawnGameHours: 24 },
  { id: 'sp_harts_north', spaceId: 'kaldwyn', x: 42, z: 255, actorId: 'ridge_hart', count: 2, radius: 6, respawnGameHours: 24 },
  // Hostile animals around the standing stones.
  { id: 'sp_stones_boars', spaceId: 'kaldwyn', x: 106, z: 276, actorId: 'briarboar', count: 2, radius: 5, encounterId: 'weeping_stones', respawnGameHours: 48 },
  // Villagers (spawned via schedule system, one per spawner)
  { id: 'sp_maera', spaceId: 'fenharrow_inn', x: 4, z: 4, actorId: 'maera', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_bronn', spaceId: 'kaldwyn', x: 67, z: 132, actorId: 'bronn', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_ysolde', spaceId: 'kaldwyn', x: 12, z: 182, actorId: 'ysolde', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_tamsin', spaceId: 'kaldwyn', x: -20, z: -175, actorId: 'tamsin', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_corren', spaceId: 'kaldwyn', x: 6, z: -170, actorId: 'corren', count: 1, radius: 1, respawnGameHours: 'never' },
  { id: 'sp_vael', spaceId: 'kaldwyn', x: -2, z: -202, actorId: 'vael', count: 1, radius: 1, respawnGameHours: 'never' },
];

export const CONTAINERS: ContainerDef[] = [
  { id: 'mine_supply_cache', spaceId: 'duskhollow_mine', x: -6, z: 36, name: 'Supply Cache', lootTable: 'mine_cache' },
  { id: 'hadrin_pack', spaceId: 'duskhollow_mine', x: 6, z: 66, name: "Hadrin's Pack", lootTable: 'journal_cache' },
  { id: 'ruin_chest', spaceId: 'kaldwyn', x: 45, z: -422, name: 'Weathered Chest', lootTable: 'mine_cache' },
  { id: 'siltroot_cache', spaceId: 'siltroot_burrow', x: 6, z: 52, name: 'Rootbound Cache', lootTable: 'burrow_cache' },
  { id: 'gloamroot_cache', spaceId: 'gloamroot_hollow', x: 5.5, z: 52, name: 'Mossbound Satchel', lootTable: 'gloamroot_cache' },
  { id: 'weeping_offering', spaceId: 'kaldwyn', x: 89, z: 273, name: 'Stone Offering', lootTable: 'stone_offering' },
];

/** Player spawn (new game). */
export const PLAYER_START = { spaceId: 'kaldwyn', x: 40, y: 0, z: -416, yaw: 0 };
