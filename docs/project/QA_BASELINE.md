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

### Plan 7 social coordination exit

Plan 7 resolves SOC-001/SOC-002 and locks D-029 without adding matchmaking,
guild, trade, PvP, or dungeon-instancing scope.

- The exact short-path source gate is green at 15 suites / 155 tests and a
  643.52 kB JavaScript / 171.40 kB gzip production bundle. The
  focused additions cover solo starts; invite/accept/decline/leave constraints;
  persistence and v2->v3 migration; party-only revive/scaling; downed
  reconnect release; chat sanitation/throttle/replication; protocol target
  validation; and semantic HUD output.
- The real WebSocket smoke passes with two authenticated clients, ack 30,
  4.4 m authoritative movement, mutual visibility, rotating/replay-safe
  sessions, restored ownership, and 3,852 / 3,840-byte snapshots.
- Direct two-client 1280x720 browser QA creates two accounts, starts both
  solo, sends a nearby invite, displays private invite feedback, accepts into
  a 2/5 party, survives repeated disconnect/sign-in cycles, and delivers
  `Meet at the waystone.` to both notification feeds through Enter submit.
  The composer hides the controls card while focused and does not overlap the
  310x153 resource card.
- Browser QA reproduced and fixed per-frame HUD DOM replacement: interactive
  rows could detach between focus and click, and the original composer
  overlapped the resource/help cards. Stable interaction signatures plus
  semantic party/chat buttons make the final flow keyboard- and click-usable.
- A true 1920x1080 CSS viewport in the temporary 2/3-scale iframe harness has
  no document overflow. The party panel measures 466x317 px at `(727, 382)`,
  remains fully inside the viewport, and does not overlap the resource card
  at `(24, 903)`. The direct second-client log has no warning/error; the scaled
  harness retains the known instrumentation-only MutationObserver/pointer-lock
  errors and does not ship.

### Plan 8 content/progression exit

Plan 8 resolves CNT-001/PRG-001 and locks D-030. It adds content depth only
through proven schemas: twelve gear records, ten perks, two veteran variants,
and the second cave exemplar.

- The exact short-path source gate is green at 16 suites / 166 tests and a
  651.32 kB JavaScript / 172.62 kB gzip production bundle. Content validation
  reports 29 items, 6
  effects, 3 spells, 15 perks, 13 actor templates, 4 spaces, 22 props, 6
  doors, 16 spawners, 4 containers, 1 quest, and 3 dialogues; the IP scan is
  clean.
- `tests/content_catalog.test.ts` pins numeric envelopes, cross-catalog
  references, perk graph integrity, dialogue reachability, current-space
  naming, veteran ability shapes, one real modifier-chain path, and a
  deterministic prepared-solo Rimehowl Alpha clear. Maera's stock resolves
  all twelve new records and the quest/shop playthrough buys an Iron Axe.
- `npm run world:tour` passes all 4 authored spaces, 23 routes, and 43
  placements. Focused routes reach Siltroot's exterior entrance from the road
  and its brood chamber from the interior door; both door directions and every
  new encounter/cache anchor validate.
- The fixed-seed `ai:bench` preserves the intended dungeon envelope: solo
  parties clear 0/3 under both policies, while 3- and 5-player parties each
  clear 1/3. Current policy metrics are recorded in `ENCOUNTER_DESIGN.md`.
  The sustained combat baseline is unchanged.
- Headless `ticks=9000 seed=42` completes 13 game hours at 45,455 ticks/sec
  (198 ms), with 26 living actors and a 13,372-byte save.
- Direct 1280x720 browser QA confirms the Rimehowl cone/interrupt warning,
  Siltroot geometry/rat targeting, all 15 perks, all twelve stocked items,
  and an Iron Axe purchase reducing gold from 1,000 to 965. It also reproduced
  and fixed the hard-coded Kaldwyn HUD label; both offline and online hosts now
  resolve `Siltroot Burrow` through `IWorld.spaceName`.
- A true 1920x1080 Siltroot check has 1920x1080 document dimensions with no
  overflow. Final browser warning/error logs are empty.

### Plan 9 presentation/audio exit

Plan 9 resolves AV-001/AV-002/CMB-007 and locks D-031 without changing the
simulation, protocol, authoritative combat outcomes, or save schema.

- The exact short-path source gate is green at 17 suites / 173 tests and a
  658.33 kB JavaScript / 174.72 kB gzip production bundle (HTML 0.49 kB /
  0.32 kB gzip). Content validation remains 29 items, 6 effects, 3 spells,
  15 perks, 13 actor templates, 4 spaces, 22 props, 6 doors, 16 spawners,
  4 containers, 1 quest, and 3 dialogues; the IP scan is clean.
- `tests/presentation.test.ts` contributes seven focused checks for position/
  shortest-yaw interpolation, transition/teleport snaps, bounded audio
  settings, routed bus gains, deterministic soundscapes, accessible markup,
  focused Escape, and catalog-driven bow dispatch.
