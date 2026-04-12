# Code-Stage Bundle Rendering Fix

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement the plan derived from this spec.

**Goal:** Fix 6 empty code-stage bundle files (91/92/95/96/98/99) by establishing strict contracts between J-Compile output, renderer templates, and schema selectors.

**Root cause:** Templates were written speculatively during Plan 5 before J-Compile existed. J-Compile produces reasonable but structurally different output. No validation catches the mismatch — empty files render silently.

**Design principle:** Strict contract + validation as algedonic signal. Deviation from schema produces visible errors, not silent empty output. No per-note preprocessors — one generic objectToArray fallback with warning logging.

---

## 1. Per-Note Canonical Schema

For each note, the canonical schema is chosen by comparing the Plan 5 template assumptions against actual J-Compile output and selecting the more reasonable structure.

### Note 91 — canonical-contracts

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#canonical_contracts` | `plan/compile-output.json#handoff` |
| Template fields | `{{#each function_contracts}}`, `{{#each file_plan}}` | No change — matches `handoff` structure |
| J-Compile output | `canonical_contracts` top-level key (TS interface map) | **Remove** `canonical_contracts` key entirely |

**Rationale:** `function_contracts` and `file_plan` already live under `handoff`. Note 90 (code-handoff) and note 91 both point to `#handoff` with different templates — two views projecting different facets of the same data source.

### Note 92 — constraint-crosswalk

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#constraint_crosswalk` | No change |
| Template fields | `{{#each mappings}}` with `.constraint_id`, `.content`, `.unit_ids`, `.verification` | `{{#each mappings}}` with `.constraint_id`, `.content`, `.unit_ids` |
| J-Compile output | Flat map `{"CON-001": ["unit-10",...]}` | Array `[{constraint_id, content, unit_ids}]` |

**Changes:**
- J-Compile MUST output `constraint_crosswalk` as `{mappings: [...]}` where each element is `{constraint_id, content, unit_ids}`
- Each mapping MUST include `content` (constraint text copied from truth surface snapshot)
- Drop `.verification` (redundant — verification lives in implementation_units)
- Template simplified to match

**Why a wrapper object:** The renderer does `data[arrayName]` for `{{#each mappings}}`. If the selector resolves to a bare array, there's no `mappings` key to look up. Wrapping in `{mappings: [...]}` keeps the template engine simple.

### Note 95 — execution-manifest

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#execution_manifest` | No change |
| Template fields | `{{#each phases}}` with nested `{{#each units}}` as objects | `{{#each waves}}` with flat `{{units}}` string |
| J-Compile output | `{description, waves: [{wave, units: [string], description}]}` | `{description, waves: [{wave, units: "unit-1, unit-2", description}]}` |

**Changes:**
- Template: `phases` → `waves`, `phase_number` → `wave`
- Template: `{{units}}` renders as a flat string (no nested `{{#each}}`)
- J-Compile MUST join units arrays into comma-separated strings within each wave
- Add top-level `{{description}}` rendering

**Why flatten units:** The renderer does not support nested `{{#each}}` — the non-greedy regex `([\s\S]*?)` matches the first `{{/each}}` it finds, breaking outer iteration. Rather than upgrading the renderer to a recursive parser (doubling its complexity), J-Compile pre-joins the units list. No other note requires nested iteration.

### Note 96 — code-batches

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#code_batches` | No change |
| Template fields | `{{#each batches}}` with `.batch_number`, `.title`, `.description`, `.unit_ids`, `.verification` | `{{#each batches}}` with `.batch_id`, `.description`, `.units` |
| J-Compile output | Named-key object `{batch_1_foundation: {units, description}}` | Array `[{batch_id, units, description}]` |

**Changes:**
- J-Compile MUST output `code_batches` as `{batches: [...]}` where each element is `{batch_id, units, description}`
- Template: `batch_number` → `batch_id`, drop `.title` and `.verification`, `unit_ids` → `units`

