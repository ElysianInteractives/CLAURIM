import {
  createHash,
  randomBytes as cryptoRandomBytes,
  scrypt as cryptoScrypt,
  timingSafeEqual,
} from 'node:crypto';
import type { AuthErrorCode } from '../net/protocol';
import type { StorageProvider } from './storage';

function deriveScrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    cryptoScrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
const SESSION_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1_000;
const MAX_SESSIONS_PER_ACCOUNT = 5;

export interface CharacterIdentity {
  charId: string;
  name: string;
}

export interface AuthenticatedIdentity {
  accountId: string;
  characters: CharacterIdentity[];
}

export interface PasswordHashRecord {
  algorithm: 'scrypt';
  salt: string;
  hash: string;
  keyLength: number;
  cost: number;
  blockSize: number;
  parallelization: number;
}

export interface PasswordHasher {
  hash(password: string): Promise<PasswordHashRecord>;
  verify(password: string, record: PasswordHashRecord): Promise<boolean>;
  dummyVerify(): Promise<void>;
}

export class ScryptPasswordHasher implements PasswordHasher {
  private readonly dummy: Promise<PasswordHashRecord>;
  private workQueue: Promise<void> = Promise.resolve();

  constructor(private readonly randomBytes: (size: number) => Buffer = cryptoRandomBytes) {
    this.dummy = this.hash('Claurim dummy verification value');
  }

