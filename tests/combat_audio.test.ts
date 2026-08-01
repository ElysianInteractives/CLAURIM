import { describe, expect, it } from 'vitest';
import { combatCues } from '../src/game/combat_audio';
import type { SimEvent } from '../src/sim/types';

describe('authoritative combat audio mapping', () => {
  it('maps local outcomes to distinct hit, block, and hurt cues', () => {
    const events: SimEvent[] = [
      { type: 'damage', targetId: 2, sourceId: 1, amount: 10, channel: 'physical', blocked: false },
      { type: 'damage', targetId: 1, sourceId: 2, amount: 4, channel: 'physical', blocked: true },
      { type: 'damage', targetId: 1, sourceId: 2, amount: 12, channel: 'fire', blocked: false },
    ];

    expect(combatCues(events, 1)).toEqual(['hit', 'block', 'hurt']);
  });

  it('maps telegraph, interrupt, down, and recovery transitions', () => {
    const events: SimEvent[] = [
      { type: 'telegraph', sourceId: 2, abilityId: 'pale_breath', ticks: 45, interruptible: true },
      { type: 'interrupted', sourceId: 2, abilityId: 'pale_breath' },
      { type: 'playerDowned', playerId: 1 },
      { type: 'playerRevived', playerId: 1, by: 3 },
    ];

    expect(combatCues(events, 1)).toEqual(['danger', 'interrupt', 'down', 'revive']);
  });

  it('ignores unrelated remote damage and recovery transitions', () => {
    const events: SimEvent[] = [
      { type: 'damage', targetId: 2, sourceId: 3, amount: 10, channel: 'physical', blocked: false },
      { type: 'playerReleased', playerId: 2 },
    ];

    expect(combatCues(events, 1)).toEqual([]);
  });
});
