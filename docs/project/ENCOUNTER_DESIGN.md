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
Aggro pulls same-spawner allies within 20 m (multi-enemy pulls are the norm).
Encounter scaling LOCKS at first aggro to the count of players within 60 m:
maxHealth x(1 + 0.6/extra player), damage x(1 + 0.12/extra player), applied
through the standard modifier system (auditable in stat traces). Rapid
enter/exit cannot recount mid-fight; only a full reset unlocks (anti-exploit).

## The exemplar: Duskhollow Mine (group dungeon)
- Gate camp (exterior): 2 raiders + rock-perch archer + Redclaw Reaver
  (veteran, interruptible 110-degree cleave) - the interrupt/priority lesson.
- Flooded gallery: 5 marsh rats + Mire Matron (support healer, interruptible
  heal) - the kill-the-healer-first lesson.
- Deep corridor: 2 barrow thralls - a pull that punishes charging ahead.
- The Pale Vault: The Pale Warden (boss, 380 base HP, frost):
  - pale_breath: 1.5 s telegraphed frontal cone, 42 frost, INTERRUPTIBLE.
  - grave_chill: pools under the current target (move or melt).
  - call_thralls: phase-1 unlock, 2 adds per cast (priority targets).
  - Phase 2 (<=33%): +30% damage escalation.
  - Wipe -> deterministic full reset; personal loot per party member.

## Difficulty targets and MEASURED baseline (npm run mp:bench, 2026-07-31)
Targets: overworld solo-viable; dungeons for ~3-5; bosses defeat an
unprepared solo player; success from mechanics, not damage sponging.
Scripted bot parties (iron sword + shield + 3 draughts; naive AI that never
blocks, clusters in cleaves, and rarely revives) against the boss:

| party | runs | kills | avg kill time | wipes | max phase |
|---|---|---|---|---|---|
| 1 | 3 | 0 | - | 9 (limit 3/run) | 1 |
| 3 | 3 | 1 | 25 s | 6 | 2 |
| 5 | 3 | 2 | 24 s | 3 | 2 |

Reading: the boss reliably defeats solo players; clumsy parties of 3 can
win; parties of 5 win more often; success scales with numbers and the bots'
biggest killer is standing in the cleave (mechanics matter). Real players
who block, interrupt, spread, and revive will outperform these floors.
Remaining uncertainty: bot quality bounds the estimate from below; a
blocking/interrupting bot policy is an Opus benchmark ticket (OB-M6).

## Death and recovery
See MULTIPLAYER_STATE_MODEL.md (downed 30 s / revive 30% / release 40% at
the recovery point; boss wipe resets; no durability loss; re-entering a
resetting encounter re-locks scaling). Copied from no other game wholesale:
the downed-revive loop fits Claurim's party-first dungeons, the free
walk-back keeps early dungeons approachable, and penalties can harden later
with measurement.
