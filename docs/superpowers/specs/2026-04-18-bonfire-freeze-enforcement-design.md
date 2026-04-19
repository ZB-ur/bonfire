# Design: Bonfire Freeze Enforcement

**Date:** 2026-04-18
**Status:** Proposed
**Scope:** Assertion 1 of the bonfire production-grade gap analysis — Truth Surface freeze semantics.

---

## 1. Context

The `/bonfire:plan` pipeline produces two freeze-class actions that must write to the constraint ledger:

1. **Stage G Truth-Freeze Gate** — algorithmic freeze of surviving `PROPOSED` / `CHALLENGED` entries after adversarial review (Stage G step 32 in `skills/plan/SKILL.md`).
2. **Stage H Rulings** — explicit `{ "action": "freeze", "id": "..." }` and `{ "action": "supersede", ... }` commands produced by `bonfire-h-review`.

Both are currently expressed as prose instructions telling Claude (as orchestrator) to invoke `bonfire truth-freeze` / `bonfire truth-supersede` on each target id.

## 2. Problem

Evidence from the gto-trainer case at `/Users/lddmay/AiCoding/bonfire-test/gto-trainer`:

- `h-review-verdict.json` contains 14 `{ "action": "freeze", ... }` rulings.
- `constraint-ledger-snapshot.json` shows those 14 ids still in `PROPOSED`.
- 22 PROPOSED entries remain in the ledger after Stage G supposedly "passed".
- `state.json` records `stage-g` and `stage-h` as `passed`.

Root cause: state-advance commands (`bonfire state-step --status passed`, `state-advance`) are step counters. They do not validate ledger invariants. The ledger transitions specified by the skill are prompt-adherence-dependent and the orchestrator silently skipped them.

A second, underlying defect surfaces as soon as we try to enforce the skill literally: `truth-freeze` enforces a maturity gate (`challenged_by_non_empty` for `retained_goal` / `frozen_constraint` / `dependency_chain` / `acceptance_semantic`). Entries that "survived adversarial review unchallenged" and Stage H rulings that target never-challenged entries both fail this gate. The prose rules and the CLI enforcement contradict each other.

## 3. Goals

- The pipeline cannot advance past Stage G with `PROPOSED` entries remaining (except `high_impact_risk`, which is designed to stay `OPEN`).
- The pipeline cannot advance past Stage H with `rulings` from `h-review-verdict.json` not materialized as `freeze` / `supersede` events in `constraint-ledger-history.jsonl`.
- Freeze actions always leave an auditable record of who authorized them (challenge resolution, Stage G survival, or H-Review ruling).
- A fixture reproducing the gto-trainer failure state is blocked by the new enforcement (regression evidence that this specific bug could not recur).

## 4. Non-Goals

- Retroactive repair of the gto-trainer `.bonfire/` artifacts (preserved as a historical negative example).
- Invariant enforcement for Stages B, C, D, E, F, or J.
- Reentry triggering when `apply-h-rulings` fails (scoped under Assertion 2).
- End-to-end Code + Achieve validation (scoped under Assertion 3).
- Changes to `bonfire-h-review` agent output format or ruling semantics.

## 5. Design

### 5.1 New CLI commands

Two additions to `bin/bonfire-tools.cjs`, backed by helpers in `bin/lib/truth-surface.cjs`.

**`bonfire apply-h-rulings`**

- Input: `.bonfire/plan/h-review-verdict.json`.
- Behavior:
  1. Load verdict, validate against schema (reuses `delta-parser.validateDelta`).
  2. Load current ledger snapshot.
  3. Pre-validate every ruling:
     - Ruling action is `freeze` or `supersede`; target id exists.
     - `freeze` rulings: target is not already `FROZEN` (already-frozen is treated as idempotent skip, not a failure); after planned auto-alignment (§5.3) the target would satisfy `checkMaturityGate`.
     - `supersede` rulings: target (`supersedes`) is `FROZEN`; new id does not yet exist. (Auto-alignment does not apply — supersede operates on already-frozen entries.)
  4. If any ruling fails pre-validation, print all failures and exit non-zero without writing any events.
  5. Otherwise emit the planned event sequence (per ruling: optional `update aligned_by` followed by `freeze`, or single `supersede`) in ruling order, append to `constraint-ledger-history.jsonl`, then `regenerateSnapshot`.
