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

A second, underlying defect surfaces as soon as we try to enforce the skill literally: `truth-freeze` enforces a `challenged_by_non_empty` maturity gate for `retained_goal`, `frozen_constraint`, and `acceptance_semantic` (the only three categories whose gate is blocking; `confirmed_fact` uses `evidence_required` and `dependency_chain` uses `refs_valid`, both of which are no-ops in `checkMaturityGate` today). Entries in those three categories that "survived adversarial review unchallenged" and Stage H rulings that target never-challenged entries in those categories both fail the gate. The prose rules and the CLI enforcement contradict each other.

## 3. Goals

- The pipeline cannot advance past Stage G with `PROPOSED` or `CHALLENGED` entries remaining (except `high_impact_risk`, which is designed to stay `OPEN`).
- The pipeline cannot advance past Stage H until the current ledger snapshot satisfies every `freeze` / `supersede` ruling in `h-review-verdict.json` — i.e., for each `freeze(id=X)` ruling the snapshot has `entries[X].status == "FROZEN"`; for each `supersede(supersedes=Y, id=X)` ruling the snapshot has `entries[Y].status == "SUPERSEDED"` and `entries[X].status == "FROZEN"`.
- Freeze actions always leave an auditable record of who authorized them (challenge resolution, Stage G survival, or H-Review ruling).
- A fixture reproducing the gto-trainer failure state is blocked by the new enforcement (regression evidence that this specific bug could not recur).

## 4. Non-Goals

- Retroactive repair of the gto-trainer `.bonfire/` artifacts (preserved as a historical negative example).
- Invariant enforcement for Stages B, C, D, E, F, or J.
- Reentry triggering when `apply-h-rulings` fails (scoped under Assertion 2).
- End-to-end Code + Achieve validation (scoped under Assertion 3).
- Changes to `bonfire-h-review` agent output format or ruling semantics.
- Enforcing the `evidence_required` (confirmed_fact) or `refs_valid` (dependency_chain) gates in `checkMaturityGate` — these are no-ops today and out of scope for this spec.
- CLI ergonomics on the two new commands — no `--dry-run`, `--verbose`, `--json`, or similar flags. Follow-up if needed.
- Automatic remediation on gate failure — when `state-advance` blocks, the caller is expected to run the remediation command printed in stderr. Re-invoking `state-advance` without remediation will continue to block.
- Verdict application history / observability (e.g., "was verdict v1 ever applied?"). The state-comparison invariant in §5.2 answers "does the ledger satisfy the current verdict?", not "what is the historical apply log?". A separate observability spec may add this later.

## 5. Design

### 5.1 New CLI commands

Two additions to `bin/bonfire-tools.cjs`, backed by helpers in `bin/lib/truth-surface.cjs`.

**`bonfire apply-h-rulings`**

- Input: `.bonfire/plan/h-review-verdict.json`.
- Behavior:
  1. Load verdict, validate via `validateDelta("bonfire-h-review", verdict)` (the existing `delta-parser.validateDelta` dispatch).
  2. Load current ledger snapshot.
  3. Filter `rulings[]` to entries with `action ∈ {freeze, supersede}`. Other action values (if any are ever added) are ignored by this command.
  4. Classify every filtered ruling:
     - `freeze` ruling whose target is already `FROZEN` → mark as **idempotent skip**: not counted as a failure, no event emitted for it. Continue classifying remaining rulings.
     - All other rulings → run **pre-validation**:
       - Target id exists.
       - `freeze` rulings: after planned auto-alignment (§5.3) the target would satisfy `checkMaturityGate`.
       - `supersede` rulings: target (`supersedes`) is `FROZEN`; new id does not yet exist. (Auto-alignment does not apply — supersede operates on already-frozen entries.)
  5. If any non-skip ruling fails pre-validation, print all failures and exit non-zero without writing any events. Skipped rulings are reported in the output but do not participate in the failure count.
  6. Otherwise emit the planned event sequence (per non-skip ruling: optional `update aligned_by` followed by `freeze`, or single `supersede`) in ruling order, append to `constraint-ledger-history.jsonl`, then `regenerateSnapshot`.
