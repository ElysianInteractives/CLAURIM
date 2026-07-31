// Core sim behavior: determinism, content validity, terrain purity, streaming
// activity, effects composition, and combat resolution.

import { describe, expect, it } from 'vitest';
import { Sim, type PlayerInput } from '../src/sim/sim';
import { CONTENT } from '../src/sim/content';
import { validateContent } from '../src/sim/content/schema';
import { terrainHeight, slopeAt } from '../src/sim/world/terrain';
import { deriveStats } from '../src/sim/effects/modifiers';
import { defaultBaseStats } from '../src/sim/actors/actor';
import { activeCellKeys, CELL_SIZE } from '../src/sim/world/cells';

const idle: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, sprint: false, sneak: false, block: false, jump: false };

function scriptedInput(t: number): PlayerInput {
  return {
    moveX: t % 60 < 30 ? 1 : 0,
    moveZ: t % 90 < 45 ? 1 : -0.5,
    yaw: (t * 0.01) % (Math.PI * 2),
    sprint: t % 120 < 40,
    sneak: t % 200 > 150,
    block: false,
    jump: t % 100 === 0,
  };
}

describe('content', () => {
  it('the shipped registry validates clean', () => {
    expect(validateContent(CONTENT)).toEqual([]);
  });
});

describe('determinism', () => {
  it('same seed + same input script => identical serialized state', () => {
    const a = new Sim(1234);
    const b = new Sim(1234);
    for (let t = 0; t < 600; t++) {
      a.tick(scriptedInput(t));
      b.tick(scriptedInput(t));
    }
    expect(a.saveToJson()).toEqual(b.saveToJson());
  });

  it('different seeds diverge', () => {
    const a = new Sim(1);
    const b = new Sim(2);
    for (let t = 0; t < 120; t++) {
      a.tick(scriptedInput(t));
      b.tick(scriptedInput(t));
    }
    expect(a.saveToJson()).not.toEqual(b.saveToJson());
  });

  it('replay from a mid-run save matches the original run', () => {
    const a = new Sim(777);
    for (let t = 0; t < 300; t++) a.tick(scriptedInput(t));
    const mid = a.saveToJson();
    const b = Sim.load(mid);
    for (let t = 300; t < 500; t++) {
      a.tick(scriptedInput(t));
      b.tick(scriptedInput(t));
    }
    expect(b.saveToJson()).toEqual(a.saveToJson());
  });
});

describe('terrain', () => {
  it('terrainHeight is pure and seed-stable', () => {
    expect(terrainHeight(10.5, -200.25, 42)).toBe(terrainHeight(10.5, -200.25, 42));
    expect(terrainHeight(10.5, -200.25, 42)).not.toBe(terrainHeight(10.5, -200.25, 43));
  });

  it('settlement plateau is flat enough to build on', () => {
    for (let dx = -20; dx <= 20; dx += 10) {
      for (let dz = -20; dz <= 20; dz += 10) {
        expect(slopeAt(40 + dx, 150 + dz, 42)).toBeLessThan(0.35);
      }
    }
  });

  it('the road from ruin to settlement stays walkable', () => {
    // Sample along the road spline: slope must stay under the walk limit.
    const pts = [
      [40, -420], [30, -300], [-10, -180], [-30, -60], [0, 60], [40, 150],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let t = 0; t <= 1; t += 0.1) {
        const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
        const z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
        expect(slopeAt(x, z, 42), `slope at ${x},${z}`).toBeLessThan(1.1);
      }
    }
  });
});

describe('cells / streaming', () => {
  it('active set is a 5x5 block', () => {
    const keys = activeCellKeys(0, 0);
    expect(keys.size).toBe(25);
    expect(keys.has('0,0')).toBe(true);
    expect(keys.has('2,2')).toBe(true);
    expect(keys.has('3,0')).toBe(false);
  });

  it('far actors do not tick their AI', () => {
    const sim = new Sim(42);
    // The mine-gate raiders are ~750m from the ruin start: far outside the
    // active block.
    const raider = [...sim.actors.values()].find((a) => a.spawnerId === 'sp_gate_raiders')!;
    expect(sim.isActorActive(raider)).toBe(false);
    const dist = Math.abs(raider.pos.x - sim.player().pos.x) + Math.abs(raider.pos.z - sim.player().pos.z);
    expect(dist).toBeGreaterThan(CELL_SIZE * 3);
  });
});

describe('modifier composition', () => {
  it('adds before muls, with floors', () => {
    const base = defaultBaseStats();
    const out = deriveStats(base, [
      { stat: 'meleeDamage', op: 'add', value: 7, source: 'test' },
      { stat: 'meleeDamage', op: 'mul', value: 1.2, source: 'test' },
    ]);
    expect(out.meleeDamage).toBeCloseTo((base.meleeDamage + 7) * 1.2, 5);
  });

  it('resists cap at 0.85', () => {
    const out = deriveStats(defaultBaseStats(), [
      { stat: 'resistFire', op: 'add', value: 2, source: 'test' },
    ]);
    expect(out.resistFire).toBe(0.85);
  });
});

