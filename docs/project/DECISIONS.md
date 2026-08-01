# Architectural decisions (LOCKED unless a defect is demonstrated)

Format: id, decision, rationale, alternatives rejected, status.

## D-001: One deterministic sim, IWorld seam, multiple hosts - LOCKED
The ClaudeCraft model, adopted after studying `levy-street/world-of-claudecraft`
(root CLAUDE.md + tests/architecture.test.ts): `src/sim/` is host-agnostic and
deterministic; `src/world_api/` (`IWorld`, per-domain facets) is the only
surface render/ui/hosts may use; outcomes resolve in the sim. Rejected:
renderer-coupled gameplay (kills headless/server hosts), ECS frameworks
(dependency weight, no proven need at this scale).
Guard: `tests/architecture.test.ts`.

## D-002: SimContext seam for system modules - LOCKED
System modules (combat, ai, quests, inventory, effects, dialogue, progression)
export functions that receive `SimContext`; state stays on `Sim` as live views.
Adopted from ClaudeCraft's proven pattern. Rejected: methods on a god-class
Sim (unreviewable growth); free-floating singletons (kills multi-sim isolation
needed for tests and future server realms).

## D-003: 30 Hz fixed tick - LOCKED
`TICK_RATE = 30` (`src/sim/types.ts`). ClaudeCraft uses 20 Hz for an MMO;
Claurim's first-person melee wants finer attack-phase granularity (windup 8 /
active 3 / recover 10 ticks at 33 ms each). 60 Hz doubles sim cost for little
gain at this combat pacing. Renderer runs at rAF; D-031 smooths observed
transforms in the host without changing this authoritative rate.

## D-004: Cells + activity window; actors persist, AI ticks locally - LOCKED
`CELL_SIZE = 64`, `ACTIVE_RADIUS = 2` (5x5 block). The sim keeps ALL actors in
memory (region scale makes this cheap: <100 actors; quest references stay valid
with no proxy/alias system) but ticks AI only inside the active window around
the player; the renderer streams terrain meshes per cell and disposes on exit.
Interiors are always-active while occupied. Rejected: full actor
serialization per cell (premature; adds a hard class of bugs before a second
region exists - revisit when actor count approaches ~2000 per region).

## D-005: Terrain = pure analytic authored features + fbm detail - LOCKED
`terrainHeight(x, z, seed)` is a pure function combining authored features
(mountain rim, river carve, settlement/ruin plateaus, road-bed flattening
along a control polyline) with fbm noise for detail. Every consumer samples
the same function. Rejected: stored heightmap assets (asset pipeline burden,
merge conflicts, no diffable authoring); voxel terrain (scope; revisit for
caves-with-overhangs later - interiors currently cover that need).

## D-006: Content is data-as-code with an in-repo validator - LOCKED
TS record tables in `src/sim/content/`, typed by `schema.ts`, validated by
`validateContent` (~all cross-references checked). Rejected: zod/JSON-schema
dependency (the validator is <300 lines, dependency-free, and produces exact
domain errors); JSON files (lose types, comments, and refactoring).

## D-007: Combat model: phase state machines + authoritative resolution - LOCKED
Attacks are windup/active/recover tick machines on the actor; melee resolves
once at windup end via range+arc; projectiles are simulated entities;
mitigation = armor DR (physical) -> resist channel -> block. Constants in
`types.ts`. Damage flows ONLY through `dealDamage`. Sneak attacks multiply at
resolution if the target's brain is not in combat.

Plan 2 amendment: melee also validates a 1.5 m vertical envelope and hostility;
projectiles sweep against actors, terrain, implicit interior walls, and solid
props; block requires a blockable source in a 120-degree frontal arc. One
follow-up input buffers during active/recovery, and block may cancel recovery
but never windup/active. Exact rules and rejection reasons:
`COMBAT_CONTRACT.md`.

## D-008: One modifier system for all stat changes - LOCKED
`StatModifier {stat, op add|mul, value, source}`; composition order
base -> adds -> muls -> clamps (`effects/modifiers.ts`). Equipment, perks,
skills, and timed effects all express through it; `recalcActorStats` is the
only writer of derived stats. Rejected: per-domain ad-hoc stat patching (the
classic irreversibility trap).

