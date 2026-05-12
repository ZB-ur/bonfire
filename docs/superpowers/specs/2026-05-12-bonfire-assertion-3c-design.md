# Design: Bonfire Assertion 3c — State-Machine Coherence Closure

**Date:** 2026-05-12
**Status:** Proposed (draft v0.1, awaiting dialectic review)
**Scope:** Close 4 state-machine coherence drift sites surfaced by 2nd dogfood (bilibili-clean 2026-05-08) findings #1, #6, #7, #11. Establishes ledger-as-authoritative posture for ID namespaces, restores `CHALLENGED` status invariant via auto-transition path, and enhances `truth-annotate` error UX to surface the correct CLI for live-edit workflows.

**Charter inputs:**
- `dogfood-2026-05-08-bilibili-danmaku-findings.md` findings #1, #6, #7, #11 (problem evidence)
- `dogfood-2026-05-04-findings.md` finding #4 (1st-archive reproduction of #1 — 2-archive validation for challenged_claim status invariant)
- Architect dialectic 2026-05-11 → 2026-05-12 (Stage 0 cartography → Stage 1 mechanism Q1-Q3 → Stage 2 Q4 MERGE verdict)

**Related specs:**
- `2026-04-18-bonfire-freeze-enforcement-design.md` (Assertion 1 — ledger contract baseline; 3c preserves authoritativeness)
- `2026-04-18-bonfire-hj-seam-hardening-design.md` (Assertion 2)
- `2026-05-08-bonfire-assertion-3a-validation-theater-design.md` (Assertion 3a — fail-loud principle 3c extends)
- `2026-05-10-bonfire-assertion-4-round-4-design.md` (ASSERTION-4 round-4)
- `2026-05-10-bonfire-assertion-3b-design.md` (Assertion 3b — schema-doc drift closure)

---

## 1. Frontmatter context