**Why a wrapper object:** Same as note 92 — `{{#each batches}}` needs `data.batches` to resolve.

### Note 98 — compile-for-code (stage-j.md)

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#compile_summary` | No change |
| Template fields | `{{summary}}`, `{{code_ready}}`, `{{#each blockers}}` | No change |
| J-Compile output | Plain string | Object `{summary, code_ready, blockers}` |

**Changes:**
- J-Compile MUST output `compile_summary` as an object, not a string

### Note 99 — final-handoff

| Aspect | Before | After |
|--------|--------|-------|
| Schema selector | `plan/compile-output.json#final_handoff` | No change |
| Template fields | `{{statement}}`, `{{status}}` | No change |
| J-Compile output | Plain string | Object `{statement, status}` |

**Changes:**
- J-Compile MUST output `final_handoff` as an object, not a string

---

## 2. Renderer Changes

### 2.1 Generic objectToArray adapter

**Location:** `renderTemplate()` in `bin/lib/renderer.cjs`

**Behavior:** When `{{#each X}}` encounters a non-array object, convert it to an array using these rules:

| Input shape | Output |
|-------------|--------|
| `{k: {a, b, ...}}` | `[{key: k, a, b, ...}]` |
| `{k: [...]}` | `[{key: k, items: [...]}]` |
| `{k: "str"}` | `[{key: k, value: "str"}]` |

**This is a fallback safety net, not a normal path.** When triggered, log a warning to `render.log`:

```
objectToArray fallback triggered for field "X" in note "Y"
```

This is a soft algedonic signal — it makes visible which notes depend on the fallback rather than receiving correctly-shaped data from J-Compile.

### 2.2 Validation: undefined vs empty

**Location:** `renderTemplate()` in `bin/lib/renderer.cjs`

After resolving source data but before rendering, validate field presence:

- **Field does not exist** (`undefined` or `null`) → Write render error into output:
  ```
  <!-- RENDER ERROR: [note-id] missing required field "X" in source data -->
  ```
- **Field exists but is empty** (`[]` or `""`) → Normal render (produces empty section, which is correct)

**Implementation:** Scan the template for `{{#each X}}` and `{{X}}` references. For each reference, check if the corresponding field exists in the resolved data. If any `{{#each X}}` field is `undefined`/`null`, replace that block with the error comment. If any `{{X}}` field is `undefined`/`null`, replace the placeholder with the error comment.

### 2.3 Array field rendering

**Location:** `renderTemplate()` field substitution in `bin/lib/renderer.cjs`

When a `{{field}}` resolves to an array, render it as `val.join(', ')` instead of `String(val)` (which produces `"a,b,c"` without spaces).

This affects Note 92 `{{unit_ids}}` and Note 96 `{{units}}` where unit ID arrays render inline.

---

Note: existing `preprocessData` functions (constraint-ledger, overview) remain as-is. They are structural transformations of bonfire's own data, not compensators for agent output variance.

---

## 3. J-Compile Agent Prompt Changes

**File:** `agents/bonfire-j-compile.md`

### 3.1 Remove `canonical_contracts` key

Delete from `output_format`. The data it contained (TS interfaces) already exists in `handoff.data_contract`.

### 3.2 Update companion section schemas

Replace vague `{ "description" }` placeholders with MUST-level structural contracts:

```json
{
  "constraint_crosswalk": {
    "mappings": [
      {
        "constraint_id": "CON-001",
        "content": "Constraint text from truth surface",
        "unit_ids": ["unit-1", "unit-2"]
      }
    ]
  },
  "execution_manifest": {
    "description": "Overall execution strategy",
    "waves": [
      {
        "wave": 1,
        "units": "unit-1, unit-2",
        "description": "Wave description"
      }
    ]
  },
  "code_batches": {
    "batches": [
      {
        "batch_id": "batch_1_foundation",
        "units": ["unit-1", "unit-2"],
        "description": "Batch purpose"
      }
    ]
  },
  "compile_summary": {
    "summary": "Summary of compilation process",
    "code_ready": true,
    "blockers": []
  },
  "final_handoff": {
    "statement": "Readiness statement",
    "status": "code_ready"
  }
}
```