- Direct 1280x720 browser QA opens the Audio panel, changes Master to 60% and
  Ambience to 20%, toggles mute, reloads, and observes the same persisted
  values. Browser QA reproduced and fixed Escape being ignored while a range
  or checkbox held focus; focused Escape now closes the panel.
- At 1280x720 the 466x321.75 px panel is fully inside the viewport at
  `(407, 199.125)` with no document overflow. At 1920x1080 it remains
  466x321.75 px at `(727, 379.125)`, also with no overflow.
- Final browser warning/error logs are empty. The automation browser kept its
  Web Audio context suspended despite synthetic interaction, so audible
  loudness/asset quality remains an explicit human-review gate under KL-5;
  context construction and controls produced no runtime error.

### Plan 10 toolchain-security exit

Plan 10 resolves QLT-004 and locks D-032 without changing production
dependencies or application source.

- Baseline `npm audit` on Vite 5.4.21/Vitest 2.1.9 reproduced 5 development
  findings: 3 moderate, 1 high, and 1 critical. `npm audit --omit=dev` was
  clean.
- `package.json` now requires Node `^20.19.0 || >=22.12.0`, Vite `^8.2.0`,
  and Vitest `^4.1.10`; the lock resolves Vite 8.2.0, Vitest 4.1.10,
  Rolldown 1.2.1, and no `vite-node`. Production dependencies remain Three.js
  and `ws`.
- A clean real-short-path `npm ci` installs 66 packages and audits 67. Both
  `npm run audit:deps` and `npm run audit:prod` report zero vulnerabilities.
- The Node 26.0.0/npm 11.12.1 gate is green at 17 suites / 173 tests. Vite 8
  transforms 50 modules and produces 664.31 kB JavaScript / 174.60 kB gzip;
  HTML remains 0.49 kB / 0.32 kB gzip.
- `npm run standalone` produces `dist/claurim-standalone.html` at 649 kB.
  A Vite 8 dev-server smoke is ready in 210 ms and returns HTTP 200 for `/`,
  `/src/main.ts` as JavaScript, and `/@vite/client`.
- Vitest 4 mis-normalizes module-runner ids when launched from the root of the
  substituted `R:` test drive. The identical clean source passes from a real
  short path; D-032 records that qualification requirement.

### QA Phase A player-movement/recovery exit

QA Phase A resolves MOV-001, MOV-002, and WRL-005 and locks D-033. It does not
change combat balance, death penalties, the durable save schema, or authored
safe-point placement.

- The exact short-path gate is green at 18 suites / 184 tests. Vite 8
  transforms 52 modules and produces 666.86 kB JavaScript / 175.27 kB gzip;
  content validation and the IP scan remain clean.
- `tests/player_movement_recovery.test.ts` contributes nine focused checks for
  the shared camera-relative basis, authoritative and predicted left/right
  movement, final sprint exhaustion and restart threshold, stationary
  regeneration, resource-preserving recovery, cooldown, and hostile guards.
  `tests/server_net.test.ts` also covers the protocol-v3 movement snapshot and
  recovery command path.
- `npm run net:bench` connects every standard profile with zero disconnects
  and zero pending inputs. Maximum correction is 0 m Local/Good, 0.147 m
  Degraded, and 0.182 m Severe; p95 authority delay is 34.33/111.46/187.29/
  311.12 ms, with 19.95-21.56 m of remote and authority motion.
- Direct 1280x720 browser QA confirms a fully visible 640x457.75 px settings
  panel at `(320, 131.125)`, success feedback after returning to safe ground,
  and visible cooldown rejection after an immediate retry. At 1920x1080 the
  panel is 666x457.75 px at `(627, 311.125)`. Neither viewport has document
  overflow.
- Evidence is stored in `docs/screenshots/2026-07-31/qa-phase-a-settings-1280x720.png`,
  `qa-phase-a-post-recovery-1280x720.png`, and
  `qa-phase-a-settings-1920x1080.png`. No application warning or error was
  observed; the automation browser emitted six generic Chromium `UnknownError`
  diagnostics while synthetic key input was used.

### QA Phase B reticle-spell-aim exit

QA Phase B resolves CMB-008 and locks D-034. It changes player projectile-
spell direction only; melee, bows, NPC projectiles, self spells, damage,
obstruction, save state, inventory, and spell loadouts retain their existing
contracts.

- The failing reproduction first proved Flamebolt velocity remained at
  `y=0` for a positive reticle pitch and that the wire accepted pitch-less
  input. The final focused set pins normalized/clamped rays, exact 3D release
  velocity, required protocol-v4 input, authoritative server application,
  replicated aim state, and pitch-aware target-frame selection.
- The exact short-path gate is green at 19 suites / 189 tests. Vite 8
  transforms 53 modules and produces 667.46 kB JavaScript / 175.47 kB gzip;
  content validation and the IP scan remain clean.
- `npm run net:bench` connects every standard profile with zero disconnects
  and zero pending inputs. Maximum correction remains 0 m Local/Good,
  0.147 m Degraded, and 0.182 m Severe; p95 authority delay remains
  34.33/111.46/187.29/311.12 ms with 19.95-21.56 m of remote/authority
  motion.
