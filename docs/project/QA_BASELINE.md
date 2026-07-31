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

### Plan 4 AI/encounter reliability exit

- Exact short-path source copy: `npm run gate` green; 12 suites / 118 tests.
  Production bundle: 616.52 kB JavaScript / 163.85 kB gzip.
- The 13-test Plan 4 suite pins wall-aware perception, visible target
  continuity, shared multi-spawner pulls/scaling, useful support heals,
  cooldown progress during telegraphs, a four-summon cap, owned
  projectile/pool/summon cleanup, defeated-member restoration, observed and
  offscreen door schedules, and disconnected-home return recovery.
- `npm run ai:bench` compares the same three seeds under named naïve and
  mechanics policies. Solo remains 0/3 for both. At three players mechanics
  reduces damage from 5,467.0 to 4,714.2 and downs from 79 to 65, with a 57 s
  clear versus 80 s. At five it reduces damage from 11,593.2 to 8,108.5 and
  downs from 180 to 99, and earns 1/3 clears versus 0/3.
- Direct 1280x720 browser observation confirms the Mire Matron’s interruptible
  heal ring/notice on an injured allied rat; the five-member Warden view shows
  the exact cone, party frames, and four living summoned adds after three
  forced casts; and Brandvar is interactable by name in the inn at 20:00 after
  offscreen schedule advancement.
- The direct encounter page logs only Vite connection diagnostics, with no
  game warning/error. The temporary 1920x1080 scaled iframe preserves layout
  and reproduces the known browser-instrumentation `MutationObserver` artifact;
  neither query fixture nor iframe ships.
- `npm run world:tour` retains all 17 routes and 34 placements. Headless
  `ticks=9000 seed=42` records 124 ms / 72,581 ticks/sec, 9,958-byte save,
  and 20 living actors. The real two-client WebSocket smoke passes at ack 30,
  4.4 m movement, mutual visibility, and 3,930 / 3,918-byte snapshots.
- Approved captures:
  [Matron heal 1280x720](../screenshots/2026-07-31/plan-4-matron-heal-1280x720.png),
  [Warden party/adds 1280x720](../screenshots/2026-07-31/plan-4-warden-party-1280x720.png),
  [Brandvar schedule 1280x720](../screenshots/2026-07-31/plan-4-brandvar-schedule-1280x720.png),
  and [Warden scaled 1920x1080](../screenshots/2026-07-31/plan-4-warden-party-1920x1080-scaled.png).

### Plan 5 network/browser reliability exit

- Exact short-path source copy: `npm run gate` green; 14 suites / 128 tests.
  Production bundle: 623.80 kB JavaScript / 165.88 kB gzip.
- Focused tests reproduce and pin the CONNECTING-state handshake, one hello
  per opened session, disconnected command suppression, stale-socket
  isolation, bounded retries, terminal session supersession, authoritative
  tick acknowledgement, deterministic ordered impairment, and all four
  network profiles.
- `npm run net:bench` results:

| Profile | Connected / disconnects | p95 authority | Max correction | Snapshot bytes/s | Remote motion | Dropped input / snapshots |
|---|---:|---:|---:|---:|---:|---:|
| Local | yes / 0 | 34.3 ms | 0.000 m | 38,753 | 21.56 m | 0 / 0 |
| Good WAN | yes / 0 | 111.5 ms | 0.000 m | 38,474 | 21.41 m | 0 / 0 |
| Degraded WAN | yes / 0 | 187.3 ms | 0.147 m | 37,932 | 21.12 m | 5 / 2 |
| Severe | yes / 0 | 311.1 ms | 0.182 m | 37,351 | 19.95 m | 11 / 2 |

  Every run drains pending inputs to zero. Severe remains a bounded-failure
  profile rather than a quality target.
- The in-repo real WebSocket relay boots the browser under Local, Good,
  Degraded, and Severe profiles. Observed healthy badges were Local `Online`,
  Good approximately 200 ms, Degraded 199-221 ms, and Severe 306-355 ms
  authority delay, with no inspected browser warning/error.
- A short Degraded relay outage visibly reached `retry 3/5` and recovered to
  `Online` within the retry budget. Opening the same character in a second tab
  left the new tab online and the old tab terminal at `session superseded`,
  without reconnect oscillation.
- Direct 1280x720 and 1920x1080 checks keep the status badge legible and inside
  the top edge; at 1920 it measured 205x26 px at `(857, 16)`.
- Headless `ticks=9000 seed=42`: 136 ms / 66,176 ticks/sec, 9,958-byte save,
  and 20 living actors. The real two-client WebSocket smoke passes at ack 30,
  4.4 m movement, mutual visibility, and 3,929 / 3,917-byte snapshots.
- Approved captures:
  [Local online 1280x720](../screenshots/2026-07-31/plan-5-online-local-1280x720.png),
  [Degraded online 1280x720](../screenshots/2026-07-31/plan-5-online-degraded-1280x720.png),
  [visible reconnect 1280x720](../screenshots/2026-07-31/plan-5-reconnecting-1280x720.png),
  [terminal supersession 1280x720](../screenshots/2026-07-31/plan-5-session-superseded-1280x720.png),
  and [Severe online 1920x1080](../screenshots/2026-07-31/plan-5-online-severe-1920x1080.png).

### Plan 6 authentication/ownership exit

