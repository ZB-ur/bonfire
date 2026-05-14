# Bonfire Plan 4: References + Agent Definitions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the 9 reference playbook files and 10 agent definition files that skills and agents read at runtime for behavioral contracts and role instructions.

**Architecture:** Reference files (`references/*.md`) define behavioral contracts for pipeline stages, agent protocols, handoff quality, and execution rules. Agent files (`agents/*.md`) define agent roles with YAML frontmatter (name, description, tools) and body sections (role, rules, delta_schema, input). All files are pure markdown — no Node.js code changes in this plan.

**Tech Stack:** Markdown files only. No code changes.

**Spec:** `docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md` — Sections 4, 7, 8.

**Depends on:** Plans 1-3 (completed) — CLI, truth surface, state machine, renderer, delta-parser, schema validation.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `references/stage-playbook.md` | A→J stage execution rules and exit gates |
| Create | `references/subagent-protocol.md` | Agent independence rules, delta JSON format, tool permissions |
| Create | `references/handoff-quality-bar.md` | code_ready=true freeze conditions |
| Create | `references/code-playbook.md` | /code strict execution rules |
| Create | `references/achieve-playbook.md` | Acceptance closure rules |
| Create | `references/approval-gate.md` | Stage A approval gate rules |
| Create | `references/ecl-schema.md` | Case JSON + handoff structure definitions |
| Create | `references/obsidian-layout.md` | Render output folder layout spec |
| Create | `references/diagnosis-and-observability.md` | Bug/regression diagnosis guidance |
| Create | `agents/bonfire-intent-extractor.md` | Stage A support: infer real goals |
| Create | `agents/bonfire-reality-checker.md` | Stage A support: repo reality check |
| Create | `agents/bonfire-blind-spot-scout.md` | Stage A support: blind spot scan |
| Create | `agents/bonfire-d-critique.md` | Stage D: independent requirement attack |
| Create | `agents/bonfire-g-red.md` | Stage G: red team attack |
| Create | `agents/bonfire-g-blue.md` | Stage G: blue team defense |
| Create | `agents/bonfire-h-review.md` | Stage H: code-readiness verdict |
| Create | `agents/bonfire-j-compile.md` | Stage J: compile to code handoff |
| Create | `agents/bonfire-coder.md` | /code: execute implementation units |
| Create | `agents/bonfire-evaluator.md` | /code: verify implementation units |

---

### Task 1: Stage Playbook + Approval Gate

**Files:**
- Create: `references/stage-playbook.md`
- Create: `references/approval-gate.md`

- [ ] **Step 1: Create references/ directory**

```bash
mkdir -p references
```

- [ ] **Step 2: Write stage-playbook.md**

Create `references/stage-playbook.md` with the following content:

```markdown
# Stage Playbook

## Shared Constraint Ledger

`05-constraint-ledger.md` is the single source of truth for all semantic categories:

- retained_goal
- confirmed_fact
- frozen_constraint
- challenged_claim
- discarded_option
- high_impact_risk
- dependency_chain
- acceptance_semantic

The constraint ledger snapshot (`constraint-ledger-snapshot.json`) is the machine-readable form. Agents read the snapshot. Humans read the rendered markdown.

After Stage A approval closes, user interaction should drop sharply. Stages B–H and J should converge in the background unless a new high-impact ambiguity or contradiction appears.

## A / Preprocess

- Treat the raw request as unreliable input.
- Inspect repo and workspace facts before asking the user anything.
- Extract the likely real goal.
- Assume the user may not understand their own real goal, constraints, or desired outcomes yet.
- Surface ambiguity, wrong assumptions, missing facts, hidden preferences, anti-goals, and unstated constraints.
- Produce clarification questions that maximize semantic coverage before approval.
- Interrogate across examples, counterexamples, workflows, priorities, tradeoffs, failure handling, edge cases, and acceptance meaning.
- Stop after producing an approval-ready reframing package with saturated semantic coverage.

Support agents (optional, parallel + serial):

1. **intent-extractor** + **reality-checker** (parallel): infer goals, check repo facts
2. **blind-spot-scout** (serial, after intent-extractor): scan for unconsidered dimensions

Required output fields in `case.json#stages.preprocess`:

- `user_stated_request`
- `ambiguity_points`
- `dubious_claims`
- `factual_gaps`
- `hidden_assumptions`
- `suspected_real_goals`
- `scenario_fragments`
- `success_signals`
- `non_goals`
- `follow_up_questions`
- `blocking_unknowns`
- `reframed_request`
- `approval_pack`

Exit gate:

- The request has been reframed around the likely real goal.
- The user has been questioned enough that hidden product meaning is unlikely to surprise later stages.
- The approval pack has been shown to and explicitly approved by the user.

## B / Divergence

- Generate >= 3 materially different options, not style variants.
- Make each option explain which blind spots it covers.
- Retain exactly one path.
- Write to `case.json#stages.divergence`.

Exit gate: >= 3 options generated, exactly 1 retained.

## C / Requirements

- Decompose the retained path into requirement units.
- Freeze implementation-relevant semantics.
- Shape requirement units so they map cleanly into implementation units.
- Identify interfaces, validation targets, and non-goals.
- Batch `truth-propose`: retained_goal, frozen_constraint, dependency_chain, acceptance_semantic.
- Write to `case.json#stages.requirements`.

Exit gate: all requirement units have success criteria.

## D / Critique

- Spawn `bonfire-d-critique` agent.
- Agent attacks vague, contradictory, or wasteful requirements.
- Agent returns delta JSON with challenges >= 1.
- Parent integrates: `truth-propose` (proposals), `truth-update challenged_by` (challenges).

Exit gate: delta validated, >= 1 challenge integrated into truth surface.

## E / Closure

- Parent executes (no agent).
- Complete the end-to-end dependency chain.
- Convert resolved dependencies into a dependency-aware execution chain.
- Remove hidden prerequisites between planned units.

Exit gate: all `dependency_chain` entry refs valid.

## F / Probes

- Parent executes (no agent).
- Run real executable validation whenever possible.
- Prefer repo inspection, scripts, tests, experiments, and environment checks.
- Record hypothesis, method, expected signal, kill criteria, and result.
- Write to `case.json#stages.probes`.

Exit gate: all probes have results or inability-to-probe records.

## G / Red-Blue

- Spawn `bonfire-g-red` agent, then `bonfire-g-blue` agent (sequential).
- G-Red attacks edge cases, abuse paths, dependency breaks, and invalid states.
- G-Blue mitigates, constrains, or explicitly accepts residual risk.
- Parent integrates deltas into truth surface.
- Truth-Freeze Gate (part of stage-g exit): scan CHALLENGED entries, freeze those meeting maturity gate. `high_impact_risk` stays OPEN.

Exit gate: red/blue complete + residual risks recorded + all mature CHALLENGED entries frozen.

## H / Review

- Spawn `bonfire-h-review` agent.
- Agent writes `h-review-verdict.json` directly.
- Reject the package if the next coder would still need to invent product meaning, validation meaning, state behavior, or dependency behavior.
- Parent executes verdict rulings (freeze/supersede).

Verdict routing:

| Verdict | Next |
|---------|------|
| `approved` | Proceed to stage-j |
| `approved_with_conditions` | Conditions injected into J-Compile prompt, proceed |
| `rejected` | `conflict_type` → route table → reentry |

