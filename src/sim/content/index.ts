// The merged content registry. CONTENT_VERSION participates in save
// compatibility (see sim/save/save.ts): bump it when a released record changes
// meaning, and add a migration when saves are affected.

import type { ContentRegistry } from './schema';
import { ITEMS } from './items';
import { EFFECTS, PERKS, SPELLS } from './magic';
import { ACTORS, LOOT_TABLES } from './actors';
import { CONTAINERS, DOORS, PROPS, SPACES, SPAWNERS } from './world';
import { DIALOGUES, QUESTS } from './quests';

export const CONTENT_VERSION = '0.1.0';

export const CONTENT: ContentRegistry = {
  version: CONTENT_VERSION,
  items: ITEMS,
  effects: EFFECTS,
  spells: SPELLS,
  perks: PERKS,
  lootTables: LOOT_TABLES,
  actors: ACTORS,
  spaces: SPACES,
  props: PROPS,
  doors: DOORS,
  spawners: SPAWNERS,
  containers: CONTAINERS,
  quests: QUESTS,
  dialogues: DIALOGUES,
};

export { PLAYER_START } from './world';
