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
| Minor settlements | same | DONE (1) | Fenharrow | ~15 | none | yes | light | same |
| Wilderness landmarks | props | DONE (pattern) | Falkmoor Ruin, road camp | dozens | none | yes | light | screenshot + spawner tests |
| Caves/mines | interior spaces | DONE (2) | Duskhollow Mine, Siltroot Burrow | ~29 | none (rooms+corridors proven twice) | yes | light | nav test per dungeon |
| Nordic-style ruins (interior) | interiors + trap system | NONE | - | ~20 | trap/puzzle primitives | after | yes | e2e dungeon test |
| Dwemer-style ruins | interiors + automatons | NONE | - | ~10 | construct AI archetype | after | yes | same |
| Daedric-style spaces | portal/plane rules | NONE | - | few | space-transition fx + rules | after | yes | same |
| Forts/camps | exterior props + spawners | PARTIAL | mine-gate camp | ~15 | none | yes | light | spawner tests |
| Weather/climate | render + sim hooks | PARTIAL | time-of-day light, night perception | precip, wind, region climate | weather state in sim (affects perception/movement) | region tables | no | determinism holds |
| Water | terrain | PARTIAL | river + water plane | swimming | swim movement mode | - | no | movement tests |

## Systems and RPG
| Family | Dep | State | Exemplar | Remaining | Fable | Opus | Review | Accept |
|---|---|---|---|---|---|---|---|---|
| Skills | progression | DONE (10) | use-based xp all 10 | tune curves | none | curve tuning from playtest data | yes | skill tests |
| Perk trees | perks | SYSTEM | 15 perks across six trees | ~140 perks | only perks needing NEW hooks | template perks | yes | validation tests |
| Spells | spells runtime | SYSTEM | 3 (projectile/self/heal) | ~60 | new spell KINDS (AoE, summon, ward, rune) | variants of existing kinds | no | combat tests |
| Shouts/powers | multi-stage powers | NONE | - | ~20 | the power system (cooldown category, staged unlock) | records after | yes | e2e test |
| Weapons | items | SYSTEM | 8 | ~76 | new weapon CLASSES (2H, crossbow timing) | tier fills | no | validation |
| Armor | items | SYSTEM | 12 | ~52 | armor-class perks interplay | tier fills | no | validation |
| Consumables/ingredients | effects | SYSTEM | 4/2 | ~100 | alchemy crafting system | records | no | validation |
| Crafting (smith/alch/ench) | none | NONE | - | 3 systems | all three system designs | recipes after | yes | e2e |
| Loot tables/economy | loot | SYSTEM | 10 tables | full economy | price/scarcity model | tables | no | validation |
| Followers | ai | NONE | - | system + ~10 | follower package (follow/wait/trade/commands) | records | yes | e2e |
| Crime/bounty | factions | NONE | - | system | ownership, witness, bounty state machine | town data | yes | e2e |
| Housing | interiors | NONE | - | later | - | - | - | - |
| Horses/mounted | movement | NONE | - | later | mount movement mode | - | yes | - |
| Dragons | large actors, flight | NONE | - | system + encounters | flight/landing/large-nav architecture (high risk, prototype early) | encounter placement | yes | e2e + perf |

## Narrative
| Family | Dep | State | Exemplar | Remaining | Fable | Opus | Review | Accept |
|---|---|---|---|---|---|---|---|---|
| Side quests | quest runtime D-010 | DONE (1) | The Hollow Delve | dozens | only quests needing new objective KINDS | template quests | prose review | e2e per quest |
| Main story | quest + world events | NONE | - | 1 arc | world-event orchestration, staged world state | scenes after | yes | e2e chain |
| Faction lines | factions + quests | NONE | - | ~4 | faction rank/disposition model | quests after | yes | e2e |
| Radiant activities | quest templating | NONE | - | system | radiant generator over template pool | templates | yes | generator tests |
| Dialogue | dialogue runtime | DONE | 3 NPCs, conditional entries | all NPCs | only new condition/action kinds | trees per template | prose review | validation + e2e |
| Books/lore | ui reading | NONE | - | ~100 | reading UI + book item kind | original texts | prose review | validation |
| NPC archetypes | ai/schedules | DONE (7) | villagers, raiders, boss | dozens | new BEHAVIOR archetypes only | records | light | brain tests |
| Creatures | ai | SYSTEM | wolf/rat/wight plus Rimehowl/Sentinel veterans | ~28 | new locomotion modes (fly/swim/burrow) | melee/ranged variants | light | combat tests |

## Presentation and platform
| Family | State | Notes |
|---|---|---|
| UI surfaces | PARTIAL | HUD/dialogue/shop/inventory/journal/perks exist; missing: map, magic menu, settings, main menu |
| Audio | NONE | system decision pending (Fable) |
| Asset pipeline | NONE->PLANNED | palette/primitive style locked (D-011); GLB pipeline is the upgrade path |
| Accessibility | NONE | keybind remap, subtitles, colorblind palette: after UI settles |
| Save/persistence | DONE | D-009 |
| Mod/extensibility | PARTIAL | data-as-code registry IS the mod surface; external pack loading later |
