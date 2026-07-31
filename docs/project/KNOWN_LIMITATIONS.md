# Known limitations (honest register; each is deliberate, none is forgotten)

- KL-1 Render interpolation: the renderer draws the latest sim state without
  interpolating between ticks; at 30 Hz this is visible as slight stepping on
  fast camera pans. Fix: interpolate ActorView transforms in the renderer
  (host-side only). Opus ticket exists.
- KL-2 Prop collision ignores yaw: rotated props collide with their unrotated
  AABB footprint. Visible on the rotated smithy/house shells (slightly
  generous collision). Fix: OBB or footprint circles per prop.
- KL-3 First-person mode is a camera toggle; the body hides but hands/weapon
  are not drawn. The camera abstraction supports it; the view model is art
  work, not architecture.
- KL-4 Cross-space NPC schedule travel: an NPC whose current schedule entry is
  in another space stays put instead of walking through doors. Bronn/Ysolde
  schedules are authored within one space per block to mask this. Fix:
  schedule-driven door transitions for NPCs.
- KL-5 No audio at all yet (no audio system decision has been made).
- KL-6 Projectile collision vs interior walls uses ground height only; in
  interiors, walls stop actors but a projectile can pass a wall segment at
  grazing angles. Fix: segment-vs-wall test in `tickProjectiles`.
- KL-7 Browser QA is now available and has a repeatable baseline
  (`QA_BASELINE.md`), but there is no automated pixel-diff or frame-pacing
  harness. Visual and interaction changes still require human review and
  captured evidence on the supported viewport matrix.
- KL-8 Melee arc check is 2D (ignores height difference); irrelevant until
  flying/vertical combat exists.
- KL-9 The A* open list is an array scan (fine at slice scale; heap swap is a
  bounded perf ticket).
- KL-10 localStorage single save slot in the OFFLINE browser host (online
  characters are server-persisted, D-016).
- KL-11 No real authentication: charId is the identity token. Anyone who
  knows a charId can play that character. Accounts service is FABLE_REQUIRED
  before any public deployment.
- KL-12 Camera collision handles terrain/floors via ray-march; building/prop
  occlusion is not yet handled (camera can clip through walls at odd angles).
- KL-13 Difficulty numbers are bounded from below by naive bots (never
  block, cluster in cleaves, rarely revive). Real-party validation and a
  smarter bot policy are open benchmark work (OB-M6).
- KL-14 Snapshots are full (self-contained) JSON at 10 Hz; fine at slice
  scale, needs delta encoding before hundreds of visible entities.
- KL-15 The shared-world dungeon has no instancing: two parties in the mine
  share one boss (lockout = 'never respawns' after a kill). Instancing is a
  declared later system (LOCKED_SYSTEMS open list).
- KL-16 Chat renders in the notification feed; there is no chat input box in
  the HUD yet (clients can send via the chat command; OB-M5 adds the UI).
- KL-17 Remote players all render with the same archetype body; per-character
  appearance is future content work.
