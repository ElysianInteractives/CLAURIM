import { describe, expect, it } from 'vitest';
import { AuthService, ScryptPasswordHasher, type PasswordHashRecord, type PasswordHasher } from '../src/server/auth';
import { AuthGateway } from '../src/server/auth_gateway';
import { ServerCore } from '../src/server/core';
import { MemoryStorage } from '../src/server/storage';
import { PROTOCOL_VERSION, parseAuthClientMessage, parseServerMessage, type ServerMessage } from '../src/net/protocol';
import { browserOriginAllowed, secureTransportAllowed, sourceAddress } from '../src/server/transport_security';

const STRONG_PASSWORD = 'correct horse battery staple';

class TestHasher implements PasswordHasher {
  async hash(password: string): Promise<PasswordHashRecord> {
    return {
      algorithm: 'scrypt',
      salt: Buffer.from('test-salt-16byte').toString('base64'),
      hash: testDerived(password),
      keyLength: 64,
      cost: 131_072,
      blockSize: 8,
      parallelization: 1,
    };
  }

  async verify(password: string, record: PasswordHashRecord): Promise<boolean> {
    return record.hash === testDerived(password);
  }

  async dummyVerify(): Promise<void> {}
}

function testDerived(password: string): string {
  const source = Buffer.from(`derived:${password}`);
  const output = Buffer.alloc(64);
  for (let index = 0; index < output.length; index++) output[index] = source[index % source.length];
  return output.toString('base64');
}

function deterministicBytes(): (size: number) => Buffer {
  let value = 1;
  return (size) => Buffer.alloc(size, value++);
}

function authService(storage = new MemoryStorage(), now = () => 1_000): AuthService {
  return new AuthService(storage, {
    hasher: new TestHasher(),
    now,
    randomBytes: deterministicBytes(),
  });
}