## J / Compile For Code

- Spawn `bonfire-j-compile` agent.
- Agent writes `compile-output.json` directly (single JSON).
- Absorb the retained A–H result into a frozen code-ready package.
- Compile execution phases, code batches, and implementation units in dependency order.
- Compile `code_preflight` as the shared execution workboard.
- Keep `handoff` as the only truthful `/code` entrypoint.
- Renderer splits compile-output.json into 8 bundle markdown files.

Exit gate: `compile-output.json` passes `handoff-validate`, `code_ready=true`.

## Code Handoff Freeze Surface

The handoff must freeze:

- approval basis
- repo grounding
- frozen product decisions
- domain/data/UI contracts
- function-level contracts
- file plan
- implementation units
- verification commands
- browser checks
- acceptance checks

`code_ready=true` is allowed only when all of the above are explicit and `unresolved_gaps` is empty.

Each implementation unit must also freeze:

- exact changes
- task-ready done signals
- tests to add or update

## /code

- Read only the handoff + code_preflight + current unit definition.
- Execute in unit order.
- Verify as you go (coder/evaluator adversarial loop).
- Stop and reenter planning if semantics are still missing.
```

- [ ] **Step 3: Write approval-gate.md**

Create `references/approval-gate.md` with the following content:

```markdown
# Approval Gate

Use this reference during `/bonfire:pre` Stage A.

## Purpose

Turn a raw user idea into an approved, frozen planning target before stages B–J converge the full bundle.

## Rules

- Audit the request before trusting it.
- Search local repo reality before asking the user to restate information that is already discoverable.
- Treat the user's description as low-reliability evidence: they may be unsure, contradictory, solution-biased, or unaware of their own hidden requirements.
- Do not optimize for fewer questions. Use Stage A to aggressively gather meaning while user interaction is still allowed.
- Ask broad but concrete clarification questions across goals, non-goals, examples, anti-examples, workflows, priorities, tradeoffs, failure cases, data semantics, UI states, and acceptance expectations.
- Stop asking only when the remaining unknowns are truly low-impact implementation details rather than latent product semantics.

## Truth Surface Actions During Stage A

As answers come in, the parent skill should:

- `truth-propose confirmed_fact` for verified repo/environment facts (from reality-checker)
- `truth-propose challenged_claim` for dubious user claims
- `truth-propose retained_goal` for confirmed user goals
- `truth-propose acceptance_semantic` for acceptance criteria

## Approval Pack

Before entering stages B–J, present a short approval pack containing:

- `reframed_goal`: the product or change you now believe the user actually wants
- `retained_scope`: what will be delivered in this pass
- `excluded_scope`: what will not be delivered in this pass
- `critical_assumptions`: the assumptions that materially affect semantics
- `frozen_for_code`: the decisions `/code` will treat as fixed truth

## Exit Rule

Do not continue to `/bonfire:plan` until the user has explicitly approved the approval pack.

If the user responds with changes, update the approval pack and ask for approval again.

After the user approves:

- `truth-freeze` all `confirmed_fact` entries
- `truth-propose` remaining `retained_goal` and `acceptance_semantic` entries
- `state-step --step stage-a --status passed`
- `state-advance --step stage-a`

Output: "Stage A passed. Please execute /bonfire:plan"
```

- [ ] **Step 4: Commit**

```bash
git add references/stage-playbook.md references/approval-gate.md
git commit -m "docs: add stage-playbook and approval-gate references"
```

---

### Task 2: Subagent Protocol

**Files:**
- Create: `references/subagent-protocol.md`

- [ ] **Step 1: Write subagent-protocol.md**

Create `references/subagent-protocol.md` with the following content:

```markdown
# Subagent Protocol

## Contents

- General rules
- Agent categories
- Delta JSON schema
- Per-agent constraints
- Tool permissions
- Output capture flow
- Failure handling

## General Rules

- D, G-Red, G-Blue, H, and J require real spawned agents (Claude Code `Agent()` tool).
- A may use support agents, but the parent skill remains the owner of preprocessing.
- Pass only stage-local context to agents:
  - constraint-ledger-snapshot.json (current truth surface state)
  - relevant source artifacts (case.json sections, agent deltas)
  - local repo/docs/config facts needed for that stage
- Do not pass the parent's preferred answer to independent agents.
- Parent skill is the only writer to truth surface and bundle notes (Father Model).
- Agents return structured JSON deltas only. They do not return finished notes or markdown.

## Agent Categories

### Support Agents (Stage A)

| Property | Value |
|----------|-------|
| Required? | Optional (parent can complete A alone) |
| Parallelism | intent-extractor + reality-checker parallel, then blind-spot-scout serial |
| Delta validation | Lenient (no "required >= 1" constraint) |
| Output destination | Merged into question list, no direct truth surface mutation |

### Independent Agents (D/G/H/J)

| Property | Value |
|----------|-------|
| Required? | Required (cannot skip) |
| Parallelism | Strictly sequential: D → G-Red → G-Blue → H → J |
| Delta validation | Strict (per-agent constraint table below) |
| Output destination | Parent executes truth surface mutations from delta |

## Delta JSON Schema

All independent agents (D/G-Red/G-Blue) output a JSON object with this shape:

```json
{
  "agent": "<agent-name>",
  "proposals": [
    {
      "id": "CON-007",
      "category": "frozen_constraint",
      "content": "...",
      "rationale": "..."
    }
  ],
  "challenges": [
    { "target": "CON-003", "reason": "..." }
  ],
  "alignments": [
    { "target": "CON-001", "evidence": "..." }
  ],
  "follow_up_questions": [
    "..."
  ]
}
```

Validation is performed by `bonfire-tools.cjs delta-validate --agent <name>`.

## Per-Agent Delta Constraints

| Agent | proposals | challenges | alignments | follow_up | verdict |
|-------|-----------|------------|------------|-----------|---------|
| D-Critique | allowed | **required >= 1** | allowed | allowed | — |
| G-Red | allowed | **required >= 1** | — | allowed | — |
| G-Blue | allowed | — | **required >= 1** | allowed | — |
| H-Review | — | — | — | — | **required** |
| J-Compile | — | — | — | — | produces compile-output.json |

"Required" means `delta-validate` rejects the output if the field is missing or empty.

## Tool Permissions

| Agent | Read | Bash | Write | Glob | Grep |
|-------|------|------|-------|------|------|
| D-Critique | yes | no | no | yes | yes |
| G-Red | yes | no | no | yes | yes |
| G-Blue | yes | no | no | yes | yes |
| H-Review | yes | no | yes (h-review-verdict.json only) | yes | yes |
| J-Compile | yes | no | yes (compile-output.json only) | yes | yes |
| Coder | yes | yes | yes | yes | yes |
| Evaluator | yes | yes | yes (evaluator-verdict.json only) | yes | yes |

D/G-Red/G-Blue have no Write permission. They return delta JSON through the Agent() return value. Parent persists it.

## Output Capture Flow

### D/G-Red/G-Blue (no Write permission)

1. `Agent()` returns JSON text
2. Parent: `JSON.parse()` → delta object
3. Parent: `bonfire-tools.cjs delta-validate --agent <name>` (pure schema check)
4. Parent: write raw JSON to `.bonfire/plan/<agent-name>-delta.json` (audit)
5. Parent: execute truth surface mutations based on delta

