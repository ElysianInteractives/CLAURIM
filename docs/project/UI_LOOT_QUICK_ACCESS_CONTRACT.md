# Unified UI, selective loot, and quick-access contract (D-051)

This contract extends D-019 and D-035 with one cohesive, original Claurim
menu language, player-selected loot transfer, and three persistent battle
consumable slots. It adopts general category/list/detail usability patterns;
it does not copy another game's art, assets, wording, icons, sounds, or exact
layout.

## Menu and input model

- Inventory, Magic, Journal, Map, Character, Social, and System share a
  full-screen shell, top-level navigation, footer controls, typography, focus
  treatment, and responsive layout.
- Inventory separates six fixed equipment slots from the carried-item list.
  Categories filter the list; selection exposes count, weight, value, effect
  or equipment detail, and an explicit contextual action.
- Magic keeps D-035's two unique spell slots and known-spell legality while
  presenting them as an explicit equipable list.
- Menus release pointer lock and suppress world movement/combat input. The
  authoritative simulation does not pause, preserving identical offline and
  multiplayer risk.
- Mouse and keyboard actions use semantic buttons and visible selection.
  `Esc` closes; loot uses `E` for the selected stack and `R` for all contents.

## Selective loot authority

- Interacting with a chest or dead standard actor opens a server-authoritative
  loot session and transfers nothing by itself.
- `lootTake` transfers one complete selected stack; `lootTakeAll` transfers
  every remaining stack and gold. Gold is a visible selectable contents row.
- A session is valid only while its player is up, in the source space, and
  within 3.25 metres. Invalid sessions close without transferring contents.
- Standard corpse contents remain shared. Each take is resolved atomically by
  the simulation, so two clients cannot duplicate a stack.
- Container rolls remain deterministic and personal per character. The roll
  is materialized on first open; remaining items and gold persist until taken.
  A container enters the completed-loot set only when its contents are empty.
- Elite/boss personal reward delivery remains governed by D-019 and is not
  exposed as shared corpse state by this interface.

## Consumable quick access

- Three per-character slots (`consumable1..3`) map to keys `3`, `4`, and `5`.
  A consumable may occupy only one slot; reassigning it moves the reference.
- Assignment requires a valid consumable content record and at least one
  carried copy. Assignment never reserves or duplicates inventory.
- Use consumes exactly one authoritative carried item and shares a 22-tick
  cooldown across menu and hotkey paths. Downed characters cannot use items.
- An assignment remains when its count reaches zero. The HUD shows zero and a
  later pickup automatically makes the slot usable again.

## Persistence and network

- World save schema v5 adds per-character partial container contents and
  consumable slots. Migration v4->v5 preserves completed containers and starts
  both new structures empty.
- Character schema v3 adds the equivalent fields; v2->v3 starts them empty.
  Loads sanitize stale, non-consumable, and duplicate assignments.
- Protocol v8 replicates loot views and consumable slots, and validates
  `lootTake`, `lootTakeAll`, `lootClose`, `equipConsumable`, and
  `unequipConsumable` commands. Clients submit intent only.

## Acceptance

- Simulation tests cover no-transfer-on-open, partial save/reload, completion,
  out-of-range closure, shared-corpse contention, quick-slot uniqueness,
  cooldown, zero-count retention, and round-trip persistence.
- Protocol tests reject invalid slot indices and malformed loot commands.
- Presentation tests cover category/list/detail inventory, source contents,
  escaped source names, shared navigation, and keys `1` through `5`.
- The full gate, network benchmark, real WebSocket smoke, and browser checks at
  1280x720 and 1920x1080 must pass before release.

## Deliberately separate work

Controller bindings, drag-and-drop, stack splitting, carry-capacity
enforcement, item comparison, crafting, loadout presets, and icon/model
previews require their own lock. D-051 does not change item balance or spell
slot count.
