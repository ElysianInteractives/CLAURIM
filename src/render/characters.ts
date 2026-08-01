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
  g.userData.rigType = 'humanoid';

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 1.18;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.66, 6), mat(cloth));
  body.name = 'body';
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.04), mat(cloth));
  chest.position.set(0, 0.12, 0.2);
  torso.add(body, chest);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.24, 6), mat(PALETTE.woodDark));
  pelvis.name = 'pelvis';
  pelvis.position.y = 0.78;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.36), mat(PALETTE.leather));
  belt.position.y = 0.88;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 7), mat(skin));
  neck.position.y = 1.55;

  const headPivot = new THREE.Group();
  headPivot.name = 'headPivot';
  headPivot.position.y = 1.57;
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.23, 0), mat(skin));
  head.position.y = 0.16;
  head.scale.set(0.9, 1.1, 0.92);
  head.name = 'head';
  const face = new THREE.Group();
  face.name = 'face';
  face.position.set(0, 0.16, 0.205);
  for (const x of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), new THREE.MeshBasicMaterial({ color: 0x2d2926 }));
    eye.position.set(x, 0.035, 0.005);
    face.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 5), mat(skin));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.045;
  face.add(nose);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(PALETTE.woodDark));
  hair.position.y = 0.16;
  hair.scale.set(0.92, 0.55, 0.94);
  headPivot.add(head, face, hair);

  for (const side of ['L', 'R'] as const) {
    const direction = side === 'L' ? -1 : 1;
    const arm = new THREE.Group();
    arm.name = `arm${side}`;
    arm.position.set(direction * 0.4, 1.42, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.115, 6, 5), mat(cloth));
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.34, 6), mat(cloth));
    upper.position.y = -0.17;
    const forearm = new THREE.Group();
    forearm.name = `forearm${side}`;
    forearm.position.y = -0.34;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.31, 6), mat(cloth));
    lower.position.y = -0.15;
    const hand = new THREE.Group();
    hand.name = `hand${side}`;
    hand.position.y = -0.31;
    const handMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), mat(skin));
    handMesh.position.y = -0.04;
    hand.add(handMesh);
    forearm.add(lower, hand);
    arm.add(shoulder, upper, forearm);
    g.add(arm);
  }

  for (const side of ['L', 'R'] as const) {
    const direction = side === 'L' ? -1 : 1;
    const leg = new THREE.Group();
    leg.name = `leg${side}`;
    leg.position.set(direction * 0.16, 0.78, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 0.4, 6), mat(PALETTE.woodDark));
    upper.position.y = -0.2;
    const knee = new THREE.Group();
    knee.name = `knee${side}`;
    knee.position.y = -0.4;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 6), mat(PALETTE.woodDark));
    lower.position.y = -0.18;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.34), mat(PALETTE.leather));
    boot.position.set(0, -0.36, 0.055);
    knee.add(lower, boot);
    leg.add(upper, knee);
    g.add(leg);
  }

  g.add(torso, pelvis, belt, neck, headPivot);
  if (hood) {
    const hoodMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 5), mat(cloth));
    hoodMesh.position.y = 0.47;
    headPivot.add(hoodMesh);
  }
  g.scale.setScalar(scale);
  return g;
}

