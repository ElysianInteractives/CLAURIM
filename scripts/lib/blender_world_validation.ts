import type {
  BlenderWorldExport,
  BlenderWorldPlacement,
  BlenderWorldSnapshot,
} from './blender_world_bridge';

const PLACEMENT_ID = /^[a-z][a-z0-9_-]*$/;

function finiteTransform(placement: BlenderWorldPlacement): boolean {
  return [
    placement.transform?.x,
    placement.transform?.y,
    placement.transform?.z,
    placement.transform?.yaw,
  ].every(Number.isFinite);
}

function placementKey(placement: Pick<BlenderWorldPlacement, 'recordType' | 'id'>): string {
  return `${placement.recordType}:${placement.id}`;
}

function closeNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.00001;
}

function placementsEquivalent(a: BlenderWorldPlacement, b: BlenderWorldPlacement): boolean {
  return a.recordType === b.recordType
    && a.id === b.id
    && a.spaceId === b.spaceId
    && a.kind === b.kind
    && a.grounded === b.grounded
    && a.solid === b.solid
    && a.assetId === b.assetId
    && closeNumber(a.transform.x, b.transform.x)
    && closeNumber(a.transform.y, b.transform.y)
    && closeNumber(a.transform.z, b.transform.z)
    && closeNumber(a.transform.yaw, b.transform.yaw)
    && (a.dimensions === undefined) === (b.dimensions === undefined)
    && (!a.dimensions || !b.dimensions || a.dimensions.every((value, index) => closeNumber(value, b.dimensions![index])))
    && JSON.stringify(a.data) === JSON.stringify(b.data);
}

export interface BlenderWorldValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateBlenderWorldExport(
  snapshot: BlenderWorldSnapshot,
  exported: BlenderWorldExport,
): BlenderWorldValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (exported.schemaVersion !== snapshot.schemaVersion) errors.push('export schemaVersion does not match the current bridge');
  if (exported.sourceContentVersion !== snapshot.contentVersion) errors.push('export sourceContentVersion is stale');
  if (exported.runtimeAuthority !== 'proposal') errors.push('export runtimeAuthority must remain proposal during A2');
  if (!Array.isArray(exported.placements)) return { errors: [...errors, 'export placements must be an array'], warnings };

  const spaces = new Set(snapshot.spaces.map((space) => space.id));
  const assets = new Set(snapshot.assets.map((asset) => asset.id));
  const baseline = new Map(snapshot.placements.map((placement) => [placementKey(placement), placement]));
  const seen = new Set<string>();
  const props = new Map<string, BlenderWorldPlacement>();

  for (const placement of exported.placements) {
    const prefix = `${placement?.recordType ?? '<type>'}:${placement?.id ?? '<id>'}`;
    const key = placementKey(placement);
    if (seen.has(key)) errors.push(`${prefix}: duplicate placement key`);
    seen.add(key);
    if (!['prop', 'door', 'container', 'spawner', 'landmark'].includes(placement.recordType)) {
      errors.push(`${prefix}: unsupported recordType`);
    }
    if (!PLACEMENT_ID.test(placement.id ?? '')) errors.push(`${prefix}: invalid stable placement id`);
    if (!spaces.has(placement.spaceId)) errors.push(`${prefix}: unknown space ${placement.spaceId}`);
    if (!placement.kind) errors.push(`${prefix}: kind is required`);
    if (!finiteTransform(placement)) errors.push(`${prefix}: transform values must be finite`);
    if (placement.assetId && !assets.has(placement.assetId)) errors.push(`${prefix}: unknown asset ${placement.assetId}`);
    if (placement.recordType === 'prop') {
      props.set(placement.id, placement);
      if (!placement.dimensions || placement.dimensions.some((dimension) => !(dimension > 0))) {
        errors.push(`${prefix}: prop dimensions must be positive`);
      }
    }
    if (!baseline.has(key) && (placement.recordType !== 'prop' || !placement.assetId)) {
      errors.push(`${prefix}: A2 additions must be asset-backed props`);
    }
  }

  for (const [key] of baseline) {
    if (!seen.has(key)) errors.push(`${key}: baseline placement may not be deleted during A2`);
  }
  for (const placement of exported.placements) {
    if (placement.recordType !== 'door') continue;
    const anchorId = placement.data?.anchor_prop_id;
    if (typeof anchorId !== 'string' || anchorId.length === 0) continue;
    const prop = props.get(anchorId);
    if (!prop) errors.push(`door:${placement.id}: missing anchor prop ${anchorId}`);
    else if (prop.spaceId !== placement.spaceId) errors.push(`door:${placement.id}: anchor prop must share its space`);
  }

  const changed = exported.placements.filter((placement) => {
    const original = baseline.get(placementKey(placement));
    return original && !placementsEquivalent(original, placement);
  });
  if (changed.length > 0) {
    warnings.push(`${changed.length} baseline placements differ from TypeScript authority; A2 keeps them proposal-only`);
  }
  return { errors, warnings };
}

export function validateInitialRoundTrip(
  snapshot: BlenderWorldSnapshot,
  exported: BlenderWorldExport,
): string[] {
  const errors: string[] = [];
  if (exported.placements.length !== snapshot.placements.length) {
    errors.push(`round trip placement count ${exported.placements.length} != ${snapshot.placements.length}`);
  }
  const actual = new Map(exported.placements.map((placement) => [placementKey(placement), placement]));
  for (const expected of snapshot.placements) {
    const received = actual.get(placementKey(expected));
    if (!received) errors.push(`${placementKey(expected)}: missing from round trip`);
    else if (!placementsEquivalent(received, expected)) errors.push(`${placementKey(expected)}: round trip drift`);
  }
  return errors;
}
