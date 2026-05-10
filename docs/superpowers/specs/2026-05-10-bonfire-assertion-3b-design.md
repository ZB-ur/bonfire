# Design: Bonfire Assertion 3b — Schema-Doc Drift Closure

**Date:** 2026-05-10
**Status:** Proposed (draft v0.1, awaiting dialectic review)
**Scope:** Close the schema-vs-documentation drift between `bonfire-v1.json` runtime contracts, agent prompts, operator-facing reference docs (`ecl-schema.md`, `handoff-quality-bar.md`), and stage playbook (`stage-playbook.md`). Establish `bonfire-v1.json` as authoritative source-of-truth for field-level stage contracts via a new declarative-only `stage_schemas` top-level section.

**Charter inputs:**
- `dogfood-2026-05-08-bilibili-danmaku-findings.md` findings #2-5, #12-13 (problem evidence)
- Architect dialectic 2026-05-10 (Stage 0 cartography → Stage 1 mechanism → Stage 2 scope boundary)

**Related specs:**
- `2026-04-18-bonfire-freeze-enforcement-design.md` (Assertion 1)
- `2026-04-18-bonfire-hj-seam-hardening-design.md` (Assertion 2)
- `2026-05-08-bonfire-assertion-3a-validation-theater-design.md` (Assertion 3a — completed 2026-05-09)
- `2026-05-10-bonfire-assertion-4-round-4-design.md` (Assertion 4 round-4 — completed 2026-05-10)

**Sibling assertion:** Assertion 3c (state-machine 半成品) — 4 findings cluster carried in dogfood-2026-05-08; separate spec when triggered. F1 (cross-language-approved Layer 1 reject) is isolated from 3b per Stage 0 verdict.

---

## 1. Frontmatter context

