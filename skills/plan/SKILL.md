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
