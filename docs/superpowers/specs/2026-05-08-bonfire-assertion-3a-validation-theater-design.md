# Design: Bonfire Assertion 3a — Validation Theater Closure

**Date:** 2026-05-08
**Status:** Proposed
**Scope:** Assertion 3a of the bonfire production-grade gap audit — close the residual vacuous-pass surface at Stage H verdict and Stage J handoff that survives Assertion 1 + 2 enforcement.

**Related specs:**
- `2026-04-18-bonfire-freeze-enforcement-design.md` (Assertion 1 — truth-surface freeze gate)
- `2026-04-18-bonfire-hj-seam-hardening-design.md` (Assertion 2 — H→J seam, Layer 2a substantive_slot_refs + Layer 2b prose token-coverage)
- `2026-05-04-bonfire-assertion-4-design.md` (round-3 halted; Layer 2b prose precision recalibration; sequenced AFTER 3a per Path B)
- Sibling: Assertion 3b (schema-doc drift, separate fixture-driven spec, planned)

**Empirical basis:**
- `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` (memory `dogfood-2026-05-04-findings.md`)
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (autonomous fresh-session full pipeline run; 20 findings; commit 786166a)

---

## 1. Context

Bonfire's foundational design promise (per `2026-04-10-bonfire-ecl-pipeline-design.md`): **frozen constraints are the only input to code**. The /code stage must not invent product semantics; coder agents read the constraint ledger snapshot + canonical contracts produced upstream by /pre and /plan and translate them mechanically.

PR #2 (Apr 2026) shipped two assertions toward this promise:
- Assertion 1 enforces freeze gate at Stage G — `state.json` cannot record stages as passed while `freeze` rulings remain unapplied to the ledger.
- Assertion 2 hardens the H→J seam — Layer 2a `substantive_slot_refs` provenance pointing handoff slots back at FROZEN ledger entries, plus Layer 2b prose token-coverage diff comparing handoff-side substantive tokens against the FROZEN ledger lexicon.

Two dogfood runs (gto-trainer 2026-05-04, bilibili 弹幕降噪 2026-05-08) independently surfaced a residual category of failures that Assertion 1 + 2 do not catch. The pattern: validators correctly reject substantive content as malformed, the operator rewrites the substantive content to vacuous (empty arrays, empty objects, placeholder strings), and the gate then passes by default because **the schema treats "vacuous" as structurally indistinguishable from "non-existent" in the data model and from "intentionally absent" as a legitimate state**.

Three concrete findings define the residual surface:

