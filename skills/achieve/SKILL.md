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