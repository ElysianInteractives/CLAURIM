import { describe, expect, it } from 'vitest';
import {
  BrowserConnection,
  type BrowserSocket,
  type ConnectionStatus,
  type RetryScheduler,
  type SessionClient,
} from '../src/net/browser_connection';
import { ClientWorld, type ClientTransport } from '../src/net/client_world';
import { AuthenticatedClientSession } from '../src/net/authenticated_session';
import { parseServerMessage, type ServerMessage } from '../src/net/protocol';

type SocketEvent = 'open' | 'message' | 'close' | 'error';

class FakeSocket implements BrowserSocket {
  readyState = 0;
  readonly sent: string[] = [];
  readonly listeners = new Map<SocketEvent, Array<(event: unknown) => void>>();

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('WebSocket is still in CONNECTING state');
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', { code: 1000, reason: 'closed' });
  }

  addEventListener(type: SocketEvent, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  open(): void {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(message: ServerMessage): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  drop(reason = 'network lost'): void {
    this.readyState = 3;
    this.emit('close', { code: 1006, reason });
  }

  private emit(type: SocketEvent, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class ManualScheduler implements RetryScheduler {
  private nextId = 1;
  readonly tasks = new Map<number, () => void>();

  set(callback: () => void): number {
    const id = this.nextId++;
    this.tasks.set(id, callback);
    return id;
  }

  clear(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  runNext(): void {
    const next = [...this.tasks.entries()][0];
    if (!next) throw new Error('no scheduled retry');
    this.tasks.delete(next[0]);
    next[1]();
  }
}

class ProbeSession implements SessionClient {
  readonly transports: ClientTransport[] = [];
  readonly ended: string[] = [];
  messages = 0;
  isReady = false;

  beginSession(transport: ClientTransport): void {
    this.transports.push(transport);
    transport.send(JSON.stringify({ t: 'hello' }));
  }

  endSession(reason = ''): void {
    this.ended.push(reason);
    this.isReady = false;
  }

  onMessage(json: string): ServerMessage | null {
    this.messages++;
    const message = parseServerMessage(json);
    if (message?.t === 'snapshot') this.isReady = true;
    return message;
  }

  ready(): boolean {
    return this.isReady;
  }
}

describe('browser connection lifecycle (NET-001)', () => {
  it('never sends the hello handshake while the browser socket is CONNECTING', () => {
    const sockets: FakeSocket[] = [];
    const session = new ProbeSession();
    const connection = new BrowserConnection('ws://test', session, {
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });

    expect(() => connection.start()).not.toThrow();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent).toEqual([]);
    expect(session.transports).toHaveLength(0);

    sockets[0].open();
    expect(session.transports).toHaveLength(1);
    expect(sockets[0].sent).toHaveLength(1);
    expect(JSON.parse(sockets[0].sent[0])).toEqual({ t: 'hello' });
  });

  it('reconnects with a fresh session, ignores stale sockets, and stops after its retry budget', () => {
    const sockets: FakeSocket[] = [];
    const statuses: ConnectionStatus[] = [];
    const scheduler = new ManualScheduler();
    const session = new ProbeSession();
    const connection = new BrowserConnection('ws://test', session, {
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      scheduler,
      retryDelaysMs: [10, 20],
      onStatus: (status) => statuses.push(status),
    });

    connection.start();
    sockets[0].open();
    sockets[0].drop();
    expect(connection.status().phase).toBe('reconnecting');
    scheduler.runNext();
    expect(sockets).toHaveLength(2);

    // A late message from the replaced socket cannot revive the old session.
    sockets[0].message({ t: 'pong', ts: 1 });
    expect(session.messages).toBe(0);

    sockets[1].open();
    expect(session.transports).toHaveLength(2);
    sockets[1].drop();
    scheduler.runNext();
    sockets[2].open();
    sockets[2].drop();

    expect(connection.status().phase).toBe('disconnected');
    expect(scheduler.tasks.size).toBe(0);
    expect(statuses.some((status) => status.phase === 'reconnecting')).toBe(true);
  });

  it('does not reconnect a character session superseded by another browser', () => {
    const socket = new FakeSocket();
    const scheduler = new ManualScheduler();
    const session = new ProbeSession();
    const connection = new BrowserConnection('ws://test', session, {
      socketFactory: () => socket,
      scheduler,
    });

    connection.start();
    socket.open();
    socket.message({ t: 'bye', reason: 'session superseded by new connection' });

    expect(connection.status().phase).toBe('rejected');
    expect(connection.status().reason).toContain('superseded');
    expect(scheduler.tasks.size).toBe(0);
  });

  it('treats authentication failures as terminal but permits a user-authorized restart', () => {
    const sockets: FakeSocket[] = [];
    const session = new ProbeSession();
    const connection = new BrowserConnection('ws://test', session, {
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    connection.start();
    sockets[0].open();
    sockets[0].message({ t: 'authError', code: 'invalid_credentials', reason: 'Invalid username or password' });
    expect(connection.status().phase).toBe('rejected');
    connection.restart();
    expect(sockets).toHaveLength(2);
  });
});

describe('authenticated browser session', () => {
  it('authenticates before hello and resumes with a rotated opaque token after reconnect', () => {
    const world = new ClientWorld();
    const session = new AuthenticatedClientSession(world);
    const first: string[] = [];
    session.setCredentials({
      mode: 'login',
      username: 'alva_1',
      password: 'a sufficiently long passphrase',
    });
    session.beginSession({ send: (json) => first.push(json) });
    expect(JSON.parse(first[0])).toMatchObject({ t: 'auth', mode: 'login', username: 'alva_1' });
    expect(first).toHaveLength(1);

    session.onMessage(JSON.stringify({
      t: 'authOk',
      protocol: 3,
      sessionToken: 'a'.repeat(43),
      expiresInSeconds: 28_800,
      characters: [{ charId: 'pc_alva', name: 'Alva' }],
    }));
    expect(JSON.parse(first[1])).toEqual({ t: 'hello', protocol: 3, charId: 'pc_alva' });

    session.endSession('network lost');
    const second: string[] = [];
    session.beginSession({ send: (json) => second.push(json) });
    expect(JSON.parse(second[0])).toEqual({
      t: 'auth',
      mode: 'resume',
      sessionToken: 'a'.repeat(43),
    });
  });

  it('discards rejected credentials instead of retaining them for reconnect', () => {
    const session = new AuthenticatedClientSession(new ClientWorld());
    session.setCredentials({ mode: 'login', username: 'alva_1', password: 'a sufficiently long passphrase' });
    session.beginSession({ send: () => undefined });
    session.onMessage(JSON.stringify({
      t: 'authError',
      code: 'invalid_credentials',
      reason: 'Invalid username or password',
    }));
    expect(() => session.beginSession({ send: () => undefined })).toThrow('Account credentials are required');
  });
});

describe('ClientWorld session boundaries', () => {
  it('sends one hello per opened session and suppresses gameplay commands while disconnected', () => {
    const sent: string[] = [];
    const world = new ClientWorld('qa_alva', 'QA Alva');

    expect(world.attackMelee()).toBe(false);
    expect(sent).toEqual([]);

    world.beginSession({ send: (json) => sent.push(json) });
    expect(sent.map((json) => JSON.parse(json))).toEqual([
      { t: 'hello', protocol: 3, charId: 'qa_alva' },
    ]);

    world.endSession('network lost');
    expect(world.ready()).toBe(false);
    expect(world.castSpell('flamebolt')).toBe(false);
    expect(sent).toHaveLength(1);

    world.beginSession({ send: (json) => sent.push(json) });
    expect(sent).toHaveLength(2);
  });
});
