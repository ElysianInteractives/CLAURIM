# Articulated character presentation contract

QA Phase I locks the shared articulated rig and full-body procedural posing.
QA Phase N extends its geometry with game-ready high/medium detail tiers while
preserving actor collision, movement, combat timing/outcomes, equipment
authority, snapshots, and saves.

## Humanoid rig

- Every humanoid factory provides stable named torso, head/face, shoulder,
  upper-arm, forearm, hand, hip/leg, and knee nodes. Equipment attaches to
  hands while the six-slot D-039 synchronizer remains authoritative.
- The close tier uses smooth torso/limb volumes and richer face, hand, hair,
  clothing, armor, and equipment silhouettes. The medium tier simplifies
  geometry but retains every required rig and attachment node. Archetype
  color, scale, hood, and wight glow variation remains factory-driven.
- The local player is always high detail. Remote actors use 20 m enter / 26 m
  exit hysteresis and 100 m enter / 120 m exit presentation culling. Neither
  selection affects simulation state.
- A lazy Meshopt-capable GLB/glTF registry can replace an archetype only after
  validating required nodes and triangle limits. Code-native high-detail
  models remain the shipped fallback. Exact limits and authority boundaries
  are in `HIGH_FIDELITY_RENDERING_CONTRACT.md`.

## Motion

- Renderer-observed locomotion drives opposing hip swing, non-negative knee
  bend, subtle torso weight shift, reduced bob, idle breathing/head drift, and
  aim-pitch head response. D-038 speed hysteresis still owns walk start/stop.
- D-039 weapon-family shoulder poses remain pure. Bow, block, spell, melee
  windup, and melee active phases add deterministic elbow/forearm intent;
  equipment follows the full joint chain.
- Sneak leans/compresses the presented rig. Downed/dead state retains the
  established whole-body fall and resolves no gameplay.

## Creatures and first person

- Quadrupeds provide named front/back leg pivots, a head pivot, muzzle/ear/eye
  detail, chest/neck volume, paws, and a two-piece tail. Movement alternates
  diagonal legs and adds head/tail/torso motion instead of rigid sliding.
- The first-person rig now has explicit hands used by the same weapon/shield
  attachment lookup. Its Phase G reticle/horizon framing remains unchanged.

## Acceptance

Acceptance requires hierarchy/detail and high/medium socket-parity tests,
locomotion hips/knees/torso tests, bow/block secondary-joint tests, quadruped
leg/tail tests, the existing equipment-presentation suite, populated exterior
budgets, `npm run ai:bench`, the full `npm run gate`, and direct close,
armored, first-person, settlement, and wildlife browser checks with no
warning/error logs.
