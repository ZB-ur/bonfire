# Bonfire Plan 5: Skill Orchestrators + Templates + Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the 5 skill orchestrator files, remaining 21 render templates, expanded golden test case, and smoke tests that tie the full plugin together.

**Architecture:** Skills (`skills/*/SKILL.md`) are Claude Code slash commands that orchestrate the pipeline — each skill reads state, spawns agents, executes truth surface mutations, and advances the state machine. Templates (`templates/*.md`) use the minimal `{{field}}` / `{{#each}}` / `{{.}}` syntax and are rendered by `renderer.cjs`. The golden test case (`examples/sample-case/`) provides full-pipeline sample data. Smoke tests (`tests/test-smoke.js`) verify render-all against the golden case.

**Tech Stack:** Markdown files (skills, templates). One JavaScript test file. No changes to existing Node.js modules.

**Spec:** `docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md` — Sections 1, 4, 5, 7, 8.

**Depends on:** Plans 1–4 (completed) — CLI, truth surface, state machine, renderer, delta-parser, schema, references, agent definitions.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `templates/overview.md` | Case overview rendering |
| Create | `templates/stage-a.md` | Stage A preprocess rendering |
| Create | `templates/stage-b.md` | Stage B divergence rendering |
| Create | `templates/stage-c.md` | Stage C requirements rendering |
| Create | `templates/stage-d.md` | Stage D critique rendering |
| Create | `templates/stage-e.md` | Stage E closure rendering |
| Create | `templates/stage-f.md` | Stage F probes rendering |
| Create | `templates/stage-g.md` | Stage G red-blue rendering |
| Create | `templates/stage-h.md` | Stage H review rendering |
| Create | `templates/stage-j.md` | Stage J compile summary rendering |
| Create | `templates/code-handoff.md` | Code handoff rendering |
| Create | `templates/canonical-contracts.md` | Canonical contracts rendering |
| Create | `templates/constraint-crosswalk.md` | Constraint crosswalk rendering |
| Create | `templates/execution-manifest.md` | Execution manifest rendering |
| Create | `templates/code-batches.md` | Code batches rendering |
| Create | `templates/code-preflight.md` | Code preflight rendering |
| Create | `templates/final-handoff.md` | Final handoff rendering |
| Create | `templates/code-run.md` | Run execution record rendering |
| Create | `templates/verification.md` | Run verification rendering |
| Create | `templates/reentry.md` | Run reentry rendering |
| Create | `templates/achieve.md` | Run achieve rendering |
| Create | `skills/pre/SKILL.md` | /bonfire:pre orchestrator |
| Create | `skills/plan/SKILL.md` | /bonfire:plan orchestrator |
| Create | `skills/code/SKILL.md` | /bonfire:code orchestrator |
| Create | `skills/achieve/SKILL.md` | /bonfire:achieve orchestrator |
| Create | `skills/render/SKILL.md` | /bonfire:render manual trigger |
| Modify | `examples/sample-case/case.json` | Expanded golden test data |
| Create | `examples/sample-case/bundle/` | Rendered golden bundle |
| Create | `tests/test-smoke.js` | Render-all smoke test |

---

### Task 1: Overview + Stage A–C Templates

**Files:**
- Create: `templates/overview.md`
- Create: `templates/stage-a.md`
- Create: `templates/stage-b.md`
- Create: `templates/stage-c.md`

- [ ] **Step 1: Write templates/overview.md**

```markdown
# {{title}}

← [[00-overview]]

**Created:** {{created_at}}
**Source request:** {{source_request}}

## Project Paths

Root: {{project_paths}}
```

- [ ] **Step 2: Write templates/stage-a.md**

```markdown
# Stage A — Preprocess

← [[00-overview]] | → [[20-b-divergence]]

## Reframed Goal

{{reframed_goal}}

## Retained Scope

{{#each retained_scope}}
- {{.}}
{{/each}}

## Excluded Scope

{{#each excluded_scope}}
- {{.}}
{{/each}}

## Critical Assumptions

{{#each critical_assumptions}}
- {{.}}
{{/each}}

## Frozen for Code

{{#each frozen_for_code}}
- {{.}}
{{/each}}

## Ambiguity Points

{{#each ambiguity_points}}
- {{.}}
{{/each}}
```

- [ ] **Step 3: Write templates/stage-b.md**

```markdown
# Stage B — Divergence

← [[10-a-preprocess]] | → [[30-c-requirements]]

## Retained Option

{{retained_option}}

## Options Considered

{{#each options}}
### {{title}}

{{description}}

**Blind spots covered:** {{blind_spots_covered}}
{{/each}}
```

- [ ] **Step 4: Write templates/stage-c.md**

```markdown
# Stage C — Requirements

← [[20-b-divergence]] | → [[40-d-critique]]

## Requirement Units

{{#each requirement_units}}
### {{id}}: {{title}}

{{description}}

**Success criteria:** {{success_criteria}}
**Depends on:** {{depends_on}}
{{/each}}
```

- [ ] **Step 5: Commit**

```bash
git add templates/overview.md templates/stage-a.md templates/stage-b.md templates/stage-c.md
git commit -m "templates: add overview and stage A-C templates"
```

---

### Task 2: Stage D–F Templates

**Files:**
- Create: `templates/stage-d.md`
- Create: `templates/stage-e.md`
- Create: `templates/stage-f.md`

- [ ] **Step 1: Write templates/stage-d.md**

```markdown
# Stage D — Critique

← [[30-c-requirements]] | → [[50-e-closure]]

**Agent:** bonfire-d-critique

## Challenges

{{#each challenges}}
### {{target}}

{{reason}}
{{/each}}

## Proposals

{{#each proposals}}
### {{id}} ({{category}})

{{content}}

**Rationale:** {{rationale}}
{{/each}}

## Follow-Up Questions

{{#each follow_up_questions}}
- {{.}}
{{/each}}
```

- [ ] **Step 2: Write templates/stage-e.md**

