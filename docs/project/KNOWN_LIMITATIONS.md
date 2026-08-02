# Known limitations (honest register; each is deliberate, none is forgotten)

- KL-1 RESOLVED in Plan 9: actor transforms, the local camera/terrain center,
  and caster-anchored telegraphs now use host-only previous/current
  interpolation with first-view, space-change, and >4 m snap boundaries.
  Automated frame-pacing measurement remains part of KL-7.
- KL-2 Solid prop collision now honors authored yaw with oriented rectangular
  footprints. Cylinders, tents, and other non-box procedural meshes still use
  that conservative rectangle; add collider shapes only with a locked content
  schema package.
- KL-3 RESOLVED in QA Phase G: first-person hides the world body while a
  camera-local rig draws sleeves plus the authoritative main/off-hand gear.
  Primitive asset quality may improve behind D-039's attachment factories.
- KL-4 Active NPCs now follow authored doors for cross-space schedules, while
  inactive NPCs collapse the same valid route to its destination anchor.
  Commute duration is not simulated offscreen, and schedules do not persist a
  mid-door route across save/load.
- KL-5 Plan 9 adds a user-gesture browser mixer, master/effects/ambience/music
  buses, persistent volume/mute UI, combat cues, and deterministic procedural
  interior/exterior tonal beds. It still has no authored score/ambience asset
  library, spatial-source placement, device selector, production loudness mix,
  or audio asset pipeline.
- KL-6 Projectile sweeps stop on terrain-relative oriented solid props and
  implicit interior walls/floors/ceilings. Non-box meshes retain KL-2's
  conservative rectangle.
- KL-7 Browser QA has a repeatable baseline plus D-047 deterministic camera-
  discontinuity and adaptive-load tests. There is still no automated pixel-
  diff or real-device frame-time capture harness; visual changes and hardware-
  specific performance still require human review on the viewport matrix.
- KL-8 Player projectile spells now follow bounded center-reticle pitch, but
  melee remains a 1.5 m vertical-envelope arc and bows/NPC projectiles remain
  horizontal-facing. Revisit those actions with a locked ranged/flying or
  fully vertical combat package.
- KL-9 The A* open list is an array scan (fine at slice scale; heap swap is a
  bounded perf ticket).
- KL-10 localStorage single save slot in the OFFLINE browser host (online
  characters are server-persisted, D-016).
- KL-11 Plan 6 provides real baseline account authentication and character
  ownership, but not a complete live-service identity platform. There is no
  email verification, recovery/reset flow, MFA, security-event audit trail,
  external breached-password lookup, or horizontally shared session store.
  Public operation still requires TLS termination, monitoring, backups, and
  an explicit origin allowlist; see `AUTHENTICATION_THREAT_MODEL.md`.
- KL-12 Third-person camera collision now shares terrain, oriented props, and
  interior boundaries with projectile obstruction. It shortens as far as
  0.15 m rather than fading foreground meshes, so the player body can briefly
  dominate the view when backed tightly into a wall.
- KL-13 Difficulty numbers now compare naïve and mechanics-aware fixed-seed
  bots, but both remain simple deterministic policies. Human browser
  observation covers mechanic legibility; broader real-party latency and
  skill-distribution playtests remain required.
- KL-14 Snapshots are full (self-contained) JSON at 10 Hz; fine at slice
  scale, needs delta encoding before hundreds of visible entities.
- KL-15 The shared-world dungeon has no instancing: two parties in the mine
  share one boss (lockout = 'never respawns' after a kill). Instancing is a
  declared later system (LOCKED_SYSTEMS open list).
- KL-17 Remote players all render with the same archetype body; per-character
  appearance is future content work.
- KL-18 The target frame uses a 20 m / 22-degree facing selection and does not
  ray-test world occlusion, so a hostile can briefly identify through a thin
  wall. Add a read-only world visibility query before denser interiors or PvP.
- KL-19 The D-040 map is an always-revealed current-space survey with straight-
  line, session-local landmark guidance. It has no discovery fog, quest
  markers, cross-space routing, path distance, fast travel, or persisted
  waypoint state.
- KL-20 D-042 provides primer-gated initiation, four disciplines, six spells,
  and two working defensive/utility effects. It does not yet provide area
  spells, summons, runes, channeling, trainers, research/crafting, school perk
  trees, discovery placement, or final magic economy/balance.
- KL-21 D-043 makes Kaldwyn denser and raises the authored slice to two minor
  settlements, eight mapped destinations, three natural interiors, ambient
  harts, and hostile briarboars, but the world remains one roughly kilometre-
  scale exterior region. Most buildings are exterior shells, trees have no
  gameplay collision/harvesting, and wildlife uses bounded wandering plus the
  existing combat AI rather than ecology, hunting, or population simulation.
- KL-22 D-044 raises the slice to three persistent side quests and six NPC
  conversations, but it does not add branching world consequences, faction
  reputation, escort/defend/crafting objectives, quest markers, cinematics,
  voiced dialogue, shared party conversation choices, or radiant generation.
- KL-23 RESOLVED in QA Phase N: D-046 replaces the visibly low-detail runtime
  geometry with bounded high/medium character, wildlife, structure, and
  vegetation tiers; adds hysteretic actor/building LOD and render culling;
  and provides a validated lazy Meshopt-capable GLB/glTF replacement seam.
- KL-24 D-046 ships optimized code-native higher-fidelity models, not a final
  commissioned art library. It has no authored texture sets, production GLB
  catalog, skeletal animation clips, impostors, or texture compression. Those
  are content-production tasks behind the now-locked asset/socket/budget seam.
