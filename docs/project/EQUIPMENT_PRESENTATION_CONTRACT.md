# Equipment presentation contract

QA Phase G locks authoritative equipped-item visibility and weapon-specific
procedural combat posing without changing equipment effects, attack timing,
damage, collision, inventory ownership, or save formats.

## Replicated loadout

- Every render-facing `ActorView` carries a compact partial map from the six
  fixed equipment slots to authored item ids.
- Offline views copy the owning actor's authoritative equipment. Protocol v6
  carries the same map for every interest-scoped actor, including remote
  players; the self loadout retains its detailed fixed-slot view for the HUD.
- Clients never submit visual equipment state. Existing validated equip and
  unequip intent remains the only way to mutate authoritative gear.

## World presentation

- Main-hand weapons attach to the right arm; off-hand shields attach to the
  left. Body, head, feet, and amulet/mantle families attach to the character
  root and are created or removed when the replicated slot changes.
- Sword, dagger, axe/mace, bow, shield, cuirass, hood, boots, and mantle
  silhouettes are palette-driven primitive exemplars under D-011. Final asset
  quality may improve behind these factories without changing this contract.
- Legacy bandit-archer templates receive a presentation-only hunting bow when
  no authored main-hand item exists. This does not add inventory, stats, or
  gameplay authority and prevents the old hard-coded loose bow duplicate.

## First person and posing

- First person hides only the local world body and shows camera-local sleeves
  plus the same authoritative main/off-hand loadout. Armor slots remain on the
  third-person/world model and do not obstruct the first-person view.
- Sword/dagger, heavy axe/mace, bow, spell, and block states use distinct pure
  pose selection across windup, active, and recovery phases. The renderer
  consumes existing authoritative attack state and resolves no outcome.
- The first-person rig preserves the center reticle and horizon at 1280x720
  and 1920x1080; weapon or shield geometry may not cover the reticle at rest.

## Development QA loadout

The development-only `?qa=gear` start places the offline player at Fenharrow,
adds representative gear, and equips all six item slots. Production builds and
online clients continue to ignore named QA starts under D-037.

## Acceptance

Acceptance requires authoritative offline and protocol-v6 actor-view tests,
all visible slot families, equip/removal synchronization, distinct weapon pose
tests, matching first-person main/off-hand state, `npm run gate`,
`npm run net:bench`, `npm run mp:bench`, `npm run world:tour`, a real
two-client `npm run qa:ws`, and direct third-/first-person browser evidence at
1280x720 and 1920x1080 with no warning/error logs.