```markdown
# Stage E — Closure

← [[40-d-critique]] | → [[60-f-probes]]

## Dependency Chain

{{#each dependency_chain}}
### {{id}}

{{description}}

**Upstream:** {{upstream}}
**Downstream:** {{downstream}}
{{/each}}

## Resolved Gaps

{{#each resolved_gaps}}
- {{.}}
{{/each}}
```

- [ ] **Step 3: Write templates/stage-f.md**

```markdown
# Stage F — Probes

← [[50-e-closure]] | → [[70-g-red-blue]]

## Probe Results

{{#each probes}}
### {{hypothesis}}

**Method:** {{method}}
**Expected:** {{expected_signal}}
**Kill criteria:** {{kill_criteria}}
**Result:** {{result}}
{{/each}}
```

- [ ] **Step 4: Commit**

```bash
git add templates/stage-d.md templates/stage-e.md templates/stage-f.md
git commit -m "templates: add stage D-F templates"
```

---

### Task 3: Stage G–H + J Templates

**Files:**
- Create: `templates/stage-g.md`
- Create: `templates/stage-h.md`
- Create: `templates/stage-j.md`

- [ ] **Step 1: Write templates/stage-g.md**

```markdown
# Stage G — Red-Blue

← [[60-f-probes]] | → [[80-h-review]]

## Red Team Challenges

{{#each challenges}}
### {{target}}

{{reason}}
{{/each}}

## Blue Team Alignments

{{#each alignments}}
### {{target}}

{{evidence}}
{{/each}}

## Proposals

{{#each proposals}}
### {{id}} ({{category}})

{{content}}

**Rationale:** {{rationale}}
{{/each}}
```

Note: Stage G source is `plan/bonfire-g-red-delta.json+plan/bonfire-g-blue-delta.json` (multi-source merge). The renderer combines both files using `Object.assign`. The template receives the merged object.

- [ ] **Step 2: Write templates/stage-h.md**

```markdown
# Stage H — Review

← [[70-g-red-blue]] | → [[90-code-handoff]]

**Verdict:** {{verdict}}

## Reason

{{reason}}

## Conditions

{{#each conditions}}
- {{.}}
{{/each}}

## Rulings

{{#each rulings}}
- **{{action}}** {{id}} {{supersedes}}
{{/each}}
```

- [ ] **Step 3: Write templates/stage-j.md**

This template is used for note id `compile-for-code` (filename `98-j-compile-for-code.md`), sourced from `compile-output.json#compile_summary`.

```markdown
# Stage J — Compile for Code

← [[80-h-review]] | → [[90-code-handoff]]

## Compile Summary

{{summary}}

## Code Ready

{{code_ready}}

## Blockers

{{#each blockers}}
- {{.}}
{{/each}}
```

- [ ] **Step 4: Commit**

```bash
git add templates/stage-g.md templates/stage-h.md templates/stage-j.md
git commit -m "templates: add stage G-H and J templates"
```

---

### Task 4: Code Handoff Templates (90–92)

**Files:**
- Create: `templates/code-handoff.md`
- Create: `templates/canonical-contracts.md`
- Create: `templates/constraint-crosswalk.md`

- [ ] **Step 1: Write templates/code-handoff.md**

Source: `compile-output.json#handoff`

```markdown
# Code Handoff

← [[00-overview]] | See also: [[05-constraint-ledger]]

**Code Ready:** {{code_ready}}

## Summary

{{handoff_summary}}

## Retained Goal

{{retained_goal}}

## Implementation Scope

{{implementation_scope}}

## Frozen Product Decisions

{{#each frozen_product_decisions}}
- {{.}}
{{/each}}

## Implementation Units

{{#each implementation_units}}
### {{id}}: {{title}}

**Objective:** {{objective}}
**Scope:** {{scope}}
**Depends on:** {{depends_on}}
**Done when:** {{done_when}}
{{/each}}

## Verification Commands

{{#each verification_commands}}
- `{{.}}`
{{/each}}

## Acceptance Checks

{{#each acceptance_checks}}
- {{.}}
{{/each}}

## Reentry Triggers

{{#each reentry_triggers}}
- {{.}}
{{/each}}
```

- [ ] **Step 2: Write templates/canonical-contracts.md**

Source: `compile-output.json#canonical_contracts`

```markdown
# Canonical Contracts

← [[90-code-handoff]]

## Function Contracts

{{#each function_contracts}}
### {{name}}

**Kind:** {{kind}}
**Location:** {{location}}
**Signature:** `{{signature}}`
**Purpose:** {{purpose}}
{{/each}}

## File Plan

{{#each file_plan}}
- **{{path}}** — {{action}}: {{why}}
{{/each}}
```

- [ ] **Step 3: Write templates/constraint-crosswalk.md**

Source: `compile-output.json#constraint_crosswalk`

```markdown
# Constraint Crosswalk

← [[90-code-handoff]] | See also: [[05-constraint-ledger]]

## Constraint to Unit Mapping

{{#each mappings}}
### {{constraint_id}}

**Constraint:** {{content}}
**Implemented by:** {{unit_ids}}
**Verified by:** {{verification}}
{{/each}}
```

- [ ] **Step 4: Commit**

```bash
git add templates/code-handoff.md templates/canonical-contracts.md templates/constraint-crosswalk.md
git commit -m "templates: add code-handoff, canonical-contracts, constraint-crosswalk"
```

---

### Task 5: Execution Templates (95–99)

**Files:**
- Create: `templates/execution-manifest.md`
- Create: `templates/code-batches.md`
- Create: `templates/code-preflight.md`
- Create: `templates/final-handoff.md`

- [ ] **Step 1: Write templates/execution-manifest.md**

Source: `compile-output.json#execution_manifest`

```markdown
# Execution Manifest

← [[90-code-handoff]]

## Execution Order

{{#each phases}}
### Phase {{phase_number}}: {{title}}

{{#each units}}
- **{{id}}**: {{title}} (depends on: {{depends_on}})
{{/each}}
{{/each}}
```

