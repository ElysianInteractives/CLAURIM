// Character meshes: compact stylized figures assembled from primitives, one
// factory per archetype. Simple procedural walk/attack posing driven from
// ActorView state (no gameplay logic here).

import * as THREE from 'three';
import { CONTENT } from '../sim/content';
import type { ContentId, EquipSlot } from '../sim/types';
import type { ActorView } from '../world_api';
import { PALETTE } from './palette';

function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function humanoid(cloth: number, skin: number, scale = 1, hood = false): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), mat(cloth));
  body.position.y = 1.0;
  body.name = 'body';
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), mat(skin));
  head.position.y = 1.62;
  head.name = 'head';
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), mat(PALETTE.woodDark));
  legL.position.set(-0.16, 0.3, 0);
  legL.name = 'legL';
  const legR = legL.clone();
  legR.position.x = 0.16;
  legR.name = 'legR';
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), mat(cloth));
  armL.position.set(-0.42, 1.05, 0);
  armL.name = 'armL';
  const armR = armL.clone();
  armR.position.x = 0.42;
  armR.name = 'armR';
  g.add(body, head, legL, legR, armL, armR);
  if (hood) {
    const hoodMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 5), mat(cloth));
    hoodMesh.position.y = 1.9;
    g.add(hoodMesh);
  }
  g.scale.setScalar(scale);
  return g;
}

function quadruped(fur: number, length: number, height: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, length), mat(fur));
  body.position.y = height;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.44), mat(fur));
  head.position.set(0, height + 0.18, length / 2 + 0.18);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), mat(fur));
  tail.position.set(0, height + 0.1, -length / 2 - 0.2);
  for (const [lx, lz] of [
    [-0.18, length / 2 - 0.12],
    [0.18, length / 2 - 0.12],
    [-0.18, -length / 2 + 0.12],
    [0.18, -length / 2 + 0.12],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.14), mat(fur));
    leg.position.set(lx, height / 2, lz);
    g.add(leg);
  }
  g.add(body, head, tail);
  g.scale.setScalar(scale);
  return g;
}

export function buildCharacter(archetype: string): THREE.Group {
  let character: THREE.Group;
  switch (archetype) {
    case 'player':
      character = humanoid(PALETTE.clothBlue, PALETTE.skinPale);
      break;
    case 'villager_f':
      character = humanoid(PALETTE.clothGreen, PALETTE.skinPale, 0.96);
      break;
    case 'villager_m':
      character = humanoid(PALETTE.leather, PALETTE.skinPale, 1.02);
      break;
    case 'bandit':
      character = humanoid(PALETTE.clothRed, PALETTE.skinPale, 1.0, true);
      break;
    case 'bandit_archer':
      character = humanoid(PALETTE.clothRed, PALETTE.skinPale, 0.95, true);
      break;
    case 'wight': {
      const g = humanoid(PALETTE.wightSkin, PALETTE.wightSkin, 1.25);
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: PALETTE.wightGlow }));
      eyeL.position.set(-0.08, 1.64, 0.18);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.08;
      g.add(eyeL, eyeR);
      character = g;
      break;
    }
    case 'wolf':
      character = quadruped(PALETTE.wolfFur, 1.1, 0.55);
      break;
    case 'rat':
      character = quadruped(PALETTE.ratFur, 0.6, 0.25, 0.8);
      break;
    default:
      character = humanoid(PALETTE.clothGreen, PALETTE.skinPale);
      break;
  }
  character.userData.archetype = archetype;
  return character;
}

type EquipmentMode = 'world' | 'viewmodel';

const VISIBLE_SLOTS: readonly EquipSlot[] = ['mainHand', 'offHand', 'body', 'head', 'feet', 'amulet'];

function presentationEquipment(view: ActorView): Partial<Record<EquipSlot, ContentId>> {
  // Archer templates predate NPC inventory loadouts. Keep their established
  // bow silhouette as a presentation default until templates author gear.
  if (view.archetype === 'bandit_archer' && !view.equipment.mainHand) {
    return { ...view.equipment, mainHand: 'hunting_bow' };
  }
  return view.equipment;
}

function weaponType(view: ActorView): string | null {
  const id = presentationEquipment(view).mainHand;
  return id ? CONTENT.items[id]?.weaponType ?? null : null;
}

function gearGroup(slot: EquipSlot): THREE.Group {
  const group = new THREE.Group();
  group.name = `gear-${slot}`;
  return group;
}