Four Bonfire assertions have shipped or are operational:
- **Assertion 1** (PR #2): truth-surface freeze enforcement.
- **Assertion 2** (PR #2): H→J seam hardening.
- **Assertion 3a** (2026-05-09): validation theater closure.
- **ASSERTION-4 round-4** (2026-05-10): Layer 2b precision recalibration.
- **Assertion 3b** (2026-05-11): schema-doc drift closure.
- **F1** (2026-05-11): cross-language lexicon_exempt closure.

Assertion 3c closes the remaining production-grade cluster from the bilibili-clean dogfood: state-machine coherence drift across 4 distinct surfaces. Unlike 3b (declarative schema-doc), 3c touches operational state-machine semantics — category-initial-status defaults, CLI rejection mechanisms, and state-init-code-steps ID handling.

This spec is direct-dialectic (anti-recursion principle).

## 1.5 Glossary

| Term | Definition |
|---|---|
| `state-machine coherence` | The property that ledger entry status transitions follow the documented graph (PROPOSED → CHALLENGED → FROZEN / SUPERSEDED / DISCARDED) without category-specific bypasses that violate invariants. |
| `category-initial-status` | The `CATEGORY_INITIAL_STATUS` table in `bin/lib/truth-surface.cjs:23-32` mapping category names to initial status at `truth-propose` time. |
| `auto-transition` | The mechanism at `bin/lib/truth-surface.cjs:150-152` that promotes a `PROPOSED` entry to `CHALLENGED` when its `challenged_by` array becomes non-empty via `truth-update`. |
| `fail-loud` | The 3a-established principle: when invariants are violated or unknown IDs are referenced, the system MUST raise a structured error rather than silently drop or skip. Extended in 3c to "fail-loud-with-actionable-hint" for UX-driven discovery failures. |
| `ID-namespace boundary` | The line between the authoritative ledger ID namespace (`bonfire-v1.json#ledger_id_prefixes`: CON, RG, FC, AS, ACC, REQ, RISK, DEP, FACT, CLAIM, DROP) and ad-hoc sub-structure ID conventions operators may use in `case.json` (e.g., `RU-001` in `stages.requirements`, `unit-1.5` in handoff `implementation_units`). |
| `live-edit field` | A ledger entry field that can be modified on any-status entry via `truth-update`. Currently: `challenged_by`, `aligned_by`, `evidence_refs` (array-append) per `truth-surface.cjs:142`. |
| `audit-trail event type` | The `'annotate'` event type in `constraint-ledger-history.jsonl`, distinct from `'update'`. Semantic intent: `'annotate'` records post-FROZEN evidence additions; `'update'` records live-edit field modifications. Both write the same fields but the event-type distinction is load-bearing for history forensics per Assertion 1 contract. |

## 2. Context

The 2nd dogfood (bilibili-clean 2026-05-08) surfaced 20 findings. Of those, 4 (#1, #6, #7, #11) cluster around state-machine coherence:

- **#1**: `challenged_claim` entry created with `status=CHALLENGED + challenged_by=[]` — invariant violation ("CHALLENGED means has challenger"). Independently reproduced in 1st dogfood (gto-trainer 2026-05-04 finding #4) — 2-archive validation.
- **#6**: d-critique writes challenges targeting `RU-*` IDs from `case.json#stages.requirements`; `truth-update` silently drops events on unknown IDs (`truth-surface.cjs:138 if (!entry) continue`). No error, no audit trail.
- **#7**: `truth-annotate` requires FROZEN status (`truth-surface.cjs:349`); operator attempted to add evidence_refs to PROPOSED entry, got rejected, perceived as deadlock. **Reframe**: NOT deadlock — `truth-update` provides exactly the same write to same fields with no status gate. UX/discovery failure (CLI name intuition misled operator).
- **#11**: `stateInitCodeSteps` (`state.cjs:620-622`) renames all `implementation_units` to sequential `unit-N` regardless of operator's `unit.id` choice (e.g., `unit-1.5` becomes `unit-2`). State machine loses the operator-facing ID.

Stage 1 dialectic settled mechanism choices: Q1 (Cluster A — namespace boundary, #6+#11) → (c) explicit reject + literal preserve; Q2 (Cluster B-invariant, #1) → (c) PROPOSED + auto-transition; Q3 (Cluster B-UX, #7) → (d) keep gate + enhance error with literal CLI hint. Stage 2 Q4 settled MERGE — single 3c spec covers (originally) 4 findings.

**Pre-plan-drafting amendment 2026-05-12**: Lesson 4 architect-substitute discipline firing during plan-drafting reconnaissance discovered finding #6 surface was misclassified (memory recall said "truth-update silent-skip" but dogfood-log verbatim showed truth-update CLI already fail-loud at line 312; real silent-loss surface is upstream parent-skill / agent-dispatch layer). Finding #6 dropped from 3c scope per architect ratify (out-of-scope:agent-dispatch contract, not state-machine coherence). 3c v0.1 amended to cover 3 findings (#1, #7, #11); finding #6 carried as future-assertion candidate "agent-dispatch fail-loud discipline" per `bonfire-project-state.md` backlog.

## 3. Problem

3c covers 3 distinct state-machine coherence drift sites surfaced by 2nd dogfood:

### 3.1 Finding #1 — challenged_claim status invariant violation

`bin/lib/truth-surface.cjs:23-32`:
```javascript
const CATEGORY_INITIAL_STATUS = {
  retained_goal:      'PROPOSED',
  confirmed_fact:     'PROPOSED',
  frozen_constraint:  'PROPOSED',
  challenged_claim:   'CHALLENGED',  // ← skips invariant
  discarded_option:   'DISCARDED',
  high_impact_risk:   'OPEN',
  dependency_chain:   'PROPOSED',
  acceptance_semantic:'PROPOSED',
};
```
Entry is born CHALLENGED with `challenged_by: []`. Auto-transition at line 150-152 (which enforces "PROPOSED → CHALLENGED only when challenged_by populates") is bypassed. CHALLENGED state-machine semantic is violated.

`challenged_claim` is in `NO_FREEZE_CATEGORIES` (line 35), so freeze path is unaffected; the violation is purely state-machine-consistency, but it propagates: filters / queries assuming CHALLENGED implies "has challenger evidence" misread the data.

**Independently reproduced**: 1st dogfood (gto-trainer 2026-05-04) finding #4 — 2-archive validation hardens this from observation to production-grade signal.

### 3.2 Finding #7 — truth-annotate UX-discovery failure

`bin/lib/truth-surface.cjs:349`:
```javascript
if (entry.status !== 'FROZEN') {
  throw new Error(`annotate: entry "${id}" must be FROZEN (current status: "${entry.status}")`);
}
```
Operator wanting to add `evidence_refs` to a PROPOSED entry encounters this error. The correct CLI for that workflow is `truth-update --field evidence_refs --value <ref>` (no status gate per line 142 array-append handling). Operator typically lacks awareness of this distinction.

**Stage 1 Q3 reframe**: NOT state-machine deadlock — the path operator wanted exists via `truth-update`. The failure is purely cognitive (CLI name intuition misleads operator to the gated path).

### 3.3 Finding #11 — stateInitCodeSteps sequential rewrite drops unit.id

`bin/lib/state.cjs:620-622`:
```javascript
for (let i = 0; i < units.length; i++) {
  const stepName = `unit-${i + 1}`;
  steps[stepName] = { status: 'pending', pipeline: 'code' };
}
```
Operator authors `compile-output.json#handoff.implementation_units` with `[{id: "unit-1"}, {id: "unit-1.5"}, {id: "unit-2"}]`; state-machine writes `steps['unit-1'], steps['unit-2'], steps['unit-3']` — losing `unit-1.5` operator-facing label.

### 3.4 Finding #6 dropped from 3c (architect ratify 2026-05-12)

Originally enumerated in Stage 0 cartography as "truth-update silent-skip on unknown ID" causing d-critique RU-* challenges to silently lose. Pre-plan-drafting reconnaissance (Lesson 4 architect-substitute discipline firing) discovered that `truth-update` CLI **already fail-loud** at `truth-surface.cjs:312` with `{"error":"update: entry \"RU-11\" not found"}` exit 1 — verified verbatim against bilibili-clean dogfood-log.md lines 41-47. The "silent loss" surface is **upstream of state-machine code**: parent-skill / agent-dispatch layer (skills/plan/SKILL.md) has no defined contract for "what to do when truth-update fails on a delta-supplied target" — challenge intent vanishes from system audit trail. Memory description was wrong on which code surface; verify-before-recall discipline caught the divergence.

**Disposition**: Finding #6 dropped from 3c scope. Carried as future-assertion candidate "agent-dispatch fail-loud discipline" (3d-candidate or 4-extension) per `bonfire-project-state.md` backlog. 3c remains state-machine coherence; agent-dispatch contract is a different architectural surface.

## 4. Mandate scope

3c mandate per architect ratify (Stage 2 Q4 MERGE verdict):

**IN scope:**
- `bin/lib/truth-surface.cjs:27` `CATEGORY_INITIAL_STATUS.challenged_claim: 'CHALLENGED'` → `'PROPOSED'`. Auto-transition at line 150-152 is the only path to CHALLENGED (mechanism already exists; defaulting to PROPOSED unifies category-handling).
- `bin/lib/truth-surface.cjs:349` annotate FROZEN error → enhanced with literal CLI hint suggesting `truth-update --field evidence_refs --value <ref-id>` for PROPOSED/CHALLENGED entries.
- `bin/lib/state.cjs:620-622` sequential rename → literal `unit.id` preserve with format regex validation (`unit-[\w.-]+` permissive but rejecting whitespace/disallowed characters).

**OUT of scope (explicit non-goals):**
- Agent-dispatch fail-loud discipline (finding #6 surface) — when d-critique / g-red / g-blue / etc. delta contains target IDs not in ledger, parent skill needs defined contract for handling truth-update failures. This is a separate architectural surface (agent contract enforcement, not state-machine coherence). Carried as future-assertion candidate per backlog.
- Merging `truth-annotate` and `truth-update` mechanisms (event-type contract `'annotate'` vs `'update'` is load-bearing per Assertion 1 history.jsonl contract).
- Loosening `truth-annotate` FROZEN gate (would create two redundant mechanisms; `truth-update` already provides the unrestricted path).
- Renaming `challenged_claim` category or restructuring `NO_FREEZE_CATEGORIES` (orthogonal contract).
- Replay-loop fail-loud at `truth-surface.cjs:138` (`if (!entry) continue`) — this is **correct behavior** for archive-compatibility: historical events may reference IDs since superseded/discarded; replay must remain tolerant. Fail-loud here would break archive replay.

## 5. Mechanism

3c is **operational state-machine + UX mechanism change**. Unlike 3b (declarative schema-doc), 3c touches runtime validation and event-handling code paths.

### 5.1 #1 fix — challenged_claim PROPOSED default

Single line change at `truth-surface.cjs:27`:
```diff
- challenged_claim:   'CHALLENGED',
+ challenged_claim:   'PROPOSED',
```

Auto-transition at line 150-152 already handles PROPOSED → CHALLENGED:
```javascript
if (field === 'challenged_by' && entry.challenged_by.length > 0 && entry.status === 'PROPOSED') {
  entry.status = 'CHALLENGED';
}
```

**Auto-transition firing semantic (spec-time contract)**: fires on the FIRST `truth-update` event that populates `challenged_by` from empty to non-empty for an entry whose `status === 'PROPOSED'`. Subsequent `truth-update` events adding more challengers do NOT re-trigger transition (status is already `CHALLENGED`). Implicit in existing line 151 mechanism; spec is explicit to avoid implementer ambiguity.

### 5.2 #7 fix — truth-annotate error enhancement

Single error-message enhancement at `truth-surface.cjs:349`. Current:
```javascript
throw new Error(`annotate: entry "${id}" must be FROZEN (current status: "${entry.status}")`);
```

Enhanced:
```javascript
throw new Error(
  `truth-annotate: entry "${id}" must be FROZEN (current status: "${entry.status}"). ` +
  `Hint: For PROPOSED/CHALLENGED entries, use truth-update to add evidence: ` +
  `bonfire truth-update --id ${id} --field evidence_refs --value <ref-id>`
);
```

**Error wording contract (binding)**: error MUST contain literal "truth-update" CLI name with example invocation (NOT generic "use the appropriate CLI"). Operator-facing actionability is the load-bearing UX feature.

### 5.3 #11 fix — stateInitCodeSteps literal unit.id preserve

Change at `state.cjs:620-622`:
```diff
   for (let i = 0; i < units.length; i++) {
-    const stepName = `unit-${i + 1}`;
+    const unitId = units[i].id;
+    if (!unitId || !/^unit-[\w.-]+$/.test(unitId)) {
+      exitError(`stateInitCodeSteps: unit at index ${i} has invalid id="${unitId}"; ` +
+                `expected format unit-[\\w.-]+`, [], 3);
+    }
+    const stepName = unitId;
     steps[stepName] = { status: 'pending', pipeline: 'code' };
   }
```

**Format regex contract**: `unit-[\w.-]+` accepts word characters (ASCII per JavaScript `\w` without `/u` flag), dots, hyphens (covers `unit-1`, `unit-1.5`, `unit-foo_bar`). Rejects whitespace, slashes, parentheses, ASCII punctuation that would break shell/path handling downstream. Non-Latin script support (e.g., `unit-α-1`) deferred to DQ-2 — not covered by ASCII `\w`.

**Current_step initialization** (line 629-631): preserve existing condition `units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))`; replace hardcoded `'unit-1'` assigned value with `units[0].id` (literal preserve). The condition's second clause is load-bearing: it transitions `state.current_step` from a pre/plan stage value (e.g., `'stage-a'`) to the first code unit when entering `/code` pipeline. Dropping that clause would regress pipeline progression.

## 6. Schema design

3c v0.1 adds zero new schema fields. Mechanism is purely code-side (truth-surface.cjs + state.cjs). The existing `bonfire-v1.json` contract surface is unchanged.

**Why no schema change**: 3c's drift sites are in code mechanism (silent-skip → fail-loud, status default value, error message UX, ID handling) — not in schema vocabulary. Adding a schema field would over-engineer for a code-level fix.

**Exception**: `unit.id` format regex `unit-[\w.-]+` is a runtime contract referenced in `bin/lib/state.cjs`; spec §5.3 documents it. No schema-level regex field added (would be premature codification; the regex is implementation-binding via spec citation).

## 7. Acceptance criteria

3c implementation is acceptance-tested via behavioral test cases against the 3 drift sites:

1. **#1 challenged_claim PROPOSED default**: `truth-propose --category challenged_claim --content "test"` creates entry with `status: 'PROPOSED'` and `challenged_by: []`. Subsequent `truth-update --field challenged_by --value CHALLENGER-1` transitions status to `CHALLENGED` (auto-transition fires).
2. **#1 auto-transition non-repeat**: After (1)'s transition to CHALLENGED, a second `truth-update --field challenged_by --value CHALLENGER-2` does NOT re-trigger transition (status stays CHALLENGED, no event-type or status-field churn).
3. **#7 truth-annotate error hint**: `truth-annotate --id <PROPOSED-entry-id> --field evidence_refs --value REF-1` exits non-zero with stderr containing literal `"truth-update"` AND `"--field evidence_refs --value"`. The hint is operator-facing actionable.
4. **#11 unit.id literal preserve**: `stateInitCodeSteps` against handoff with `implementation_units: [{id: "unit-1"}, {id: "unit-1.5"}, {id: "unit-2"}]` writes `state.steps` with keys `'unit-1'`, `'unit-1.5'`, `'unit-2'` (NOT sequential `'unit-1'`, `'unit-2'`, `'unit-3'`).
5. **#11 unit.id format reject**: `stateInitCodeSteps` against handoff with `implementation_units: [{id: "unit-foo bar"}]` (space in id) exits non-zero with stderr containing `"invalid id"` AND `"unit-[\\w.-]+"`.
6. **current_step literal preserve**: `stateInitCodeSteps` against handoff with `implementation_units: [{id: "unit-1.5"}, ...]` AND `state.current_step` previously set to `'stage-a'` (or other non-`unit-` prefix value) results in `state.current_step === 'unit-1.5'` (first unit's literal id). Pipeline-progression transition preserved; hardcoded `'unit-1'` replaced with `units[0].id`. Predicate validates corrected §5.3 mechanism (preserves existing condition, changes only assigned value).

**Implementation verification**: `tests/test-state-machine-coherence.js` (new file) exercises predicates 1-6 via `node:test` + `node:assert/strict` + child-process CLI invocation against tmpdir bonfire instances.

## 8. Phased contract

3c ships as **complete v0.1** for the 4 enumerated drift sites. No calibration cycle or staged ramp.

**Phased extension contract (future-looking)**:
- Operator/agent education: dogfood-2026-05-08 finding #6 root-causes to `requirement_units[].id` ad-hoc convention in `case.json#stages.requirements`. 3b's `stage_schemas.requirements` declares the schema for these IDs; 3c's fail-loud at truth-update prevents silent loss. Combination: any future operator writing requirement_units with their own RU-* IDs and then attempting to challenge them gets a clear error rather than silent drop.
- Migration of existing archived `case.json` files: out of scope. Archived files are read-only evidence; 3c does not retroactively rewrite history.
- ID-namespace extension: if a future need for additional namespaces emerges (e.g., per-stage prefix conventions), spec amend per existing precedent (3a Phase 3 added ACC, round-4 added stage_schemas).

## 9. Backlog observations carried (not 3c scope)

- **`truth-annotate` discoverability**: 3c's error-hint surfaces the correct CLI but doesn't address the inverse case (operator who DOES want to add audit-trail evidence to FROZEN entry; how do they discover truth-annotate?). Spec-amend candidate if dogfood evidence emerges.
- **`unit.id` Unicode-character support**: `\w` regex covers ASCII; if operator-facing identifiers in non-Latin scripts emerge as need, format regex extends. Defer to backlog.
- **`high_impact_risk` initial status OPEN**: orthogonal to 3c #1 fix; `OPEN` is a custom status not in the documented PROPOSED/CHALLENGED/FROZEN/SUPERSEDED/DISCARDED graph. Future-spec candidate if operator confusion surfaces.
- **`stages.critique` / `red_blue` / `review` / `compile_for_code` schema absence**: 3b deferred these (not render-bearing for `case.json#stages.<id>` user-facing data); 3c doesn't touch.

## 10. Deferred Questions

| ID | Status | Description |
|---|---|---|
| **DQ-1** | DEFERRED | **truth-annotate hint generalization**: §5.2 error suggests `truth-update --field evidence_refs --value <ref-id>`. If operator wanted to add `aligned_by` or `notes`, hint mentions only evidence_refs. Generalization candidate: per-attempted-field hint. Spec-amend trigger: dogfood evidence of operator wanting `aligned_by` on PROPOSED entry. |
| **DQ-2** | DEFERRED | **Auto-transition reversibility**: auto-transition fires PROPOSED → CHALLENGED on first challenged_by populate. No mechanism for reversing (e.g., if all challengers retract, entry doesn't auto-demote). Out of 3c scope; trigger via dogfood evidence of "needed to demote CHALLENGED → PROPOSED" workflow. |
| **DQ-3** | DEFERRED | **unit.id collision detection**: if operator writes two units with same id (e.g., both `unit-1`), `state.cjs` `for` loop overwrites `steps[stepName]` silently. 3c §5.3 format regex doesn't catch collisions. Spec-amend if operator confusion surfaces. |
| **DQ-4** | RESOLVED IN 3C | **Cluster A vs B classification mid-dialectic**: Stage 0 had #1+#7 as state-invariant cluster; Stage 1 Q3 ground-truth grep reframed #7 as UX-discovery (not deadlock). Resolution: §3 restructured into 3 single-finding sections (#1 invariant + #7 UX + #11 literal preserve) post-amend (originally proposed A/B/C sub-clusters; post finding-#6 drop, only #11 remained in Cluster A, making the cluster header overloaded — simpler to drop the A/B/C grouping entirely). |
| **DQ-5** | RESOLVED IN 3C | **Q4 SPLIT vs MERGE**: Stage 2 tentative-default was SPLIT (3c-A + 3c-B); Stage 1 mechanism dialectic revealed total scope ~25 LOC + ~600-900 spec/plan lines, making split overhead disproportionate. Resolution: MERGE — single 3c spec covers (originally) 4 findings; (post-amend) 3 findings after finding #6 drop. |
| **DQ-6** | RESOLVED IN 3C | **Finding #6 dropped pre-plan-drafting**: dogfood-log verbatim re-read showed truth-update CLI already fail-loud at `truth-surface.cjs:312`; real silent-loss surface is parent-skill / agent-dispatch layer, not state-machine. Drop from 3c scope; carry as future-assertion candidate "agent-dispatch fail-loud discipline" per backlog. |

## 11. Risks and Mitigations

**Risk 1 — Auto-transition off-by-one or status reset.**

§5.1 changes line 27 default but relies on existing line 150-152 auto-transition. If implementer accidentally removes or modifies the auto-transition logic, challenged_claim entries born PROPOSED would have no path to CHALLENGED.

- *Mitigation 1*: §5.1 explicit "auto-transition firing semantic" wording specifies the FIRST-fire behavior + subsequent no-repeat semantic.
- *Mitigation 2*: §7 predicates 1 + 2 exercise both the first-fire and the no-repeat cases.
- *Mitigation 3*: line 27 change is single-line and orthogonal to auto-transition logic; review surface is minimal.
- *Residual risk*: low. Single-line config change with existing mechanism reuse.

**Risk 2 — unit.id format regex over-strict or under-strict.**

§5.3 regex `unit-[\w.-]+` chosen as permissive default. Could be over-strict (e.g., rejects `unit/foo` if operator intentionally uses slash) or under-strict (e.g., accepts `unit-` with empty suffix).

- *Mitigation 1*: §7 predicate 5 tests over-strict case (whitespace rejection).
- *Mitigation 2*: backlog DQ-2 catalogs Unicode extension if non-Latin operator identifiers emerge.
- *Mitigation 3*: regex change is single-line; future spec amend straightforward.
- *Residual risk*: low. Conservative permissive set covers known cases.

**Risk 3 — UX-hint error message wording stale across CLI rename.**

§5.2 error message embeds literal `truth-update --field evidence_refs --value <ref-id>` as actionable hint. If future spec renames `truth-update` CLI or restructures argument syntax, the hint goes stale.

- *Mitigation 1*: error message wording in code is grepped at every CLI rename; rename PRs surface as spec amend triggers.
- *Mitigation 2*: backlog DQ-2 generalization could templatize the hint (per-field dynamic), reducing stale-text risk.
- *Residual risk*: low-medium. CLI rename is itself a major spec event; hint stale is downstream of that and easily noticed.

## 12. Cross-references

**Specs:**
- `2026-04-18-bonfire-freeze-enforcement-design.md` (Assertion 1 — preserved authoritative ledger contract)
- `2026-04-18-bonfire-hj-seam-hardening-design.md` (Assertion 2)
- `2026-05-08-bonfire-assertion-3a-validation-theater-design.md` (Assertion 3a — fail-loud principle 3c extends)
- `2026-05-10-bonfire-assertion-4-round-4-design.md` (Assertion 4 round-4)
- `2026-05-10-bonfire-assertion-3b-design.md` (Assertion 3b — stage_schemas.requirements declares RU-equivalent schema)

**Evidence:**
- `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` (1st dogfood — finding #4 reproduction of #1)
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (2nd dogfood — primary 3c empirical anchor; findings #1, #6, #7, #11)

**Memory:**
- `bonfire-project-state.md` — assertion sequencing, 3a + round-4 + 3b + F1 closure context
- `dogfood-2026-05-04-findings.md` — finding #4 (1st-archive reproduction of #1)
- `dogfood-2026-05-08-bilibili-danmaku-findings.md` — findings #1, #6, #7, #11 (3c problem evidence); finding #7 amended 2026-05-12 to reflect UX-discovery reframe
- `feedback-subagent-execution-discipline.md` — 7 lessons from 3a + round-4 + 3b; 3c does not surface new lessons (mechanism is bounded code change, established patterns apply)

**Code (touched by 3c implementation):**
- `bin/lib/truth-surface.cjs` — silent-skip → fail-loud (CLI entry, ~5 lines); CATEGORY_INITIAL_STATUS line 27 (~1 line); annotate error enhancement line 349 (~5 lines)
- `bin/lib/state.cjs` — stateInitCodeSteps literal preserve + format regex (~8 lines)
- `tests/test-state-machine-coherence.js` (new) — acceptance predicates 1-7

---

**End of Assertion 3c v0.1 spec draft.**

Awaits architect dialectic review (author + reader 二角). Iterate to v0.1 freeze; entry to 3c plan creation phase upon freeze.
