# Known limitations (honest register; each is deliberate, none is forgotten)

- KL-1 RESOLVED in Plan 9: actor transforms, the local camera/terrain center,
  and caster-anchored telegraphs now use host-only previous/current
  interpolation with first-view, space-change, and >4 m snap boundaries.
  Automated frame-pacing measurement remains part of KL-7.
- KL-2 Solid prop collision now honors authored yaw with oriented rectangular
  footprints. Cylinders, tents, and other non-box procedural meshes still use
  that conservative rectangle; add collider shapes only with a locked content
  schema package.
- KL-3 First-person mode is a camera toggle; the body hides but hands/weapon
  are not drawn. The camera abstraction supports it; the view model is art
  work, not architecture.
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
- KL-7 Browser QA is now available and has a repeatable baseline
  (`QA_BASELINE.md`), but there is no automated pixel-diff or frame-pacing
  harness. Visual and interaction changes still require human review and
  captured evidence on the supported viewport matrix.
- KL-8 Melee now enforces a 1.5 m vertical envelope, but attacks still have no
  pitch/vertical aiming model. Revisit with flying or fully vertical combat.
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