### 3.3 Add MUST language

Add to `<rules>`:
> Each companion section MUST match the exact structure shown in output_format. The renderer validates field presence — structural deviations produce visible RENDER ERROR markers in bundle output.

---

## 4. Schema Changes

**File:** `schemas/bonfire-v1.json`

Change note 91 source selector:
```
"source": "plan/compile-output.json#canonical_contracts"
→
"source": "plan/compile-output.json#handoff"
```

All other note selectors remain unchanged.

---

## 5. Template Changes

### templates/canonical-contracts.md
No change. `{{#each function_contracts}}` and `{{#each file_plan}}` already match `handoff` structure.

### templates/constraint-crosswalk.md
```markdown
# Constraint Crosswalk

← [[90-code-handoff]] | See also: [[05-constraint-ledger]]

## Constraint to Unit Mapping

{{#each mappings}}
### {{constraint_id}}

**Constraint:** {{content}}
**Implemented by:** {{unit_ids}}
{{/each}}
```

### templates/execution-manifest.md
```markdown
# Execution Manifest

← [[90-code-handoff]]

{{description}}

## Execution Order

{{#each waves}}
### Wave {{wave}}: {{description}}

**Units:** {{units}}
{{/each}}
```

### templates/code-batches.md
```markdown
# Code Batches

← [[90-code-handoff]]

## Batches

{{#each batches}}
### {{batch_id}}

{{description}}

**Units:** {{units}}
{{/each}}
```

### templates/stage-j.md (compile-for-code)
No change. Fields `{{summary}}`, `{{code_ready}}`, `{{#each blockers}}` match the new object schema.

### templates/final-handoff.md
No change. Fields `{{statement}}`, `{{status}}` match the new object schema.

---

## 6. Testing

### Existing tests
All 98 existing tests must continue to pass. The render smoke tests in `tests/test-smoke.js` exercise the golden test case, not compile-output.json notes — they should be unaffected.

### New tests

1. **objectToArray fallback test** — Verify that `renderTemplate` with `{{#each X}}` where X is an object produces correct array output and logs warning.

2. **Validation: undefined field** — Verify that `renderTemplate` with `{{field}}` where field is undefined produces `<!-- RENDER ERROR ... -->` in output.

3. **Validation: empty field** — Verify that `renderTemplate` with `{{#each X}}` where X is `[]` produces empty string (not error).

4. **Note 92 array rendering** — Render constraint-crosswalk template with correct array data, verify output contains constraint text.

5. **Note 95 waves rendering** — Render execution-manifest template with waves data, verify output.

6. **Note 96 batches array rendering** — Render code-batches template with array data, verify output.

7. **Note 98 object rendering** — Render stage-j template with `{summary, code_ready, blockers}` object, verify output.

8. **Note 99 object rendering** — Render final-handoff template with `{statement, status}` object, verify output.

9. **Array field join** — Verify that `{{field}}` where field is `["a", "b", "c"]` renders as `"a, b, c"` (with spaces).

---

## 7. Files Modified

| File | Change |
|------|--------|
| `schemas/bonfire-v1.json` | Note 91 selector: `#canonical_contracts` → `#handoff` |
| `bin/lib/renderer.cjs` | objectToArray fallback + undefined field validation + array join in field substitution |
| `agents/bonfire-j-compile.md` | Remove canonical_contracts, add strict schemas, MUST language |
| `templates/constraint-crosswalk.md` | Simplify to `{constraint_id, content, unit_ids}` |
| `templates/execution-manifest.md` | `phases` → `waves`, simplify units to primitives |
| `templates/code-batches.md` | `batch_number` → `batch_id`, simplify fields |
| `tests/test-render.js` (new) | 8 new render contract tests |