- A real protocol-v4 WebSocket smoke connects two authenticated clients,
  acknowledges input 30, moves 4.4 m authoritatively, preserves mutual
  visibility, rotates sessions, rejects replay, and preserves the resumed
  character. Snapshots are 6,063 and 6,051 bytes.
- Direct offline browser QA at 1280x720 and 1920x1080 shows the centered
  reticle, the updated `Aim / cast spells` help, and authoritative cast cost
  reflected in magicka. The 1920x1080 canvas and document are exactly the
  viewport dimensions with no overflow; a clean rerun has no warning/error
  logs. The embedded automation surface denies pointer lock, so exact mouse-
  pitch trajectory is proven by deterministic sim/server tests rather than a
  synthetic mouse gesture.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-b-reticle-controls-1280x720.png` and
  `qa-phase-b-reticle-controls-1920x1080.png`.

### QA Phase C inventory/loadout exit

QA Phase C resolves INV-001/CMB-009 and locks D-035. It changes equipment
presentation, spell selection, and persistence while retaining all existing
item effects, spell content, combat timing, aim, collision, and damage rules.

- The failing reproduction proved the sim had no spell-loadout or item-
  unequip commands. Browser-host keys 1/2 were hard-coded to Flamebolt and
  Mend Wounds, and the inventory rendered one list with only an asterisk for
  equipped state.
- Focused tests pin two authoritative unique spell slots, known/authored
  validation, equipped-only casting, item unequip without removal, four-
  section inventory rendering, host hotkey lookup, protocol commands and
  snapshots, world v3->v4 migration, character v1->v2 migration, and save
  round trips.
- The full gate is green at 20 suites / 196 tests. Vite 8 transforms 56
  modules and produces 677.21 kB JavaScript / 177.86 kB gzip; content
  validation and the IP scan remain clean.
- `npm run net:bench` keeps every profile connected with zero disconnects and
  zero pending inputs. Maximum correction remains 0 m Local/Good, 0.147 m
  Degraded, and 0.182 m Severe; p95 authority delay remains 34.33/111.46/
  187.29/311.12 ms.
- A real protocol-v5 WebSocket smoke connects two authenticated clients,
  acknowledges input 30, moves 4.4 m, preserves mutual visibility, rotates
  sessions, rejects replay, and preserves the resumed character. Snapshots
  are 6,719 and 6,707 bytes.
- Direct offline browser QA at 1280x720 shows all six equipment slots, both
  spell slots, explicit known-spell assignment, and a carried-item list in a
  780x504 px panel at `(250, 108)`. Unequipping the dagger moves it into the
  carried list; re-equipping removes it from that list. Moving Mend Wounds to
  slot 1 clears its previous slot and updates the HUD quickbar immediately.
- A 1920x1080 CSS-layout check reports a 780x591.125 px panel at
  `(570, 244.4375)`. Both layouts have four sections and no horizontal or
  vertical document overflow. Browser warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-c-loadout-1280x720.png`.

### QA Phase D third-person camera exit

QA Phase D resolves CAM-001 and locks D-036. It changes only host camera
composition and local-body visibility; movement, aim intent, spell release,
collision authority, network protocol, and save formats remain unchanged.

- The failing reproduction proved that the third-person camera's direct
  `lookAt` on the player eye guaranteed model/reticle overlap.
- Focused tests pin a `0.9 m` shoulder separation, exact normalized ray parity
  at arbitrary yaw/pitch, whole-boom obstruction compression, retained
  clearance, and close-wall local-body hiding.
- The full gate is green at 21 suites / 199 tests. Vite 8 transforms 57
  modules and produces 677.70 kB JavaScript / 178.05 kB gzip; content
  validation and the IP scan remain clean.
- Direct offline browser QA at 1280x720 and 1920x1080 shows the player left of
  the centered reticle with an unobstructed forward view. At 1920x1080 the
  canvas and document exactly match the viewport and have no overflow.
  Browser warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-d-camera-1280x720.png` and
  `qa-phase-d-camera-1920x1080.png`.

### QA Phase E structure placement exit

QA Phase E resolves WRL-006/WRL-007 and locks D-037. Terrain operation order,
exterior structure presentation, door authoring, and development QA entry
points change; traversal authority, interaction outcomes, protocol v5, and
save formats remain unchanged.

- The failing reproduction measured the road re-carving the inn footprint by
  up to 2.04 m, house B by 1.38 m, and the well by 0.61 m across three seeds.
  The inn door also had no parent-relative position or render yaw.
- Focused tests pin flat 3x3 footprint samples for all six Fenharrow
  structures, resolved prop-relative entrance transforms, inherited render
  yaw, complete well rim/shaft geometry, and development-only named QA starts.
- `npm run world:tour` passes all 23 routes and 43 placements. The full gate
  is green at 22 suites / 203 tests. Vite 8 transforms 58 modules and produces
  679.50 kB JavaScript / 178.65 kB gzip; content and IP checks remain clean.
- Direct offline browser QA uses `?qa=fenharrow` and
  `?qa=fenharrow-door`. At 1280x720 the well is complete and the visible
  foundations meet one continuous pad; at 1280x720 and 1920x1080 the Hearth
  entrance is flush with the shell. The larger canvas/document exactly match
  the viewport, with no overflow or warning/error logs.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-e-fenharrow-1280x720.png`,
  `qa-phase-e-inn-door-1280x720.png`, and
  `qa-phase-e-inn-door-1920x1080.png`.

