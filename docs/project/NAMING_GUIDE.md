# Naming guide

Names should feel like playful, recognizable thematic COUSINS of northern
fantasy - never copies. A knowledgeable player may smile; a newcomer must
find the name natural on its own.

## Derivation methods (pick one, document it)
- Environmental meaning: name the thing the PLACE is (a fen + a harrow field
  -> Fenharrow, a working farm town on wet ground).
- Parallel cultural role with new language (province warden-keep -> a
  different structure with its own founder name).
- Reversed/transformed concept, regional root words (Old Norse/Old English
  fragments recombined: kald 'cold' + wyn 'joy/meadow' -> Kaldwyn).
- Pun or historical wink that still reads straight.
- Shared archetype, original expression (a pale barrow guardian is an
  archetype; 'The Pale Warden' is our expression of it).

## Forbidden shortcuts
Exact canonical names; one-letter swaps; pluralization; syllable shuffles;
near-identical phonetics; unmistakable direct translations; noun-swapped
dialogue; trivially edited catchphrases.

## Stability rules
- Internal ids are permanent. Rename DISPLAY names freely; never rename or
  reuse a released id (save compatibility + content references).
- Record every public-facing rename here with rationale.

## Audit log (2026-07-31, full current-slice audit)
| Id (stable) | Display name | Verdict / rationale |
|---|---|---|
| kaldwyn | Kaldwyn Reach | KEEP. Original roots (kald+wyn); 'Reach' is a generic geographic term. |
| - | Falkmoor Ruin | KEEP. falcon/falk + moor; original compound. |
| fenharrow / fenharrow_inn | Fenharrow / The Fenharrow Hearth | KEEP. Environmental derivation (fen + harrow). |
| duskhollow_mine | Duskhollow Mine | KEEP. Original compound; describes the place. |
| hollow_delve (quest) | The Hollow Delve | KEEP. Puns on the mine's name; original phrase. |
| maera | Maera Fenn | KEEP. Original; surname ties her to the fen the town sits on. |
| bronn | Brandvar Hale | RENAMED from 'Bronn Hale': collided with a famous fantasy sellsword. brand 'fire/sword' + var 'ward' fits a smith. Id unchanged. |
| ysolde | Eydris Varr | RENAMED from 'Ysolde Varr': one letter from a well-known market NPC of the inspiration - exactly the forbidden shortcut. Eydris is an independent Norse-flavored coinage. Id unchanged. |
| redclaw (faction) | Redclaw (raiders/archer/reaver) | KEEP. Generic beast-banner bandit naming, original. |
| barrow_wight | The Pale Warden | KEEP. 'Barrow-wight' as a creature CATEGORY is old public folklore (pre-dating all modern fantasy); the named character is our own. Watch: if a bestiary page ever ships, present the category under 'barrow wight' folklore attribution in prose. |
| barrow_thrall | Barrow Thrall | KEEP. Folklore category + common noun. |
| mire_matron | Mire Matron | KEEP. Original alliterative support-role coinage. |
| frostfang_wolf / marsh_rat | Frostfang Wolf / Marsh Rat | KEEP. Generic descriptive creature names. |
| hadrin | Hadrin (the lost prospector) | KEEP. Original coinage; no canonical collision found. |
| items (iron_sword...) | generic equipment nouns | KEEP. Generic category names are not protectable expression; unique-item names must follow this guide when added. |

Dialogue: all three NPC families rewritten 2026-07-31 to voice sheets +
plural-adventurer framing (see content/quests.ts header + IP_STYLE_GUIDE).
Remaining human-review item: none known in-slice; every FUTURE proper noun
enters through this table.