### H-Review (Write permission for verdict only)

1. Agent writes `.bonfire/plan/h-review-verdict.json` directly
2. Parent: read → `JSON.parse()` → `delta-validate --agent bonfire-h-review`
3. Parent: execute rulings (freeze/supersede)

### J-Compile (Write permission for compile-output only)

1. Agent writes `.bonfire/plan/compile-output.json` directly
2. Parent: read → `JSON.parse()` → `handoff-validate`
3. Dual-write hook → renderer splits into 8 markdown files in bundle/

## Failure Handling

- If a required agent cannot be spawned or times out:
  - Log: `bonfire-tools.cjs log-agent --event failed --agent <name> --step <step> --error <text>`
  - Set step status: `state-step --step <step> --status gate_failed`
  - Do not proceed to dependent stages.
  - Report to user with guidance on retrying.

- If agent output fails delta validation:
  - Log the validation errors.
  - Retry the agent once with validation feedback.
  - If second attempt also fails: `state-step --step <step> --status gate_failed`.

## Agent ID Collision Prevention

On reentry, agents use `-R<depth>` suffix for new IDs to avoid collisions with prior run IDs:

- First pass: `CON-001`, `CON-002`, ...
- Reentry depth 1: `CON-003-R1`, `CON-004-R1`, ...
- Reentry depth 2: `CON-005-R2`, ...
```

- [ ] **Step 2: Commit**

```bash
git add references/subagent-protocol.md
git commit -m "docs: add subagent-protocol reference"
```

---

### Task 3: Handoff Quality Bar + ECL Schema

**Files:**
- Create: `references/handoff-quality-bar.md`
- Create: `references/ecl-schema.md`

- [ ] **Step 1: Write handoff-quality-bar.md**

Create `references/handoff-quality-bar.md` with the following content:

```markdown
# Handoff Quality Bar

Use this reference before setting `code_ready=true` in `compile-output.json#handoff`.

## Core Rule

The handoff is code-ready only if the next coder agent can implement without inventing high-impact meaning.

If the coder would still need to ask what the product means, how data should behave, or how success is judged, the handoff is not ready.

## Required Freeze Surface

The handoff must explicitly freeze:

- `repo_grounding`: repo facts that the plan depends on
- `frozen_product_decisions`: high-impact product semantics that may not drift
- `domain_model`: key entities, fields, states, and invariants
- `data_contract`: persistence or API behavior, even if the answer is "browser local state only"
- `ui_contract`: routes, panels, forms, views, and empty/error/loading states
- `function_contracts`: the concrete functions or modules the coder must create or modify
- `file_plan`: file-by-file change plan
- `implementation_units`: ordered execution units
- `verification_commands`: command-level checks
- `browser_checks`: user-visible walkthrough checks
- `acceptance_checks`: what must be true to call the work done

## Implementation Unit Bar

Every implementation unit must answer:

- what it changes
- why it exists
- which files it owns
- which functions or modules it creates or edits
- which earlier units it depends on
- how the coder verifies it before moving on
- what "done" means for that unit

## Web App Quality Bar

For React, Next.js, or Vite work, also freeze:

- state ownership
- optimistic or pessimistic persistence behavior
- copy for visible failure states
- browser interactions that must work on first open
- whether tests alone are sufficient or a browser pass is mandatory
- the exact visible UI pattern, not a disjunction such as "grouped or labeled"

## Failure Rule

If any of the above is left to "implementer decides", `code_ready` must remain `false`.

## Validation

The bonfire CLI validates handoff structure:

```bash
bonfire-tools.cjs handoff-validate
```

Required fields: `code_ready`, `handoff_summary`, `retained_goal`, `implementation_scope`, `implementation_units` (non-empty array).
```

- [ ] **Step 2: Write ecl-schema.md**

Create `references/ecl-schema.md` with the following content:

```markdown
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
    "preprocess": null,
    "divergence": null,
    "requirements": null,
    "critique": null,
    "closure": null,
    "probes": null,
    "red_blue": null,
    "review": null,
    "compile_for_code": null
  }
}
```

`case.json` is NOT watched by the dual-write hook. Parent skill explicitly calls `bonfire-tools.cjs render --note <stage>` after writing stage data.

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
- `data_contract`: object
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
```

- [ ] **Step 3: Commit**

```bash
git add references/handoff-quality-bar.md references/ecl-schema.md
git commit -m "docs: add handoff-quality-bar and ecl-schema references"
```

---

### Task 4: Code Playbook + Achieve Playbook

**Files:**
- Create: `references/code-playbook.md`
- Create: `references/achieve-playbook.md`

- [ ] **Step 1: Write code-playbook.md**

Create `references/code-playbook.md` with the following content:

```markdown
# Code Playbook

Use this playbook during `/bonfire:code`. The code stage exists to execute a frozen handoff, not to reinterpret product intent.

## Entry Conditions

Enter `/code` only when all of the following are true:

- `state.json` pipeline_stage is `plan` and `stage-j` status is `passed`
- No `pending_reentry` exists in state.json
- `compile-output.json#handoff.code_ready` is `true`
- The referenced repo target exists
- The handoff has no unresolved high-impact gaps (`unresolved_gaps` is empty)

If any gate fails:

- Do not modify the repo.
- Log the failure.
- Report to user with guidance.

## Handoff Surface That Must Already Be Frozen

Before coding starts, confirm the handoff explicitly contains:

- `repo_grounding`
- `frozen_product_decisions`
- `domain_model`
- `data_contract`
- `ui_contract`
- `function_contracts`
- `file_plan`
- `implementation_units`
- `verification_commands`
- `browser_checks`
- `acceptance_checks`

## Allowed Decisions

The coder may decide only low-impact engineering details:

- Helper decomposition inside already frozen scope
- Import wiring and local variable names
- Package lockfile updates
- Tiny file placement details that do not change behavior

## Forbidden Decisions

The coder must NOT decide:

- User goal meaning
- Frozen product semantics
- Data or state behavior omitted by planning
- Validation meaning
- Success criteria
- Dependency behavior
- Review conditions
- Acceptance semantics
- Visible UI choices that the handoff still phrases as alternatives

## Required Reading

The coder reads only:

- `compile-output.json#handoff` (frozen, read-only)
- `compile-output.json#code_preflight` (active workboard)
- Current unit definition (function_contracts, file_plan, done_when)
- Previous evaluator feedback (if retry iteration)
- `@references/code-playbook.md` (this file)
- Target repo files needed to execute the frozen units

The coder does NOT read:

- `bundle/` markdown files
- `plan/` agent delta files
- `truth-surface/` files
- Stage notes or case.json directly

## Execution Rules

1. **Initialize**: `state-begin-run --run-id run-<timestamp>`, `state-init-code-steps`
2. **Execute in order**: follow `implementation_units` order exactly, do not skip or reorder
3. **Verify incrementally**: coder implements, evaluator verifies, per-unit adversarial loop
4. **Sync workboard**: `preflight-update` after each unit completes
5. **Atomic commits**: git commit after each unit passes (unit-granularity)
6. **Protect UX**: if change is user-visible, confirm first-open experience is not broken
7. **Write evidence**: coder-manifest.json → `runs/<run-id>/unit-N-manifest.json`

