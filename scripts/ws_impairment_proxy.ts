// Development WebSocket relay for browser Plan 5 QA.
// Example:
//   CLAURIM_NET_PROFILE=degraded npm run net:proxy
// Browser:
//   /?ws=ws://127.0.0.1:8790  (then authenticate in the browser gate)

import WebSocket, { WebSocketServer } from 'ws';
import { ImpairmentPolicy, networkProfile } from '../src/net/impairment';

const profile = networkProfile(process.env.CLAURIM_NET_PROFILE ?? 'degraded');
const port = Number(process.env.CLAURIM_PROXY_PORT ?? 8790);
const upstreamUrl = process.env.CLAURIM_UPSTREAM_WS ?? 'ws://127.0.0.1:8787';
const seed = Number(process.env.CLAURIM_NET_SEED ?? 5105);
const wss = new WebSocketServer({ port });
let nextConnection = 1;

wss.on('connection', (browser) => {
  const connectionId = nextConnection++;
  const upstream = new WebSocket(upstreamUrl);
  const c2s = new ImpairmentPolicy(profile, seed + connectionId * 101);
  const s2c = new ImpairmentPolicy(profile, seed + connectionId * 101 + 1);
  const pending: string[] = [];
  let droppedInputs = 0;
  let droppedSnapshots = 0;

  const relay = (
    policy: ImpairmentPolicy,
    json: string,
    droppable: boolean,
    destination: WebSocket,
    onDrop: () => void,
  ): void => {
    const plan = policy.plan(Date.now(), droppable);
    if (plan.dropped) {
      onDrop();
      return;
    }
    setTimeout(() => {
      if (destination.readyState === WebSocket.OPEN) destination.send(json);
    }, plan.delayMs);
  };

  browser.on('message', (data) => {
    const json = String(data);
    if (upstream.readyState !== WebSocket.OPEN) {
      pending.push(json);
      return;
    }
    relay(c2s, json, isType(json, 'input'), upstream, () => droppedInputs++);
  });

  upstream.on('open', () => {
    for (const json of pending.splice(0)) {
      relay(c2s, json, isType(json, 'input'), upstream, () => droppedInputs++);
    }
  });

  upstream.on('message', (data) => {
    const json = String(data);
    relay(s2c, json, isType(json, 'snapshot'), browser, () => droppedSnapshots++);
  });

  upstream.on('close', (code, reason) => {
    if (browser.readyState === WebSocket.OPEN) {
      const safeCode = validCloseCode(code) ? code : 1012;
      browser.close(safeCode, String(reason) || 'upstream closed');
    }
  });
  upstream.on('error', () => {
    if (browser.readyState === WebSocket.OPEN) browser.close(1011, 'upstream connection error');
  });
  browser.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close();
    console.log(
      `[net-proxy] connection=${connectionId} droppedInputs=${droppedInputs} droppedSnapshots=${droppedSnapshots}`,
    );
  });
});

function isType(json: string, type: string): boolean {
  try {
    return (JSON.parse(json) as { t?: unknown }).t === type;
  } catch {
    return false;
  }
}

function validCloseCode(code: number): boolean {
  return code >= 1_000 && code <= 4_999 && ![1_004, 1_005, 1_006, 1_015].includes(code);
}

function shutdown(): void {
  for (const client of wss.clients) client.close(1001, 'proxy shutting down');
  wss.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log(
  `[net-proxy] ws://127.0.0.1:${port} -> ${upstreamUrl} profile=${profile.name} ` +
    `rtt=${profile.rttMs}ms jitter=${profile.jitterMs}ms loss=${profile.loss * 100}% seed=${seed}`,
);
