// Browser WebSocket lifecycle for the online host. Socket construction and
// retry timing are injectable so startup/reconnect behavior is deterministic
// in tests. ClientWorld never receives a transport until OPEN, which prevents
// the browser's CONNECTING-state send failure (NET-001).

import type { ServerMessage } from './protocol';
import type { ClientTransport } from './client_world';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'synchronizing'
  | 'online'
  | 'reconnecting'
  | 'disconnected'
  | 'rejected';

export interface ConnectionStatus {
  phase: ConnectionPhase;
  attempt: number;
  maxAttempts: number;
  retryInMs?: number;
  reason?: string;
}

export interface BrowserSocket {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: unknown) => void,
  ): void;
}

export interface RetryScheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export interface SessionClient {
  beginSession(transport: ClientTransport): void;
  endSession(reason?: string): void;
  onMessage(json: string): ServerMessage | null;
  ready(): boolean;
}

export interface BrowserConnectionOptions {
  socketFactory?: (url: string) => BrowserSocket;
  scheduler?: RetryScheduler;
  retryDelaysMs?: readonly number[];
  onStatus?: (status: ConnectionStatus) => void;
}

const OPEN = 1;
const DEFAULT_RETRY_DELAYS = [250, 500, 1_000, 2_000, 4_000] as const;

const DEFAULT_SCHEDULER: RetryScheduler = {
  set: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clear: (handle) => globalThis.clearTimeout(handle as number),
};

export class BrowserConnection {
  private readonly socketFactory: (url: string) => BrowserSocket;
  private readonly scheduler: RetryScheduler;
  private readonly retryDelaysMs: readonly number[];
  private readonly onStatus?: (status: ConnectionStatus) => void;
  private socket: BrowserSocket | null = null;
  private retryHandle: unknown = null;
  private retryCount = 0;
  private generation = 0;
  private stopped = false;
  private state: ConnectionStatus;

  constructor(
    private readonly url: string,
    private readonly client: SessionClient,
    options: BrowserConnectionOptions = {},
  ) {
    this.socketFactory =
      options.socketFactory ??
      ((socketUrl) => new WebSocket(socketUrl) as unknown as BrowserSocket);
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
    this.onStatus = options.onStatus;
    this.state = {
      phase: 'idle',
      attempt: 0,
      maxAttempts: this.retryDelaysMs.length,
    };
  }

  start(): void {
    if (this.socket || this.retryHandle !== null || !['idle', 'disconnected'].includes(this.state.phase)) return;
    this.stopped = false;
    this.retryCount = 0;
    this.openSocket(false);
  }

  stop(reason = 'connection stopped'): void {
    this.stopped = true;
    if (this.retryHandle !== null) {
      this.scheduler.clear(this.retryHandle);
      this.retryHandle = null;
    }
    const socket = this.socket;
    this.socket = null;
    this.generation++;
    this.client.endSession(reason);
    socket?.close();
    this.publish({ phase: 'disconnected', attempt: this.retryCount, reason });
  }

  retryNow(): void {
    if (this.state.phase !== 'disconnected') return;
    this.start();
  }

  /** Begin a new user-authorized authentication attempt after terminal rejection. */
  restart(): void {
    if (this.socket || this.retryHandle !== null) return;
    this.stopped = false;
    this.retryCount = 0;
    this.publish({ phase: 'idle', attempt: 0 });
    this.start();
  }

  status(): ConnectionStatus {
    return { ...this.state };
  }

  private openSocket(initial: boolean): void {
    if (this.stopped) return;
    const generation = ++this.generation;
    let socket: BrowserSocket;
    try {
      socket = this.socketFactory(this.url);
    } catch (error) {
      this.scheduleRetry(error instanceof Error ? error.message : 'socket construction failed');
      return;
    }
    this.socket = socket;
    this.publish({
      phase: initial || this.retryCount > 0 ? 'reconnecting' : 'connecting',
      attempt: this.retryCount,
    });

    const current = (): boolean => this.socket === socket && this.generation === generation && !this.stopped;

    socket.addEventListener('open', () => {
      if (!current()) return;
      this.publish({
        phase: 'synchronizing',
        attempt: this.retryCount,
      });
      try {
        this.client.beginSession({
          send: (json) => {
            if (!current() || socket.readyState !== OPEN) throw new Error('WebSocket is not open');
            socket.send(json);
          },
        });
      } catch (error) {
        this.loseSocket(
          socket,
          error instanceof Error ? error.message : 'session handshake failed',
        );
      }
    });

    socket.addEventListener('message', (event) => {
      if (!current()) return;
      const data = (event as { data?: unknown }).data;
      const message = this.client.onMessage(String(data ?? ''));
      if (!message) return;
      if (message.t === 'snapshot' && this.client.ready()) {
        this.retryCount = 0;
        if (this.state.phase !== 'online') this.publish({ phase: 'online', attempt: 0 });
      } else if (message.t === 'reject') {
        this.terminate(socket, message.reason);
      } else if (message.t === 'authError') {
        this.terminate(socket, message.reason);
      } else if (message.t === 'bye') {
        if (isTerminalBye(message.reason)) this.terminate(socket, message.reason);
        else this.loseSocket(socket, message.reason);
      }
    });

    socket.addEventListener('close', (event) => {
      if (!current()) return;
      const close = event as { code?: number; reason?: string };
      const detail = close.reason?.trim() || (close.code ? `socket closed (${close.code})` : 'socket closed');
      this.loseSocket(socket, detail);
    });

    socket.addEventListener('error', () => {
      if (!current()) return;
      this.loseSocket(socket, 'connection error');
    });
  }

  private loseSocket(socket: BrowserSocket, reason: string): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.generation++;
    this.client.endSession(reason);
    try {
      socket.close();
    } catch {
      // The browser may already have finalized the failed socket.
    }
    this.scheduleRetry(reason);
  }

  private terminate(socket: BrowserSocket, reason: string): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.generation++;
    this.client.endSession(reason);
    try {
      socket.close();
    } catch {
      // Best-effort terminal close.
    }
    this.publish({
      phase: 'rejected',
      attempt: this.retryCount,
      reason,
    });
  }

  private scheduleRetry(reason: string): void {
    if (this.stopped) return;
    if (this.retryCount >= this.retryDelaysMs.length) {
      this.publish({
        phase: 'disconnected',
        attempt: this.retryCount,
        reason,
      });
      return;
    }
    const delayMs = this.retryDelaysMs[this.retryCount];
    this.retryCount++;
    this.publish({
      phase: 'reconnecting',
      attempt: this.retryCount,
      retryInMs: delayMs,
      reason,
    });
    this.retryHandle = this.scheduler.set(() => {
      this.retryHandle = null;
      this.openSocket(true);
    }, delayMs);
  }

  private publish(status: Omit<ConnectionStatus, 'maxAttempts'>): void {
    this.state = { ...status, maxAttempts: this.retryDelaysMs.length };
    this.onStatus?.({ ...this.state });
  }
}

function isTerminalBye(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return normalized.includes('superseded') || normalized.includes('protocol violation');
}