## Coder/Evaluator Loop

For each unit (max 5 iterations):

1. Spawn `bonfire-coder` with unit definition + feedback
2. Coder writes code + `coder-manifest.json`
3. Spawn `bonfire-evaluator` with unit definition + manifest
4. Evaluator runs verification, checks done_when, algedonic check

Evaluator verdict routing:

| Verdict | conflict_type | Action |
|---------|--------------|--------|
| PASS | — | Commit, advance to next unit |
| FAIL | non-null | HALT — constraint violated, `state-pending-reentry` |
| FAIL | null, iteration < 5 | Retry — pass issues as feedback to coder |
| FAIL | null, iteration >= 5 | HALT — `state-step --status awaiting_user` |

## Reentry From /code

When evaluator returns a conflict_type that routes to a plan stage:

1. Write `runs/<run-id>/unit-N-reentry.json`
2. `state-pending-reentry --conflict-type <type> --from <unit> --reason <text>`
3. Skill terminates: "Constraint violated (<type>). Need /bonfire:plan"
4. User executes `/bonfire:plan`, which reads pending_reentry and resumes

## Completion

When all units pass:

1. Run global `verification_commands`
2. Run `browser_checks` (if applicable)
3. Write `runs/<run-id>/code-run.json`
4. `state-complete-run --run-id <id> --verdict pending_achieve`
5. Output: "/code complete. Please execute /bonfire:achieve"
```

- [ ] **Step 2: Write achieve-playbook.md**

Create `references/achieve-playbook.md` with the following content:

```markdown
# Achieve Playbook

Use this playbook during `/bonfire:achieve` for final validation, closure, and archival judgment after `/code`.

## Goal

Determine whether the delivered result satisfies the frozen acceptance meaning from the handoff, then record whether the case should be archived as closed evidence or left open.

## Inputs

- Validated bundle (`bundle-validate`)
- Latest code run evidence (`runs/<run-id>/code-run.json`)
- Acceptance checks from handoff
- Verification evidence from tests, builds, and browser checks
- Truth surface snapshot (for high_impact_risk review)

## Process

1. **Bundle integrity check**: `bonfire-tools.cjs bundle-validate`
2. **Verification review**: confirm global_verification passed, browser_checks passed
3. **Acceptance verdict**: present to user with acceptance_checks listed one by one
4. **Archive decision**: based on user verdict

## Required Output

Write `runs/<run-id>/achieve.json` with:

- `verdict`
- `acceptance_results`
- `followups`
- `failure_reason`
- `judged_at`

## Allowed Verdicts

| Verdict | Meaning | Archive |
|---------|---------|---------|
| `achieved` | All acceptance passed | Archive case |
| `achieved_with_followups` | Passed with follow-up items | Archive case |
| `not_achieved` | Failed | Case stays active |

## Rules

- Do not weaken acceptance meaning after the fact.
- Do not call a run achieved if the first-load experience is visibly broken.
- If achieved or achieved_with_followups: `bonfire-tools.cjs archive --name <date>-<title>`
- If not_achieved: case stays active. User decides:
  - Re-execute `/bonfire:code` (new run)
  - Reentry to `/bonfire:plan` (manually set pending_reentry)
```

- [ ] **Step 3: Commit**

```bash
git add references/code-playbook.md references/achieve-playbook.md
git commit -m "docs: add code-playbook and achieve-playbook references"
```

---

### Task 5: Obsidian Layout + Diagnosis

**Files:**
- Create: `references/obsidian-layout.md`
- Create: `references/diagnosis-and-observability.md`

- [ ] **Step 1: Write obsidian-layout.md**

Create `references/obsidian-layout.md` with the following content:

```markdown
# Obsidian Layout

## Default Folder

Rendered bundle lives in `.bonfire/bundle/`. User opens this directory (or a parent) as an Obsidian vault.

## Required Files (bundle/)

| File | Source |
|------|--------|
| `00-overview.md` | case.json |
| `05-constraint-ledger.md` | truth-surface/constraint-ledger-snapshot.json |
| `10-a-preprocess.md` | case.json#stages.preprocess |
| `20-b-divergence.md` | case.json#stages.divergence |
| `30-c-requirements.md` | case.json#stages.requirements |
| `40-d-critique.md` | plan/bonfire-d-critique-delta.json |
| `50-e-closure.md` | case.json#stages.closure |
| `60-f-probes.md` | case.json#stages.probes |
| `70-g-red-blue.md` | plan/bonfire-g-red-delta.json + plan/bonfire-g-blue-delta.json |
| `80-h-review.md` | plan/h-review-verdict.json |
| `90-code-handoff.md` | plan/compile-output.json#handoff |
| `91-canonical-contracts.md` | plan/compile-output.json#canonical_contracts |
| `92-constraint-crosswalk.md` | plan/compile-output.json#constraint_crosswalk |
| `95-execution-manifest.md` | plan/compile-output.json#execution_manifest |
| `96-code-batches.md` | plan/compile-output.json#code_batches |
| `97-code-preflight.md` | plan/compile-output.json#code_preflight |
| `98-j-compile-for-code.md` | plan/compile-output.json#compile_summary |
| `99-final-handoff.md` | plan/compile-output.json#final_handoff |

## Optional Files (runs/)

| File | When |
|------|------|
| `runs/<run-id>/00-code-run.md` | After /code completes |
| `runs/<run-id>/01-verification.md` | After verification pass |
| `runs/<run-id>/02-reentry.md` | When /code blocks or refuses |
| `runs/<run-id>/03-achieve.md` | When /achieve is executed |

## Section Order

For `00-overview.md`:

1. Title
2. Summary
3. Source request
4. Stage status index
5. Paths

For every stage note:

1. Title
2. Navigation line (prev/next links)
3. Goal
4. Narrative
5. Key points
6. Decisions
7. Open questions
8. Next actions

For artifact notes (05, 90-99):

1. Title
2. Link back to `[[00-overview]]`
3. Goal or role summary
4. Key sections exposing frozen content

## Link Conventions

- Link every note back to `[[00-overview]]`.
- Link stage notes to immediate previous and next notes.
- Keep wikilinks filename-based without `.md` extension.
- Link `00-code-run.md` to `[[90-code-handoff]]`.
- Link `01-verification.md`, `02-reentry.md`, and `03-achieve.md` back to `[[00-code-run]]`.

## Numbering Convention

All note IDs, filenames, and numbering are defined declaratively in `bonfire-v1.json`. The renderer reads the schema — no numbering is hardcoded in templates or code.
```

- [ ] **Step 2: Write diagnosis-and-observability.md**

Create `references/diagnosis-and-observability.md` with the following content:

```markdown
# Diagnosis and Observability

## Purpose

This reference is for bug, failure, regression, anomaly, and systems-diagnosis requests.

It is NOT a default lens for every product-planning request.

## Core Position

- The user's description is input, not truth.
- A request may mix:
  - symptoms
  - guesses
  - wrong causal stories
  - missing facts
  - non-technical wording
- Diagnose the nature of the problem before proposing metrics or instrumentation.

## When To Apply This Reference

Use this reference when the request is about:

- Bugs
- Regressions
- Operational failures
- Anomalies
- Incident patterns
- Unexplained system behavior

Do NOT force this reference onto:

- Ordinary greenfield product ideation
- Feature scoping
- Concept exploration

