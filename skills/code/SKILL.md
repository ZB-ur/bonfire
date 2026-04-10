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
- @$HOME/.claude/bonfire/references/code-playbook.md
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
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
   bonfire state-init-code-steps
   bonfire state-begin-run --run-id run-<timestamp>
   ```

## Unit Execution Loop

For each unit in `handoff.implementation_units` (dependency order from execution_manifest):

4. Set iteration = 0, max_iterations = 5, feedback = null

5. **Loop start:**
   ```
   iteration += 1
   bonfire state-step --step unit-N --status running
   ```

6. Spawn bonfire-coder:
   ```
   Agent({
     subagent_type: "bonfire-coder",
     prompt: "Unit definition: <unit JSON>
              Handoff: @.bonfire/plan/compile-output.json#handoff
              Preflight: @.bonfire/plan/compile-output.json#code_preflight
              Feedback: <previous evaluator issues or null>
              @$HOME/.claude/bonfire/references/code-playbook.md"
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
              @$HOME/.claude/bonfire/references/code-playbook.md"
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
    - Render: `bonfire render --run <run-id> --note code-run`
    - Output: **"/code complete. Please execute /bonfire:achieve"**

</process>