- **B1 (Stage H VACUOUS PASS, bilibili clean finding #18):** H-Review agent produced 7 substantive conditions + 12 rulings. `apply-h-rulings` rejected the RISK-targeted freeze ruling batch atomically. `state-advance --step stage-h` rejected the condition prose via Layer 2b orphan-token false-positives. Operator one-shot-edited `h-review-verdict.json` to `{verdict: "approved", conditions: [], rulings: []}`. `state-advance` then passed silently because no validator inspected the verdict's substantive content; `validate-h-conditions` only checks per-condition shape when conditions are present.

- **B2 (Stage J Layer 2a vacuous-pass loophole, bilibili clean finding #19, gto-trainer finding #1 ASSERTION-4 candidate also touches this surface from a different angle):** `handoff-validate` returns `{"valid": true}` for `code_ready: true` together with `domain_model.entities: []`, `function_contracts: []`, `data_contract: {source_kind, source_ref}` (provenance metadata only, zero substantive payload), and `ui_contract: {surfaces: [], states: {}, accessibility: {}}`. The Layer 2a check examines whether non-empty slots have valid `substantive_slot_refs`; it does not assert that slots have substantive content in the first place.

- **#10 (downstream coder behavior, bilibili clean finding):** Coder agent for unit-2 produced correct types/contracts only because the operator manually preserved the rich H-Review verdict + J-Compile pre-strip output in `compile-output.json.full` and explicitly pointed the coder at this sidecar file. Without the sidecar, the coder would have received the vacuous handoff at `compile-output.json` and the only path to working code would have been semantic invention — exactly what bonfire's core promise forbids.

Assertion 3a closes this category through structural deep-checks at the H verdict and J handoff schemas, paired with a parallel declarative escape valve mirrored from the existing `no_substantive_contract` pattern (`schemas/bonfire-v1.json:236-248`).

## 2. Problem

The current validation pipeline at H + J accepts the following adversarial inputs as `{valid: true}`:

**Surface H — Stage H verdict vacuous-pass:**
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved",
  "reason": "All ledger entries reviewed and approved",
  "conditions": [],
  "rulings": []
}
```
Or the same shape with `verdict: "approved_with_conditions"` and `conditions: []` — a literal contradiction (verdict claims conditions exist, payload has none).

**Surface J — Stage J handoff vacuous-pass:**
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": { "entities": [] },
  "function_contracts": [],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001" },
  "ui_contract": { "surfaces": [], "states": {}, "accessibility": {} }
}
```

Both currently pass `handoff-validate` and `state-advance` checks. The downstream consequence is that bonfire's core promise — "coder must not invent product meaning" — is structurally unreachable: a vacuous handoff that passes validation gives the coder zero substantive input, leaving invention as the only path to working code.

Attack-level taxonomy (driver for design depth):

| Level | Description | Example | 3a coverage |
|---|---|---|---|
| L0 | Empty arrays / empty objects | `entities: []`, `conditions: []` | yes |
| L1 | Arrays with empty elements | `entities: [{}]` | yes |
| L2 | Elements with required subfields all empty / null / whitespace | `entities: [{name: "", fields: null}]` | yes |
| L3 | Elements with required subfields set to placeholder strings | `entities: [{name: "TODO", fields: "see ledger"}]` | yes |
| L4 | Elements with prose-rich but semantically-vacuous content | `entities: [{name: "Foo", description: "this is a thing that does stuff"}]` | **OUT — round-4 territory** |

L4 belongs to Assertion 4 (Layer 2b prose precision recalibration) which addresses a different abstraction layer (lexical token coverage against ledger). 3a's forcing function is to design enforcement entirely at the JSON-shape layer, decoupled from prose metrics.

## 3. Root Cause

The H + J validation pipeline today contains three reject paths that all cost the operator the same penalty (manual rewrite + `state-advance` retry), and one path that passes for free (vacuous content). Operators rationally select the free path under time pressure. The validators that produce the cost asymmetry are themselves working as designed:

- `apply-h-rulings` correctly rejects RISK-category freeze rulings (per its category whitelist) — but this rejection becomes a "spend less time on H-Review" signal because the agent's substantive output is discarded en route.
- `state-advance` Layer 2b correctly applies prose token coverage (per Assertion 2 design) — but the false-positive rate on legitimate English/Chinese/path tokens (gto-trainer + bilibili-clean both surfaced >100 orphans on normal prose) makes "submit substantive conditions" the high-cost path.
- `handoff-validate` Layer 2a correctly checks `substantive_slot_refs` provenance when slots are non-empty — but does not assert non-emptiness as a precondition, leaving "submit empty slots" as a structural escape.

The root cause is **the absence of a "minimum substantive content" assertion at either gate**. The schema declares slots and required subfields (`handoff_substantive_slots` at line 227-234, `condition_item_shape.required_fields` at line 274) but the validators read these as shape hints, not as content-presence constraints.

3a closes this by promoting the existing schema declarations to enforced content-presence constraints, with a parallel declarative escape valve mirroring the existing `no_substantive_contract` pattern (`schemas/bonfire-v1.json:236-248`) for the legitimate cases where substantive content genuinely is not needed.

## 4. Goals

1. **Defeat L0-L3 attacks at Stage J handoff.** A handoff passing `handoff-validate` must contain substantive content per declared `required_subfields`, with values surviving an `isEmptyOrPlaceholder` check, OR explicitly declare the `no_substantive_contract` escape with valid `substantive_slot_refs` to ledger entries that justify the absence.
2. **Defeat L0-L3 attacks at Stage H verdict.** A verdict passing `state-advance --step stage-h` must contain substantive `conditions` and `rulings` per their declared element shapes, OR explicitly declare a new `no_substantive_oversight` escape with valid ledger refs justifying the absence.
3. **Defeat the literal contradiction.** `verdict: "approved_with_conditions"` with `conditions: []` is a direct semantic contradiction; reject without escape valve.
4. **Preserve legit "no oversight needed" / "no substantive contract needed" paths.** Both escape valves require explicit operator/agent declaration plus ≥1 ledger reference that resolves against the active FROZEN ledger snapshot, raising attack cost from "delete two lines" to "fabricate refs that match `schema.ledger_id_pattern` AND resolve in ledger AND coordinate edits across multiple files" — i.e., to forensic-detectable level.
5. **Stay at JSON-shape abstraction.** No prose-density / token-overlap / information-entropy mechanisms in 3a's design surface. Round-4 territory is structurally OOS.
6. **Single mechanism reuse.** A shared `isEmptyOrPlaceholder` validator helper plus declarative schema flags applied in three locations — no per-stage hardcoded validation logic.

## 5. Non-Goals

- **L4 prose-rich semantically-vacuous content.** Round-4 spec re-cut handles Layer 2b prose precision separately. 3a will not check token density, novel-word presence, or any prose-level signal.
- **Finding #6 reentry granularity (`reentry-type-determines-target-stage-reset`).** Path B selected by user 2026-05-08; 3a uses non-reentry enforcement (state-advance reject, operator must re-spawn agent), which avoids the theatrical re-pass cost entirely. Finding #6 stays in backlog with 3c.
- **Cross-stage upstream-aware validation** (e.g., "verdict conditions count must match unfrozen ledger entries count"). 3a stays single-stage at the H gate and the J gate; no cross-stage reasoning.
- **Multi-file operator collusion defense.** A determined operator with filesystem write access can co-edit `state.json`, `h-review-verdict.json`, and any escape-flag fields together with fabricated refs. 3a raises attack cost to forensic-detectable; it does not prove impossibility.
- **UI/popup-side validation surface.** Bonfire CLI is the only enforcement surface in scope. Future desktop integrations are out.
- **Schema documentation drift remediation.** Assertion 3b (separate spec) addresses the `ecl-schema.md` ↔ renderer/validator field-name drift surfaced in dogfood findings #2-5, #12, #13. 3a touches only the schema definitions it modifies; broader doc audit is 3b's scope.

## 6. Design

### 6.1 Terms

- **Substantive content** — non-empty, non-placeholder values in fields that the schema declares as `required_subfields`. A value is substantive if `isEmptyOrPlaceholder(value)` returns `false`.
- **Vacuous content** — content that satisfies the schema's structural shape but contains no semantic payload. `isEmptyOrPlaceholder(value)` returns `true`. Includes empty arrays, empty objects, empty strings, whitespace-only strings, null, and registered placeholder strings.
- **Placeholder strings** — finite list of strings recognized as content-absence indicators: `"TODO"`, `"see ledger"`, `"..."`, `"<TBD>"`, `"<placeholder>"`, plus case-insensitive variants. Maintained as a constant in the validator module; new entries via PR review.
- **`isEmptyOrPlaceholder(value)`** — validator helper function. Returns `true` if `value` is `null`, `undefined`, an empty array, an empty object, an empty string, a whitespace-only string, or a registered placeholder string. Returns `false` otherwise. **Does not** inspect prose semantics, token coverage, or information density.
- **L0/L1/L2/L3** — attack levels per Section 2 taxonomy. L0 = empty containers; L1 = `[{}]` shape; L2 = empty subfields; L3 = placeholder subfields. L4 (prose-vacuous) is permanently OOS.
- **Escape valve** — declarative schema mechanism for the legitimate case where substantive content genuinely is not required. Mirrored from existing `no_substantive_contract` (line 236-248) for handoff slots; new `no_substantive_oversight` for H verdicts. Requires explicit flag + ≥1 ledger ref matching `schema.ledger_id_pattern` that resolves against the active FROZEN ledger snapshot. **Does not** invoke Layer 2b prose token-coverage on the reason text (DQ-1 closure; Section 8 Risk 4 Mitigation 2).
- **Forensic-detectable** — bonfire's audit trail (state.json change log, file mtimes, ledger ref pattern enforcement) leaves a trace such that a determined defender can reconstruct what happened. 3a raises attack cost to require this level of coordination, not to prove impossibility.

### 6.2 Threat model

**Operator capability assumption:** The bonfire operator has full filesystem write access to all `.bonfire/` files including `state.json`, `case.json`, `truth-surface/*`, `plan/*`, `runs/*/*`. Bonfire's enforcement is via validators run on file contents at advance-points; bonfire does not control file mutation.

**3a's bar:** raise attack cost from "delete two lines in `h-review-verdict.json`" or "set `entities: []` in `compile-output.json`" — both single-file single-edit attacks — to "fabricate refs in escape-flag fields, ensure refs match `schema.ledger_id_pattern` AND resolve against the active FROZEN ledger snapshot, edit handoff/verdict files in coordination" — multi-file coordinated attack with traceable artifacts.

**Forensic detection paths:**
- `state.json` change log records each `state-step` and `state-advance` with timestamps; manual mid-stage edits to verdict/handoff files leave file mtime newer than the last `apply-h-rulings` / `handoff-validate` success record.
- Escape-flag refs must match `schema.ledger_id_pattern` (Section 6.6 Location 1a) and resolve against the active ledger; fabricated IDs fail the ref-pattern check; legitimate-looking IDs that don't exist in the ledger fail the resolution check.
- The ledger snapshot history at `truth-surface/constraint-ledger-history.jsonl` is append-only; an operator forging a ref must either match an existing entry (limited surface) or also forge ledger history (much larger forensic footprint).

**Out of threat model:** A coordinated multi-file forge with consistent ledger history rewriting, plausible refs, and edit timing within normal pipeline rhythm. 3a does not defend against this; deferred to operator-trust mechanisms beyond the bonfire CLI scope.

### 6.3 Mechanism — Q1 handoff deep-check (Schema location 1)

**Location:** `schemas/bonfire-v1.json` `handoff_substantive_slots` (line 227-234).

**Current state (annotated):**
```json
"handoff_substantive_slots": {
  "handoff.domain_model.entities":  { "_provenance_required": true, "kind": "per_entry" },
  "handoff.function_contracts":     { "_provenance_required": true, "kind": "per_entry", "fields": ["purpose", "invariants", "failure_modes"] },
  "handoff.data_contract":          { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.panels":     { "_provenance_required": true, "kind": "per_entry", "fields": ["description", "elements", "states"] },
  "handoff.ui_contract.state_ownership": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.empty_states":    { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.error_states":    { "_provenance_required": true, "kind": "whole_section" }
}
```

**3a changes:**

1. **Rename `fields` → `required_subfields`** on all per_entry slots (breaking schema change; rationale in Section 6.8).
2. **Add `min_entries: integer` (default 1)** on per_entry slots. Schema declares the structural minimum count.
3. **Add `required_subfields: string[]`** on whole_section slots, parallel to per_entry. Lists substantive subfields the section must contain (provenance metadata excluded — those are covered by the existing `_provenance_required` mechanism via `substantive_slot_refs`).

**Sample after-state:**
```json
"handoff.domain_model.entities": {
  "_provenance_required": true,
  "kind": "per_entry",
  "min_entries": 1,
  "required_subfields": ["name", "fields"]
},
"handoff.function_contracts": {
  "_provenance_required": true,
  "kind": "per_entry",
  "min_entries": 1,
  "required_subfields": ["purpose", "invariants", "failure_modes"]
},
"handoff.data_contract": {
  "_provenance_required": true,
  "kind": "whole_section",
  "required_subfields": ["schema"]
},
...
```

The exact set of substantive `required_subfields` per slot is finalized during plan-phase implementation (each slot has its own substantive shape; specifying every subfield in the spec adds noise without changing mechanism).

**Validator behavior:**

`handoff-validate` extends to apply, per slot in `handoff_substantive_slots`:
- per_entry kind: assert `slot.entries.length >= min_entries` (default 1). For each entry, assert each name in `required_subfields` is present and `!isEmptyOrPlaceholder(entry[name])`.
- whole_section kind: assert each name in `required_subfields` is present and `!isEmptyOrPlaceholder(slot[name])`.

**Escape valve (existing, unchanged):** `no_substantive_contract` flag at `schemas/bonfire-v1.json:236-248` continues to permit handoffs that legitimately need no substantive content. 3a does not modify this mechanism; the deep-check applies only when the escape is not invoked.

### 6.4 Mechanism — Q2 verdict top-level predicate + escape valve (Schema location 3)

**Location:** New top-level `verdict_substantive_check` section in `schemas/bonfire-v1.json`, sibling of `handoff_substantive_slots`.

**Schema additions:**
```json
"verdict_substantive_check": {
  "version": 1,
  "applies_to": "delta_schemas.bonfire-h-review",
  "reject_when": [
    {
      "rule": "approved_with_conditions_requires_conditions",
      "predicate": {
        "verdict": "approved_with_conditions",
        "conditions_empty": true
      },
      "escape_allowed": false
    },
    {
      "rule": "approved_requires_substantive_oversight_or_escape",
      "predicate": {
        "verdict": ["approved", "approved_with_conditions"],
        "conditions_empty": true,
        "rulings_empty": true
      },
      "escape_allowed": true
    }
  ],
  "escape_valve": {
    "flag": "no_substantive_oversight",
    "reason_field": "no_substantive_oversight_reason",
    "reason_ref_constraint": "ledger_ref",
    "min_refs": 1
  }
}
```

The `reason_ref_constraint: "ledger_ref"` flag declares that `reason_field` must contain ≥`min_refs` matches of the top-level shared `ledger_id_pattern` (Section 6.6 Location 1) and that each match must resolve in the active FROZEN ledger snapshot. **No prose token-coverage check** is run on the reason text — this closes the circular dependency between the escape valve and Layer 2b's known false-positive rate (see Section 8 Risk 4). Refs are the audit-weight; surrounding prose is annotation, not assertion.

**Predicate rationale:**
- Rule 1 (`approved_with_conditions_requires_conditions`) is an absolute reject without escape — the verdict literal claims conditions exist, payload contradicts. No legitimate scenario produces this state; no escape needed.
- Rule 2 (`approved_requires_substantive_oversight_or_escape`) catches the general vacuous case. Operator can declare `no_substantive_oversight: true` plus `no_substantive_oversight_reason` containing ≥1 ledger ref matching the pattern, justifying why no oversight was needed (typical legitimate case: every ledger entry is FROZEN, no challenges remain, the H-Review agent had nothing to do).

**Validator behavior:**
- Integration point: `state-advance --step stage-h` reads `h-review-verdict.json`, applies `verdict_substantive_check.reject_when` rules, and rejects with structured error citing the matched rule + the violating field.
- Escape valve check: when the operator/agent declares `no_substantive_oversight: true`, validator calls `validateLedgerRef(reason_field, schema)` (Section 6.7 shared helper). The helper extracts all matches of `schema.ledger_id_pattern` from the reason text, asserts ≥`min_refs` matches found, and asserts each match resolves against the active FROZEN ledger snapshot. The text between/around refs is treated as annotation — not validated.

**Empty semantics for `conditions_empty` and `rulings_empty`:**
- `conditions_empty: true` ⇔ `verdict.conditions` is undefined OR `verdict.conditions.length === 0`.
- `rulings_empty: true` ⇔ `verdict.rulings` is undefined OR `verdict.rulings.length === 0`.
- Per-element vacuousness (e.g., `conditions: [{text: "see ledger"}]`) is **not** caught by Section 6.4's top-level predicate. It is caught earlier by Section 6.5's per-element substantive check, which short-circuits during `validate-delta` before `checkVerdictSubstantive` runs. Section 6.7's call-graph ordering enforces this: 6.5 first, 6.4 second.
- This means 6.4 sees only verdicts that already passed 6.5 (no element-level vacuousness). The reject_when predicates therefore evaluate against literal-empty arrays only — which exactly matches the L0 attack signature.

### 6.5 Mechanism — verdict element deep-check 派生 (Schema location 2)

**Location:** `schemas/bonfire-v1.json` `delta_schemas.bonfire-h-review.constraints` (line 266-278).

**Current state:**
```json
"bonfire-h-review": {
  "required_fields": ["verdict", "reason"],
  "optional_fields": ["conflict_type", "conditions", "rulings"],
  "constraints": {
    "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
    "conflict_type_required_when_rejected": true,
    "condition_item_shape": {
      "type": "object",
      "required_fields": ["text", "target_stage"],
      "target_stage_enum": ["stage-j"]
    },
    "ruling_action_enum": ["freeze", "supersede"]
  }
}
```

**3a changes:**

1. **Extend `condition_item_shape`** with substantive content rule on `text`:
```json
"condition_item_shape": {
  "type": "object",
  "required_fields": ["text", "target_stage"],
  "target_stage_enum": ["stage-j"],
  "field_substantive_check": {
    "text": { "isEmptyOrPlaceholder": false }
  }
}
```

2. **Add new `ruling_item_shape`** parallel to `condition_item_shape`:
```json
"ruling_item_shape": {
  "type": "object",
  "required_fields": ["action", "id"],
  "id_constraint": "ledger_ref",
  "action_specific_required_fields": {
    "freeze": [],
    "supersede": ["new_content"]
  },
  "field_substantive_check": {
    "id": { "isEmptyOrPlaceholder": false },
    "new_content": { "isEmptyOrPlaceholder": false, "applies_when_action": "supersede" }
  }
}
```

**Validator behavior:**

`validate-delta` (the function that ingests `h-review-verdict.json`) extends to:
- For each entry in `conditions[]`: apply `condition_item_shape.field_substantive_check`. Reject if any field fails `isEmptyOrPlaceholder: false`.
- For each entry in `rulings[]`: apply `ruling_item_shape` checks — required_fields present, `id` matches via `id_constraint: "ledger_ref"` (pattern check against `schema.ledger_id_pattern` only; ledger resolution + FROZEN status check are deferred to integration point 3 — `apply-h-rulings` + `state-advance --step stage-h` — which already enforce these per Assertion 1 v1 contract at `bin/lib/freeze-enforcement.cjs:49-50` + `bin/lib/state.cjs:166`), action-specific subfields present per `action_specific_required_fields[entry.action]`, all fields with `field_substantive_check` satisfy their rules.

**Field naming — `id` not `target_id`.** The ruling's target ledger entry is referenced by the field name `id` (not `target_id`). This aligns with the v1 contract frozen by Assertion 1 (PR #2 merged 2026-05-05): `bin/lib/freeze-enforcement.cjs` and `bin/lib/state.cjs` both treat `ruling.id` as the canonical ledger-target identifier across `apply-h-rulings` and `state-advance --step stage-h`. Renaming to `target_id` would be a breaking change to a frozen contract for marginal semantic clarity. The narrative meaning ("the id of the ledger entry this ruling targets") is preserved by spec wording and by the ledger-ref constraint name (`id_constraint: "ledger_ref"`); the schema field name itself stays `id` for codebase consistency.

`validate-delta` short-circuits on the first failure within an entry; this means an attack like `conditions: [{text: "see ledger"}]` is caught here at element level — not by Section 6.4's top-level predicate (which only catches the literal-empty case).

### 6.6 Schema changes — exhaustive diff (reference)

This section is the single source of schema deltas for plan-phase task split. Pure diff form, no narrative; mechanism rationale is in Sections 6.3-6.5.

**Location 1: top-level handoff/ledger schema region (line 227+)**

This location covers three contiguous top-level edits in `bonfire-v1.json`. Plan-phase task 2 owns all three (and the `schema_version` 1→2 bump on behalf of all subsequent schema-modifying tasks; see Section 9).

*1a — New shared ledger ID constants (DQ-4 close):*
```diff
+"ledger_id_prefixes": ["CON", "RG", "FC", "AS", "ACC", "REQ", "RISK", "DEP", "FACT", "CLAIM", "DROP"],
+"ledger_id_pattern": "(?:CON|RG|FC|AS|ACC|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
```

The validator helper `validateLedgerRef(value, schema)` (Section 6.7) reads `schema.ledger_id_pattern` and uses it for any field declaring `*_constraint: "ledger_ref"`. Per-location pattern duplication is removed; future ledger ID prefix additions touch a single line.

**ACC prefix history (added 2026-05-09 during 3a Phase 3 implementation):** Original Task 2 prefix list had 10 entries and omitted `ACC`. Phase 3's new `ruling_item_shape.id_constraint: "ledger_ref"` enforcement surfaced pre-existing schema-doc drift: `tests/test-state-advance-invariants.js:245` (gto-trainer regression fixture from commit f6ef678) used `ACC-001` for an `acceptance_semantic` ledger entry, but the schema regex did not accept it. ACC was formalized into the prefix list to make the regression fixture pass under the new enforcement. Both `AS` and `ACC` are retained pending Assertion 3b (schema-doc drift spec) canonicalization decision — which of `AS` or `ACC` is the canonical `acceptance_semantic` prefix is out-of-scope for 3a; the immediate goal is to not break existing fixtures while 3a's substantive-content checks ship.

*1b — `handoff_mandate_params` escape valve refactored to use shared constraint (line 243-248, DQ-4 close):*
```diff
 "handoff_mandate_params": {
   ...
   "escape_valve": {
     "flag": "no_substantive_contract",
     "reason_field": "no_substantive_contract_reason",
-    "reason_ref_pattern": "(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
-    "reason_uses_zero_orphan": true
+    "reason_ref_constraint": "ledger_ref",
+    "min_refs": 1
   }
 }
```

The existing `handoff_mandate_params.escape_valve` is migrated to the same `*_constraint: "ledger_ref"` pattern as the new `verdict_substantive_check.escape_valve` (Loc 3) for consistency. **`reason_uses_zero_orphan` is removed**: prose token-coverage check on the escape reason is no longer required (closes the same circular dependency at the handoff escape that Section 6.4 closes for the verdict escape — DQ-1 close). The `supplementary_ref_pattern` at line 242 is unchanged (different pattern, 9-prefix subset, anchored — not in DQ-4's scope).

*1c — `handoff_substantive_slots` deep-check additions (line 227-234):*
```diff
 "handoff_substantive_slots": {
   "handoff.domain_model.entities": {
     "_provenance_required": true,
-    "kind": "per_entry"
+    "kind": "per_entry",
+    "min_entries": 1,
+    "required_subfields": ["name", "fields"]
   },
   "handoff.function_contracts": {
     "_provenance_required": true,
     "kind": "per_entry",
-    "fields": ["purpose", "invariants", "failure_modes"]
+    "min_entries": 1,
+    "required_subfields": ["purpose", "invariants", "failure_modes"]
   },
   "handoff.data_contract": {
     "_provenance_required": true,
-    "kind": "whole_section"
+    "kind": "whole_section",
+    "required_subfields": ["schema"]
   },
   "handoff.ui_contract.panels": {
     "_provenance_required": true,
     "kind": "per_entry",
-    "fields": ["description", "elements", "states"]
+    "min_entries": 1,
+    "required_subfields": ["description", "elements", "states"]
   },
   "handoff.ui_contract.state_ownership": {
     "_provenance_required": true,
-    "kind": "whole_section"
+    "kind": "whole_section",
+    "required_subfields": ["owner_map"]
   },
   "handoff.ui_contract.empty_states": {
     "_provenance_required": true,
-    "kind": "whole_section"
+    "kind": "whole_section",
+    "required_subfields": ["surfaces", "messaging"]
   },
   "handoff.ui_contract.error_states": {
     "_provenance_required": true,
-    "kind": "whole_section"
+    "kind": "whole_section",
+    "required_subfields": ["error_map"]
   }
 }
```

**Location 2: `delta_schemas.bonfire-h-review.constraints` (line 266-278)**
```diff
 "bonfire-h-review": {
   "required_fields": ["verdict", "reason"],
   "optional_fields": ["conflict_type", "conditions", "rulings"],
   "constraints": {
     "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
     "conflict_type_required_when_rejected": true,
     "condition_item_shape": {
       "type": "object",
       "required_fields": ["text", "target_stage"],
-      "target_stage_enum": ["stage-j"]
+      "target_stage_enum": ["stage-j"],
+      "field_substantive_check": {
+        "text": { "isEmptyOrPlaceholder": false }
+      }
     },
-    "ruling_action_enum": ["freeze", "supersede"]
+    "ruling_action_enum": ["freeze", "supersede"],
+    "ruling_item_shape": {
+      "type": "object",
+      "required_fields": ["action", "id"],
+      "id_constraint": "ledger_ref",
+      "action_specific_required_fields": {
+        "freeze": [],
+        "supersede": ["new_content"]
+      },
+      "field_substantive_check": {
+        "id": { "isEmptyOrPlaceholder": false },
+        "new_content": { "isEmptyOrPlaceholder": false, "applies_when_action": "supersede" }
+      }
+    }
   }
 }
```

**Location 3: `verdict_substantive_check` (NEW top-level, sibling of `handoff_substantive_slots`)**
```diff
+"verdict_substantive_check": {
+  "version": 1,
+  "applies_to": "delta_schemas.bonfire-h-review",
+  "reject_when": [
+    {
+      "rule": "approved_with_conditions_requires_conditions",
+      "predicate": {
+        "verdict": "approved_with_conditions",
+        "conditions_empty": true
+      },
+      "escape_allowed": false
+    },
+    {
+      "rule": "approved_requires_substantive_oversight_or_escape",
+      "predicate": {
+        "verdict": ["approved", "approved_with_conditions"],
+        "conditions_empty": true,
+        "rulings_empty": true
+      },
+      "escape_allowed": true
+    }
+  ],
+  "escape_valve": {
+    "flag": "no_substantive_oversight",
+    "reason_field": "no_substantive_oversight_reason",
+    "reason_ref_constraint": "ledger_ref",
+    "min_refs": 1
+  }
+},
```

### 6.7 Validator integration points

This section is the single source of call-graph deltas for plan-phase. Pure reference, no narrative.

**New shared helper module (one location):**
- `bin/lib/validation-helpers.cjs` (new module) — exports:
  - `isEmptyOrPlaceholder(value)` — returns true for null/undefined/empty/whitespace-only/registered-placeholder values; constant `PLACEHOLDER_STRINGS` defines the placeholder list.
  - `validateLedgerRef(value, schema)` — extracts all matches of `schema.ledger_id_pattern` from `value`, asserts each match resolves against the active FROZEN ledger snapshot. Used wherever a field declares `*_constraint: "ledger_ref"`.
  - `extractLedgerRefs(value, schema)` — helper used internally by `validateLedgerRef` to extract refs without resolution check (used in escape-valve `min_refs` counting).
- Imported by all three integration points below + `bin/lib/seam-validation.cjs` for the existing `handoff_mandate_params.escape_valve` (which Loc 1b migrates to the new constraint).

**Integration point 1: `handoff-validate`** (`bin/bonfire-tools.cjs` + `bin/lib/seam-validation.cjs`)
- Caller: `bin/bonfire-tools.cjs` `handoff-validate` CLI subcommand.
- Existing call path: loads `.bonfire/plan/compile-output.json`, runs Layer 2a `substantive_slot_refs` provenance check + Layer 2b prose token-coverage check.
- 3a addition: before Layer 2a, run new `deepCheckHandoffSubstantiveSlots(handoff, schema)` reading `schema.handoff_substantive_slots` config and applying `min_entries` + `required_subfields` + `isEmptyOrPlaceholder` per Section 6.3. Fail-fast on first violation; return structured error with slot path + violating field.
- Escape: existing `no_substantive_contract` flag check stays unchanged. When set, deep-check is skipped for the slot.

**Integration point 2: `validate-delta` for bonfire-h-review** (`bin/lib/delta-parser.cjs`)
- Caller: `bin/bonfire-tools.cjs` indirectly via `state-advance --step stage-h` (which invokes `apply-h-rulings` then `validate-delta`).
- Existing call path: `validate-delta('bonfire-h-review', verdict)` checks `required_fields`, `verdict_enum`, `conflict_type_required_when_rejected`, `condition_item_shape`.
- 3a addition: extend `condition_item_shape` check with `field_substantive_check`. Add new `ruling_item_shape` check with `required_fields`, `id_constraint: "ledger_ref"` (pattern-only check via `schema.ledger_id_pattern`; resolution + FROZEN status are NOT checked here — see responsibility-layering note below), `action_specific_required_fields`, `field_substantive_check`. Calls `isEmptyOrPlaceholder` from the shared helper for content checks. `validateLedgerRef` is **not** invoked at this integration point; resolution against the live ledger snapshot happens downstream via Assertion 1 v1 contract. `validateLedgerRef` is invoked at integration points 1 + 3 for escape-valve flows where the escape decision itself depends on resolution + FROZEN.

**Responsibility layering — `id_constraint` at integration point 2 vs `validateLedgerRef` at integration points 1+3.** The `validateDelta` function is a stateless schema-shape validator: signature `validateDelta(agentName, delta)` accepts no ledger snapshot (verified at `bin/lib/delta-parser.cjs:5`). Calling `validateLedgerRef` here would require plumbing snapshot through every call site, which is unnecessary because the actual resolution + FROZEN check is already enforced downstream by Assertion 1 v1 contract: (i) `bin/lib/freeze-enforcement.cjs:49-50, 149, 182-183` checks ledger-entry `status === 'FROZEN'` during ruling application, (ii) `bin/lib/state.cjs:166-167, 173-177` post-apply asserts the expected FROZEN/SUPERSEDED state, blocking `state-advance --step stage-h` if any ruling target lacks FROZEN status. 3a's `ruling_item_shape.id_constraint` therefore narrows to pattern-shape verification — guaranteeing the `id` field is a syntactically valid ledger reference — while resolution + FROZEN remain at the layer that owns the ledger transition. The escape-valve flows (handoff `mandate_params.escape_valve` and verdict `escape_valve`) DO call `validateLedgerRef` because the escape decision itself depends on resolution + FROZEN; without snapshot context the escape cannot be honored.

**Integration point 3: `state-advance --step stage-h` verdict-level check** (`bin/lib/state.cjs`)
- Caller: `bin/bonfire-tools.cjs` `state-advance` CLI subcommand.
- Existing call path: validates h-review-verdict.json shape via `validate-delta`, then advances state.
- 3a addition: between `validate-delta` success and state mutation, run new `checkVerdictSubstantive(verdict, schema)` reading `schema.verdict_substantive_check` config and applying `reject_when` rules per Section 6.4. Each rule's predicate is evaluated; on match, check the `escape_valve` if `escape_allowed: true`; if escape is invoked, validate flag + `validateLedgerRef(reason_field, schema)` (resolves refs + asserts ≥`min_refs`); otherwise reject with structured error citing matched rule. **No prose orphan check** on the reason text (per Section 6.4 closure of DQ-1).

**Call graph summary:**
```
handoff-validate (CLI)
  └─ handoffValidate()
       ├─ deepCheckHandoffSubstantiveSlots()  ← NEW
       │   └─ isEmptyOrPlaceholder()           ← shared helper (NEW)
       ├─ checkSubstantiveSlotRefs()           ← existing (Layer 2a)
       │   └─ validateLedgerRef()              ← shared helper (NEW), used when escape valve invoked
       └─ checkProseTokenCoverage()            ← existing (Layer 2b, untouched by 3a)

state-advance --step stage-h (CLI)
  └─ stateAdvanceStageH()
       ├─ validateDelta('bonfire-h-review')    ← existing, EXTENDED
       │   ├─ checkConditionItemShape()        ← existing, EXTENDED with field_substantive_check
       │   └─ checkRulingItemShape()           ← NEW
       │       ├─ isEmptyOrPlaceholder()       ← shared helper
       │       └─ ledgerRefRe.test(item.id)    ← schema.ledger_id_pattern regex (resolution + FROZEN deferred to apply-h-rulings + state.cjs)
       └─ checkVerdictSubstantive()            ← NEW
           ├─ isEmptyOrPlaceholder()           ← shared helper (literal-empty checks via empty arrays)
           └─ validateLedgerRef()              ← shared helper (escape valve reason_ref_constraint)
```

### 6.8 Backward compatibility

**Breaking change: `fields` → `required_subfields` rename in `handoff_substantive_slots`.**

Affected surfaces and policy:

| Surface | Policy | Rationale |
|---|---|---|
| `schemas/bonfire-v1.json` | one-shot rename | single source; no parallel hint period needed |
| `schema_version` field (top of bonfire-v1.json) | bump from 1 to 2 | versioned public contract; semantic change merits version bump per `2026-04-10-bonfire-ecl-pipeline-design.md` |
| `bin/bonfire-tools.cjs` + `bin/lib/seam-validation.cjs` | one-shot read-the-new-name | code change in same PR as schema change |
| `tests/fixtures/hj-seam-adversarial/` | audit + selective update | each fixture's expected behavior must be re-evaluated against 3a checks; some L0-L3 fixtures will newly trigger reject (intended); existing legit fixtures must continue to pass |
| `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` | grandfather (read-only evidence) | archives are immutable scientific record; not migrated |
| `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` | grandfather (read-only evidence) | same as above |
| Active external workspaces using v1 schema (any directory under `bonfire-test/` or other consumer paths) | re-init under v2 OR remain frozen at v1 | bonfire CLI v2 rejects v1 inputs at validation entry; existing v1 workspaces continue to work as long as they don't run v2 CLI against them |
| Third-party consumers of bonfire-v1.json | none currently identified | bonfire-v1.json is a published versioned contract but has no external consumers as of 2026-05-08; future consumers consume v2 |

**No migration tooling needed.** The schema is consumed only by bonfire's own CLI and fixtures. Archive-side `case.json` files remain valid as historical records under their original schema_version; they are never re-validated against the new schema.

**Schema version bump rationale:** `fields: [...]` semantically meant "expected hint, validator may use" in v1. `required_subfields: [...]` semantically means "validator MUST check these are present and substantive". Same word with stronger contract. Bumping the version makes future readers able to identify which contract a given file was written against without ambiguity.

## 7. Test Plan

3a's acceptance is the conjunction of three test classes. All three must pass for 3a to be considered shipped.

### 7.1 Class A — L0-L3 attack fixtures must reject

New adversarial fixtures added to `tests/fixtures/hj-seam-adversarial/` covering the attack-level taxonomy:

| Fixture | Attack level | Surface | Expected result |
|---|---|---|---|
| `vacuous-handoff-l0/` | L0 | J handoff: `entities: []`, `function_contracts: []`, `data_contract` missing required_subfields | `handoff-validate` exit ≠ 0 with `deep_check_failed` error |
| `vacuous-handoff-l1/` | L1 | J handoff: `entities: [{}]`, function_contracts entries with no required_subfields | `handoff-validate` exit ≠ 0 |
| `vacuous-handoff-l2/` | L2 | J handoff: required_subfields all `""` / `null` / whitespace | `handoff-validate` exit ≠ 0 |
| `vacuous-handoff-l3/` | L3 | J handoff: required_subfields all placeholder strings (`"TODO"`, `"see ledger"`, `"..."`) | `handoff-validate` exit ≠ 0 |
| `vacuous-verdict-l0/` | L0 | H verdict: `verdict: "approved"`, `conditions: []`, `rulings: []`, no escape | `state-advance --step stage-h` exit ≠ 0 |
| `vacuous-verdict-contradiction/` | top-level | H verdict: `verdict: "approved_with_conditions"`, `conditions: []` | `state-advance --step stage-h` exit ≠ 0 (escape disallowed for this rule) |
| `vacuous-verdict-l3/` | L3 | H verdict: conditions = `[{text: "see ledger", target_stage: "stage-j"}]`, rulings = `[]` | `state-advance --step stage-h` exit ≠ 0 |
| `vacuous-rulings-supersede/` | L2 | H verdict: rulings = `[{action: "supersede", id: "CON-001", new_content: ""}]` | `state-advance --step stage-h` exit ≠ 0 |

### 7.2 Class B — Escape valve legit fixtures must pass

| Fixture | Scenario | Expected result |
|---|---|---|
| `legit-no-substantive-contract/` | J handoff with `no_substantive_contract: true`, valid refs to FROZEN ledger entries justifying empty slots | `handoff-validate` exit 0 |
| `legit-no-substantive-oversight/` | H verdict with `no_substantive_oversight: true`, `no_substantive_oversight_reason` containing ≥1 ledger ref that resolves in active FROZEN ledger | `state-advance --step stage-h` exit 0 |
| `legit-no-substantive-oversight-fabricated-ref/` | same as above but ref pattern matches but ref does not resolve in ledger | `state-advance --step stage-h` exit ≠ 0 (ref resolution fails) |

### 7.3 Class C — Regression on existing fixture battery + dogfood archives

**Existing 10 fixtures in `tests/fixtures/hj-seam-adversarial/` (PR #2)** — all must continue to produce their existing expected results. No new false positives. No previously-rejecting fixture passes due to 3a's introduction.

**Dogfood archive replay (read-only verification):**
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/.bonfire/plan/compile-output.json` replayed through new `handoff-validate` — **must reject** with deep_check_failed (verifies B2 reproduction).
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/.bonfire/plan/h-review-verdict.json` replayed through new `state-advance --step stage-h` (in a sandboxed harness — not live state mutation) — **must reject** with `verdict_substantive_check` rule match (verifies B1 reproduction).

**Note on gto-trainer archive (excluded from Phase 5 replay scope):** The gto-trainer 2026-05-04 dogfood archive lives at `bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/` (external to this repo, not under `docs/superpowers/evidence/`). Per `dogfood-2026-05-04-findings.md` finding #1, the dominant pattern in that archive is Layer 2b prose token-coverage false-positive (Assertion 4 territory) rather than L2a vacuous-pass. While Section 2 cites it as "B2 ASSERTION-4 candidate also touches this surface from a different angle", the L2a vacuous-pass aspect is fully reproduced by the bilibili-clean archive replay above. Importing gto-trainer archive purely to satisfy a regression-matrix spec reference is YAGNI: bilibili-clean provides concrete B1+B2 acceptance; 10 existing hj-seam-adversarial fixtures provide breadth coverage; gto-trainer regression value is reserved for Assertion 4 round-4 work where Layer 2b is the focus surface.

This regression matrix gives concrete acceptance for "3a closes the dogfood-evidenced surface" without requiring meta-circular self-application semantics.

## 8. Risks and Mitigations

**Risk 1 — False positive on legitimate "no oversight needed" verdicts.**
Scenario: a fully-converged ledger with all entries FROZEN, no challenges, H-Review legitimately produces `verdict: "approved"` with `conditions: []`, `rulings: []`.
*Mitigation:* `no_substantive_oversight` escape valve plus required ledger refs. Operator/agent must declare the legitimate case explicitly. Forensic-detectable if abused.
*Residual risk:* friction for legit case (must write reason + refs). Accepted as design cost.

**Risk 2 — Placeholder string list maintenance burden.**
Scenario: new placeholder strings emerge ("PLACEHOLDER", "<n/a>", `"unspecified"`, etc.); attackers find unregistered placeholders to bypass.
*Mitigation:* placeholder list is a constant in `bin/lib/validation-helpers.cjs`; PR review adds new entries. Ship initial list with high coverage of common patterns. Document attack pattern in spec for future maintainers.
*Residual risk:* novel placeholder patterns slip through until registered. Bounded by attacker creativity at lexical level; no defense here, but each escape is forensic-detectable (ledger ref still required).

**Risk 3 — Multi-file operator collusion.**
Scenario: operator simultaneously edits `state.json`, verdict file, escape flag, and ledger snapshot to fabricate a fully consistent vacuous run.
*Mitigation:* explicit non-goal (Section 5). Bonfire raises attack cost to forensic-detectable level; does not prove impossibility. Operator-trust mechanisms beyond bonfire CLI scope.
*Residual risk:* sufficiently determined operator can game the system. Out of scope.

**Risk 4 — Round-4 prose precision and 3a deep-check interaction.**
Scenario: round-4 (when later spec'd) introduces stricter Layer 2b prose checks; 3a's `isEmptyOrPlaceholder` check on prose fields (e.g., condition `text`) may interact unpredictably.
*Mitigation:* `isEmptyOrPlaceholder` is purely structural (length, whitespace, registered placeholders). No prose semantics. Round-4 operates on a different abstraction layer (token coverage); orthogonal. 3a passes prose with no ledger token overlap as substantive (round-4's job to catch); 3a rejects prose that is empty or placeholder (round-4 doesn't see those).
*Mitigation 2 (DQ-1 close):* 3a's escape valves (`no_substantive_oversight` for verdict; `no_substantive_contract` for handoff) **do not** invoke Layer 2b zero-orphan checks on the reason text. Refs are extracted via shared `validateLedgerRef` helper; surrounding prose is annotation only. This breaks the circular dependency where Layer 2b's known false-positive rate would block legitimate escape valve usage and force operators back onto vacuous paths.
*Residual risk:* none expected. Path B sequencing (3a before round-4) means round-4 design adapts to 3a-as-precondition; 3a does not depend on round-4 fix arrival.

**Risk 5 — Schema migration tooling gap.**
Scenario: third-party consumers of bonfire-v1.json appear after 3a ships.
*Mitigation:* schema_version bump (1 → 2) makes the change discoverable. Consumers must read the version and adapt.
*Residual risk:* low; no third-party consumers known as of 2026-05-08.

## 9. Implementation Order

Suggested task breakdown for plan-phase. Three schema locations + one shared helper give a natural four-task structure with clean dependencies.

**Task 1 — Shared validator helpers.**
- Create `bin/lib/validation-helpers.cjs` with:
  - `isEmptyOrPlaceholder(value)` + `PLACEHOLDER_STRINGS` constant.
  - `validateLedgerRef(value, schema)` — extracts matches of `schema.ledger_id_pattern`, asserts each resolves against the active FROZEN ledger snapshot.
  - `extractLedgerRefs(value, schema)` — extraction without resolution check (used in escape-valve `min_refs` counting).
- Unit tests: cover `isEmptyOrPlaceholder` with `null`, `undefined`, `""`, `"   "`, `[]`, `{}`, each placeholder string, case-insensitive variants, negative cases (substantive strings, non-empty arrays). Cover `validateLedgerRef` with valid refs, fabricated-pattern-no-resolve refs, multiple refs, prose-with-embedded-refs, no refs.
- No schema dependency at module level (functions take schema as parameter).

**Task 2 — Schema location 1 (top-level handoff/ledger region).**
- This task owns the `schema_version` 1→2 bump on behalf of all subsequent schema-modifying tasks. Tasks 3 and 4 do not re-bump.
- Apply diffs per Section 6.6 Location 1 sub-parts:
  - 1a: add top-level `ledger_id_prefixes` + `ledger_id_pattern` constants (DQ-4 close).
  - 1b: migrate `handoff_mandate_params.escape_valve` from inline `reason_ref_pattern` + `reason_uses_zero_orphan` to `reason_ref_constraint: "ledger_ref"` + `min_refs: 1` (DQ-4 close + DQ-1 close at handoff escape valve).
  - 1c: extend `handoff_substantive_slots` with `min_entries` + `required_subfields` per slot; rename `fields` → `required_subfields`.
- Update `bin/lib/seam-validation.cjs`:
  - Existing `checkSubstantiveSlotRefs` (Layer 2a) — when escape valve invoked, swap `reason_ref_pattern`/`reason_uses_zero_orphan` logic for `validateLedgerRef(reason, schema)` (refs only, no prose orphan check).
  - New `deepCheckHandoffSubstantiveSlots(handoff, schema)` per Section 6.7 integration point 1.
- Wire into `handoff-validate` call path before Layer 2a.
- Fixture additions: Class A `vacuous-handoff-l0/l1/l2/l3/`, Class B `legit-no-substantive-contract/`.
- Depends on: Task 1.

**Task 3 — Schema location 2 (delta_schemas.bonfire-h-review).**
- Apply diff per Section 6.6 location 2 to `schemas/bonfire-v1.json`.
- Update `bin/lib/delta-parser.cjs` `validate-delta` per Section 6.7 integration point 2.
- Fixture additions: Class A `vacuous-verdict-l3/`, `vacuous-rulings-supersede/`.
- Depends on: Task 1.

**Task 4 — Schema location 3 (verdict_substantive_check).**
- Apply diff per Section 6.6 location 3 to `schemas/bonfire-v1.json`.
- Implement `bin/lib/state.cjs` `checkVerdictSubstantive(verdict, schema)` per Section 6.7 integration point 3.
- Wire into `state-advance --step stage-h` between `validate-delta` and state mutation.
- Fixture additions: Class A `vacuous-verdict-l0/`, `vacuous-verdict-contradiction/`. Class B `legit-no-substantive-oversight/`, `legit-no-substantive-oversight-fabricated-ref/`.
- Depends on: Task 1, Task 3 (per-element check feeds top-level predicate).

**Task 5 — Class C regression matrix.**
- Replay bilibili-clean dogfood archive through new validators (sandboxed; not live state mutation). Two replay items: `compile-output.json` for B2 reproduction via `handoff-validate`, `h-review-verdict.json` for B1 reproduction via `state-advance --step stage-h`.
- Verify expected reject behavior on B1/B2 reproductions.
- Verify existing 10 hj-seam-adversarial fixtures unchanged.
- Document evidence-path harness for future regression.
- gto-trainer archive excluded per §7.3 amendment 2026-05-09 (external location + dominant pattern is Layer 2b territory; bilibili-clean covers L2a vacuous-pass scope).
- Depends on: Tasks 2, 3, 4 complete.

**Task 6 — Documentation.**
- Update `references/handoff-quality-bar.md` with new substantive content requirements.
- Update `references/h-review-protocol.md` (or equivalent) with verdict_substantive_check semantics + escape valve protocol.
- Update changelog / README mention.
- Depends on: Tasks 2, 3, 4 complete.

## 10. Deferred Questions

**DQ-1: How is `no_substantive_oversight_reason` checked? — RESOLVED IN SPEC v0.2.**
Earlier draft proposed reusing Layer 2b zero-orphan check. v0.2 review (2026-05-08) identified circular dependency with Layer 2b's known false-positive rate (Section 8 Risk 4 Mitigation 2): operators using the escape valve legitimately would hit the same false-positives that drove them onto vacuous paths originally — pipeline deadlock. Resolved as **ref-only check via `validateLedgerRef` shared helper** (Section 6.7). No prose token-coverage on escape reason text. Same resolution applied to existing `handoff_mandate_params.escape_valve` for consistency (Section 6.6 Location 1b).

**DQ-2: Should `min_entries` be configurable above 1?**
Current design defaults to 1. A future case might want `min_entries: 2` (e.g., function_contracts always needs at least input + output). Decision deferred — start with 1, raise via PR if a concrete case emerges.

**DQ-3: Should `required_subfields` support nested paths (e.g., `domain_model.entities[].fields[].type`)?**
Current design treats `required_subfields` as flat key names within a slot or per-entry. Deeper nesting could push the schema toward JSON Schema territory. Decision deferred — start flat; revisit if a slot's substantive shape genuinely requires nested checks.

**DQ-4: `target_id_pattern` enumeration drift — RESOLVED IN SPEC v0.2.**
Earlier draft had 3 inline duplications of `(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\d+` (line 246 existing handoff_mandate_params + 2 new in 3a). v0.2 review (2026-05-08) flagged the dedup as Task 2 work, not deferred. Resolved as **top-level shared `ledger_id_prefixes` + `ledger_id_pattern` constants** (Section 6.6 Location 1a) + 3 sites migrated to `*_constraint: "ledger_ref"` declarative flag interpreted by `validateLedgerRef` helper (Section 6.7). Future ledger ID prefix additions touch single line. The 9-prefix anchored `supplementary_ref_pattern` at line 242 stays inline (different shape, different semantic, not in DQ-4 scope).

**DQ-5: Self-application of 3a to its own implementation.**
3a is being authored as direct-dialectic spec, not via bonfire pipeline (anti-recursion principle). The implementation phase will produce code under the existing bonfire pipeline if any; whether that pipeline is itself subject to 3a's checks is a question for plan-phase. Recommendation: plan-phase manually verifies that 3a's own changes pass 3a's checks (the authoring code's tests will cover this implicitly).

**DQ-6: Interaction with Assertion 3b (schema-doc drift) backlog.**
Findings #2-5, #12, #13 from bilibili-clean dogfood document schema-vs-renderer field-name drifts. 3a touches schema definitions for handoff_substantive_slots and delta_schemas.bonfire-h-review and adds verdict_substantive_check. Should 3a also fix the drift findings on these specific surfaces, or strictly pass-through to 3b? Recommendation: 3a fixes only the drift directly caused by its own changes (e.g., updating ecl-schema.md to match the new `required_subfields` field name). Broader drift audit stays in 3b scope.

---

**End of design.**
