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
