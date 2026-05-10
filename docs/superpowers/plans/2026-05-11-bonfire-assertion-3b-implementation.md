# Assertion 3b Implementation Plan — Schema-Doc Drift Closure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 6 schema-vs-doc drift sites (D1-D6) surfaced by 2nd dogfood (bilibili-clean 2026-05-08) findings #2-5 + #12-13 by establishing `bonfire-v1.json#stage_schemas` as authoritative source-of-truth for field-level stage contracts; sync `ecl-schema.md`, `stage-playbook.md`, `handoff-quality-bar.md` to derive from it.

**Architecture:** Single declarative-only schema addition (`stage_schemas` top-level section in `bonfire-v1.json`) + 3 reference-doc updates (`ecl-schema.md`, `stage-playbook.md`, `handoff-quality-bar.md`) + 1 acceptance test file (`tests/test-stage-schemas-doc-drift.js`). Conservative-plus mandate: declarative-only, no runtime/renderer/agent change.

**Tech Stack:** CommonJS Node.js, `node:test` + `node:assert/strict`, JSON schema, Markdown reference docs. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-10-bonfire-assertion-3b-design.md` (v0.1 frozen as-amended at HEAD `ac13647`).

**Empirical anchor:** `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (2nd dogfood; 6 drift sites D1-D6).

---

## Execution Sequence

**T1 sequential → T2/T3/T4 parallel → T5 serial** per Stage 2 architect ratify.

| Task | Mode | Reason |
|---|---|---|
| T1 (bonfire-v1.json) | Sequential | Authoritative source; downstream tasks derive from it |
| T2 (stage-playbook.md) | Parallel after T1 | Independent file; no dependency on T3 / T4 |
| T3 (ecl-schema.md) | Parallel after T1 | Independent file; largest doc edit |
| T4 (handoff-quality-bar.md) | Parallel after T1 | Independent file; smallest doc edit |
| T5 (acceptance test) | Serial after T2+T3+T4 | Predicates span all 4 prior tasks; test landing requires all 4 closed |

**Parallel dispatch caveat (Lesson 1):** T2/T3/T4 are 3 doc-only tasks editing 3 distinct files. Lesson 1 prefers serial dispatch by default to avoid git race; parallel is ratified here because (a) files fully disjoint, (b) ~10-15 min ROI per task is substantial across 3 tasks, (c) git worktree-per-task isolation eliminates race risk if implementer dispatch chooses that path. **Implementer subagent prompts MUST use explicit `git add <path>` per file, never `git add .` / `-A`.** Architect cross-check after parallel batch verifies no commit interleaving.

---

## File Structure

| File | Role | 3b change |
|---|---|---|
| `schemas/bonfire-v1.json` | Runtime contract schema; per Q1(c) ratify, also authoritative source-of-truth for declarative field-level contracts | Add new top-level `stage_schemas` section per spec §6 verbatim (~80 lines JSON) |
| `references/stage-playbook.md` | Operator-facing stage workflow guide | D1 Stage A reconciliation: replace 13-field `approval_pack` list with 6 flat fields per `stage_schemas.preprocess` |
| `references/ecl-schema.md` | Operator-facing reference for case.json + handoff schemas | Replace 5 `: null` placeholders (preprocess, divergence, requirements, closure, probes) with field-bearing prose deriving from `stage_schemas`; add D5 j-compile companion section schemas; add D6 `source_kind` + `source_ref` to entity / function-contract / data-contract field lists |
| `references/handoff-quality-bar.md` | Operator-facing handoff quality reference | D6: inline `source_kind` + `source_ref` into entity / function-contract / data-contract sections; cross-reference `handoff_substantive_slots._provenance_required` as runtime enforcement source |
| `tests/test-stage-schemas-doc-drift.js` | Acceptance test (NEW) | Implement spec §7 predicates 1-8 as `node:test` cases |

---

## Task 1: Add `stage_schemas` to `bonfire-v1.json`

**Files:**
- Modify: `schemas/bonfire-v1.json` (add new top-level section)

**Spec ref:** §5 mechanism, §6 schema design (verbatim contract).

- [ ] **Step 1.1: Locate insertion point**

Run: `grep -n '^  "verdict_substantive_check"\|^  "layer_2b_calibration"\|^  "handoff_substantive_slots"\|^  "handoff_mandate_params"' schemas/bonfire-v1.json`

Expected: line numbers for these existing top-level siblings. The new `stage_schemas` section goes alongside them as a top-level sibling. A reasonable position is immediately after `layer_2b_calibration` (round-4 addition) and before `handoff_mandate_params`. Verify exact line via grep output; do NOT trust plan literal numbers (Lesson 4 dispatch discipline).

