# Risk register

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| Content breadth outruns systems (shallow-map failure) | high | high | coverage matrix gates: system+exemplar+tests before volume; backlog labels | managed |
| Save-format churn breaks player saves | med | high | schema version + migrations from day one (D-009), golden tests | managed |
| Renderer/sim divergence on terrain | low | high | single pure heightfield (I-10) | closed by design |
| Later models erode determinism | med | high | guard tests + determinism suites are hard failures | managed |
| Three.js scene leaks on space swaps / cell churn | med | med | disposeGroup on all removals; add a leak counter tour later | open |
| IP contamination (names/text drift toward Bethesda) | med | high | clean-room rule in CLAUDE.md; prose review label on narrative tickets | managed |
| Dragon/flight architecture invalidates nav assumptions | med | high | prototype EARLY before content scales (OB-9); nav is behind one module | open |
| Multi-region scale breaks the all-actors-resident model | med | med | D-004 documents the revisit trigger (~2000 actors/region) | open |
| Balance drift with no measurement | high | med | headless host exists; require measured tuning | open |
| Bundle growth (asset pipeline) | med | low | gzip budget note in ARCHITECTURE; code-split later | open |
| "Claurim" name conflict | low | med | HUMAN_DECISION ticket OB-10 | open |
