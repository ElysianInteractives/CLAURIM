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

Not locked (open design space): weather, audio, crafting, followers, crime,
dragons/flight, multi-region streaming, radiant generation, GLB pipeline.