function quadruped(fur: number, length: number, height: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.userData.rigType = 'quadruped';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, length), mat(fur));
  body.name = 'torso';
  body.position.y = height;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, length * 0.4), mat(fur));
  chest.position.set(0, height + 0.03, length * 0.28);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.35), mat(fur));
  neck.position.set(0, height + 0.18, length / 2);
  neck.rotation.x = -0.35;
  const headPivot = new THREE.Group();
  headPivot.name = 'headPivot';
  headPivot.position.set(0, height + 0.25, length / 2 + 0.2);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), mat(fur));
  head.name = 'head';
  head.scale.set(0.8, 0.72, 1.05);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.16, 0.28), mat(fur));
  snout.position.set(0, -0.04, 0.3);
  for (const x of [-0.11, 0.11]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), mat(fur));
    ear.position.set(x, 0.23, -0.03);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), new THREE.MeshBasicMaterial({ color: 0x211b18 }));
    eye.position.set(x * 0.75, 0.06, 0.23);
    headPivot.add(ear, eye);
  }
  headPivot.add(head, snout);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, height + 0.08, -length / 2);
  const tailA = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.48), mat(fur));
  tailA.position.z = -0.22;
  tailA.rotation.x = -0.25;
  const tailB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.35), mat(fur));
  tailB.position.set(0, 0.08, -0.55);
  tailB.rotation.x = -0.45;
  tail.add(tailA, tailB);
  for (const [name, lx, lz] of [
    ['legFL', -0.2, length / 2 - 0.18],
    ['legFR', 0.2, length / 2 - 0.18],
    ['legBL', -0.2, -length / 2 + 0.18],
    ['legBR', 0.2, -length / 2 + 0.18],
  ] as const) {
    const leg = new THREE.Group();
    leg.name = name;
    leg.position.set(lx, height - 0.08, lz);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, height * 0.72, 0.16), mat(fur));
    upper.position.y = -height * 0.34;
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.24), mat(fur));
    paw.position.set(0, -height * 0.7, 0.04);
    leg.add(upper, paw);
    g.add(leg);
  }
  g.add(body, chest, neck, headPivot, tail);
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
      eyeL.position.set(-0.08, 1.79, 0.2);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.08;
      g.add(eyeL, eyeR);
      character = g;
      break;
    }
    case 'wolf':
      character = quadruped(PALETTE.wolfFur, 1.1, 0.55);
      break;
    case 'hart': {
      const g = quadruped(PALETTE.hartFur, 1.15, 0.75, 1.05);
      const head = g.getObjectByName('head');
      if (head) {
        for (const side of [-1, 1]) {
          const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.62, 5), mat(PALETTE.bone));
          antler.name = side < 0 ? 'antlerL' : 'antlerR';
          antler.position.set(side * 0.16, 0.42, -0.02);
          antler.rotation.z = side * -0.28;
          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.3, 5), mat(PALETTE.bone));
          tine.position.set(side * 0.24, 0.58, 0.05);
          tine.rotation.z = side * -0.7;
          head.add(antler, tine);
        }
      }
      character = g;
      break;
    }
    case 'boar': {
      const g = quadruped(PALETTE.boarFur, 1.0, 0.62, 1.15);
      const head = g.getObjectByName('head');
      if (head) {
        for (const side of [-1, 1]) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 6), mat(PALETTE.bone));
          tusk.name = side < 0 ? 'tuskL' : 'tuskR';
          tusk.position.set(side * 0.14, -0.08, 0.36);
          tusk.rotation.x = Math.PI / 2;
          head.add(tusk);
        }
      }
      character = g;
      break;
    }
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
    cuirass.position.y = 1.18;
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
      const side = slot === 'mainHand' ? 'R' : 'L';
      const attachment = group.getObjectByName(`hand${side}`) ?? group.getObjectByName(`arm${side}`);
      if (!attachment) continue;
      node.position.set(0, mode === 'viewmodel' ? -0.04 : -0.06, mode === 'viewmodel' ? 0.1 : 0.08);
      if (mode === 'viewmodel') node.scale.setScalar(0.44);
      if (mode === 'world' && slot === 'mainHand' && CONTENT.items[itemId]?.weaponType !== 'bow') node.rotation.z = Math.PI;
      if (slot === 'offHand') node.rotation.y = Math.PI;
      attachment.add(node);
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
    const arm = new THREE.Group();
    arm.name = name;
    arm.position.set(x, -0.02, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.31, 0.13), mat(PALETTE.clothBlue));
    sleeve.position.y = -0.12;
    const hand = new THREE.Group();
    hand.name = name === 'armL' ? 'handL' : 'handR';
    hand.position.y = -0.29;
    hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.12, 0.12), mat(PALETTE.skinPale)));
    arm.add(sleeve, hand);
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
  const stride = moving ? Math.sin(timeSec * 8) : 0;
  const torso = group.getObjectByName('torso');
  const headPivot = group.getObjectByName('headPivot');

  if (group.userData.rigType === 'quadruped') {
    for (const [name, sign] of [['legFL', 1], ['legFR', -1], ['legBL', -1], ['legBR', 1]] as const) {
      const leg = group.getObjectByName(name);
      if (leg) leg.rotation.x = stride * 0.5 * sign;
    }
    const tail = group.getObjectByName('tail');
    if (tail) {
      tail.rotation.y = Math.sin(timeSec * (moving ? 7 : 3)) * (moving ? 0.35 : 0.18);
      tail.rotation.x = moving ? 0.12 : -0.08;
    }
    if (torso) {
      torso.rotation.z = stride * 0.025;
      torso.position.y = (group.userData.quadrupedTorsoY ??= torso.position.y) as number;
    }
    if (headPivot) headPivot.rotation.x = moving ? -0.08 + Math.abs(stride) * 0.08 : Math.sin(timeSec * 1.7) * 0.035;
    return;
  }

  const legL = group.getObjectByName('legL');
  const legR = group.getObjectByName('legR');
  const kneeL = group.getObjectByName('kneeL');
  const kneeR = group.getObjectByName('kneeR');
  if (legL) legL.rotation.x = stride * 0.55;
  if (legR) legR.rotation.x = -stride * 0.55;
  if (kneeL) kneeL.rotation.x = moving ? Math.max(0, -stride) * 0.68 : 0;
  if (kneeR) kneeR.rotation.x = moving ? Math.max(0, stride) * 0.68 : 0;
  if (torso) {
    torso.rotation.z = stride * 0.045;
    torso.rotation.x = view.sneaking ? 0.12 : 0;
    torso.rotation.y = view.attackPhase === 'windup' ? -0.12 : view.attackPhase === 'active' ? 0.2 : 0;
    torso.scale.set(1, 1 + Math.sin(timeSec * 2.2) * 0.012, 1);
  }
  if (headPivot) {
    headPivot.rotation.x = -view.aimPitch * 0.22;
    headPivot.rotation.y = moving ? -stride * 0.04 : Math.sin(timeSec * 0.7) * 0.025;
  }
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
  const forearmR = group.getObjectByName('forearmR');
  const forearmL = group.getObjectByName('forearmL');
  let rightForearmX = 0;
  let rightForearmZ = 0;
  let leftForearmX = 0;
  let leftForearmZ = 0;
  const type = weaponType(view);
  if (view.blocking) {
    rightForearmX = -0.35;
    leftForearmX = -0.72;
    leftForearmZ = -0.58;
  } else if (type === 'bow' && view.attackPhase) {
    rightForearmX = -0.92;
    rightForearmZ = 0.26;
    leftForearmX = -0.78;
    leftForearmZ = -0.38;
  } else if (view.attackKind === 'spell' && view.attackPhase) {
    rightForearmX = -0.5;
    leftForearmX = -0.42;
  } else if (view.attackPhase === 'windup') {
    rightForearmX = type === 'axe' ? 0.5 : 0.32;
  } else if (view.attackPhase === 'active') {
    rightForearmX = -0.55;
  } else if (moving) {
    rightForearmX = Math.max(0, stride) * 0.08;
    leftForearmX = Math.max(0, -stride) * 0.08;
  }
  if (forearmR) forearmR.rotation.set(rightForearmX, 0, rightForearmZ);
  if (forearmL) forearmL.rotation.set(leftForearmX, 0, leftForearmZ);
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