- [ ] **Step 2: Write templates/code-batches.md**

Source: `compile-output.json#code_batches`

```markdown
# Code Batches

← [[90-code-handoff]]

## Batches

{{#each batches}}
### Batch {{batch_number}}: {{title}}

{{description}}

**Units:** {{unit_ids}}
**Verification:** {{verification}}
{{/each}}
```

- [ ] **Step 3: Write templates/code-preflight.md**

Source: `compile-output.json#code_preflight`

```markdown
# Code Preflight

← [[90-code-handoff]]

## Current Focus

{{current_focus}}

## Progress Snapshot

{{progress_snapshot}}

## Remaining Work

{{remaining_work}}

## Do First

{{#each do_first}}
- {{.}}
{{/each}}

## Blockers

{{#each blockers}}
- {{.}}
{{/each}}

## Session Notes

{{session_notes}}

## Pause Conditions

{{#each pause_conditions}}
- {{.}}
{{/each}}
```

- [ ] **Step 4: Write templates/final-handoff.md**

Source: `compile-output.json#final_handoff`

```markdown
# Final Handoff

← [[90-code-handoff]]

## Readiness Statement

{{statement}}

## Status

{{status}}
```

- [ ] **Step 5: Commit**

```bash
git add templates/execution-manifest.md templates/code-batches.md templates/code-preflight.md templates/final-handoff.md
git commit -m "templates: add execution-manifest, code-batches, code-preflight, final-handoff"
```

---

### Task 6: Runs Templates

**Files:**
- Create: `templates/code-run.md`
- Create: `templates/verification.md`
- Create: `templates/reentry.md`
- Create: `templates/achieve.md`

- [ ] **Step 1: Write templates/code-run.md**

Source: `runs/{run_id}/code-run.json`, output to `runs/{run_id}/`

```markdown
# Code Run: {{run_id}}

← [[90-code-handoff]]

**Units completed:** {{units_completed}}
**Total iterations:** {{total_iterations}}
**Algedonic signals:** {{algedonic_signals}}
**Reentries:** {{reentries}}
**Global verification:** {{global_verification}}
**Browser checks:** {{browser_checks}}
**Completed at:** {{completed_at}}
```

- [ ] **Step 2: Write templates/verification.md**

Source: `runs/{run_id}/verification.json`, output to `runs/{run_id}/`

```markdown
# Verification: {{run_id}}

← [[00-code-run]]

## Results

{{#each results}}
### {{command}}

**Exit code:** {{exit_code}}
**Output:** {{output_summary}}
{{/each}}
```

- [ ] **Step 3: Write templates/reentry.md**

Source: `runs/{run_id}/reentry.json`, output to `runs/{run_id}/`

```markdown
# Reentry Request: {{run_id}}

← [[00-code-run]]

**Conflict type:** {{conflict_type}}
**From unit:** {{from_unit}}
**Target stage:** {{target_stage}}

## Reason

{{reason}}
```

- [ ] **Step 4: Write templates/achieve.md**

Source: `runs/{run_id}/achieve.json`, output to `runs/{run_id}/`

```markdown
# Acceptance: {{run_id}}

← [[00-code-run]]

**Verdict:** {{verdict}}
**Judged at:** {{judged_at}}

## Acceptance Results

{{#each acceptance_results}}
- **{{check}}**: {{result}}
{{/each}}

## Follow-ups

{{#each followups}}
- {{.}}
{{/each}}

## Failure Reason

{{failure_reason}}
```

- [ ] **Step 5: Commit**

```bash
git add templates/code-run.md templates/verification.md templates/reentry.md templates/achieve.md
git commit -m "templates: add runs templates (code-run, verification, reentry, achieve)"
```

---

### Task 7: /bonfire:pre SKILL.md

**Files:**
- Create: `skills/pre/SKILL.md`

- [ ] **Step 1: Create directory and write skill**

```bash
mkdir -p skills/pre
```

Create `skills/pre/SKILL.md` with the following content:

```markdown
---
name: bonfire:pre
description: "Initialize a bonfire case and run Stage A preprocessing. Audits the raw request, spawns support agents, asks clarification questions, and produces an approval pack."
argument-hint: "--request <text> [--project-root <path>]"
---

<objective>
Own Stage A of the bonfire pipeline. Turn a raw user request into an approved, frozen planning target. The non-negotiable rule: if `/bonfire:plan` will later need to ask what the product means, this stage failed.
</objective>

<execution_context>
Read these references before starting:
- @references/approval-gate.md
- @references/stage-playbook.md
- @references/diagnosis-and-observability.md (only for bug/diagnosis requests)
- @references/ecl-schema.md

CLI tool: `bonfire-tools.cjs` (all commands documented in ecl-schema reference)
</execution_context>

<process>

## Startup

1. Check for pending_reentry in state.json:
   - If `pending_reentry.target_pipeline == "pre"`: execute `bonfire-tools.cjs state-reentry --conflict-type <type>`, then `bonfire-tools.cjs state-clear-reentry`. Resume from stage-a.
   - If `pending_reentry` exists but targets a different pipeline: abort with "pending reentry target is /bonfire:<target>".
   - If no pending_reentry: proceed normally.

2. If this is a new case (no `.bonfire/state.json`):
   ```
   bonfire-tools.cjs init --request "<user request>" --project-root <path>
   ```

3. Set step status:
   ```
   bonfire-tools.cjs state-step --step stage-a --status running
   ```

## Parent Initial Review

4. Read the user's raw request from case.json.
5. Search the target repo: file structure, existing code, dependencies, config, tests.
6. Identify ambiguities, dubious claims, and factual gaps.

## Support Agents (Optional)

7. Spawn support agents to augment your analysis:

   **Parallel:** intent-extractor + reality-checker
   ```
   Agent({ subagent_type: "bonfire-intent-extractor", prompt: "..." })
   Agent({ subagent_type: "bonfire-reality-checker", prompt: "..." })
   ```

   **Serial (after intent-extractor completes):** blind-spot-scout
   ```
   Agent({ subagent_type: "bonfire-blind-spot-scout", prompt: "..." })
   ```

8. Synthesize agent outputs into a combined question list.

9. Initial truth surface entries:
   - `truth-propose` with category `confirmed_fact` for verified repo facts (from reality-checker)
   - `truth-propose` with category `challenged_claim` for dubious user claims

## User Interaction Loop

10. Set step status:
    ```
    bonfire-tools.cjs state-step --step stage-a --status awaiting_user
    ```

11. Ask clarification questions one at a time. Cover:
    - Goals, non-goals, examples, anti-examples
    - Workflows, priorities, tradeoffs
    - Failure cases, data semantics, UI states
    - Acceptance expectations

12. After each answer, update truth surface:
    - `truth-propose` new entries as appropriate (retained_goal, confirmed_fact, acceptance_semantic, etc.)

13. Continue until remaining unknowns are low-impact implementation details, not latent product semantics.

## Approval Pack

14. Generate the approval pack and write to `case.json#stages.preprocess`:
    - `reframed_goal`
    - `retained_scope`
    - `excluded_scope`
    - `critical_assumptions`
    - `frozen_for_code`
    - Plus all preprocess fields (ambiguity_points, dubious_claims, etc.)

