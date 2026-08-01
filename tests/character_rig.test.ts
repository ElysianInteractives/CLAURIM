import { describe, expect, it } from 'vitest';
import { buildCharacter, poseCharacter } from '../src/render/characters';
import type { ActorView } from '../src/world_api';

function view(overrides: Partial<ActorView> = {}): ActorView {
  return {
    id: 1,
    templateId: 'player',
    archetype: 'player',
    name: 'Alva',
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    aimPitch: 0,
    dead: false,
    downed: false,
    health: 100,
    maxHealth: 100,
    sneaking: false,
    blocking: false,
    attacking: false,
    attackKind: null,
    attackPhase: null,
    telegraphTicks: 0,
    equipment: {},
    isPlayer: true,
    isRemotePlayer: false,
    hostileToPlayer: false,
    hasDialogue: false,
    tier: 'standard',
    ...overrides,
  };
}

describe('QA Phase I articulated character reproduction', () => {
  it('builds a readable humanoid skeleton with secondary joints and detail', () => {
    const character = buildCharacter('player');
    for (const name of [
      'torso', 'headPivot', 'face', 'armL', 'armR', 'forearmL', 'forearmR',
      'handL', 'handR', 'legL', 'legR', 'kneeL', 'kneeR',
    ]) {
      expect(character.getObjectByName(name), name).toBeDefined();
    }
    let meshes = 0;
    character.traverse((part) => { if (part.type === 'Mesh') meshes++; });
    expect(meshes).toBeGreaterThanOrEqual(20);
  });

  it('drives opposing legs, knees, and torso during locomotion', () => {
    const character = buildCharacter('player');
    poseCharacter(character, view({ x: 0, z: 0 }), 0);
    poseCharacter(character, view({ x: 0, z: 0.1 }), 0.1);
    const legL = character.getObjectByName('legL')!;
    const legR = character.getObjectByName('legR')!;
    expect(legL.rotation.x).not.toBe(0);
    expect(legR.rotation.x).toBeCloseTo(-legL.rotation.x, 5);
    expect(character.getObjectByName('kneeL')!.rotation.x).toBeGreaterThanOrEqual(0);
    expect(character.getObjectByName('torso')!.rotation.z).not.toBe(0);
  });

  it('adds secondary-joint intent to bow and block poses', () => {
    const character = buildCharacter('player');
    poseCharacter(character, view({
      attacking: true,
      attackKind: 'ranged',
      attackPhase: 'windup',
      equipment: { mainHand: 'hunting_bow' },
    }), 0);
    expect(Math.abs(character.getObjectByName('forearmL')!.rotation.x)).toBeGreaterThan(0.4);
    expect(Math.abs(character.getObjectByName('forearmR')!.rotation.x)).toBeGreaterThan(0.4);

    poseCharacter(character, view({ blocking: true, equipment: { offHand: 'wooden_shield' } }), 0.1);
    expect(Math.abs(character.getObjectByName('forearmL')!.rotation.z)).toBeGreaterThan(0.2);
  });

  it('articulates quadruped legs and tail instead of sliding a rigid body', () => {
    const wolf = buildCharacter('wolf');
    poseCharacter(wolf, view({ archetype: 'wolf', x: 0, z: 0 }), 0);
    poseCharacter(wolf, view({ archetype: 'wolf', x: 0, z: 0.1 }), 0.1);
    expect(wolf.getObjectByName('legFL')).toBeDefined();
    expect(wolf.getObjectByName('legFR')!.rotation.x).toBeCloseTo(-wolf.getObjectByName('legFL')!.rotation.x, 5);
    expect(wolf.getObjectByName('tail')!.rotation.y).not.toBe(0);
  });
});
