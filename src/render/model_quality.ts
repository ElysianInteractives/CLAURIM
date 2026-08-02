import * as THREE from 'three';

export type ModelDetail = 'high' | 'medium';

export const CHARACTER_HIGH_DETAIL_ENTER = 20;
export const CHARACTER_HIGH_DETAIL_EXIT = 26;
export const CHARACTER_RENDER_ENTER = 100;
export const CHARACTER_RENDER_EXIT = 120;

export const HUMANOID_RIG_NODES = [
  'torso', 'headPivot', 'face',
  'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR',
  'legL', 'legR', 'kneeL', 'kneeR',
] as const;

export const QUADRUPED_RIG_NODES = [
  'torso', 'headPivot', 'head', 'tail',
  'legFL', 'legFR', 'legBL', 'legBR',
] as const;

/** Distance LOD with hysteresis. The local player and viewmodel always stay high. */
export function characterModelDetail(
  distance: number,
  current: ModelDetail | undefined,
  localPlayer = false,
): ModelDetail {
  if (localPlayer) return 'high';
  if (!Number.isFinite(distance)) return 'medium';
  if (current === 'high') return distance > CHARACTER_HIGH_DETAIL_EXIT ? 'medium' : 'high';
  return distance < CHARACTER_HIGH_DETAIL_ENTER ? 'high' : 'medium';
}

/** Device-pressure override. The controlled local model remains high while
 * surrounding actors use their socket-compatible medium rig. */
export function presentedCharacterDetail(
  distance: number,
  current: ModelDetail | undefined,
  localPlayer: boolean,
  performanceTier: boolean,
): ModelDetail {
  if (performanceTier && !localPlayer) return 'medium';
  return characterModelDetail(distance, current, localPlayer);
}

/** Fog-aware actor culling with hysteresis; gameplay visibility is unaffected. */
export function characterWithinRenderDistance(
  distance: number,
  currentlyRendered: boolean,
  localPlayer = false,
): boolean {
  if (localPlayer) return true;
  if (!Number.isFinite(distance)) return false;
  return distance <= (currentlyRendered ? CHARACTER_RENDER_EXIT : CHARACTER_RENDER_ENTER);
}

export function missingRigNodes(
  root: THREE.Object3D,
  kind: 'humanoid' | 'quadruped',
): string[] {
  const required = kind === 'humanoid' ? HUMANOID_RIG_NODES : QUADRUPED_RIG_NODES;
  return required.filter((name) => !root.getObjectByName(name));
}

/** Rendered triangle estimate; instances count once per submitted instance. */
export function modelTriangleCount(root: THREE.Object3D, visibleOnly = false): number {
  let triangles = 0;
  const visit = (object: THREE.Object3D): void => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    const perMesh = geometry.index
      ? geometry.index.count / 3
      : (geometry.getAttribute('position')?.count ?? 0) / 3;
    triangles += perMesh * (object instanceof THREE.InstancedMesh ? object.count : 1);
  };
  if (visibleOnly) root.traverseVisible(visit);
  else root.traverse(visit);
  return Math.round(triangles);
}