15. Render: `bonfire-tools.cjs render --note stage-a`

16. Present approval pack to user. Wait for explicit approval.

## Gate

17. If user approves:
    - `truth-freeze` all `confirmed_fact` entries
    - `truth-propose` remaining `retained_goal` and `acceptance_semantic` entries
    - `bonfire-tools.cjs state-step --step stage-a --status passed`
    - `bonfire-tools.cjs state-advance --step stage-a`
    - `bonfire-tools.cjs render --note overview`
    - Output: **"Stage A passed. Please execute /bonfire:plan"**

18. If user rejects: return to step 11 (user interaction loop).

</process>
```

- [ ] **Step 2: Commit**

```bash
git add skills/pre/SKILL.md
git commit -m "skills: add /bonfire:pre orchestrator"
```

---

### Task 8: /bonfire:plan SKILL.md

**Files:**
- Create: `skills/plan/SKILL.md`

- [ ] **Step 1: Create directory and write skill**

```bash
mkdir -p skills/plan
```

Create `skills/plan/SKILL.md` with the following content:

```markdown
---
name: bonfire:plan
description: "Run the bonfire planning pipeline stages B-J. Divergence, requirements, adversarial review, code-readiness verdict, and compile to frozen handoff."
argument-hint: "[--from <stage>]"
---

<objective>
Run stages B through J of the bonfire pipeline. After Stage A approval, converge the planning pipeline mainly in the background. User interaction should drop sharply — return to the user only when a new high-impact ambiguity or contradiction appears.

Core invariant: when this skill completes, the coder must be able to implement without inventing high-impact product meaning.
</objective>

<execution_context>
Read these references before starting:
- @references/stage-playbook.md
- @references/subagent-protocol.md
- @references/handoff-quality-bar.md
- @references/ecl-schema.md

CLI tool: `bonfire-tools.cjs`
</execution_context>

<process>

## Startup

1. Check pending_reentry:
   - If `pending_reentry.target_pipeline == "plan"`: execute `bonfire-tools.cjs state-reentry --conflict-type <type>`, then `bonfire-tools.cjs state-clear-reentry`. Jump to the target step.
   - If `pending_reentry` targets a different pipeline: abort.
   - If no pending_reentry: validate `pipeline_stage == "plan"` or `stage-a.status == "passed"`.

2. Read state.json to determine current_step. Resume from there.

## Stage B — Divergence

3. `bonfire-tools.cjs state-step --step stage-b --status running`

4. Parent executes (no agent):
   - Read case.json#stages.preprocess and truth surface snapshot
   - Generate >= 3 materially different options (not style variants)
   - Each option must explain which blind spots it covers
   - Retain exactly one path

5. Write to case.json#stages.divergence. Render: `bonfire-tools.cjs render --note stage-b`

6. Gate: >= 3 options, 1 retained → `state-step --step stage-b --status passed`, `state-advance --step stage-b`

## Stage C — Requirements

7. `bonfire-tools.cjs state-step --step stage-c --status running`

8. Parent executes (no agent):
   - Decompose retained option into requirement units
   - Each unit needs success criteria
   - Batch truth-propose: retained_goal, frozen_constraint, dependency_chain, acceptance_semantic

9. Write to case.json#stages.requirements. Render: `bonfire-tools.cjs render --note stage-c`

10. Gate: all requirement units have success criteria → advance

## Stage D — Critique

11. `bonfire-tools.cjs state-step --step stage-d --status awaiting_agent`

12. Spawn bonfire-d-critique:
    ```
    Agent({
      subagent_type: "bonfire-d-critique",
      prompt: "<role>...<input>@.bonfire/truth-surface/constraint-ledger-snapshot.json</input>"
    })
    ```

13. `state-step --step stage-d --status integrating`

14. Parse agent return value as JSON. Validate:
    ```
    bonfire-tools.cjs delta-validate --agent bonfire-d-critique --file .bonfire/plan/bonfire-d-critique-delta.json
    ```

15. Write delta to `.bonfire/plan/bonfire-d-critique-delta.json`

16. Execute truth surface mutations:
    - For each proposal: `truth-propose`
    - For each challenge: `truth-update --id <target> --field challenged_by --value d-critique`

17. Render: `bonfire-tools.cjs render --note stage-d`

18. Gate: >= 1 challenge integrated → advance

## Stage E — Closure

19. `bonfire-tools.cjs state-step --step stage-e --status running`

20. Parent executes: close dependency chain gaps, convert to dependency-aware execution chain.

21. Write to case.json#stages.closure. Render: `bonfire-tools.cjs render --note stage-e`

22. Gate: all dependency_chain entry refs valid → advance

## Stage F — Probes

23. `bonfire-tools.cjs state-step --step stage-f --status running`

