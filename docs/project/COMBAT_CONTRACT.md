# Combat contract

Plan 2 turns the existing D-007 phase machine into an explicit, testable
player contract. The authoritative sim remains the only source of outcomes;
rendering, HUD, and audio consume views/events and never resolve damage.

## Action timing and input

At 30 Hz:

| Action | Windup | Active | Recovery | Cost point |
|---|---:|---:|---:|---|
| Melee | 8 ticks / 267 ms | 3 ticks / 100 ms | 10 ticks / 333 ms | 12 stamina when windup starts |
| Bow | 20 ticks / 667 ms | projectile release | 10 ticks / 333 ms | one arrow at release |
| Spell | 12 ticks / 400 ms | spell release | 10 ticks / 333 ms | spell magicka when windup starts |

- Windup and active frames are committed.
- One follow-up attack may be buffered during active or recovery. A later
  buffered input replaces the one-slot buffer.
- Block may cancel recovery, but cannot overlap windup or active frames.
- Downing, death, or an interrupt clears the current attack and its buffer.
- A rejected authoritative action emits `actionRejected` with a stable reason:
  busy, stamina, weapon, ammo, magicka, unknown, or incapacitated. The event is
  private to that player online and survives the command-to-tick boundary.

## Hit and mitigation rules

- Melee checks same space, hostility, 2.4 m horizontal range, a 100-degree
  facing arc, and a 1.5 m vertical envelope at the end of windup.
- Player attacks do not damage friendly NPCs or party members.
- Damage order remains armor (physical only), channel resistance, then block.
- Block applies only to blockable damage whose source is inside the defender's
  120-degree frontal arc. A successful block costs 8 stamina. Source-less
  effects and ground pools are not blockable.
- Projectiles sweep each 30 Hz movement segment. The earliest actor or world
  obstruction wins, independent of actor iteration order. World obstruction
  includes terrain, implicit interior-room walls, and authored solid-prop
  height/AABBs.

## Authoritative feedback

| Outcome/state | Visual | Audio cue |
|---|---|---|
| Valid aimed hostile | name, tier, numeric health meter | - |
| Player deals damage | target material flash + gold hit marker | short impact |
| Attack is blocked | blue confirmation marker | metallic double tone |
| Player takes damage | red marker + short vignette | low impact |
| Ability windup | exact frontal cone, target pool, or caster ring; interruptible shapes use amber | warning rise |
| Interrupt | feed confirmation | bright resolve |
| Down / revive | existing downed/recovery UI | low fall / rising recovery |
| Rejected action | reason in the notification feed | - |

Audio is a minimal synthesized browser-host layer. It unlocks on a user
gesture, rate-limits repeated cues, has no sim dependency beyond event types,
and is not yet a music, ambience, spatial-audio, or mixer system.

## Repeatable acceptance and measurement

- `npx vitest run tests/combat_correctness.test.ts` pins phase timing,
  buffering/cancellation, rejection reasons, melee height and friendly-fire
  rules, directional blocking, wall/prop projectile collision, and telegraph
  view data.
- `npx vitest run tests/multiplayer_sim.test.ts` pins interrupts, downing,
  reviving, release, wipe reset, threat, phases, and personal loot.
- `npm run combat:bench -- seconds=30` compares sustained weapon/spell output
  against one fixed target under natural resource regeneration.
- `npm run mp:bench -- runs=3` measures the exemplar boss across party sizes.
- `QA-CMB-SMOKE` remains the browser/playtest gate for target acquisition,
  hit/block/hurt feedback, danger shapes, audio, downing, and recovery.