- Idempotent: `freeze` rulings targeting already-`FROZEN` ids are reported as skipped but do not fail the run.
- Exit code 0 on full success (including idempotent skips); non-zero on any hard failure.

**`bonfire stage-g-freeze-gate`**

- Input: current snapshot (no external file).
- Behavior: for each non-`FROZEN` entry, apply Stage G step 32 rules:

  | Entry state | Action |
  |---|---|
  | `category == high_impact_risk` | skip (stays `OPEN`) |
  | `PROPOSED`, `challenged_by: []` | write `update aligned_by <- "stage-g-unchallenged"`, then `freeze` |
  | `CHALLENGED`, `aligned_by` non-empty | `freeze` directly |
  | `CHALLENGED`, `aligned_by: []` | skip, emit warning listing id (unresolved challenge) |
  | `FROZEN` or `SUPERSEDED` or `DISCARDED` | skip |

- Output: summary counts (frozen, auto-aligned, skipped-risk, skipped-frozen) + list of unresolved `CHALLENGED` ids.
- Exit code 0 if no unresolved `CHALLENGED` entries remain; non-zero if one or more `CHALLENGED` entries lack alignment. A non-zero exit is the signal to escalate (G-Blue must defend, or H-Review must adjudicate) — the command refuses to silently pass over contested entries.

### 5.2 state-advance invariant enforcement

Modify `bin/lib/state.cjs` (or the `state-advance` handler in `bonfire-tools.cjs`) to run gate checks keyed by the source step.

| Advancing from | Invariant | On failure stderr prints |
|---|---|---|
| `stage-g` | No entries remain in `PROPOSED` or `CHALLENGED` status, excluding `high_impact_risk` category. | `Cannot advance from stage-g: N entries still unresolved:` followed by one id per line, then `Run: bonfire stage-g-freeze-gate`. |
| `stage-h` | For every `rulings[].id` in `h-review-verdict.json`: the history log contains a matching `freeze` or `supersede` event whose timestamp is ≥ the verdict file's mtime. | `Cannot advance from stage-h: N rulings not applied:` followed by one id per line, then `Run: bonfire apply-h-rulings`. |

Both gates exit non-zero when the invariant fails and do not mutate state.

Other stages' `state-advance` behavior is unchanged.

### 5.3 Maturity gate resolution — auto-alignment

Both new commands must write freeze events for entries whose `challenged_by` is empty (Stage G unchallenged survivors; H-Review freezing entries that were never challenged). Current `truth-freeze` rejects these via `checkMaturityGate`.

**Resolution: inject an `aligned_by` update event before the freeze event**, not by relaxing the gate.

- `apply-h-rulings` on a target with empty `challenged_by`: append `update id=X field=aligned_by value="h-review"`, then `freeze`.
- `stage-g-freeze-gate` on a PROPOSED target with empty `challenged_by`: append `update id=X field=aligned_by value="stage-g-unchallenged"`, then `freeze`.

Outcomes:

- History log contains explicit authorization: `"aligned_by": ["h-review"]` or `["stage-g-unchallenged"]`.
- `truth-freeze` maturity gate semantics preserved: *something* must have affirmed the entry before freeze (challenge resolved, or explicit post-review alignment).
- Replay deterministically reconstructs the state.

No schema change required. `aligned_by` is already in `annotate_whitelist` and the replay reducer already handles array-append updates.

### 5.4 Skill rewrites

`skills/plan/SKILL.md`:

- **Stage G step 32.a–e (5 sub-steps)** → replaced with:
  ```
  32. Truth-Freeze Gate: run `bonfire stage-g-freeze-gate`. If non-zero exit,
      the printed warnings identify CHALLENGED entries without alignment —
      return these to G-Blue or escalate to H-Review. Do not proceed until
      the command exits 0.
  ```