24. Parent executes: run executable validation (repo inspection, scripts, tests, environment checks). Record hypothesis, method, expected signal, kill criteria, result.

25. Write to case.json#stages.probes. Render: `bonfire-tools.cjs render --note stage-f`

26. Gate: all probes have results or inability records → advance

## Stage G — Red-Blue

27. `bonfire-tools.cjs state-step --step stage-g --status awaiting_agent`

28. Spawn bonfire-g-red (input: d-critique delta + snapshot):
    ```
    Agent({ subagent_type: "bonfire-g-red", prompt: "..." })
    ```

29. Validate delta, write to `.bonfire/plan/bonfire-g-red-delta.json`. Execute truth-update challenged_by for each challenge.

30. Spawn bonfire-g-blue (input: g-red delta + d-critique delta + snapshot):
    ```
    Agent({ subagent_type: "bonfire-g-blue", prompt: "..." })
    ```

31. Validate delta, write to `.bonfire/plan/bonfire-g-blue-delta.json`. Execute truth-update aligned_by for each alignment, truth-propose for new proposals.

32. **Truth-Freeze Gate** (part of stage-g exit):
    - Query CHALLENGED entries: `bonfire-tools.cjs truth-query --status challenged`
    - For each entry meeting maturity gate: `bonfire-tools.cjs truth-freeze --id <id>`
    - `high_impact_risk` entries stay OPEN (never freeze)

33. Render: `bonfire-tools.cjs render --note stage-g`

34. Gate: red/blue complete + residual risks recorded + freeze done → advance

## Stage H — Review

35. `bonfire-tools.cjs state-step --step stage-h --status awaiting_agent`

36. Spawn bonfire-h-review:
    ```
    Agent({
      subagent_type: "bonfire-h-review",
      prompt: "<input>@.bonfire/truth-surface/constraint-ledger-snapshot.json, @.bonfire/case.json, all plan/ deltas, @references/handoff-quality-bar.md</input>"
    })
    ```

37. Read `.bonfire/plan/h-review-verdict.json`. Validate:
    ```
    bonfire-tools.cjs delta-validate --agent bonfire-h-review --file .bonfire/plan/h-review-verdict.json
    ```

38. Execute rulings:
    - For each `{ "action": "freeze", "id": "..." }`: `truth-freeze --id <id>`
    - For each `{ "action": "supersede", ... }`: `truth-supersede --id <new> --supersedes <old> ...`

39. Render: `bonfire-tools.cjs render --note stage-h`

40. Verdict routing:
    - `approved` → advance to stage-j
    - `approved_with_conditions` → record conditions, advance to stage-j
    - `rejected` → `bonfire-tools.cjs state-reentry --conflict-type <verdict.conflict_type>`, log, resume from target step

## Stage J — Compile

41. `bonfire-tools.cjs state-step --step stage-j --status awaiting_agent`

42. Spawn bonfire-j-compile:
    ```
    Agent({
      subagent_type: "bonfire-j-compile",
      prompt: "<input>snapshot, case.json, all deltas, verdict (with conditions if any), @references/handoff-quality-bar.md</input>"
    })
    ```

43. Read `.bonfire/plan/compile-output.json`. Validate:
    ```
    bonfire-tools.cjs handoff-validate
    ```

44. Dual-write hook renders 8 markdown files to bundle/ (90, 91, 92, 95, 96, 97, 98, 99).

45. Gate: handoff passes validation, code_ready=true → advance
    - Gate failed: `state-reentry --conflict-type handoff_incomplete`, resume from stage-h

46. Output: **"Planning complete. code_ready=true. Please execute /bonfire:code"**

</process>
```

- [ ] **Step 2: Commit**

```bash
git add skills/plan/SKILL.md
git commit -m "skills: add /bonfire:plan orchestrator"
```

---

### Task 9: /bonfire:code SKILL.md

**Files:**
- Create: `skills/code/SKILL.md`

- [ ] **Step 1: Create directory and write skill**

```bash
mkdir -p skills/code
```

Create `skills/code/SKILL.md` with the following content:

```markdown
---
name: bonfire:code
description: "Execute the frozen code handoff. Spawns coder/evaluator agents per implementation unit. Cannot invent product meaning."
argument-hint: ""
---

<objective>
Execute the frozen handoff from `/bonfire:plan`. Spawn coder/evaluator agents for each implementation unit in an adversarial loop. The code stage exists to execute, not to reinterpret.

Core invariant: if the coder needs to ask what the product means, reenter `/bonfire:plan`.
</objective>

<execution_context>
Read these references before starting:
- @references/code-playbook.md
- @references/ecl-schema.md
</execution_context>

<process>

## Entry Check

1. Read state.json:
   - If `pending_reentry` exists: abort with "pending reentry to /bonfire:<target>. Please resolve first."
   - Verify `pipeline_stage == "plan"` and `stage-j.status == "passed"`
   - Otherwise abort: "Please complete /bonfire:plan first"

2. Read `.bonfire/plan/compile-output.json`:
   - Verify `handoff.code_ready == true`
   - Otherwise abort: "handoff code_ready=false"

3. Initialize code steps:
   ```
   bonfire-tools.cjs state-init-code-steps
   bonfire-tools.cjs state-begin-run --run-id run-<timestamp>
   ```

## Unit Execution Loop

For each unit in `handoff.implementation_units` (dependency order from execution_manifest):

4. Set iteration = 0, max_iterations = 5, feedback = null

5. **Loop start:**
   ```
   iteration += 1
   bonfire-tools.cjs state-step --step unit-N --status running
   ```

6. Spawn bonfire-coder:
   ```
   Agent({
     subagent_type: "bonfire-coder",
     prompt: "Unit definition: <unit JSON>
              Handoff: @.bonfire/plan/compile-output.json#handoff
              Preflight: @.bonfire/plan/compile-output.json#code_preflight
              Feedback: <previous evaluator issues or null>
              @references/code-playbook.md"
   })
   ```

