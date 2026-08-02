declare module 'three/examples/jsm/utils/BufferGeometryUtils.js' {
  import type { BufferGeometry } from 'three';

  export function mergeGeometries(
    geometries: readonly BufferGeometry[],
    useGroups?: boolean,
  ): BufferGeometry | null;
}

declare module 'three/examples/jsm/utils/SkeletonUtils.js' {
  import type { Object3D } from 'three';

  export function clone<T extends Object3D>(source: T): T;
}
