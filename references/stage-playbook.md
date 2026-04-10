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