### QA Phase F NPC schedule stability exit

QA Phase F resolves AI-005/AV-003 and locks D-038. Scheduled/return movement,
transient brain recovery fields, renderer locomotion classification, and a
development QA clock point change; combat steering, authored schedules,
protocol v5, and save formats remain unchanged.

- The failing reproduction moved a disconnected-room NPC 2.916 m toward a
  provably unreachable goal in 30 ticks. Tiny 0.001 m frame corrections also
  activated the full procedural walk cycle.
- Focused tests pin no movement without a complete schedule route, 60-tick
  safe-home fallback and settlement, every authored consecutive schedule leg,
  and `0.18/0.08 m/s` presentation hysteresis. Existing active/offscreen door
  schedule and unreachable-return recovery tests remain green.
- `npm run world:tour` passes 23 routes / 43 placements. `npm run ai:bench`
  preserves the pressure boundary: solo 0/3 under both policies, naive
  three-player 1/3 at 191 s, and mechanics five-player 1/3 at 75 s. Full
  metrics are recorded in `ENCOUNTER_DESIGN.md`.
- The full gate is green at 23 suites / 206 tests. Vite 8 transforms 58
  modules and produces 680.68 kB JavaScript / 178.99 kB gzip; content and IP
  checks remain clean.
- Direct offline `?qa=inn-shift-change` browser QA captures the common room at
  20:59 and after the 21:00 schedule settles. NPCs are grounded/still after
  arrival at 1280x720 and 1920x1080; the larger canvas/document exactly match
  the viewport, with no overflow or warning/error logs.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-f-inn-before-shift-1280x720.png`,
  `qa-phase-f-inn-settled-1280x720.png`, and
  `qa-phase-f-inn-settled-1920x1080.png`.

### QA Phase G equipment presentation exit

QA Phase G resolves AV-004 and locks D-039. Render-facing equipment
replication, character attachment factories, combat pose selection, and the
first-person rig change; item effects, attack timing/outcomes, inventory
ownership, collision, and save formats remain unchanged.

- The failing reproduction proved the default dagger was absent from
  `ActorView`, no slot attachment synchronizer or first-person rig existed,
  and sword, axe, and bow windups could not select distinct poses.
- Focused tests pin offline and protocol-v6 actor equipment, all six visible
  gear families, removal after unequip, matching first-person main/off-hand
  state, and distinct sword/dagger, heavy, bow, spell, and block pose paths.
- The full gate is green at 24 suites / 210 tests. Vite 8 transforms 58
  modules and produces 685.15 kB JavaScript / 180.36 kB gzip; content and IP
  checks remain clean.
- `npm run net:bench` keeps all four profiles connected with zero
  disconnects and drains pending input to zero. Maximum correction remains
  0 m Local/Good, 0.147 m Degraded, and 0.182 m Severe. `npm run mp:bench`
  and all 23 routes / 43 placements in `npm run world:tour` also pass.
- A real protocol-v6 WebSocket smoke connects two authenticated clients,
  acknowledges input 30, moves 4.4 m, preserves mutual visibility, rotates
  sessions, rejects replay, and preserves the resumed character. Snapshots
  are 6,780 and 6,767 bytes.
- Direct development-only `?qa=gear` browser QA at 1280x720 and 1920x1080
  shows cuirass, hood, boots, mantle, sword, and shield on the world model,
  then the same sword/shield state on a lowered camera-local rig. The reticle
  and horizon remain clear at rest and browser warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-g-third-person-1280x720.png`,
  `qa-phase-g-first-person-1280x720.png`,
  `qa-phase-g-third-person-1920x1080.png`, and
  `qa-phase-g-first-person-1920x1080.png`.

### QA Phase H map/navigation exit

QA Phase H resolves UX-003 and locks D-040. Current-space map presentation,
the `M` menu command, and a session-local destination cue change; simulation
navigation, movement, quests, saves, snapshots, and protocol v6 remain
unchanged.

- The failing reproduction proved there was no map module, menu command,
  player marker, landmark/floor-plan view, or destination calculation.
- Focused tests pin the full Kaldwyn road and five authored destinations,
  exact five-room Duskhollow projection without exterior leakage, north/player
  heading, semantic selection state, and exact player-relative bearing plus
  straight-line distance.
- `npm run world:tour` passes all 23 routes and 43 placements. The full gate
  is green at 25 suites / 214 tests. Vite 8 transforms 59 modules and produces
  695.13 kB JavaScript / 183.26 kB gzip; content and IP checks remain clean.
