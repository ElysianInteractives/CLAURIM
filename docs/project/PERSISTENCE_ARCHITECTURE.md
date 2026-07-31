# Persistence architecture (D-016)

## Principles
- The SERVER owns online persistence. Browser localStorage is only the
  OFFLINE mode's save slot and is never the source of truth for an online
  character.
- All access goes through `StorageProvider` (`src/server/storage.ts`):
  loadCharacter / saveCharacter / loadWorld / saveWorld. FileStorage
  (atomic tmp+rename writes) serves the milestone; a database provider
  implements the same four methods later.

## What persists where
- Character records (`CharacterSave`, schema v1, `src/sim/save/save.ts`):
  identity, position/space, resources, inventory/equipment/gold, effects,
  skills/perks/level/xp, known spells, quest journal, container-loot set.
  Written on: join-create, disconnect, every 30 s (PERSIST_EVERY), shutdown.
- World save (`SaveGame`, schema v2): world deltas (dead never-respawn
  actors, spawner bookkeeping, parties, resident characters). Written every
  30 s + shutdown. On server start the world save loads and resident
  characters are removed (they rejoin from their own records).

## Migration + corruption
Both schemas carry versions and linear migration registries with tests
(world v0->v1->v2 chain pinned). Corrupt payloads REJECT: a bad character
record falls back to a fresh character (logged); a bad world save starts a
fresh world and leaves the bad file for the operator. Nothing half-loads.

## Reconnection restoration
Tested end-to-end (tests/server_net.test.ts): gold/skills survive
disconnect->reconnect; world deltas survive full server restart via storage.

## Future (declared, not built)
Accounts (auth tokens -> characters), per-character schema migrations as the
record grows, database provider, world-delta compaction, dungeon-instance
records when instancing lands.