## D-009: Versioned JSON save envelope + linear migrations - LOCKED
`SAVE_SCHEMA_VERSION`, migration registry v->v+1, structural validation,
reject-never-half-load (`src/sim/save/save.ts`). Full actor snapshot rather
than delta-vs-content (simpler, correct at region scale; delta encoding is a
size optimization to revisit with streaming saves). Golden round-trip +
migration tests pinned in `tests/save.test.ts`.

## D-010: Quest/dialogue as data-interpreted state machines - LOCKED
Quests: stages -> objectives (kill/collect/talkTo/reach/interact) with
event-driven credit + polled reach; dialogue: condition-gated entries/choices
with action lists (`quest_runtime.ts`, `dialogue_runtime.ts`). No quest logic
inline in gameplay code. Exemplar: The Hollow Delve.

## D-011: Renderer style: flat-shaded low-poly primitives, palette module - LOCKED for the slice
All colors from `render/palette.ts`; characters/props are assembled
primitives; terrain is vertex-colored by biome. A GLB asset pipeline
(ClaudeCraft's image-to-glb style) is the planned upgrade path and must slot
in behind `buildCharacter`/`buildProp` without touching the sim.

## D-013: Multiplayer state model - LOCKED (2026-07-31 MMO pivot)
One authoritative Sim hosts many characters: `players: Map<CharacterId,
EntityId>`, per-character keyed state (journals, spells, container loot,
dialogue/shop sessions, transients), per-character input map into `tick()`.
The world is never cloned per client. CharacterId (persistent) is distinct
from connection id (transport) and EntityId (runtime). Deliberate seam
evolution: SimContext's single-player `quests` view was REPLACED by
charId-parameterized members (documented exception to append-only; all
callers migrated, fixtures updated, invariants preserved).
Full model: MULTIPLAYER_STATE_MODEL.md. Rejected: sim-per-client with state
merge (unsolvable divergence), player-list bolted onto a primary-player core
(hidden singletons keep leaking - the refactor removed them instead).

## D-014: Server-authoritative WebSocket protocol v1 - LOCKED
Dedicated Node server (`ServerCore`, transport-agnostic) owns the sim;
`ws` adapter; versioned validated JSON messages; clients send intent only
(never positions); 10 Hz interest-scoped self-contained snapshots over the
cell architecture; per-client event filtering. P2P rejected as final
architecture. Details + measured rates: NETWORK_ARCHITECTURE.md.

## D-015: Client prediction + reconciliation - LOCKED
Sequenced inputs; client predicts OWN movement with the same deterministic
resolveMove/terrain code; server acks lastProcessedSeq; client replays the
unacked tail from the authoritative position (snap >3 m, else 40% blend);
space transitions snap; remote actors exponentially smoothed (0.35/frame);
combat is presentation-only prediction.

## D-016: Server-owned persistence behind StorageProvider - LOCKED
Characters (schema v2) and world saves persist through StorageProvider;
world schema v2 introduced the boundary, D-029 advanced it to v3, and D-035
advances spell-loadout persistence to world v4 / character v2.
FileStorage (atomic tmp+rename) serves the milestone and a database comes
later. D-028 extends the original four-method character/world seam with two
account-record methods. Browser localStorage is offline-mode only. Corruption
rejects, never half-loads. PERSISTENCE_ARCHITECTURE.md.

## D-017: Explicit threat system - LOCKED
Per-enemy threat tables (damage/heal accrual, decay, 1.25x switch
hysteresis, leash reset). Chosen over pure-proximity targeting (unpredictable
in parties) and over hard taunt-trinity (Claurim stays action-first; taunt is
a hook on the same table).

## D-018: Data-driven encounter model + locked scaling - LOCKED
Tiers standard/veteran/elite/boss; roles melee/ranged/support; template
abilities (frontal_cone / ground_aoe / summon / heal_ally) with telegraphs +
interrupts; boss phases; group aggro via authored encounter ownership;
scaling locked at first aggro to engaged party size (hp +40%/extra, damage
+8%/extra, retuned after correct undead allegiance and two-policy measurement
on 2026-07-31), through the standard modifier system.
ENCOUNTER_DESIGN.md. Exemplar: Duskhollow + The Pale Warden.

## D-019: Loot ownership - LOCKED
Standard corpses: one shared roll, first-looter (party norm). Elite/boss:
PERSONAL loot - independent deterministic roll delivered to each eligible
nearby party member. Containers: personal per character (deterministic
per-char forked stream). Rejected: round-robin/need-greed UI (heavyweight
for milestone; personal loot avoids intra-party theft griefs entirely).

## D-020: Quest ownership + party credit - LOCKED
Per-character journals; kill credit shared with party within 60 m same
space; collect/talkTo/interact/reach personal; rewards to the completing
character; mid-quest joiners credit only their current stage. Plan 7's D-029
replaces the milestone default party with explicit membership; the credit
rules in this decision are unchanged.

## D-021: Death and recovery - LOCKED
Players go DOWNED (30 s, damage-immune, threat-invisible) -> party revive at
30% or auto-release at 40% to the space's recovery point (interior exit
door / Falkmoor waystone). Party wipe in a boss space = immediate release +
full deterministic encounter reset (unlocks scaling). No durability loss.

