# gto-trainer-bug-repro

Cut-down replica of the gto-trainer case (5 stuck PROPOSED entries instead of the
original 22, + 1 high_impact_risk control, + 1 correctly-frozen baseline).

Used by `tests/test-state-advance-invariants.js` to prove the gto-trainer class of
freeze-bugs cannot recur under the new mechanical enforcement.

## Files

- `constraint-ledger-history.jsonl` — event log (9 events). Replay produces 5
  PROPOSED with empty challenged_by, 1 OPEN risk, 1 FROZEN baseline.
- `h-review-verdict.json` — 5 freeze rulings targeting the 5 stuck ids.
- `state.json` — pipeline positioned at stage-g running with prior stages passed.

## Schema note

Event shape follows `bin/lib/truth-surface.cjs` as of 2026-04-18. If the event
schema changes, `truth-rebuild` will fail on load and the tests will break loudly.
Update the jsonl to match the new schema when that happens.

## Why 3 tests instead of 4

Spec §6.3 originally listed 4 regression checks. Under the new pipeline
`stage-g-freeze-gate` pre-emptively freezes every entry the verdict targets,
so the "stage-h blocks on unsatisfied rulings" scenario doesn't naturally
arise from this fixture shape. That scenario is covered by the non-fixture
tests earlier in `test-state-advance-invariants.js`. Here we test:

1. Stage-g advance blocks on stuck PROPOSED entries (risk excluded).
2. After `stage-g-freeze-gate`, stage-g advance succeeds.
3. Stage-h advance passes trivially because all verdict rulings target entries
   that stage-g already froze (state-comparison redundancy property, §5.2).
