# QA baseline

Plan 0 establishes how Claurim deficits are reproduced and measured before a
behavioral change is proposed. This is a control baseline, not a declaration
that the game is polished or release-ready.

## Reference run

- Date: 2026-07-31
- Source commit: `53ccaec1fa677e33c287f7ad6d256e99ba09b69a`
- Environment: Windows, Node `v26.0.0`, npm `11.12.1`
- Modes: offline browser, real WebSocket server, in-memory server tests,
  headless deterministic sim

### Automated baseline before Plan 0 guards

- `npm run gate`: green; 7 suites / 69 tests.
- Content validator: 17 items, 6 effects, 3 spells, 5 perks, 11 actors,
  3 spaces, 21 props, 4 doors, 12 spawners, 3 containers, 1 quest,
  3 dialogues.
- Production bundle: 592.86 kB JavaScript / 156.62 kB gzip; HTML 0.87 kB.
- Headless `ticks=9000 seed=42`: 158 ms, 56,962 ticks/sec, 9,959-byte save,
  20 living actors.
- Four-player mine snapshot guard: 8,060 / 8,063 / 8,077 / 8,076 bytes;
  maximum 8,077 against a 32,000-byte limit.

### Plan 0 exit gate

- `npm run gate`: green; 7 suites / 72 tests.
- Content/IP validation, typecheck, all tests, and the production build pass.
- `npm run qa:ws`: two clients, ack sequence 30, 4.4 m authoritative
  movement, mutual visibility, and 3,873 / 3,861-byte observed snapshots.

### Encounter benchmark

`npm run mp:bench -- runs=3`:

| Party | Boss kills | Average successful kill | Wipes | Downs | Revives | Max phase |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0/3 | n/a | 9 | 14 | 0 | 1 |
| 3 | 1/3 | 25 s | 6 | 104 | 0 | 2 |
| 5 | 2/3 | 24 s | 3 | 151 | 0 | 2 |

The zero-revive result and very high down counts show that these bots are a
pressure baseline, not evidence of a good player experience or final balance.

### Real WebSocket smoke

With `npm run server` active, `npm run qa:ws` connected two real `ws`
clients, received welcome + snapshot messages, moved one character 4.4 m with
ack sequence 30, confirmed remote-player visibility, and observed snapshots
of 3,875 and 3,863 bytes.

### Browser baseline

Offline at 1280x720:

- The scene, renderer, HUD, inventory, journal, and perks panels loaded.
- No console warning or error occurred on initial offline load.
- Inventory, journal, and perks opened and closed by their documented keys.
- The persistent help strip is small and pressed against the bottom edge.
- Resource bars are unlabeled and depend on color alone.
- Frame-rate sampling is not yet automated; record browser/device and observed
  frame pacing during human runs.

Online at
`/?ws=ws://127.0.0.1:8787&char=qa_alva&name=QA%20Alva`:

- Browser startup fails before the welcome/snapshot flow.
- Console: `InvalidStateError: Failed to execute 'send' on 'WebSocket':
  Still in CONNECTING state`.
- Root cause is registered as NET-001. The independent `qa:ws` smoke proves
  the server and protocol work when the client waits for the socket to open.

Pointer-lock errors created by browser automation during navigation are
harness artifacts unless reproduced in an ordinary interactive browser.

### Plan 1 HUD/readability exit

Plan 1 resolves UX-001 and UX-002 without changing simulation or gameplay
behavior.

- `npm run gate`: green; 8 suites / 76 tests.
- At 1280x720, the resource card measures 310x153 px at `(24, 543)` and the
  expanded controls card measures 370x260 px at `(886, 436)`. Both keep
  24-pixel edge insets and do not overlap.
- At a true 1920x1080 CSS viewport in a temporary 2/3-scale iframe harness,
  the resource card remains 310x153 px at `(24, 903)` and the controls card
  measures 370x292 px at `(1526, 764)`. Both keep 24-pixel edge insets and do
  not overlap.
- `H` collapses the controls card to a readable `H Controls` reminder and
  restores it. Inventory, journal, and perks continue to open/close through
  `Tab`, `J`, and `P`; the expanded help card stays out of menu views.
