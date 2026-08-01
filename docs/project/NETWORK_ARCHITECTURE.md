# Network architecture (D-014 / D-015)

## Topology
One dedicated, authoritative Node server (`src/server/`) owns THE `Sim`.
Browsers run `ClientWorld` (`src/net/client_world.ts`), an `IWorld`
implementation backed by server snapshots. Peer-to-peer is explicitly
rejected as a final architecture. The transport is WebSocket (`ws`), the one
browser-native full-duplex option with no additional dependency weight; the
server core is transport-agnostic (`ServerCore` + in-memory transport in
tests), so a different transport is an adapter, not a rewrite.

## Authority (updated meaning of "simulation-authoritative")
The SERVER sim resolves damage, healing, death/downed, loot, quest credit,
XP/skills, inventory, trade, enemy targeting/spawns, ownership, positions,
and persistent world changes. Clients submit INTENT only: per-tick movement/
bounded reticle-aim inputs and discrete commands. Clients never send positions,
projectile destinations, targets, hits, or damage. The client
predicts its own movement and presentation; nothing else.

## Protocol (v6, `src/net/protocol.ts`)
Versioned JSON messages, validated on receipt. Before authentication, clients
may send only register / login / resume; the server returns authOk / authError.
After authentication: hello / input / cmd / ping and welcome / reject /
snapshot / pong / bye. Protocol-version mismatch rejects at hello. No runtime
objects cross the wire; every payload is built from explicit view types.
Protocol v5 added authoritative fixed equipment-slot and two-slot spell-
loadout views plus validated equip/unequip commands. Protocol v6 adds the
compact equipped-item map to every replicated `ActorView` so remote
presentation follows authoritative loadouts; clients still submit intent only.

## Rates (measured 2026-07-31, in-sandbox smoke run)
- Sim tick: 30 Hz (unchanged, D-003).
- Input: one WireInput per tick per client (batched messages allowed, max 10).
- Snapshots: every 3 ticks = 10 Hz (`SNAPSHOT_EVERY`). Observed: 25 snapshots
  per client per 2.5 s with 2 clients.
- Snapshot size at slice scale: ~6-14 kB JSON (full self + interest actors);
  fine for the milestone. Delta compression is a bounded later optimization
  (OPUS/Fable backlog) - the snapshot is already interest-scoped.

## Interest management
Reuses the cell architecture (D-004): a client receives actors in ITS space,
and for exteriors only within the 5x5 active cell block around its character
(`isActiveAt`). Interiors replicate the whole space while occupied.
Projectiles/ground-AoEs replicate space-scoped. Events are filtered per
client (own progression/quests/items; same-space combat, chat, boss events;
party-wide downed/revive). Party members outside interest still appear in
the party frame via the self.party block, not as world actors.

## Prediction + reconciliation (D-015)
Inputs carry sequence numbers. The client predicts its own movement by
running the SAME deterministic `resolveMove` + terrain code the server runs.
Snapshots carry `ackSeq` for the highest input consumed by an authoritative
tick plus authoritative position; the client drops
acknowledged inputs, replays the unacknowledged tail from the server
position and replicated movement state, then blends (snap beyond 3 m, 40%
exponential correction under). Protocol v4 also replicates bounded aim pitch;
the local client presents its latest submitted pitch while authority consumes
the same sequenced intent for spell release.
Space transitions always snap; never lerp through a door. Remote actors use
exponential smoothing (0.35/frame) toward the latest snapshot. Combat is not
predicted beyond animation state.

## Connection lifecycle
register/login/resume -> issue/rotate opaque session -> authenticated hello ->
validate protocol/account ownership -> load-or-create owned character ->
welcome (seed, tick, snapshotEvery) -> snapshots. Disconnect persists and
despawns (linkdead policy). Reconnect resumes with a rotated session and
restores the owned character; a second connection from the same account for a
live character supersedes the first. Late join receives a full baseline.

The browser host never gives ClientWorld a transport until WebSocket `open`.
Unexpected loss clears pending intent, generation-guards the old socket, and
uses the bounded D-027 retry schedule. Supersession, authentication failure,
and protocol rejection are terminal until the user explicitly submits
credentials again; all lifecycle phases are visible in the HUD. Exact retry,
impairment, and acceptance rules are in `NETWORK_RELIABILITY_CONTRACT.md`.

## Security / trust boundary
All inputs are validated and clamped server-side; movement derives only from
intent and commands re-check gameplay legality. D-028 additionally puts
`AuthGateway` before `ServerCore`, uses salted scrypt credentials and rotating
opaque sessions, and restricts character selection to authenticated ownership.
Remote browser transport is secure and origin-allowlisted; credentials and
tokens never enter browser persistence or URLs. Exact controls and remaining
operations limits: `AUTHENTICATION_THREAT_MODEL.md`.
