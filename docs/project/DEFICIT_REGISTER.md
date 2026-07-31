# Deficit register

This is the evidence ledger for the improvement program. It complements
`KNOWN_LIMITATIONS.md`: that file records deliberate limitations; this file
tracks observed defects, control gaps, and architectural risks through
reproduction, agreement, implementation, and verification.

No gameplay fix moves past `PROPOSED` until the user and Codex explicitly mark
its bounded change package `LOCKED_IN`.

## Status model

`REPORTED` -> `REPRODUCED` -> `ROOT_CAUSE` -> `PROPOSED` -> `LOCKED_IN` ->
`IMPLEMENTED` -> `VERIFIED`

- `REPORTED`: observation received; not yet independently reproduced.
- `REPRODUCED`: repeatable evidence exists.
- `ROOT_CAUSE`: the responsible path is confirmed.
- `PROPOSED`: one or more bounded remedies and tradeoffs are documented.
- `LOCKED_IN`: scope, constraints, acceptance, and tests are jointly approved.
- `IMPLEMENTED`: approved change exists but has not passed its full exit gate.
- `VERIFIED`: approved acceptance checks and the full gate pass.
- `DEFERRED`: intentionally parked with a reason and revisit condition.

## Severity

- `BLOCKER`: prevents the mode or release from functioning.
- `S1`: data loss, security boundary failure, or major systemic correctness.
- `S2`: materially harms playability, clarity, or development confidence.
- `S3`: localized defect or quality problem with a practical workaround.
- `S4`: polish or low-impact improvement.

## Current evidence

