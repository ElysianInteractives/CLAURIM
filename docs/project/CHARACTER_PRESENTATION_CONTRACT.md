# Articulated character presentation contract

QA Phase I locks the shared articulated low-poly rig and full-body procedural
posing without changing actor collision, movement, combat timing/outcomes,
equipment authority, snapshots, or saves.

## Humanoid rig

- Every humanoid factory provides stable named torso, head/face, shoulder,
  upper-arm, forearm, hand, hip/leg, and knee nodes. Equipment attaches to
  hands while the six-slot D-039 synchronizer remains authoritative.
- The readable baseline uses tapered six-sided torsos and limbs, faceted
  heads/hands, shoulders, neck, pelvis/belt, boots, eyes, nose, and fitted hair
  or hood silhouettes. Archetype color, scale, hood, and wight glow variation
  remains factory-driven.
- This is the improved D-011 code-native exemplar, not a GLB pipeline. Later
  assets may replace geometry behind the same stable rig/attachment contract.

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

Acceptance requires hierarchy/detail tests, locomotion hips/knees/torso tests,
bow/block secondary-joint tests, quadruped leg/tail tests, the existing
equipment-presentation suite, `npm run ai:bench`, the full `npm run gate`, and
direct close/armored/first-person browser checks at 1280x720 and 1920x1080
with no warning/error logs.
