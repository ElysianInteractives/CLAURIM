# Encounter design (D-017 / D-018 / D-021)

## Combat model
Third-person ACTION combat with MMO party structure: positioning, blocking,
telegraphs, interrupts, and target priority decide fights - not tab-target
rotations and not raw damage alone.

## Tiers and roles
Tiers: standard / veteran / elite / boss (ActorTemplate.tier). Roles:
melee / ranged / support (role). Data-driven abilities (ai/abilities.ts):
frontal_cone (telegraphed cleave/breath), ground_aoe (area denial pools),
summon (reinforcement waves), heal_ally (support pressure). Telegraphs are
visible casts (`telegraph` events + renderer warning rings); interruptible
casts cancel when INTERRUPT_DAMAGE (25) lands during the windup, unless
interruptImmune. Phases (descending healthFrac) unlock abilities and damage
multipliers; bossPhase events feed the HUD.

## Threat (D-017)
Explicit per-enemy threat tables: damage adds THREAT_PER_DAMAGE, healing a
targeted ally adds THREAT_PER_HEAL on the healed target (keeps tanks sticky,
keeps healers from instant pulls), 3%/s decay, target switch only past a
1.25x hysteresis factor, full reset on leash/wipe. Downed players leave
threat. No rigid trinity is required, but defensive play holds attention
predictably. Taunts: a declared hook (add a large threat bump through the
same table) - not yet a player ability.

## Group aggro + scaling
Aggro pulls every living member of the spawner's authored `encounterId`;
untagged content falls back to its individual spawner. Summons inherit the
root owner. Encounter scaling LOCKS at first aggro to the count of players
within 60 m: maxHealth x(1 + 0.4/extra player), damage x(1 + 0.08/extra
player), applied through the standard modifier system (auditable in stat
traces). Rapid enter/exit cannot recount mid-fight; only one atomic full
encounter reset unlocks it (anti-exploit). See `AI_ENCOUNTER_CONTRACT.md`.

## The exemplar: Duskhollow Mine (group dungeon)
- Gate camp (exterior): 2 raiders + rock-perch archer + Redclaw Reaver
  (veteran, interruptible 110-degree cleave) - the interrupt/priority lesson.
- Flooded gallery: 5 marsh rats + Mire Matron (support healer, interruptible
  heal) - the kill-the-healer-first lesson.
- Deep corridor: 2 barrow thralls - a pull that punishes charging ahead.
- The Pale Vault: The Pale Warden (boss, 380 base HP, frost):
  - pale_breath: 1.5 s telegraphed frontal cone, 42 frost, INTERRUPTIBLE.
  - grave_chill: pools under the current target (move or melt).
  - call_thralls: phase-1 unlock, 2 adds per cast, 4 living adds maximum
    (priority targets).
  - Phase 2 (<=33%): +30% damage escalation.
  - Wipe -> deterministic full reset; personal loot per party member.

## Plan 4 two-policy baseline (`npm run ai:bench`, 2026-07-31)

Correct faction allegiance means the Warden and its thralls are allies rather
than damaging one another. The prior +60% health/+12% damage extra-player
curve was therefore retuned to +40%/+8%; solo base values did not change.
Both policies use identical fixed seeds, iron sword/shield, three draughts,
and the same encounter. The mechanics policy pre-moves target pools, spreads
on approach, blocks, prioritizes adds, and actively revives.

| policy | party | kills | avg kill | wipes | downs | revives | blocks | damage taken | max phase |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| naïve | 1 | 0/3 | - | 5 | 23 | 0 | 0 | 1,775.1 | 0 |
| mechanics | 1 | 0/3 | - | 6 | 23 | 0 | 14 | 1,410.7 | 0 |
| naïve | 3 | 1/3 | 80 s | 6 | 79 | 46 | 0 | 5,467.0 | 2 |
| mechanics | 3 | 1/3 | 57 s | 5 | 65 | 41 | 53 | 4,714.2 | 2 |
| naïve | 5 | 0/3 | - | 8 | 180 | 95 | 0 | 11,593.2 | 2 |
| mechanics | 5 | 1/3 | 166 s | 8 | 99 | 39 | 54 | 8,108.5 | 2 |

The prepared solo policy still cannot reach phase 1. Mechanics-aware parties
take 14-30% less damage, and the five-player policy earns a clear where the
naïve one does not; downs remain high, so this is evidence for mechanic value
and a lower performance bound, not a final “easy” verdict. Plan 4 browser
observation confirms telegraph, party, add-cap, and support-heal readability;
the fixed-seed benchmark supplies the clear evidence.

## Original naïve baseline (`npm run mp:bench`, 2026-07-31)

Targets: overworld solo-viable; dungeons for ~3-5; bosses defeat an
unprepared solo player; success from mechanics, not damage sponging.
Scripted bot parties (iron sword + shield + 3 draughts; naive AI that never
blocks, clusters in cleaves, and rarely revives) against the boss:

| party | runs | kills | avg kill time | wipes | max phase |
|---|---|---|---|---|---|
| 1 | 3 | 0 | - | 9 (limit 3/run) | 1 |
| 3 | 3 | 2 | 25 s | 3 | 2 |
| 5 | 3 | 2 | 23 s | 3 | 2 |

Reading: the boss reliably defeats solo players; clumsy parties of 3 and 5
can win. Plan 3's physically swept navigation and accurate prop footprints
replace the earlier coarse-world baseline, so enemies and bots take different
routes without any D-024 combat-number change. The bots' biggest killer
remains standing in cleaves (mechanics matter). Real players who block,
interrupt, spread, and revive should outperform these floors.
This older result predates correct undead allegiance and remains historical
context only. Use the Plan 4 two-policy table for current tuning.

## Plan 2 sustained-output baseline (`npm run combat:bench -- seconds=30`)

Same fixed boss target, 30 seconds, natural regeneration, buffered legal
inputs, authoritative mitigation:

| loadout | hits | damage | DPS | resource wait |
|---|---:|---:|---:|---:|
| worn dagger | 40 | 229.6 | 7.65 | 1.8 s stamina |
| iron sword | 40 | 362.2 | 12.07 | 1.8 s stamina |
| steel sword | 40 | 455.4 | 15.18 | 1.8 s stamina |
| hunting bow | 30 | 170.7 | 5.69 | 0.0 s |
| Flamebolt | 13 | 132.4 | 4.41 | 20.5 s magicka |

This table is a regression comparison, not a final balance verdict. Bow range
and Flamebolt's burning utility are not represented by direct-hit DPS.

## Death and recovery
See MULTIPLAYER_STATE_MODEL.md (downed 30 s / revive 30% / release 40% at
the recovery point; boss wipe resets; no durability loss; re-entering a
resetting encounter re-locks scaling). Copied from no other game wholesale:
the downed-revive loop fits Claurim's party-first dungeons, the free
walk-back keeps early dungeons approachable, and penalties can harden later
with measurement.