## D-022: Naming + dialogue originality regime - LOCKED
NAMING_GUIDE.md (derivation methods, forbidden shortcuts, stable-id rule,
audit log) + IP_STYLE_GUIDE.md (voice sheets, plural-adventurer framing,
human checklist) + scripts/check_ip.ts automated fragment gate in
validate/build/gate. Slice audit complete: 'Bronn Hale' -> 'Brandvar Hale',
'Ysolde Varr' -> 'Eydris Varr' (display only; ids stable).

## D-023: Third-person camera - LOCKED
Third person is the primary mode: orbit boom with pitch limits, scroll zoom
(2.2-14 m), terrain-collision ray march shortening the boom, camera-relative
movement (input rotated by view yaw in the sim), first person retained as a
secondary toggle. Lock-on/soft-targeting: evaluated, deferred - free-aim
melee arcs + threat readability suffice at current pace (revisit with ranged
PvP). D-025 supersedes the original terrain-only obstruction rule: the boom
now shares prop and interior-boundary obstruction with projectiles; the
remaining close-wall presentation limitation is KL-12.

## D-024: Authoritative combat feedback - LOCKED
Combat presentation consumes `ActorView` plus filtered `SimEvent` data:
facing-selected target frame, phase-aware poses, authoritative damage flashes,
hit/block/hurt confirmation, exact data-driven danger shapes, and a minimal
synthesized cue palette. Browser audio unlocks only from user activation and
cannot submit intent or resolve outcomes. D-031 routes that palette through
the locked browser mixer. See `COMBAT_CONTRACT.md` and
`AUDIO_PRESENTATION_CONTRACT.md`.

## D-025: Shared environmental collision and traversal - LOCKED
Solid props use authored-yaw oriented footprints and terrain-relative vertical
bounds. `positionTraversable` is the one actor/nav occupancy query; movement
substeps it, navigation sweeps it, and deterministic placement repairs against
it. Projectiles and the third-person camera share `worldObstructionT` across
props, terrain, and interior floor/wall/ceiling boundaries. Interior render
walls are exact room-union boundary segments. Water is wade-only to 0.5 m;
swimming remains a later locked package. See `WORLD_TRAVERSAL_CONTRACT.md`.

## D-012: Perception model - LOCKED
Distance (template range) x night factor (outdoors 21:00-05:00: 65%) x stealth
(sneaking target: range * max(0.15, 1 - stealth*0.12) * observer detection),
140-degree vision cone beyond touch range (2.5 m; 1.0 m vs sneaking targets =
the backstab window), plus shared-world eye-to-eye obstruction. Touch bypasses
the cone but never a wall. See `ai/brain.ts` canPerceive and Plan 4 tests.