function buildWeapon(itemId: ContentId): THREE.Group {
  const group = gearGroup('mainHand');
  const def = CONTENT.items[itemId];
  const type = def?.weaponType;
  if (type === 'bow') {
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 5, 14, Math.PI * 1.5),
      mat(PALETTE.woodDark),
    );
    bow.rotation.z = -Math.PI * 0.75;
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.68, 0.018), mat(PALETTE.arrow));
    group.add(bow, string);
  } else if (type === 'axe') {
    const haft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), mat(PALETTE.woodDark));
    haft.position.y = 0.22;
    const mace = itemId.includes('mace');
    const head = new THREE.Mesh(
      mace ? new THREE.BoxGeometry(0.24, 0.24, 0.24) : new THREE.BoxGeometry(0.34, 0.24, 0.1),
      mat(PALETTE.stone),
    );
    head.position.set(mace ? 0 : 0.12, 0.65, 0);
    group.add(haft, head);
  } else {
    const dagger = type === 'dagger';
    const bladeLength = dagger ? 0.38 : 0.72;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.09), mat(PALETTE.woodDark));
    handle.position.y = -0.13;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(dagger ? 0.25 : 0.34, 0.07, 0.09), mat(PALETTE.stone));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(dagger ? 0.1 : 0.13, bladeLength, 0.055), mat(0xb8c0c4));
    blade.position.y = bladeLength / 2 + 0.03;
    group.add(handle, guard, blade);
  }
  return group;
}

function buildShield(): THREE.Group {
  const group = gearGroup('offHand');
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.37, 0.1, 10), mat(PALETTE.woodWall));
  shield.rotation.x = Math.PI / 2;
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), mat(PALETTE.stone));
  boss.position.z = 0.07;
  group.add(shield, boss);
  return group;
}

function buildArmor(slot: EquipSlot): THREE.Group {
  const group = gearGroup(slot);
  if (slot === 'body') {
    const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.41), mat(PALETTE.leather));
    cuirass.position.y = 1.02;
    group.add(cuirass);
  } else if (slot === 'head') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 7), mat(PALETTE.wolfFur));
    hood.position.y = 1.83;
    group.add(hood);
  } else if (slot === 'feet') {
    for (const x of [-0.16, 0.16]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.34), mat(PALETTE.leather));
      boot.position.set(x, 0.16, 0.05);
      group.add(boot);
    }
  } else if (slot === 'amulet') {
    const mantle = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.09, 5, 12, Math.PI), mat(PALETTE.wolfFur));
    mantle.position.set(0, 1.36, 0.18);
    mantle.rotation.z = Math.PI;
    group.add(mantle);
  }
  return group;
}

function disposeEquipmentNode(node: THREE.Object3D): void {
  node.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.geometry.dispose();
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) material.dispose();
  });
  node.removeFromParent();
}

/** Synchronize presentation meshes from the authoritative actor loadout. */
export function syncCharacterEquipment(group: THREE.Group, view: ActorView, mode: EquipmentMode): void {
  const equipment = presentationEquipment(view);
  const slots = mode === 'viewmodel' ? VISIBLE_SLOTS.slice(0, 2) : VISIBLE_SLOTS;
  const signature = `${mode}:${slots.map((slot) => `${slot}=${equipment[slot] ?? ''}`).join('|')}`;
  if (group.userData.equipmentSignature === signature) return;
  for (const node of (group.userData.equipmentNodes ?? []) as THREE.Object3D[]) disposeEquipmentNode(node);
  const nodes: THREE.Object3D[] = [];
  for (const slot of slots) {
    const itemId = equipment[slot];
    if (!itemId || !CONTENT.items[itemId]) continue;
    const node = slot === 'mainHand' ? buildWeapon(itemId) : slot === 'offHand' ? buildShield() : buildArmor(slot);
    if (slot === 'mainHand' || slot === 'offHand') {
      const arm = group.getObjectByName(slot === 'mainHand' ? 'armR' : 'armL');
      if (!arm) continue;
      node.position.set(0, mode === 'viewmodel' ? -0.26 : -0.34, mode === 'viewmodel' ? 0.12 : 0.1);
      if (mode === 'viewmodel') node.scale.setScalar(0.44);
      if (slot === 'offHand') node.rotation.y = Math.PI;
      arm.add(node);
    } else {
      group.add(node);
    }
    nodes.push(node);
  }
  group.userData.equipmentNodes = nodes;
  group.userData.equipmentSignature = signature;
}

/** Camera-local arms. World geometry remains hidden in first person. */
export function buildFirstPersonRig(): THREE.Group {
  const rig = new THREE.Group();
  rig.name = 'first-person-rig';
  rig.position.set(0, -0.4, -0.95);
  for (const [name, x] of [['armL', -0.27], ['armR', 0.27]] as const) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.13), mat(PALETTE.clothBlue));
    arm.name = name;
    arm.position.set(x, -0.02, 0);
    rig.add(arm);
  }
  return rig;
}

const LOCOMOTION_START_SPEED = 0.18;
const LOCOMOTION_STOP_SPEED = 0.08;

/** Presentation-only locomotion hysteresis. Tiny interpolation/collision
 * corrections stay idle instead of triggering a full procedural walk cycle. */
export function locomotionMoving(distance: number, dtSec: number, wasMoving: boolean): boolean {
  if (!Number.isFinite(distance) || !Number.isFinite(dtSec) || dtSec <= 0) return false;
  const speed = Math.max(0, distance) / dtSec;
  return speed >= (wasMoving ? LOCOMOTION_STOP_SPEED : LOCOMOTION_START_SPEED);
}

