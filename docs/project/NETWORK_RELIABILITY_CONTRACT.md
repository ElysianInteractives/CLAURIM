# Network reliability contract

Plan 5 locks the browser connection lifecycle, reconciliation acknowledgement
semantics, and the repeatable impairment gate. It does not add authentication,
change server authority, or promise production-scale deployment operations.

## Browser connection lifecycle

The browser host owns `BrowserConnection`; `ClientWorld` owns only one opened
protocol session at a time.

1. `connecting`: construct the WebSocket but send nothing.
2. `synchronizing`: after `open`, begin a fresh `ClientWorld` session and send
   exactly one `hello`.
3. `online`: enter only after `welcome` and a full baseline `snapshot`.
4. `reconnecting`: freeze the latest presentation state, reject new gameplay
   intent, clear unacknowledged inputs, and retry after 250, 500, 1,000, 2,000,
   then 4,000 ms.
5. `disconnected`: stop after the five-retry budget. A reload or the diagnostic
   retry hook starts a new budget.
6. `rejected`: protocol rejection and `session superseded` are terminal for
   that browser tab; they never start reconnect oscillation.

Every socket has a generation guard. Messages and close events from replaced
sockets are ignored. A reconnect starts sequence numbers at zero and waits for
a new full snapshot; commands and movement are never buffered across sessions.

The HUD always shows online connection state. Healthy sessions show the latest
input-to-authority acknowledgement delay; connecting, synchronizing, retry,
terminal rejection, and disconnected states remain visibly distinct.

## Reconciliation acknowledgement

`snapshot.ackSeq` means the highest input consumed by an authoritative
simulation tick, not merely accepted into the server queue. The server keeps a
separate highest-received sequence for replay rejection. The client drops only
the acknowledged prefix and replays the remaining ordered tail from the
snapshot position.

The server accepts at most 12 queued inputs. Once full, later inputs are
discarded rather than banking unlimited future movement; a later processed
sequence makes older discarded intent obsolete through the normal cumulative
acknowledgement.

## Deterministic impairment model

`npm run net:bench` runs real `ClientWorld` and `ServerCore` instances through
fixed-seed, virtual-time, ordered WebSocket links:

| Profile | RTT | Jitter | Loss | Target |
|---|---:|---:|---:|---|
| Local | 2 ms | 0 ms | 0% | Quality |
| Good WAN | 80 ms | 10 ms | 0% | Quality |
| Degraded WAN | 150 ms | 30 ms | 1% | Quality |
| Severe | 250 ms | 50 ms | 3% | Failure behavior only |

WebSocket/TCP ordering is preserved. Delay applies to every message. The loss
percentage drops only ephemeral input and full snapshot frames; `hello`,
`welcome`, rejection/close control, and discrete gameplay commands remain
reliable. This is deliberately harsher than TCP retransmission for transient
state while avoiding false command or identity loss.

`npm run net:proxy` applies the same profiles and seeds to a real WebSocket
relay for browser QA. Set `CLAURIM_NET_PROFILE`, `CLAURIM_PROXY_PORT`,
`CLAURIM_UPSTREAM_WS`, and optionally `CLAURIM_NET_SEED`.

## Locked acceptance

Every deterministic profile must:

- join both clients with zero transport disconnects;
- produce positive input-to-authority delay and snapshot throughput;
- move the authoritative player and expose more than 1 m of remote motion;
- drain the reconciliation tail to zero;
- keep finite correction below 3.5 m.

Local, Good WAN, and Degraded WAN additionally require p95 authority delay
below 650 ms and maximum correction below 2.5 m. Severe is evidence that
failure remains bounded and legible, not a play-quality promise.

Browser acceptance requires successful direct online boot with no
CONNECTING-state send, visible lifecycle status, automatic recovery within the
retry budget, terminal supersession behavior, no game warning/error under all
four profiles, and readable status at 1280x720 and 1920x1080.

The complete exit remains `npm run gate`, `npm run net:bench`, and a real
two-client `npm run qa:ws` smoke.