## D-026: Authored encounter ownership and reliable AI transitions - LOCKED
Spawner `encounterId` is the shared aggro/reset key; summons inherit their
root owner. Target selection yields from an unseen target to visible threat,
ability AI requires a useful legal target, cooldowns advance during casts,
summons are capped, and reset atomically removes all owned transient mechanics
and restores preplaced members. Active schedules route through doors;
unobserved schedules collapse only a valid door route. Unreachable return
recovers at the valid home after 90 blocked ticks. Exact rules:
`AI_ENCOUNTER_CONTRACT.md`.

## D-027: Bounded browser connection and impairment contract - LOCKED
Browser sockets send no protocol data before `open`; each opened or re-opened
socket begins one fresh ClientWorld session and waits for a full baseline.
Unexpected loss freezes presentation and rejects intent while retrying at
250/500/1000/2000/4000 ms; exhaustion is visibly disconnected, while protocol
rejection and session supersession are terminal. Snapshot ackSeq advances only
when an authoritative tick consumes an input. Ordered fixed-seed Local/Good/
Degraded/Severe links and a matching real WebSocket relay form the Plan 5
gate. Exact rules: `NETWORK_RELIABILITY_CONTRACT.md`.

## D-028: Account authentication and character ownership boundary - LOCKED
Protocol v2 requires register/login/resume before `hello`. Passwords use
scrypt (`N=131072`, `r=8`, `p=1`, 16-byte salt, 64-byte key); login failures
are generic and expensive work is bounded. A successful account receives a
256-bit opaque, digest-only, eight-hour in-memory session with resume-time
rotation and a five-session cap. `AuthGateway` creates no authoritative core
connection before authentication, and `ServerCore` independently restricts
`hello` to an account-owned character and server-owned display name. The
browser persists neither password nor token. Remote browser transport must be
secure and origin-allowlisted; loopback remains available for development.
Exact threat cases, deployment settings, and deliberate limits are in
`AUTHENTICATION_THREAT_MODEL.md`.

## D-029: Player-controlled party and nearby chat - LOCKED
Characters start solo. A nearby-player invite must be explicitly accepted;
decline and leave are first-class commands, one character cannot occupy two
parties, and party size is capped at five. Accepted membership is durable
across disconnect and world restart; invitations are transient. Save schema
v3 removes the non-consensual legacy `fellowship` on migration and persists
known names for offline frames. Only accepted members receive D-019/D-020/
D-021 benefits, and first-engage scaling counts the engaged character's
nearby active party rather than unrelated bystanders. Nearby chat is
space-scoped, control-character sanitized, whitespace normalized, capped at
200 code points, and accepted at most once per 15 ticks per connection. The
HUD exposes party control on `O` and a focus-safe chat composer on `Enter`.

## D-030: Proven-schema content depth - LOCKED
Content version 0.2 deepens the playable slice only through the existing
`ItemDef`, `PerkDef`, `ActorTemplate`, `AbilityKind`, `SpaceDef`, loot, and
spawner contracts. The locked fill is twelve merchant-backed gear records,
ten modifier-only perks, Rimehowl Alpha and Barrow Sentinel veteran variants
using the existing frontal-cone and ground-AoE ability kinds, and Siltroot
Burrow as the second cave exemplar. Every new content family must resolve
through the generic catalog guard and its relevant navigation, traversal,
balance, and browser checks. This decision adds no weapon type, ability kind,
stat key, combat formula, save shape, or runtime content schema. The HUD's
location label resolves the current authored space through `IWorld`; host
implementations may not hard-code one world-space name.

## D-031: Host-only interpolation and browser audio mixer - LOCKED
The renderer stores one previous/current transform pair per observed actor and
interpolates position plus shortest-arc yaw by the fixed-step accumulator.
First observations, space changes, and jumps over 4 m snap; camera, terrain
streaming, and caster-anchored telegraphs share the displayed transform. This
history is read-only presentation and never changes simulation or protocol
state. Browser audio uses user-gesture Web Audio with master/effects/ambience/
music buses, persistent bounded controls and mute, authoritative-event combat
cues, and deterministic interior/exterior day/night procedural tonal beds.
Final audio assets, spatial sources, device selection, and production mixing
remain open. Exact boundaries: `AUDIO_PRESENTATION_CONTRACT.md`.

