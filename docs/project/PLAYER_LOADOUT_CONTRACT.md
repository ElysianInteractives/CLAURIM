# Player loadout contract (D-035)

This contract locks how carried items, equipped gear, known spells, and the
two combat spell hotkeys cross simulation, persistence, network, and UI
boundaries.

D-051 extends this contract with the unified menu presentation and three
consumable quick slots. Its UI layout rules supersede D-035's original
four-region panel; the six gear slots and two spell slots remain unchanged.

## Authority and state

- Gear remains authoritative actor state in the six stable `EquipSlot`
  positions: main hand, off hand, body, head, feet, and amulet.
- Spell loadouts are authoritative per-character state in exactly two stable
  slots, `spell1` and `spell2`, mapped to the `1` and `2` inputs.
- A spell may be equipped only when the character knows it and its content
  record exists. One spell may occupy at most one hotkey; assigning it to a
  new slot moves it from the old slot.
- Casting requires the requested spell to be both known and equipped. Clients
  cannot bypass the loadout by sending an arbitrary known spell ID.
- Unequipping an item changes only its equipment slot. It does not consume,
  sell, or remove the carried item.

## Host and network boundary

- `IWorld` exposes fixed equipment-slot and spell-slot views plus explicit
  equip/unequip intent. UI and renderer code never read or mutate `Sim`
  directly.
- Protocol v5 snapshots carry both slot families. Online clients send only
  validated slot indices and content IDs; `ServerCore` resolves legality in
  the authoritative sim.
- The browser host resolves keys `1` and `2` from `equippedSpells()` at input
  time. No host may hard-code a spell content ID to a combat key.

## Persistence

- World save schema v4 persists spell slots per character. Migration v3->v4
  maps the legacy behavior to Flamebolt/Mend Wounds when those spells are
  known, then fills from the remaining known-spell order.
- Character schema v2 persists the same state, with the equivalent v1->v2
  migration for online character records.
- Loads discard stale, unknown, or duplicate saved spell assignments. They do
  not silently equip spells into intentionally empty current-schema slots.

## UI and interaction

- The inventory surface contains four visually distinct regions: fixed
  equipped-item slots, two spell hotkey slots, the known-spell list, and the
  unequipped carried-item list.
- Empty slots remain visible. Equipped items do not also appear in the
  carried-item list.
- Known spells provide explicit `Equip 1` and `Equip 2` actions, and the HUD
  quickbar always names the current two assignments.
- Equipped item and spell slots can be cleared directly. Re-equipping occurs
  from the corresponding item or known-spell list.

## Acceptance

- Focused sim tests pin default, move, rejection, uniqueness, unequip, and
  carried-item behavior.
- Save tests pin world v3->v4, character v1->v2, and round-trip persistence.
- Server tests pin validated commands and replicated equipment/spell slots.
- Presentation tests pin hotkey lookup and the four-section inventory markup.
- Browser QA exercises equip/unequip in both directions at 1280x720 and
  verifies the 1920x1080 layout envelope, overflow, quickbar update, and logs.
- `npm run gate`, `npm run net:bench`, and the real WebSocket smoke must pass
  for changes to this contract, its protocol fields, or its persistence.

## Deliberately separate locks

Spell learning is governed by D-042. More than two spell hotkeys, drag-and-drop, item comparison,
stack splitting, loadout presets, additional cooldown categories, and a full spellbook
or crafting surface are not part of D-035.