- [ ] **Step 1.2: Insert `stage_schemas` per spec §6 verbatim**

Edit `schemas/bonfire-v1.json`. Insert the section per spec §6 v0.1 layout. The section MUST match spec §6 exactly:

```json
"stage_schemas": {
  "_note": "Documentation-only field schemas for stage outputs. Not runtime-enforced. Authoritative for ecl-schema.md and stage-playbook.md derivation. Future assertion may extend to runtime enforcement.",
  "version": 1,
  "preprocess": {
    "source": "case.json#stages.preprocess",
    "note": "Fields written flat at top level — not nested in approval_pack sub-object",
    "required_fields": ["reframed_goal"],
    "array_fields": {
      "retained_scope":       { "items": "string" },
      "excluded_scope":       { "items": "string" },
      "critical_assumptions": { "items": "string" },
      "frozen_for_code":      { "items": "string" },
      "ambiguity_points":     { "items": "string" }
    }
  },
  "divergence": {
    "source": "case.json#stages.divergence",
    "array_fields": {
      "options": {
        "items": "object",
        "item_fields": ["title", "description", "blind_spots_covered", "retained_option"]
      }
    }
  },
  "requirements": {
    "source": "case.json#stages.requirements",
    "array_fields": {
      "requirement_units": {
        "items": "object",
        "item_fields": ["id", "title", "description", "success_criteria", "depends_on"]
      }
    }
  },
  "closure": {
    "source": "case.json#stages.closure",
    "array_fields": {
      "dependency_chain": {
        "items": "object",
        "item_fields": ["id", "description", "upstream", "downstream"]
      },
      "resolved_gaps": { "items": "string" }
    }
  },
  "probes": {
    "source": "case.json#stages.probes",
    "note": "Preventive coverage — no current drift evidence; template + playbook aligned. Lock schema to prevent future drift.",
    "array_fields": {
      "probes": {
        "items": "object",
        "item_fields": ["hypothesis", "method", "expected_signal", "kill_criteria", "result"]
      }
    }
  },
  "compile_output_companion": {
    "note": "Inspection surfaces in compile-output.json — not alternate sources of truth. The compile-output.json itself is the authoritative artifact; these are companion sections rendered into separate markdown files.",
    "sections": {
      "constraint_crosswalk": {
        "array": "mappings",
        "item_fields": ["constraint_id", "content", "unit_ids"]
      },
      "execution_manifest": {
        "array": "waves",
        "item_fields": ["wave", "description", "units"]
      },
      "code_batches": {
        "array": "batches",
        "item_fields": ["batch_id", "description", "units"]
      },
      "compile_summary": {
        "fields": ["code_ready", "summary", "blockers"]
      },
      "final_handoff": {
        "fields": ["statement", "status"]
      }
    }
  }
},
```

(Trailing comma per JSON sibling-key syntax; verify the next existing top-level key follows correctly.)

- [ ] **Step 1.3: Verify JSON valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 1.4: Verify `stage_schemas` 8-key structure**

Run:
```bash
node -e "
const s = JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8'));
const keys = Object.keys(s.stage_schemas);
console.log('stage_schemas keys:', keys.sort().join(','));
console.log('count:', keys.length);
"
```
Expected: 8 keys (ASCII-sorted: `_note,closure,compile_output_companion,divergence,preprocess,probes,requirements,version`); count 8.

- [ ] **Step 1.5: Run install.sh to deploy**

Run: `bash install.sh`
Verify deployed:
```bash
grep -c "\"stage_schemas\"" $HOME/.claude/bonfire/schemas/bonfire-v1.json
```
Expected: `1`.

- [ ] **Step 1.6: Run full test suite (regression sanity)**

Run: `node --test tests/*.js | tail -5`
Expected: 306 pass, 0 fail (no test changes; schema addition is data-only, but verify no regression on existing tests that might walk schema keys).

- [ ] **Step 1.7: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "feat(3b): add stage_schemas declarative top-level section

Per Assertion 3b spec §5 mechanism + §6 schema design (v0.1 frozen at
ac13647): adds new top-level stage_schemas section to bonfire-v1.json
as authoritative source-of-truth for field-level stage contracts.

6 entries per spec §6 inclusion list:
- preprocess (D1 P2 reconcile target)
- divergence (D2 P3 retained_option add)
- requirements (D3 P3 requirement_units add)
- closure (D4 P3 dependency_chain item schema + resolved_gaps add)
- probes (preventive coverage; no current drift, template+playbook aligned)
- compile_output_companion (D5 P1 j-compile 5 sub-sections promote)

