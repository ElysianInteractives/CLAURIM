# Model handoff - read this first in a new session

## Improvement program control baseline (Plan 0)
Behavioral changes now require an explicit locked-in scope. Read
`DEFICIT_REGISTER.md` for evidence/status, `QA_BASELINE.md` for repeatable
checks and current measurements, and `SIM_RESPONSIBILITY_MAP.md` before
proposing a change to the coordinator. Plan 0 also adds the missing sim-cycle
and snapshot-size guards plus a real two-client `npm run qa:ws` smoke.

The first browser baseline confirmed NET-001: online browser boot sent
`hello` while the WebSocket was still connecting. Plan 5 resolves it through
the explicit D-027 connection/session lifecycle and verifies it in real
browsers across the standard impairment matrix.

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

Plan 5 verifies NET-001, NET-003, and QLT-003: open-gated browser sessions;
generation-safe, bounded reconnect; visible online/retry/rejected states;
terminal duplicate-session takeover; authoritative-tick input
acknowledgements; and fixed-seed Local/Good/Degraded/Severe network profiles.
`NETWORK_RELIABILITY_CONTRACT.md` is the exact ruleset. The exact short-path
gate is green at 14 suites / 128 tests.

Plan 6 verifies PST-001 through D-028: scrypt account credentials; generic and
throttled login; 256-bit digest-only, expiring, rotating sessions; pre-core
authentication; account-owned character selection; secure/origin-allowlisted
remote browser transport; and a memory-only sign-in/create UI. The 15-suite,
144-test gate, real register/resume/replay WebSocket smoke, persistence-secret
inspection, and 1280/1920 browser flow all pass. Exact security and deliberate
operations limits are in `AUTHENTICATION_THREAT_MODEL.md`.

Plan 7 verifies SOC-001/SOC-002 through D-029: characters start solo;
nearby invite/accept/decline/leave forms a durable five-member party; offline
frames and reconnect/restart membership persist; cooperative credit, loot,
revive, and first-engage scaling use accepted membership; and save schema v3
removes the legacy automatic `fellowship`. Enter opens a focus-safe,
sanitized/throttled nearby-chat composer. The 15-suite, 155-test gate, real
WebSocket smoke, and two-client 1280/1920 browser flow pass.

Plan 8 verifies CNT-001/PRG-001 through D-030: content v0.2 adds twelve
merchant-backed gear records, ten modifier-only perks, Rimehowl Alpha and
Barrow Sentinel veteran variants, and Siltroot Burrow as the second cave.
The new generic catalog suite, all-space traversal, prepared-solo veteran
check, unchanged combat-output comparison, current group benchmark, and
1280/1920 browser flow pass. Browser QA also removed a hard-coded Kaldwyn
location label by routing authored space names through `IWorld`.

Plan 9 verifies AV-001/AV-002/CMB-007 through D-031: the renderer now smooths
observed actor transforms, local camera/terrain following, and caster
telegraphs with explicit transition/teleport snaps. The browser audio director
adds master/effects/ambience/music buses, persistent accessible controls,
mute, and procedural interior/exterior day/night tonal beds. Browser QA also
caught and fixed focused Escape close plus Plan 8's hard-coded single-bow host
dispatch. The 17-suite, 173-test exact short-path gate and 1280/1920 browser
layout/persistence/log checks pass. Exact boundaries are in
`AUDIO_PRESENTATION_CONTRACT.md`.

Plan 10 verifies QLT-004 through D-032: the development graph moves from
Vite 5.4/Vitest 2.1 to Vite 8.2/Vitest 4.1 and records the matching Node
support floor. Clean install, full and production-only zero-advisory audits,
the 17-suite/173-test gate, Rolldown production build, standalone generation,
and transformed dev-server requests pass. Production dependencies and all
application source remain unchanged. Exact maintenance rules are in
`TOOLCHAIN_SECURITY_CONTRACT.md`.

QA Phase C verifies INV-001/CMB-009 through D-035: inventory now separates
six fixed equipment slots from unequipped carried items, and known spells can
be assigned uniquely to persistent 1/2 hotkeys. Both item and spell
equip/unequip actions resolve authoritatively offline and online; the host no
longer hard-codes combat spell IDs. Protocol v5, world save v4, and character
save v2 carry the new state with tested migrations. Exact boundaries are in
`PLAYER_LOADOUT_CONTRACT.md`.

QA Phase D verifies CAM-001 through D-036: third person now uses a
collision-aware right-shoulder boom, leaving the player visibly left of the
center reticle while camera forward remains the exact authoritative D-034
yaw/pitch direction. Whole-boom retraction and close-wall local-body hiding
preserve geometry clearance. Exact boundaries are in
`THIRD_PERSON_CAMERA_CONTRACT.md`.

