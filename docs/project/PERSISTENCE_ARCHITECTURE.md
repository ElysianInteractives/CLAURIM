# Persistence architecture (D-016)

## Principles
- The SERVER owns online persistence. Browser localStorage is only the
  OFFLINE mode's save slot and is never the source of truth for an online
  character.
- All access goes through `StorageProvider` (`src/server/storage.ts`):
  loadAuth / saveAuth / loadCharacter / saveCharacter / loadWorld / saveWorld.
  FileStorage (atomic tmp+rename writes) serves the milestone; a database
  provider implements the same six methods later.

## What persists where
- Account records (`auth.json`, schema v1): normalized username, account and
  owned-character IDs/names, and a salted scrypt derivation. Plain passwords
  and raw/hashed sessions do not persist. The file requests mode `0600` where
  supported; sessions are memory-only and a restart signs everyone out.
- Character records (`CharacterSave`, schema v2, `src/sim/save/save.ts`):
  identity, position/space, resources, inventory/equipment/gold, effects,
  skills/perks/level/xp, known spells and equipped spell hotkeys, quest
  journal, container-loot set.
  Written on: join-create, disconnect, every 30 s (PERSIST_EVERY), shutdown.
- World save (`SaveGame`, schema v4): world deltas (dead never-respawn
  actors, spawner bookkeeping, explicit parties, known character names,
  resident characters), including per-character spell hotkeys. Written every
  30 s + shutdown. On server start the
  world save loads and resident characters are removed (they rejoin from
  their own records) while durable party membership remains.

## Migration + corruption
Both schemas carry versions and linear migration registries with tests
(world v0->v1->v2->v3->v4 and character v1->v2 chains pinned). Corrupt payloads REJECT: a bad character
record falls back to a fresh character (logged); a bad world save starts a
fresh world and leaves the bad file for the operator. Nothing half-loads.
An invalid account store fails server startup rather than silently replacing
identity or ownership data.

## Reconnection restoration
Tested end-to-end (tests/server_net.test.ts): gold/skills survive
disconnect->reconnect; world deltas survive full server restart via storage.

## Future (declared, not built)
Account recovery/MFA and an external identity or breached-password service;
per-character schema migrations as the record grows; database provider;
world-delta compaction; dungeon-instance records when instancing lands.