_note field declares 'Documentation-only ... not runtime-enforced' per
Stage 2 design-risk mitigation. schema_version stays 2 (declarative
addition; runtime contract unchanged per S2.3 architect ratify).

Authoritative chain: bonfire-v1.json#stage_schemas → ecl-schema.md
derives (Task 3) + stage-playbook.md reconciles (Task 2). Agent prompts
NOT touched per §4 OUT mandate.

spec: 3b v0.1 §5 + §6"
```

---

## Task 2: D1 stage-playbook.md Stage A reconciliation

**Files:**
- Modify: `references/stage-playbook.md` (Stage A section, ~lines 30-60)

**Spec ref:** §6.1 D1 reconciliation; Q2 dialectic verdict (SKILL.md + template alliance authoritative; playbook is edit target).

- [ ] **Step 2.1: Locate Stage A section**

Run: `grep -n "^## A /\|user_stated_request\|approval_pack" references/stage-playbook.md | head -10`
Expected: line numbers showing `## A / ...` header and the 13-field list region.

- [ ] **Step 2.2: Replace 13-field `approval_pack` list with 6 flat fields**

Edit `references/stage-playbook.md` Stage A section. Find the "Required output fields in `case.json#stages.preprocess`" block (currently lists 13 fields including `user_stated_request, ambiguity_points, dubious_claims, factual_gaps, hidden_assumptions, suspected_real_goals, scenario_fragments, success_signals, non_goals, follow_up_questions, blocking_unknowns, reframed_request, approval_pack`).

Replace with:

```markdown
Required output fields in `case.json#stages.preprocess` — flat at top level (NOT nested in `approval_pack` sub-object):

- `reframed_goal` — string; the goal as understood after preprocess dialogue
- `retained_scope` — string array; scope items kept in
- `excluded_scope` — string array; scope items explicitly excluded
- `critical_assumptions` — string array; assumptions made explicit
- `frozen_for_code` — string array; constraints sealed for /code
- `ambiguity_points` — string array; remaining low-impact unknowns

Stage A agents (intent-extractor, reality-checker, blind-spot-scout) emit working data (dubious_claims, factual_gaps, hidden_assumptions, suspected_real_goals, scenario_fragments, success_signals, non_goals, follow_up_questions, blocking_unknowns) during dialogue — these inform the approval pack but are NOT persisted to `case.json#stages.preprocess`. They appear in support-agent return values and conversation context only.

Schema reference: `bonfire-v1.json#stage_schemas.preprocess` (authoritative).
```

- [ ] **Step 2.3: Verify reconciliation**

Run:
```bash
grep -cE "user_stated_request|dubious_claims|approval_pack" references/stage-playbook.md
```
Expected: 0 (or low single-digit if appearing only in the agent-working-data caveat sentence; predicate 7 tolerates the caveat reference but rejects required-output-field framing).

(Note: `-E` enables ERE alternation portably across BSD grep / GNU grep — `\|` BRE alternation is non-portable on macOS Darwin.)

Run:
```bash
grep -A 8 "Required output fields in .case.json#stages.preprocess." references/stage-playbook.md | head -10
```
Expected: 6 fields shown — reframed_goal, retained_scope, excluded_scope, critical_assumptions, frozen_for_code, ambiguity_points.

- [ ] **Step 2.4: Run install.sh**

Run: `bash install.sh`
(References folder is deployed alongside schemas; verify per deployment convention.)

- [ ] **Step 2.5: Commit**

```bash
git add references/stage-playbook.md
git commit -m "docs(3b): D1 reconcile stage-playbook.md Stage A field list

Per Assertion 3b spec §6.1 D1 (Q2 dialectic): replaces stage-playbook.md
Stage A 'Required output fields' 13-field list (with approval_pack
wrapper) with the 6 flat fields per stage_schemas.preprocess.

Resolution: SKILL.md + template alliance authoritative. Playbook was the
3-way-split outlier (lists process-artifact fields nested in approval_pack
sub-object; SKILL.md + template write 6 fields flat at case.json#stages.
preprocess top level).

Stage A agent working data (dubious_claims, factual_gaps, etc.) noted as
agent-internal — these inform approval pack but not persisted to case.json.

Schema reference: bonfire-v1.json#stage_schemas.preprocess (authoritative
post Task 1).