7. Move manifest: `runs/<run-id>/unit-N-manifest.json`

8. Spawn bonfire-evaluator:
   ```
   Agent({
     subagent_type: "bonfire-evaluator",
     prompt: "Unit definition: <unit JSON>
              Manifest: @.bonfire/runs/<run-id>/unit-N-manifest.json
              Frozen decisions: @.bonfire/plan/compile-output.json#handoff.frozen_product_decisions
              Snapshot: @.bonfire/truth-surface/constraint-ledger-snapshot.json
              @references/code-playbook.md"
   })
   ```

9. Move verdict: `runs/<run-id>/unit-N-verdict.json`

10. **Verdict routing:**

    **PASS:**
    - Git commit (unit-granularity atomic commit)
    - Write `runs/<run-id>/unit-N-pass.json`
    - `state-step --step unit-N --status passed`
    - `preflight-update --field current_focus --value "unit-(N+1)"`
    - `preflight-update --field progress --unit unit-N --status passed`
    - → next unit

    **FAIL + conflict_type != null (constraint violated):**
    - Write `runs/<run-id>/unit-N-reentry.json`
    - `state-pending-reentry --conflict-type <type> --from unit-N --reason <text>`
    - `log-agent --event failed --agent bonfire-evaluator --step unit-N`
    - Output: "Frozen constraint violated (<conflict_type>). Reentry needed. Please execute /bonfire:plan"
    - **HALT — skill terminates**

    **FAIL + conflict_type == null + iteration < max_iterations:**
    - feedback = verdict.issues
    - `log-agent --event failed --agent bonfire-evaluator --step unit-N`
    - → loop start (retry with feedback)

    **FAIL + conflict_type == null + iteration >= max_iterations:**
    - `state-step --step unit-N --status awaiting_user`
    - Output: "unit-N failed after 5 iterations. Please intervene."
    - **HALT — skill pauses**

## Completion

11. All units passed:
    - Run global `verification_commands` from handoff
    - Run `browser_checks` if applicable
    - Write `runs/<run-id>/code-run.json`
    - `state-complete-run --run-id <id> --verdict pending_achieve`
    - Render: `bonfire-tools.cjs render --run <run-id> --note code-run`
    - Output: **"/code complete. Please execute /bonfire:achieve"**

</process>
```

- [ ] **Step 2: Commit**

```bash
git add skills/code/SKILL.md
git commit -m "skills: add /bonfire:code orchestrator"
```

---

### Task 10: /bonfire:achieve + /bonfire:render SKILL.md

**Files:**
- Create: `skills/achieve/SKILL.md`
- Create: `skills/render/SKILL.md`

- [ ] **Step 1: Create directories**

```bash
mkdir -p skills/achieve skills/render
```

- [ ] **Step 2: Write skills/achieve/SKILL.md**

```markdown
---
name: bonfire:achieve
description: "Final validation, acceptance, and archival after /bonfire:code. Verifies bundle integrity, presents acceptance checks, records verdict."
argument-hint: ""
---

<objective>
Determine whether the delivered result satisfies the frozen acceptance meaning from the handoff. Record whether the case should be archived or left open.
</objective>

<execution_context>
Read these references before starting:
- @references/achieve-playbook.md
- @references/ecl-schema.md
</execution_context>

<process>

## Entry Check

1. Read state.json:
   - Verify a completed run exists (runs.completed_runs is non-empty, latest verdict is pending_achieve)
   - Otherwise abort: "Please complete /bonfire:code first"

2. Identify the latest run_id from state.json.

## Step 1: Bundle Integrity

3. ```
   bonfire-tools.cjs bundle-validate
   ```
   - Pass → continue
   - Fail → abort with validation errors

## Step 2: Verification Review

4. Read `runs/<run-id>/code-run.json`
   - Confirm `global_verification == "passed"`
   - Confirm `browser_checks` result (if applicable)

5. Write `runs/<run-id>/verification.json` with verification summary.
   ```
   bonfire-tools.cjs render --run <run-id> --note verification
   ```

## Step 3: Acceptance Verdict

6. `bonfire-tools.cjs state-step --step accept --status awaiting_user`

7. Present to user:
   - List each `acceptance_check` from handoff, one by one
   - Show verification results (already passed)
   - Show any `high_impact_risk` entries (OPEN status) and their current situation
   - Show browser_checks results if applicable

8. User provides verdict:
   - **achieved** — all acceptance checks passed
   - **achieved_with_followups** — passed, with follow-up items noted
   - **not_achieved** — failed

9. Write `runs/<run-id>/achieve.json`:
   ```json
   {
     "verdict": "<user verdict>",
     "acceptance_results": [{"check": "...", "result": "passed|failed"}],
     "followups": ["..."],
     "failure_reason": null,
     "judged_at": "<timestamp>"
   }
   ```

10. ```
    bonfire-tools.cjs render --run <run-id> --note achieve
    ```

## Step 4: Archive Decision

11. **achieved or achieved_with_followups:**
    ```
    bonfire-tools.cjs state-step --step accept --status passed
    bonfire-tools.cjs archive --name <date>-<title>
    ```
    Output: **"Case archived: .bonfire/archive/<name>/. Acceptance recorded."**

12. **not_achieved:**
    ```
    bonfire-tools.cjs state-step --step accept --status gate_failed
    ```
    Output: "Acceptance failed. Case stays active. Options:
    - Re-execute `/bonfire:code` for a new run
    - Reentry to `/bonfire:plan` if semantics need revision"

</process>
```

- [ ] **Step 3: Write skills/render/SKILL.md**

```markdown
---
name: bonfire:render
description: "Manually trigger a full render of all bundle markdown from current JSON state. Use when markdown is out of sync."
argument-hint: "[--note <note-id>] [--run <run-id>]"
---

<objective>
Re-render all bundle markdown files from the current JSON sources. Use this when markdown output is stale or after manual JSON edits.
</objective>

<process>

1. If `--note` is specified:
   ```
   bonfire-tools.cjs render --note <note-id>
   ```