- Direct `?qa=falkmoor` browser QA at 1280x720 and 1920x1080 keeps every road,
  label, marker, sidebar row, north arrow, coordinate, and player arrow inside
  the panel. Selecting Fenharrow closes the map and shows an accessible
  `568 m ahead` HUD cue. `?qa=mine` renders all five connected room shapes and
  the exit destination. Browser warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-h-map-1280x720.png`,
  `qa-phase-h-destination-1280x720.png`,
  `qa-phase-h-floorplan-1280x720.png`, and
  `qa-phase-h-map-1920x1080.png`.

### QA Phase I articulated-character exit

QA Phase I resolves AV-005 and locks D-041. Character geometry, joint
hierarchies, equipment attachment nodes, and renderer-only posing change;
actor collision, movement authority, attack timing/outcomes, protocol v6, and
save formats remain unchanged.

- The failing reproduction found six rigid humanoid cuboids with no elbows,
  hands, hips, knees, face, gait, torso motion, or head response, plus static
  quadruped legs/tail. Focused tests now require at least twenty humanoid mesh
  parts and every stable primary/secondary joint.
- Locomotion tests pin opposing legs, non-negative knee bend, and torso weight
  shift. Bow/block tests pin secondary forearm intent, and quadruped tests pin
  diagonal opposition plus tail motion. Existing D-038/D-039 pose, equipment,
  and first-person tests remain green.
- `npm run ai:bench` exactly preserves the renderer-independent comparison:
  naive three-player clears 1/3 at 191 s, mechanics five-player clears 1/3 at
  75 s, and both solo policies clear 0/3. The full gate is green at 26 suites /
  218 tests. Vite 8 transforms 59 modules and produces 699.03 kB JavaScript /
  184.56 kB gzip; content and IP checks remain clean.
- Direct browser QA uses `?qa=inn-shift-change` for an unarmored close-up,
  `?qa=gear` for the six-slot armored silhouette and inherited first-person
  hands, and `?qa=rig` for the quadruped encounter. Close and 1920 views show
  faceted head/hair/hands, tapered torso/limbs, shoulders, elbows, knees, and
  hand-following gear without reticle obstruction. Browser logs are clean.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-i-rig-close-1280x720.png`,
  `qa-phase-i-first-person-1280x720.png`, and
  `qa-phase-i-rig-1920x1080.png`.

### QA Phase J magic-progression exit

QA Phase J resolves MAG-001 and locks D-042. Fresh-character magic,
authoritative primer use, discipline metadata/progression, two new self
effects, protocol views/events, and loadout presentation change. Existing
known spells and explicit hotkey assignments remain save-compatible.

- Fresh characters have no known or equipped spells and reject arbitrary
  casts. Six merchant-stocked primers each consume exactly once to teach a
  spell; duplicates neither consume nor duplicate knowledge, and learning
  never auto-equips.
- Six spells cover original Ruinweaving, Mending, Stonebinding, and Veilcraft
  disciplines. Stoneward increases armor/physical resistance and trains
  alteration; Veilstep improves concealment and trains illusion. Older actor
  records gain both new skill keys at level 1 without losing existing values.
- Protocol v7 carries discipline labels and character-private learning
  events. The full local/good/degraded/severe network matrix remains within
  its locked bounds; the live two-client WebSocket smoke reports ack 30,
  4.4 m movement, mutual visibility, session/replay safety, and 6,743/6,730
  byte snapshots.
- `npm run gate` is green at 27 suites / 222 tests. Vite 8 transforms 59
  modules and produces 703.00 kB JavaScript / 185.59 kB gzip. Combat, AI,
  multiplayer, traversal, content validation, and originality gates pass.
- Direct `?qa=magic` browser QA starts with empty hotkeys and six visible
  Study actions, learns all spells into four grouped headings, manually
  assigns Stoneward/Veilstep, and casts Stoneward from key 1. Both supported
  desktop viewports pass and browser warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-j-disciplines-1280x720.png` and
  `qa-phase-j-disciplines-1920x1080.png`.

### QA Phase K world-expansion exit

QA Phase K resolves WRL-008 and locks D-043. It adds original Claurim world
volume without changing the region-streaming boundary or copying another
game's map, names, layout, stories, or encounters.

- Fenharrow gains three building shells. Thornmere Crossing adds five shells,
  a well, and three route-complete scheduled non-quest residents. Weeping
  Stones adds an exterior landmark, offering cache, and hostile encounter.
- Gloamroot Hollow adds a five-room enterable den, return path, loot cache,
  natural cavern materials, glowcap illumination, standard briarboars, and a
  veteran matriarch. Its doorway places the third-person camera inside the
  first room and faces progression rather than the exit.
- Ridge harts are visibly distinct, non-hostile, and roam deterministic
  bounded complete routes. Briarboars are hostile and use a separate tusked
  silhouette. Forest cells now attempt 90 deterministic tree placements with
  varied two-layer conifer crowns.
- Content v0.4 validates 36 items, 8 effects, 6 spells, 15 perks, 19 actor
  templates, 5 spaces, 42 props, 8 doors, 24 spawners, 6 containers, 1 quest,
  and 3 dialogues. The originality gate is clean.
- `npm run world:tour` passes all 5 spaces, 31 routes, and 69 placements.
  `npm run gate` is green at 28 suites / 228 tests; Vite 8 transforms 59
  modules and produces 713.64 kB JavaScript / 187.86 kB gzip. Combat, AI,
  multiplayer, and all four network profiles retain their locked results.
- The live two-client WebSocket smoke reports ack 30, 4.4 m movement, mutual
  visibility, session/replay safety, and 6,755/6,742-byte snapshots.
- Direct browser QA at 1280 covers Thornmere, harts, Weeping Stones, and the
  readable Gloamroot arrival. A 1920 pass shows all eight mapped destinations;
  warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-k-thornmere-1280x720.png`,
  `qa-phase-k-harts-1280x720.png`,
  `qa-phase-k-weeping-stones-1280x720.png`,
  `qa-phase-k-gloamroot-1280x720.png`, and
  `qa-phase-k-map-1920x1080.png`.

