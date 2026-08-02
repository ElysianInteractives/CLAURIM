# Content coverage matrix (base-game map)

Columns: engine dependency | state | exemplar | remaining volume | Fable work |
Opus-ready | human review | acceptance.
States: DONE(system+exemplar+tests) / SYSTEM(runtime exists, thin content) /
PARTIAL / NONE.

## World
| Family | Dep | State | Exemplar | Remaining | Fable | Opus | Review | Accept |
|---|---|---|---|---|---|---|---|---|
| Exterior regions | terrain D-005, cells D-004 | DONE (1) | Kaldwyn Reach | ~8 more holds | multi-region space graph + region streaming across borders | author features per approved sketch | geography sign-off | nav+terrain tests, tour screenshots |
| Major settlements | props, schedules | PARTIAL | Fenharrow (village) | ~5 cities | city-scale streaming + walled-city layout tooling | building placement from exemplar | yes | schedule/nav tests |
| Minor settlements | same | DONE (2) | Fenharrow, Thornmere Crossing | ~14 | none | yes | light | same |
| Wilderness landmarks | props | DONE (pattern) | Falkmoor Ruin, road camp, Weeping Stones | dozens | none | yes | light | screenshot + spawner tests |
| Caves/mines | interior spaces | DONE (3) | Duskhollow Mine, Siltroot Burrow, Gloamroot Hollow | ~28 | none (rooms+corridors proven three times) | yes | light | nav test per dungeon |
| Nordic-style ruins (interior) | interiors + trap system | NONE | - | ~20 | trap/puzzle primitives | after | yes | e2e dungeon test |
| Dwemer-style ruins | interiors + automatons | NONE | - | ~10 | construct AI archetype | after | yes | same |
| Daedric-style spaces | portal/plane rules | NONE | - | few | space-transition fx + rules | after | yes | same |
| Forts/camps | exterior props + spawners | PARTIAL | mine-gate camp | ~15 | none | yes | light | spawner tests |
| Weather/climate | render + sim hooks | PARTIAL | time-of-day light, night perception | precip, wind, region climate | weather state in sim (affects perception/movement) | region tables | no | determinism holds |
| Water | terrain | PARTIAL | river + water plane | swimming | swim movement mode | - | no | movement tests |

## Systems and RPG
| Family | Dep | State | Exemplar | Remaining | Fable | Opus | Review | Accept |
|---|---|---|---|---|---|---|---|---|
| Skills | progression | DONE (12) | use-based xp all 12 | tune curves | none | curve tuning from playtest data | yes | skill tests |
| Perk trees | perks | SYSTEM | 15 perks across six trees | ~140 perks | only perks needing NEW hooks | template perks | yes | validation tests |
| Spells | spells runtime + D-042 | SYSTEM | 6 across four original disciplines; primer learning, projectile/self/heal/ward/concealment | ~57 | new spell KINDS (AoE, summon, rune, channel) | variants of existing kinds | no | magic/combat tests |
| Shouts/powers | multi-stage powers | NONE | - | ~20 | the power system (cooldown category, staged unlock) | records after | yes | e2e test |
| Weapons | items | SYSTEM | 8 | ~76 | new weapon CLASSES (2H, crossbow timing) | tier fills | no | validation |
| Armor | items | SYSTEM | 12 | ~52 | armor-class perks interplay | tier fills | no | validation |
| Consumables/ingredients | effects | SYSTEM | 4/2 | ~100 | alchemy crafting system | records | no | validation |
| Crafting (smith/alch/ench) | none | NONE | - | 3 systems | all three system designs | recipes after | yes | e2e |
| Loot tables/economy | loot | SYSTEM | 14 tables | full economy | price/scarcity model | tables | no | validation |
| Followers | ai | NONE | - | system + ~10 | follower package (follow/wait/trade/commands) | records | yes | e2e |
| Crime/bounty | factions | NONE | - | system | ownership, witness, bounty state machine | town data | yes | e2e |
| Housing | interiors | NONE | - | later | - | - | - | - |
| Horses/mounted | movement | NONE | - | later | mount movement mode | - | yes | - |
| Dragons | large actors, flight | NONE | - | system + encounters | flight/landing/large-nav architecture (high risk, prototype early) | encounter placement | yes | e2e + perf |

## Narrative
| Family | Dep | State | Exemplar | Remaining | Fable | Opus | Review | Accept |
|---|---|---|---|---|---|---|---|---|
| Side quests | quest runtime D-010/D-044 | DONE (3) | The Hollow Delve, A Bitter Root, The Stone Toll | dozens | only quests needing new objective KINDS | template quests | prose review | e2e per quest |
| Main story | quest + world events | NONE | - | 1 arc | world-event orchestration, staged world state | scenes after | yes | e2e chain |
| Faction lines | factions + quests | NONE | - | ~4 | faction rank/disposition model | quests after | yes | e2e |
| Radiant activities | quest templating | NONE | - | system | radiant generator over template pool | templates | yes | generator tests |
| Dialogue | dialogue runtime | DONE (6) | Fenharrow and Thornmere NPCs, conditional entries/turn-ins | all NPCs | only new condition/action kinds | trees per template | prose review | validation + e2e |
| Books/lore | ui reading | NONE | - | ~100 | reading UI + book item kind | original texts | prose review | validation |
| NPC archetypes | ai/schedules | DONE (10) | Fenharrow/Thornmere residents, raiders, boss | dozens | new BEHAVIOR archetypes only | records | light | brain tests |
| Creatures | ai | SYSTEM | wolf/rat/wight, ambient hart, briarboar, and veteran variants | ~26 | new locomotion modes (fly/swim/burrow) | melee/ranged variants | light | combat tests |

## Presentation and platform
| Family | State | Notes |
|---|---|---|
| UI surfaces | PARTIAL | HUD/dialogue/shop/loadout inventory with primer Study actions, discipline-grouped known spells, spell equip, journal/perks, current-space map/navigation, and audio settings exist; missing: full spellbook, broader settings, main menu |
| Audio | SYSTEM | D-031 browser mixer, persistent controls, combat cues, and procedural interior/day/night beds exist; final assets, spatial sources, and production mix remain KL-5 |
| Asset pipeline | SEAM_READY | bounded high/medium code-native humanoid/quadruped exemplars ship live; lazy Meshopt GLB/glTF replacement validates stable rig nodes and triangle budgets (D-011/D-041/D-046); commissioned source assets remain future content production |
| Accessibility | PARTIAL | semantic resource/audio controls exist; keybind remap, subtitles, colorblind palette, and broader settings remain |
| Save/persistence | DONE | D-009 |
| Mod/extensibility | PARTIAL | data-as-code registry IS the mod surface; external pack loading later |
