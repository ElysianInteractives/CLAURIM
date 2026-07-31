// The authoritative server over an in-memory transport (D-014/D-015/D-016):
// join/reject, validation, input-driven server-authoritative movement,
// interest management, persistence, disconnect/reconnect, late join, and
// protocol hygiene. The ws adapter is a thin shell over this same core.

import { describe, expect, it } from 'vitest';
import { ServerCore, SNAPSHOT_EVERY } from '../src/server/core';
import { MemoryStorage } from '../src/server/storage';
import { PROTOCOL_VERSION, type ServerMessage } from '../src/net/protocol';

class TestClient {
  received: ServerMessage[] = [];

  constructor(
    readonly core: ServerCore,
    readonly connId: string,
  ) {
    core.connect(connId, (msg) => this.received.push(msg));
  }

  send(msg: unknown): void {
    this.core.onMessage(this.connId, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  hello(charId: string, name = charId, protocol = PROTOCOL_VERSION): void {
    this.send({ t: 'hello', protocol, charId, name });
  }

  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | null {
    for (let i = this.received.length - 1; i >= 0; i--) {
      if (this.received[i].t === t) return this.received[i] as Extract<ServerMessage, { t: T }>;
    }
    return null;
  }

  input(seq: number, part: Partial<{ moveX: number; moveZ: number; yaw: number; sprint: boolean }> = {}): void {
    this.send({
      t: 'input',
      inputs: [
        {
          seq,
          moveX: 0,
          moveZ: 0,
          yaw: 0,
          sprint: false,
          sneak: false,
          block: false,
          jump: false,
          ...part,
        },
      ],
    });
  }
}

function makeServer(): { core: ServerCore; storage: MemoryStorage } {
  const storage = new MemoryStorage();
  return { core: new ServerCore(storage, 4242), storage };
}

function ticks(core: ServerCore, n: number): void {
  for (let i = 0; i < n; i++) core.tick();
}

describe('join and protocol hygiene', () => {
  it('two clients join one world with distinct characters and both get snapshots', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    const c2 = new TestClient(core, 'conn2');
    c1.hello('alva');
    c2.hello('brona');
    expect(c1.last('welcome')?.charId).toBe('alva');
    expect(c2.last('welcome')?.charId).toBe('brona');
    expect(core.sim.players.size).toBe(2);
    ticks(core, SNAPSHOT_EVERY);
    const s1 = c1.last('snapshot')!;
    const s2 = c2.last('snapshot')!;
    expect(s1.self.charId).toBe('alva');
    expect(s2.self.charId).toBe('brona');
    expect(s1.self.entityId).not.toBe(s2.self.entityId);
    // Each sees the other (same start area).
    expect(s1.actors.some((a) => a.id === s2.self.entityId && a.isRemotePlayer)).toBe(true);
  });

  it('rejects wrong protocol versions and malformed messages', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva', 'alva', PROTOCOL_VERSION + 5);
    expect(c.last('reject')?.reason).toContain('protocol');
    c.send('this is not json {{{');
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'input', inputs: [{ seq: 1, moveX: 99, moveZ: 0, yaw: 0, sprint: false, sneak: false, block: false, jump: false }] });
    expect(c.last('reject')?.reason).toContain('malformed'); // moveX out of range
    c.send({ t: 'cmd', kind: 'grant_admin' });
    expect(c.last('reject')?.reason).toContain('malformed');
  });

  it('commands before joining are rejected', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.send({ t: 'cmd', kind: 'melee' });
    expect(c.last('reject')?.reason).toContain('not joined');
  });
});

describe('server-authoritative movement (D-015)', () => {
  it('movement comes only from validated intent; positions advance on the server', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva');
    const before = { ...core.sim.playerActor('alva')!.pos };
    for (let seq = 1; seq <= 30; seq++) {
      c.input(seq, { moveZ: 1, yaw: 0 });
      core.tick();
    }
    const after = core.sim.playerActor('alva')!.pos;
    expect(after.z).toBeGreaterThan(before.z + 2);
    const snap = c.last('snapshot')!;
    expect(snap.ackSeq).toBe(30);
    expect(snap.self.z).toBeCloseTo(after.z, 5);
  });

  it('duplicate/replayed input sequences are ignored', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva');
    c.input(5, { moveZ: 1 });
    core.tick();
    const z1 = core.sim.playerActor('alva')!.pos.z;
    c.input(5, { moveZ: 1 }); // replay: same seq
    c.input(4, { moveZ: 1 }); // stale
    core.tick();
    const z2 = core.sim.playerActor('alva')!.pos.z;
    expect(z2).toBeCloseTo(z1, 5); // no queued input -> stops (no double-move)
  });

  it('impossible commands are refused by the sim (attack while downed)', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva');
    const actor = core.sim.playerActor('alva')!;
    core.sim.context().dealDamage(actor.id, 0, 100000, 'physical');
    expect(actor.downed).toBe(true);
    c.send({ t: 'cmd', kind: 'melee' });
    ticks(core, 1);
    expect(actor.attack).toBeNull();
    // Invalid inventory command: equipping an item the player does not own.
    c.send({ t: 'cmd', kind: 'equip', arg: 'steel_sword' });
    ticks(core, 1);
    expect(actor.equipment.mainHand).not.toBe('steel_sword');
  });
});