2. If `--run` and `--note` are specified:
   ```
   bonfire-tools.cjs render --run <run-id> --note <note-id>
   ```

3. If no arguments (full render):
   ```
   bonfire-tools.cjs render --all
   ```

4. Check for stale output:
   ```
   bonfire-tools.cjs render-check
   ```

5. Report results to user: which notes were rendered, any that failed.

</process>
```

- [ ] **Step 4: Commit**

```bash
git add skills/achieve/SKILL.md skills/render/SKILL.md
git commit -m "skills: add /bonfire:achieve and /bonfire:render orchestrators"
```

---

### Task 11: Golden Test Case + Smoke Test

**Files:**
- Modify: `examples/sample-case/case.json`
- Create: `examples/sample-case/truth-surface/constraint-ledger-history.jsonl`
- Create: `examples/sample-case/truth-surface/constraint-ledger-snapshot.json`
- Create: `examples/sample-case/plan/bonfire-d-critique-delta.json`
- Create: `tests/test-smoke.js`

- [ ] **Step 1: Create sample truth surface history**

Create `examples/sample-case/truth-surface/constraint-ledger-history.jsonl`:

```jsonl
{"type":"propose","id":"FACT-001","category":"confirmed_fact","status":"PROPOSED","content":"Express.js API exists with standard middleware","rationale":"Verified from repo","source":"stage-a","timestamp":"2026-04-10T09:10:00Z"}
{"type":"propose","id":"CON-001","category":"retained_goal","status":"PROPOSED","content":"Add OAuth2 login with Google and GitHub providers","rationale":"Core user request","source":"stage-a","timestamp":"2026-04-10T09:15:00Z"}
{"type":"propose","id":"CON-002","category":"frozen_constraint","status":"PROPOSED","content":"Use passport.js as OAuth library","rationale":"Approved in Stage A","source":"stage-a","timestamp":"2026-04-10T09:20:00Z"}
{"type":"propose","id":"ACC-001","category":"acceptance_semantic","status":"PROPOSED","content":"OAuth2 login flow completes end-to-end for both providers","rationale":"Primary acceptance criterion","source":"stage-c","timestamp":"2026-04-10T10:00:00Z"}
{"type":"freeze","id":"FACT-001","frozen_at":"2026-04-10T09:30:00Z","timestamp":"2026-04-10T09:30:00Z"}
{"type":"update","id":"CON-001","field":"challenged_by","value":"d-critique","timestamp":"2026-04-10T10:10:00Z"}
{"type":"update","id":"CON-002","field":"challenged_by","value":"d-critique","timestamp":"2026-04-10T10:10:00Z"}
{"type":"update","id":"ACC-001","field":"challenged_by","value":"g-red","timestamp":"2026-04-10T10:30:00Z"}
{"type":"freeze","id":"CON-001","frozen_at":"2026-04-10T10:45:00Z","timestamp":"2026-04-10T10:45:00Z"}
{"type":"freeze","id":"CON-002","frozen_at":"2026-04-10T10:45:00Z","timestamp":"2026-04-10T10:45:00Z"}
{"type":"freeze","id":"ACC-001","frozen_at":"2026-04-10T10:50:00Z","timestamp":"2026-04-10T10:50:00Z"}
{"type":"propose","id":"RISK-001","category":"high_impact_risk","status":"OPEN","content":"Token refresh race condition under concurrent requests","rationale":"Identified by g-red","source":"stage-g","timestamp":"2026-04-10T10:35:00Z"}
```

- [ ] **Step 2: Create sample snapshot**

Create `examples/sample-case/truth-surface/constraint-ledger-snapshot.json`:

```json
{
  "version": 1,
  "replayed_at": "2026-04-10T10:50:00Z",
  "event_count": 12,
  "entries": {
    "FACT-001": {
      "id": "FACT-001",
      "category": "confirmed_fact",
      "status": "FROZEN",
      "content": "Express.js API exists with standard middleware",
      "rationale": "Verified from repo",
      "source": "stage-a",
      "challenged_by": [],
      "aligned_by": [],
      "frozen_at": "2026-04-10T09:30:00Z"
    },
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "status": "FROZEN",
      "content": "Add OAuth2 login with Google and GitHub providers",
      "rationale": "Core user request",
      "source": "stage-a",
      "challenged_by": ["d-critique"],
      "aligned_by": [],
      "frozen_at": "2026-04-10T10:45:00Z"
    },
    "CON-002": {
      "id": "CON-002",
      "category": "frozen_constraint",
      "status": "FROZEN",
      "content": "Use passport.js as OAuth library",
      "rationale": "Approved in Stage A",
      "source": "stage-a",
      "challenged_by": ["d-critique"],
      "aligned_by": [],
      "frozen_at": "2026-04-10T10:45:00Z"
    },
    "ACC-001": {
      "id": "ACC-001",
      "category": "acceptance_semantic",
      "status": "FROZEN",
      "content": "OAuth2 login flow completes end-to-end for both providers",
      "rationale": "Primary acceptance criterion",
      "source": "stage-c",
      "challenged_by": ["g-red"],
      "aligned_by": [],
      "frozen_at": "2026-04-10T10:50:00Z"
    },
    "RISK-001": {
      "id": "RISK-001",
      "category": "high_impact_risk",
      "status": "OPEN",
      "content": "Token refresh race condition under concurrent requests",
      "rationale": "Identified by g-red",
      "source": "stage-g",
      "challenged_by": [],
      "aligned_by": []
    }
  },
  "by_status": {
    "proposed": [],
    "challenged": [],
    "frozen": ["FACT-001", "CON-001", "CON-002", "ACC-001"],
    "superseded": [],
    "open": ["RISK-001"],
    "discarded": []
  },
  "by_category": {
    "confirmed_fact": ["FACT-001"],
    "retained_goal": ["CON-001"],
    "frozen_constraint": ["CON-002"],
    "acceptance_semantic": ["ACC-001"],
    "high_impact_risk": ["RISK-001"],
    "challenged_claim": [],
    "discarded_option": [],
    "dependency_chain": []
  }
}
```

- [ ] **Step 3: Create sample d-critique delta**

Create `examples/sample-case/plan/bonfire-d-critique-delta.json`:

```json
{
  "agent": "bonfire-d-critique",
  "proposals": [],
  "challenges": [
    {
      "target": "CON-001",
      "reason": "OAuth2 goal does not specify token refresh policy or session timeout behavior"
    },
    {
      "target": "CON-002",
      "reason": "passport.js has known issues with concurrent session handling in clustered environments"
    }
  ],
  "alignments": [],
  "follow_up_questions": [
    "What is the expected session duration and refresh policy?"
  ]
}
```

- [ ] **Step 4: Expand case.json with all stages**

Overwrite `examples/sample-case/case.json` with expanded data covering stages preprocess through divergence (enough for smoke test rendering):

```json
{
  "bundle_version": 1,
  "title": "OAuth2 Authentication",
  "created_at": "2026-04-10T09:00:00.000Z",
  "source_request": "Add OAuth2 authentication to the existing Express.js API. Support Google and GitHub providers. Store sessions in PostgreSQL.",
  "project_paths": { "root": "/example/project" },
  "stages": {
    "preprocess": {
      "ambiguity_points": ["Session storage strategy unclear", "Token refresh policy not specified"],
      "reframed_goal": "Add OAuth2 login with Google and GitHub to Express.js API, storing sessions in existing PostgreSQL database",
      "retained_scope": ["OAuth2 code flow for Google and GitHub", "Session persistence in PostgreSQL", "JWT token issuance"],
      "excluded_scope": ["Email/password auth", "SAML/LDAP", "Mobile deep linking"],
      "critical_assumptions": ["PostgreSQL is already running and accessible", "Express.js app uses standard middleware pattern"],
      "frozen_for_code": ["passport.js as OAuth library", "express-session with connect-pg-simple for session store"]
    },
    "divergence": {
      "retained_option": "Option A: passport.js with express-session and connect-pg-simple",
      "options": [
        {
          "title": "Option A: passport.js + express-session",
          "description": "Use passport.js strategies for Google and GitHub, express-session with connect-pg-simple for PostgreSQL session storage",
          "blind_spots_covered": "Session persistence, provider abstraction"
        },
        {
          "title": "Option B: Custom OAuth2 flow",
          "description": "Implement OAuth2 code flow directly using HTTP client, store tokens in PostgreSQL manually",
          "blind_spots_covered": "Full control, no library lock-in"
        },
        {
          "title": "Option C: Auth0 delegation",
          "description": "Delegate authentication to Auth0 hosted login, store Auth0 tokens locally",
          "blind_spots_covered": "Reduced implementation surface, managed security"
        }
      ]
    },
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

- [ ] **Step 5: Write smoke test**

Create `tests/test-smoke.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { renderNote, renderAll, renderCheck } = require('../bin/lib/renderer.cjs');

const SAMPLE_DIR = path.join(__dirname, '..', 'examples', 'sample-case');

// Helper: create a minimal .bonfire structure from sample-case
function setupSampleBonfire(tmpDir) {
  const bonfireDir = path.join(tmpDir, '.bonfire');
  fs.mkdirSync(path.join(bonfireDir, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'plan'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'bundle'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'logs'), { recursive: true });

  // Copy sample files into .bonfire structure
  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'case.json'),
    path.join(bonfireDir, 'case.json')
  );
  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'truth-surface', 'constraint-ledger-snapshot.json'),
    path.join(bonfireDir, 'truth-surface', 'constraint-ledger-snapshot.json')
  );
  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'plan', 'bonfire-d-critique-delta.json'),
    path.join(bonfireDir, 'plan', 'bonfire-d-critique-delta.json')
  );

  return tmpDir;
}

test('renderNote renders overview from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'overview');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('OAuth2 Authentication'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-a from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-a');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('Reframed Goal'));
    assert.ok(content.includes('OAuth2 login'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-b from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-b');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('passport.js'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders constraint-ledger from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'constraint-ledger');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('CON-001'));
    assert.ok(content.includes('RISK-001'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-d from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-d');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('bonfire-d-critique'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderAll renders available notes without errors', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const results = renderAll(tmpDir);
    // Should have some successes (notes with available source data)
    const successes = results.filter(r => r.success);
    assert.ok(successes.length >= 4, `Expected >= 4 successful renders, got ${successes.length}`);
    // overview, constraint-ledger, stage-a, stage-b, stage-d should all succeed
    const successIds = successes.map(r => r.note_id);
    assert.ok(successIds.includes('overview'));
    assert.ok(successIds.includes('constraint-ledger'));
    assert.ok(successIds.includes('stage-a'));
    assert.ok(successIds.includes('stage-b'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderCheck reports stale and missing notes', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    // Before rendering, all should be missing
    const checks = renderCheck(tmpDir);
    const missing = checks.filter(c => c.status === 'missing');
    assert.ok(missing.length > 0, 'Expected missing notes before rendering');

    // Render one note, then check again
    renderNote(tmpDir, 'overview');
    const checksAfter = renderCheck(tmpDir);
    const overviewCheck = checksAfter.find(c => c.note_id === 'overview');
    assert.ok(overviewCheck && overviewCheck.status === 'ok', 'overview should be ok after render');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add examples/sample-case/ tests/test-smoke.js
git commit -m "test: add golden test case data and smoke tests for render pipeline"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Verify file counts**

```bash
ls templates/    # Expect 22 files (21 new + 1 existing constraint-ledger.md)
ls skills/       # Expect 5 directories (pre, plan, code, achieve, render)
ls agents/       # Expect 10 files (from Plan 4)
ls references/   # Expect 9 files + .gitkeep (from Plan 4)
```

- [ ] **Step 2: Run all tests**

```bash
node --test tests/*.js
```

Expected: All existing 86 tests pass + 7 new smoke tests = 93 total.
