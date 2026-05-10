# Bonfire Schema Reference

## Case JSON Structure

`case.json` is the aggregate container for all stage outputs. Parent skill writes to it after each stage completes.

```json
{
  "bundle_version": 1,
  "title": null,
  "created_at": "2026-04-10T09:00:00Z",
  "source_request": "raw request text",
  "project_paths": { "root": "/path/to/target/repo" },
  "stages": {
    "preprocess": "<see stage_schemas.preprocess>",
    "divergence": "<see stage_schemas.divergence>",
    "requirements": "<see stage_schemas.requirements>",
    "critique": null,
    "closure": "<see stage_schemas.closure>",
    "probes": "<see stage_schemas.probes>",
    "red_blue": null,
    "review": null,
    "compile_for_code": null
  }
}
```

`case.json` is NOT watched by the dual-write hook. Parent skill explicitly calls `bonfire-tools.cjs render --note <stage>` after writing stage data.

## Stage Output Schemas

Authoritative source: `bonfire-v1.json#stage_schemas` (documentation-only; not runtime-enforced in 3b v0.1).

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

### Stage B — Divergence (`stages.divergence`)

**Authoritative source:** `bonfire-v1.json#stage_schemas.divergence`

Array fields:
- `options` — object array; item fields: `title`, `description`, `blind_spots_covered`, `retained_option`

### Stage C — Requirements (`stages.requirements`)

**Authoritative source:** `bonfire-v1.json#stage_schemas.requirements`

Array fields:
- `requirement_units` — object array; item fields: `id`, `title`, `description`, `success_criteria`, `depends_on`

### Stage E — Closure (`stages.closure`)

**Authoritative source:** `bonfire-v1.json#stage_schemas.closure`

Array fields:
- `dependency_chain` — object array; item fields: `id`, `description`, `upstream`, `downstream`
- `resolved_gaps` — string array

### Stage F — Probes (`stages.probes`)

**Authoritative source:** `bonfire-v1.json#stage_schemas.probes`

Note: Preventive coverage — no current drift evidence; template + playbook aligned. Lock schema to prevent future drift.

Array fields:
- `probes` — object array; item fields: `hypothesis`, `method`, `expected_signal`, `kill_criteria`, `result`

## State JSON Structure

`state.json` tracks pipeline progress. See Section 3 of the design spec for full schema.

Key fields:

- `pipeline_stage`: current pipeline (`pre`, `plan`, `code`, `achieve`)
- `current_step`: convenience field (steps map is authoritative)
- `steps`: map of step name → `{ status, started_at?, passed_at? }`
- `approval`: Stage A approval state
- `reentry`: depth, max_depth, history
- `pending_reentry`: cross-skill reentry signal (null or object)
- `runs`: current_run_id, completed_runs

## Compile Output / Handoff Structure

`compile-output.json` is the single J-Compile output containing all handoff data.

### Required Handoff Fields

`compile-output.json#handoff` must contain:

- `code_ready`: boolean
- `handoff_summary`: string
- `retained_goal`: string
- `implementation_scope`: string
- `repo_targets`: array
- `repo_grounding`: object
- `read_first`: array
- `frozen_product_decisions`: array
- `domain_model`: object
  - **Provenance fields on each entity:** `source_kind` + `source_ref` required per `handoff_substantive_slots._provenance_required`. See Function Contract Fields above for type definitions.
- `data_contract`: object
  - **Provenance fields on data_contract:** `source_kind` + `source_ref` required per `handoff_substantive_slots._provenance_required`. See Function Contract Fields above for type definitions.
- `ui_contract`: object
- `function_contracts`: array
- `file_plan`: array
- `implementation_units`: array (non-empty)
- `verification_commands`: array
- `browser_checks`: array
- `acceptance_checks`: array
- `allowed_decisions`: array
- `forbidden_decisions`: array
- `reentry_triggers`: array
- `unresolved_gaps`: array (must be empty for code_ready=true)

### Function Contract Fields

Each function contract should include:

- `id`, `name`, `kind`, `location`, `signature`
- `purpose`, `inputs`, `outputs`
- `side_effects`, `invariants`, `failure_modes`
- `source_kind` — string; one of `ledger_direct` | `condition_rewrite`. Required when `_provenance_required: true` in `bonfire-v1.json#handoff_substantive_slots`. Runtime-enforced by `validateProvenance` in `bin/lib/schema.cjs`.
- `source_ref` — string (`ledger_direct`) or `{condition_index: <number>}` (`condition_rewrite`). Required alongside `source_kind`.

### File Plan Fields

Each file-plan item should include:

- `path`, `action`, `why`, `depends_on`

### Implementation Unit Fields

Each implementation unit should include:

- `id`, `title`, `objective`, `scope`
- `files`, `functions`, `depends_on`
- `verification`, `done_when`

### Other Compile Output Sections

- `canonical_contracts`: extracted contract definitions
- `constraint_crosswalk`: constraint → implementation unit mapping
- `execution_manifest`: dependency-ordered execution plan
- `code_batches`: grouped implementation batches
- `code_preflight`: shared execution workboard
- `compile_summary`: compilation process summary
- `final_handoff`: final readiness statement

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

## Code Preflight Fields

`compile-output.json#code_preflight` is the shared execution workboard.

### Immutable Fields (set by J-Compile, rejected by preflight-update)

- `confirmed_repo_facts`
- `do_not_reinterpret`
- `do_first`
- `context_bundle`

### Mutable Fields (updated during /code via preflight-update)

- `current_focus`
- `progress_snapshot`
- `remaining_work`
- `session_notes`
- `blockers`
- `pause_conditions`

## Truth Surface Snapshot Structure

`constraint-ledger-snapshot.json` — regenerated from history replay.

```json
{
  "version": 1,
  "replayed_at": "...",
  "event_count": 12,
  "entries": {
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "status": "FROZEN",
      "content": "...",
      "rationale": "...",
      "source": "stage-c",
      "challenged_by": ["d-critique", "g-red"],
      "aligned_by": ["g-blue"],
      "frozen_at": "..."
    }
  },
  "by_status": { "proposed": [], "challenged": [], "frozen": [], "superseded": [], "open": [], "discarded": [] },
  "by_category": { "retained_goal": [], "confirmed_fact": [], ... }
}
```

## Achieve Fields

`runs/<run-id>/achieve.json` must contain:

- `verdict`: achieved | achieved_with_followups | not_achieved
- `acceptance_results`: array of { check, result }
- `followups`: array (for achieved_with_followups)
- `failure_reason`: string or null
- `judged_at`: timestamp

## Reentry Route Table

Defined in `bonfire-v1.json`. Shared by H-Review and Evaluator.

| Conflict Type | Target Step | Crosses Pipeline |
|--------------|-------------|-----------------|
| goal_conflict | stage-a | yes |
| scope_conflict | stage-b | no |
| requirement_conflict | stage-c | no |
| critique_gap | stage-d | no |
| dependency_gap | stage-e | no |
| probe_invalidated | stage-f | no |
| adversarial_unresolved | stage-g | no |
| handoff_incomplete | stage-h | no |
| handoff_contradiction | stage-j | no |

## CLI Command Reference

See `bonfire-tools.cjs --help` or the design spec Section 6 for the full 31-command reference.