- Exact short-path source copy: `npm run gate` green; 15 suites / 144 tests.
  Production bundle: 633.27 kB JavaScript / 168.56 kB gzip.
- The 13-test authentication suite starts from the reproduced unauthenticated
  core/character-claim boundary and pins production scrypt cost/salt/key size,
  plaintext-free restart persistence, generic failures and dummy verification,
  account/source throttling, digest-only rotating sessions, expiry/restart
  invalidation, replay rejection, ownership, transport, proxy-source, and
  browser-origin policy. Browser lifecycle tests additionally pin
  authenticate-before-hello, memory-only resume, terminal failure, explicit
  restart, and rejected-credential disposal.
- The real WebSocket adapter creates two accounts, moves one character 4.4 m
  through ack 30, confirms mutual visibility, rotates a session on resume,
  rejects the consumed token, and preserves the owned character. Snapshots are
  3,928 / 3,915 bytes. The resulting two-account `auth.json` contains scrypt
  `N=131072` / 64-byte-key records and no QA password text.
- `npm run net:bench` retains every D-027 envelope under protocol v2: all four
  profiles connect with zero disconnects and zero pending tail; p95 authority
  remains 34.3 / 111.5 / 187.3 / 311.1 ms and maximum correction remains
  0 / 0 / 0.147 / 0.182 m.
- Direct 1280x720 browser QA caught and fixed a hidden-field CSS override and
  rejected-password retention. The final sign-in card is centered at 430x444
  px with no page scroll. Account creation enters the authoritative world;
  reload returns to sign-in; wrong login is generic and clears the password;
  correct login restores the character; remote plaintext `ws://` is refused.
- At 1920x1080 the authenticated status is 198x26 px at `(861, 16)` and the
  document has no overflow. Browser diagnostics contain no warning/error.
- Approved captures:
  [authentication gate 1280x720](../screenshots/2026-07-31/plan-6-auth-gate-1280x720.png)
  and [authenticated world 1920x1080](../screenshots/2026-07-31/plan-6-authenticated-1920x1080.png).

## Repeatable scenario matrix

| Scenario | Purpose | Procedure / automation | Evidence |
|---|---|---|---|
| QA-GATE | Content, types, tests, production build | `npm run gate` | Suite/test counts and bundle output |
| QA-OFF-BOOT | Offline renderer and HUD bootstrap | `npm run dev`; open `/` | Console log, screenshot, visible HUD |
| QA-OFF-MENUS | Inventory, journal, perks | `Tab`, `J`, `P`; open and close each | Panel content, focus, input recovery |
| QA-OFF-TRAVERSE | Every authored route, space, and placement | `npm run world:tour`, then browser-check changed geometry | Route/placement report, clipping list, screenshots |
| QA-CMB-SMOKE | Melee, block, spells, damage, death | Falkmoor hostiles, then a mine pull | Inputs, outcomes, readable feedback |
| QA-SIM | Deterministic speed/save baseline | `npm run headless -- ticks=9000 seed=42` | JSON metrics |
| QA-BAL-BOSS | Party-size pressure baseline | `npm run ai:bench` (comparison) or `npm run mp:bench -- runs=3 policy=mechanics` | JSON summary |
| QA-NET-CORE | Server protocol/state correctness | `npm test -- tests/server_net.test.ts` | Snapshot, replay, persistence assertions |
| QA-NET-WS | Real adapter/two-client smoke | Terminal 1 `npm run server`; terminal 2 `npm run qa:ws` | Ack, movement, visibility, snapshot bytes |
| QA-NET-BROWSER | Actual online browser boot/lifecycle | Start server + dev; open query URL directly and through `net:proxy` | Status HUD, logs, reconnect/supersession |
| QA-NET-MATRIX | Prediction under locked network profiles | `npm run net:bench` | Delay, correction, throughput, loss, remote motion |
| QA-PST-RECONNECT | Character/world persistence | Join, mutate, disconnect, restart, rejoin | Restored character and world fields |
| QA-AUTH | Account/session/ownership and secure browser boundary | `tests/authentication.test.ts`, real `qa:ws`, create/login/reload/insecure-URL browser flow | Hash/session/ownership assertions, rotation/replay result, sign-in captures and logs |

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

Plan 5 locks the following profiles. `npm run net:bench` is the deterministic
gate; `npm run net:proxy` applies the same ordered fixed-seed policy to a real
WebSocket relay for browser checks:

| Profile | RTT | Jitter | Loss | Purpose |
|---|---:|---:|---:|---|
| Local | <5 ms | 0 | 0% | Functional baseline |
| Good WAN | 80 ms | 10 ms | 0% | Normal remote play |
| Degraded WAN | 150 ms | 30 ms | 1% | Reconciliation/readability |
| Severe | 250 ms | 50 ms | 3% | Failure behavior, not quality target |

For each profile record connection success, disconnects, input-to-authority
delay, correction distance, snapshot bytes/sec, and visible remote motion.
See `NETWORK_RELIABILITY_CONTRACT.md` for loss semantics and locked bounds.

## Exit evidence for every later plan

- Reproduction added before the fix where practical.
- Locked acceptance checks pass in the relevant modes.
- No invariant or unrelated system was weakened.
- `npm run gate` passes.
- Browser evidence exists for visual/interaction changes.
- Real WebSocket evidence exists for online behavior changes.