  async hash(password: string): Promise<PasswordHashRecord> {
    const salt = this.randomBytes(16);
    const keyLength = 64;
    const cost = 131_072;
    const blockSize = 8;
    const parallelization = 1;
    const derived = await this.run(() => deriveScrypt(password, salt, keyLength, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 256 * 1024 * 1024,
    }));
    return {
      algorithm: 'scrypt',
      salt: salt.toString('base64'),
      hash: derived.toString('base64'),
      keyLength,
      cost,
      blockSize,
      parallelization,
    };
  }

  async verify(password: string, record: PasswordHashRecord): Promise<boolean> {
    if (!supportedHashRecord(record)) return false;
    const expected = Buffer.from(record.hash, 'base64');
    const derived = await this.run(() => deriveScrypt(password, Buffer.from(record.salt, 'base64'), record.keyLength, {
      N: record.cost,
      r: record.blockSize,
      p: record.parallelization,
      maxmem: 256 * 1024 * 1024,
    }));
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }

  async dummyVerify(): Promise<void> {
    await this.verify('not the supplied credential', await this.dummy);
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.workQueue;
    let release = (): void => undefined;
    this.workQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

interface AccountRecord {
  accountId: string;
  username: string;
  password: PasswordHashRecord;
  characters: CharacterIdentity[];
}

interface SessionRecord {
  accountId: string;
  expiresAt: number;
}

interface LimitBucket {
  attempts: number[];
}

export type AuthSuccess = {
  ok: true;
  sessionToken: string;
  expiresInMs: number;
  identity: AuthenticatedIdentity;
};

export type AuthFailure = {
  ok: false;
  code: AuthErrorCode;
  reason: string;
  retryAfterMs?: number;
};

export type AuthResult = AuthSuccess | AuthFailure;

interface AuthOptions {
  hasher?: PasswordHasher;
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
  sessionTtlMs?: number;
}

const WEAK_PASSWORDS = new Set([
  'passwordpassword',
  'qwertyuiopasdfgh',
  'letmeinletmeinletmein',
]);

export class AuthService {
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly limits = new Map<string, LimitBucket>();
  private readonly hasher: PasswordHasher;
  private readonly now: () => number;
  private readonly randomBytes: (size: number) => Buffer;
  private readonly sessionTtlMs: number;

  constructor(private readonly storage: StorageProvider, options: AuthOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomBytes = options.randomBytes ?? cryptoRandomBytes;
    this.hasher = options.hasher ?? new ScryptPasswordHasher(this.randomBytes);
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.restore();
  }

  async register(
    input: { username: string; password: string; displayName: string },
    sourceKey: string,
  ): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const limited = this.rateLimit(`register-source:${sourceKey}`, 5, 60_000);
    if (limited) return limited;
    if (this.accounts.has(username)) {
      return { ok: false, code: 'username_unavailable', reason: 'Username is unavailable' };
    }
    const policy = passwordPolicyFailure(input.password);
    if (policy) return policy;
    const password = await this.hasher.hash(input.password);
    // A concurrent registration can pass the first availability check while
    // this expensive derivation is queued. Never allow the later completion
    // to replace the account that won the race.
    if (this.accounts.has(username)) {
      return { ok: false, code: 'username_unavailable', reason: 'Username is unavailable' };
    }
    const account: AccountRecord = {
      accountId: `acct_${this.randomBytes(12).toString('hex')}`,
      username,
      password,
      characters: [{
        charId: `pc_${this.randomBytes(12).toString('hex')}`,
        name: input.displayName.trim(),
      }],
    };
    this.accounts.set(username, account);
    this.persist();
    return this.issueSession(account);
  }

  async login(input: { username: string; password: string }, sourceKey: string): Promise<AuthResult> {
    const username = normalizeUsername(input.username);
    const sourceLimit = this.rateLimit(`login-source:${sourceKey}`, 20, 60_000);
    if (sourceLimit) return sourceLimit;
    const accountLimit = this.rateLimit(`login-account:${username}`, 5, 60_000);
    if (accountLimit) return accountLimit;
    const account = this.accounts.get(username);
    const valid = account
      ? await this.hasher.verify(input.password, account.password)
      : (await this.hasher.dummyVerify(), false);
    if (!account || !valid) {
      return { ok: false, code: 'invalid_credentials', reason: 'Invalid username or password' };
    }
    this.clearLimit(`login-account:${username}`);
    return this.issueSession(account);
  }

  async resume(sessionToken: string, sourceKey: string): Promise<AuthResult> {
    const limited = this.rateLimit(`resume-source:${sourceKey}`, 30, 60_000);
    if (limited) return limited;
    this.removeExpiredSessions();
    const oldHash = tokenHash(sessionToken);
    const session = this.sessions.get(oldHash);
    if (!session) return { ok: false, code: 'invalid_session', reason: 'Session is invalid or expired' };
    this.sessions.delete(oldHash);
    const account = [...this.accounts.values()].find((candidate) => candidate.accountId === session.accountId);
    if (!account) return { ok: false, code: 'invalid_session', reason: 'Session is invalid or expired' };
    return this.issueSession(account, session.expiresAt);
  }

  logout(sessionToken: string): void {
    this.sessions.delete(tokenHash(sessionToken));
  }

  debugSessionHashes(): string {
    return JSON.stringify([...this.sessions.keys()]);
  }

  private issueSession(account: AccountRecord, expiresAt = this.now() + this.sessionTtlMs): AuthSuccess {
    this.removeExpiredSessions();
    const owned = [...this.sessions.entries()]
      .filter(([, session]) => session.accountId === account.accountId)
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    while (owned.length >= MAX_SESSIONS_PER_ACCOUNT) {
      const oldest = owned.shift();
      if (oldest) this.sessions.delete(oldest[0]);
    }
    let token: string;
    do {
      token = this.randomBytes(SESSION_BYTES).toString('base64url');
    } while (this.sessions.has(tokenHash(token)));
    this.sessions.set(tokenHash(token), {
      accountId: account.accountId,
      expiresAt,
    });
    return {
      ok: true,
      sessionToken: token,
      expiresInMs: Math.max(0, expiresAt - this.now()),
      identity: cloneIdentity(account),
    };
  }

  private restore(): void {
    const raw = this.storage.loadAuth();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { version?: unknown; accounts?: unknown };
      if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) throw new Error('unsupported auth format');
      for (const candidate of parsed.accounts) {
        if (!validAccount(candidate)) throw new Error('invalid account record');
        this.accounts.set(candidate.username, candidate);
      }
    } catch (error) {
      throw new Error(`Authentication store is invalid: ${String(error)}`);
    }
  }

  private persist(): void {
    this.storage.saveAuth(JSON.stringify({ version: 1, accounts: [...this.accounts.values()] }));
  }

  private removeExpiredSessions(): void {
    const now = this.now();
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(hash);
    }
  }

  private rateLimit(key: string, maximum: number, windowMs: number): AuthFailure | null {
    const now = this.now();
    const bucket = this.limits.get(key) ?? { attempts: [] };
    bucket.attempts = bucket.attempts.filter((at) => now - at < windowMs);
    if (bucket.attempts.length >= maximum) {
      const retryAfterMs = Math.max(1, windowMs - (now - bucket.attempts[0]));
      this.limits.set(key, bucket);
      return { ok: false, code: 'rate_limited', reason: 'Too many attempts; try again later', retryAfterMs };
    }
    bucket.attempts.push(now);
    this.limits.set(key, bucket);
    return null;
  }

  private clearLimit(key: string): void {
    this.limits.delete(key);
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cloneIdentity(account: AccountRecord): AuthenticatedIdentity {
  return {
    accountId: account.accountId,
    characters: account.characters.map((character) => ({ ...character })),
  };
}

function passwordPolicyFailure(password: string): AuthFailure | null {
  const points = [...password].length;
  if (points < 15 || points > 128 || Buffer.byteLength(password, 'utf8') > 512) {
    return { ok: false, code: 'password_policy', reason: 'Password must contain 15 to 128 characters' };
  }
  const collapsed = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (WEAK_PASSWORDS.has(collapsed)) {
    return { ok: false, code: 'password_policy', reason: 'Choose a less common password' };
  }
  return null;
}

function validAccount(value: unknown): value is AccountRecord {
  if (typeof value !== 'object' || value === null) return false;
  const account = value as Partial<AccountRecord>;
  return (
    typeof account.accountId === 'string' &&
    typeof account.username === 'string' &&
    typeof account.password === 'object' &&
    account.password !== null &&
    supportedHashRecord(account.password as PasswordHashRecord) &&
    Array.isArray(account.characters) &&
    account.characters.length > 0 &&
    account.characters.every((character) =>
      typeof character === 'object' && character !== null &&
      typeof character.charId === 'string' && typeof character.name === 'string')
  );
}

function supportedHashRecord(record: PasswordHashRecord): boolean {
  return record.algorithm === 'scrypt' &&
    record.keyLength === 64 && record.cost === 131_072 && record.blockSize === 8 && record.parallelization === 1 &&
    typeof record.salt === 'string' && Buffer.from(record.salt, 'base64').byteLength >= 16 &&
    typeof record.hash === 'string' && Buffer.from(record.hash, 'base64').byteLength === record.keyLength;
}
