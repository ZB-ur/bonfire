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
- @$HOME/.claude/bonfire/references/stage-playbook.md
- @$HOME/.claude/bonfire/references/subagent-protocol.md
- @$HOME/.claude/bonfire/references/handoff-quality-bar.md
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>

<process>

## Startup

1. Check pending_reentry:
   - If `pending_reentry.target_pipeline == "plan"`: execute `bonfire state-reentry --conflict-type <type>`, then `bonfire state-clear-reentry`. Jump to the target step.
   - If `pending_reentry` targets a different pipeline: abort.
   - If no pending_reentry: validate `pipeline_stage == "plan"` or `stage-a.status == "passed"`.

2. Read state.json to determine current_step. Resume from there.

## Stage B — Divergence

3. `bonfire state-step --step stage-b --status running`

4. Parent executes (no agent):
   - Read case.json#stages.preprocess and truth surface snapshot
   - Generate >= 3 materially different options (not style variants)
   - Each option must explain which blind spots it covers
   - Retain exactly one path

5. Write to case.json#stages.divergence. Render: `bonfire render --note stage-b`

6. Gate: >= 3 options, 1 retained → `state-step --step stage-b --status passed`, `state-advance --step stage-b`

## Stage C — Requirements

7. `bonfire state-step --step stage-c --status running`

8. Parent executes (no agent):
   - Decompose retained option into requirement units
   - Each unit needs success criteria
   - Batch truth-propose: retained_goal, frozen_constraint, dependency_chain, acceptance_semantic

9. Write to case.json#stages.requirements. Render: `bonfire render --note stage-c`

10. Gate: all requirement units have success criteria → advance

## Stage D — Critique

11. `bonfire state-step --step stage-d --status awaiting_agent`

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
    bonfire delta-validate --agent bonfire-d-critique --file .bonfire/plan/bonfire-d-critique-delta.json
    ```

15. Write delta to `.bonfire/plan/bonfire-d-critique-delta.json`

16. Execute truth surface mutations:
    - For each proposal: `truth-propose`
    - For each challenge: `truth-update --id <target> --field challenged_by --value d-critique`

17. Render: `bonfire render --note stage-d`

18. Gate: >= 1 challenge integrated → advance

## Stage E — Closure

19. `bonfire state-step --step stage-e --status running`

20. Parent executes: close dependency chain gaps, convert to dependency-aware execution chain.

21. Write to case.json#stages.closure. Render: `bonfire render --note stage-e`

22. Gate: all dependency_chain entry refs valid → advance

## Stage F — Probes

23. `bonfire state-step --step stage-f --status running`

24. Parent executes: run executable validation (repo inspection, scripts, tests, environment checks). Record hypothesis, method, expected signal, kill criteria, result.

25. Write to case.json#stages.probes. Render: `bonfire render --note stage-f`

26. Gate: all probes have results or inability records → advance

## Stage G — Red-Blue

27. `bonfire state-step --step stage-g --status awaiting_agent`

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

32. **Truth-Freeze Gate:** run `bonfire stage-g-freeze-gate`.
    - Exit 0 → all eligible PROPOSED/CHALLENGED entries are now FROZEN
      (high_impact_risk stays OPEN by design).
    - Non-zero exit → the command lists CHALLENGED entries without
      alignment. Return these to G-Blue for defense, or escalate to
      H-Review. Do not proceed until the command exits 0.

33. Render: `bonfire render --note stage-g`

34. Gate: red/blue complete + residual risks recorded + freeze verification passed → advance. `state-advance --step stage-g` now enforces the invariant: if any entry is still PROPOSED or CHALLENGED (excluding `high_impact_risk`), advance is refused and the command prints the offending ids.

## Stage H — Review

35. `bonfire state-step --step stage-h --status awaiting_agent`

36. Spawn bonfire-h-review:
    ```
    Agent({
      subagent_type: "bonfire-h-review",
      prompt: "<input>@.bonfire/truth-surface/constraint-ledger-snapshot.json, @.bonfire/case.json, all plan/ deltas, @$HOME/.claude/bonfire/references/handoff-quality-bar.md</input>"
    })
    ```

37. Read `.bonfire/plan/h-review-verdict.json`. Validate:
    ```
    bonfire delta-validate --agent bonfire-h-review --file .bonfire/plan/h-review-verdict.json
    ```

38. **Apply rulings:** run `bonfire apply-h-rulings`.
    - Exit 0 → all freeze/supersede rulings are materialized in the
      ledger (auto-alignment via `stage-h-ruling` token is handled
      internally for unchallenged targets).
    - Non-zero exit → pre-validation surfaced a problem (missing id,
      supersede precondition, etc.). Inspect stderr, revise the verdict
      if the rulings themselves are wrong, and re-run. Do not retry
      blindly.

39. Render: `bonfire render --note stage-h`

40. Verdict routing:
    - `approved` → advance to stage-j
    - `approved_with_conditions` → record conditions, advance to stage-j
    - `rejected` → `bonfire state-reentry --conflict-type <verdict.conflict_type>`, log, resume from target step

    Note: `state-advance --step stage-h` enforces that every `freeze`/`supersede` ruling in the verdict is satisfied by the current ledger snapshot. A verdict with empty `rulings` passes trivially; redundant rulings (target already FROZEN by Stage G) are trivially satisfied without requiring `apply-h-rulings`.

## Stage J — Compile

41. `bonfire state-step --step stage-j --status awaiting_agent`

42. Spawn bonfire-j-compile:
    ```
    Agent({
      subagent_type: "bonfire-j-compile",
      prompt: "<input>snapshot, case.json, all deltas, verdict (with conditions if any), @$HOME/.claude/bonfire/references/handoff-quality-bar.md</input>"
    })
    ```

43. Read `.bonfire/plan/compile-output.json`. Validate:
    ```
    bonfire handoff-validate
    ```

44. Render all companion notes from compile-output.json:
    ```
    bonfire render --note code-handoff
    bonfire render --note canonical-contracts
    bonfire render --note constraint-crosswalk
    bonfire render --note execution-manifest
    bonfire render --note code-batches
    bonfire render --note code-preflight
    bonfire render --note compile-for-code
    bonfire render --note final-handoff
    ```
    Or simply: `bonfire render --all`

45. Gate: handoff passes validation, code_ready=true → advance
    - Gate failed: `state-reentry --conflict-type handoff_incomplete`, resume from stage-h

46. Output: **"Planning complete. code_ready=true. Please execute /bonfire:code"**

</process>
