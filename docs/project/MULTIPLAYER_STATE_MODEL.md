# Multiplayer state model (D-013 / D-019 / D-020 / D-021 / D-029)

## Identity
- CharacterId: persistent string, the durable identity ('alva'). Validated
  charset, doubles as storage key.
- Connection id: transport-scoped, owned by the server host, never persisted.
- EntityId: runtime id inside one world; a character's entity id may differ
  across sessions (the character record stores no entity id).

## One Sim, many characters
`Sim.players: Map<CharacterId, EntityId>`; per-character state lives in
keyed maps on Sim (quest logs, known spells, equipped spell hotkeys,
container-loot sets, dialogue
sessions, shop sessions, movement transients). `tick()` takes a per-character
input map; player order is sorted charId, actor order ascending entity id
(determinism). The world is NEVER cloned per client.

## State classification
| State | Scope |
|---|---|
| Quest journals, objectives, rewards | per-character |
| Known/equipped spells, skills, perks, level/xp, inventory, equipment, gold | per-character |
| Dialogue + shop sessions | per-character (parallel sessions allowed; one player talking never opens menus for others) |
| Container loot | per-character (deterministic personal roll keyed container+char) |
| Corpse loot: standard tier | shared corpse, first-looter |
| Corpse loot: elite/boss tier | PERSONAL: independent roll delivered to each eligible party member (same space, party of killer) |
| Enemy state, spawner cleared/respawn, world deltas | shared world |
| Encounter state (threat, phase, scaling, pools, summons) | shared world, transient (resets on wipe/leash; not saved) |
| Party membership | shared world, persisted in the world save |
| Downed/downedTicks | per-character actor state, persisted |

## Party
`Sim.parties: Map<PartyId, CharacterId[]>`. Characters start solo. A player
may invite one nearby active character; the target explicitly accepts or
declines, and either member can leave. Parties are capped at five. Accepted
membership persists through disconnect and world restart; pending invitations
are transient and disappear when either character leaves the live world.
Save schema v3 removes the old automatic `fellowship` membership on upgrade.
Party effects remain shared kill quest credit within ENGAGE_RADIUS + same
space, personal boss loot eligibility, revive access, encounter scaling, and
the party frame. Offline members remain visible but do not count as active.

## Nearby chat
Enter opens a focused HUD composer, Enter/Send submits, and Escape cancels.
The server strips control characters, normalizes whitespace, caps messages at
200 code points, throttles each client to one accepted line per 15 ticks, and
delivers the event only to characters in the speaker's current space.

## Quest credit rules
kill: killer + nearby party members (60 m, same space). collect/talkTo/
interact/reach: personal. Mid-quest joiners: party kill credit applies only
to objectives in their CURRENT stage - members at different stages progress
at their own stage (tested). Repeatable/daily/account-wide classes are
declared in the model but not yet used by content.

## Downed / revive / release (D-021)
Player at 0 HP -> downed (not dead): cannot act/move, immune to further
damage, invisible to enemy threat. Party interact revives at 30% HP.
Auto-release after 30 s -> teleport to recovery point (interior: its exit
door; exterior: Falkmoor waystone) at 40% HP. Wipe (no standing player in a
boss's space while engaged): encounter resets fully (heal, rehome, clear
threat/phase/cooldowns/scaling, despawn summons, clear pools) and downed
players release immediately. Scaling re-locks on the next engage for the
party actually present (anti-exploit: no mid-fight recount, D-018).

## Join / leave / reconnect
Join: restore from character storage or create fresh at Falkmoor. Leave:
persist + despawn (no linkdead body in this milestone) while retaining
accepted party membership. Reconnect: restore exactly (position, journal,
inventory, party; downed state cleared to released values via
extractCharacter policy). Server restart: world save restores world deltas
and party/name records; characters rejoin individually.

## Saves
World schema v5 (explicit spell/consumable hotkeys and partial personal containers), migrations v1->v2->v3->v4->v5 + tests.
Character schema v3 (spell/consumable hotkeys and partial personal containers), migrations v1->v2->v3 + tests.