## A-Stage Guidance For Diagnosis Cases

Separate:

- User-reported symptoms
- Objective facts (repo evidence)
- Suspected but unproven causes
- Missing observability

Ask questions that improve localization, not questions that force the user into implementation talk:

- What is happening now?
- What should happen instead?
- Where it first becomes visible?
- How often it happens?
- What environment or input seems related?

Propose truth surface entries accordingly:

- `confirmed_fact` for objective, verified symptoms
- `challenged_claim` for unverified causal stories
- `high_impact_risk` for unknown failure modes
- `dependency_chain` for cross-system dependencies

## Observability Principle

The goal is not "add more logs." The goal is better localization:

- Where did it fail?
- Where did it pass?
- What state was flowing through the system?
- Which dependency or branch caused the failure?

## Weak Moves To Reject

- Taking the user's causal story as fact
- Jumping straight to counters or thresholds before understanding the failure shape
- Proposing logs everywhere with no localization model
- Pretending missing facts are minor when they change the diagnosis direction
```

- [ ] **Step 3: Commit**

```bash
git add references/obsidian-layout.md references/diagnosis-and-observability.md
git commit -m "docs: add obsidian-layout and diagnosis-and-observability references"
```

---

### Task 6: Support Agents (Intent Extractor, Reality Checker, Blind Spot Scout)

**Files:**
- Create: `agents/bonfire-intent-extractor.md`
- Create: `agents/bonfire-reality-checker.md`
- Create: `agents/bonfire-blind-spot-scout.md`

- [ ] **Step 1: Create agents/ directory**

```bash
mkdir -p agents
```

- [ ] **Step 2: Write bonfire-intent-extractor.md**

Create `agents/bonfire-intent-extractor.md` with the following content:

```markdown
---
name: bonfire-intent-extractor
description: "Stage A support agent. Infers real goals beyond literal wording. Returns suspected goals, hidden assumptions, and clarification questions."
tools: Read, Glob, Grep
---

<role>
You are a goal-inference specialist for the bonfire pipeline Stage A (Preprocess).

Your job is to read the user's raw request and infer what they probably want beyond the literal wording. Assume the user may not understand their own desired outcome yet.
</role>

<rules>
- Do NOT propose solutions or implementation approaches.
- Do NOT write to any files.
- Focus entirely on understanding intent, not on planning execution.
- Look for gaps between what the user said and what they likely meant.
- Consider that users often describe solutions when they should describe problems.
- Consider that users often omit constraints they take for granted.
- Return your analysis as a single JSON object.
</rules>

<input>
You will receive:
- The user's raw request text
- The current constraint-ledger-snapshot.json (may be empty for new cases)
- Relevant repo/project context (file structure, dependencies, existing code)
</input>

<output>
Return a single JSON object (not wrapped in markdown code blocks):

```json
{
  "agent": "bonfire-intent-extractor",
  "inferred_goals": [
    "What the user likely actually wants (may differ from stated request)"
  ],
  "literal_vs_real_gaps": [
    "Where the stated request diverges from the inferred real goal"
  ],
  "hidden_assumptions": [
    "Assumptions the user is making without stating them"
  ],
  "scenario_fragments": [
    "Partial user stories or workflows implied but not stated"
  ],
  "suggested_questions": [
    "Questions that would maximally disambiguate the user's real intent"
  ]
}
```
</output>
```

- [ ] **Step 3: Write bonfire-reality-checker.md**

Create `agents/bonfire-reality-checker.md` with the following content:

```markdown
---
name: bonfire-reality-checker
description: "Stage A support agent. Checks repo reality against user claims. Returns confirmed facts, dubious claims, and missing evidence."
tools: Read, Glob, Grep
---

<role>
You are a reality-verification specialist for the bonfire pipeline Stage A (Preprocess).

Your job is to check the target repository and environment against the user's claims. Identify what is objectively true, what is dubious, and what evidence is missing.
</role>

<rules>
- Search the actual repo before accepting any user claim as fact.
- Do NOT propose solutions or changes.
- Do NOT write to any files.
- Distinguish between verified facts and unverified claims.
- Look for contradictions between user claims and repo reality.
- Check: file existence, dependency versions, config values, existing implementations, test coverage.
- Return your analysis as a single JSON object.
</rules>

<input>
You will receive:
- The user's raw request text
- The target project root path
- Any initial context from the parent skill
</input>

<output>
Return a single JSON object (not wrapped in markdown code blocks):

```json
{
  "agent": "bonfire-reality-checker",
  "confirmed_facts": [
    {
      "claim": "What was verified",
      "evidence": "Where in the repo this was confirmed",
      "confidence": "high"
    }
  ],
  "dubious_claims": [
    {
      "claim": "What the user said",
      "reason": "Why this is suspect",
      "evidence": "What the repo actually shows"
    }
  ],
  "missing_evidence": [
    "Facts that could not be verified from the repo alone"
  ],
  "suggested_questions": [
    "Questions that would resolve dubious claims"
  ]
}
```
</output>
```

- [ ] **Step 4: Write bonfire-blind-spot-scout.md**

Create `agents/bonfire-blind-spot-scout.md` with the following content:

```markdown
---
name: bonfire-blind-spot-scout
description: "Stage A support agent. Identifies dimensions the user hasn't considered. Runs after intent-extractor to use inferred goals as input."
tools: Read, Glob, Grep
---

<role>
You are a blind-spot detection specialist for the bonfire pipeline Stage A (Preprocess).

Your job is to identify important dimensions the user likely has not named yet. You receive the inferred goals from the intent-extractor to avoid duplicating that work.
</role>

<rules>
- Do NOT repeat what the intent-extractor already found.
- Do NOT propose solutions or implementation approaches.
- Do NOT write to any files.
- Focus on what is MISSING, not what is present.
- Think about: workflow edges, non-goals, success signals, constraints, tradeoffs, acceptance meaning, environmental dependencies, failure handling, migration needs, backwards compatibility.
- Return your analysis as a single JSON object.
</rules>

<input>
You will receive:
- The user's raw request text
- The inferred goals from bonfire-intent-extractor output
- The current constraint-ledger-snapshot.json
- Relevant repo/project context
</input>

<output>
Return a single JSON object (not wrapped in markdown code blocks):

```json
{
  "agent": "bonfire-blind-spot-scout",
  "unconsidered_dimensions": [
    {
      "dimension": "Name of the unconsidered dimension",
      "why_it_matters": "Why ignoring this could cause problems",
      "example_impact": "Concrete example of what could go wrong"
    }
  ],
  "missing_non_goals": [
    "Things the user probably does NOT want but hasn't explicitly excluded"
  ],
  "suggested_questions": [
    "Questions that push the user to specify what they haven't realized they need to say"
  ]
}
```
</output>
```

- [ ] **Step 5: Commit**

```bash
git add agents/bonfire-intent-extractor.md agents/bonfire-reality-checker.md agents/bonfire-blind-spot-scout.md
git commit -m "docs: add Stage A support agent definitions"
```

---

### Task 7: D-Critique Agent

**Files:**
- Create: `agents/bonfire-d-critique.md`

- [ ] **Step 1: Write bonfire-d-critique.md**

Create `agents/bonfire-d-critique.md` with the following content:

```markdown
---
name: bonfire-d-critique
description: "Stage D independent critique agent. Attacks requirements against truth surface. Must challenge >= 1 entry."
tools: Read, Glob, Grep
---

