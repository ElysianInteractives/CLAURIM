import { describe, expect, it } from 'vitest';
import {
  buildCharacter,
  buildFirstPersonRig,
  characterCombatPose,
  syncCharacterEquipment,
} from '../src/render/characters';
import { SimWorld } from '../src/game/sim_world';
import { Sim } from '../src/sim/sim';
import type { ActorView } from '../src/world_api';

function playerView(overrides: Partial<ActorView> = {}): ActorView {
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

describe('QA Phase G authoritative equipment presentation reproduction', () => {
  it('exposes equipped item ids on the render-facing actor view', () => {
    const world = new SimWorld(new Sim(42));
    expect(world.player().equipment.mainHand).toBe('worn_dagger');
  });

  it('renders and removes all visible equipment families on a world character', () => {
    const group = buildCharacter('player');
    const equipped = playerView({
      equipment: {
        mainHand: 'iron_sword',
        offHand: 'wooden_shield',
        body: 'fur_cuirass',
        head: 'fur_hood',
        feet: 'fur_boots',
        amulet: 'fur_mantle',
      },
    });
    syncCharacterEquipment(group, equipped, 'world');
    for (const name of ['gear-mainHand', 'gear-offHand', 'gear-body', 'gear-head', 'gear-feet', 'gear-amulet']) {
      expect(group.getObjectByName(name), name).toBeDefined();
    }

    syncCharacterEquipment(group, playerView(), 'world');
    expect(group.getObjectByName('gear-mainHand')).toBeUndefined();
    expect(group.getObjectByName('gear-offHand')).toBeUndefined();
  });

  it('uses weapon-specific attack poses instead of one generic arm swing', () => {
    const sword = characterCombatPose(playerView({
      attacking: true,
      attackKind: 'melee',
      attackPhase: 'windup',
      equipment: { mainHand: 'iron_sword' },
    }), true, 0);
    const axe = characterCombatPose(playerView({
      attacking: true,
      attackKind: 'melee',
      attackPhase: 'windup',
      equipment: { mainHand: 'iron_axe' },
    }), true, 0);
    const bow = characterCombatPose(playerView({
      attacking: true,
      attackKind: 'ranged',
      attackPhase: 'windup',
      equipment: { mainHand: 'hunting_bow' },
    }), true, 0);

    expect(axe.rightX).not.toBe(sword.rightX);
    expect(bow.leftX).not.toBe(0);
    expect(bow.rightX).not.toBe(sword.rightX);
  });

  it('provides first-person hands with the same main/off-hand loadout', () => {
    const rig = buildFirstPersonRig();
    syncCharacterEquipment(rig, playerView({
      equipment: { mainHand: 'iron_sword', offHand: 'wooden_shield' },
    }), 'viewmodel');
    expect(rig.getObjectByName('gear-mainHand')).toBeDefined();
    expect(rig.getObjectByName('gear-offHand')).toBeDefined();
    expect(rig.getObjectByName('gear-body')).toBeUndefined();
  });
});
