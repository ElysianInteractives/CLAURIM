# Kaldwyn narrative expansion contract (D-044)

QA Phase L locks the first narrative use of D-043's Thornmere, Gloamroot, and
Weeping Stones content through the existing per-character quest and dialogue
runtimes.

## Quest and dialogue volume

- Content v0.5 contains three side quests and six NPC dialogues. The two new
  quests, `A Bitter Root` and `The Stone Toll`, use original Claurim names,
  prose, places, and situations.
- Tamsin Reed offers the Gloamroot sounder quest; Vael Orin offers the Weeping
  Stones investigation; Corren Pike provides wildlife and state-aware quest
  context. All three retain D-038 route-complete schedules.
- Both quests use only proven objective kinds (`reach`, `kill`, and `talkTo`),
  personal journals/rewards, existing party kill-credit rules, durable quest
  state, and existing reward/progression authority. No one-off scripted quest
  code is permitted.

## Conversation-state guarantee

- Dialogue entry selection observes the quest state that existed when the
  conversation began. The resulting `talkedTo` event is emitted only after an
  entry node has been captured.
- Therefore, a return-stage `talkTo` objective may complete and reward the
  quest without replacing its authored turn-in scene with the completed-state
  greeting. Subsequent conversations use the completed entry normally.
- Choice conditions and actions continue to evaluate against current
  authoritative character state. This ordering changes no quest credit,
  reward, persistence, multiplayer, protocol, or save ownership rule.

## Acceptance

- `tests/world_narrative_expansion.test.ts` completes both new quests through
  real dialogue acquisition, reach polling, authored encounters, save/load,
  rewards, visible return scenes, and post-quest reactions.
- `tests/quest_playthrough.test.ts` also pins the corrected visible turn-in for
  `The Hollow Delve`. Generic content validation resolves every quest,
  objective, condition, action, node, and reward reference; the originality
  gate checks all new prose.
- The full gate, all five benchmark/traversal programs, and real WebSocket
  smoke remain green. Browser QA accepts both new quests at their scheduled
  NPC positions, verifies the journal, checks 1280x720 and 1920x1080, and
  requires empty warning/error logs.

## Deliberately separate locks

Main-story orchestration, faction reputation/ranks, branching consequences,
world-state mutation, escort/defend/crafting objective kinds, shared party
dialogue, cinematic scenes, voiced assets, radiant generation, and quest
markers remain separate work.
