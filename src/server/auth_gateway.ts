import { TextEncoder } from 'node:util';
import { PROTOCOL_VERSION, parseAuthClientMessage, type ServerMessage } from '../net/protocol';
import { AuthService, type AuthResult } from './auth';
import { ServerCore, type SendFn } from './core';

const MAX_AUTH_MESSAGE_BYTES = 2_048;
const MAX_MESSAGE_BYTES = 8_192;

interface GatewayConnection {
  sourceKey: string;
  send: SendFn;
  authenticated: boolean;
  sessionToken: string | null;
  active: boolean;
  queue: Promise<void>;
}

/** Authentication/ownership gate in front of the authoritative core. */
export class AuthGateway {
  private readonly connections = new Map<string, GatewayConnection>();

  constructor(
    private readonly core: ServerCore,
    private readonly auth: AuthService,
  ) {}

  connect(connId: string, sourceKey: string, send: SendFn): void {
    this.connections.set(connId, {
      sourceKey,
      send,
      authenticated: false,
      sessionToken: null,
      active: true,
      queue: Promise.resolve(),
    });
  }

  onMessage(connId: string, data: string): Promise<void> {
    const connection = this.connections.get(connId);
    if (!connection) return Promise.resolve();
    const next = connection.queue.then(() => this.handleMessage(connId, connection, data));
    connection.queue = next.catch(() => undefined);
    return next;
  }

  disconnect(connId: string): void {
    const connection = this.connections.get(connId);
    if (!connection) return;
    connection.active = false;
    if (connection.authenticated) this.core.disconnect(connId);
    this.connections.delete(connId);
  }

  shutdown(): void {
    this.core.shutdown();
    for (const connection of this.connections.values()) connection.active = false;
    this.connections.clear();
  }

  private async handleMessage(connId: string, connection: GatewayConnection, data: string): Promise<void> {
    if (!connection.active || this.connections.get(connId) !== connection) return;
    const size = new TextEncoder().encode(data).byteLength;
    if (size > MAX_MESSAGE_BYTES) {
      if (connection.authenticated) connection.send({ t: 'reject', reason: 'message too large' });
      else this.sendAuthError(connection, 'invalid_request', 'Authentication request is invalid');
      return;
    }
    if (size > MAX_AUTH_MESSAGE_BYTES && !connection.authenticated) {
      this.sendAuthError(connection, 'invalid_request', 'Authentication request is invalid');
      return;
    }
    const authMessage = parseAuthClientMessage(data);
    if (connection.authenticated) {
      if (!authMessage) {
        this.core.onMessage(connId, data);
        return;
      }
      if (authMessage.mode === 'logout') {
        if (connection.sessionToken) this.auth.logout(connection.sessionToken);
        connection.send({ t: 'bye', reason: 'logged out' });
        this.disconnect(connId);
        return;
      }
      this.sendAuthError(connection, 'already_authenticated', 'Connection is already authenticated');
      return;
    }
    if (!authMessage || authMessage.mode === 'logout') {
      this.sendAuthError(connection, 'authentication_required', 'Authenticate before joining the world');
      return;
    }
    let result: AuthResult;
    switch (authMessage.mode) {
      case 'register':
        result = await this.auth.register(authMessage, connection.sourceKey);
        break;
      case 'login':
        result = await this.auth.login(authMessage, connection.sourceKey);
        break;
      case 'resume':
        result = await this.auth.resume(authMessage.sessionToken, connection.sourceKey);
        break;
    }
    if (!connection.active || this.connections.get(connId) !== connection) return;
    if (!result.ok) {
      this.sendAuthError(connection, result.code, result.reason, result.retryAfterMs);
      return;
    }
    connection.authenticated = true;
    connection.sessionToken = result.sessionToken;
    this.core.connect(connId, connection.send, result.identity);
    connection.send({
      t: 'authOk',
      protocol: PROTOCOL_VERSION,
      sessionToken: result.sessionToken,
      expiresInSeconds: Math.ceil(result.expiresInMs / 1_000),
      characters: result.identity.characters,
    });
  }

  private sendAuthError(
    connection: GatewayConnection,
    code: Extract<ServerMessage, { t: 'authError' }>['code'],
    reason: string,
    retryAfterMs?: number,
  ): void {
    connection.send({
      t: 'authError',
      code,
      reason,
      ...(retryAfterMs === undefined ? {} : { retryAfterSeconds: Math.ceil(retryAfterMs / 1_000) }),
    });
  }
}
