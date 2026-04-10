# Subagent Protocol

## Contents

- General rules
- Agent categories
- Delta JSON schema
- Per-agent constraints
- Tool permissions
- Output capture flow
- Failure handling

## General Rules

- D, G-Red, G-Blue, H, and J require real spawned agents (Claude Code `Agent()` tool).
- A may use support agents, but the parent skill remains the owner of preprocessing.
- Pass only stage-local context to agents:
  - constraint-ledger-snapshot.json (current truth surface state)
  - relevant source artifacts (case.json sections, agent deltas)
  - local repo/docs/config facts needed for that stage
- Do not pass the parent's preferred answer to independent agents.
- Parent skill is the only writer to truth surface and bundle notes (Father Model).
- Agents return structured JSON deltas only. They do not return finished notes or markdown.

## Agent Categories

### Support Agents (Stage A)

| Property | Value |
|----------|-------|
| Required? | Optional (parent can complete A alone) |
| Parallelism | intent-extractor + reality-checker parallel, then blind-spot-scout serial |
| Delta validation | Lenient (no "required >= 1" constraint) |
| Output destination | Merged into question list, no direct truth surface mutation |

### Independent Agents (D/G/H/J)

| Property | Value |
|----------|-------|
| Required? | Required (cannot skip) |
| Parallelism | Strictly sequential: D → G-Red → G-Blue → H → J |
| Delta validation | Strict (per-agent constraint table below) |
| Output destination | Parent executes truth surface mutations from delta |

## Delta JSON Schema

All independent agents (D/G-Red/G-Blue) output a JSON object with this shape:

```json
{
  "agent": "<agent-name>",
  "proposals": [
    {
      "id": "CON-007",
      "category": "frozen_constraint",
      "content": "...",
      "rationale": "..."
    }
  ],
  "challenges": [
    { "target": "CON-003", "reason": "..." }
  ],
  "alignments": [
    { "target": "CON-001", "evidence": "..." }
  ],
  "follow_up_questions": [
    "..."
  ]
}
```

Validation is performed by `bonfire-tools.cjs delta-validate --agent <name>`.

## Per-Agent Delta Constraints

| Agent | proposals | challenges | alignments | follow_up | verdict |
|-------|-----------|------------|------------|-----------|---------|
| D-Critique | allowed | **required >= 1** | allowed | allowed | — |
| G-Red | allowed | **required >= 1** | — | allowed | — |
| G-Blue | allowed | — | **required >= 1** | allowed | — |
| H-Review | — | — | — | — | **required** |
| J-Compile | — | — | — | — | produces compile-output.json |

"Required" means `delta-validate` rejects the output if the field is missing or empty.

## Tool Permissions

| Agent | Read | Bash | Write | Glob | Grep |
|-------|------|------|-------|------|------|
| D-Critique | yes | no | no | yes | yes |
| G-Red | yes | no | no | yes | yes |
| G-Blue | yes | no | no | yes | yes |
| H-Review | yes | no | yes (h-review-verdict.json only) | yes | yes |
| J-Compile | yes | no | yes (compile-output.json only) | yes | yes |
| Coder | yes | yes | yes | yes | yes |
| Evaluator | yes | yes | yes (evaluator-verdict.json only) | yes | yes |

D/G-Red/G-Blue have no Write permission. They return delta JSON through the Agent() return value. Parent persists it.

## Output Capture Flow

### D/G-Red/G-Blue (no Write permission)

1. `Agent()` returns JSON text
2. Parent: `JSON.parse()` → delta object
3. Parent: `bonfire-tools.cjs delta-validate --agent <name>` (pure schema check)
4. Parent: write raw JSON to `.bonfire/plan/<agent-name>-delta.json` (audit)
5. Parent: execute truth surface mutations based on delta

### H-Review (Write permission for verdict only)

1. Agent writes `.bonfire/plan/h-review-verdict.json` directly
2. Parent: read → `JSON.parse()` → `delta-validate --agent bonfire-h-review`
3. Parent: execute rulings (freeze/supersede)

### J-Compile (Write permission for compile-output only)

1. Agent writes `.bonfire/plan/compile-output.json` directly
2. Parent: read → `JSON.parse()` → `handoff-validate`
3. Dual-write hook → renderer splits into 8 markdown files in bundle/

## Failure Handling

- If a required agent cannot be spawned or times out:
  - Log: `bonfire-tools.cjs log-agent --event failed --agent <name> --step <step> --error <text>`
  - Set step status: `state-step --step <step> --status gate_failed`
  - Do not proceed to dependent stages.
  - Report to user with guidance on retrying.

- If agent output fails delta validation:
  - Log the validation errors.
  - Retry the agent once with validation feedback.
  - If second attempt also fails: `state-step --step <step> --status gate_failed`.

## Agent ID Collision Prevention

On reentry, agents use `-R<depth>` suffix for new IDs to avoid collisions with prior run IDs:

- First pass: `CON-001`, `CON-002`, ...
- Reentry depth 1: `CON-003-R1`, `CON-004-R1`, ...
- Reentry depth 2: `CON-005-R2`, ...
