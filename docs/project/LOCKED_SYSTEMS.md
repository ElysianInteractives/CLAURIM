# Locked systems

These are settled. Reopening one requires demonstrated defect + DECISIONS.md
amendment; "a later model prefers a different shape" is not a defect.

- Sim/host separation + IWorld seam (D-001) - guard-tested.
- SimContext module pattern (D-002).
- 30 Hz tick + all constants routed through src/sim/types.ts (D-003).
- Cell/streaming + resident-actor model, with its documented revisit trigger (D-004).
- Pure analytic heightfield terrain (D-005).
- Data-as-code content + in-repo validator (D-006).
- Combat phase machines + single damage entry point (D-007).
- Unified modifier system; recalcActorStats as sole derived-stat writer (D-008).
- Versioned save envelope + linear migrations + reject-on-corrupt (D-009).
- Data-interpreted quest/dialogue runtimes (D-010).
- Palette-driven stylized primitive visual language (D-011; asset QUALITY may
  improve behind the same factories).
- Perception model (D-012).

Locked by the 2026-07-31 MMO pivot (each tested through the exemplar suite):
- Multiplayer state model: one Sim, many characters, per-char keyed state (D-013).
- Server-authoritative WebSocket protocol v2 + authenticated pre-hello boundary
  + interest-scoped 10 Hz snapshots (D-014/D-028).
- Client prediction/reconciliation via sequenced intent (D-015).
- StorageProvider persistence: server-owned characters + world (D-016).
- Threat tables with decay + switch hysteresis (D-017).
- Data-driven encounter tiers/roles/abilities/phases + locked scaling (D-018).
- Loot ownership: shared standard corpses, personal elite/boss + containers (D-019).
- Per-character quest ownership + 60 m party kill credit (D-020).
- Downed/revive/release + wipe reset (D-021).
- Naming/dialogue originality regime + automated IP gate (D-022).
- Third-person primary camera with collision (D-023).
- Authoritative combat feedback views/events and minimal cue layer (D-024).
- Shared oriented environmental collision, route validation, and water policy
  (D-025).
- Authored encounter ownership, wall-aware perception, useful ability
  selection, atomic reset, and door-graph NPC schedules (D-026).
- Account/password authentication, rotating opaque sessions, character
  ownership, and secure remote browser transport boundary (D-028).

Not locked (open design space): weather, music/ambience/spatial audio and
mixing, crafting, followers, crime,
dragons/flight, multi-region streaming, radiant generation, GLB pipeline,
account recovery/MFA/operations, explicit party UI/matchmaking, dungeon
instancing (current dungeon is shared-world), guilds/trading.
