// Dedicated server entry: ServerCore behind a WebSocket transport.
// Run: npm run server  (port 8787; CLAURIM_DATA_DIR overrides ./server_data)
// The wall clock only PACES the fixed tick here (host concern); gameplay time
// remains tick-based inside the sim.

import { WebSocketServer, WebSocket } from 'ws';
import { ServerCore } from './core';
import { FileStorage } from './storage';
import { DT } from '../sim/types';

const PORT = Number(process.env.CLAURIM_PORT ?? 8787);
const DATA_DIR = process.env.CLAURIM_DATA_DIR ?? './server_data';

const core = new ServerCore(new FileStorage(DATA_DIR));
const wss = new WebSocketServer({ port: PORT });

let nextConnId = 1;
const sockets = new Map<string, WebSocket>();

wss.on('connection', (ws) => {
  const connId = `c${nextConnId++}`;
  sockets.set(connId, ws);
  core.connect(connId, (msg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  });
  ws.on('message', (data) => {
    core.onMessage(connId, data.toString());
  });
  ws.on('close', () => {
    core.disconnect(connId);
    sockets.delete(connId);
  });
  ws.on('error', () => {
    core.disconnect(connId);
    sockets.delete(connId);
  });
});

// Fixed-step pacing with drift correction.
const tickMs = DT * 1000;
let last = Date.now();
let acc = 0;
const loop = setInterval(() => {
  const now = Date.now();
  acc += now - last;
  last = now;
  let steps = 0;
  while (acc >= tickMs && steps < 5) {
    core.tick();
    acc -= tickMs;
    steps++;
  }
  if (steps === 5) acc = 0; // shed backlog after a stall
}, tickMs / 2);

function shutdown(): void {
  clearInterval(loop);
  core.shutdown();
  for (const ws of sockets.values()) ws.close();
  wss.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[claurim] authoritative server on ws://localhost:${PORT} (data: ${DATA_DIR})`);
