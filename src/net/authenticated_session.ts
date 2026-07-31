import type { ClientTransport } from './client_world';
import { ClientWorld } from './client_world';
import type { SessionClient } from './browser_connection';
import { PROTOCOL_VERSION, parseServerMessage, type AuthClientMessage, type ServerMessage } from './protocol';

export type AccountCredentials =
  | { mode: 'login'; username: string; password: string }
  | { mode: 'register'; username: string; password: string; displayName: string };

/**
 * Browser authentication wrapper. The opaque session token is deliberately
 * kept in this object only: it is never written to storage or the URL.
 */
export class AuthenticatedClientSession implements SessionClient {
  private transport: ClientTransport | null = null;
  private credentials: AccountCredentials | null = null;
  private sessionToken: string | null = null;
  private lastAuthError: string | null = null;

  constructor(
    readonly world: ClientWorld,
    private readonly onAuthState?: (state: { authenticated: boolean; error?: string }) => void,
  ) {}

  setCredentials(credentials: AccountCredentials): void {
    this.credentials = { ...credentials };
    this.sessionToken = null;
    this.lastAuthError = null;
  }

  beginSession(transport: ClientTransport): void {
    this.transport = transport;
    let message: AuthClientMessage;
    if (this.sessionToken) {
      message = { t: 'auth', mode: 'resume', sessionToken: this.sessionToken };
    } else if (this.credentials?.mode === 'register') {
      message = { t: 'auth', ...this.credentials };
    } else if (this.credentials) {
      message = { t: 'auth', ...this.credentials };
    } else {
      throw new Error('Account credentials are required');
    }
    transport.send(JSON.stringify(message));
  }

  endSession(reason = 'connection closed'): void {
    this.transport = null;
    this.world.endSession(reason);
  }

  onMessage(json: string): ServerMessage | null {
    const message = parseServerMessage(json);
    if (!message) return null;
    if (message.t === 'authOk') {
      if (!this.transport) return message;
      if (message.protocol !== PROTOCOL_VERSION) {
        this.sessionToken = null;
        this.credentials = null;
        this.lastAuthError = `Protocol ${message.protocol} is not supported`;
        this.onAuthState?.({ authenticated: false, error: this.lastAuthError });
        return { t: 'authError', code: 'invalid_session', reason: this.lastAuthError };
      }
      const character = message.characters[0];
      if (!character) {
        this.sessionToken = null;
        this.credentials = null;
        this.lastAuthError = 'Account has no playable character';
        this.onAuthState?.({ authenticated: false, error: this.lastAuthError });
        return { t: 'authError', code: 'invalid_session', reason: this.lastAuthError };
      }
      this.sessionToken = message.sessionToken;
      this.credentials = null;
      this.lastAuthError = null;
      this.world.setIdentity(character.charId, character.name);
      this.world.beginSession(this.transport);
      this.onAuthState?.({ authenticated: true });
      return message;
    }
    if (message.t === 'authError') {
      if (message.code === 'invalid_session') this.sessionToken = null;
      this.credentials = null;
      this.lastAuthError = message.reason;
      this.world.endSession(message.reason);
      this.onAuthState?.({ authenticated: false, error: message.reason });
      return message;
    }
    return this.world.onMessage(json);
  }

  ready(): boolean {
    return this.world.ready();
  }

  authError(): string | null {
    return this.lastAuthError;
  }
}