- **Stage H step 38** → replaced with:
  ```
  38. Apply rulings: run `bonfire apply-h-rulings`. On non-zero exit, inspect
      the pre-validation failures and revise the verdict; do not retry blindly.
  ```
- **Stage G step 34 gate, Stage H step 40 routing** → add one sentence each noting that `state-advance` now enforces the ledger invariants automatically.

The `bonfire-h-review` agent file and rulings schema are untouched.

## 6. Test Plan

Three new test files under `tests/`. All use the existing `test-utils.js` harness and operate on throwaway `.bonfire/` directories.

### 6.1 `test-apply-h-rulings.js`

- ✅ Happy path: 3 freeze rulings → all `FROZEN`, history has 3 matching freeze events.
- ✅ Mixed: freeze + supersede → both materialized correctly.
- ✅ Pre-validation atomicity: one ruling has nonexistent id → no events appended, exit non-zero.
- ✅ Idempotency: already-`FROZEN` id in rulings → warning, skip, exit 0.
- ✅ Auto-alignment: target with `challenged_by: []` → history has `update aligned_by="h-review"` then `freeze` (two events per ruling).

### 6.2 `test-stage-g-freeze-gate.js`

- ✅ PROPOSED with `challenged_by: []` → auto-align + freeze, exit 0.
- ✅ CHALLENGED with `aligned_by` populated → freeze only (no auto-align), exit 0.
- ✅ CHALLENGED with `aligned_by: []` → stays CHALLENGED, id listed in output, exit non-zero.
- ✅ `high_impact_risk` PROPOSED entry → stays OPEN, not listed as unresolved, exit 0.
- ✅ Empty ledger / all-FROZEN ledger → no-op, exit 0.

### 6.3 `test-state-advance-invariants.js`

- ✅ Stage G advance with PROPOSED (non-risk) remaining → blocked, lists ids.
- ✅ Stage G advance with only `high_impact_risk` PROPOSED → allowed.
- ✅ Stage H advance with unapplied rulings → blocked, lists ids.
- ✅ Stage H advance with all rulings applied → allowed.
- ✅ **Regression fixture**: load a cut-down replica of `bonfire-test/gto-trainer/.bonfire/truth-surface/constraint-ledger-history.jsonl` + `h-review-verdict.json` as fixtures (committed under `tests/fixtures/gto-trainer-frozen-bug/`). Verify:
  - `state-advance --step stage-g` blocks (22 ids listed).
  - After running `stage-g-freeze-gate`, `state-advance --step stage-g` succeeds.
  - `state-advance --step stage-h` blocks on the 14 unapplied rulings.
  - After running `apply-h-rulings`, `state-advance --step stage-h` succeeds.

### 6.4 Unchanged tests

`test-truth-freeze.js`, `test-truth-surface.js`, `test-truth-cli.js` continue passing without modification — the maturity gate contract is unchanged, we only add events before invoking freeze.

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Auto-alignment event inflation (more events per run) | Event log is jsonl append-only; negligible storage impact. |
| `stage-g-freeze-gate` masking a real G-Blue gap by auto-aligning genuinely contested entries | Rules strictly gate auto-align on `challenged_by: []`. If an entry has challenges, the command refuses to align silently and surfaces the gap. |
| Existing cases in flight break when installed | The gate runs on every `state-advance`. Pre-existing `.bonfire/` with stale PROPOSED state will be blocked next run — this is the intended behavior. Document in commit message. |
| Cross-platform file mtime precision for verdict freshness check | Use file mtime comparison at second precision; rulings written before verdict file are treated as stale (not applicable in practice since verdict is authored first). |

## 8. Deferred Questions

Explicitly left to follow-up specs (Assertion 2 / Assertion 3):

- Should H-Review be able to freeze entries that never made it through Stage G survival rules? (Currently: yes, via rulings + auto-alignment.)
- Should failed `apply-h-rulings` trigger `state-reentry` automatically?
- What happens when `stage-g-freeze-gate` reports unresolved challenges — new agent spawn, human prompt, or fail-closed?
