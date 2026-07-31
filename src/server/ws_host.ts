// Dedicated server entry: ServerCore behind a WebSocket transport.
// Run: npm run server  (port 8787; CLAURIM_DATA_DIR overrides ./server_data)
// The wall clock only PACES the fixed tick here (host concern); gameplay time
// remains tick-based inside the sim.

import { WebSocketServer, WebSocket } from 'ws';
import { ServerCore } from './core';
import { FileStorage } from './storage';
import { AuthService } from './auth';
import { AuthGateway } from './auth_gateway';
import { browserOriginAllowed, secureTransportAllowed, sourceAddress } from './transport_security';
import { DT } from '../sim/types';

const PORT = Number(process.env.CLAURIM_PORT ?? 8787);
const DATA_DIR = process.env.CLAURIM_DATA_DIR ?? './server_data';
const TRUST_PROXY = process.env.CLAURIM_TRUST_PROXY === '1';
const ALLOWED_ORIGINS = new Set(
  (process.env.CLAURIM_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
);

const storage = new FileStorage(DATA_DIR);
const core = new ServerCore(storage);
const gateway = new AuthGateway(core, new AuthService(storage));
const wss = new WebSocketServer({ port: PORT, maxPayload: 8_192 });

let nextConnId = 1;
const sockets = new Map<string, WebSocket>();

wss.on('connection', (ws, request) => {
  const encrypted = Boolean((request.socket as { encrypted?: boolean }).encrypted);
  const forwardedProto = request.headers['x-forwarded-proto'];
  if (!secureTransportAllowed({
    remoteAddress: request.socket.remoteAddress,
    encrypted,
    forwardedProto: Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto,
    trustProxy: TRUST_PROXY,
  })) {
    ws.close(1008, 'secure transport required');
    return;
  }
  if (!browserOriginAllowed(request.headers.origin, request.socket.remoteAddress, ALLOWED_ORIGINS)) {
    ws.close(1008, 'origin not allowed');
    return;
  }
  const connId = `c${nextConnId++}`;
  sockets.set(connId, ws);
  gateway.connect(connId, sourceAddress(
    request.socket.remoteAddress,
    request.headers['x-forwarded-for'],
    TRUST_PROXY,
  ), (msg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  });
  ws.on('message', (data) => {
    void gateway.onMessage(connId, data.toString()).catch(() => ws.close(1011, 'authentication unavailable'));
  });
  ws.on('close', () => {
    gateway.disconnect(connId);
    sockets.delete(connId);
  });
  ws.on('error', () => {
    gateway.disconnect(connId);
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
  gateway.shutdown();
  for (const ws of sockets.values()) ws.close();
  wss.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`[claurim] authoritative server on ws://localhost:${PORT} (data: ${DATA_DIR})`);