### QA Phase L narrative-expansion exit

QA Phase L resolves NAR-001 and locks D-044. It gives D-043's new residents
and places durable original narrative use without adding a bespoke quest
system or changing multiplayer ownership.

- `A Bitter Root` is acquired from Tamsin, discovers Gloamroot, clears its four
  briarboars and veteran matriarch, returns visibly to Tamsin, and grants
  personal gold/items/XP. `The Stone Toll` is acquired from Vael, investigates
  Weeping Stones, clears its sounder, and returns visibly for its own reward.
- Corren provides wildlife guidance and reacts to active/completed Gloamroot
  states. All three Thornmere residents retain their route-complete schedules.
- Dialogue now captures the matching entry node before emitting `talkedTo`.
  The conversation may complete the return objective and grant its reward, but
  still displays the authored turn-in scene selected from the pre-talk state.
- Content v0.5 validates 3 quests and 6 dialogues alongside Phase K's 36 items,
  8 effects, 6 spells, 15 perks, 19 actors, 5 spaces, 42 props, 8 doors, 24
  spawners, and 6 containers. All new prose passes the originality gate.
- Both new quests pass real acquisition, reach, combat credit, save/load,
  reward, journal, and conditional-dialogue tests. `The Hollow Delve` also
  pins its now-visible return scene.
- `npm run gate` is green at 29 suites / 232 tests. Vite 8 transforms 59
  modules and produces 722.80 kB JavaScript / 190.72 kB gzip. All five
  benchmark/traversal programs retain their locked results.
- Live WebSocket smoke reports ack 30, 4.4 m movement, mutual visibility,
  session/replay safety, preserved ownership, and 6,743/6,730-byte snapshots.
- Direct scheduled-position browser QA accepts `A Bitter Root` at 1280,
  verifies its journal objective, and accepts `The Stone Toll` at 1920.
  Warning/error logs are empty.
- Evidence is stored in
  `docs/screenshots/2026-08-01/qa-phase-l-bitter-root-accepted-1280x720.png`,
  `qa-phase-l-bitter-root-journal-1280x720.png`,
  `qa-phase-l-vael-dialogue-1920x1080.png`, and
  `qa-phase-l-stone-toll-accepted-1920x1080.png`.

### QA Phase M exterior-stability exit

QA Phase M resolves AV-006 and locks D-045. It removes the exterior
presentation regression without lowering D-043's authored world density or
changing any gameplay/network/save boundary.

- Before the repair, Falkmoor, Thornmere, Fenharrow, and Weeping Stones built
  380/1,162/2,038/1,751 mesh draw nodes and 81/409/699/586 unique geometries
  across their active 25 cells. Each conifer was three separate meshes and
  each crown owned a new geometry.
- The same checkpoints now build 56/128/189/163 draw nodes and 31/31/30/31
  unique geometries while retaining 355/1,134/2,013/1,726 decoration
  instances. All 90 deterministic placement attempts per cell remain.
- Fixed-step actor transforms are captured after every successful world step.
  A regression with two extra ticks before one rendered frame proves sampling
  uses tick 2 -> 3 rather than collapsing tick 1 -> 3.
- `npm run gate` is green at 29 suites / 234 tests. Vite 8 transforms 59
  modules and produces 727.31 kB JavaScript / 192.00 kB gzip.
- Direct 1280x720 browser checks cover Fenharrow, moving Thornmere residents,
  and Weeping Stones wildlife/buildings; warning/error logs are empty.

### QA Phase N high-fidelity-rendering exit

QA Phase N resolves AV-007 and locks D-046. It upgrades visible runtime model
quality inside explicit distance, socket, triangle, and draw-node contracts
without changing D-045 stability or any gameplay/network/save authority.