describe('interest management (D-014)', () => {
  it('far-away players leave each other\'s snapshots; interiors are space-scoped', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    const c2 = new TestClient(core, 'conn2');
    c1.hello('alva');
    c2.hello('brona');
    // Separate them far beyond the cell window.
    core.sim.movePlayerTo('brona', 'kaldwyn', -400, 300, 0);
    ticks(core, SNAPSHOT_EVERY);
    const s1 = c1.last('snapshot')!;
    expect(s1.actors.some((a) => a.name === 'Brona')).toBe(false);
    // Interior: brona enters the mine; alva outside sees nothing of it.
    core.sim.movePlayerTo('brona', 'duskhollow_mine', 0, 5, 0);
    ticks(core, SNAPSHOT_EVERY);
    const s2 = c2.last('snapshot')!;
    expect(s2.self.spaceId).toBe('duskhollow_mine');
    expect(s2.actors.some((a) => a.templateId === 'marsh_rat')).toBe(true);
    const s1b = c1.last('snapshot')!;
    expect(s1b.actors.some((a) => a.templateId === 'marsh_rat')).toBe(false);
  });
});

describe('snapshot bandwidth budget', () => {
  it('keeps a representative four-player dungeon snapshot below 32,000 bytes', () => {
    const { core } = makeServer();
    const clients = ['alva', 'brona', 'cadan', 'dara'].map((charId, index) => {
      const client = new TestClient(core, `conn${index + 1}`);
      client.hello(charId);
      core.sim.movePlayerTo(charId, 'duskhollow_mine', -2 + index * 1.2, 8, 0);
      return client;
    });
    ticks(core, SNAPSHOT_EVERY);

    const sizes = clients.map((client) => {
      const snapshot = client.last('snapshot');
      expect(snapshot).toBeTruthy();
      return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
    });
    const maxBytes = Math.max(...sizes);
    console.info(`[snapshot-budget] bytes=${sizes.join(',')} max=${maxBytes} limit=32000`);
    expect(maxBytes).toBeLessThan(32_000);
  });
});

describe('persistence + reconnect (D-016)', () => {
  it('disconnect persists the character; reconnect restores progression', () => {
    const { core, storage } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva');
    const actor = core.sim.playerActor('alva')!;
    actor.gold = 777;
    core.sim.context().trainSkill(actor.id, 'oneHanded', 400);
    const level = actor.skills.oneHanded.level;
    expect(level).toBeGreaterThan(1);
    core.disconnect('conn1');
    expect(core.sim.players.has('alva')).toBe(false);
    expect(storage.loadCharacter('alva')).toBeTruthy();
    // Reconnect on a new connection.
    const c2 = new TestClient(core, 'conn2');
    c2.hello('alva');
    const restored = core.sim.playerActor('alva')!;
    expect(restored.gold).toBe(777);
    expect(restored.skills.oneHanded.level).toBe(level);
  });

  it('world state survives a full server restart via storage', () => {
    const { core, storage } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva');
    // Kill a never-respawning raider, then persist + "restart".
    const raider = [...core.sim.actors.values()].find((a) => a.templateId === 'redclaw_raider')!;
    core.sim.context().dealDamage(raider.id, core.sim.playerActor('alva')!.id, 100000, 'physical');
    core.shutdown();
    const core2 = new ServerCore(storage, 4242);
    const dead = [...core2.sim.actors.values()].find((a) => a.id === raider.id);
    expect(dead?.dead).toBe(true);
    expect(core2.sim.players.size).toBe(0); // characters rejoin individually
    const c2 = new TestClient(core2, 'connA');
    c2.hello('alva');
    expect(core2.sim.playerActor('alva')).toBeTruthy();
  });

  it('a second connection for the same character supersedes the first', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva');
    const c2 = new TestClient(core, 'conn2');
    c2.hello('alva');
    expect(c1.last('bye')?.reason).toContain('superseded');
    expect(c2.last('welcome')?.charId).toBe('alva');
    ticks(core, SNAPSHOT_EVERY);
    expect(c2.last('snapshot')).toBeTruthy();
  });
});

describe('late join', () => {
  it('a late joiner immediately receives full world state in its snapshot', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva');
    ticks(core, 300);
    const c2 = new TestClient(core, 'conn2');
    c2.hello('brona');
    ticks(core, SNAPSHOT_EVERY);
    const snap = c2.last('snapshot')!;
    expect(snap.tick).toBeGreaterThan(300);
    expect(snap.self.charId).toBe('brona');
    expect(snap.actors.length).toBeGreaterThan(0);
  });
});

describe('deterministic multiplayer replay', () => {
  it('two servers fed identical message streams produce identical worlds', () => {
    const run = (): string => {
      const { core } = makeServer();
      const c1 = new TestClient(core, 'conn1');
      const c2 = new TestClient(core, 'conn2');
      c1.hello('alva');
      c2.hello('brona');
      let seq = 0;
      for (let t = 0; t < 240; t++) {
        seq++;
        c1.input(seq, { moveZ: t % 40 < 20 ? 1 : 0, yaw: t * 0.01 });
        c2.input(seq, { moveX: t % 60 < 30 ? 1 : -1, yaw: -t * 0.02 });
        if (t === 100) c1.send({ t: 'cmd', kind: 'melee' });
        if (t === 150) c2.send({ t: 'cmd', kind: 'cast', arg: 'flamebolt' });
        core.tick();
      }
      return core.sim.saveToJson();
    };
    expect(run()).toEqual(run());
  });
});