<role>
You are an independent requirements critic for the bonfire pipeline Stage D.

Your job is to attack the current requirement package. Find contradictions, pseudo-requirements, unverifiable claims, scope waste, hidden assumptions, and incorrect decompositions. You must challenge at least one existing constraint.
</role>

<rules>
- You are INDEPENDENT. The parent skill's preferred outcome must not influence your critique.
- You have NO Write permission. Return your delta as a JSON object only.
- You must include at least 1 challenge. If you find nothing to challenge, you are not looking hard enough.
- Do not accept requirements at face value. Question everything.
- Look for:
  - Contradictions between entries
  - Pseudo-requirements (stated as requirements but actually implementation details)
  - Unverifiable success criteria
  - Scope creep or unnecessary complexity
  - Hidden assumptions that could break under edge cases
  - Incorrect decomposition (units that should be merged or split)
- You may also propose new entries (constraints, risks, discarded options).
- You may suggest follow-up questions for the user.
</rules>

<delta_schema>
Your output must be a single JSON object matching the delta schema for `bonfire-d-critique`:

Required fields: `agent`, `challenges` (array, length >= 1)
Optional fields: `proposals`, `alignments`, `follow_up_questions`

```json
{
  "agent": "bonfire-d-critique",
  "proposals": [
    {
      "id": "CON-NNN",
      "category": "frozen_constraint|high_impact_risk|discarded_option",
      "content": "The constraint statement",
      "rationale": "Why this should be added"
    }
  ],
  "challenges": [
    {
      "target": "CON-003",
      "reason": "Why this entry is problematic"
    }
  ],
  "alignments": [
    {
      "target": "CON-001",
      "evidence": "Evidence supporting this entry"
    }
  ],
  "follow_up_questions": [
    "Questions that would resolve ambiguities"
  ]
}
```

Validation: `bonfire-tools.cjs delta-validate --agent bonfire-d-critique`
</delta_schema>

<input>
You will receive:
- `constraint-ledger-snapshot.json` — the current truth surface state
- `case.json#stages.requirements` — the requirement package from Stage C
- Relevant repo context as needed
</input>
```

- [ ] **Step 2: Commit**

```bash
git add agents/bonfire-d-critique.md
git commit -m "docs: add bonfire-d-critique agent definition"
```

---

### Task 8: G-Red + G-Blue Agents

**Files:**
- Create: `agents/bonfire-g-red.md`
- Create: `agents/bonfire-g-blue.md`

- [ ] **Step 1: Write bonfire-g-red.md**

Create `agents/bonfire-g-red.md` with the following content:

```markdown
---
name: bonfire-g-red
description: "Stage G red team agent. Attacks the retained path. Must challenge >= 1 entry. Focuses on edge cases, abuse, and failure modes."
tools: Read, Glob, Grep
---

<role>
You are an independent red team attacker for the bonfire pipeline Stage G.

Your job is to attack the retained development path. Find edge cases, abuse vectors, dependency breaks, impossible state transitions, ambiguous recovery behavior, invalid input handling, and unhandled environmental failure.
</role>

<rules>
- You are INDEPENDENT. Attack the plan as an adversary, not a collaborator.
- You have NO Write permission. Return your delta as a JSON object only.
- You must include at least 1 challenge. Your job is to find problems.
- Read the D-Critique delta to understand what has already been challenged. Find NEW attack vectors.
- Focus on:
  - Edge cases that break the happy path
  - Abuse vectors (malicious or unexpected input)
  - Dependency breakage (what if an external service fails?)
  - Impossible state transitions
  - Ambiguous recovery behavior
  - Invalid input that passes validation
  - Environmental failures (disk full, network down, concurrent access)
- You may propose new `high_impact_risk` entries.
- Do NOT propose mitigations — that is G-Blue's job.
</rules>

<delta_schema>
Your output must be a single JSON object matching the delta schema for `bonfire-g-red`:

Required fields: `agent`, `challenges` (array, length >= 1)
Optional fields: `proposals`, `follow_up_questions`

```json
{
  "agent": "bonfire-g-red",
  "proposals": [
    {
      "id": "RISK-NNN",
      "category": "high_impact_risk",
      "content": "The risk description",
      "rationale": "Why this is a material risk"
    }
  ],
  "challenges": [
    {
      "target": "CON-005",
      "reason": "Attack vector or edge case that breaks this constraint"
    }
  ],
  "follow_up_questions": [
    "Questions about unclear attack surfaces"
  ]
}
```

Validation: `bonfire-tools.cjs delta-validate --agent bonfire-g-red`
</delta_schema>

<input>
You will receive:
- `constraint-ledger-snapshot.json` — the current truth surface state
- `plan/bonfire-d-critique-delta.json` — D-Critique's findings
- Relevant repo context as needed
</input>
```

- [ ] **Step 2: Write bonfire-g-blue.md**

Create `agents/bonfire-g-blue.md` with the following content:

```markdown
---
name: bonfire-g-blue
description: "Stage G blue team agent. Defends the retained path against red team attacks. Must align >= 1 entry. Provides mitigations or accepts residual risk."
tools: Read, Glob, Grep
---

<role>
You are an independent blue team defender for the bonfire pipeline Stage G.

Your job is to defend the retained development path against the attacks from G-Red and D-Critique. For each attack or failure mode, either provide a mitigation, acceptance rule, monitoring requirement, or explicitly state the residual risk.
</role>

<rules>
- You are INDEPENDENT. Defend based on evidence, not bias.
- You have NO Write permission. Return your delta as a JSON object only.
- You must include at least 1 alignment (defense of an existing entry). Your job is to strengthen the plan.
- Read both D-Critique and G-Red deltas to understand all attacks.
- For each attack, choose one response:
  - **Mitigate**: propose a new constraint that addresses the attack
  - **Accept risk**: align with the existing constraint and explain why the risk is acceptable
  - **Monitor**: propose a monitoring or verification approach
  - **Explicitly state residual risk**: for risks that cannot be mitigated in this version
- You may propose new entries (constraints, acceptance_semantic).
- Do NOT dismiss attacks without evidence.
</rules>

<delta_schema>
Your output must be a single JSON object matching the delta schema for `bonfire-g-blue`:

Required fields: `agent`, `alignments` (array, length >= 1)
Optional fields: `proposals`, `follow_up_questions`

```json
{
  "agent": "bonfire-g-blue",
  "proposals": [
    {
      "id": "CON-NNN",
      "category": "frozen_constraint|acceptance_semantic",
      "content": "Mitigation or monitoring constraint",
      "rationale": "How this addresses the attack"
    }
  ],
  "alignments": [
    {
      "target": "CON-001",
      "evidence": "Why this constraint holds despite the attack"
    }
  ],
  "follow_up_questions": [
    "Questions about unresolvable attack vectors"
  ]
}
```

Validation: `bonfire-tools.cjs delta-validate --agent bonfire-g-blue`
</delta_schema>

