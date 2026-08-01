import { describe, expect, it } from 'vitest';
import { parseClientMessage } from '../src/net/protocol';
import { CONTENT } from '../src/sim/content';
import { IDLE_INPUT, Sim } from '../src/sim/sim';
import { SPELL_PROJECTILE_SPEED, SPELL_WINDUP_TICKS } from '../src/sim/types';
import { MAX_AIM_PITCH, MIN_AIM_PITCH, reticleDirection } from '../src/sim/player/aim';

describe('QA Phase B reticle-directed spellcasting reproduction', () => {
  it('maps bounded yaw and pitch to a normalized reticle ray', () => {
    const aimed = reticleDirection(Math.PI / 2, 0.45);
    expect(Math.hypot(aimed.x, aimed.y, aimed.z)).toBeCloseTo(1);
    expect(aimed.x).toBeGreaterThan(0);
    expect(aimed.y).toBeGreaterThan(0);
    expect(aimed.z).toBeCloseTo(0);
    expect(reticleDirection(0, MAX_AIM_PITCH + 1)).toEqual(reticleDirection(0, MAX_AIM_PITCH));
    expect(reticleDirection(0, MIN_AIM_PITCH - 1)).toEqual(reticleDirection(0, MIN_AIM_PITCH));
  });

  it('releases a player spell along the reticle pitch instead of flat model facing', () => {
    const sim = new Sim(20260801, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('p1', 'Wanderer');
    sim.learnSpellFor('p1', 'flamebolt');
    sim.equipSpellFor('p1', 'spell1', 'flamebolt');
    sim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    expect(sim.castFor('p1', 'flamebolt')).toBe(true);

    const aimedInput = { ...IDLE_INPUT, pitch: 0.45 };
    for (let tick = 0; tick < SPELL_WINDUP_TICKS; tick++) sim.tick(aimedInput);

    expect(sim.projectiles).toHaveLength(1);
    const expected = reticleDirection(0, aimedInput.pitch);
    expect(sim.projectiles[0].vel.x).toBeCloseTo(expected.x * SPELL_PROJECTILE_SPEED);
    expect(sim.projectiles[0].vel.y).toBeCloseTo(expected.y * SPELL_PROJECTILE_SPEED);
    expect(sim.projectiles[0].vel.z).toBeCloseTo(expected.z * SPELL_PROJECTILE_SPEED);
  });

  it('requires a finite bounded pitch on every online movement intent', () => {
    const baseInput = {
      seq: 1,
      moveX: 0,
      moveZ: 0,
      yaw: 0,
      sprint: false,
      sneak: false,
      block: false,
      jump: false,
    };

    expect(parseClientMessage(JSON.stringify({ t: 'input', inputs: [baseInput] }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      t: 'input',
      inputs: [{ ...baseInput, pitch: 0.45 }],
    }))).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({
      t: 'input',
      inputs: [{ ...baseInput, pitch: Number.POSITIVE_INFINITY }],
    }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({
      t: 'input',
      inputs: [{ ...baseInput, pitch: MAX_AIM_PITCH + 0.01 }],
    }))).toBeNull();
  });
});
