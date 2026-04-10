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

As answers come in, the parent skill should propose truth surface entries using the full command format:

```
bonfire truth-propose --id <ID> --category <cat> --content "..." --rationale "..." --source stage-a
```

ID naming conventions by category:
- `FACT-NNN` — confirmed_fact
- `CON-NNN` — retained_goal, frozen_constraint
- `CLAIM-NNN` — challenged_claim
- `RISK-NNN` — high_impact_risk
- `DEP-NNN` — dependency_chain
- `ACC-NNN` — acceptance_semantic
- `DROP-NNN` — discarded_option

Example:
```
bonfire truth-propose --id FACT-001 --category confirmed_fact --content "PostgreSQL 14.2 running" --rationale "Verified from docker-compose.yaml" --source stage-a
```

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

- `bonfire truth-freeze --id <ID>` for each `confirmed_fact` entry
- `bonfire truth-propose --id <ID> --category retained_goal --content "..." --rationale "..." --source stage-a` for remaining goals
- `bonfire truth-propose --id <ID> --category acceptance_semantic --content "..." --rationale "..." --source stage-a` for acceptance criteria
- `bonfire state-step --step stage-a --status passed`
- `bonfire state-advance --step stage-a`

Output: "Stage A passed. Please execute /bonfire:plan"
