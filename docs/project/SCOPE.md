# Scope

## Milestone MP-1 (CURRENT, 2026-07-31): multiplayer vertical slice - IMPLEMENTED
Dedicated authoritative server (`npm run server`), two-plus authenticated
browser clients (`?ws=...`), persistent distinct characters with server-owned
storage, third-person remote-player rendering, movement replication with
prediction/reconciliation, chat presence, deterministic default party,
shared exterior + interiors, cooperative combat with threat/telegraphs/
interrupts/scaling, party quest credit on The Hollow Delve, personal boss
loot, downed/revive/release + wipe reset, disconnect/reconnect restoration,
Duskhollow as the group-dungeon exemplar, measured difficulty (mp:bench),
automated multi-client integration tests, and Plan 6 baseline account/session
authentication with character ownership. Live-service recovery/MFA,
monitoring, backups, and deployment operations remain open under KL-11.

## Milestone 1 (CURRENT): Kaldwyn Reach vertical slice - IMPLEMENTED
World: streamed exterior (mountain rim, river, road, forest/tundra biomes,
weather-lit day/night), Fenharrow village, Falkmoor Ruin start, road wolf
encounter, bandit camp, Duskhollow Mine interior, inn interior, transitions,
collision, deterministic spawning with persistent cleared state.
Player: move/sprint/jump/sneak/block, third-person + first-person camera,
health/stamina/magicka, melee/bow/spells (flamebolt, mend wounds), damage/
death/respawn, inventory/equipment/looting, use-based skills, perk choices,
save+reload.
NPCs: Maera (merchant, quest-giver), Bronn, Ysolde with schedules and
conditional dialogue; raiders (melee+archer), wolves, rats, the Pale Warden
boss; perception/aggro/search/flee; dungeon navigation; loot; persistent death.
Quest: The Hollow Delve (4 stages, optional objective, journal, rewards,
save/load continuity at each stage).
Verification: architecture guards, determinism/replay, save round-trip +
migration, nav tests, quest e2e, content gate, headless host, `npm run gate`.

Milestone-1 exit criteria still open: first visual QA pass on a real browser
(KL-7), one balance pass with headless measurement.

## Milestone 2: Systems depth (Fable-led design, Opus fill)
Crafting (smithing/alchemy/enchanting), weather in-sim, followers, crime/
bounty, radiant quest templating, map UI + main menu, audio architecture,
interpolation + polish, second dungeon + second settlement (repeatability
proof), GLB asset pipeline.

## Milestone 3: Province scale
Multi-region streaming, main-story arc + one faction line, dragons (flight
architecture prototyped FIRST), mounted movement, cities.

## Out of scope until base game is complete
Expansion-scale content, multiplayer (kept possible, not built), mod loader UI,
desktop packaging.