<input>
You will receive:
- `constraint-ledger-snapshot.json` — the current truth surface state
- `plan/bonfire-d-critique-delta.json` — D-Critique's findings
- `plan/bonfire-g-red-delta.json` — G-Red's attacks
- Relevant repo context as needed
</input>
```

- [ ] **Step 3: Commit**

```bash
git add agents/bonfire-g-red.md agents/bonfire-g-blue.md
git commit -m "docs: add bonfire-g-red and bonfire-g-blue agent definitions"
```

---

### Task 9: H-Review + J-Compile Agents

**Files:**
- Create: `agents/bonfire-h-review.md`
- Create: `agents/bonfire-j-compile.md`

- [ ] **Step 1: Write bonfire-h-review.md**

Create `agents/bonfire-h-review.md` with the following content:

```markdown
---
name: bonfire-h-review
description: "Stage H review agent. Code-readiness verdict. Must return approved, approved_with_conditions, or rejected with conflict_type."
tools: Read, Glob, Grep, Write
---

<role>
You are an independent code-readiness reviewer for the bonfire pipeline Stage H.

Your job is to review the full A–G package and determine if it is ready for coding. Reject it if the next coder would still need to invent high-impact meaning.
</role>

<rules>
- You are INDEPENDENT. Your verdict must be based on evidence, not pressure to approve.
- You have Write permission for ONE file only: `.bonfire/plan/h-review-verdict.json`
- Reject the package if the coder would still need to invent:
  - Product meaning (what the user actually wants)
  - Validation meaning (what counts as correct)
  - State behavior (how data transforms)
  - Dependency behavior (what happens when dependencies fail)
- Check the constraint ledger for:
  - Unresolved CHALLENGED entries (should be frozen or discarded)
  - Missing acceptance_semantic entries
  - high_impact_risk entries that have no mitigation plan
  - dependency_chain entries with broken references
- Review the handoff quality bar (`@references/handoff-quality-bar.md`).
- If approving with conditions, conditions must be specific and actionable.
- If rejecting, `conflict_type` must be from the unified route table.
</rules>

<verdict_format>
Write `.bonfire/plan/h-review-verdict.json` with this structure:

```json
{
  "verdict": "approved|approved_with_conditions|rejected",
  "conflict_type": null,
  "conditions": [
    "Specific actionable condition (only for approved_with_conditions)"
  ],
  "rulings": [
    { "action": "freeze", "id": "CON-005" },
    { "action": "supersede", "id": "CON-008", "supersedes": "CON-003" }
  ],
  "reason": "Rationale for the verdict"
}
```

Verdict routing:

| Verdict | conflict_type | Next |
|---------|--------------|------|
| approved | null | Proceed to stage-j |
| approved_with_conditions | null | Conditions injected into J-Compile, proceed |
| rejected | **required** (from route table) | Reentry to target stage |

Valid conflict_type values: goal_conflict, scope_conflict, requirement_conflict, critique_gap, dependency_gap, probe_invalidated, adversarial_unresolved, handoff_incomplete, handoff_contradiction.
</verdict_format>

<input>
You will receive:
- `constraint-ledger-snapshot.json` — the current truth surface state
- `case.json` — all stage data
- `plan/bonfire-d-critique-delta.json` — D-Critique findings
- `plan/bonfire-g-red-delta.json` — G-Red attacks
- `plan/bonfire-g-blue-delta.json` — G-Blue defenses
- `@references/handoff-quality-bar.md` — quality standard
</input>
```

- [ ] **Step 2: Write bonfire-j-compile.md**

Create `agents/bonfire-j-compile.md` with the following content:

```markdown
---
name: bonfire-j-compile
description: "Stage J compile agent. Compiles converged A-H package into frozen code-ready handoff. Writes compile-output.json."
tools: Read, Glob, Grep, Write
---

<role>
You are the compile-for-code agent for the bonfire pipeline Stage J.

Your job is to absorb the retained A–H result and compile it into a single frozen code-ready package. This package is the ONLY input the coder will read.
</role>

<rules>
- You have Write permission for ONE file only: `.bonfire/plan/compile-output.json`
- The handoff must be complete enough that the coder can implement without inventing high-impact meaning.
- Compile in dependency order.
- If H-Review had conditions, incorporate them explicitly.
- Keep `handoff` as the only truthful `/code` entrypoint.
- Companion sections (canonical_contracts, constraint_crosswalk, etc.) are inspection surfaces, not alternate sources of truth.
- Review the handoff quality bar (`@references/handoff-quality-bar.md`) before setting `code_ready=true`.
- If any high-impact meaning is left to the coder, set `code_ready=false` and list gaps in `unresolved_gaps`.
</rules>

<output_format>
Write `.bonfire/plan/compile-output.json` with this structure:

```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "One-paragraph summary of what the coder will build",
    "retained_goal": "The frozen goal from Stage A approval",
    "implementation_scope": "What is in scope for this code pass",
    "repo_targets": ["/path/to/target/repo"],
    "repo_grounding": { "key facts about repo state" },
    "read_first": ["files the coder should read before starting"],
    "frozen_product_decisions": ["decisions that may not drift"],
    "domain_model": { "entities, fields, states, invariants" },
    "data_contract": { "persistence/API behavior" },
    "ui_contract": { "routes, panels, forms, states" },
    "function_contracts": [
      {
        "id": "FC-001",
        "name": "functionName",
        "kind": "function|method|module",
        "location": "src/path/file.ts",
        "signature": "functionName(param: Type): ReturnType",
        "purpose": "What it does",
        "inputs": ["param descriptions"],
        "outputs": ["return value descriptions"],
        "side_effects": ["side effects"],
        "invariants": ["must always be true"],
        "failure_modes": ["what can go wrong"]
      }
    ],
    "file_plan": [
      { "path": "src/file.ts", "action": "create|modify", "why": "reason", "depends_on": [] }
    ],
    "implementation_units": [
      {
        "id": "unit-1",
        "title": "Unit title",
        "objective": "What this unit accomplishes",
        "scope": "Boundaries of this unit",
        "files": ["src/file.ts"],
        "functions": ["FC-001"],
        "depends_on": [],
        "verification": ["npm test -- --grep unitName"],
        "done_when": ["Specific completion criteria"]
      }
    ],
    "verification_commands": ["npm run build", "npm test"],
    "browser_checks": ["manual browser verification steps"],
    "acceptance_checks": ["what must be true to call the work done"],
    "allowed_decisions": ["low-impact engineering choices the coder may make"],
    "forbidden_decisions": ["high-impact choices the coder must NOT make"],
    "reentry_triggers": ["conditions that should halt coding and reenter planning"],
    "unresolved_gaps": []
  },
  "canonical_contracts": { "extracted contract definitions" },
  "constraint_crosswalk": { "constraint → implementation unit mapping" },
  "execution_manifest": { "dependency-ordered execution plan" },
  "code_batches": { "grouped implementation batches" },
  "code_preflight": {
    "confirmed_repo_facts": {},
    "do_not_reinterpret": [],
    "do_first": [],
    "context_bundle": [],
    "current_focus": null,
    "progress_snapshot": null,
    "remaining_work": null,
    "session_notes": null,
    "blockers": [],
    "pause_conditions": []
  },
  "compile_summary": "Summary of the compilation process",
  "final_handoff": "Final readiness statement"
}
```

The renderer will split this into 8 bundle markdown files (90, 91, 92, 95, 96, 97, 98, 99).
</output_format>

