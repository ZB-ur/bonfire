---
title: ASSERTION-4 — Layer 2b Softening + Layer M Mandate
charter: 2026-05-04-bonfire-maturity-assessment.md (rows #1, #2, #4, #5, #8)
errata: 2026-05-04-bonfire-maturity-assessment-errata.md
followup_routing: ASSERTION-5-backlog.md (B001–B007)
freeze_status: "frozen-with-bounded-calibration — THRESHOLD value is calibrated during plan (§3.3) within bounds defined by §3.2 + fixture lattice §7. §3.2 kill criterion triggers errata + maturity-assessment v2 + spec re-cut. The spec is frozen; only the calibrated parameter inside it is open."
purpose: Close two orthogonal seam-validation gaps surfaced by 2026-05-04 dogfood — Layer 2b false-positive rate on legitimate handoff prose (anti-invention over-strictness) and substantive-slot vacuous-pass loophole (anti-omission absence).
---

# ASSERTION-4 — Layer 2b Softening + Layer M Mandate

## §1 — Scope contract

This spec implements rows #1, #2, #4, #5, #8 of `2026-05-04-bonfire-maturity-assessment.md` (frozen). Rows #3, #6, #7 + secondary findings are out of scope and routed to `ASSERTION-5-backlog.md` items B001–B007.

**Charter rule:** spec dialectic may not introduce new intervention items beyond the in-scope rows. New discoveries route to:
- `2026-05-04-bonfire-maturity-assessment-errata.md` if existing-row scoring was wrong → triggers re-charter
- `ASSERTION-5-backlog.md` if a new intervention emerged → out-of-scope deposit
- A hard-blocker dependency from in-scope on out-of-scope → triggers maturity-assessment v2 (not silent expansion)

## §2 — Layer naming taxonomy

PR #2 introduced Layer 1 / Layer 2a / Layer 2b. ASSERTION-4 introduces **Layer M** as a distinct namespace:

| Layer | Direction | Job |
|---|---|---|
| Layer 1 | anti-invention (H verdict text) | block bad conditions before they reach J |
| Layer 2a | anti-invention (J slot structure) | source_kind enum + source_ref dereferences to FROZEN |
| Layer 2b | anti-invention (J slot content) | substantive tokens overlap with referenced source |
| **Layer M (NEW)** | **anti-omission (J handoff completeness)** | **block J from passing validation by emitting too little** |

Future anti-invention layers reserve Layer 2c, 2d, etc. Future mandate refinements reserve Layer M2, M3. The two namespaces stay orthogonal.

## §3 — Axis (a): Layer 2b softening

**Rationale (from maturity-assessment row #1 + dogfood evidence):** Current zero-orphan rule produced ~200 false-positive orphans on a single legitimate handoff. Two coupled changes:

### §3.1 — A1: CON cross-reference passthrough

In `bin/lib/seam-validation.cjs::compareTokens` (consumer of extractSubstantiveTokens output), tokens matching pattern `/^con-\d+$/i` are treated as scaffolding, not as substantive content. They count toward neither the source-set nor the orphan-set.

Justification: `CON-026` appearing in a J slot description as a cross-reference to a related ledger entry is meta-text, not invented product semantics. The dogfood produced ~50 such orphans alone.

#### §3.1.1 — Tokenization contract (load-bearing for A1)

A1 depends on `extractSubstantiveTokens` producing `con-026` as an atomic single token, not splitting on the hyphen. As of this spec's freeze date, the implementation already satisfies this:

- `boundaryRegex = /[\s.,;:!?()\[\]{}"'`]/` excludes hyphen
- `lemmatizeToken` line `if (/-\d/.test(token)) return token` preserves identifier tokens

These two facts are now an explicit **contract** that ASSERTION-4's A1 relies on. Plan MUST add a regression test asserting:

```js
extractSubstantiveTokens('CON-026 is foo. con-099, RG-014!') 
  // returns exactly ['con-026', 'is', 'foo', 'con-099', 'rg-014']
```

If a future spec needs to add hyphen to boundary characters or remove the identifier preservation in lemmatization, A1's behavior breaks silently. The regression test is the canary.

### §3.2 — A3: Ratio threshold replacing zero-orphan rule

`compareTokens` returns `{ valid: boolean, overlap_ratio: number, ... }`. The validation rule changes from:
```
valid := orphan_tokens.length === 0
```
to:
```
valid := overlap_ratio >= THRESHOLD
```

`THRESHOLD` is **not a constant in this spec**. It is determined empirically during plan/code stages, bounded by fixture anchors (§7):
- MUST be > 36% (so `tagged-correct-but-invents` continues to fail — preserves PR #2 detection floor)
- MUST be > 0% (so `pure-invention-floor` fails — anchors the absolute lower bound)
- MUST be ≤ `legitimate-paraphrase-passes` empirical anchor (so legitimate prose can pass)

If the empirical legitimate-paraphrase anchor turns out to be ≤ 36% (i.e., legit prose overlaps less than tagged-correct-but-invents), the threshold range becomes empty — **this is a kill criterion** for the A3 approach. In that case, plan must escalate (re-charter via maturity-assessment errata, or shift to a different option from rows #1's A2/A4).

Additional **gap-width guard**: even if the range is non-empty, if `(legitimate-paraphrase-anchor - 36%) < 10 percentage points`, the range is too narrow for a defensible threshold pick. Treat as a soft-kill: plan must explicitly request operator decision (proceed with hairline THRESHOLD, or escalate to errata). Do NOT silently accept a hairline.

#### §3.2.5 — Threshold offset policy

Within the valid range `[lower, upper]` defined above, THRESHOLD is set as:

```
THRESHOLD = lower + ε    (ε small, e.g. 1 percentage point)
```

This is **lower-biased**: positions THRESHOLD as close as defensible to the must-fail boundary, sacrificing a small permissive cushion to maintain anti-invention pressure.

Rationale: ASSERTION-4's purpose is closing two anti-X gaps simultaneously (anti-invention false-positive softening + anti-omission mandate addition). Choosing a generous middle or upper-biased threshold would re-import false-negative risk at the moment we are tightening up the omission boundary. The whole charter is "make the system harder for J to evade detection"; threshold offset must reflect that orientation.

Operator override: plan may pick mid-bias `(lower + upper) / 2` OR upper-bias `upper - ε` ONLY with explicit rationale recorded in plan calibration log. Default is lower-bias.

### §3.3 — Calibration step (during plan, not code)

Plan must include a calibration sub-task: dispatch a single j-compile on the gto-trainer dogfood case (`/Users/lddmay/AiCoding/bonfire-test/gto-trainer/`), instructing the agent to write "natural paraphrase, not literal quote". Capture each populated substantive slot's overlap ratio against its source ledger entry **under the new A1 rule (CON-* passthrough applied)**.

#### §3.3.1 — Statistical form (binding)

The calibration anchor is computed as follows (this is the spec's commitment, not plan's discretion):

```
ANCHOR = 5th percentile of populated-slot overlap ratios
         after A1 mask is applied,
         computed over a calibration dispatch producing ≥ 6 populated substantive slots.
```

Rationale for 5th percentile: accepts ~5% legit-FP risk in exchange for outlier robustness. min() would let a single low-overlap slot pin the anchor unrealistically low; mode/median would let easy slots dominate; 25th percentile would accept too much FP. 5th is a defensible middle ground that prioritizes anchor stability.

Rationale for ≥ 6 sample minimum: dogfood produced 0 populated slots (minimal handoff); calibration MUST coerce J to produce ≥6 to give the percentile statistical meaning. If j-compile produces fewer, calibration fails kill-criterion (re-dispatch with stricter "produce ≥6 slots" guidance, or escalate).

#### §3.3.2 — Outlier exclusion (transitive paraphrase) — hybrid enumeration with halt-on-unknown

Slots whose source ledger entry has certain `aligned_by` token shapes are EXCLUDED from anchor computation. Reason: measuring overlap of slot vs paraphrased-source double-counts paraphrase distance.

**Classification rule (binding, empirical — derived from dogfood 2026-05-04 archive 14-token forensic):**

```
EXCLUDE  if token contains substring "-via-" or "-by-"
INCLUDE  otherwise (including null, undefined, empty array)
HALT-AND-CLASSIFY  retained as escape valve for shapes the operator
                   judges genuinely ambiguous (e.g., a -by- token whose
                   semantic is authority, not paraphrase)

False-positive whitelist: empty at spec freeze. Operators may add shapes
that contain "-via-" or "-by-" but are confirmed non-paraphrase via
calibration log review (see plan responsibility below).
```

**Why substring rather than positive/negative enumeration:** the dogfood archive emits 14 distinct `aligned_by` values, only 2 of which (`stage-g-survival`, `stage-h-ruling`) are codified at code-level. The other 12 are free-form strings emitted by agents/operators at runtime. Static enumeration of paraphrase markers is brittle in the face of agent behavior; substring detection of forward-port references (`-via-X`, `-by-X` shape) classifies all 14 dogfood values correctly and degrades gracefully on novel shapes (HALT escape).

**Empirical grounding (forensic, 2026-05-06):**

| Substring rule applied to dogfood 14 | Result |
|---|---|
| `stage-g-survival` | INCLUDE ✓ |
| `g-blue` | INCLUDE ✓ |
| `g-blue-mitigated-via-CON-026..036` (×6) | EXCLUDE ✓ (paraphrase chain via agent prefix) |
| `stage-e-superseded-by-CON-016` | EXCLUDE ✓ |
| `stage-e-resolution-via-CON-023` | EXCLUDE ✓ |
| `stage-e-mitigate-via-mixed-flag-display` | EXCLUDE ✓ (descriptive forward-port; semantically chain) |
| `stage-e-drop-schema-version-via-CON-024` | EXCLUDE ✓ |
| `stage-e-accept-30-as-v0.1-budget` | INCLUDE ✓ (residual acceptance) |
| `stage-e-accept-as-known-limitation-CON-022` | INCLUDE ✓ (CON-022 here is descriptor not via-ref) |

Total: 14/14 correctly classified. The retained PR #2 hardcoded constants (`stage-g-survival`, `stage-h-ruling`) cleanly fall under INCLUDE without special-casing.

**Plan responsibility (preemptive, before calibration dispatch):**

Plan calibration sub-task MUST start with:

1. `grep` literal aligned_by token emit constants across `bin/lib/truth-surface.cjs`, `bin/lib/freeze-enforcement.cjs`, `bin/lib/schema.cjs`. (Currently this finds 2: TOKEN_STAGE_G, TOKEN_STAGE_H.)
2. **Scan recent dogfood archive ledger snapshots** at `bonfire-test/*/.bonfire/archive/*/truth-surface/constraint-ledger-snapshot.json` for actual aligned_by values used in production. Free-form agent/operator strings live here, not in code.
3. Apply substring rule to every distinct value found.
4. If a value's classification is operator-judged ambiguous (rare, theoretically possible), HALT — operator records the decision in calibration log and (if EXCLUDE→whitelist transition warranted) triggers errata.
5. Only after enumeration + classification, run the calibration dispatch.

This pushes novel-marker decisions to the human at planning stage, not at data-processing stage. Calibration data flow stays uninterrupted.

**Calibration log enumeration requirement (binding):** the calibration log MUST enumerate the actual EXCLUDE set produced for the calibration sample (i.e., every aligned_by value found that triggered exclusion). Operator inspects this enumeration before accepting the anchor; any value the operator judges should have been INCLUDE goes to the false-positive whitelist (logged as a calibration decision artifact with rationale). This makes whitelist activation a forced review step rather than an after-the-fact discovery.

After exclusion, if remaining sample size < 6, calibration fails (same handling as §3.3.1 minimum violation).

#### §3.3.3 — Failure paths

- **j-compile cannot produce natural paraphrase** (e.g., responds with literal quotes despite prompting): re-dispatch with stricter natural-paraphrase guidance once. If second attempt also fails, plan escalates to errata + maturity-assessment v2.
- **Sample size < 6 after outlier exclusion**: calibration kill criterion met (same handling).
- **5th percentile of remaining slots ≤ 36%**: calibration kill criterion met.
- **Gap width < 10pp** per §3.2 guard: soft-kill, operator decision required.

## §4 — Axis (b): Layer M mandate

**Rationale (from maturity-assessment row #2 + dogfood evidence):** Layer 2a/2b only fire when J populates substantive slots. The dogfood passed validation by omitting all substantive slots. Layer M closes this loophole.

### §4.1 — Per-unit declaration

Each `handoff.implementation_units[N]` gets a new field:
```json
{
  "id": "UNIT-3",
  ...,
  "substantive_slot_refs": ["FC-005", "FC-006", "CON-026"]
}
```

`substantive_slot_refs` is `string[]`. Default `[]`. Two ref kinds:

- **Concrete refs** (slot ids): `FC-NNN`, `panel:<id>`, or an entity name. These resolve to a populated slot in `handoff.{domain_model.entities, function_contracts, data_contract, ui_contract.panels}`.
- **Supplementary refs** (ledger entry ids): `CON-NNN`, `RG-NNN`, etc. These are cross-references to ledger entries; used for traceability annotation but do not by themselves satisfy the "this unit implements substantive content" claim.

**Per-unit invariant (NEW)**: when a unit declares non-empty `substantive_slot_refs`, the array MUST contain ≥ 1 concrete ref. Supplementary refs alone are not sufficient. This prevents a unit declaring `["CON-026"]` and resolving to CON-026 cited inside another unit's slot (loose traceability bypass).

### §4.2 — Handoff-level invariant

Layer M validates the following disjunction:

```
INVARIANT M (must satisfy ONE):
  (M.1)  ∃ unit ∈ handoff.implementation_units
         such that unit.substantive_slot_refs.length > 0
  
  OR
  
  (M.2)  handoff.no_substantive_contract === true
         AND handoff.no_substantive_contract_reason is a non-empty string
         AND no_substantive_contract_reason contains AT LEAST ONE token
            matching pattern /(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\d+/
            (i.e., at least one literal ledger entry id reference)
         AND no_substantive_contract_reason passes ZERO-ORPHAN token coverage
            (NOT the §3.2 ratio rule) against the FIRST referenced ledger entry,
            EXCLUDING the literal id token itself from the orphan check
```

**Why zero-orphan instead of THRESHOLD ratio for M.2:** the M.2 reason field is short (~1-3 sentences) and serves a different rhetorical purpose than substantive slot prose. Slot prose is "what will be delivered" — paraphrase is natural. M.2 reason is "why I won't deliver substantive content" — an exception form that should be a literal restatement of the cited ledger entry's relevant claim, not a paraphrase. Different genre, different rule. Mixing the two under a shared THRESHOLD is a category error.

The literal id token is excluded from orphan check because it's a structural reference (the very thing we required), not content.

(M.2) is the legitimate escape valve for non-typical artifacts (e.g., `probe.sh` is a single shell script with no contract surface). Its constraints (must reference + must pass strict zero-orphan against cited entry) prevent it from becoming a free pass.

### §4.3 — Per-ref resolution

For every unit's `substantive_slot_refs[i]`, the validator dereferences to a populated slot:
- Format `FC-NNN` → `handoff.function_contracts.find(fc => fc.id === ref)`
- Format `<entity-name>` → `handoff.domain_model.entities.find(e => e.id === ref || e.name === ref)`
- Format `panel:<id>` → `handoff.ui_contract.panels.find(p => p.id === ref)`
- Format `CON-NNN` → can resolve to ledger-direct provenance reference inside any substantive slot (delegates to existing Layer 2a)

Resolution failure → Layer M fail with specific orphan ref id.

### §4.4 — Reentry route (retry-bounded)

New conflict_type: `mandate_failure`. Routing is **retry-bounded** (new concept introduced by this spec):

```
mandate_failure → stage-j (retry budget = 2)
                  if reentry depth for this conflict_type exceeds 2 → stage-h (escalation)
```

**Rationale (departing from PR #2's handoff_provenance_failure → stage-h precedent):**

mandate_failure is structurally J-fixable when the input ledger is intact. J has the FROZEN snapshot; the missing content is "fill substantive slots referencing ledger entries that already exist". Routing directly to stage-h would be theatrical — H has nothing to reformulate; the verdict is correct, J just under-delivered.

| Conflict type | J self-fixable? | Routing |
|---|---|---|
| `handoff_provenance_failure` | Sometimes (if J added invention vs H injected it) | stage-h (PR #2 simplification debt; B002 backlog owns refinement) |
| `mandate_failure` (NEW) | Yes (J reads ledger, fills slots) | stage-j retry-bounded; stage-h on exhaustion |

**Retry budget mechanics:**

The reentry routes table gains a new optional field `retry_budget: number | null`. Default `null` = unlimited (current behavior; PR #2 unchanged). For `mandate_failure`: `retry_budget: 2`.

The retry_budget is **per-conflict-type**, not global. The counter is computed from the reentry history filtered by conflict_type (NOT from the global `reentry_request.depth` field, which counts all reentries together):

```
budget_used := count(state.reentry.history, h => h.conflict_type === <X>)
budget_used <= retry_budget → accept reentry, reset target stage to "running"
budget_used >  retry_budget → fall through to escalation_target_stage (default: stage-h)
```

This introduces "per-conflict-type retry budget" as a new primitive. ASSERTION-5 may extend it to other conflict_types (B002 currently scoped to per-route reset granularity; budget is a complementary axis).

#### §4.4.1 — Budget interaction with global max_depth

PR #2 enforces a global `max_depth = 2` on reentry chains regardless of conflict_type. ASSERTION-4's per-conflict `retry_budget` operates **within** that ceiling, not independently. Concrete order:

1. **Hard stop first**: if global reentry depth would exceed `max_depth`, halt — no further reentry permitted regardless of per-conflict budget. Operator must intervene.
2. **Per-conflict budget second**: within the global ceiling, per-conflict `retry_budget` further constrains how many reentries of a specific conflict_type can occur.
3. **First violator wins**: whichever cap (global or per-conflict) is hit first triggers the corresponding behavior. Global hit → halt. Per-conflict hit → escalation_target_stage (e.g., stage-h).

This means: in the worst case, mandate_failure can consume up to 2 reentries (its budget), but ONLY if no other conflict_type has consumed reentry depth first. A run that has already used 1 reentry on `handoff_provenance_failure` has only 1 remaining mandate_failure budget effectively, regardless of `retry_budget: 2`.

Making per-conflict budget independent of global max_depth would require a redesign of the depth model (separate counters per conflict_type, or budget-aware max_depth raise). That redesign is **out of ASSERTION-4 scope** and tracked in `ASSERTION-5-backlog.md` B002 (which already owns reentry routing refinements).

**Logging requirement:** each retry attempt under retry_budget MUST emit a `log-agent` event recording (a) attempt number, (b) which substantive_slot_refs J reported, (c) what the validator rejected. This creates an audit trail for the "is J actually self-fixing or just looping?" question.

## §5 — Mechanical riders

### §5.1 — Row #4: auto-id

`bonfire truth-propose --id auto` (new value alongside literal `--id CON-007`):
- Reads current snapshot.
- Picks `max(numeric tail of all entry ids matching /^CON-\d+$/) + 1` as the new id.
- Returns the assigned id in the JSON output.

Behavior is **flat CON-NNN only**. Other prefixes (RG / FC / RISK / DROP / etc.) remain valid as user-specified ids but are not auto-generated. Schema doc adds footnote: `prefix is recommendation only; tooling assumes flat numbering for auto-id`. Existing prefix entries unchanged.

ASSERTION-5 B007 owns the broader question of prefix-recommendation lifecycle.

### §5.2 — Row #5: discard ruling enum check

`bin/lib/delta-parser.cjs` (or wherever bonfire-h-review delta validation lives): add a constraint that for each `verdict.rulings[i]`:
```
ruling.action ∈ {"freeze", "supersede"}
```

Schema (`bonfire-v1.json`):
```json
"bonfire-h-review": {
  "constraints": {
    ...,
    "ruling_action_enum": ["freeze", "supersede"]
  }
}
```

Delta-validate fail message: `ruling.action "<X>" not in {freeze, supersede}; lifecycle ops (discard) are not valid h-review rulings`.

This implicitly confirms the design call: discarding belongs to lifecycle ops (`bonfire truth-discard`), not h-review verdicts.

### §5.3 — Row #8: supersede error message tweak

In `bin/lib/truth-surface.cjs::supersede`, the existing error:
```
supersede: entry "<id>" is <STATUS>, must be FROZEN. Use truth-discard on the old entry, then truth-propose the replacement.
```
becomes:
```
supersede: entry "<id>" is <STATUS>, must be FROZEN.
For CHALLENGED entries: prefer `truth-update --id <id> --field aligned_by --value <token>` (resolves via alignment).
For unwanted entries: use truth-discard then truth-propose the replacement.
```

`skills/plan/SKILL.md` Stage E section is updated to document align-via-token as the primary verb for resolving CHALLENGED entries; supersede stays for FROZEN-truth amendment.

## §6 — Schema deltas

### §6.0 — Boundary rule (declared explicitly to prevent DSL slippage)

**Schema declares parameters; validator code owns rule shape.** PR #2's `_provenance_required` annotation is borderline DSL — ASSERTION-4 must NOT extend that pattern. Specifically:

- ✓ Allowed in schema: field names, regex patterns, enum lists, numeric thresholds, boolean flags
- ✗ Forbidden in schema: disjunctions, conjunctions, conditional logic, "this means call function X", marker keys like `_layer_m: true` that influence validator behavior

If a future spec wants to express "rule X applies to slot Y only if condition Z", that logic lives in `bin/lib/schema.cjs` (or `seam-validation.cjs`), not in `bonfire-v1.json`.

**Refinement of the boundary (added during dialectic round 2):** the schema-declares-parameters rule applies **within a given dispatch mode**. It does NOT cover dispatch-mode selection itself. For example, "concrete ref resolves via regex pattern OR via container-lookup with name-equality" is dispatch-mode selection — that lives in code, not in schema. Within each mode, schema may declare its parameters (regex strings for regex mode; container path + match field names for lookup mode). This refinement keeps §6.1's `concrete_ref_patterns` (regex-only) consistent with the entity-name lookup path which lives in `bin/lib/schema.cjs`.

**Grandfather note:** PR #2's `_provenance_required` annotation predates this rule. It is grandfathered for ASSERTION-4 — not endorsed. Migration tracked as `ASSERTION-5-backlog.md` B008. Future schema additions follow §6.0 strictly.

### §6.1 — `schemas/bonfire-v1.json` additions

Additions only (no removals, no field renames). Strictly parameter-shaped per §6.0:

1. `delta_schemas.bonfire-h-review.constraints.ruling_action_enum: ["freeze", "supersede"]`
2. `handoff_substantive_slots` unchanged.
3. New `handoff_mandate_params` block (PARAMETERS only — rule logic lives in `validateMandate`):
   ```json
   "handoff_mandate_params": {
     "ref_field": "substantive_slot_refs",
     "concrete_ref_patterns": [
       "^FC-\\d+$",
       "^panel:.+$"
     ],
     "supplementary_ref_pattern": "^(?:CON|RG|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+$",
     "escape_valve": {
       "flag": "no_substantive_contract",
       "reason_field": "no_substantive_contract_reason",
       "reason_ref_pattern": "(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
       "reason_uses_zero_orphan": true
     }
   }
   ```
   (Note: entity-name concrete refs are validated by string-equality lookup in `handoff.domain_model.entities[].name`, not by regex pattern. That's why `concrete_ref_patterns` lists only FC and panel formats.)
4. New reentry route entry: `mandate_failure` with `retry_budget: 2`, `escalation_target_stage: "stage-h"`.

Rule logic placement:
- §4.2 disjunction (M.1 OR M.2) → `bin/lib/schema.cjs::validateMandate`
- §3.1.1 tokenization contract regression → `tests/test-tokenization-contract.js`
- Retry-budget mechanics → `bin/bonfire-tools.cjs` state-reentry handler

### §6.2 — Bundle version

`bundle_version` does NOT bump. Per F1, existing compile-output.json files (e.g., gto-trainer dogfood archive) are intended to fail validation under the new rules. Documented in commit message.

## §7 — Fixture battery

**5 new + 2 retained from PR #2:**

| # | Fixture | Status | Anchors |
|---|---|---|---|
| 1 | `omit-substantive-slots/` | new | Layer M (M.1 violation) |
| 2 | `supersede-drift/` | reuse PR #2 | Layer 2a FROZEN sub-check |
| 3 | `condition-index-out-of-range/` | new | Layer 2a condition_rewrite path |
| 4 | `pure-invention-floor/` | new | Layer 2b detection floor (0% overlap) |
| 5 | `legitimate-paraphrase-passes/` | new (calibration-derived) | Layer 2b upper anchor |
| (retained) | `tagged-correct-but-invents/` | PR #2 | Layer 2b mid-floor (~36%) |
| (retained) | `chain-dilution/` | PR #2 | Layer 2b mid-range |

Anchors collectively pin THRESHOLD between `tagged-correct-but-invents`'s 36% (must fail) and `legitimate-paraphrase-passes`'s empirical anchor (must pass). The retained fixtures are first-class regression guards — deletion is forbidden.

Fixture #5 content is produced during plan calibration (§3.3) and is the empirical anchor for THRESHOLD selection.

## §8 — Backward compatibility (F1) — affected stage products

Pre-ASSERTION-4 stage products that will fail validation under new rules. F1 stance (intended-fail) applies to all of them. Documented in commit message. The gto-trainer 2026-05-04 dogfood archive is the only known producer of legacy artifacts in this repo; it is research-only.

| Stage product | What changed | Failure mode |
|---|---|---|
| `compile-output.json` (J) | New `substantive_slot_refs` per unit OR `no_substantive_contract` flag required | Layer M (M.1 OR M.2) fails on missing both |
| `h-review-verdict.json` (H) | `ruling.action` enum tightened to `{freeze, supersede}` | delta-validate fails on legacy `discard` rulings (e.g., dogfood verdict) |
| `bonfire-v1.json` consumers (any) | Schema gains `handoff_mandate_params` + `mandate_failure` reentry route | Older validator code reading schema would not find new keys but won't error (graceful — keys are additions); new code on old schema would fail to find params |
| `state.json` reentry depth tracking | `retry_budget` field on routes table; depth comparisons use it | Pre-ASSERTION-4 state.json files have no retry_budget; default `null` (unlimited) preserves PR #2 behavior |

**Required commit message language:**

```
BREAKING: pre-ASSERTION-4 stage products fail validation under new rules.
Affected: compile-output.json (Layer M), h-review-verdict.json (ruling enum).
Intended behavior per specs/2026-05-04-bonfire-assertion-4-design.md §8.
```

State file (`state.json`) is forward-compatible (additions, defaults preserve old behavior). Schema file (`bonfire-v1.json`) is forward-compatible for additions; consumers reading new fields are responsible for absence-tolerance.

## §9 — Non-goals (rejected options preserved here for spec dialectic anchoring)

Options that were considered and rejected during brainstorm — these MUST NOT be reintroduced via dialectic:

- A2 (whitelist expansion as primary axis-(a) mechanism): rejected — runaway risk per dogfood
- A4 (skip prose fields entirely): rejected — would skip the surface where invention hides
- B1 (mandate emit-something at minimum): rejected — gameable with 1-line dummy slot
- B2 (mandate emit-non-trivial referencing FROZEN): rejected — partial coverage only
- B3 full (validator scans implementation_units prose for ref patterns): rejected — magic; B3-lite (declarative refs field) preferred
- C1 (make discard ruling work in apply-h-rulings): rejected — semantic mismatch
- C3 (rebound discard to lifecycle op): rejected — adds path, doesn't clarify
- D1 (loosen supersede to accept CHALLENGED): rejected — supersede semantic is FROZEN-truth amendment, loosening dilutes
- D3 (introduce new "resolve" verb): rejected — verb proliferation
- E1 (auto-id with arbitrary user prefix): rejected — fragments numbering across runs
- E2 (auto-id with category-derived prefix): rejected — caused dogfood inconsistency
- F2 (bundle_version bump for graceful migration): rejected — bonfire is pre-1.0
- H1 (Layer 2c naming for mandate): rejected — conflates orthogonal directions
- H3 (rename all layers): rejected — external surface too large for this scope

## §10 — Risks and known unknowns

1. **Calibration fixture #5 produces unusable anchor** (§3.3 kill criterion). If plan calibration shows legitimate-paraphrase overlap ≤ 36% OR gap < 10pp, axis (a) approach is at risk. Mitigation: kill criterion + soft-kill explicit; plan must escalate to errata-and-recharter rather than ship a guessed THRESHOLD.

2. **Layer M (M.2) escape valve abuse**. A J agent could write `no_substantive_contract: true` with a reason that references an unrelated FROZEN entry to satisfy zero-orphan against the cited entry. Mitigation: zero-orphan against cited entry text means reason prose must literally repeat the entry's content tokens — abuse requires the J agent to literally retype the cited entry. Realistically possible but high-friction. Plan dialectic may weigh adding a `_min_reason_token_count: N` constraint if this is exercised by a fixture.

3. **mandate_failure retry-budget mechanism** is a new concept introduced by this spec. Risks: (a) budget exhaustion logging may mask repeated J failures of same shape if log analysis is not added; (b) per-conflict-type budget creates a heterogeneous routes table that future routes will need to decide budget for; (c) per-conflict budget operates within global max_depth ceiling per §4.4.1, so the effective budget may be smaller than `retry_budget: 2` if other conflict types consumed depth first — making per-conflict budget independent requires depth-model redesign and is deferred to ASSERTION-5 B002. Mitigation: §4.4 logging requirement creates audit trail; default `retry_budget: null` preserves PR #2 behavior for existing routes; §4.4.1 explicitly declares the cap interaction so plan/code does not assume independence.

4. **A1 regex passthrough false positives**. The pattern `/^con-\d+$/i` matches any token of that shape, including (theoretically) prose token sequences that happen to look like CON-NNN. Mitigation: regex is anchored start-to-end; whole-token match only; token boundary set by existing extractSubstantiveTokens whitespace+punctuation rules. §3.1.1 contract test guards the tokenizer behavior.

5. **§4.1 ref-pairing is not strictly enforced (loose traceability residual)**. Per §4.1 a unit's `substantive_slot_refs` must contain ≥1 concrete ref. But the validator does NOT check that supplementary `CON-NNN` refs in the same unit appear inside the cited concrete slot's source_ref. UNIT-3 declaring `["FC-005", "CON-099"]` where FC-005's slot has no relation to CON-099 will pass M.1 validation. Mitigation: the primary loophole (vacuous-pass) is closed by ≥1-concrete rule; weaker traceability concern is acceptable for ASSERTION-4 scope. ASSERTION-5 may add tighter ref-binding if a fixture demonstrates a real abuse.

6. **§3.2.5 lower-biased threshold may compound dogfood operator burden**. Choosing THRESHOLD = lower + ε means more legitimate paraphrases hit the floor and trigger Layer 2b reentries. This is the deliberate trade-off (anti-invention orientation), but plan must observe whether the resulting reentry rate is workable. If post-implementation dogfood shows operators frequently hit Layer 2b reentries for prose that's clearly legit, the offset policy is wrong direction; would trigger errata.

7. **§3.3.2 substring rule's `-by-` lexical ambiguity**. Rule treats any token containing `-by-` substring as paraphrase chain. Holds empirically for dogfood 2026-05-04 archive (only `superseded-by-CON-NNN` shape observed). Theoretically fragile if future bonfire usage emits authority-class shapes within the `aligned_by` field — e.g. `authored-by-agent-X` (origin marker), `approved-by-user` (authority signal), `discussed-by-team` (provenance). Such tokens would be false-EXCLUDE'd. Mitigation chain: (a) `aligned_by` field semantic is currently constrained to truth-surface alignment context, not authority/origin, so non-paraphrase `-by-` shapes are unlikely by design; (b) §3.3.2 calibration log enumeration forces operator to inspect EXCLUDE set and white-list false positives; (c) B010 structural codification eliminates the ambiguity at the source. ASSERTION-5 may surface this risk as concrete (rather than theoretical) if a future dogfood emits such tokens — at which point errata or B010 acceleration is the response.

## §11 — Test plan summary

Plan must produce:
- Calibration step output (§3.3 j-compile dispatch + overlap distribution analysis + 5th-percentile + outlier-exclusion application)
- 5 new fixture directories + companion test entries in `tests/test-hj-seam-fixtures.js`
- Schema delta tests (handoff_mandate_params block presence and shape)
- Reentry route table test (mandate_failure entry with retry_budget=2, escalation_target_stage=stage-h)
- Retry-budget mechanics test (state-reentry depth-vs-budget comparison, escalation behavior at exhaustion)
- Per-retry log-agent emission test (§4.4 audit-trail requirement)
- Auto-id behavior tests (`truth-propose --id auto` produces flat CON-NNN)
- Discard-ruling delta-validate rejection test (per §5.2)
- Supersede error message string match test (per §5.3)
- **Tokenization contract regression test** (§3.1.1 — `extractSubstantiveTokens('CON-026 is foo')` returns `['con-026', 'is', 'foo']`)
- **aligned_by classification regression fixture** (§3.3.2 substring rule pin): `tests/fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json` stores the dogfood archive's 14 distinct aligned_by values + ground-truth INCLUDE/EXCLUDE labels. Test asserts: applying §3.3.2 substring rule produces identical 14 classifications. Test failure = rule drift (e.g., implementation accidentally added/removed substring matchers, pre-cleaning step changed); investigation required. Sinks the round-3 forensic into a permanent guard.
- **Backward-incompat positive regression**: dogfood gto-trainer compile-output.json now fails handoff-validate; dogfood h-review-verdict.json discard ruling now fails delta-validate (intended; per §8 table)
- Skill doc update commit (`skills/plan/SKILL.md` Stage E align-via-token primary guidance per §5.3)

## §12 — Out-of-scope rerouting

Routes confirmed:
- Row #3 (case.json write CLI) → ASSERTION-5 B001
- Row #6 (Stage J retry-vs-degrade decision tree) → ASSERTION-5 B003 (conditional re-evaluation at this spec's close)
- Row #7 (reentry routes per-route reset granularity) → ASSERTION-5 B002
- Secondary findings (challenged_claim, render template, skill drift) → ASSERTION-5 B004/B005/B006
- E3 cascade (categories.md / agent prompts / category-aware paths) → ASSERTION-5 B007

If during plan or code execution any of these is discovered to be a hard blocker for in-scope work, the response is **errata + maturity-assessment v2 + spec re-charter**, not silent in-scope expansion.
