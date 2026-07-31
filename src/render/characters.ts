// Character meshes: compact stylized figures assembled from primitives, one
// factory per archetype. Simple procedural walk/attack posing driven from
// ActorView state (no gameplay logic here).

import * as THREE from 'three';
import type { ActorView } from '../world_api';
import { PALETTE } from './palette';

function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function humanoid(cloth: number, skin: number, scale = 1, hood = false): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.36), mat(cloth));
  body.position.y = 1.0;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), mat(skin));
  head.position.y = 1.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.24), mat(PALETTE.woodDark));
  legL.position.set(-0.16, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.2), mat(cloth));
  armL.position.set(-0.42, 1.05, 0);
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
  switch (archetype) {
    case 'player':
      return humanoid(PALETTE.clothBlue, PALETTE.skinPale);
    case 'villager_f':
      return humanoid(PALETTE.clothGreen, PALETTE.skinPale, 0.96);
    case 'villager_m':
      return humanoid(PALETTE.leather, PALETTE.skinPale, 1.02);
    case 'bandit':
      return humanoid(PALETTE.clothRed, PALETTE.skinPale, 1.0, true);
    case 'bandit_archer': {
      const g = humanoid(PALETTE.clothRed, PALETTE.skinPale, 0.95, true);
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.03, 4, 8, Math.PI),
        mat(PALETTE.woodDark),
      );
      bow.position.set(0.5, 1.1, 0);
      bow.rotation.z = Math.PI / 2;
      g.add(bow);
      return g;
    }
    case 'wight': {
      const g = humanoid(PALETTE.wightSkin, PALETTE.wightSkin, 1.25);
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: PALETTE.wightGlow }));
      eyeL.position.set(-0.08, 1.64, 0.18);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.08;
      g.add(eyeL, eyeR);
      return g;
    }
    case 'wolf':
      return quadruped(PALETTE.wolfFur, 1.1, 0.55);
    case 'rat':
      return quadruped(PALETTE.ratFur, 0.6, 0.25, 0.8);
    default:
      return humanoid(PALETTE.clothGreen, PALETTE.skinPale);
  }
}

/** Per-frame posing: walk bob, attack arm raise, sneak crouch, death fall. */
export function poseCharacter(group: THREE.Group, view: ActorView, timeSec: number): void {
  if (view.dead || view.downed) {
    group.rotation.x = -Math.PI / 2;
    group.position.y = view.y + 0.25;
    return;
  }
  group.rotation.x = 0;
  const moving = group.userData.lastX !== undefined &&
    (Math.abs(group.userData.lastX - view.x) > 0.005 || Math.abs(group.userData.lastZ - view.z) > 0.005);
  group.userData.lastX = view.x;
  group.userData.lastZ = view.z;
  const bob = moving ? Math.abs(Math.sin(timeSec * 8)) * 0.06 : 0;
  const crouch = view.sneaking ? -0.25 : 0;
  group.position.y = view.y + bob + crouch;
  group.scale.y = view.sneaking ? 0.85 : 1;
  const arm = group.getObjectByName('armR');
  if (arm) {
    arm.rotation.x = view.attacking ? -1.8 : view.blocking ? -0.9 : moving ? Math.sin(timeSec * 8) * 0.4 : 0;
  }
}
