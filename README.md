# Claurim

A browser-playable, third-person, server-authoritative multiplayer action
RPG: one deterministic TypeScript simulation, multiple hosts, code-authored
world. Research/fan project with a strict clean-room IP boundary (see
THIRD_PARTY_NOTICES.md).

## Play multiplayer (dev)
```
npm install
npm run server     # authoritative server on ws://localhost:8787
npm run dev        # client on http://localhost:5173
```
Open two browser tabs for two players:
`http://localhost:5173/?ws=ws://localhost:8787&char=alva&name=Alva`
`http://localhost:5173/?ws=ws://localhost:8787&char=brona&name=Brona`
Characters persist server-side (./server_data); Ctrl+C saves and shuts down.
Bring a party: Duskhollow Mine is tuned for 3-5 players and its Warden will
bury an unprepared solo hero.

## Play offline (single player)
```
npm run dev        # http://localhost:5173 (no query string)
```
Click the canvas to capture the mouse. WASD move, Shift sprint, C sneak,
Space jump, LMB attack, RMB block, 1 Flamebolt, 2 Mend Wounds, E interact,
Tab inventory, J journal, P perks, V first/third person, F5 save, F9 load.

Start at Falkmoor Ruin. The road north leads to Fenharrow; talk to Maera in
the inn ("The Fenharrow Hearth") to begin The Hollow Delve.

## Verify
```
npm run gate       # content gate + typecheck + all tests + production build
npm run headless   # scripted sim run without a renderer (-- ticks=9000)
```

## Repository guide
Engineering contract: `CLAUDE.md`. Project memory: `docs/project/`
(start with `MODEL_HANDOFF.md`). Locked architecture: `docs/project/DECISIONS.md`.
Task backlog: `docs/project/OPUS_BACKLOG.md`.