## D-032: Audited modern development toolchain - LOCKED
The supported development floor is Node `^20.19.0 || >=22.12.0`. Vite 8.2
provides the browser build/dev pipeline and Vitest 4.1 provides the test
runner; the committed npm lockfile is the reproducible dependency authority.
The production `three`/`ws` graph is unchanged. Full and production-only npm
audits must report zero known vulnerabilities at moderate-or-higher severity,
while clean `npm ci`, `npm run gate`, standalone generation, and dev-server
module requests prove compatibility. Networked audit checks remain explicit
rather than part of the deterministic gate. Major tool/Node-floor changes or
audit exceptions require a new lock. Exact rules:
`TOOLCHAIN_SECURITY_CONTRACT.md`.

## D-033: Camera-relative player movement and bounded safe-ground recovery - LOCKED
The authoritative sim and online predictor share one normalized camera-basis
transform and one stamina-aware sprint rule. Stationary sprint intent cannot
suppress regeneration; exhaustion returns movement to walk speed and requires
10% stamina before restart. Protocol v3 replicates the derived movement state
needed for deterministic prediction. A living player may request the current
space's established safe point through `IWorld`, but the server rejects the
request during combat, while incapacitated, or during the 30-second cooldown.
Recovery neither restores resources nor applies death penalties. Exact rules:
`PLAYER_MOVEMENT_RECOVERY_CONTRACT.md`.

## D-034: Authoritative center-reticle spell trajectory - LOCKED
Player projectile spells release along the most recent normalized yaw/pitch
reticle ray at the authoritative windup boundary. Pitch is bounded at input,
wire, and sim boundaries; protocol v4 requires it on every sequenced input.
Clients submit direction intent only and never choose projectile positions,
targets, hits, or damage. The HUD's read-only target selection uses the same
3D ray. Self spells, NPC projectiles, and bows retain their prior behavior.
Exact rules: `SPELL_RETICLE_AIM_CONTRACT.md`.

## D-035: Authoritative item and spell loadout - LOCKED
Actor equipment is presented through six fixed item slots, while every
character owns two persistent spell slots bound to keys 1/2. A spell must be
known, authored, uniquely assigned, and equipped before it can be cast;
assigning an already-equipped spell moves it. Unequipping gear never removes
the carried item. Protocol v5 replicates both slot families and accepts only
validated equip/unequip intent. World schema v4 and character schema v2 add
linear migrations that preserve the prior Flamebolt/Mend Wounds key behavior.
The inventory UI separates equipped gear, spell loadout, known spells, and
unequipped carried items, with a persistent read-only spell quickbar. Exact
rules: `PLAYER_LOADOUT_CONTRACT.md`.

## D-036: Collision-aware shoulder camera with reticle parity - LOCKED
Third person places the camera `0.9 m` over the player's right shoulder and
keeps camera forward exactly equal to the normalized D-034 yaw/pitch ray. The
full diagonal eye-to-camera boom uses shared world obstruction; collision
compresses both distance and shoulder offset with clearance, and extreme
compression temporarily hides only the local body. First person, combat
authority, movement, projectiles, and protocol v5 remain unchanged. Exact
rules: `THIRD_PERSON_CAMERA_CONTRACT.md`.

## D-037: Final authored terrain pads and prop-relative door anchors - LOCKED
Road shaping occurs before settlement, ruin, and mine site pads so roads
cannot re-carve structure footprints. Buildings extend their visual
foundation below shared terrain, and the Fenharrow well has a complete rim
and shaft. Exterior entrances are authored from a parent prop's local X/Z and
yaw; resolved world transforms remain compatible with existing consumers,
and validation rejects parent, space, position, or rotation drift. Named
offline QA starts exist only in development builds. Exact rules:
`WORLD_STRUCTURE_PLACEMENT_CONTRACT.md`.
