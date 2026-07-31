# Sim responsibility map

`src/sim/sim.ts` is the deterministic coordinator and state owner. At the
Plan 0 baseline it is 1,255 lines with 71 methods. Size alone is not a defect,
but its breadth makes it the highest-coupling file in the simulation and a
likely convergence point for otherwise unrelated changes.

This document is analysis only. It does not authorize moving state, changing
the tick order, or reopening D-001/D-002/D-013.

## Current responsibility groups

| Group | Current responsibilities | Important collaborators |
|---|---|---|
| Context binding | Builds the live `SimContext` views and callbacks used by system functions | `sim_context.ts`, all system modules |
| World population | Initial content spawn, deterministic spawner execution, summoned actors | content registry, actors, RNG |
| Character lifecycle | Add, restore, remove, and extract persistent characters | actors, character saves |
| Multiplayer ownership | Character/entity lookup, per-character maps, parties, primary-character compatibility | quests, dialogue, inventory |
| Tick orchestration | Fixed phase order, player inputs, active actors, effects, AI, attacks, regen, projectiles, objectives, respawns | every runtime system |
| Player locomotion | Movement intent, collision, stance, stamina, jump/gravity transient state | collision, terrain/spaces |
| Encounter lifecycle | Ground AoEs, downed/revive/release, deduplicated wipe detection, atomic ownership-key reset, respawn | `ai/encounters.ts`, combat, AI, modifiers |
| Command facade | Melee, ranged, cast, items, equipment, perks, quests, chat | combat, inventory, progression, quests |
| Interaction routing | Nearest door/container/NPC/corpse/player, transitions, loot, dialogue, revive | world content, dialogue, inventory |
| Session ownership | Per-character dialogue/shop state and commands | dialogue and merchant functions |
| Offline compatibility | Primary-character wrappers for the original single-player host/tests | same per-character paths |
| Persistence | World serialization, save JSON, schema load/reconstruction | `save/save.ts`, content, actor construction |

## Coupling observations

1. The coordinator imports nearly every simulation subsystem. A reverse import
   into `sim.ts` would easily create a cycle; Plan 0 adds an acyclic-graph
   guard.
2. Per-character state is distributed across several parallel maps. Any new
   character-scoped feature must prove isolation, extraction, and load/save
   symmetry.
3. The tick order is load-bearing. Extracting a function must not reorder RNG
   draws, actor iteration, event delivery, or persistence-visible state.
4. Offline compatibility wrappers increase the method count but correctly
   delegate to the multiplayer paths; removing them is not automatically an
   improvement.
5. Interaction routing combines discovery and resolution for five target
   families. It is a natural pressure point when new interaction kinds arrive.
6. Persistence reconstruction knows actor, player, quest, spell, container,
   and party shapes. Schema work therefore has a large blast radius.

## Candidate seams if a later locked deficit requires change

These are candidates, not a refactor backlog:

- Character registry/session state behind live views owned by `Sim`.
- Interaction discovery and resolution as functions over `SimContext`.
- Encounter lifecycle functions for downed/wipe/reset/respawn.
- Serialization codecs that preserve `Sim` ownership and existing schema
  migration behavior.
- Host compatibility facade separated from authoritative per-character
  commands.

Any extraction must satisfy all of the following:

1. State remains instance-owned; no singleton or hidden module state.
2. `SimContext` evolves deliberately and remains the system seam.
3. Tick phase and RNG draw order remain byte-for-byte deterministic.
4. Save shape changes require version, migration, and tests.
5. Multiplayer per-character isolation tests remain green.
6. The circular-dependency guard remains green.

## Revisit triggers

Reopen a seam only when at least one is true:

- A reproduced defect cannot be fixed locally without violating an invariant.
- Three independent changes require the same new coordination surface.
- A module cannot be tested without constructing unrelated systems.
- Save, networking, or character ownership symmetry is demonstrably at risk.

Do not split the coordinator solely to meet a line-count target.