- The high player rig is 6,588 triangles versus 156 at medium detail and
  retains every humanoid rig/equipment node. High wolf/rat, hart, and boar
  models are 4,620, 4,796, and 4,704 triangles versus 108-188 at medium detail
  with identical required quadruped nodes.
- Building shells use 12,732-triangle close levels and 36-triangle distant
  levels at 55 m with 15 percent hysteresis. Actors use 20/26 m detail bands
  and 100/120 m presentation-cull bands; the local player remains high and
  visible at every distance.
- Near 3x3 terrain cells use high-detail instanced vegetation and the outer 16
  use medium geometry while all deterministic placements remain present.
  Terrain-only D-045 limits continue to pass.
- Complete populated Fenharrow, Thornmere, and Weeping Stones checkpoints
  measure 242/306/282 visible mesh nodes and 124,746/107,180/120,110 visible
  triangles, all below the locked 325/175,000 limits.
- `npm run gate` is green at 30 suites / 241 tests. Vite 8 transforms 67
  modules and produces 759.01 kB JavaScript / 200.07 kB gzip.
- `npm run world:tour` still passes all 5 spaces, 31 routes, and 69 placements.
  `npm run ai:bench` exactly preserves the renderer-independent comparison.
- Direct browser checks cover third- and first-person gear, near/far
  Thornmere structures, Thornmere wildlife, and Weeping Stones vegetation at
  desktop viewports; warning/error logs are empty.

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
| QA-SOC | Party consent/persistence and nearby chat | `tests/multiplayer_sim.test.ts`, `tests/server_net.test.ts`, `tests/save.test.ts`; two authenticated browser clients at 1280 and 1920 | Solo start, invite/accept/leave, reconnect/offline frame, chat focus/delivery, layout and logs |
| QA-CNT | Proven-schema content and progression depth | `tests/content_catalog.test.ts`, `tests/navigation.test.ts`, `tests/quest_playthrough.test.ts`, `npm run world:tour`, `npm run ai:bench`; offline browser at 1280 and 1920 | Catalog links/envelopes, perk graph/hook, veteran shape/solo envelope, merchant purchase, all-space traversal, current location, layout and logs |
| QA-AV | Host interpolation and browser audio/control boundary | `tests/presentation.test.ts`, `tests/combat_audio.test.ts`, `npm run gate`; offline browser at 1280 and 1920 | Transform blend/snap/yaw, catalog bow dispatch, mixer/settings/soundscape rules, persistence, focused Escape, layout/overflow, browser logs |
| QA-DEP | Toolchain advisories and major-version compatibility | clean `npm ci`; `npm run audit:deps`; `npm run audit:prod`; `npm run gate`; `npm run standalone`; dev-server HTTP smoke | zero full/prod findings, valid lock tree, all tests, Vite production output, standalone output, transformed dev modules |
| QA-MOV | Camera-relative movement, sprint exhaustion, and safe-ground recovery | `tests/player_movement_recovery.test.ts`, `tests/server_net.test.ts`, `npm run net:bench`; offline browser at 1280 and 1920 | shared authority/prediction basis, exhaustion/restart/regen rules, recovery guards/cooldown, network correction bounds, feedback, layout/overflow, browser logs |
| QA-AIM | Center-reticle projectile-spell trajectory | `tests/spell_reticle_aim.test.ts`, `tests/server_net.test.ts`, `tests/hud.test.ts`, `npm run net:bench`, `npm run qa:ws`; offline browser at 1280 and 1920 | bounded normalized ray, protocol validation, 3D release velocity, authority/replication, target selection, cast feedback, layout/overflow, browser logs |
| QA-LOADOUT | Item equipment and spell hotkey loadout | `tests/player_loadout.test.ts`, `tests/save.test.ts`, `tests/server_net.test.ts`, `tests/presentation.test.ts`, `npm run net:bench`, `npm run qa:ws`; offline browser at 1280 and 1920 | fixed item slots, separate carried list, unique known-spell assignment, equipped-only cast, persistence/migrations, protocol replication, quickbar, layout/overflow/logs |
| QA-CAM | Third-person reticle visibility and camera obstruction | `tests/camera_reticle.test.ts`, `tests/spell_reticle_aim.test.ts`, `npm run gate`; offline browser at 1280 and 1920 | shoulder separation, exact aim-ray parity, whole-boom collision compression, close-wall body hiding, centered clear reticle, layout/overflow/logs |
| QA-STRUCT | Terrain pads, foundations, prop completeness, and anchored entrances | `tests/world_structure_placement.test.ts`, `tests/world_traversal.test.ts`, `tests/navigation.test.ts`, `npm run world:tour`, `npm run gate`; development-only offline `?qa=fenharrow` and `?qa=fenharrow-door` at 1280 and 1920 | multi-seed footprint flatness, shared terrain, complete grounded meshes, resolved anchor/yaw, door endpoint reachability, layout/overflow/logs |
| QA-NPC | Scheduled NPC reachability, blocked recovery, and pose stability | `tests/npc_schedule_stability.test.ts`, `tests/ai_encounter_reliability.test.ts`, `tests/world_traversal.test.ts`, `npm run world:tour`, `npm run ai:bench`, `npm run gate`; development-only offline `?qa=inn-shift-change` at 1280 and 1920 | exact-route requirement, no wall sliding, safe-home fallback, all authored legs, combat-scope benchmark, locomotion dead zone/hysteresis, before/settled shift, layout/overflow/logs |
| QA-GEAR | Authoritative equipped-item and combat-pose presentation | `tests/equipment_presentation.test.ts`, `tests/server_net.test.ts`, `npm run net:bench`, `npm run mp:bench`, `npm run world:tour`, `npm run qa:ws`, `npm run gate`; development-only offline `?qa=gear` in third/first person at 1280 and 1920 | local/remote equipped ids, six world gear families, synchronized first-person hands, weapon-specific phases, clear reticle/horizon, layout/overflow/logs |
| QA-MAP | Current-space map and destination guidance | `tests/world_map.test.ts`, `npm run world:tour`, `npm run gate`; development-only `?qa=falkmoor` and `?qa=mine` at 1280 plus exterior at 1920 | road/five destinations, exact rooms/exit, player yaw marker, semantic selection, relative bearing/distance, clipping/overflow/logs |
| QA-RIG | Articulated character detail and full-body posing | `tests/character_rig.test.ts`, `tests/equipment_presentation.test.ts`, `tests/presentation.test.ts`, `npm run ai:bench`, `npm run gate`; development-only `?qa=inn-shift-change`, `?qa=gear`, and `?qa=rig` at 1280/1920 | stable joints/mesh detail, leg/knee/torso gait, secondary combat joints, quadruped gait/tail, hand-following gear, first-person framing/logs |
| QA-MAGIC | Magic initiation, disciplines, and persistent loadout | `tests/magic_progression.test.ts`, `tests/player_loadout.test.ts`, `tests/save.test.ts`, `tests/server_net.test.ts`, `npm run combat:bench`, `npm run net:bench`, `npm run qa:ws`, `npm run gate`; development-only `?qa=magic` at 1280/1920 | empty fresh state, atomic primer study/duplicate safety, four schools, ward/veil effects and skill XP, legacy save normalization, private protocol state, manual equip/cast, responsive layout/logs |
| QA-WORLD-EXPANSION | Original settlement, landmark, den, forest, and wildlife volume | `tests/world_content_expansion.test.ts`, `tests/world_map.test.ts`, `tests/world_traversal.test.ts`, `npm run world:tour`, all benchmarks, `npm run qa:ws`, `npm run gate`; development-only `?qa=thornmere`, `?qa=thornmere-harts`, `?qa=weeping-stones`, and `?qa=gloamroot` at 1280 plus map at 1920 | shared terrain pads, route-complete locations/schedules, cavern arrival/readability, ambient/hostile wildlife behavior and silhouettes, eight destinations, content/IP validation, layout/overflow/logs |
| QA-NARRATIVE | Original Thornmere dialogue, Gloamroot/Weeping Stones side quests, and visible turn-ins | `tests/world_narrative_expansion.test.ts`, `tests/quest_playthrough.test.ts`, `tests/content_catalog.test.ts`, `tests/save.test.ts`, all benchmarks, `npm run qa:ws`, `npm run gate`; development-only `?qa=thornmere-tamsin` at 1280 and `?qa=thornmere-vael` at 1920 | dialogue acquisition/branches, reach/kill/talk progression, per-character reward, save/load, pre-credit return entry, journal, conditional reactions, originality, responsive layout/logs |
| QA-EXTERIOR-STABILITY | Dense exterior draw submission and adjacent-tick presentation | `tests/world_content_expansion.test.ts`, `tests/presentation.test.ts`, `npm run gate`; development-only `?qa=fenharrow`, `?qa=thornmere`, and `?qa=weeping-stones` | <=300 terrain draw nodes, <=40 unique geometries, retained decoration density, multi-tick history, visible residents/wildlife/buildings, browser logs |
| QA-HIGH-FIDELITY | Bounded close detail, stable LOD/socket transitions, and populated exterior cost | `tests/model_fidelity.test.ts`, `tests/character_rig.test.ts`, `tests/equipment_presentation.test.ts`, `tests/world_content_expansion.test.ts`, `npm run ai:bench`, `npm run world:tour`, `npm run gate`; development-only `?qa=gear`, `?qa=thornmere-harts`, `?qa=thornmere-tamsin`, and `?qa=weeping-stones` | high/medium triangle ratios and socket parity, LOD/cull hysteresis, asset validation seam, <=325 populated mesh nodes, <=175,000 visible triangles, first-/third-person equipment, close/far buildings, wildlife/vegetation, browser logs |

## Browser visual-QA procedure

For every visual or interaction change:

1. Record commit, browser, viewport, offline/online mode, and URL.
2. Start at Falkmoor Ruin with a fresh save or named QA character.
   Development builds may instead use a documented named `?qa=` point when
   the changed presentation is far from Falkmoor; production and online modes
   ignore these points.
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