spec: 3b v0.1 §6.1"
```

---

## Task 3: D2/D3/D4/D5/D6 ecl-schema.md updates

**Files:**
- Modify: `references/ecl-schema.md`

**Spec ref:** §6.2 (D2/D3/D4 P3 absent fields), §6.3 (D5 companion), §6.4 (D6 source_kind/source_ref).

This is the largest doc edit. 5 stage placeholders to replace + 5 companion sub-section schemas to add + 3 field-list updates for source_kind/source_ref.

- [ ] **Step 3.1: Read current ecl-schema.md structure**

Run:
```bash
grep -n "^## \|^### " references/ecl-schema.md
```
Expected: section headers including "Case JSON Structure", "Compile Output / Handoff Structure", "Function Contract Fields", "Other Compile Output Sections", etc.

- [ ] **Step 3.2: Replace 5 `: null` placeholders in Case JSON Structure section**

Edit `references/ecl-schema.md` Case JSON Structure code block (~lines 12-23). Replace the 5 `: null` placeholders for preprocess/divergence/requirements/closure/probes with field references:

```diff
   "stages": {
-    "preprocess": null,
-    "divergence": null,
-    "requirements": null,
+    "preprocess": "<see stage_schemas.preprocess>",
+    "divergence": "<see stage_schemas.divergence>",
+    "requirements": "<see stage_schemas.requirements>",
     "critique": null,
-    "closure": null,
-    "probes": null,
+    "closure": "<see stage_schemas.closure>",
+    "probes": "<see stage_schemas.probes>",
     "red_blue": null,
     "review": null,
     "compile_for_code": null
   }
```

- [ ] **Step 3.3: Add 5 stage_schemas-derived field-spec subsections**

Add a new section after "Case JSON Structure" titled "Stage Output Schemas" with 5 subsections (one per stage_schemas entry: preprocess, divergence, requirements, closure, probes). Each subsection cites `bonfire-v1.json#stage_schemas.<id>` as authoritative source and lists the field shapes derived from §6 spec.

Example for preprocess (template; follow same pattern for divergence/requirements/closure/probes):

```markdown
### Stage A — Preprocess (`stages.preprocess`)

**Authoritative source:** `bonfire-v1.json#stage_schemas.preprocess`

Required scalar fields:
- `reframed_goal` — string

Array fields:
- `retained_scope` — string array
- `excluded_scope` — string array
- `critical_assumptions` — string array
- `frozen_for_code` — string array
- `ambiguity_points` — string array

Fields are written flat at `case.json#stages.preprocess.*` (NOT nested in `approval_pack`).
```

Apply the same pattern for the other 4 stages, deriving each field list from spec §6 verbatim. Probes section MUST include the "Preventive coverage" note from `stage_schemas.probes.note`.

- [ ] **Step 3.4: Add D5 compile_output_companion sections**

In the "Compile Output / Handoff Structure" or "Other Compile Output Sections" area, add 5 sub-section schemas derived from `stage_schemas.compile_output_companion.sections`:

```markdown
### Compile Output Companion Sections

**Authoritative source:** `bonfire-v1.json#stage_schemas.compile_output_companion`

These are inspection surfaces rendered into companion markdown files. The compile-output.json itself is the authoritative artifact; these are derived views.

#### constraint_crosswalk
- Array: `mappings[]`
- Item fields: `constraint_id`, `content`, `unit_ids`

#### execution_manifest
- Array: `waves[]`
- Item fields: `wave`, `description`, `units`

#### code_batches
- Array: `batches[]`
- Item fields: `batch_id`, `description`, `units`

#### compile_summary
- Fields: `code_ready`, `summary`, `blockers`

#### final_handoff
- Fields: `statement`, `status`
```

- [ ] **Step 3.5: Add D6 source_kind / source_ref to existing field lists**

Locate the existing `### Function Contract Fields` section (~line 74). Add `source_kind` and `source_ref` to that field list:

```markdown
- `source_kind` — string; one of `ledger_direct` | `condition_rewrite`. Required when `_provenance_required: true` in `bonfire-v1.json#handoff_substantive_slots`. Runtime-enforced by `validateProvenance` in `bin/lib/schema.cjs`.
- `source_ref` — string (`ledger_direct`) or `{condition_index: <number>}` (`condition_rewrite`). Required alongside `source_kind`.
```

For `entity` and `data_contract` paths: per spec §6.4 S2.4(a) **inline** ratify (NOT new subsections), add a sub-bullet directly under the existing `domain_model` and `data_contract` bullets in the `### Required Handoff Fields` section. Concretely, the existing bullets are of the form:

```markdown
- `domain_model`: object — ...
- `data_contract`: object — ...
```

Append a sub-bullet under each:

```markdown
- `domain_model`: object — ...
  - **Provenance fields on each entity:** `source_kind` + `source_ref` required per `handoff_substantive_slots._provenance_required`. See Function Contract Fields above for type definitions.
- `data_contract`: object — ...
  - **Provenance fields on data_contract:** `source_kind` + `source_ref` required per `handoff_substantive_slots._provenance_required`. See Function Contract Fields above for type definitions.
```