QA Phase E verifies WRL-006/WRL-007 through D-037: authored site pads now
override road deformation, grounded foundations and complete well geometry
remove visible terrain seams, and exterior doors resolve from validated
parent-prop local transforms with inherited yaw. Development-only named QA
starts make remote presentation checks repeatable without changing saves.
Exact boundaries are in `WORLD_STRUCTURE_PLACEMENT_CONTRACT.md`.

QA Phase F verifies AI-005/AV-003 through D-038: schedule/return movement now
requires an exact line or complete A* route, unreachable static goals settle
at the last reached safe schedule home, and renderer-only speed hysteresis
keeps tiny corrections out of the walk cycle. Combat/search/flee steering is
unchanged after explicit benchmark scoping. Exact boundaries are in
`NPC_SCHEDULE_STABILITY_CONTRACT.md`.

QA Phase G verifies AV-004 through D-039: every render-facing local or remote
actor now carries authoritative equipped-item ids; third-person characters and
the first-person rig build the matching visible gear; and sword/dagger, heavy,
bow, spell, and block states use distinct presentation-only poses. Protocol v6
adds remote loadout presentation without changing equipment authority, combat
outcomes, or saves. Exact boundaries are in
`EQUIPMENT_PRESENTATION_CONTRACT.md`.

QA Phase H verifies UX-003 through D-040: `M` now opens an authored exterior
survey or exact interior floor plan with player position/heading. Selecting a
current-space landmark provides a session-local HUD bearing and straight-line
distance without changing sim, save, or protocol state. Discovery, quest
markers, route distance, and fast travel remain explicit later work. Exact
boundaries are in `MAP_NAVIGATION_CONTRACT.md`.

QA Phase I verifies AV-005 through D-041: the shared code-native character
factory now builds articulated humanoid and quadruped rigs with faceted and
tapered detail, stable equipment hands, full-body gait/idle/head motion, and
phase-aware secondary joints. This remains renderer-only; collision, movement,
combat outcomes, protocol, and saves are unchanged. Exact boundaries are in
`CHARACTER_PRESENTATION_CONTRACT.md`.

QA Phase J verifies MAG-001 through D-042: new characters begin without
magic, authoritative primers teach persistent spells without auto-equipping,
and the known-spell list groups six spells into Claurim's Ruinweaving,
Mending, Stonebinding, and Veilcraft disciplines. Stoneward and Veilstep add
tested defensive/utility effects and alteration/illusion progression; older
saves keep known/equipped spells and receive safe new-skill defaults. Exact
boundaries are in `MAGIC_PROGRESSION_CONTRACT.md`.

QA Phase K verifies WRL-008 through D-043: Kaldwyn now has two minor
settlements, eight mapped destinations, three natural interiors, denser varied
forest presentation, three additional scheduled residents, ambient ridge
harts, hostile briarboars, and a veteran den matriarch. Gloamroot's arrival is
third-person safe and faces a lit natural interior. Exact boundaries are in
`WORLD_CONTENT_EXPANSION_CONTRACT.md`.

QA Phase L verifies NAR-001 through D-044: `A Bitter Root` and `The Stone
Toll` give Gloamroot and Weeping Stones persistent quest use; Tamsin, Corren,
and Vael provide state-aware original conversations. Dialogue entry selection
now occurs before `talkedTo` quest credit so an authored return scene remains
visible even when that conversation completes the objective. Exact boundaries
are in `WORLD_NARRATIVE_EXPANSION_CONTRACT.md`.

QA Phase M verifies AV-006 through D-045: all D-043 terrain decoration remains
deterministic and equally dense but renders through shared-geometry instance
batches, and the host captures every fixed-step actor transform before rAF
interpolation. Named 25-cell budgets and multi-tick frame tests prevent the
open-terrain jitter regression. Exact boundaries are in
`EXTERIOR_RENDER_STABILITY_CONTRACT.md`.

## State as of 2026-08-01 (Fable MMO-pivot session)
Claurim is now a third-person, server-authoritative multiplayer action RPG.
On top of the 2026-07-30 single-player foundation (still green), this
session added and TESTED:

- Multiplayer sim core (D-013): many characters in one Sim; per-character
  journals/spells/sessions/container-loot; explicit durable parties and
  nearby chat (D-029); downed/revive/release;
  world save schema v4 with tested v1->v2->v3->v4 migrations; per-character
  persistence records (schema v2 with v1->v2 migration).
- MMO combat (D-017/D-018): threat tables with hysteresis, group aggro,
  locked encounter scaling through the modifier system, data-driven
  abilities (telegraphed cones, ground pools, summons, support heals),
  interrupts, boss phases; The Pale Warden converted into a 3-phase group
  boss; Duskhollow into a group dungeon (gate reaver, healer matron, thrall
  pulls); personal loot for elite/boss tiers (D-019).
