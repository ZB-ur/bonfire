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
- @$HOME/.claude/bonfire/references/approval-gate.md
- @$HOME/.claude/bonfire/references/stage-playbook.md
- @$HOME/.claude/bonfire/references/diagnosis-and-observability.md (only for bug/diagnosis requests)
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>

<process>

## Startup

1. Check for pending_reentry in state.json:
   - If `pending_reentry.target_pipeline == "pre"`: execute `bonfire state-reentry --conflict-type <type>`, then `bonfire state-clear-reentry`. Resume from stage-a.
   - If `pending_reentry` exists but targets a different pipeline: abort with "pending reentry target is /bonfire:<target>".
   - If no pending_reentry: proceed normally.

2. If this is a new case (no `.bonfire/state.json`):
   ```
   bonfire init --request "<user request>" --project-root <path>
   ```

3. Set step status:
   ```
   bonfire state-step --step stage-a --status running
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
    bonfire state-step --step stage-a --status awaiting_user
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

15. Render: `bonfire render --note stage-a`

16. Present approval pack to user. Wait for explicit approval.

## Gate

17. If user approves:
    - `truth-freeze` all `confirmed_fact` entries
    - `truth-propose` remaining `retained_goal` and `acceptance_semantic` entries
    - `bonfire state-step --step stage-a --status passed`
    - `bonfire state-advance --step stage-a`
    - `bonfire render --note overview`
    - Output: **"Stage A passed. Please execute /bonfire:plan"**

18. If user rejects: return to step 11 (user interaction loop).

</process>