Three Bonfire assertions have shipped in the production-gap audit chain:
- **Assertion 1** (2026-04 PR #2): truth-surface freeze enforcement.
- **Assertion 2** (2026-04 PR #2): H→J seam hardening (Layer 2a substantive_slot_refs + Layer 2b prose token-coverage).
- **Assertion 3a** (2026-05-09): validation theater closure (handoff_substantive_slots deep-check + ruling_item_shape + verdict_substantive_check + escape valves).
- **Assertion 4 round-4** (2026-05-10): Layer 2b precision recalibration (max_contiguous_orphan_run primary metric + schema-driven calibration).

Round-4 closure stabilized the Layer 2b reject mechanism. The next surface that the 2nd dogfood (bilibili-clean 2026-05-08) surfaced as production-grade is **schema-vs-documentation drift**: the operator's reference docs (`ecl-schema.md`, `handoff-quality-bar.md`, `stage-playbook.md`) lag behind the runtime contracts encoded in `bonfire-v1.json` and the agent prompts (`agents/bonfire-j-compile.md`). The lag manifests as RENDER ERRORs (operator hits undocumented field expectations), reverse-engineering forced (operator reads `schema.cjs` to discover `source_kind`/`source_ref`), and operator confusion (3-way doc disagreement between SKILL.md, template, and stage-playbook on Stage A field set).

Assertion 3b closes this surface by establishing `bonfire-v1.json` as authoritative source-of-truth for field-level stage contracts and reconciling the operator-facing docs against it.

This spec is direct-dialectic (anti-recursion principle: 3a-inherited scope-discipline; no bonfire-pipeline self-application within authoring).

## 1.5 Glossary

| Term | Definition |
|---|---|
| `stage_schemas` | New declarative-only top-level section in `schemas/bonfire-v1.json` specifying field-level shapes for stage outputs (`case.json#stages.<stage-id>`) and compile-output companion sections. Authoritative reference for `ecl-schema.md` and `stage-playbook.md` to derive from. **Documentation-only**: not consumed by the renderer or any validator at runtime in 3b v0.1. |
| `stage-id` | Identifier joining `bonfire-v1.json#notes[]`, `case.json#stages.<id>`, render templates `templates/stage-<id>.md`, and the new `stage_schemas.<id>`. Examples: `preprocess`, `divergence`, `requirements`, `closure`, `probes`. |
| `compile_output_companion` | `stage_schemas` entry for j-compile bundle's companion sections (constraint_crosswalk, execution_manifest, code_batches, compile_summary, final_handoff). Treated as one logical stage's artifacts (not 5 independent stages) per Stage 2 S2.5 ratify. |
| `required_fields` | Within a `stage_schemas.<id>` entry: list of non-array scalar fields that MUST be present in `case.json#stages.<id>`. Renderer reads these via `{{field_name}}` direct interpolation. Distinct from `array_fields` — a field appears in EITHER `required_fields` OR `array_fields`, never both. |
| `array_fields` | Within a `stage_schemas.<id>` entry: map of array-typed fields whose item shape is specified via `items` (scalar type) or `item_fields` (object item key list). Array fields are NOT required to be non-empty by `stage_schemas` (declarative-only); 3b spec does not specify min-length. Field appears in `array_fields` instead of `required_fields` because rendering uses `{{#each field}}` iteration not direct interpolation. |
| `drift site` | A specific schema-vs-doc inconsistency identified during Stage 0 cartography. 3b v0.1 enumerates 6 drift sites (D1-D6). |
| `drift pattern` | The structural class of a drift. 3b cartography identified 3 patterns: P1 (agent-doc lag), P2 (inter-doc inconsistency), P3 (field absent everywhere). |
| `declarative-only` | A schema section that is read by humans and tooling for documentation purposes but NOT consumed by the runtime validator or the renderer. Distinct from existing `delta_schemas` / `verdict_substantive_check` / `handoff_substantive_slots` which ARE runtime-enforced. |
| `conservative-plus mandate` | 3b scope decision: add field schema where absent + sync docs to derive from it + reconcile inter-doc inconsistencies. **OUT**: validator enforcement of stage_schemas (future assertion candidate), changes to agent prompt structure, renderer behavior changes (e.g., RENDER ERROR enrichment from stage_schemas). |
| `RENDER ERROR` | Renderer's failure mode when a template references a field that is absent from the JSON source. Operator-facing UX symptom of P3 drift. |

## 2. Context

The 2nd dogfood (Bilibili 弹幕降噪 Chrome 插件, autonomous clean run 2026-05-08, evidence at `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/`) surfaced 20 findings. Of those, 6 (#2-5, #12, #13) cluster around schema-vs-documentation drift. The drift cluster is **structural**, not incidental — operator following reference docs encountered:

- 5 RENDER ERRORs in Stage A (field set mismatch with stage-playbook.md)
- 1 RENDER ERROR in Stage B (`retained_option` field undocumented anywhere)
- 1 RENDER ERROR in Stage C (`requirement_units[]` schema undocumented)
- 16 RENDER ERRORs across Stage E iterations (`dependency_chain[]` item schema + `resolved_gaps` undocumented)
- 9 RENDER ERRORs in 5 j-compile bundle markdown files (companion sub-section schemas in agent prompt only)
- 1 silent handoff-validate rejection (`source_kind`/`source_ref` documented in agent prompt only, absent from `ecl-schema.md` and `handoff-quality-bar.md`)

Stage 0 cartography (architect dialectic 2026-05-10) classified the 6 drift sites into 3 distinct patterns. Stage 1 mechanism dialectic settled `bonfire-v1.json` extension as the authoritative resolution path (Q1(c) ratify). Stage 2 scope boundary settled "conservative-plus" mandate (declarative-only addition, no runtime/renderer/agent change).

## 3. Problem

The drift surface is enumerated in Stage 0 cartography:

### 3.1 Drift sites (6) and patterns (3)

| ID | Site | Pattern | Symptom (per 2nd-dogfood evidence) |
|---|---|---|---|
| **D1** | Stage A preprocess | **P2** inter-doc | 3-way split: `pre/SKILL.md` + `templates/stage-a.md` aligned (6 flat fields); `stage-playbook.md` lists 13 different fields wrapped in `approval_pack`. 5 RENDER ERRORs/run. |
| **D2** | Stage B divergence — `retained_option` | **P3** absent | `templates/stage-b.md` reads `options[].retained_option`; field name absent from `ecl-schema.md`, `stage-playbook.md`, `pre/SKILL.md`, `bonfire-v1.json`. 1 RENDER ERROR/run. |
| **D3** | Stage C requirements — `requirement_units[]` | **P3** absent | `templates/stage-c.md` reads `requirement_units[]` with `{id, title, description, success_criteria, depends_on}`. Item schema absent everywhere. 1 RENDER ERROR/run. |
| **D4** | Stage E closure — `dependency_chain[]` items + `resolved_gaps[]` | **P3** absent | `templates/stage-e.md` reads `dependency_chain[]` with `{id, description, upstream, downstream}` and `resolved_gaps[]`. `dependency_chain` is mentioned by name in `stage-playbook.md` but no item schema. `resolved_gaps` absent everywhere. 16 RENDER ERRORs/run (high iteration count). |
| **D5** | J-Compile bundle companion sections | **P1** agent-doc lag | 5 templates (`constraint-crosswalk.md`, `execution-manifest.md`, `code-batches.md`, j-compile compile_summary, `final-handoff.md`) read fields whose schema is documented in `agents/bonfire-j-compile.md` (agent prompt) but not in `ecl-schema.md` (operator reference). 9 RENDER ERRORs/run. |
| **D6** | `source_kind` + `source_ref` provenance fields | **P1** agent-doc lag | `bonfire-v1.json#handoff_substantive_slots._provenance_required: true` enforces these at runtime; `agents/bonfire-j-compile.md` documents them; `ecl-schema.md` and `handoff-quality-bar.md` do not mention them at all. Operator following reference docs hits silent `handoff-validate` rejection. |

### 3.2 Pattern characterization

- **P1 (agent-doc lag)**: agent prompts (`agents/*.md`) are accurate; operator reference docs (`ecl-schema.md`, `handoff-quality-bar.md`) lag. Fix is reference-doc sync.
- **P2 (inter-doc inconsistency)**: two operator-facing docs disagree (e.g., `pre/SKILL.md` vs `stage-playbook.md` on Stage A field set). Fix requires designating one authoritative + syncing the other.
- **P3 (field entirely absent)**: a template requires a field that no doc anywhere specifies. Fix requires adding the schema to at least one authoritative doc + propagating downstream.

### 3.3 Why this is structural, not incidental

The drift recurs at the rate of new field additions: any time a renderer/validator/agent adds a new field expectation, the operator-reference docs lag unless explicitly synced. Without an authoritative source-of-truth, drift accumulates. The 1st dogfood (gto-trainer 2026-05-04) surfaced 1 instance (#0 achieve.md render bug). The 2nd dogfood surfaced 6. The 3rd dogfood will surface more unless the structural fix lands.

## 4. Mandate scope

3b mandate per architect ratify (Stage 2 conservative-plus):

**IN scope:**
- Add `stage_schemas` top-level section to `schemas/bonfire-v1.json` for stages where field-level schema is currently absent or under-specified.
- Sync `references/ecl-schema.md` to derive from `stage_schemas` (replace `: null` placeholders + add D5 companion field schemas + add D6 source_kind/source_ref to relevant field lists).
- Reconcile `references/stage-playbook.md` Stage A section against `pre/SKILL.md` + `templates/stage-a.md` (P2 D1 reconciliation).
- Update `references/handoff-quality-bar.md` to surface D6 source_kind/source_ref requirement inline in entity / function-contract / data-contract sections.

**OUT of scope (explicit non-goals):**
- Validator enforcement of `stage_schemas` at runtime. 3b is declarative-only. Future assertion may extend `stage_schemas` to runtime-enforced (the precedent created by `delta_schemas` and `verdict_substantive_check`).
- Changes to agent prompt structure (`agents/*.md`). Agents continue to author their own prose with field expectations; 3b does not codegen agent prompts from schema.
- Renderer behavior changes. RENDER ERROR remains the failure mode for missing fields. 3b does not enrich error messages from `stage_schemas`.
- Schema migration of stages already covered by `delta_schemas` (D-Critique, G-Red, G-Blue, H-Review) or `verdict_substantive_check`. Those stages' field schemas are already runtime-authoritative; adding to `stage_schemas` would duplicate.
- Coverage of stages whose schema cannot yet be empirically anchored (`critique`, `red_blue`, `review`, `compile_for_code` outside companion sections). These remain `: null` in `case.json` until a future dogfood evidences a stable schema.

## 5. Mechanism

3b adds a new top-level section `stage_schemas` to `schemas/bonfire-v1.json`, keyed by stage-id. The section is declarative-only: it documents field shapes for human readers and downstream tooling that needs to derive doc content. The renderer and validator do NOT consume `stage_schemas` in 3b v0.1.

**Authoritative source-of-truth chain (Q1(c) ratify):**
- `bonfire-v1.json#stage_schemas` is the single source of truth for stage field shapes.
- `ecl-schema.md` derives from `stage_schemas` (replace `: null` placeholders with field references; companion sections list fields per `stage_schemas.compile_output_companion.sections.*`).
- `stage-playbook.md` reconciles to match `stage_schemas.preprocess.array_fields` for Stage A (Q2 D1 reconciliation).
- Agent prompts continue to specify field expectations independently; 3b does NOT update agent prompts to reference schema sections (per §4 OUT mandate).

**Header `_note` field**: `stage_schemas` includes a top-level `_note` declaring "documentation-only, not runtime-enforced" to make intent explicit for future readers (Stage 2 design-risk mitigation per architect dialectic).

## 6. Schema design (stage_schemas v0.1)

The schema design is the spec contract. Implementation in `schemas/bonfire-v1.json` MUST match this structure verbatim. Inclusion list per Stage 2 S2.1(c) ratify: 6 entries (preprocess, divergence, requirements, closure, probes, compile_output_companion).

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
}
```

### 6.1 D1 — preprocess reconciliation (P2)

The 3-way split:
- `templates/stage-a.md` reads 6 fields flat at `stages.preprocess.*` (template reflects renderer expectation).
- `pre/SKILL.md` step 14 writes the 6 fields flat (SKILL.md aligned with template).
- `stage-playbook.md` lines 43-56 lists 13 process-artifact fields wrapped in `approval_pack` sub-object (playbook outlier).

**Resolution (Q2 ratify):** SKILL.md + template alliance is authoritative; stage-playbook.md is the edit target. Per Stage 1 architect dispatch (i): drop process artifacts from playbook (they're agent-internal stage-A working data captured in support-agent return values, not persisted to `case.json`). Replace the 13-field list with the 6 flat-at-top-level approval-pack fields per `stage_schemas.preprocess.array_fields`. Add brief note: "Stage A agents emit working data (dubious_claims, factual_gaps, etc.) — these inform approval pack but are not persisted to case.json#stages.preprocess."

### 6.2 D2/D3/D4 — P3 absent fields (divergence, requirements, closure)

Per Q3 ratify (ii) "bonfire-v1.json — add P3 fields, then ecl-schema.md derives": the schema entries `stage_schemas.divergence`, `stage_schemas.requirements`, `stage_schemas.closure` lock down the field shapes the renderer expects. `ecl-schema.md` then references these (replacing `: null` placeholders with prose that cites `stage_schemas.<id>` as source).

### 6.3 D5 — compile_output_companion (P1)

5 j-compile companion sections promoted from agent-prompt-only documentation to `bonfire-v1.json#stage_schemas.compile_output_companion.sections` (Q3+Q4 entangled disposition). `ecl-schema.md` companion section gets field-level specs derived from this; agent prompt `agents/bonfire-j-compile.md` continues as agent-instructional doc that cites schema (no agent restructure per mandate scope).

### 6.4 D6 — source_kind / source_ref (P1)

D6 is the **only drift site without a `bonfire-v1.json` change**. The runtime contract already encodes the requirement via `handoff_substantive_slots._provenance_required: true` on entities, function_contracts, and data_contract paths. The drift is purely in `ecl-schema.md` (no mention) and `handoff-quality-bar.md` (no mention).

**Resolution (S2.4 ratify scope-expanded):** inline `source_kind` + `source_ref` into ALL 3 affected field lists in both files:
- `ecl-schema.md`: function-contract section (line ~74-80), entity section (currently absent, add via stage_schemas note pointer), data-contract section (currently absent, add).
- `handoff-quality-bar.md`: 3 corresponding sections (entity, function-contract, data-contract). Cross-reference `handoff_substantive_slots._provenance_required` as runtime enforcement source.

## 7. Acceptance criteria

3b implementation is acceptance-tested via documentation cross-validation (3b "fixtures" are doc-validation predicates per Stage 3 collapse decision):

1. **`bonfire-v1.json` validity:** `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8'))"` exits 0.
2. **`stage_schemas` 6-entry presence:** `Object.keys(schema.stage_schemas)` includes `_note`, `version`, `preprocess`, `divergence`, `requirements`, `closure`, `probes`, `compile_output_companion` (8 keys total).
3. **`_note` declarative declaration:** `schema.stage_schemas._note` includes the substring "Documentation-only" or "not runtime-enforced".
4. **Schema field literal match (per §6 spec):**
   - `stage_schemas.preprocess.array_fields` has exactly 5 keys: `retained_scope, excluded_scope, critical_assumptions, frozen_for_code, ambiguity_points`.
   - `stage_schemas.divergence.array_fields.options.item_fields` includes `retained_option`.
   - `stage_schemas.requirements.array_fields.requirement_units.item_fields` matches `[id, title, description, success_criteria, depends_on]`.
   - `stage_schemas.closure.array_fields.dependency_chain.item_fields` matches `[id, description, upstream, downstream]`.
   - `stage_schemas.closure.array_fields.resolved_gaps.items === "string"`.
   - `stage_schemas.probes.array_fields.probes.item_fields` matches `[hypothesis, method, expected_signal, kill_criteria, result]`.
   - `stage_schemas.compile_output_companion.sections` has exactly 5 keys: `constraint_crosswalk, execution_manifest, code_batches, compile_summary, final_handoff`.
5. **`ecl-schema.md` 5-stage null replacement (positive field-spec assertion):** the 5 stage placeholders previously rendered as `: null` (preprocess, divergence, requirements, closure, probes) are replaced with field-bearing prose that references `stage_schemas.<id>` and lists the actual fields. Verify via field-presence positive grep: `grep -c "retained_scope\\|requirement_units\\|dependency_chain\\|resolved_gaps\\|hypothesis" references/ecl-schema.md` returns ≥5 (each of the 5 distinctive field names appears at least once in its stage's section). Negative-form grep `grep -E '"(preprocess\|divergence\|requirements\|closure\|probes)": null,?' references/ecl-schema.md` returns 0 (note the JSON-quoted key form; the prior null pattern is fully replaced). Both checks must hold to confirm 5-stage reconciliation.
6. **`ecl-schema.md` D6 source_kind/source_ref presence:** `grep -c "source_kind\\|source_ref" references/ecl-schema.md` returns ≥3 (entity / function-contract / data-contract sections all mention).
7. **`stage-playbook.md` D1 reconciliation:** Stage A section in `references/stage-playbook.md` lists exactly 6 flat fields matching `stage_schemas.preprocess.array_fields` keys + `reframed_goal`. The 13-field `approval_pack` wrapper from prior version is removed. `grep -c "user_stated_request\\|dubious_claims\\|approval_pack" references/stage-playbook.md` returns 0 in the Stage A section (or with explicit "agent-internal working data" caveat reference, not as required output fields).
8. **`handoff-quality-bar.md` D6 inline:** `grep -c "source_kind\\|source_ref" references/handoff-quality-bar.md` returns ≥3 (entity / function-contract / data-contract field lists all updated).

**Implementation verification:** `tests/test-stage-schemas-doc-drift.js` (new test file) exercises predicates 1-8 via `node:test` + `node:assert/strict` + `fs.readFileSync` on doc files + `JSON.parse` on `bonfire-v1.json` + grep equivalents via string ops. Tests are static doc-validation; no runtime pipeline involvement.

## 8. Phased contract

3b ships as **complete v0.1** for the 6 enumerated drift sites. Unlike 3a (5 phases) and round-4 (provisional threshold), 3b has no calibration cycle or staged ramp — drift sites are categorical (drift exists or it doesn't), not gradient.

**Phased extension contract (future-looking):**
- New stages added to `case.json#stages.*` and given render templates SHOULD have `stage_schemas.<id>` entries added at the same time (template + schema co-author convention).
- New fields added to existing render-bearing stages SHOULD update both `stage_schemas` and `ecl-schema.md` atomically. The lag pattern (P1) recurs if this discipline isn't enforced.
- 3b does NOT implement a runtime "stage_schemas drift detector" (out of mandate). A future assertion (3d-candidate or similar) may add validator-based enforcement that asserts `case.json#stages.<id>` field set is a subset of `stage_schemas.<id>.array_fields` keys.
- D6 source_kind/source_ref documentation depends on `handoff_substantive_slots._provenance_required` schema field. If runtime enforcement of provenance changes (e.g., 3a Phase 2 added the field, future may extend), `ecl-schema.md` + `handoff-quality-bar.md` must re-sync.

## 9. Backlog observations carried (not 3b scope)

- **D2/D3/D4 source_kind/source_ref runtime enforcement gap:** stage_schemas declares fields but does not validate them at runtime. Validator enforcement is OOS per mandate. Future-spec candidate.
- **Agent prompt regeneration:** if codegen-from-schema becomes desired, `agents/bonfire-j-compile.md` could derive its field-list sections from `stage_schemas.compile_output_companion`. OOS per mandate.
- **Renderer schema-driven enrichment:** RENDER ERROR could cite `stage_schemas.<id>` for friendlier message. OOS per mandate (S2.2).
- **F1 (cross-language-approved Layer 1 reject):** Stage 0 verdict isolated F1 from 3b (architectural enforcement decision, not schema-doc drift). Standalone item.
- **Lemmatizer `-ed` asymmetry:** No tokenization surface touched in 3b; defer to backlog (per Stage 0 verdict).
- **3c state-machine 半成品 candidate:** 4 findings cluster (challenged_claim status inconsistency, truth-discard non-transition, unit-id drop, annotate deadlock) — separate spec when triggered.

## 10. Deferred Questions

| ID | Status | Description |
|---|---|---|
| **DQ-1** | DEFERRED | **Probes preventive coverage validity:** `stage_schemas.probes` is included without dogfood drift evidence (template + playbook aligned). Bound by S2.1(c) "render-bearing stages not already captured elsewhere"; consistent inclusion criterion. If a future dogfood shows drift on probes, the preventive lock proved valuable; if not, it's harmless documentation. Spec-amend trigger: probes-stage drift evidence OR scope-trim review at next assertion drafting. |
| **DQ-2** | DEFERRED | **Non-render-bearing stages defer rationale:** `critique`, `red_blue`, `review`, `compile_for_code` (outside companion sections) remain `: null` in `case.json`. They're either dialectic outputs without stable schema (red_blue, review) or already covered elsewhere via `delta_schemas`/`verdict_substantive_check` (critique, h-review). 3b does NOT add stage_schemas entries for these. Spec-amend trigger: dogfood evidence for stable schema OR cross-assertion request. |
| **DQ-3** | DEFERRED | **Future runtime enforcement of stage_schemas:** declarative-only in 3b v0.1. A future assertion may extend `stage_schemas` to runtime-enforced (precedent: `delta_schemas` is both declarative + runtime-enforced via `validateDelta`). Trigger: dogfood evidence that operators continue to write fields not in `stage_schemas.<id>` despite doc sync. |
| **DQ-4** | DEFERRED | **Schema_version bump on declarative-only addition:** 3b v0.1 keeps `schema_version: 2` (Stage 2 S2.3 architect ratify). Convention: schema_version tracks runtime validator behavioral changes; declarative additions don't trigger bump. Future runtime enforcement extension (DQ-3) would justify the bump. |
| **DQ-5** | DEFERRED | **D6 source_kind/source_ref documentation surface:** chose inline addition to existing field lists in ecl-schema.md + handoff-quality-bar.md (S2.4(a) ratify). If a future cross-document index of provenance requirements becomes needed (e.g., "all fields with `_provenance_required: true` listed in one place"), separate "Provenance Requirements" section can be added. Currently S2.4(a) chosen for minimal disruption. |
| **DQ-6** | RESOLVED IN 3B | **Q1 source-of-truth choice:** ecl-schema.md vs agent prompts vs schema JSON vs templates. Resolved (c): `bonfire-v1.json` authoritative for field-level contracts; agent prompts remain prose-with-references; templates express rendering shape (not contracts); ecl-schema.md derives. |
| **DQ-7** | RESOLVED IN 3B | **Q2 D1 3-way split:** SKILL.md + template alliance authoritative; stage-playbook.md is the edit target. Process-artifact 13 fields dropped from playbook (Stage 1 dispatch (i)). |

## 11. Risks and Mitigations

**Risk 1 — Precedent creep: declarative-only convention erodes over time.**

Adding `stage_schemas` as declarative-only sets a precedent that `bonfire-v1.json` carries doc-source-of-truth content. Future contributors may add runtime-enforcement logic that consumes `stage_schemas` without explicit spec amendment, blurring the declarative/enforced boundary that mandate scope explicitly maintains.

- *Mitigation 1:* `stage_schemas._note` field literal: "Documentation-only ... not runtime-enforced". Future readers see the intent on first read.
- *Mitigation 2:* §4 mandate scope explicit "validator enforcement of stage_schemas at runtime — OUT". Spec is binding contract; runtime enforcement requires future assertion + spec amendment, not silent code change.
- *Mitigation 3:* DQ-3 explicitly catalogs runtime-enforcement as a future-spec trigger, so the path is named even though excluded.
- *Residual risk:* low. Codebase contributors typically respect spec boundaries when explicitly declared. Code-review process catches schema-driven enforcement drift.

**Risk 2 — Stale `stage_schemas` from agent prompt evolution.**

Agent prompts (`agents/bonfire-j-compile.md`) may add new fields to compile output without updating `stage_schemas.compile_output_companion`. P1 lag pattern recurs at agent-prompt-vs-schema layer.

- *Mitigation 1:* Phased contract clause (§8): "New fields added to existing render-bearing stages SHOULD update both stage_schemas and ecl-schema.md atomically." Discipline is documented as expected practice.
- *Mitigation 2:* Acceptance test §7 predicate 4 pins the specific fields enumerated in v0.1; field additions trigger test failure unless test is also updated, surfacing the schema-update gap.
- *Mitigation 3:* Future assertion candidate (DQ-3) for runtime enforcement closes this gap structurally.
- *Residual risk:* medium without future runtime enforcement. The discipline only holds as long as authors check spec contract. 3rd dogfood will reveal if discipline holds.

**Risk 3 — `ecl-schema.md` derivation drift if hand-maintained.**

3b does not implement codegen for `ecl-schema.md` from `stage_schemas`. The file is hand-maintained to derive content from schema. Future schema updates may not propagate to ecl-schema.md, restoring lag.

- *Mitigation 1:* Acceptance test §7 predicates 5 + 6 verify specific drift sites are closed at v0.1 implementation time; future drift detection is acceptance-test-dependent (predicates would need updating with schema changes).
- *Mitigation 2:* Phased contract clause (§8) explicitly names atomic update discipline.
- *Mitigation 3:* Future codegen tooling (out of 3b scope) could mechanize ecl-schema.md generation from `stage_schemas`. DQ-3 future-runtime-enforcement may include codegen as side-effect.
- *Residual risk:* medium. Hand-maintained docs drift over time; this is an industry-wide problem. 3b mitigates via specific drift-site closure but doesn't structurally solve.

**Risk 4 — Stage-playbook.md D1 reconciliation removes operator workflow guidance.**

Removing the 13-field "process artifacts" list from `stage-playbook.md` may make the operator unaware of stage-A internal working data. Operator confusion if they don't understand what intent-extractor / reality-checker / blind-spot-scout actually emit.

- *Mitigation 1:* §6.1 D1 resolution adds caveat note: "Stage A agents emit working data (dubious_claims, factual_gaps, etc.) — these inform approval pack but are not persisted to case.json#stages.preprocess." Operator gets the conceptual context without the 13-field schema confusion.
- *Mitigation 2:* `pre/SKILL.md` is the operator-facing workflow doc; it already describes the stage-A flow. Playbook is the schema-reference doc; separation of concerns.
- *Residual risk:* low. Operator following SKILL.md workflow is on the documented happy path; playbook is reference material.

## 12. Cross-references

**Specs:**
- `2026-04-18-bonfire-freeze-enforcement-design.md` (Assertion 1 — PR #2)
- `2026-04-18-bonfire-hj-seam-hardening-design.md` (Assertion 2 — PR #2)
- `2026-05-08-bonfire-assertion-3a-validation-theater-design.md` (Assertion 3a — completed 2026-05-09)
- `2026-05-10-bonfire-assertion-4-round-4-design.md` (Assertion 4 round-4 — completed 2026-05-10)

**Evidence:**
- `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` (1st dogfood — render-bug closure precedent for schema-doc drift surface)
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (2nd dogfood — primary 3b empirical anchor; 6 drift sites surfaced)

**Memory:**
- `bonfire-project-state.md` — assertion sequencing, 3a + round-4 closure context
- `dogfood-2026-05-04-findings.md` — render-bug closure (commits 64230c7 + dbfaab3) precedent + finding #1 closure via round-4
- `dogfood-2026-05-08-bilibili-danmaku-findings.md` — findings #2-5, #12-13 (3b problem evidence)
- `feedback-subagent-execution-discipline.md` — 7 lessons from 3a + round-4 (Lesson 4 algorithmic step-through, Lesson 5 architect-substitute, Lesson 7 schema-only data extension)

**Code (touched by 3b implementation):**
- `schemas/bonfire-v1.json` — new top-level `stage_schemas` section (per §6).
- `references/ecl-schema.md` — replace `: null` placeholders + add D5 companion + D6 source_kind/source_ref.
- `references/stage-playbook.md` — Stage A section reconciled to 6 flat fields per §6.1.
- `references/handoff-quality-bar.md` — D6 source_kind/source_ref inline in 3 field lists per §6.4.
- `tests/test-stage-schemas-doc-drift.js` (new) — acceptance test predicates 1-8 per §7.

---

**End of Assertion 3b v0.1 spec draft.**

Awaits architect dialectic review (author + reader 二角). Iterate to v0.1 freeze; entry to 3b plan creation phase upon freeze (parallel to round-4 plan-creation pattern).
