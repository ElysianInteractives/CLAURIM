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
  private readonly characters: { charId: string; name: string }[] = [];

  constructor(
    readonly core: ServerCore,
    readonly connId: string,
    accountId = `account_${connId}`,
  ) {
    core.connect(connId, (msg) => this.received.push(msg), {
      accountId,
      characters: this.characters,
    });
  }

  send(msg: unknown): void {
    this.core.onMessage(this.connId, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  hello(charId: string, name = charId, protocol = PROTOCOL_VERSION): void {
    if (!this.characters.some((character) => character.charId === charId)) {
      this.characters.push({ charId, name });
    }
    this.send({ t: 'hello', protocol, charId });
  }

  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | null {
    for (let i = this.received.length - 1; i >= 0; i--) {
      if (this.received[i].t === t) return this.received[i] as Extract<ServerMessage, { t: T }>;
    }
    return null;
  }

  input(seq: number, part: Partial<{ moveX: number; moveZ: number; yaw: number; pitch: number; sprint: boolean }> = {}): void {
    this.send({
      t: 'input',
      inputs: [
        {
          seq,
          moveX: 0,
          moveZ: 0,
          yaw: 0,
          pitch: 0,
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
    c.send({ t: 'input', inputs: [{ seq: 1, moveX: 99, moveZ: 0, yaw: 0, pitch: 0, sprint: false, sneak: false, block: false, jump: false }] });
    expect(c.last('reject')?.reason).toContain('malformed'); // moveX out of range
    c.send({ t: 'cmd', kind: 'grant_admin' });
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'cmd', kind: 'partyInvite' });
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'cmd', kind: 'partyInvite', targetId: -4 });
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'cmd', kind: 'chat', arg: 'x'.repeat(201) });
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'cmd', kind: 'equipSpell', arg: 'flamebolt' });
    expect(c.last('reject')?.reason).toContain('malformed');
    c.send({ t: 'cmd', kind: 'unequipItem', index: 6 });
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

  it('replicates movement resources and accepts safe-ground recovery as server intent', () => {
    const { core } = makeServer();
    const client = new TestClient(core, 'conn1');
    client.hello('alva');
    core.sim.movePlayerTo('alva', 'kaldwyn', 300, 300, 0);

    client.send({ t: 'cmd', kind: 'recover' });
    ticks(core, SNAPSHOT_EVERY);

    const player = core.sim.playerActor('alva')!;
    const snapshot = client.last('snapshot')!;
    expect(Math.hypot(player.pos.x - 40, player.pos.z + 416)).toBeLessThan(4);
    expect(snapshot.self.movement).toEqual({
      moveSpeed: player.stats.moveSpeed,
      staminaRegen: player.stats.staminaRegen,
      sprinting: false,
    });
    expect(snapshot.events).toContainEqual({ type: 'playerRecovered', playerId: player.id });
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

  it('snapshot ackSeq advances only through inputs consumed by authoritative ticks', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva');
    for (let seq = 1; seq <= 6; seq++) c.input(seq, { moveZ: 1 });

    // The first snapshot follows three authoritative ticks. The remaining
    // three inputs are still queued and must stay in the reconciliation tail.
    ticks(core, SNAPSHOT_EVERY);
    expect(c.last('snapshot')?.ackSeq).toBe(3);

    ticks(core, SNAPSHOT_EVERY);
    expect(c.last('snapshot')?.ackSeq).toBe(6);
  });

  it('impossible commands are refused by the sim (attack while downed)', () => {
    const { core } = makeServer();
    const c = new TestClient(core, 'conn1');
    c.hello('alva');
    const actor = core.sim.playerActor('alva')!;
    core.sim.context().dealDamage(actor.id, 0, 100000, 'physical');
    expect(actor.downed).toBe(true);
    c.send({ t: 'cmd', kind: 'melee' });
    ticks(core, SNAPSHOT_EVERY);
    expect(actor.attack).toBeNull();
    expect(c.last('snapshot')!.events).toContainEqual({
      type: 'actionRejected',
      actorId: actor.id,
      action: 'melee',
      reason: 'incapacitated',
    });
    // Invalid inventory command: equipping an item the player does not own.
    c.send({ t: 'cmd', kind: 'equip', arg: 'steel_sword' });
    ticks(core, 1);
    expect(actor.equipment.mainHand).not.toBe('steel_sword');
  });

  it('replicates and mutates item and spell loadouts through validated intent', () => {
    const { core } = makeServer();
    const client = new TestClient(core, 'conn1');
    client.hello('alva');

    client.send({ t: 'cmd', kind: 'equipSpell', arg: 'mend_wounds', index: 0 });
    client.send({ t: 'cmd', kind: 'unequipItem', index: 0 });
    ticks(core, SNAPSHOT_EVERY);

    expect(core.sim.spellLoadoutFor('alva')).toEqual({ spell1: 'mend_wounds' });
    expect(core.sim.playerActor('alva')!.equipment.mainHand).toBeUndefined();
    const snapshot = client.last('snapshot')!;
    expect(snapshot.self.equipment.find((slot) => slot.slot === 'mainHand')?.itemId).toBeNull();
    expect(snapshot.self.equippedSpells).toEqual([
      expect.objectContaining({ slot: 'spell1', spellId: 'mend_wounds' }),
      expect.objectContaining({ slot: 'spell2', spellId: null }),
    ]);

    core.disconnect('conn1');
    const reconnect = new TestClient(core, 'conn2', 'account_conn1');
    reconnect.hello('alva');
    ticks(core, SNAPSHOT_EVERY);
    expect(reconnect.last('snapshot')!.self.equippedSpells).toEqual([
      expect.objectContaining({ slot: 'spell1', spellId: 'mend_wounds' }),
      expect.objectContaining({ slot: 'spell2', spellId: null }),
    ]);
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

describe('social coordination', () => {
  it('replicates invite, accept, leave, and durable party membership authoritatively', () => {
    const { core, storage } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    const c2 = new TestClient(core, 'conn2');
    c1.hello('alva', 'Alva');
    c2.hello('brona', 'Brona');
    ticks(core, SNAPSHOT_EVERY);
    expect(c1.last('snapshot')!.self.partyId).toBeNull();
    expect(c1.last('snapshot')!.self.party.map((member) => member.charId)).toEqual(['alva']);

    c1.send({ t: 'cmd', kind: 'partyInvite', targetId: core.sim.playerActor('brona')!.id });
    ticks(core, SNAPSHOT_EVERY);
    expect(c2.last('snapshot')!.self.partyInvites).toEqual([
      expect.objectContaining({ fromCharId: 'alva', fromName: 'Alva' }),
    ]);

    c2.send({ t: 'cmd', kind: 'partyAccept' });
    ticks(core, SNAPSHOT_EVERY);
    expect(c1.last('snapshot')!.self.party.map((member) => member.charId)).toEqual(['alva', 'brona']);
    expect(c2.last('snapshot')!.self.partyId).toBe('party:alva');

    core.disconnect('conn2');
    expect(core.sim.partyMembersOf('alva')).toEqual(['alva', 'brona']);
    expect(storage.loadWorld()).toBeTruthy();
    const reconnect = new TestClient(core, 'conn3', 'account_conn2');
    reconnect.hello('brona', 'Brona');
    ticks(core, SNAPSHOT_EVERY);
    expect(reconnect.last('snapshot')!.self.party.map((member) => member.charId)).toEqual(['alva', 'brona']);

    reconnect.send({ t: 'cmd', kind: 'partyLeave' });
    ticks(core, SNAPSHOT_EVERY);
    expect(reconnect.last('snapshot')!.self.partyId).toBeNull();
    expect(core.sim.partyOf('alva')).toBeNull();
  });

  it('sanitizes local chat and throttles command spam', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    const c2 = new TestClient(core, 'conn2');
    c1.hello('alva', 'Alva');
    c2.hello('brona', 'Brona');
    c1.send({ t: 'cmd', kind: 'chat', arg: '\u0000\u0001  ' });
    c1.send({ t: 'cmd', kind: 'chat', arg: '  hello\u0000  reach  ' });
    c1.send({ t: 'cmd', kind: 'chat', arg: 'spam' });
    ticks(core, SNAPSHOT_EVERY);
    const chats = c2.last('snapshot')!.events.filter((event) => event.type === 'chat');
    expect(chats).toEqual([{ type: 'chat', playerId: core.sim.playerActor('alva')!.id, text: 'hello reach' }]);

    ticks(core, 15);
    const unicodeLine = '😀'.repeat(200);
    c1.send({ t: 'cmd', kind: 'chat', arg: unicodeLine });
    ticks(core, SNAPSHOT_EVERY);
    expect(c2.last('snapshot')!.events).toContainEqual({
      type: 'chat',
      playerId: core.sim.playerActor('alva')!.id,
      text: unicodeLine,
    });
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
    const c2 = new TestClient(core, 'conn2', 'account_conn1');
    c2.hello('alva');
    const restored = core.sim.playerActor('alva')!;
    expect(restored.gold).toBe(777);
    expect(restored.skills.oneHanded.level).toBe(level);
  });

  it('disconnecting while downed restores the character released, not incapacitated', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva', 'Alva');
    const actor = core.sim.playerActor('alva')!;
    core.sim.context().dealDamage(actor.id, 0, 100000, 'physical');
    expect(actor.downed).toBe(true);
    core.disconnect('conn1');

    const reconnect = new TestClient(core, 'conn2', 'account_conn1');
    reconnect.hello('alva', 'Alva');
    const restored = core.sim.playerActor('alva')!;
    expect(restored.downed).toBe(false);
    expect(restored.health).toBeCloseTo(restored.stats.maxHealth * 0.4);
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
    const c2 = new TestClient(core2, 'connA', 'account_conn1');
    c2.hello('alva');
    expect(core2.sim.playerActor('alva')).toBeTruthy();
  });

  it('a second connection for the same character supersedes the first', () => {
    const { core } = makeServer();
    const c1 = new TestClient(core, 'conn1');
    c1.hello('alva');
    const c2 = new TestClient(core, 'conn2', 'account_conn1');
    c2.hello('alva');
    expect(c1.last('bye')?.reason).toContain('superseded');
    expect(c2.last('welcome')?.charId).toBe('alva');
    ticks(core, SNAPSHOT_EVERY);
    expect(c2.last('snapshot')).toBeTruthy();
  });
});

describe('QA Phase B authoritative reticle aim', () => {
  it('applies validated pitch to spell release and replicates the current aim', () => {
    const { core } = makeServer();
    const client = new TestClient(core, 'conn1');
    client.hello('alva', 'Alva');
    client.input(1, { yaw: Math.PI / 2, pitch: 0.45 });
    client.send({ t: 'cmd', kind: 'cast', arg: 'flamebolt' });

    ticks(core, 12);

    const projectile = core.sim.projectiles[0];
    expect(projectile).toBeTruthy();
    expect(projectile.vel.x).toBeGreaterThan(0);
    expect(projectile.vel.y).toBeGreaterThan(0);
    expect(projectile.vel.z).toBeCloseTo(0);
    expect(client.last('snapshot')?.self.aimPitch).toBeCloseTo(0.45);
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
