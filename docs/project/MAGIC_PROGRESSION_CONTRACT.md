# Magic progression contract (D-042)

QA Phase J locks how a character enters magic, learns authored spells, sees
their disciplines, equips them, and preserves that progression.

## Initiation and authority

- A newly created character knows no spells and has two empty spell slots.
  Existing world and character saves retain every valid known/equipped spell.
- A `tome` item names exactly one valid `teachesSpell`. Studying an owned tome
  removes one copy and permanently adds that spell to the character's known
  list. A character cannot consume a duplicate primer for a spell already
  known.
- Learning never auto-equips. The player explicitly assigns a known spell to
  hotkey 1 or 2 under D-035; casting still requires known and equipped state.
- The server handles the existing `useItem` intent and owns item removal,
  knowledge mutation, private learning feedback, persistence, and casting.

## Claurim disciplines

- `Ruinweaving` shapes destructive flame, rime, and storm projectiles and
  trains the destruction skill.
- `Mending` restores life and trains restoration.
- `Stonebinding` applies temporary armor/physical resistance and trains the
  alteration skill.
- `Veilcraft` temporarily improves concealment and trains the illusion skill.
- These names and groupings are Claurim's own fiction. They are not a promise
  to reproduce another game's school roster, spell progression, or content.

## Content and compatibility

- Every spell has a validated `school`; every tome's taught spell resolves.
  Content v0.3 contains six spells, six matching primers, and four schools.
- Maera's existing merchant stock provides the current acquisition path. This
  is a slice-scale access point, not the final trainer, discovery, or economy
  design.
- Alteration and illusion are appended skill keys. Older actor records are
  normalized with level 1 / zero XP defaults while all recorded skills remain
  intact. No world- or character-save schema bump is required because known
  spells and loadout slots were already durable.
- Protocol v7 adds school labels to private known-spell views and scopes the
  `spellLearned` event to its owning character.

## Acceptance

- `tests/magic_progression.test.ts` pins empty fresh state, safe primer
  consumption, duplicate rejection, school coverage, school-specific skill
  training/effects, save compatibility, and grouped UI presentation.
- Existing loadout, save, combat, reticle, server, catalog, and protocol tests
  explicitly learn/equip magic where their scenario requires it.
- Run `npm run gate`, all network/combat/AI/world benchmarks, and real
  WebSocket smoke. Browser QA uses development-only `?qa=magic`, studies all
  primers, assigns Stoneward/Veilstep, casts from the quickbar, checks both
  supported desktop viewports, and requires clean warning/error logs.

## Deliberately separate locks

Area spells, runes, summons, channeling, cooldown categories, more hotkeys,
trainers, research/crafting, quest-gated initiation, discovery placement,
school perk trees, enemy spell loadouts, and final balance remain separate
work. New spell kinds require their own simulation and network acceptance.
