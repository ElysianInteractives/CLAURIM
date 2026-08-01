// Real-WebSocket QA smoke. The in-memory server tests cover the authoritative
// core; this script verifies the ws adapter, two-client join, snapshots,
// acknowledged movement, and mutual visibility against a running server.
//
// Terminal 1: npm run server
// Terminal 2: npm run qa:ws
// Optional:   CLAURIM_WS_URL=ws://host:8787 npm run qa:ws

import WebSocket from 'ws';
import {
  PROTOCOL_VERSION,
  parseServerMessage,
  type AuthClientMessage,
  type ClientMessage,
  type ServerMessage,
  type WireInput,
} from '../src/net/protocol';

const url = process.env.CLAURIM_WS_URL ?? 'ws://127.0.0.1:8787';
const timeoutMs = Number(process.env.CLAURIM_QA_TIMEOUT_MS ?? 8_000);

class SmokeClient {
  readonly messages: ServerMessage[] = [];
  readonly socket: WebSocket;
  sessionToken = '';

  private constructor(
    public charId: string,
    readonly name: string,
    socket: WebSocket,
  ) {
    this.socket = socket;
    socket.on('message', (data) => {
      const message = parseServerMessage(String(data));
      if (message) this.messages.push(message);
    });
  }

  static async connect(username: string, name: string, password: string): Promise<SmokeClient> {
    const socket = await openSocket();
    const client = new SmokeClient(username, name, socket);
    client.send({ t: 'auth', mode: 'register', username, password, displayName: name });
    const authenticated = await client.waitFor('authOk');
    const character = authenticated.characters[0];
    if (!character) throw new Error(`${username}: account has no playable character`);
    client.charId = character.charId;
    client.sessionToken = authenticated.sessionToken;
    client.send({ t: 'hello', protocol: PROTOCOL_VERSION, charId: character.charId });
    return client;
  }

  static async resume(sessionToken: string, name: string): Promise<SmokeClient> {
    const client = new SmokeClient('resuming', name, await openSocket());
    client.send({ t: 'auth', mode: 'resume', sessionToken });
    const authenticated = await client.waitFor('authOk');
    const character = authenticated.characters[0];
    if (!character) throw new Error('resumed account has no playable character');
    client.charId = character.charId;
    client.sessionToken = authenticated.sessionToken;
    client.send({ t: 'hello', protocol: PROTOCOL_VERSION, charId: character.charId });
    return client;
  }

  static async expectReplayRejected(sessionToken: string): Promise<boolean> {
    const client = new SmokeClient('replay-probe', 'Replay probe', await openSocket());
    try {
      client.send({ t: 'auth', mode: 'resume', sessionToken });
      const error = await client.waitFor('authError');
      return error.code === 'invalid_session';
    } finally {
      client.close();
    }
  }

  send(message: ClientMessage | AuthClientMessage): void {
    this.socket.send(JSON.stringify(message));
  }

  async waitFor<T extends ServerMessage['t']>(
    type: T,
    predicate: (message: Extract<ServerMessage, { t: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { t: T }>> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      for (let index = this.messages.length - 1; index >= 0; index--) {
        const message = this.messages[index];
        if (message.t === type && predicate(message as Extract<ServerMessage, { t: T }>)) {
          return message as Extract<ServerMessage, { t: T }>;
        }
      }
      await delay(10);
    }
    throw new Error(`${this.charId}: timeout waiting for ${type}`);
  }

  close(): void {
    this.socket.close();
  }
}

async function openSocket(): Promise<WebSocket> {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout opening ${url}`)), timeoutMs);
    socket.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return socket;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function movementInput(seq: number): WireInput {
  return {
    seq,
    moveX: 0,
    moveZ: 1,
    yaw: 0,
    pitch: 0,
    sprint: false,
    sneak: false,
    block: false,
    jump: false,
  };
}

const runId = `${process.pid}_${Date.now().toString(36)}`;
const password = `QA smoke passphrase ${runId}`;
const alva = await SmokeClient.connect(`qa_${runId}_a`, 'QA Alva', password);
const brona = await SmokeClient.connect(`qa_${runId}_b`, 'QA Brona', password);
let resumedAlva: SmokeClient | null = null;

try {
  const [alvaWelcome, bronaWelcome] = await Promise.all([alva.waitFor('welcome'), brona.waitFor('welcome')]);
  const [alvaStart, bronaStart] = await Promise.all([alva.waitFor('snapshot'), brona.waitFor('snapshot')]);

  for (let seq = 1; seq <= 30; seq++) {
    alva.send({ t: 'input', inputs: [movementInput(seq)] });
    await delay(35);
  }

  const alvaMoved = await alva.waitFor('snapshot', (snapshot) => snapshot.ackSeq >= 30);
  const bronaSeesAlva = await brona.waitFor(
    'snapshot',
    (snapshot) => snapshot.actors.some((actor) => actor.id === alvaWelcome.entityId && actor.isRemotePlayer),
  );
  const movedMeters = alvaMoved.self.z - alvaStart.self.z;
  if (movedMeters <= 1) throw new Error(`authoritative movement too small: ${movedMeters.toFixed(2)}m`);
  if (alvaWelcome.entityId === bronaWelcome.entityId) throw new Error('clients received the same entity id');

  const sizes = [alvaMoved, bronaSeesAlva].map(
    (snapshot) => new TextEncoder().encode(JSON.stringify(snapshot)).byteLength,
  );
  const originalSession = alva.sessionToken;
  const originalCharacter = alva.charId;
  alva.close();
  resumedAlva = await SmokeClient.resume(originalSession, 'QA Alva');
  const resumedWelcome = await resumedAlva.waitFor('welcome');
  const replayRejected = await SmokeClient.expectReplayRejected(originalSession);
  if (resumedAlva.sessionToken === originalSession) throw new Error('resume did not rotate the session token');
  if (resumedWelcome.charId !== originalCharacter) throw new Error('resume changed character ownership');
  if (!replayRejected) throw new Error('consumed session token replay was not rejected');
  console.log(
    JSON.stringify(
      {
        url,
        clients: 2,
        movementAck: alvaMoved.ackSeq,
        movedMeters: +movedMeters.toFixed(2),
        mutualVisibility: bronaSeesAlva.actors.some(
          (actor) => actor.id === alvaWelcome.entityId && actor.isRemotePlayer,
        ),
        snapshotBytes: sizes,
        initialTicks: [alvaStart.tick, bronaStart.tick],
        sessionRotated: true,
        replayRejected,
        resumedCharacterPreserved: resumedWelcome.charId === originalCharacter,
      },
      null,
      2,
    ),
  );
} finally {
  alva.close();
  brona.close();
  resumedAlva?.close();
}