This avoids creating new `### Entity Fields` and `### Data Contract Fields` subsections (out of scope per S2.4(a) inline ratify). The cross-reference to Function Contract Fields prevents duplication of type definitions across 3 places.

- [ ] **Step 3.6: Verify changes**

Predicate-positive grep:
```bash
grep -c "retained_scope\|requirement_units\|dependency_chain\|resolved_gaps\|hypothesis" references/ecl-schema.md
```
Expected: ≥5 (each distinctive field name appears in its stage section).

Predicate-negative grep:
```bash
grep -E '"(preprocess|divergence|requirements|closure|probes)": null,?' references/ecl-schema.md
```
Expected: 0 matches.

Predicate D6 grep:
```bash
grep -c "source_kind\|source_ref" references/ecl-schema.md
```
Expected: ≥3 (entity / function-contract / data-contract sections all mention).

- [ ] **Step 3.7: Run install.sh**

Run: `bash install.sh`

- [ ] **Step 3.8: Commit**

```bash
git add references/ecl-schema.md
git commit -m "docs(3b): D2-D6 ecl-schema.md sync from stage_schemas

Per Assertion 3b spec §6.2 (D2/D3/D4 P3 absent fields) + §6.3 (D5 P1
j-compile companion lag) + §6.4 (D6 P1 source_kind/source_ref):

5 stages — replaces ': null' placeholders for preprocess, divergence,
requirements, closure, probes with field-bearing prose deriving from
stage_schemas.<id> in bonfire-v1.json. Each stage section cites the
authoritative schema entry.

5 companion sub-sections — adds field-level schemas for constraint_
crosswalk, execution_manifest, code_batches, compile_summary, final_
handoff (D5 promotion from agent-prompt-only to operator reference).

3 provenance field lists — adds source_kind + source_ref to entity /
function_contract / data_contract field lists with cross-reference to
handoff_substantive_slots._provenance_required runtime enforcement.

Authoritative source: bonfire-v1.json#stage_schemas (Task 1) +
handoff_substantive_slots._provenance_required (existing runtime
contract). ecl-schema.md is now derived doc.

spec: 3b v0.1 §6.2 + §6.3 + §6.4"
```

---

## Task 4: D6 handoff-quality-bar.md inline source_kind/source_ref

**Files:**
- Modify: `references/handoff-quality-bar.md`

**Spec ref:** §6.4 D6 disposition; S2.4(a) inline.

- [ ] **Step 4.1: Read current handoff-quality-bar.md structure**

Run: `grep -n "^## \|^### " references/handoff-quality-bar.md`
Expected: section headers including entity / function-contract / data-contract sections (or equivalent).

- [ ] **Step 4.2: Inline source_kind / source_ref into 3 sections**

Edit `references/handoff-quality-bar.md`. For each of entity / function-contract / data-contract sections, add `source_kind` + `source_ref` to the field list with cross-reference:

```markdown
**Required provenance fields:**
- `source_kind` — string; one of `ledger_direct` | `condition_rewrite`. Required per `bonfire-v1.json#handoff_substantive_slots._provenance_required: true`. Runtime-enforced by `validateProvenance` in `bin/lib/schema.cjs`.
- `source_ref` — `ledger_direct`: ledger entry id (string); `condition_rewrite`: `{condition_index: <number>}`. Required alongside `source_kind`.
```

If sections for entity / function-contract / data-contract do not already exist as named subsections, add them per the doc's existing organizational pattern.

- [ ] **Step 4.3: Verify**

```bash
grep -c "source_kind\|source_ref" references/handoff-quality-bar.md
```
Expected: ≥3 (entity / function-contract / data-contract sections all mention).

- [ ] **Step 4.4: Run install.sh**

Run: `bash install.sh`

- [ ] **Step 4.5: Commit**

```bash
git add references/handoff-quality-bar.md
git commit -m "docs(3b): D6 handoff-quality-bar.md inline source_kind/source_ref

Per Assertion 3b spec §6.4 D6 (S2.4(a) inline): adds source_kind +
source_ref documentation to entity / function-contract / data-contract
sections in handoff-quality-bar.md.

D6 is the only drift site without bonfire-v1.json change — runtime
contract already encodes via handoff_substantive_slots._provenance_
required: true. The drift was purely operator-reference: J-Compile
agent prompts documented the requirement, but ecl-schema.md (Task 3)
and handoff-quality-bar.md (this task) did not. Operator following
reference docs hit silent handoff-validate rejection.

Cross-reference to runtime enforcement: validateProvenance in
bin/lib/schema.cjs reads _provenance_required and rejects entries
missing source_kind / source_ref.

