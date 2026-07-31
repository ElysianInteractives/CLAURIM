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
| NET-001 | NET | BLOCKER | ROOT_CAUSE | Browser online boot at `?ws=ws://127.0.0.1:8787&char=qa_alva` throws `InvalidStateError: WebSocket is still in CONNECTING`. `main.ts` constructs `ClientWorld` immediately; its constructor sends `hello` before the socket `open` event. The independent `qa:ws` client succeeds because it waits for `open`. | Plan 5 must lock the connection lifecycle and browser regression acceptance before changing behavior. |
| PST-001 | PST | BLOCKER before public release | REPRODUCED | `charId` is the identity token (KL-11); protocol tests confirm no separate account/session credential exists. | Plan 6 authentication design and threat model. |
| UX-001 | UX | S2 | REPRODUCED | At the 1280x720 offline baseline, the persistent help strip sits against the bottom edge, is very small, and competes with other HUD information. | Plan 1 must lock onboarding/help behavior and supported viewport criteria. |
| UX-002 | UX | S2 | REPRODUCED | Health, stamina, and magicka are presented as unlabeled color-only bars in the baseline HUD. | Plan 1 must lock resource readability and accessibility criteria. |
| FND-001 | FND | S2 risk | REPRODUCED | `src/sim/sim.ts` is 1,255 lines with 71 methods and coordinates spawning, player lifecycle, parties, tick phases, combat facades, interactions, sessions, and persistence. | No refactor without a demonstrated defect. Use `SIM_RESPONSIBILITY_MAP.md` when a later plan proposes a seam. |
| QLT-001 | QLT | S2 | VERIFIED | Browser QA previously had no repeatable baseline and KL-7 stated that browser inspection was unavailable. The offline/online procedure was completed at 1280x720 and recorded in `QA_BASELINE.md`. | Re-run the relevant browser scenarios for every visual, interaction, or online-browser change. |
| QLT-002 | QLT | S2 | VERIFIED | The sim import graph had no circular-dependency guard. The Plan 0 gate passes with a non-vacuous acyclic-graph assertion. | `tests/architecture.test.ts` must remain green and non-vacuous. |
| NET-002 | NET | S2 | VERIFIED | Snapshot growth had no budget tripwire. The Plan 0 gate passes with representative four-player mine snapshots peaking at 8,077 bytes. | `tests/server_net.test.ts` enforces `< 32,000` UTF-8 bytes. |
| QLT-003 | QLT/NET | S2 | REPRODUCED | No in-repo latency, jitter, or loss harness exists; current automated networking is localhost or in-memory. | Plan 5 must lock the impairment mechanism and acceptable envelopes. |
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
