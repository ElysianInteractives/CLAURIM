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
  rings, ground-pool rendering, downed poses, party frames HUD.
- Naming/dialogue regime (D-022): NAMING_GUIDE + IP_STYLE_GUIDE + automated
  check_ip gate; slice audit done (Brandvar Hale, Eydris Varr renames);
  all dialogue rewritten with voices + plural-adventurer framing.

## Verification evidence (this session)
- `npm test`: 69 tests / 7 suites green (multiplayer sim, server/net,
  saves+migrations, quest e2e, nav, determinism, architecture guards incl.
  new I-14..I-22).
- Live ws smoke: server + 2 real WebSocket clients: welcome, 25 snapshots
  per client per 2.5 s, server-side movement (ack seq 74), mutual remote
  visibility, shared party, characters persisted on disconnect.
- `npm run mp:bench` (naive bot parties vs boss): solo 0/3 kills (9 wipes),
  3-party 1/3 (25 s), 5-party 2/3 (24 s). See ENCOUNTER_DESIGN.md.
- `npm run gate` green at handoff (validate incl. IP gate, typecheck, tests,
  build).

## Commands
- `npm run server` - authoritative server (CLAURIM_PORT / CLAURIM_DATA_DIR).
- `npm run dev` then open `/?ws=ws://localhost:8787&char=<id>&name=<name>`
  in two tabs for two clients; no query = offline single-player.
- `npm run mp:bench -- runs=5` - dungeon difficulty measurement.

## How to continue
1. Read CLAUDE.md, DECISIONS.md (D-001..D-023), INVARIANTS.md.
2. Pick from OPUS_BACKLOG.md (OB-M* are the multiplayer-era tickets).
3. Tests + `npm run gate` before done; never weaken a guard.

## Watch items
- KL-11: charId IS identity; accounts/auth is FABLE_REQUIRED pre-deployment.
- Bench bots are naive (KL-13); treat difficulty numbers as lower bounds.
- Snapshot JSON is full-state at 10 Hz (KL-14); delta encoding when entity
  counts grow.
- The offline SimWorld.drainEvents consumes globally: exactly one local view
  per offline sim (documented in the file; server path is separate).
- Git: sandbox cannot delete `.git/index.lock`/objects lock leftovers; if
  commits fail on YOUR machine, delete `.git/index.lock` and commit; a
  `claurim-mmo.bundle` with this session's commit may sit at repo root.