- Authoritative server (D-014/D-028): transport-agnostic ServerCore + ws host
  on :8787; protocol v7 with an authenticated pre-hello boundary and full inbound validation; 10 Hz interest-scoped
  snapshots over the cell system; per-client event filtering; reconnect
  takeover; StorageProvider persistence (FileStorage, atomic writes).
- Online client (D-015): ClientWorld implements IWorld over snapshots with
  sequenced-input prediction + reconciliation and remote smoothing; browser
  host runs offline (default) or online (`?ws=ws://localhost:8787`) through an
  explicit account sign-in/create gate.
- QA Phase A player movement/recovery (D-033): offline authority and online
  prediction share one camera-relative movement basis and sprint-exhaustion
  policy; the protocol v3 self snapshot carries the derived movement state;
  Settings exposes a combat-guarded, 30-second-cooldown return to the current
  space's safe recovery point without applying a death penalty.
- QA Phase B reticle spell aim (D-034): bounded pitch is required by protocol
  v4 and consumed at the fixed-tick spell-release boundary; player projectile
  spells and the read-only target frame follow the normalized 3D center-
  reticle ray while collision, hits, and damage remain authoritative.
- QA Phase C loadouts (D-035): six fixed item slots, separate carried items,
  two persistent unique spell hotkeys, known-spell equip actions, and a
  combat quickbar share one authoritative offline/online contract.
- QA Phase D camera composition (D-036): a `0.9 m` right-shoulder boom clears
  the player model from the center reticle, retains exact aim direction, uses
  shared world obstruction, and hides the local body only under extreme
  compression.
- QA Phase E structure placement (D-037): final site-pad ordering, below-grade
  foundations, complete well geometry, and validated prop-relative exterior
  entrances share the existing terrain/traversal authority.
- QA Phase F NPC stability (D-038): route-complete schedules, deterministic
  safe-home fallback, authored-leg coverage, and renderer-only locomotion
  hysteresis eliminate wall pressure and amplified correction jitter.
- QA Phase G equipment presentation (D-039): interest-scoped actor views carry
  authoritative gear, world and first-person rigs share the equipped weapon/
  shield state, all six gear families render, and combat posing varies by
  weapon family and phase.
- QA Phase H map/navigation (D-040): the Kaldwyn road and five destinations,
  authored interior rooms/exits, current player arrow, and selectable HUD
  bearing/distance form a presentation-only navigation layer.
- QA Phase I character presentation (D-041): stable humanoid and quadruped
  joints, tapered/faceted detail, hand-based gear, full gait, and secondary
  combat posing replace the old rigid-block silhouettes.
- QA Phase J magic progression (D-042): fresh characters start uninitiated;
  six primers teach six persistent, manually equipped spells across four
  original disciplines, with legacy-save compatibility and private protocol
  feedback.
- QA Phase K world expansion (D-043): Fenharrow gains three shells; Thornmere
  Crossing adds five buildings, a well, and three scheduled residents;
  Weeping Stones adds an exterior encounter/cache; Gloamroot Hollow adds a
  five-room den, loot, lit dressing, and two briarboar tiers; ridge harts roam
  bounded complete routes; the deterministic conifer pass is denser and more
  varied.
- QA Phase L narrative expansion (D-044): two original side quests use the new
  den and landmark through existing reach/kill/talk objectives; all Thornmere
  residents have conditional dialogue; pre-credit entry capture preserves the
  visible return scene while rewards, personal state, saves, and party kill
  credit remain authoritative.
- QA Phase M exterior stability (D-045): repeated terrain decoration is
  instance-batched with shared geometry, the named 25-cell checkpoints fall
  to 56-189 draw nodes, and every successful fixed step advances renderer-only
  transform history before the next animation frame.
- Third-person primary camera with terrain collision (D-023); telegraph
  shapes, ground-pool rendering, downed poses, party frames HUD.
- Plan 2 combat feedback (D-024): target frame, phase-aware poses,
  authoritative damage flashes/markers/vignette, exact cone/pool/caster
  telegraphs, action rejection feed, and user-gesture synthesized cues.
- Plan 9 presentation/audio (D-031): host-only one-tick transform smoothing;
  master/effects/ambience/music routing; persistent volume/mute controls; and
  procedural tonal soundscape exemplars. Final audio assets/spatial mix remain
  KL-5.
- Plan 10 toolchain security (D-032): Node `^20.19.0 || >=22.12.0`, Vite 8,
  Vitest 4, committed-lock clean installs, and explicit zero-advisory full/
  production audit checks.
- Naming/dialogue regime (D-022): NAMING_GUIDE + IP_STYLE_GUIDE + automated
  check_ip gate; slice audit done (Brandvar Hale, Eydris Varr renames);
  all dialogue rewritten with voices + plural-adventurer framing.