- Idempotent: `freeze` rulings targeting already-`FROZEN` ids are reported as skipped but do not fail the run.
- Zero-rulings verdict (`rulings: []` or field absent): no events written, exit 0.
- Exit code 0 on full success (including idempotent skips); non-zero on any hard failure.

**`bonfire stage-g-freeze-gate`**

- Input: current snapshot (no external file).
- Behavior: for each non-`FROZEN` entry, apply Stage G step 32 rules:

  | Entry state | Action |
  |---|---|
  | `category == high_impact_risk` | skip (stays `OPEN`) |
  | `PROPOSED`, `challenged_by: []` | write `update aligned_by <- "stage-g-survival"`, then `freeze` |
  | `CHALLENGED`, `aligned_by` non-empty | `freeze` directly |
  | `CHALLENGED`, `aligned_by: []` | skip, emit warning listing id (unresolved challenge) |
  | `FROZEN` or `SUPERSEDED` or `DISCARDED` | skip |

- Output: summary counts (frozen, auto-aligned, skipped-risk, skipped-frozen) + list of unresolved `CHALLENGED` ids.
- Exit code 0 if no unresolved `CHALLENGED` entries remain; non-zero if one or more `CHALLENGED` entries lack alignment. A non-zero exit is the signal to escalate (G-Blue must defend, or H-Review must adjudicate) — the command refuses to silently pass over contested entries.

### 5.2 state-advance invariant enforcement

Modify `bin/lib/state.cjs` (or the `state-advance` handler in `bonfire-tools.cjs`) to run gate checks keyed by the source step. Both gates are **state-based**: they compare the current ledger snapshot (built by replaying history) against a declarative expectation. Neither gate uses file mtimes, content hashes, or marker events.