export interface CharacterCombatPose {
  rightX: number;
  rightZ: number;
  leftX: number;
  leftZ: number;
}

/** Pure weapon-aware pose selection shared by world and first-person rigs. */
export function characterCombatPose(view: ActorView, moving: boolean, timeSec: number): CharacterCombatPose {
  const walkSwing = moving ? Math.sin(timeSec * 8) * 0.4 : 0;
  if (view.blocking) return { rightX: -0.75, rightZ: 0.28, leftX: -1.35, leftZ: -0.5 };
  if (!view.attackPhase) return { rightX: walkSwing, rightZ: 0, leftX: -walkSwing, leftZ: 0 };

  const type = weaponType(view);
  if (view.attackKind === 'spell') {
    if (view.attackPhase === 'windup') return { rightX: -1.1, rightZ: 0.3, leftX: -0.75, leftZ: -0.25 };
    if (view.attackPhase === 'active') return { rightX: -1.7, rightZ: 0.08, leftX: -1.25, leftZ: -0.08 };
    return { rightX: -0.45, rightZ: 0.08, leftX: -0.3, leftZ: -0.08 };
  }
  if (type === 'bow') {
    if (view.attackPhase === 'windup') return { rightX: -1.35, rightZ: 0.48, leftX: -1.45, leftZ: -0.55 };
    if (view.attackPhase === 'active') return { rightX: -1.65, rightZ: 0.18, leftX: -1.55, leftZ: -0.4 };
    return { rightX: -0.65, rightZ: 0.18, leftX: -0.7, leftZ: -0.2 };
  }
  if (view.attackPhase === 'active') {
    return type === 'axe'
      ? { rightX: -2.45, rightZ: -0.28, leftX: -0.15, leftZ: 0 }
      : { rightX: -2.15, rightZ: type === 'dagger' ? -0.08 : -0.18, leftX: -0.1, leftZ: 0 };
  }
  if (view.attackPhase === 'recover') return { rightX: -0.45, rightZ: -0.08, leftX: -0.1, leftZ: 0 };
  if (type === 'axe') return { rightX: 1.25, rightZ: 0.34, leftX: -0.2, leftZ: 0 };
  if (type === 'dagger') return { rightX: 0.55, rightZ: 0.06, leftX: -0.12, leftZ: 0 };
  return { rightX: 0.78, rightZ: 0.17, leftX: -0.15, leftZ: 0 };
}

/** Per-frame posing: walk bob, equipment-aware attacks, sneak, and death. */
export function poseCharacter(group: THREE.Group, view: ActorView, timeSec: number): void {
  if (view.dead || view.downed) {
    group.rotation.x = -Math.PI / 2;
    group.position.y = view.y + 0.25;
    return;
  }
  group.rotation.x = 0;
  const hasPrevious = group.userData.lastX !== undefined && group.userData.lastPoseTime !== undefined;
  const distance = hasPrevious
    ? Math.hypot(group.userData.lastX - view.x, group.userData.lastZ - view.z)
    : 0;
  const dtSec = hasPrevious ? Math.max(0, timeSec - group.userData.lastPoseTime) : 0;
  const moving = hasPrevious && locomotionMoving(distance, dtSec, !!group.userData.locomotionMoving);
  group.userData.lastX = view.x;
  group.userData.lastZ = view.z;
  group.userData.lastPoseTime = timeSec;
  group.userData.locomotionMoving = moving;
  const bob = moving ? Math.abs(Math.sin(timeSec * 8)) * 0.06 : 0;
  const crouch = view.sneaking ? -0.25 : 0;
  group.position.y = view.y + bob + crouch;
  const baseScaleY = (group.userData.baseScaleY ??= group.scale.y) as number;
  group.scale.y = baseScaleY * (view.sneaking ? 0.85 : 1);
  const armR = group.getObjectByName('armR');
  const armL = group.getObjectByName('armL');
  const pose = characterCombatPose(view, moving, timeSec);
  if (armR) {
    armR.rotation.x = pose.rightX;
    armR.rotation.z = pose.rightZ;
  }
  if (armL) {
    armL.rotation.x = pose.leftX;
    armL.rotation.z = pose.leftZ;
  }
}

/** Pose camera-local arms from the same combat state as the world model. */
export function poseFirstPersonRig(rig: THREE.Group, view: ActorView, timeSec: number): void {
  const pose = characterCombatPose(view, false, timeSec);
  const armR = rig.getObjectByName('armR');
  const armL = rig.getObjectByName('armL');
  if (armR) armR.rotation.set(pose.rightX * 0.72, 0, 0.18 + pose.rightZ * 0.72);
  if (armL) armL.rotation.set(pose.leftX * 0.72, 0, -0.18 + pose.leftZ * 0.72);
  const activeKick = view.attackPhase === 'active' ? 0.06 : 0;
  rig.position.y = -0.4 - activeKick + Math.sin(timeSec * 2.4) * 0.005;
}