describe('authentication protocol validation', () => {
  it('accepts long passphrases but rejects short credentials and malformed resume tokens', () => {
    expect(
      parseAuthClientMessage(
        JSON.stringify({
          t: 'auth',
          mode: 'register',
          username: 'alva_1',
          password: STRONG_PASSWORD,
          displayName: 'Alva',
        }),
      ),
    ).toBeTruthy();
    expect(
      parseAuthClientMessage(
        JSON.stringify({ t: 'auth', mode: 'login', username: 'alva_1', password: 'too short' }),
      ),
    ).toBeNull();
    expect(
      parseAuthClientMessage(JSON.stringify({ t: 'auth', mode: 'resume', sessionToken: 'predictable' })),
    ).toBeNull();
  });

  it('rejects malformed authentication responses before they reach the browser session', () => {
    expect(parseServerMessage(JSON.stringify({
      t: 'authOk',
      protocol: PROTOCOL_VERSION,
      sessionToken: 'short',
      expiresInSeconds: 100,
      characters: [],
    }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({
      t: 'authError',
      code: 'invented_code',
      reason: 'not part of the protocol',
    }))).toBeNull();
  });
});

describe('account persistence and password boundary', () => {
  it('uses the production scrypt cost and verifies without retaining the password', async () => {
    const hasher = new ScryptPasswordHasher(deterministicBytes());
    const record = await hasher.hash('production test passphrase');
    expect(record).toMatchObject({
      algorithm: 'scrypt',
      keyLength: 64,
      cost: 131_072,
      blockSize: 8,
      parallelization: 1,
    });
    expect(Buffer.from(record.salt, 'base64')).toHaveLength(16);
    expect(record.hash).not.toContain('production test passphrase');
    expect(await hasher.verify('production test passphrase', record)).toBe(true);
    expect(await hasher.verify('incorrect production test passphrase', record)).toBe(false);
  }, 15_000);

  it('persists only a salted password derivation and restores login after restart', async () => {
    const storage = new MemoryStorage();
    const first = authService(storage);
    const registered = await first.register(
      { username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' },
      'source-a',
    );
    expect(registered.ok).toBe(true);
    expect(storage.auth).toBeTruthy();
    expect(storage.auth).not.toContain(STRONG_PASSWORD);
    expect(storage.auth).toContain('scrypt');

    const restarted = authService(storage);
    const login = await restarted.login({ username: 'alva_1', password: STRONG_PASSWORD }, 'source-a');
    expect(login.ok).toBe(true);
    if (login.ok) expect(login.identity.characters).toEqual(registered.ok ? registered.identity.characters : []);
  });

  it('returns the same failure for unknown accounts and wrong passwords', async () => {
    const service = authService();
    await service.register({ username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' }, 'source-a');
    const wrong = await service.login({ username: 'alva_1', password: `${STRONG_PASSWORD}!` }, 'source-b');
    const missing = await service.login({ username: 'missing', password: `${STRONG_PASSWORD}!` }, 'source-c');
    expect(wrong).toMatchObject({ ok: false, code: 'invalid_credentials' });
    expect(missing).toMatchObject({ ok: false, code: 'invalid_credentials' });
    expect(wrong.ok || missing.ok ? null : wrong.reason).toBe(missing.ok ? null : missing.reason);
  });

  it('rate limits by account independently of the connection source', async () => {
    const service = authService();
    await service.register({ username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' }, 'register');
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(await service.login({ username: 'alva_1', password: `${STRONG_PASSWORD}!` }, `source-${attempt}`))
        .toMatchObject({ ok: false, code: 'invalid_credentials' });
    }
    expect(await service.login({ username: 'alva_1', password: STRONG_PASSWORD }, 'fresh-source'))
      .toMatchObject({ ok: false, code: 'rate_limited' });
    expect(await service.login({ username: 'missing', password: STRONG_PASSWORD }, 'fresh-source'))
      .toMatchObject({ ok: false, code: 'invalid_credentials' });
  });

  it('allows only one winner when the same username is registered concurrently', async () => {
    const service = authService();
    const [first, second] = await Promise.all([
      service.register({ username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' }, 'source-a'),
      service.register({ username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Other Alva' }, 'source-b'),
    ]);
    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    expect([first, second].find((result) => !result.ok)).toMatchObject({
      ok: false,
      code: 'username_unavailable',
    });
  });
});

describe('opaque sessions', () => {
  it('stores no raw session token, rotates on resume, and rejects replay', async () => {
    const service = authService();
    const registered = await service.register(
      { username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' },
      'source-a',
    );
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(service.debugSessionHashes()).not.toContain(registered.sessionToken);

    const resumed = await service.resume(registered.sessionToken, 'source-a');
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.sessionToken).not.toBe(registered.sessionToken);
    expect(await service.resume(registered.sessionToken, 'source-a')).toMatchObject({
      ok: false,
      code: 'invalid_session',
    });
  });

  it('expires sessions and never restores them from persistent account storage', async () => {
    let now = 1_000;
    const storage = new MemoryStorage();
    const service = new AuthService(storage, {
      hasher: new TestHasher(),
      now: () => now,
      randomBytes: deterministicBytes(),
      sessionTtlMs: 2_000,
    });
    const registered = await service.register(
      { username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' },
      'source-a',
    );
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    now = 2_000;
    const resumed = await service.resume(registered.sessionToken, 'source-a');
    expect(resumed).toMatchObject({ ok: true, expiresInMs: 1_000 });
    if (!resumed.ok) return;
    now = 3_001;
    expect(await service.resume(resumed.sessionToken, 'source-a')).toMatchObject({
      ok: false,
      code: 'invalid_session',
    });

    const fresh = authService(storage);
    expect(await fresh.resume(registered.sessionToken, 'source-b')).toMatchObject({
      ok: false,
      code: 'invalid_session',
    });
  });
});

describe('authenticated server boundary', () => {
  it('does not connect unauthenticated traffic to ServerCore', async () => {
    const storage = new MemoryStorage();
    const core = new ServerCore(storage, 4242);
    const gateway = new AuthGateway(core, authService(storage));
    const received: ServerMessage[] = [];
    gateway.connect('conn1', 'source-a', (message) => received.push(message));

    await gateway.onMessage('conn1', JSON.stringify({
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      charId: 'stolen_character',
    }));

    expect(received.at(-1)).toMatchObject({ t: 'authError', code: 'authentication_required' });
    expect(core.connectedCount()).toBe(0);
    expect(core.sim.players.size).toBe(0);
  });

  it('allows an owned character and rejects a known character owned by another account', async () => {
    const storage = new MemoryStorage();
    const core = new ServerCore(storage, 4242);
    const service = authService(storage);
    const accountA = await service.register(
      { username: 'alva_1', password: STRONG_PASSWORD, displayName: 'Alva' },
      'source-a',
    );
    const accountB = await service.register(
      { username: 'brona_1', password: STRONG_PASSWORD, displayName: 'Brona' },
      'source-b',
    );
    expect(accountA.ok && accountB.ok).toBe(true);
    if (!accountA.ok || !accountB.ok) return;

    const received: ServerMessage[] = [];
    core.connect('conn1', (message) => received.push(message), accountA.identity);
    core.onMessage('conn1', JSON.stringify({
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      charId: accountB.identity.characters[0].charId,
    }));
    expect(received.at(-1)).toMatchObject({ t: 'reject', reason: 'character not owned by account' });
    expect(core.sim.players.size).toBe(0);

    core.onMessage('conn1', JSON.stringify({
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      charId: accountA.identity.characters[0].charId,
    }));
    expect(received.at(-1)).toMatchObject({ t: 'welcome', charId: accountA.identity.characters[0].charId });
  });
});

describe('secure transport boundary', () => {
  it('permits loopback development and encrypted/trusted-proxy traffic only', () => {
    expect(secureTransportAllowed({ remoteAddress: '127.0.0.1', encrypted: false })).toBe(true);
    expect(secureTransportAllowed({ remoteAddress: '203.0.113.9', encrypted: true })).toBe(true);
    expect(
      secureTransportAllowed({
        remoteAddress: '127.0.0.1',
        encrypted: false,
        forwardedProto: 'https',
        trustProxy: true,
      }),
    ).toBe(true);
    expect(secureTransportAllowed({ remoteAddress: '203.0.113.9', encrypted: false })).toBe(false);
    expect(
      secureTransportAllowed({
        remoteAddress: '203.0.113.9',
        encrypted: false,
        forwardedProto: 'https',
        trustProxy: false,
      }),
    ).toBe(false);
    expect(
      secureTransportAllowed({
        remoteAddress: '127.0.0.1',
        encrypted: false,
        forwardedProto: 'http',
        trustProxy: true,
      }),
    ).toBe(false);
  });

  it('requires an allowlisted browser origin outside loopback and trusts forwarded sources explicitly', () => {
    const allowed = new Set(['https://play.claurim.example']);
    expect(browserOriginAllowed('http://localhost:5173', '127.0.0.1', allowed)).toBe(true);
    expect(browserOriginAllowed('https://play.claurim.example', '203.0.113.9', allowed)).toBe(true);
    expect(browserOriginAllowed('https://evil.example', '203.0.113.9', allowed)).toBe(false);
    expect(browserOriginAllowed(undefined, '203.0.113.9', allowed)).toBe(true);
    expect(sourceAddress('127.0.0.1', '203.0.113.9, 127.0.0.1', true)).toBe('203.0.113.9');
    expect(sourceAddress('127.0.0.1', '203.0.113.9', false)).toBe('127.0.0.1');
    expect(sourceAddress('127.0.0.1', 'not-an-ip', true)).toBe('127.0.0.1');
  });
});
