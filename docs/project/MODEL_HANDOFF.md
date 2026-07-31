# Model handoff - read this first in a new session

## Improvement program control baseline (Plan 0)
Behavioral changes now require an explicit locked-in scope. Read
`DEFICIT_REGISTER.md` for evidence/status, `QA_BASELINE.md` for repeatable
checks and current measurements, and `SIM_RESPONSIBILITY_MAP.md` before
proposing a change to the coordinator. Plan 0 also adds the missing sim-cycle
and snapshot-size guards plus a real two-client `npm run qa:ws` smoke.

The first browser baseline confirmed NET-001: online browser boot sends
`hello` while the WebSocket is still connecting. This is recorded with root
cause but deliberately not fixed until the networking change plan is locked.

Plan 1 verifies UX-001/UX-002: the HUD now uses named, numeric, patterned
resource meters and a structured controls card that toggles with `H`. Browser
evidence covers 1280x720 and a true 1920x1080 CSS viewport; the gate is green
at 8 suites / 76 tests.

Plan 2 verifies CMB-001..006: attack buffering and recovery-only defensive
cancel; vertical/hostile melee validation; directional block; swept
projectile/world collision; private rejection reasons; exact danger shapes;
target/hit/block/hurt feedback; and minimal authoritative-event combat audio.
`COMBAT_CONTRACT.md` is the exact ruleset. Browser evidence covers direct
1280x720 and a scaled true 1920x1080 CSS viewport; the exact short-path source
gate is green at 10 suites / 92 tests.

Plan 3 verifies WRL-001..004: yaw-aware prop footprints and terrain-relative
vertical bounds; one movement/navigation occupancy query; swept route edges
and substepped movement; exact room-union render walls; shared projectile and
camera obstruction; a wade-only water policy; safe authored/runtime
placements; and isolated multiplayer transitions/cell activation.
`WORLD_TRAVERSAL_CONTRACT.md` is the exact ruleset. The deterministic
`npm run world:tour` covers all three spaces, 17 route legs, and 34 authored
placements. Browser evidence covers direct 1280x720 and a scaled true
1920x1080 CSS viewport. The exact short-path gate is green at 11 suites /
105 tests.

Plan 4 verifies AI-001..004 and QLT-005: shared-world line-of-sight
perception, visible threat continuity, authored multi-spawner encounter
ownership, atomic group/transient reset, useful support/hostile ability
selection, cooldown progress during casts, capped summons, active/offscreen
door schedules, and unreachable-home recovery. `AI_ENCOUNTER_CONTRACT.md` is
the exact ruleset. `npm run ai:bench` compares naïve/mechanics policies;
browser evidence covers Matron healing, Warden party/cone/four-add
presentation, and Brandvar’s scheduled inn arrival.

## State as of 2026-07-31 (Fable MMO-pivot session)
Claurim is now a third-person, server-authoritative multiplayer action RPG.
On top of the 2026-07-30 single-player foundation (still green), this
session added and TESTED:

- Multiplayer sim core (D-013): many characters in one Sim; per-character
  journals/spells/sessions/container-loot; parties; downed/revive/release;
  world save schema v2 with a tested v1->v2 migration; per-character
  persistence records (schema v1).
- MMO combat (D-017/D-018): threat tables with hysteresis, group aggro,
  locked encounter scaling through the modifier system, data-driven
  abilities (telegraphed cones, ground pools, summons, support heals),
  interrupts, boss phases; The Pale Warden converted into a 3-phase group
  boss; Duskhollow into a group dungeon (gate reaver, healer matron, thrall
  pulls); personal loot for elite/boss tiers (D-019).
- Authoritative server (D-014): transport-agnostic ServerCore + ws host on
  :8787; protocol v1 with full inbound validation; 10 Hz interest-scoped
  snapshots over the cell system; per-client event filtering; reconnect
  takeover; StorageProvider persistence (FileStorage, atomic writes).
- Online client (D-015): ClientWorld implements IWorld over snapshots with
  sequenced-input prediction + reconciliation and remote smoothing; browser
  host runs offline (default) or online (?ws=ws://localhost:8787&char=alva).
- Third-person primary camera with terrain collision (D-023); telegraph
  shapes, ground-pool rendering, downed poses, party frames HUD.
- Plan 2 combat feedback (D-024): target frame, phase-aware poses,
  authoritative damage flashes/markers/vignette, exact cone/pool/caster
  telegraphs, action rejection feed, and user-gesture synthesized cues.
- Naming/dialogue regime (D-022): NAMING_GUIDE + IP_STYLE_GUIDE + automated
  check_ip gate; slice audit done (Brandvar Hale, Eydris Varr renames);
  all dialogue rewritten with voices + plural-adventurer framing.

## Verification evidence (this session)
- `npm test`: 118 tests / 12 suites green (multiplayer sim, server/net,
  saves+migrations, quest e2e, combat, traversal, nav, determinism,
  architecture guards incl. I-14..I-25).
- Live ws smoke: server + 2 real WebSocket clients: welcome, 25 snapshots
  per client per 2.5 s, server-side movement (ack seq 74), mutual remote
  visibility, shared party, characters persisted on disconnect.
- `npm run ai:bench` after Plan 4 ownership/faction/scaling corrections:
  solo 0/3 under both policies; mechanics at 3 players takes 4,714.2 damage
  with 1/3 clears (57 s), and at 5 takes 8,108.5 with 1/3 clears (166 s).
  It outperforms naïve pressure at both group sizes; see ENCOUNTER_DESIGN.md.
- `npm run gate` green at handoff (validate incl. IP gate, typecheck, tests,
  build).

## Commands
- `npm run server` - authoritative server (CLAURIM_PORT / CLAURIM_DATA_DIR).
- `npm run dev` then open `/?ws=ws://localhost:8787&char=<id>&name=<name>`
  in two tabs for two clients; no query = offline single-player.
- `npm run mp:bench -- runs=5` - dungeon difficulty measurement.
- `npm run ai:bench` - fixed-seed naïve/mechanics comparison.
- `npm run combat:bench -- seconds=30` - sustained weapon/spell comparison.
- `npm run world:tour` - deterministic all-space traversal/placement audit.

## How to continue
1. Read CLAUDE.md, DECISIONS.md (D-001..D-024), INVARIANTS.md.
2. Pick from OPUS_BACKLOG.md (OB-M* are the multiplayer-era tickets).
3. Tests + `npm run gate` before done; never weaken a guard.

## Watch items
- KL-11: charId IS identity; accounts/auth is FABLE_REQUIRED pre-deployment.
- Bench bots are simple even with the mechanics policy (KL-13); treat
  difficulty numbers as evidence bounds, not a replacement for real parties.
- Snapshot JSON is full-state at 10 Hz (KL-14); delta encoding when entity
  counts grow.
- The offline SimWorld.drainEvents consumes globally: exactly one local view
  per offline sim (documented in the file; server path is separate).
- Git: sandbox cannot delete `.git/index.lock`/objects lock leftovers; if
  commits fail on YOUR machine, delete `.git/index.lock` and commit; a
  `claurim-mmo.bundle` with this session's commit may sit at repo root.
