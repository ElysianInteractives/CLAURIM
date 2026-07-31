# Claurim - Project Charter

## What (updated 2026-07-31: MMO pivot)
A browser-playable, THIRD-PERSON, SERVER-AUTHORITATIVE, persistent
multiplayer online action RPG set in an original northern fantasy province,
executed in the compact, code-authored, verification-disciplined style of
World of ClaudeCraft. One deterministic sim runs the offline host, the
dedicated server, and headless tools; the server is authoritative for every
persistent multiplayer outcome. The experience target: an MMO's structure
(parties, group dungeons, shared world, persistent characters) with the
freedom, exploration, and environmental storytelling of a classic northern
fantasy RPG. Combat stays third-person ACTION combat, not tab-targeting.
An offline single-player mode remains supported by the same core.

## Non-negotiables
1. Clean-room IP boundary: original code, original prose, original assets,
   original names. Publicly known MECHANICS may be reimplemented; protected
   EXPRESSION may not be copied. `THIRD_PARTY_NOTICES.md` tracks all external
   material.
2. One deterministic sim, many hosts (docs/project/DECISIONS.md D-001).
3. Foundations before breadth: every content family gets a system, one hard
   exemplar, tests, an authoring contract, and validation BEFORE volume.
4. Saves are load-bearing: schema versioning + migrations from day one.

## Target experience (base game, long-term)
A contiguous province with holds, cities, villages, wilderness, ruins, caves,
and dungeons; first/third-person exploration; melee/archery/magic/stealth
combat; use-based skills with perks; inventory/loot/merchants/crafting; NPC
schedules, factions, crime, followers; main + faction + side + radiant quests;
dragons and large-scale encounters; weather/time/persistence; durable saves;
data-driven expansion without engine rewrites.

## Current milestone
The Kaldwyn Reach vertical slice (see SCOPE.md): ruined start -> wilderness
road -> Fenharrow village -> Duskhollow Mine, with Siltroot Burrow as a second
interior exemplar, one complete multi-stage quest, three villagers, a
merchant, standard and veteran enemies plus a boss, and save/load at every
point. Status: playable; see MODEL_HANDOFF.md.

## Development model
Fable owns architecture, seams, exemplars, and anything expensive to reverse.
Opus executes bounded, exemplar-following tickets (OPUS_BACKLOG.md). Every
contribution passes `npm run gate` before it is called done.