| Advancing from | Invariant | On failure stderr prints |
|---|---|---|
| `stage-g` | No entries remain in `PROPOSED` or `CHALLENGED` status, excluding `high_impact_risk` category. | `Cannot advance from stage-g: N entries still unresolved:` followed by one id per line, then `Run: bonfire stage-g-freeze-gate`. |
| `stage-h` | For every `rulings[]` entry in `.bonfire/plan/h-review-verdict.json` whose `action ∈ {freeze, supersede}`: `freeze(id=X)` → `snapshot.entries[X].status == "FROZEN"`; `supersede(supersedes=Y, id=X)` → `snapshot.entries[Y].status == "SUPERSEDED"` AND `snapshot.entries[X].status == "FROZEN"` (both conditions must pass independently; a failing supersede reports each condition's expected/actual). A verdict with `rulings: []` or no `rulings` field passes trivially. | See sample below. |

Sample failure output for Stage H:

```
Cannot advance from stage-h: 2 rulings not satisfied:
  - freeze(id=old-ui-assumption) expected=FROZEN actual=PROPOSED
  - supersede(supersedes=legacy-auth, id=new-auth) expected: legacy-auth=SUPERSEDED, new-auth=FROZEN; actual: legacy-auth=FROZEN, new-auth=<missing>
Run: bonfire apply-h-rulings
```

Each `freeze` ruling emits a single expected/actual line. Each `supersede` ruling emits both conditions on one line so that callers can see which end failed (old entry not superseded, or new entry missing/wrong status) without cross-referencing the verdict file.

Both gates exit non-zero when the invariant fails and do not mutate state. Remediation hint always points to the corresponding command above, even though in rare cases the state could have been satisfied by another path (e.g., an id that Stage G already froze is trivially satisfied by a redundant H-Review ruling — no additional command needed, but the hint stays consistent for orchestrator simplicity).

Other stages' `state-advance` behavior is unchanged.

### 5.3 Maturity gate resolution — auto-alignment + gate extension

Both new commands must freeze entries whose `challenged_by` is empty (Stage G unchallenged survivors; H-Review freezing entries that were never challenged). Current `truth-freeze` rejects these via `checkMaturityGate`, which today literally checks `challenged_by` and ignores `aligned_by`.

**Resolution has two parts that must ship together:**

**(a) Extend `checkMaturityGate` to treat `challenged_by` and `aligned_by` symmetrically.** The semantic spirit of the `challenged_by_non_empty` gate is "something must have affirmed the entry before freeze"; it should accept either a challenge-resolution path (`challenged_by` non-empty, implying adversarial review occurred) or a direct-alignment path (`aligned_by` non-empty, implying an authority vouched for it). The code change in `bin/lib/truth-surface.cjs::checkMaturityGate`:

```js
if (gate === 'challenged_by_non_empty') {
  const challenged = entry.challenged_by && entry.challenged_by.length > 0;
  const aligned    = entry.aligned_by    && entry.aligned_by.length    > 0;
  if (!challenged && !aligned) {
    throw new Error(
      `Maturity gate failed: "${entry.category}" requires non-empty ` +
      `challenged_by or aligned_by before freeze`
    );
  }
}
```

The gate name stays `challenged_by_non_empty` in the schema to avoid a schema migration; only the check body expands. Behavioral contract change:

| Entry state | Before | After |
|---|---|---|
| `challenged_by: []`, `aligned_by: []` | reject | reject (unchanged) |
| `challenged_by: [x]`, `aligned_by: []` | accept | accept (unchanged) |
| `challenged_by: [x]`, `aligned_by: [y]` | accept | accept (unchanged) |
| `challenged_by: []`, `aligned_by: [y]` | **reject** | **accept** (new) |

**(b) Auto-inject the alignment event before freeze**, so the new gate actually receives an `aligned_by` population for Stage G / H-Review paths:

Two authorizer tokens, named symmetrically by authorizing stage + reason so forensic grep finds either:

- `apply-h-rulings` on a target with empty `challenged_by`: append `update id=X field=aligned_by value="stage-h-ruling"`, then `freeze`.
- `stage-g-freeze-gate` on a PROPOSED target with empty `challenged_by`: append `update id=X field=aligned_by value="stage-g-survival"`, then `freeze`.

`aligned_by` append semantics (not replace): the replay reducer at `truth-surface.cjs:131–148` handles array-append for `challenged_by`/`aligned_by`/`evidence_refs` inside the `type === "update"` branch. Auto-alignment appends the authorizer token alongside any existing alignment (e.g., a prior G-Blue alignment) rather than overwriting it. Entries that were already aligned by G-Blue and are now redundantly auto-aligned will carry both tokens.

Outcomes:

- History log contains explicit authorization: `"aligned_by": ["stage-h-ruling"]` or `["stage-g-survival"]` (or both, alongside G-Blue tokens, when multiple paths affirm the same entry).
- Gate spirit preserved: *something* must have affirmed the entry before freeze. The change expands *what counts as affirmation*; it does not drop the requirement.
- Replay deterministically reconstructs the state.
- For categories whose maturity gate is a no-op today (`confirmed_fact` with `evidence_required`, `dependency_chain` with `refs_valid`), the auto-alignment is harmless — the extra `update` event costs one jsonl line and records a forensic trail even though the gate would have passed without it. No conditional logic is needed in either command based on the target's category.

Schema file (`schemas/bonfire-v1.json`) is untouched — the gate name is unchanged, only its code body expands. `aligned_by` is already in `annotate_whitelist` and the replay reducer already handles array-append updates.

**External contract impact:** This gate extension applies to all callers of `truth-freeze`, including direct `bonfire truth-freeze X` CLI invocations — not only the two new commands. The effect is additive: every freeze call that succeeded before still succeeds, and some calls that previously failed with `Maturity gate failed` will now succeed if the target has non-empty `aligned_by`. No existing freeze flow is newly rejected. Third-party scripts or workflows that relied on the stricter gate should be aware of this softening; the behavior is documented in the changelog entry for this change.

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
- ✅ Auto-alignment: target with `challenged_by: []` → history has `update aligned_by="stage-h-ruling"` then `freeze` (two events per ruling).
- ✅ Append-not-replace: target with pre-existing `aligned_by: ["g-blue"]` and `challenged_by: []` → after apply, `aligned_by == ["g-blue", "stage-h-ruling"]`.
- ✅ Zero rulings: `rulings: []` → no events written, exit 0. Same for missing `rulings` field.

### 6.2 `test-stage-g-freeze-gate.js`

- ✅ PROPOSED with `challenged_by: []` → auto-align + freeze, exit 0.
- ✅ CHALLENGED with `aligned_by` populated → freeze only (no auto-align), exit 0.
- ✅ CHALLENGED with `aligned_by: []` → stays CHALLENGED, id listed in output, exit non-zero.
- ✅ `high_impact_risk` PROPOSED entry → stays OPEN, not listed as unresolved, exit 0.
- ✅ Empty ledger / all-FROZEN ledger → no-op, exit 0.

### 6.3 `test-state-advance-invariants.js`

- ✅ Stage G advance with PROPOSED (non-risk) remaining → blocked, lists ids.
- ✅ Stage G advance with only `high_impact_risk` PROPOSED → allowed.
- ✅ Stage H advance with unsatisfied rulings → blocked, lists each ruling with expected/actual status.
- ✅ Stage H advance with all rulings satisfied → allowed.
- ✅ Stage H advance with `rulings: []` verdict → allowed (zero-ruling trivial pass).
- ✅ Stage H advance where ruling is redundant (target already `FROZEN` by Stage G) → allowed without re-running `apply-h-rulings`.
- ✅ **Regression fixture**: load a cut-down replica of `bonfire-test/gto-trainer/.bonfire/truth-surface/constraint-ledger-history.jsonl` + `h-review-verdict.json` as fixtures (committed under `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/`). Verify:
  - `state-advance --step stage-g` blocks (22 ids listed).
  - After running `stage-g-freeze-gate`, `state-advance --step stage-g` succeeds.
  - `state-advance --step stage-h` blocks on the 14 unsatisfied rulings.
  - After running `apply-h-rulings`, `state-advance --step stage-h` succeeds.

### 6.4 `test-truth-freeze.js` addition

The gate-extension in §5.3(a) expands what `checkMaturityGate` accepts. Existing tests still pass (test 1 rejects both-empty, test 2 accepts challenged_by non-empty), but we add one new case:

- ✅ `freeze succeeds for retained_goal with only aligned_by non-empty`: propose retained_goal → `update aligned_by="stage-h-ruling"` → `freeze` succeeds, snapshot shows FROZEN.

`test-truth-surface.js` and `test-truth-cli.js` pass without modification.

## 7. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Auto-alignment event inflation (more events per run) | Event log is jsonl append-only; negligible storage impact. |
| `stage-g-freeze-gate` masking a real G-Blue gap by auto-aligning genuinely contested entries | Rules strictly gate auto-align on `challenged_by: []`. If an entry has challenges, the command refuses to align silently and surfaces the gap. |
| Existing cases in flight break when installed | The gate runs on every `state-advance`. Pre-existing `.bonfire/` with stale PROPOSED state will be blocked next run — this is the intended behavior. Document in commit message. |
| State-comparison invariant cannot distinguish "H-Review's ruling caused this freeze" from "some other path already froze it" | This is an accepted tradeoff of the state-based approach. Forensic attribution lives in the `aligned_by` field: searching for `"stage-h-ruling"` / `"stage-g-survival"` tokens answers "which path authorized freezing X?". If a future observability spec adds a verdict application log, it can layer on top without changing the gate semantics. |
| `checkMaturityGate` extension changes `bonfire truth-freeze` behavior globally (not just inside the two new commands) | Additive only: no previously-valid freeze starts failing. Previously-rejected freezes on entries with non-empty `aligned_by` now succeed. Document in commit message and changelog so third-party scripts or manual workflows that relied on the stricter gate are aware of the softening. |

## 8. Deferred Questions

Explicitly left to follow-up specs (Assertion 2 / Assertion 3):

- Should H-Review be able to freeze entries that never made it through Stage G survival rules? (Currently: yes, via rulings + auto-alignment.)
- Should failed `apply-h-rulings` trigger `state-reentry` automatically?
- What happens when `stage-g-freeze-gate` reports unresolved challenges — new agent spawn, human prompt, or fail-closed?