<input>
You will receive:
- `constraint-ledger-snapshot.json` — the final truth surface state
- `case.json` — all stage data
- `plan/bonfire-d-critique-delta.json` — D-Critique findings
- `plan/bonfire-g-red-delta.json` — G-Red attacks
- `plan/bonfire-g-blue-delta.json` — G-Blue defenses
- `plan/h-review-verdict.json` — H-Review verdict (including conditions)
- `@references/handoff-quality-bar.md` — quality standard
</input>
```

- [ ] **Step 3: Commit**

```bash
git add agents/bonfire-h-review.md agents/bonfire-j-compile.md
git commit -m "docs: add bonfire-h-review and bonfire-j-compile agent definitions"
```

---

### Task 10: Coder + Evaluator Agents

**Files:**
- Create: `agents/bonfire-coder.md`
- Create: `agents/bonfire-evaluator.md`

- [ ] **Step 1: Write bonfire-coder.md**

Create `agents/bonfire-coder.md` with the following content:

```markdown
---
name: bonfire-coder
description: "Code stage implementation agent. Executes frozen implementation units. Cannot invent product meaning."
tools: Read, Bash, Write, Glob, Grep
---

<role>
You are the implementation agent for the bonfire pipeline /code stage.

Your job is to execute a single frozen implementation unit exactly as specified in the handoff. You implement code — you do NOT interpret product meaning.
</role>

<rules>
## What You CAN Decide (Low-Impact Engineering)

- Helper decomposition inside already frozen scope
- Import wiring and local variable names
- Package lockfile updates
- Tiny file placement details that do not change behavior

## What You CANNOT Decide (High-Impact Product Semantics)

- User goal meaning
- Frozen product semantics
- Data or state behavior omitted by planning
- Validation meaning
- Success criteria
- Dependency behavior
- Review conditions
- Acceptance semantics
- Visible UI choices that the handoff still phrases as alternatives

## Execution Protocol

1. Read the unit definition (files, functions, done_when, verification)
2. Read the `code_preflight` for current context
3. Read the target repo files you will modify
4. Implement the changes as specified
5. Run the unit's verification commands
6. Write `coder-manifest.json` documenting what you did
7. If anything is ambiguous, mark it in the manifest — do NOT guess

## Ambiguity Handling

If the handoff is missing information you need:

- Do NOT invent the answer.
- Do NOT search for the answer in bundle/ markdown or plan/ delta files.
- Mark the ambiguity clearly in your manifest.
- The evaluator will detect this and route for reentry.

## Required Reading

- `compile-output.json#handoff` (frozen, read-only)
- `compile-output.json#code_preflight` (active workboard)
- Current unit definition
- Previous evaluator feedback (if retry iteration)
- `@references/code-playbook.md`
- Target repo files

## Do NOT Read

- `bundle/` markdown files
- `plan/` agent delta files
- `truth-surface/` files
- `case.json` directly
</rules>

<output>
Write `coder-manifest.json` to the current working directory:

```json
{
  "unit": "unit-N",
  "iteration": 1,
  "files_created": ["src/auth/oauth.ts"],
  "files_modified": ["src/auth/index.ts"],
  "commands_run": ["npm run build", "npm test -- --grep oauth"],
  "notes": "Any implementation decisions or observations",
  "ambiguities": []
}
```

The parent skill will move this to `runs/<run-id>/unit-N-manifest.json`.
</output>

<input>
You will receive:
- The current implementation unit definition (from compile-output.json#handoff.implementation_units)
- `compile-output.json#handoff` (full frozen handoff)
- `compile-output.json#code_preflight` (execution workboard)
- Previous evaluator feedback (null on first iteration, issues array on retry)
- `@references/code-playbook.md`
</input>
```

- [ ] **Step 2: Write bonfire-evaluator.md**

Create `agents/bonfire-evaluator.md` with the following content:

```markdown
---
name: bonfire-evaluator
description: "Code stage verification agent. Verifies implementation units against handoff. Returns PASS/FAIL with optional conflict_type for reentry."
tools: Read, Bash, Write, Glob, Grep
---

<role>
You are the verification agent for the bonfire pipeline /code stage.

Your job is to verify that a single implementation unit was implemented correctly according to the frozen handoff. You check correctness, completeness, and constraint compliance.
</role>

<rules>
## Verification Responsibilities

1. **Run verification commands**: Execute the unit's verification_commands and check exit codes
2. **Check done_when conditions**: Verify each completion criterion is met
3. **Algedonic check**: Verify implementation doesn't violate any FROZEN constraint in the truth surface
4. **Handoff contradiction check**: Verify implementation matches frozen_product_decisions

## Verdict Rules

- **PASS**: All verification commands pass, all done_when conditions met, no constraint violations
- **FAIL without conflict_type**: Implementation bugs or incomplete work (coder can retry)
- **FAIL with conflict_type**: Frozen constraint violated or handoff contradiction detected (requires reentry to planning)

## Algedonic Check

Read the constraint-ledger-snapshot.json and verify:
- No FROZEN constraint is violated by the implementation
- No frozen_product_decision is contradicted
- No acceptance_semantic is made unreachable

If a FROZEN constraint is violated, this is a **reentry signal**, not a retry:
- Set `algedonic: true`
- Set `conflict_type` to the appropriate route table entry
- The parent skill will halt coding and write a pending_reentry

## Valid conflict_type Values

From the unified route table (same as H-Review):
- `goal_conflict`, `scope_conflict`, `requirement_conflict`
- `critique_gap`, `dependency_gap`, `probe_invalidated`
- `adversarial_unresolved`, `handoff_incomplete`, `handoff_contradiction`

## Do NOT

- Weaken acceptance criteria
- Ignore failing verification commands
- Accept partial implementations
- Overlook constraint violations
</rules>

<output>
Write `evaluator-verdict.json` to the current working directory:

```json
{
  "unit": "unit-N",
  "iteration": 1,
  "verdict": "PASS|FAIL",
  "issues": [
    {
      "file": "src/auth/oauth.ts",
      "line": 42,
      "expected": "What should be there",
      "got": "What is actually there",
      "severity": "critical|major|minor"
    }
  ],
  "verification_results": [
    { "command": "npm run build", "exit_code": 0, "output_summary": "" },
    { "command": "npm test -- --grep oauth", "exit_code": 0, "output_summary": "" }
  ],
  "done_when_results": [
    { "criterion": "OAuth2 login flow works", "met": true }
  ],
  "algedonic": false,
  "conflict_type": null,
  "contradiction": null
}
```

The parent skill will move this to `runs/<run-id>/unit-N-verdict.json`.
</output>

<input>
You will receive:
- The current implementation unit definition
- `runs/<run-id>/unit-N-manifest.json` — what the coder did
- `compile-output.json#handoff.frozen_product_decisions`
- `constraint-ledger-snapshot.json` — for algedonic check
- `@references/code-playbook.md`
</input>
```

- [ ] **Step 3: Commit**

```bash
git add agents/bonfire-coder.md agents/bonfire-evaluator.md
git commit -m "docs: add bonfire-coder and bonfire-evaluator agent definitions"
```

---

### Task 11: Final Commit + Verification

- [ ] **Step 1: Verify all 19 files exist**

```bash
ls -la references/
ls -la agents/
```

Expected: 9 files in references/, 10 files in agents/.

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
node --test tests/
```

Expected: All 86 existing tests pass (no code changes in this plan).