- The direct game page produced no browser warnings or errors. The scaled
  iframe harness itself triggers a browser-instrumentation `MutationObserver`
  error; it is not emitted by the game and the harness does not ship.
- Approved captures:
  [expanded 1280x720](../screenshots/2026-07-31/plan-1-hud-1280x720.png),
  [collapsed 1280x720](../screenshots/2026-07-31/plan-1-hud-collapsed-1280x720.png),
  and [scaled 1920x1080](../screenshots/2026-07-31/plan-1-hud-1920x1080-scaled.png).

### Plan 2 combat correctness/readability exit

- Exact short-path source copy: `npm run gate` green; 10 suites / 92 tests.
  Production bundle: 608.66 kB JavaScript / 161.52 kB gzip.
- Focused combat suite: 11 checks covering exact phase timing, one-slot
  buffering, recovery-only block cancel, authoritative rejection reasons,
  vertical/friendly melee rules, frontal blocking, pillar/interior-wall
  projectile obstruction, and exact telegraph view data.
- Multiplayer focus remains green for spells, interrupts, downing, revive,
  auto-release, wipe reset, threat, phases, and loot. Server snapshots deliver
  private rejection feedback and peak at 8,465 bytes in the four-player mine
  guard (32,000-byte budget).
- `npm run combat:bench -- seconds=30` records dagger 7.65 DPS, iron sword
  12.07, steel sword 15.18, bow 5.69, and Flamebolt direct-hit 4.41 under one
  fixed target/resource policy. `npm run mp:bench -- runs=3` remains 0/3 solo,
  3/3 three-player, and 3/3 five-player; friendly-fire removal explains the
  group improvement.
- Direct 1280x720 combat layout: target frame 260x46 px at `(510, 386)`,
  resources 310x153 px at `(24, 543)`, controls 370x260 px at `(886, 436)`.
  All remain inside the viewport without overlap.
- Browser states verified: exact Warden cone + interrupt notice; authoritative
  target health; target material flash + hit marker (`380 -> 374`); frontal
  block marker with mitigated `79/100` health; hurt marker/vignette at
  `80/100`; and down/wipe/release transitions. A clean direct combat page
  emitted no warning or error.
- The temporary fixture only positions existing actors and triggers existing
  sim actions in the short-path QA copy; it does not ship. The scaled
  1920x1080 iframe retains the known browser-instrumentation
  `MutationObserver` error, not emitted by the game.
- Approved captures:
  [telegraph 1280x720](../screenshots/2026-07-31/plan-2-combat-telegraph-1280x720.png),
  [hit 1280x720](../screenshots/2026-07-31/plan-2-combat-hit-1280x720.png),
  [block 1280x720](../screenshots/2026-07-31/plan-2-combat-block-1280x720.png),
  [hurt 1280x720](../screenshots/2026-07-31/plan-2-combat-hurt-1280x720.png),
  and [scaled 1920x1080](../screenshots/2026-07-31/plan-2-combat-1920x1080-scaled.png).

### Plan 3 world traversal/environment exit

- Exact short-path source copy: `npm run gate` green; 11 suites / 105 tests.
  Production bundle: 611.43 kB JavaScript / 162.45 kB gzip.
- The 13-test traversal suite pins oriented prop footprints, terrain-relative
  projectile height, shared camera obstruction, anti-tunneling movement,
  exact room-union walls, the wade-only water policy, authored placements and
  routes, every authored doorway transition, deterministic spawn repair, and
  multiplayer transition/cell isolation.
- `npm run world:tour` covers every authored space, all 17 route legs, and all
  34 start/door/target/spawner/schedule/container placements with no failed
  route or placement.
- Headless `ticks=9000 seed=42`: 121 ms, 74,380 ticks/sec, 9,958-byte save,
  and 20 living actors. The real two-client WebSocket smoke passes with ack
  sequence 30, 4.4 m authoritative movement, mutual visibility, and
  3,917 / 3,905-byte snapshots.
- Correct physical routes and prop footprints change the naive boss-bot
  pressure baseline without altering D-024 combat rules: solo 0/3, three
  players 2/3, and five players 2/3. Both intended group sizes still win; the
  mechanics-naive bot limitation remains KL-13.