describe('combat', () => {
  function closeCombatSim(): { sim: Sim; wolfId: number } {
    const sim = new Sim(42);
    // Teleport a wolf next to the player, facing it.
    const wolf = [...sim.actors.values()].find((a) => a.templateId === 'frostfang_wolf')!;
    const p = sim.player();
    wolf.pos = { ...p.pos, x: p.pos.x, z: p.pos.z + 1.5 };
    // Rehome the teleported wolf so the leash does not pull it away mid-test.
    wolf.brain!.homePos = { ...wolf.pos };
    p.yaw = 0; // facing +z
    return { sim, wolfId: wolf.id };
  }

  it('player melee swing damages and can kill; loot rolls once; low health triggers flee', () => {
    const { sim, wolfId } = closeCombatSim();
    const wolf = sim.actors.get(wolfId)!;
    let sawFlee = false;
    let guard = 0;
    while (!wolf.dead && guard++ < 900) {
      if (!sim.player().attack) sim.playerMelee();
      // Chase: keep the wolf in front of the player (it flees below 15% HP,
      // which we also assert -- that behavior is content-driven).
      wolf.pos = { ...sim.player().pos, z: sim.player().pos.z + 1.5 };
      sim.tick({ ...idle, yaw: 0 });
      sim.player().stamina = 100; // keep swinging
      if (wolf.brain?.state === 'flee') sawFlee = true;
    }
    expect(wolf.dead).toBe(true);
    expect(sawFlee).toBe(true);
    expect(wolf.lootRolled).toBe(true);
  });

  it('blocking reduces damage taken', () => {
    const { sim: simA, wolfId: wolfAId } = closeCombatSim();
    const { sim: simB, wolfId: wolfBId } = closeCombatSim();
    const pA = simA.player();
    const pB = simB.player();
    pB.blocking = true;
    simA.context().dealDamage(pA.id, wolfAId, 20, 'physical');
    simB.context().dealDamage(pB.id, wolfBId, 20, 'physical');
    const lostA = pA.stats.maxHealth - pA.health;
    const lostB = pB.stats.maxHealth - pB.health;
    expect(lostB).toBeLessThan(lostA);
  });

  it('sneak attacks multiply damage', () => {
    const { sim, wolfId } = closeCombatSim();
    const wolf = sim.actors.get(wolfId)!;
    const hpBefore = wolf.health;
    sim.player().sneaking = true;
    sim.playerMelee();
    for (let i = 0; i < 12; i++) sim.tick({ ...idle, yaw: 0, sneak: true });
    const sneakDmg = hpBefore - wolf.health;
    expect(sneakDmg).toBeGreaterThan(0);

    // Compare with an identical non-sneak swing on a fresh sim.
    const { sim: sim2, wolfId: wolfId2 } = closeCombatSim();
    const wolf2 = sim2.actors.get(wolfId2)!;
    const hp2 = wolf2.health;
    sim2.playerMelee();
    for (let i = 0; i < 12; i++) sim2.tick({ ...idle, yaw: 0 });
    const normalDmg = hp2 - wolf2.health;
    expect(normalDmg).toBeGreaterThan(0);
    expect(sneakDmg).toBeGreaterThan(normalDmg * 1.5);
  });

  it('projectiles fly, hit, and apply spell effects', () => {
    const { sim, wolfId } = closeCombatSim();
    const wolf = sim.actors.get(wolfId)!;
    // Move wolf out to 10m so the bolt must travel; disable its brain so it
    // stays put.
    wolf.pos.z = sim.player().pos.z + 10;
    wolf.brain = null;
    const ok = sim.playerCast('flamebolt');
    expect(ok).toBe(true);
    for (let i = 0; i < 60 && wolf.health === wolf.stats.maxHealth; i++) {
      sim.tick({ ...idle, yaw: 0 });
    }
    expect(wolf.health).toBeLessThan(wolf.stats.maxHealth);
    expect(wolf.effects.some((e) => e.effectId === 'burning')).toBe(true);
  });

  it('use-based skill xp: melee swings train oneHanded', () => {
    const { sim } = closeCombatSim();
    const before = sim.player().skills.oneHanded.xp + sim.player().skills.oneHanded.level * 1000;
    sim.playerMelee();
    for (let i = 0; i < 12; i++) {
      sim.tick({ ...idle, yaw: 0 });
      sim.player().stamina = 100;
    }
    const after = sim.player().skills.oneHanded.xp + sim.player().skills.oneHanded.level * 1000;
    expect(after).toBeGreaterThan(before);
  });
});

describe('effects runtime', () => {
  it('dots tick, expire, and refresh', () => {
    const sim = new Sim(42);
    const ctx = sim.context();
    const p = sim.player();
    ctx.applyEffect(p.id, 'burning', 'test');
    expect(p.effects.length).toBe(1);
    const hp0 = p.health;
    for (let i = 0; i < 30; i++) sim.tick({ ...idle });
    expect(p.health).toBeLessThan(hp0);
    // Refresh resets remaining.
    ctx.applyEffect(p.id, 'burning', 'test');
    expect(p.effects[0].remaining).toBeCloseTo(4, 1);
    // Expiry.
    for (let i = 0; i < 30 * 5; i++) sim.tick({ ...idle });
    expect(p.effects.find((e) => e.effectId === 'burning')).toBeUndefined();
  });
});