| ID | Area | Severity | Status | Evidence | Expected / next lock |
|---|---|---:|---|---|---|
| NET-001 | NET | BLOCKER | VERIFIED | Browser online boot sent `hello` from the `ClientWorld` constructor while the socket was CONNECTING. Plan 5 makes sessions explicit, begins them only after `open`, generation-guards stale sockets, bounds reconnect, suppresses disconnected intent, and exposes visible lifecycle status. Focused lifecycle tests plus real Local/Good/Degraded/Severe browser runs pass. | Preserve D-027 and direct online-browser startup coverage. |
| PST-001 | PST | BLOCKER before public release | REPRODUCED | `charId` is the identity token (KL-11); protocol tests confirm no separate account/session credential exists. | Plan 6 authentication design and threat model. |
| UX-001 | UX | S2 | VERIFIED | Plan 1 replaces the bottom-edge strip with a structured controls card, a readable collapsed reminder, and an `H` toggle. Direct 1280x720 and scaled-harness 1920x1080 browser checks keep the card inside 24-pixel safe margins without resource overlap. | Re-run `QA-OFF-BOOT` and `QA-OFF-MENUS` when controls, keybindings, or supported viewports change. |
| UX-002 | UX | S2 | VERIFIED | Health, stamina, and magicka now have visible labels, numeric current/maximum values, semantic meter attributes, and distinct fill patterns. The Plan 1 browser checks and `tests/hud.test.ts` pass. | Preserve text and non-color differentiation for future resource styling. |
| CMB-001 | CMB | S2 | VERIFIED | Attack commands submitted during an existing attack were discarded; blocking could overlap committed attack frames. `tests/combat_correctness.test.ts` reproduced both. The sim now buffers one active/recovery follow-up, allows block to cancel recovery only, and emits private authoritative rejection reasons. The Plan 2 timing/browser gate passes. | Preserve `COMBAT_CONTRACT.md` timing and rejection tests when adding attacks. |
| CMB-002 | CMB | S2 | VERIFIED | Melee ignored height and player swings damaged any actor, including party members. Blocking mitigated rear and source-less damage. Focused tests now pin a 1.5 m vertical envelope, hostile-only hits, a 120-degree frontal block arc, stamina cost, and unblockable pools/source-less effects. Browser evidence confirms mitigated frontal-block feedback. | Revisit only with a locked vertical-combat or PvP package. |
| CMB-003 | CMB | S2 | VERIFIED | Flamebolt crossed both the Duskhollow pillar and implicit room wall in deterministic reproductions. Projectiles now choose the earliest swept actor/world impact across terrain, room boundaries, and solid prop height/AABBs. Both focused reproductions and the full gate pass. | Preserve wall/prop tests when projectile shapes or collision geometry change. |
| CMB-004 | UX/AV | S2 | VERIFIED | The HUD had no target identity or authoritative hit/block/hurt confirmation; renderer telegraphs showed only a generic caster ring. Actor views now expose exact danger shapes; HUD/renderer show target health, phase poses, flashes, markers, vignette, and exact cone/pool/ring geometry. Direct 1280 and scaled 1920 evidence passes. | Re-run `QA-CMB-SMOKE` for combat view/event changes. |
| CMB-005 | AV | S3 | VERIFIED | KL-5 recorded no audio. The browser host now maps filtered authoritative combat events to a rate-limited synthesized cue palette after user activation; cue mapping tests pass and browser activation produced no game audio error. Music, ambience, spatial mix, and volume UI remain KL-5. | Human-review final mix/loudness when broader audio is locked. |
| CMB-006 | CMB/QLT | S3 | VERIFIED | Weapon output previously had no repeatable comparison harness. `npm run combat:bench -- seconds=30` now reports hits, mitigated damage/DPS, resource endpoints/wait, and rejected inputs for dagger, iron/steel swords, bow, and Flamebolt; Plan 2 metrics are recorded in `ENCOUNTER_DESIGN.md`. | Retain the harness and compare results for future tuning changes. |
| WRL-001 | WRL | S2 | VERIFIED | Rotated props rendered with yaw but movement/navigation used yaw-less AABBs; exterior projectile boxes also began at world y=0 while meshes sat on terrain. Plan 3 uses one oriented footprint and terrain-relative vertical bound for actors, navigation, projectiles, and camera obstruction. Focused tests pin both formerly missing and phantom smithy collision. | Preserve D-025 when adding prop shapes; a non-rectangular collider family requires its own locked schema change. |
| WRL-002 | WRL | S2 | VERIFIED | The authored road point at Fenharrow ended inside the inn shell; the mine return target was on a procedurally over-steep patch; Maera, Brandvar, Eydris, and the ruin chest had obstructed anchors. The road/anchors and mine apron are corrected, deterministic placement repairs invalid runtime points, and `npm run world:tour` passes 17 routes plus 34 placements across all three spaces. | Run `world:tour` for terrain, prop, room, route, door, spawn, schedule, or container changes. |
| WRL-003 | WRL/AV | S2 | VERIFIED | Navigation sampled endpoints coarsely and could append an unreachable exact goal; interior rendering removed an entire wall edge when only a narrow corridor overlapped. Navigation now sweeps shared occupancy from exact start to exact goal, movement substeps, and room-union boundary tests/rendering retain only the intended openings. | Preserve route-edge and room-boundary tests when changing navigation step or interior authoring. |
| WRL-004 | WRL/NET | S3 | VERIFIED | Space changes retained attacks/block/sprint and the traversal program had no explicit swimming decision or multi-player cell/transition isolation test. Transitions now clear only the moving character's incompatible transient state; any-player activation and isolation are pinned; water is explicitly wade-only to 0.5 m. Plan 4 subsequently adds cross-space NPC schedules under D-026. | Swimming still requires a later locked package; retain multiplayer isolation tests. |
| AI-001 | AI | S2 | VERIFIED | Perception used only distance/cone/stealth, so actors detected targets through implicit walls; threat hysteresis could retain an unseen target while a valid rival was visible. Plan 4 adds shared-world eye-to-eye obstruction and a visible-candidate continuity rule; focused reproductions and the 118-test gate pass. | Preserve D-012/D-026 when perception shapes or target priorities change. |
| AI-002 | AI | S2 | VERIFIED | Group aggro/reset was limited to one spawner and only cleared direct boss summons/pools. Separate authored pulls could split; defeated members, descendant sources, and projectiles survived inconsistent reset paths. `encounterId` now owns pull, scaling, descendants, mechanics, return, and atomic reset; focused reset/wipe tests and the full gate pass. | New multi-spawner pulls must share one space and extend the ownership tests. |
| AI-003 | AI | S2 | VERIFIED | Supports could heal unrelated/healthy actors, summon casts had no living cap, and cooldowns paused throughout a cast. AI now requires a useful legal target, allied factions are explicit, Warden adds cap at four, and cooldowns advance during telegraph/recovery. Focused tests and Matron/Warden browser observation pass. | Re-run `ai:bench` and browser mechanic checks when ability rules or numbers change. |
| AI-004 | AI/WRL | S2 | VERIFIED | Cross-space schedules stayed in the old space, and a returning actor with a disconnected valid home could remain in `return` forever. Directed-door schedule routing plus inactive route collapse and a 90-blocked-tick home recovery pass focused observed/offscreen tests and the full gate. | Preserve KL-4’s offscreen abstraction; rerun schedule tests when doors/schedules change. |
| QLT-005 | QLT/AI | S3 | VERIFIED | The boss benchmark had one simple unnamed policy and could not show whether blocks, add priority, pool movement, and revives changed pressure. `npm run ai:bench` now compares named fixed-seed naïve/mechanics policies and reports damage, blocks, downs, revives, interrupts, phases, wipes, and kills. Current comparison and browser evidence are recorded in QA/encounter docs. | Keep both policies deterministic and compare results for later tuning. |
| FND-001 | FND | S2 risk | REPRODUCED | `src/sim/sim.ts` is 1,255 lines with 71 methods and coordinates spawning, player lifecycle, parties, tick phases, combat facades, interactions, sessions, and persistence. | No refactor without a demonstrated defect. Use `SIM_RESPONSIBILITY_MAP.md` when a later plan proposes a seam. |
| QLT-001 | QLT | S2 | VERIFIED | Browser QA previously had no repeatable baseline and KL-7 stated that browser inspection was unavailable. The offline/online procedure was completed at 1280x720 and recorded in `QA_BASELINE.md`. | Re-run the relevant browser scenarios for every visual, interaction, or online-browser change. |
| QLT-002 | QLT | S2 | VERIFIED | The sim import graph had no circular-dependency guard. The Plan 0 gate passes with a non-vacuous acyclic-graph assertion. | `tests/architecture.test.ts` must remain green and non-vacuous. |
| NET-002 | NET | S2 | VERIFIED | Snapshot growth had no budget tripwire. The Plan 0 gate passes with representative four-player mine snapshots peaking at 8,077 bytes. | `tests/server_net.test.ts` enforces `< 32,000` UTF-8 bytes. |
| QLT-003 | QLT/NET | S2 | VERIFIED | Plan 5 adds an ordered fixed-seed virtual-time matrix over real ClientWorld/ServerCore plus a matching real WebSocket browser relay. All four standard profiles report authority delay, correction, throughput, loss, disconnects, pending tail, and remote motion; tests enforce the locked envelopes. | Run `net:bench` for prediction, protocol, input, snapshot, or transport changes. |
| NET-003 | NET | S2 | VERIFIED | Plan 5's queued-input reproduction showed `ackSeq` advanced when input entered the queue, before an authoritative tick consumed it, causing clients to discard an unprocessed reconciliation tail under bursts. Server queues now retain sequence numbers and advance the cumulative ack only as ticks consume them. | Preserve the partial-queue acknowledgement test in `server_net.test.ts`. |
| QLT-004 | QLT | S3 | REPRODUCED | `npm audit` reports five development-tool advisories (3 moderate, 1 high, 1 critical) in the Vite/Vitest toolchain; the production dependency audit is clean. | Plan 10 must lock the major-version upgrade and compatibility checks. |

## Playtest intake template

Use one row per independently observable symptom.

| ID | Area | Reported behavior | Expected behavior | Reproduction | Severity | Status | Dependencies |
|---|---|---|---|---|---|---|---|
| _Example: PLY-001_ | _PLY_ | _What happened_ | _What should happen_ | _Mode, location, input sequence, frequency_ | _S1-S4_ | `REPORTED` | _WRL, UX, etc._ |

## Evidence rules

1. Record offline and online behavior separately.
2. Separate symptoms from suspected causes until the cause is confirmed.
3. Attach the smallest deterministic or browser scenario that reproduces it.
4. Do not close an item on a unit test alone when the deficit is visual,
   interaction-based, timing-sensitive, or network-sensitive.
5. `VERIFIED` requires the locked acceptance checks plus `npm run gate`.
