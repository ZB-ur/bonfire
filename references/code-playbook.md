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

Complete conflict_type → stage mapping (from `bonfire-v1.json` route table):

| conflict_type | Target Stage | Crosses Pipeline |
|---------------|-------------|-----------------|
| `goal_conflict` | stage-a | yes (resets to /bonfire:pre) |
| `scope_conflict` | stage-b | no |
| `requirement_conflict` | stage-c | no |
| `critique_gap` | stage-d | no |
| `dependency_gap` | stage-e | no |
| `probe_invalidated` | stage-f | no |
| `adversarial_unresolved` | stage-g | no |
| `handoff_incomplete` | stage-h | no |
| `handoff_contradiction` | stage-j | no |

## Completion

When all units pass:

1. Run global `verification_commands`
2. Run `browser_checks` (if applicable)
3. Write `runs/<run-id>/code-run.json`
4. `state-complete-run --run-id <id> --verdict pending_achieve`
5. Output: "/code complete. Please execute /bonfire:achieve"