- Proven-schema content depth (D-030/D-042/D-043/D-044): content v0.5 contains 36
  items, 6 spells, 15 perks, 19 actor templates, 5 spaces, 42 props, 8 doors,
  24 spawners, 6 containers, 3 quests, and 6 dialogues; magic, world, and
  narrative records extend the validated catalog while existing save
  envelopes remain stable.

## Verification evidence (this session)
- `npm test`: 234 tests / 29 suites green (multiplayer sim, server/net,
  saves+migrations, quest e2e, combat, traversal, nav, determinism,
  architecture guards incl. I-14..I-25, browser lifecycle, impairment, and
  the generic content catalog, host presentation/audio rules, and shared
  movement/sprint/recovery behavior, reticle-directed spell aim, player
  equipment/spell loadouts, shoulder-camera composition/collision, and
  multi-seed structure-pad/door-anchor placement, route-complete NPC
  schedules, safe blocked fallback, locomotion dead zones, authoritative
  equipped-item views, gear attachments, weapon-specific poses, authored
  map/floor-plan coverage, destination bearing/distance, articulated rig
  structure, full-body gait, secondary combat/creature posing, primer-gated
  spell learning, discipline grouping, effects, legacy skill defaults,
  expanded original geography, wildlife behavior/presentation, cavern
  arrival/readability, complete Thornmere quest playthroughs, save/load,
  rewards, conditional reactions, visible return scenes, dense-exterior draw
  budgets, and multi-step adjacent-tick presentation history).
- Live ws smoke under protocol v7: server + 2 real WebSocket clients: ack 30, 4.4 m
  authoritative movement, mutual visibility, session rotation, consumed-token
  replay rejection, preserved ownership, and current 6,743 / 6,730-byte snapshots.
- `npm run net:bench`: every standard profile connects with zero disconnects,
  drains pending input to zero, and preserves 19.95-21.56 m of remote motion;
  p95 authority delay ranges from 34.3 ms Local to 311.1 ms Severe.
- `npm run ai:bench` after D-038 scope verification: solo remains 0/3 under
  both policies; naive clears 1/3 at 3 players (191 s) and mechanics clears
  1/3 at 5 players (75 s). See ENCOUNTER_DESIGN.md for full current metrics.
- `npm run world:tour`: all 5 spaces, 31 routes, and 69 placements pass;
  headless seed 42 completes 9,000 ticks in 198 ms with a 13,372-byte save.
- `npm run gate` green at handoff (validate incl. IP gate, typecheck, tests,
  build); Vite 8 production JavaScript is 727.31 kB / 192.00 kB gzip.
- `npm run audit:deps` and `npm run audit:prod`: zero vulnerabilities after a
  clean `npm ci`; `npm run standalone` produces the 649 kB single-file build.

## Commands
- `npm run server` - authoritative server (CLAURIM_PORT / CLAURIM_DATA_DIR).
- `npm run dev` then open `/?ws=ws://localhost:8787` and authenticate; create a
  second account in another tab for a second client. No query = offline.
- `npm run mp:bench -- runs=5` - dungeon difficulty measurement.
- `npm run ai:bench` - fixed-seed naïve/mechanics comparison.
- `npm run combat:bench -- seconds=30` - sustained weapon/spell comparison.
- `npm run world:tour` - deterministic all-space traversal/placement audit.
- `npm run net:bench` - deterministic four-profile network acceptance matrix.
- `npm run net:proxy` - real WebSocket impairment relay for browser QA.
- `npm run audit:deps` / `npm run audit:prod` - networked full and
  production-only dependency advisory checks.

## How to continue
1. Read CLAUDE.md, DECISIONS.md (D-001..D-045), INVARIANTS.md.
2. Pick from OPUS_BACKLOG.md (OB-M* are the multiplayer-era tickets).
3. Tests + `npm run gate` before done; never weaken a guard.

## Watch items
- KL-11: baseline auth/ownership is implemented; recovery, MFA, external
  breached-password checks, audit operations, and shared durable sessions
  remain before a live service. See `AUTHENTICATION_THREAT_MODEL.md`.
- Bench bots are simple even with the mechanics policy (KL-13); treat
  difficulty numbers as evidence bounds, not a replacement for real parties.
- Snapshot JSON is full-state at 10 Hz (KL-14); delta encoding when entity
  counts grow.
- The offline SimWorld.drainEvents consumes globally: exactly one local view
  per offline sim (documented in the file; server path is separate).
- Git: sandbox cannot delete `.git/index.lock`/objects lock leftovers; if
  commits fail on YOUR machine, delete `.git/index.lock` and commit; a
  `claurim-mmo.bundle` with this session's commit may sit at repo root.