- At the rotated smithy, the camera boom shortens from the requested 6 m to
  3.218 m before the wall. The mine entrance is a stable 19 m landing. Mine
  gallery walls retain their solid spans and expose only the authored narrow
  opening.
- Direct 1280x720 and true 1920x1080 CSS viewport checks passed. A clean
  direct page emitted no warning or error. The temporary scaled iframe
  retains the known browser-instrumentation `MutationObserver` artifact and
  does not ship.
- Approved captures:
  [smithy camera 1280x720](../screenshots/2026-07-31/plan-3-smithy-camera-1280x720.jpg),
  [mine walls 1280x720](../screenshots/2026-07-31/plan-3-mine-boundaries-1280x720.jpg),
  [mine landing 1280x720](../screenshots/2026-07-31/plan-3-mine-landing-1280x720.jpg),
  and [mine walls scaled 1920x1080](../screenshots/2026-07-31/plan-3-mine-boundaries-1920x1080-scaled.jpg).

## Repeatable scenario matrix

| Scenario | Purpose | Procedure / automation | Evidence |
|---|---|---|---|
| QA-GATE | Content, types, tests, production build | `npm run gate` | Suite/test counts and bundle output |
| QA-OFF-BOOT | Offline renderer and HUD bootstrap | `npm run dev`; open `/` | Console log, screenshot, visible HUD |
| QA-OFF-MENUS | Inventory, journal, perks | `Tab`, `J`, `P`; open and close each | Panel content, focus, input recovery |
| QA-OFF-TRAVERSE | Every authored route, space, and placement | `npm run world:tour`, then browser-check changed geometry | Route/placement report, clipping list, screenshots |
| QA-CMB-SMOKE | Melee, block, spells, damage, death | Falkmoor hostiles, then a mine pull | Inputs, outcomes, readable feedback |
| QA-SIM | Deterministic speed/save baseline | `npm run headless -- ticks=9000 seed=42` | JSON metrics |
| QA-BAL-BOSS | Party-size pressure baseline | `npm run mp:bench -- runs=3` | JSON summary |
| QA-NET-CORE | Server protocol/state correctness | `npm test -- tests/server_net.test.ts` | Snapshot, replay, persistence assertions |
| QA-NET-WS | Real adapter/two-client smoke | Terminal 1 `npm run server`; terminal 2 `npm run qa:ws` | Ack, movement, visibility, snapshot bytes |
| QA-NET-BROWSER | Actual online browser boot | Start server + dev; open query URL | Welcome/HUD, logs, remote visibility |
| QA-PST-RECONNECT | Character/world persistence | Join, mutate, disconnect, restart, rejoin | Restored character and world fields |

## Browser visual-QA procedure

For every visual or interaction change:

1. Record commit, browser, viewport, offline/online mode, and URL.
2. Start at Falkmoor Ruin with a fresh save or named QA character.
3. Capture boot, HUD, relevant panel, relevant action, and result states.
4. Repeat at 1280x720 and one larger desktop viewport.
5. Check legibility, clipping, focus recovery, pointer lock, camera occlusion,
   action feedback, and console warnings/errors.
6. Store approved evidence under `docs/screenshots/YYYY-MM-DD/` when the
   change itself is visual.

## Network-condition matrix

Plan 5 must lock and implement an in-repo impairment harness. Until then, use
the following standard profiles with the chosen external development proxy or
browser network emulator and record the mechanism:

| Profile | RTT | Jitter | Loss | Purpose |
|---|---:|---:|---:|---|
| Local | <5 ms | 0 | 0% | Functional baseline |
| Good WAN | 80 ms | 10 ms | 0% | Normal remote play |
| Degraded WAN | 150 ms | 30 ms | 1% | Reconciliation/readability |
| Severe | 250 ms | 50 ms | 3% | Failure behavior, not quality target |

For each profile record connection success, disconnects, input-to-authority
delay, correction distance, snapshot bytes/sec, and visible remote motion.
NET-001 currently blocks browser-profile execution beyond the handshake.

## Exit evidence for every later plan

- Reproduction added before the fix where practical.
- Locked acceptance checks pass in the relevant modes.
- No invariant or unrelated system was weakened.
- `npm run gate` passes.
- Browser evidence exists for visual/interaction changes.
- Real WebSocket evidence exists for online behavior changes.