spec: 3b v0.1 §6.4"
```

---

## Task 5: Acceptance test predicates 1-8

**Files:**
- Create: `tests/test-stage-schemas-doc-drift.js`

**Spec ref:** §7 acceptance criteria (8 predicates).

This task lands AFTER T1 + T2 + T3 + T4 are all closed. Predicates span all 4 prior tasks; test cannot run cleanly until all 4 land.

- [ ] **Step 5.1: Verify all 4 prior tasks landed**

Run:
```bash
git log --oneline -5
```
Expected: HEAD shows commits for T4, T3, T2, T1, ac13647 (spec) in some order. All 4 implementation commits present.

```bash
node -e "
const s = JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8'));
console.log('stage_schemas present:', 'stage_schemas' in s);
console.log('keys:', Object.keys(s.stage_schemas || {}).sort().join(','));
"
```
Expected: `stage_schemas present: true` + 8 keys listed.

- [ ] **Step 5.2: Write acceptance test**

Create `tests/test-stage-schemas-doc-drift.js`:

```javascript
'use strict';

/**
 * Assertion 3b acceptance test — schema-doc drift closure.
 *
 * Implements spec §7 predicates 1-8:
 * 1. bonfire-v1.json validity
 * 2. stage_schemas 8-key presence
 * 3. _note declarative declaration
 * 4. Schema field literal match (per §6 spec)
 * 5. ecl-schema.md 5-stage null replacement (positive + negative grep)
 * 6. ecl-schema.md D6 source_kind/source_ref ≥3 mentions
 * 7. stage-playbook.md D1 reconciliation
 * 8. handoff-quality-bar.md D6 inline ≥3 mentions
 *
 * spec: docs/superpowers/specs/2026-05-10-bonfire-assertion-3b-design.md §7
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'bonfire-v1.json');
const ECL_PATH = path.join(REPO_ROOT, 'references', 'ecl-schema.md');
const PLAYBOOK_PATH = path.join(REPO_ROOT, 'references', 'stage-playbook.md');
const HQB_PATH = path.join(REPO_ROOT, 'references', 'handoff-quality-bar.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Predicate 1: bonfire-v1.json validity
test('3b predicate 1: bonfire-v1.json parses as valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(readFile(SCHEMA_PATH)),
    'schemas/bonfire-v1.json must parse as valid JSON');
});

// Predicate 2: stage_schemas 8-key presence
test('3b predicate 2: stage_schemas has 8 keys', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  assert.ok(schema.stage_schemas, 'stage_schemas top-level section must exist');
  const keys = Object.keys(schema.stage_schemas).sort();
  const expected = ['_note', 'closure', 'compile_output_companion', 'divergence', 'preprocess', 'probes', 'requirements', 'version'].sort();
  assert.deepEqual(keys, expected,
    `stage_schemas keys mismatch — expected ${expected.join(',')}, got ${keys.join(',')}`);
});

// Predicate 3: _note declarative declaration
test('3b predicate 3: stage_schemas._note declares documentation-only', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  const note = schema.stage_schemas._note || '';
  assert.match(note, /Documentation-only|not runtime-enforced/i,
    `_note must declare documentation-only or not-runtime-enforced; got: ${note}`);
});

// Predicate 4: Schema field literal match per §6 spec
test('3b predicate 4: stage_schemas field shapes match spec §6 verbatim', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  const ss = schema.stage_schemas;

  // preprocess
  const ppArr = Object.keys(ss.preprocess.array_fields).sort();
  assert.deepEqual(ppArr,
    ['ambiguity_points', 'critical_assumptions', 'excluded_scope', 'frozen_for_code', 'retained_scope'],
    'preprocess.array_fields keys mismatch');
  assert.deepEqual(ss.preprocess.required_fields, ['reframed_goal'],
    'preprocess.required_fields must be ["reframed_goal"] only (Issue 1 fix)');

  // divergence
  assert.ok(ss.divergence.array_fields.options.item_fields.includes('retained_option'),
    'divergence.options.item_fields must include retained_option (D2)');

  // requirements
  assert.deepEqual(ss.requirements.array_fields.requirement_units.item_fields,
    ['id', 'title', 'description', 'success_criteria', 'depends_on'],
    'requirements.requirement_units.item_fields mismatch (D3)');

  // closure
  assert.deepEqual(ss.closure.array_fields.dependency_chain.item_fields,
    ['id', 'description', 'upstream', 'downstream'],
    'closure.dependency_chain.item_fields mismatch (D4)');
  assert.equal(ss.closure.array_fields.resolved_gaps.items, 'string',
    'closure.resolved_gaps.items must be "string" (D4)');

  // probes
  assert.deepEqual(ss.probes.array_fields.probes.item_fields,
    ['hypothesis', 'method', 'expected_signal', 'kill_criteria', 'result'],
    'probes.probes.item_fields mismatch');

  // compile_output_companion sections
  const compKeys = Object.keys(ss.compile_output_companion.sections).sort();
  assert.deepEqual(compKeys,
    ['code_batches', 'compile_summary', 'constraint_crosswalk', 'execution_manifest', 'final_handoff'],
    'compile_output_companion.sections keys mismatch (D5)');
});

// Predicate 5: ecl-schema.md 5-stage null replacement
test('3b predicate 5a: ecl-schema.md positive field-spec assertion', () => {
  const ecl = readFile(ECL_PATH);
  const distinctive = ['retained_scope', 'requirement_units', 'dependency_chain', 'resolved_gaps', 'hypothesis'];
  const matchCount = distinctive.filter(t => ecl.includes(t)).length;
  assert.ok(matchCount >= 5,
    `ecl-schema.md must mention at least 5 distinctive field names; got ${matchCount}: ${distinctive.filter(t => !ecl.includes(t)).join(',')} missing`);
});

test('3b predicate 5b: ecl-schema.md no remaining stage:null for 5 reconciled stages', () => {
  const ecl = readFile(ECL_PATH);
  const re = /"(preprocess|divergence|requirements|closure|probes)": null,?/;
  const m = ecl.match(re);
  assert.equal(m, null,
    `ecl-schema.md must not contain stage:null for 5 reconciled stages; found: ${m && m[0]}`);
});

// Predicate 6: ecl-schema.md D6 source_kind/source_ref ≥3 mentions
test('3b predicate 6: ecl-schema.md mentions source_kind/source_ref ≥3 times', () => {
  const ecl = readFile(ECL_PATH);
  const matches = (ecl.match(/source_kind|source_ref/g) || []).length;
  assert.ok(matches >= 3,
    `ecl-schema.md must mention source_kind or source_ref ≥3 times (entity / FC / data_contract); got ${matches}`);
});

// Predicate 7: stage-playbook.md D1 reconciliation
test('3b predicate 7: stage-playbook.md Stage A 13-field artifacts removed', () => {
  const playbook = readFile(PLAYBOOK_PATH);

  // Required-output-field framing of artifacts must be removed.
  // Tolerance: artifacts may appear in caveat sentence ("agents emit working data X, Y, Z")
  // but not as required-output-field list items.
  const stageARegion = playbook.match(/## A \/[\s\S]*?(?=^## )/m);
  assert.ok(stageARegion, 'stage-playbook.md Stage A section must exist');
  const stageA = stageARegion[0];

  // Verify 6 flat fields are present in Stage A region
  for (const f of ['reframed_goal', 'retained_scope', 'excluded_scope', 'critical_assumptions', 'frozen_for_code', 'ambiguity_points']) {
    assert.ok(stageA.includes(f),
      `Stage A must list ${f} as required output field`);
  }

  // approval_pack as a wrapper-key in field list must be absent (caveat-mention OK).
  // We use a structural check: approval_pack should not appear as a top-level bullet point.
  const wrapperPattern = /^- `approval_pack`/m;
  assert.ok(!wrapperPattern.test(stageA),
    'Stage A must not list approval_pack as a top-level required field');
});

// Predicate 8: handoff-quality-bar.md D6 inline ≥3 mentions
test('3b predicate 8: handoff-quality-bar.md mentions source_kind/source_ref ≥3 times', () => {
  const hqb = readFile(HQB_PATH);
  const matches = (hqb.match(/source_kind|source_ref/g) || []).length;
  assert.ok(matches >= 3,
    `handoff-quality-bar.md must mention source_kind or source_ref ≥3 times; got ${matches}`);
});
```

- [ ] **Step 5.3: Run new test**

Run: `node --test tests/test-stage-schemas-doc-drift.js | tail -10`
Expected: 8 tests pass (predicates 1, 2, 3, 4, 5a, 5b, 6, 7, 8 — note predicate 5 split into 5a + 5b → 9 tests total; or count adjusted).

If any test fails, the corresponding prior task (T1-T4) has a gap. Surface as DONE_WITH_CONCERNS with specific failing predicate; architect adjudicates whether prior task needs fix-up.

- [ ] **Step 5.4: Run full test suite**

Run: `node --test tests/*.js | tail -5`
Expected: 306 + 9 = 315 pass, 0 fail.

- [ ] **Step 5.5: Run install.sh**

Run: `bash install.sh`

- [ ] **Step 5.6: Commit**

```bash
git add tests/test-stage-schemas-doc-drift.js
git commit -m "test(3b): acceptance criteria — 8 doc-validation predicates

Per Assertion 3b spec §7: implements 9 test cases covering predicates 1-8
(predicate 5 split into 5a positive + 5b negative for clarity).

Predicates verify the closure of all 6 drift sites D1-D6 (per spec §3.1):
1. bonfire-v1.json validity (any breakage from Task 1 schema addition)
2. stage_schemas 8-key presence (Task 1 structural completeness)
3. _note declarative declaration (Stage 2 design-risk mitigation)
4. Schema field literal match per §6 verbatim (Task 1 spec compliance)
5a/5b. ecl-schema.md 5-stage null replacement (positive + JSON-quoted negative;
       Task 3 D2/D3/D4 closure)
6. ecl-schema.md D6 source_kind/source_ref ≥3 (Task 3 D6 closure)
7. stage-playbook.md D1 reconciliation (Task 2 closure; tolerates
   artifact mentions in caveat, rejects required-field framing)
8. handoff-quality-bar.md D6 inline ≥3 (Task 4 D6 closure)

Acceptance receipt: all 4 prior tasks (Tasks 1-4) closed → predicates
1-8 green. This commit lands AFTER T1 + T2 + T3 + T4 per parallel-batch
sequencing.

spec: 3b v0.1 §7"
```

---

## Self-Review

After all 5 tasks committed, verify:

**Spec coverage:**
- [ ] §5 mechanism: stage_schemas section added (Task 1) + ecl-schema.md derives (Task 3) + stage-playbook.md reconciles (Task 2) + handoff-quality-bar.md updated (Task 4)
- [ ] §6.1 D1 preprocess reconciliation: Task 2
- [ ] §6.2 D2/D3/D4 P3 absent fields: Task 1 schema add + Task 3 ecl-schema.md derive
- [ ] §6.3 D5 compile_output_companion: Task 1 schema add + Task 3 ecl-schema.md derive
- [ ] §6.4 D6 source_kind/source_ref: Task 3 (ecl-schema.md) + Task 4 (handoff-quality-bar.md)
- [ ] §7 acceptance: 8 predicates → 9 tests (Task 5)

**Mandate scope fidelity:**
- [ ] No runtime enforcement of stage_schemas added (declarative-only honored)
- [ ] No agent prompts modified
- [ ] No renderer behavior changes
- [ ] schema_version stays 2 (no bump)

**Type consistency:**
- [ ] `stage_schemas.<id>` keys match between Task 1 (schema), Task 3 (doc cite), Task 5 (test) verbatim
- [ ] Field names in `array_fields` and `item_fields` consistent across schema and doc derive

**Gaps from spec:**
- DQ-1 probes preventive coverage (no test asserts dogfood drift; this is intentional per inclusion criterion)
- DQ-3 future runtime enforcement (out of 3b scope; declarative-only)

These gaps are intentional per spec deferrals.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-11-bonfire-assertion-3b-implementation.md`.

**Recommended execution mode:** subagent-driven-development with explicit T1 sequential → T2/T3/T4 parallel → T5 serial dispatch sequence.

**Per-task dispatch checklist** (from `feedback-subagent-execution-discipline.md` Lessons 1-7):
- Branch verification + plan-vs-reality grep at start (Lesson 4)
- Forbidden `git add .` / `-A`; explicit paths only (Lesson 1 race mitigation, especially critical for T2/T3/T4 parallel batch)
- Post-commit `bash install.sh` + verify deployed
- Status report numeric counts from `node --test tests/*.js | tail -5` (Lesson 6)
- Architect-side cross-check on test count post-receipt (Lesson 5 hardening)
- For T1: spec-reviewer dispatch (literal contract verify §6 verbatim) + quality-reviewer dispatch (Lesson 3 spec-before-quality)
- For T2/T3/T4: doc-only edits; architect-substitute close pattern applies if grep predicates verify (Lesson 5/7)
- For T5: spec-reviewer dispatch (literal contract verify §7 predicates 1:1) + architect cross-check via test run

**Lesson 5/7 close protocol:**
- T1 schema-only data → architect-substitute close after field-by-field literal check (Lesson 7)
- T2/T3/T4 doc-only edits → architect-substitute close after grep predicate verification, given mechanical scope
- T5 test-only → quality-reviewer dispatch may be redundant if predicates all green; architect-substitute close per round-4 Task 4 pattern

**Estimated total:** ~3-5 hours wall-clock + dispatch costs (sonnet model), parallel batch shaving ~30-45 min over fully serial.

**End of Assertion 3b implementation plan v0.1.**
