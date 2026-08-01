# Claurim

A browser-playable, third-person, server-authoritative multiplayer action
RPG: one deterministic TypeScript simulation, multiple hosts, code-authored
world. Research/fan project with a strict clean-room IP boundary (see
THIRD_PARTY_NOTICES.md).

Development requires Node `^20.19.0 || >=22.12.0`; use `npm ci` for the
committed toolchain graph.

## Play multiplayer (dev)
```
npm ci
npm run server     # authoritative server on ws://localhost:8787
npm run dev        # client on http://localhost:5173
```
Open `http://localhost:5173/?ws=ws://localhost:8787`, create an account, and
sign in. Open another tab and create a second account for a second player.
Credentials never enter the URL; accounts and characters persist server-side
(`./server_data`) while short-lived sessions remain memory-only. Ctrl+C saves
and shuts down.

Remote deployments must use `wss://`, set `CLAURIM_ALLOWED_ORIGINS` to the
exact browser origin(s), and set `CLAURIM_TRUST_PROXY=1` only behind a trusted
TLS reverse proxy. See `docs/project/AUTHENTICATION_THREAT_MODEL.md`.
Bring a party: Duskhollow Mine is tuned for 3-5 players and its Warden will
bury an unprepared solo hero. Press `O` near another player to invite them;
press `Enter` to send nearby chat.

## Play offline (single player)
```
npm run dev        # http://localhost:5173 (no query string)
```
Click the canvas to capture the mouse. WASD move, Shift sprint, C sneak,
Space jump, LMB attack, RMB block, 1 Flamebolt, 2 Mend Wounds, E interact,
Tab inventory, J journal, P perks, O party, Enter nearby chat, H controls,
V first/third person, F5 save, F9 load, Esc game settings/close. Game Settings
also provides a combat-guarded Return to Safe Ground action for terrain traps.

Start at Falkmoor Ruin. The road north leads to Fenharrow; talk to Maera in
the inn ("The Fenharrow Hearth") to begin The Hollow Delve. Siltroot Burrow
opens near the river bend, while Maera stocks the expanded iron, hide, and fur
equipment catalog.
The browser host smooths 30 Hz actor motion for display and provides
persistent master/effects/ambience/music controls with mute. Its current
soundscapes are procedural tonal exemplars rather than final audio assets.

## Verify
```
npm run gate       # content gate + typecheck + all tests + production build
npm run headless   # scripted sim run without a renderer (-- ticks=9000)
npm run combat:bench -- seconds=30  # sustained weapon/spell comparison
npm run mp:bench -- runs=3          # party-size boss pressure benchmark
npm run ai:bench                    # naive vs mechanics-aware AI comparison
npm run world:tour                  # deterministic routes/placements audit
npm run audit:deps                  # full dependency advisory check
npm run audit:prod                  # production-only advisory check
```

## Repository guide
Engineering contract: `CLAUDE.md`. Project memory: `docs/project/`
(start with `MODEL_HANDOFF.md`). Locked architecture: `docs/project/DECISIONS.md`.
Improvement evidence: `docs/project/DEFICIT_REGISTER.md` and
`docs/project/QA_BASELINE.md`. Task backlog: `docs/project/OPUS_BACKLOG.md`.
