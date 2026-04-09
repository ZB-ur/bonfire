# Bonfire: ECL Pipeline as Claude Code Plugin

**Date:** 2026-04-10
**Author:** ZB-ur
**Status:** Design approved, pending implementation plan

## Overview

Bonfire is a native Claude Code plugin that reimplements the Evolution Constraint Planner (ECL) as a skill + agents system. It is a cybernetics-based development pipeline that prevents semantic drift through constraint-led planning, adversarial review, frozen handoff, and acceptance-driven closure.

**Core invariant:** The coding stage must never be forced to invent high-impact product meaning.

**Relationship to ECL:** Full-fidelity reimplementation of ECL's 10-stage pipeline (A→J), replacing the Python CLI + SKILL.md implementation with Claude Code native primitives (skills, agents, hooks, Node.js CLI).

**Relationship to Detent:** Independent implementation borrowing Detent's validated patterns (truth surface dual-layer, father model, adversarial agent loop), but built from scratch with ECL's complete semantics.

### Deferred to v2

| Item | ECL equivalent | Reason |
|------|---------------|--------|
| Canvas rendering | Obsidian Canvas visual overview | Add when kanban features needed |
| docs/ documentation | 4 articles x 2 languages | Add after plugin stabilizes |
| OpenSpec export | openspec-mapping.md | Optional export format |

---

## Section 1: Plugin Structure

```
bonfire/
├── .claude-plugin/
│   └── plugin.json                    # Plugin manifest
├── schemas/
│   └── bonfire-v1.json                # Bundle structure contract: note definitions,
│                                      # numbering map, dependency chains, block_key,
│                                      # delta schemas, reentry route table
├── skills/
│   ├── pre/SKILL.md                   # /bonfire:pre — Stage A orchestrator
│   ├── plan/SKILL.md                  # /bonfire:plan — Stage B→J orchestrator
│   ├── code/SKILL.md                  # /bonfire:code — Frozen execution
│   ├── achieve/SKILL.md               # /bonfire:achieve — Acceptance closure
│   └── render/SKILL.md               # /bonfire:render — Manual full render
├── agents/
│   ├── bonfire-intent-extractor.md    # Stage A support: infer real goals
│   ├── bonfire-reality-checker.md     # Stage A support: repo reality check
│   ├── bonfire-blind-spot-scout.md    # Stage A support: blind spot scan
│   ├── bonfire-d-critique.md          # Stage D: independent requirement attack
│   ├── bonfire-g-red.md               # Stage G: red team attack
│   ├── bonfire-g-blue.md              # Stage G: blue team defense
│   ├── bonfire-h-review.md            # Stage H: code-readiness verdict
│   ├── bonfire-j-compile.md           # Stage J: compile to code handoff
│   ├── bonfire-coder.md               # /code: execute implementation units
│   └── bonfire-evaluator.md           # /code: verify implementation units
├── hooks/
│   └── bonfire-dual-write.js          # PostToolUse: JSON→Markdown real-time render
├── bin/
│   ├── bonfire-tools.cjs              # Core CLI entry point
│   └── lib/
│       ├── truth-surface.cjs          # JSONL history + ledger regeneration
│       ├── state.cjs                  # Pipeline state machine
│       ├── renderer.cjs               # JSON → Markdown (loads numbering from bonfire-v1.json)
│       ├── delta-parser.cjs           # Agent JSON delta schema validation
│       ├── schema.cjs                 # Loads bonfire-v1.json, validates case/handoff
│       └── logger.cjs                 # Append-only audit log
├── references/                        # 9 behavioral contracts
│   ├── stage-playbook.md              # A→J stage execution rules
│   ├── subagent-protocol.md           # Agent independence rules + delta JSON format
│   ├── handoff-quality-bar.md         # code_ready=true freeze conditions
│   ├── code-playbook.md               # /code strict execution rules
│   ├── achieve-playbook.md            # Acceptance closure rules
│   ├── approval-gate.md               # Stage A approval gate rules
│   ├── ecl-schema.md                  # Case JSON + handoff structure definitions
│   ├── obsidian-layout.md             # Render output folder layout spec
│   └── diagnosis-and-observability.md # Bug/regression diagnosis guidance
├── templates/                         # 22 render templates
│   ├── overview.md
│   ├── stage-a.md                     # 9 stage templates (A-H + J, skip I)
│   ├── stage-b.md
│   ├── stage-c.md
│   ├── stage-d.md
│   ├── stage-e.md
│   ├── stage-f.md
│   ├── stage-g.md
│   ├── stage-h.md
│   ├── stage-j.md
│   ├── constraint-ledger.md
│   ├── code-handoff.md
│   ├── canonical-contracts.md
│   ├── code-batches.md
│   ├── code-preflight.md
│   ├── constraint-crosswalk.md
│   ├── execution-manifest.md
│   ├── final-handoff.md
│   ├── code-run.md                    # Runs/ execution record
│   ├── verification.md                # Runs/ verification result
│   ├── reentry.md                     # Runs/ reentry request
│   └── achieve.md                     # Runs/ acceptance verdict
├── examples/
│   └── sample-case/                   # Golden test case
│       ├── case.json
│       ├── request.txt
│       └── bundle/
└── tests/
    └── test-smoke.js
```

### Plugin Manifest

```json
{
  "name": "bonfire",
  "description": "Cybernetics-based development pipeline for Claude Code. Constraint-led planning, adversarial review, frozen handoff, acceptance-driven closure.",
  "version": "0.1.0",
  "author": {
    "name": "ZB-ur"
  },
  "license": "MIT",
  "keywords": ["cybernetics", "planning", "adversarial", "constraint", "pipeline"]
}
```

### Target Project Artifact Directory

One active case per repo. Completed cases are archived.

```
.bonfire/
├── state.json
├── case.json
├── truth-surface/
│   ├── constraint-ledger-history.jsonl
│   ├── constraint-ledger-snapshot.json
│   └── constraint-ledger.md
├── plan/
│   ├── bonfire-d-critique-delta.json
│   ├── bonfire-g-red-delta.json
│   ├── bonfire-g-blue-delta.json
│   ├── h-review-verdict.json
│   └── compile-output.json
├── bundle/
│   ├── 00-overview.md
│   ├── 05-constraint-ledger.md
│   ├── 10-a-preprocess.md
│   ├── 20-b-divergence.md
│   ├── 30-c-requirements.md
│   ├── 40-d-critique.md
│   ├── 50-e-closure.md
│   ├── 60-f-probes.md
│   ├── 70-g-red-blue.md
│   ├── 80-h-review.md
│   ├── 90-code-handoff.md
│   ├── 91-canonical-contracts.md
│   ├── 92-constraint-crosswalk.md
│   ├── 95-execution-manifest.md
│   ├── 96-code-batches.md
│   ├── 97-code-preflight.md
│   ├── 98-j-compile-for-code.md
│   └── 99-final-handoff.md
├── runs/
│   └── run-001/
│       ├── unit-1-manifest.json
│       ├── unit-1-verdict.json
│       ├── unit-1-pass.json
│       ├── ...
│       ├── browser-checks.json
│       ├── code-run.json
│       ├── verification.json
│       ├── achieve.json
│       ├── 00-code-run.md
│       ├── 01-verification.md
│       ├── 02-reentry.md          # if applicable
│       └── 03-achieve.md
├── logs/
│   ├── render.jsonl
│   ├── state-transitions.jsonl
│   └── agent-invocations.jsonl
└── archive/
    └── 2026-04-10-user-auth/      # archived old cases
```

---

## Section 2: Truth Surface Dual-Layer System

### 2.1 Three-Layer Architecture

```
Layer 0  (JSONL History)  — Immutable append log, complete audit trail
Layer 0' (Snapshot JSON)  — Regenerated from history, agents read this
Layer 1  (Markdown)       — Rendered from snapshot, humans/Obsidian read this
```

```
truth-propose → append to history.jsonl
                  → replay all events → regenerate snapshot.json (write-then-rename)
                    → render constraint-ledger.md (dual-write)
```

**Core invariant: snapshot and markdown can always be fully regenerated from history.jsonl. History is the sole truth source.**

### 2.2 Eight Semantic Categories

Each entry has a `category` field with distinct lifecycle rules:

| Category | Maturity Gate | Can Freeze? | Description |
|----------|-------------|-------------|-------------|
| `retained_goal` | challenged_by non-empty | Yes | User's real goals |
| `confirmed_fact` | source must contain repo evidence | Yes (no challenged_by needed) | Repo/environment facts |
| `frozen_constraint` | challenged_by non-empty | Yes | Immutable constraints |
| `challenged_claim` | Stays CHALLENGED until resolved | Resolves by reclassifying to another category | Questioned user claims |
| `discarded_option` | rationale non-empty | No (terminal state = DISCARDED) | Eliminated paths with reasons |
| `high_impact_risk` | Never freezes | No (stays OPEN permanently) | Explicit remaining uncertainty |
| `dependency_chain` | Upstream/downstream ID refs valid | Yes | End-to-end dependencies |
| `acceptance_semantic` | challenged_by non-empty | Yes | Success criteria definitions |

### 2.3 Entry Lifecycle by Category

```
retained_goal:       PROPOSED → CHALLENGED → FROZEN
confirmed_fact:      PROPOSED → FROZEN (repo evidence sufficient, no adversarial review needed)
frozen_constraint:   PROPOSED → CHALLENGED → FROZEN
challenged_claim:    CHALLENGED (stays until resolved, then reclassified)
discarded_option:    DISCARDED (terminal, with rationale)
high_impact_risk:    OPEN (permanent, never freezes, /code must explicitly address)
dependency_chain:    PROPOSED → FROZEN (reference validity check)
acceptance_semantic: PROPOSED → CHALLENGED → FROZEN
```

### 2.4 JSONL Event Schema

Six event types:

```jsonl
{"type":"propose","id":"CON-001","category":"retained_goal","status":"PROPOSED","content":"...","rationale":"...","source":"stage-c","timestamp":"2026-04-10T10:00:00Z"}
{"type":"update","id":"CON-001","field":"challenged_by","value":"d-critique","timestamp":"2026-04-10T10:05:00Z"}
{"type":"annotate","id":"CON-001","field":"evidence_refs","value":"stage-f-probe-3","timestamp":"2026-04-10T10:20:00Z"}
{"type":"freeze","id":"CON-001","frozen_at":"2026-04-10T10:15:00Z","timestamp":"2026-04-10T10:15:00Z"}
{"type":"supersede","id":"CON-002","supersedes":"CON-001","content":"...","rationale":"...","timestamp":"2026-04-10T11:00:00Z"}
{"type":"discard","id":"DROP-001","category":"discarded_option","content":"...","rationale":"...","timestamp":"..."}
```

| Type | Semantics | Precondition | Writable Fields |
|------|-----------|-------------|-----------------|
| `propose` | Create entry | None | All |
| `update` | Set field | Entry exists AND not FROZEN | Any field |
| `annotate` | Append metadata to frozen entry | Entry is FROZEN (or any terminal state) | Whitelist only: evidence_refs, aligned_by, notes |
| `freeze` | Transition to FROZEN | Category-specific maturity gate | None (status change only) |
| `supersede` | Old→SUPERSEDED, new→FROZEN | Old entry must be FROZEN | None (creates new entry) |
| `discard` | Terminal DISCARDED state | rationale non-empty | None (terminal) |

**`challenged_by` and `aligned_by` are arrays.** `truth-update` appends to these fields, not overwrites. Maturity gate checks `challenged_by.length > 0`.

**`annotate` rejects fields not in whitelist** (evidence_refs, aligned_by, notes). Content, rationale, and other semantic fields are immutable once frozen.

### 2.5 Snapshot JSON Structure

Regenerated from history replay. Agents read this directly.

```json
{
  "version": 1,
  "replayed_at": "2026-04-10T10:15:00Z",
  "event_count": 12,
  "entries": {
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "status": "FROZEN",
      "content": "User auth must support OAuth2",
      "rationale": "Core business requirement, non-negotiable",
      "source": "stage-c",
      "challenged_by": ["d-critique", "g-red"],
      "aligned_by": ["g-blue"],
      "frozen_at": "2026-04-10T10:15:00Z",
      "evidence_refs": ["stage-f-probe-result-1"]
    }
  },
  "by_status": {
    "proposed": ["CON-003", "DEP-002"],
    "challenged": ["CON-002"],
    "frozen": ["CON-001", "FACT-001", "ACC-001"],
    "superseded": ["CON-000"],
    "open": ["RISK-001"],
    "discarded": ["DROP-001"]
  },
  "by_category": {
    "retained_goal": ["CON-001", "CON-002", "CON-003"],
    "confirmed_fact": ["FACT-001"],
    "high_impact_risk": ["RISK-001"],
    "discarded_option": ["DROP-001"],
    "dependency_chain": ["DEP-002"],
    "acceptance_semantic": ["ACC-001"]
  }
}
```

### 2.6 Father Model Pattern

**Agents only produce deltas (proposals and challenges). Parent skill is the sole executor of truth surface mutations.**

```
Agent output (JSON delta)
  → parent: JSON.parse()
    → parent: delta-parser.cjs validate (schema check)
      → parent calls truth-propose / truth-update / truth-freeze
        → history.jsonl append
          → snapshot.json regenerate (write-then-rename)
            → constraint-ledger.md render (dual-write hook)
```

Agents **cannot**: write any .bonfire/ file directly, call truth-* CLI commands, modify existing entry semantics.

Agents **can only**: read snapshot.json, output structured JSON delta.

### 2.7 Atomic Writes

All critical files use write-then-rename pattern:

```javascript
function writeAtomic(filePath, data) {
  const tmp = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);  // POSIX atomic
}
```

Applies to: `constraint-ledger-snapshot.json`, `state.json`, `case.json`, `compile-output.json`.

`history.jsonl` is append-only, uses `fs.appendFileSync`.

---

## Section 3: Pipeline State Machine

### 3.1 State Model

```json
{
  "version": 1,
  "created_at": "2026-04-10T09:00:00Z",
  "updated_at": "2026-04-10T12:30:00Z",
  "pipeline_stage": "plan",
  "current_step": "stage-g",
  "steps": {
    "stage-a": { "status": "passed", "passed_at": "2026-04-10T09:45:00Z" },
    "stage-b": { "status": "passed", "passed_at": "2026-04-10T10:00:00Z" },
    "stage-c": { "status": "passed", "passed_at": "2026-04-10T10:15:00Z" },
    "stage-d": { "status": "passed", "passed_at": "2026-04-10T10:25:00Z" },
    "stage-e": { "status": "passed", "passed_at": "2026-04-10T10:35:00Z" },
    "stage-f": { "status": "passed", "passed_at": "2026-04-10T10:50:00Z" },
    "stage-g": { "status": "awaiting_agent", "started_at": "2026-04-10T11:00:00Z" },
    "stage-h": { "status": "pending" },
    "stage-j": { "status": "pending" }
  },
  "approval": {
    "stage_a_approved": true,
    "stage_a_approved_at": "2026-04-10T09:45:00Z"
  },
  "reentry": {
    "depth": 0,
    "max_depth": 2,
    "history": []
  },
  "pending_reentry": null,
  "runs": {
    "current_run_id": null,
    "completed_runs": []
  }
}
```

`current_step` is a convenience field. `steps` map is the authoritative data source. When inconsistent, `steps` wins.

### 3.2 Pipeline Stages and Step Mapping

```
/bonfire:pre    → pipeline_stage: "pre"
                  steps: [stage-a]

/bonfire:plan   → pipeline_stage: "plan"
                  steps: [stage-b, stage-c, stage-d, stage-e, stage-f, stage-g, stage-h, stage-j]

/bonfire:code   → pipeline_stage: "code"
                  steps: [unit-1, unit-2, ... unit-N] (dynamically generated from handoff)

/bonfire:achieve → pipeline_stage: "achieve"
                   steps: [verify, accept, archive]
```

### 3.3 Step State Machine

```
pending → running → awaiting_agent → integrating → gate_check → passed
                  ↘ awaiting_user ↗                     │
                                                   gate_failed
```

| Status | Meaning | Trigger |
|--------|---------|---------|
| `pending` | Waiting for prior step | Init |
| `running` | Parent skill executing | Skill orchestrator |
| `awaiting_agent` | Agent spawned, waiting for output | Skill spawn Agent() |
| `awaiting_user` | Needs human decision | Stage A approval, reentry depth exceeded, /code iteration exhausted, /achieve acceptance |
| `integrating` | Agent delta returned, parent executing truth surface mutations | delta-parser + truth-* commands |
| `gate_check` | Exit gate validating | Skill orchestrator |
| `passed` | Step complete | Gate passed |
| `gate_failed` | Gate failed, needs reentry | Gate failed |

### 3.4 Exit Gate Rules

| Step | Exit Gate | Failure Reentry |
|------|-----------|----------------|
| stage-a | User explicitly approves approval pack | — (must pass) |
| stage-b | >= 3 materially different options, 1 retained | stage-a |
| stage-c | All requirement units have success criteria | stage-b |
| stage-d | d-critique agent returned delta, >= 1 challenge integrated | stage-c |
| stage-e | Dependency chain has no gaps (all dependency_chain refs valid) | stage-c |
| stage-f | All probes have results or inability-to-probe records | stage-e |
| stage-g | Red/blue complete + residual risks recorded + all mature CHALLENGED entries frozen (high_impact_risk stays OPEN) | stage-d |
| stage-h | h-review verdict = approved or approved_with_conditions | verdict's conflict_type → route table |
| stage-j | compile-output.json passes schema validation, code_ready=true | stage-h (handoff_incomplete) |
| unit-N | evaluator verdict = PASS | Retry (max 5) or reentry to plan |
| verify | All verification_commands pass | — |
| accept | Acceptance verdict recorded | — |
| archive | Archived or explicitly marked not_achieved | — |

### 3.5 Unified Conflict Type Enum and Route Table

H-Review and Evaluator share the same route table. Defined in `bonfire-v1.json`.

```javascript
const REENTRY_ROUTES = {
  "goal_conflict":          { to: "stage-a", crosses_pipeline: true  },
  "scope_conflict":         { to: "stage-b", crosses_pipeline: false },
  "requirement_conflict":   { to: "stage-c", crosses_pipeline: false },
  "critique_gap":           { to: "stage-d", crosses_pipeline: false },
  "dependency_gap":         { to: "stage-e", crosses_pipeline: false },
  "probe_invalidated":      { to: "stage-f", crosses_pipeline: false },
  "adversarial_unresolved": { to: "stage-g", crosses_pipeline: false },
  "handoff_incomplete":     { to: "stage-h", crosses_pipeline: false },
  "handoff_contradiction":  { to: "stage-j", crosses_pipeline: false }
};
```

Both H-Review verdicts and Evaluator verdicts use `conflict_type` from this enum. No special-case routing.

### 3.6 Reentry Mechanism

Dynamic range reset based on `conflict_type`:

```javascript
const ordered = ["stage-b","stage-c","stage-d","stage-e","stage-f","stage-g","stage-h","stage-j"];
const from = ordered.indexOf(REENTRY_ROUTES[conflict_type].to);
const to = ordered.indexOf(current_step);

for (let i = from; i <= to; i++) {
  steps[ordered[i]] = { status: "pending" };
}
state.current_step = REENTRY_ROUTES[conflict_type].to;
state.reentry.depth += 1;
state.reentry.history.push({ from: current_step, to: target, conflict_type, reason, depth });
```

If `reentry.depth > reentry.max_depth` (default 2): halt, set step to `awaiting_user`.

If `conflict_type` is `goal_conflict` (`crosses_pipeline: true`): reset all steps, clear `approval.stage_a_approved`, set `pipeline_stage` back to `"pre"`.

Agent ID collision prevention on reentry: agents use `-R<depth>` suffix for new IDs (e.g., `CON-003-R1`).

### 3.7 Cross-Skill Reentry Protocol

Each skill can only operate within its own `pipeline_stage`. Cross-stage reentry uses `pending_reentry` signal + user manual switch.

When `/bonfire:code` evaluator returns a conflict_type that routes to a plan stage:

```
1. Code skill writes to state.json:
   "pending_reentry": {
     "conflict_type": "requirement_conflict",
     "target_pipeline": "plan",
     "target_step": "stage-c",
     "reason": "CON-003 requires OAuth2 but unit-3 implemented session-based auth",
     "originated_from": "unit-3",
     "originated_run": "run-001",
     "depth": 1
   }

2. Code skill terminates with message:
   "FROZEN constraint violated (requirement_conflict).
    Reentry needed to /bonfire:plan stage-c.
    Please execute: /bonfire:plan"

3. User executes /bonfire:plan

4. Plan skill startup reads state.json, finds pending_reentry:
   - Validates target_pipeline == "plan"
   - Executes state-reentry: resets stage-c through stage-j
   - Clears pending_reentry
   - Starts from stage-c (not stage-b)
```

Standard skill startup check:

```javascript
const state = loadState();
if (state.pending_reentry) {
  if (state.pending_reentry.target_pipeline !== MY_PIPELINE) {
    abort("pending reentry target is /bonfire:" + state.pending_reentry.target_pipeline);
  }
  executeReentry(state.pending_reentry);
  clearPendingReentry();
} else {
  validatePipelineStage();
}
```

### 3.8 code_ready Authority

**`code_ready` exists only in `compile-output.json#handoff`.** It is not duplicated in `state.json`. `/bonfire:code` reads it directly from the handoff.

---

## Section 4: Agent Delta Protocol and Orchestration

### 4.1 Delta JSON Schema

All independent agents (D/G-Red/G-Blue) output JSON directly. No markdown parsing.

```json
{
  "agent": "bonfire-d-critique",
  "proposals": [
    {
      "id": "CON-007",
      "category": "frozen_constraint",
      "content": "API response must return within 200ms",
      "rationale": "SLA commitment, contractual"
    }
  ],
  "challenges": [
    { "target": "CON-003", "reason": "Conflicts with CON-005 on auth flow definition" }
  ],
  "alignments": [
    { "target": "CON-001", "evidence": "Repo docker-compose.yaml confirms PostgreSQL 14.2" }
  ],
  "follow_up_questions": [
    "Has the user considered session-based auth as a fallback?"
  ]
}
```

`delta-parser.cjs` is a pure JSON schema validator. No format conversion.

### 4.2 Per-Agent Delta Constraints

| Agent | proposals | challenges | alignments | follow_up | verdict |
|-------|-----------|------------|------------|-----------|---------|
| D-Critique | allowed | **required >= 1** | allowed | allowed | — |
| G-Red | allowed | **required >= 1** | — | allowed | — |
| G-Blue | allowed | — | **required >= 1** | allowed | — |
| H-Review | — | — | — | — | **required** |
| J-Compile | — | — | — | — | produces compile-output.json |

"Required" means delta-parser rejects the output if the field is missing or empty.

### 4.3 H-Review Verdict Format

H-Review outputs a verdict JSON (the only agent that directly writes a JSON file besides J-Compile):

```json
{
  "verdict": "approved_with_conditions",
  "conflict_type": null,
  "conditions": [
    "CON-007 lacks stage-f probe verification, J-Compile should mark as unverified"
  ],
  "rulings": [
    { "action": "freeze", "id": "CON-005" },
    { "action": "supersede", "id": "CON-008", "supersedes": "CON-003" }
  ],
  "reason": "Core constraints adequately reviewed, CON-007 can pass with conditions"
}
```

| Verdict | Meaning | Next |
|---------|---------|------|
| `approved` | Pass | Proceed to stage-j |
| `approved_with_conditions` | Conditional pass | Conditions injected into J-Compile prompt |
| `rejected` | Reject | conflict_type → route table → reentry |

### 4.4 Agent Tool Permissions

| Agent | Read | Bash | Write | Glob | Grep |
|-------|------|------|-------|------|------|
| D-Critique | yes | no | no | yes | yes |
| G-Red | yes | no | no | yes | yes |
| G-Blue | yes | no | no | yes | yes |
| H-Review | yes | no | yes (h-review-verdict.json only) | yes | yes |
| J-Compile | yes | no | yes (compile-output.json only) | yes | yes |
| Coder | yes | yes | yes | yes | yes |
| Evaluator | yes | yes | yes (evaluator-verdict.json only) | yes | yes |

D/G-Red/G-Blue have no Write permission. They return delta JSON through Agent() return value. Parent persists it.

### 4.5 Agent Output Capture

```
D/G-Red/G-Blue:
  1. Agent() returns JSON text
  2. Parent: JSON.parse() → delta object
  3. Parent: delta-parser.cjs validate --agent <name> (pure schema check)
  4. Parent: write raw JSON to .bonfire/plan/<agent-name>-delta.json (audit)
  5. Parent: execute truth surface mutations based on delta

H-Review:
  1. Agent writes .bonfire/plan/h-review-verdict.json directly
  2. Parent: read → JSON.parse() → delta-parser.cjs validate --agent bonfire-h-review

J-Compile:
  1. Agent writes .bonfire/plan/compile-output.json directly
  2. Parent: read → JSON.parse() → schema.cjs validate-handoff
  3. Dual-write hook → renderer.cjs splits into 8 markdown files in bundle/
```

### 4.6 /bonfire:pre Orchestration

```
/bonfire:pre skill startup
│
├─ Check pending_reentry (goal_conflict routes here)
├─ If new case: bonfire-tools.cjs init
│   → scaffolds state.json + case.json + directory structure
│
├─ Parent initial review
│   ├─ Read user's raw request
│   ├─ Search target repo: file structure, existing code, deps, config
│   └─ Identify ambiguities, dubious claims, factual gaps
│
├─ Spawn support agents
│   │
│   ├─ Parallel: intent-extractor + reality-checker
│   │
│   │   bonfire-intent-extractor output:
│   │   { "inferred_goals": [...], "literal_vs_real_gaps": [...], "hidden_assumptions": [...] }
│   │
│   │   bonfire-reality-checker output:
│   │   { "confirmed_facts": [...], "dubious_claims": [...], "missing_evidence": [...] }
│   │
│   ├─ Wait for intent-extractor to complete
│   │
│   └─ Serial: blind-spot-scout (input includes inferred_goals)
│       { "unconsidered_dimensions": [...], "missing_non_goals": [...], "suggested_questions": [...] }
│
├─ Parent synthesizes three agent outputs
│   ├─ Merge into question list
│   ├─ Initial truth surface: truth-propose confirmed_fact (from reality-checker)
│   └─ Initial truth surface: truth-propose challenged_claim (from dubious_claims)
│
├─ User interaction loop → state: awaiting_user
│   ├─ Ask questions one at a time (goals, non-goals, examples, anti-examples,
│   │   workflows, priorities, tradeoffs, failure cases,
│   │   data semantics, UI states, acceptance expectations)
│   ├─ After each answer: update truth surface (propose new entries)
│   └─ Until parent judges information sufficient
│
├─ Generate Approval Pack
│   ├─ reframed_goal, retained_scope, excluded_scope,
│   │   critical_assumptions, frozen_for_code
│   └─ Write to case.json stages.preprocess
│
├─ Gate: awaiting_user — user explicitly approves
│   ├─ approved → truth-freeze all confirmed_fact
│   │            truth-propose retained_goal + acceptance_semantic
│   │            state-advance stage-a → passed
│   └─ rejected → return to user interaction loop
│
└─ Output: "Stage A passed. Please execute /bonfire:plan"
```

Support agents vs independent agents:

| | Support agents (A) | Independent agents (D/G/H/J) |
|---|---|---|
| Required? | Optional (parent can complete A alone) | Required (cannot skip) |
| Parallelism | See spawn order above | Strictly sequential (D→G-Red→G-Blue→H→J) |
| Delta validation | Lenient (no "required >= 1" constraint) | Strict (per-role constraint table) |
| Output destination | Merged into question list, no direct truth surface mutation | Parent executes truth surface mutations from delta |

### 4.7 /bonfire:plan Orchestration

```
/bonfire:plan skill startup
│
├─ Check pending_reentry (Section 3.7 protocol)
├─ Read state.json + truth surface snapshot
│
├─ Stage B: parent executes (no agent)
│   ├─ Generate >= 3 materially different options
│   ├─ Write to case.json stages.divergence
│   ├─ bonfire-tools.cjs render --note stage-b
│   └─ Gate: >= 3 options, 1 retained → state-advance
│
├─ Stage C: parent executes (no agent)
│   ├─ Convert retained option to requirement units
│   ├─ Batch truth-propose: retained_goal, frozen_constraint, dependency_chain, acceptance_semantic
│   ├─ bonfire-tools.cjs render --note stage-c
│   └─ Gate: all requirement units have success criteria → state-advance
│
├─ Stage D: spawn bonfire-d-critique
│   ├─ Input: constraint-ledger-snapshot.json
│   ├─ Agent returns delta JSON
│   ├─ delta-parser validates (challenges >= 1)
│   ├─ Parent: truth-propose (proposals) + truth-update challenged_by (challenges)
│   └─ Gate: >= 1 challenge integrated → state-advance
│
├─ Stage E: parent executes (no agent)
│   ├─ Close dependency chain gaps
│   └─ Gate: all dependency_chain refs valid → state-advance
│
├─ Stage F: parent executes (no agent)
│   ├─ Run probes on executable test items
│   └─ Gate: all probes have results or inability records → state-advance
│
├─ Stage G: spawn bonfire-g-red, then spawn bonfire-g-blue
│   ├─ G-Red input: d-critique delta + snapshot
│   │   ├─ Validate delta (challenges >= 1)
│   │   └─ Parent: truth-update challenged_by
│   │
│   ├─ G-Blue input: g-red delta + d-critique delta + snapshot
│   │   ├─ Validate delta (alignments >= 1)
│   │   └─ Parent: truth-update aligned_by + truth-propose (new proposals)
│   │
│   ├─ Truth-Freeze (part of stage-g exit gate):
│   │   scan CHALLENGED entries → freeze those meeting maturity gate
│   │   high_impact_risk stays OPEN
│   │
│   └─ Gate: red/blue complete + risks recorded + freeze done → state-advance
│
├─ Stage H: spawn bonfire-h-review
│   ├─ Input: snapshot + all stage artifacts + handoff-quality-bar.md
│   ├─ Agent writes h-review-verdict.json
│   ├─ Parent executes rulings (freeze/supersede)
│   │
│   ├─ approved → state-advance
│   ├─ approved_with_conditions → record conditions, state-advance
│   └─ rejected → conflict_type → route table → reentry or pending_reentry
│
└─ Stage J: spawn bonfire-j-compile
    ├─ Input: snapshot + all stage deltas + conditions (if any) + handoff-quality-bar.md
    ├─ Agent writes compile-output.json (single JSON containing all artifact data)
    │   Contains: handoff, canonical_contracts, constraint_crosswalk,
    │   execution_manifest, code_batches, code_preflight, compile_summary, final_handoff
    ├─ Parent: schema.cjs validate-handoff
    ├─ Dual-write hook → renderer.cjs splits into 8 markdown files:
    │   90-code-handoff.md, 91-canonical-contracts.md, 92-constraint-crosswalk.md,
    │   95-execution-manifest.md, 96-code-batches.md, 97-code-preflight.md,
    │   98-j-compile-for-code.md, 99-final-handoff.md
    ├─ Gate: handoff passes validation, code_ready=true → state-advance
    └─ Gate failed → reentry (handoff_incomplete)
```

### 4.8 Agent Spawn Template

```javascript
Agent({
  subagent_type: "bonfire-d-critique",
  prompt: `
    <role>
    You are an independent requirements reviewer. Attack current constraints,
    find contradictions and gaps.
    </role>

    <input>
    @.bonfire/truth-surface/constraint-ledger-snapshot.json
    </input>

    <protocol>
    @bonfire/references/subagent-protocol.md
    </protocol>

    <output>
    Output a single JSON object directly, not wrapped in markdown code blocks.
    Must contain "challenges" array with length >= 1.
    Schema defined in protocol's delta-schema section.
    </output>
  `
})
```

---

## Section 5: Real-time Dual-Write and Rendering Layer

### 5.1 Architecture

```
Agent writes JSON (Layer 0)
    ↓ PostToolUse hook detects .bonfire/ JSON file change
        ↓ bonfire-dual-write.js calls renderer.cjs
            ↓ renderer.cjs loads numbering map from bonfire-v1.json + template
                ↓ Outputs Markdown to bundle/ (Layer 1)
                ↓ Appends render log to logs/ (Layer 2)
```

**Agents never see markdown. Rendering is one-way and idempotent.**

### 5.2 Hook Definition

```javascript
// hooks/bonfire-dual-write.js
// Trigger: PostToolUse, matcher: Write|Edit

const WATCHED_PATTERNS = [
  // truth surface → constraint-ledger.md
  /\.bonfire\/truth-surface\/constraint-ledger-snapshot\.json$/,

  // agent delta → corresponding stage markdown
  /\.bonfire\/plan\/[^/]+-delta\.json$/,

  // H-Review verdict → stage-h.md
  /\.bonfire\/plan\/h-review-verdict\.json$/,

  // J-Compile → 8 companion markdown files
  /\.bonfire\/plan\/compile-output\.json$/,

  // Run evidence → runs/ markdown
  /\.bonfire\/runs\/[^/]+\/[^/]+\.json$/

  // case.json NOT watched — parent skill explicitly calls render
];
```

case.json is not watched because it is an aggregate container. Parent skill knows which stage field it just wrote and calls `bonfire-tools.cjs render --note <stage>` directly.

### 5.3 bonfire-v1.json Note Definitions

The numbering map, dependency chain, and source mapping are defined declaratively in `bonfire-v1.json`, not hardcoded in the renderer.

```json
{
  "notes": [
    {
      "id": "overview",
      "filename": "00-overview.md",
      "template": "overview.md",
      "source": "case.json"
    },
    {
      "id": "constraint-ledger",
      "filename": "05-constraint-ledger.md",
      "template": "constraint-ledger.md",
      "source": "truth-surface/constraint-ledger-snapshot.json"
    },
    {
      "id": "stage-a",
      "filename": "10-a-preprocess.md",
      "template": "stage-a.md",
      "source": "case.json#stages.preprocess",
      "requires": []
    },
    {
      "id": "stage-b",
      "filename": "20-b-divergence.md",
      "template": "stage-b.md",
      "source": "case.json#stages.divergence",
      "requires": ["stage-a"]
    },
    {
      "id": "stage-c",
      "filename": "30-c-requirements.md",
      "template": "stage-c.md",
      "source": "case.json#stages.requirements",
      "requires": ["stage-b"]
    },
    {
      "id": "stage-d",
      "filename": "40-d-critique.md",
      "template": "stage-d.md",
      "source": "plan/bonfire-d-critique-delta.json",
      "requires": ["stage-c"]
    },
    {
      "id": "stage-e",
      "filename": "50-e-closure.md",
      "template": "stage-e.md",
      "source": "case.json#stages.closure",
      "requires": ["stage-d"]
    },
    {
      "id": "stage-f",
      "filename": "60-f-probes.md",
      "template": "stage-f.md",
      "source": "case.json#stages.probes",
      "requires": ["stage-e"]
    },
    {
      "id": "stage-g",
      "filename": "70-g-red-blue.md",
      "template": "stage-g.md",
      "source": "plan/bonfire-g-red-delta.json+plan/bonfire-g-blue-delta.json",
      "requires": ["stage-f"]
    },
    {
      "id": "stage-h",
      "filename": "80-h-review.md",
      "template": "stage-h.md",
      "source": "plan/h-review-verdict.json",
      "requires": ["stage-g"]
    },
    {
      "id": "code-handoff",
      "filename": "90-code-handoff.md",
      "template": "code-handoff.md",
      "source": "plan/compile-output.json#handoff",
      "requires": ["stage-h"]
    },
    {
      "id": "canonical-contracts",
      "filename": "91-canonical-contracts.md",
      "template": "canonical-contracts.md",
      "source": "plan/compile-output.json#canonical_contracts",
      "requires": ["code-handoff"]
    },
    {
      "id": "constraint-crosswalk",
      "filename": "92-constraint-crosswalk.md",
      "template": "constraint-crosswalk.md",
      "source": "plan/compile-output.json#constraint_crosswalk",
      "requires": ["code-handoff"]
    },
    {
      "id": "execution-manifest",
      "filename": "95-execution-manifest.md",
      "template": "execution-manifest.md",
      "source": "plan/compile-output.json#execution_manifest",
      "requires": ["code-handoff"]
    },
    {
      "id": "code-batches",
      "filename": "96-code-batches.md",
      "template": "code-batches.md",
      "source": "plan/compile-output.json#code_batches",
      "requires": ["code-handoff"]
    },
    {
      "id": "code-preflight",
      "filename": "97-code-preflight.md",
      "template": "code-preflight.md",
      "source": "plan/compile-output.json#code_preflight",
      "requires": ["code-handoff"]
    },
    {
      "id": "compile-for-code",
      "filename": "98-j-compile-for-code.md",
      "template": "stage-j.md",
      "source": "plan/compile-output.json#compile_summary",
      "requires": ["code-handoff"]
    },
    {
      "id": "final-handoff",
      "filename": "99-final-handoff.md",
      "template": "final-handoff.md",
      "source": "plan/compile-output.json#final_handoff",
      "requires": ["code-handoff"]
    },
    {
      "id": "code-run",
      "filename": "00-code-run.md",
      "template": "code-run.md",
      "source": "runs/{run_id}/code-run.json",
      "output_dir": "runs/{run_id}/"
    },
    {
      "id": "verification",
      "filename": "01-verification.md",
      "template": "verification.md",
      "source": "runs/{run_id}/verification.json",
      "output_dir": "runs/{run_id}/"
    },
    {
      "id": "reentry",
      "filename": "02-reentry.md",
      "template": "reentry.md",
      "source": "runs/{run_id}/reentry.json",
      "output_dir": "runs/{run_id}/"
    },
    {
      "id": "achieve",
      "filename": "03-achieve.md",
      "template": "achieve.md",
      "source": "runs/{run_id}/achieve.json",
      "output_dir": "runs/{run_id}/"
    }
  ]
}
```

### 5.4 Renderer CLI

```bash
# Render single note (called by parent skill after case.json update)
bonfire-tools.cjs render --note stage-d

# Render full bundle (/bonfire:render manual trigger)
bonfire-tools.cjs render --all

# Render run evidence
bonfire-tools.cjs render --run run-001 --note code-run

# Dirty check (which markdown is out of sync with JSON)
bonfire-tools.cjs render-check
```

Renderer internal flow:

```
1. Load bonfire-v1.json → find note definition
2. Check requires dependencies → source file exists
3. Read source JSON (supports # path selector)
4. Read template markdown
5. Inject JSON data into template placeholders
6. Write to bundle/<filename>
7. Append render log to logs/render.jsonl:
   {"note":"stage-d","source":"plan/bonfire-d-critique-delta.json","rendered_at":"...","hash":"sha256:..."}
```

### 5.5 Template Syntax

Minimal placeholders, no template engine dependency:

- `{{field}}` — value substitution
- `{{#each array}}...{{/each}}` — array iteration
- `{{.}}` — current array element (for primitives)

Three forms only. If template needs exceed these, data should be preprocessed at the JSON layer, not at the template layer.

### 5.6 Obsidian Compatibility

Rendered markdown uses Obsidian wikilink convention: `[[05-constraint-ledger]]`. Renderer preserves these as-is. User opens `bundle/` as Obsidian vault or sub-vault.

### 5.7 Audit Logs (Layer 2)

```
.bonfire/logs/
├── render.jsonl              # Render records
├── state-transitions.jsonl   # Every state.json change
└── agent-invocations.jsonl   # Agent spawn/complete/fail
```

Agents never read logs/. Logs are purely for post-hoc audit and debug.

---

## Section 6: bonfire-tools.cjs CLI Command Table

### 6.1 Architecture

Single entry point `bonfire-tools.cjs`, subcommands organized by domain:

```bash
bonfire-tools.cjs <domain>-<action> [--flags]
```

All commands operate on `.bonfire/` in the current working directory. One active case per repo.

### 6.2 Output Convention

| Scenario | stdout | stderr | exit code |
|----------|--------|--------|-----------|
| Success | JSON result (for parent skill to parse) | none | 0 |
| Validation failure | `{"error":"...","details":[...]}` | none | 1 |
| Argument error | none | usage hint | 2 |
| Internal error | none | error message | 3 |

stdout is always JSON or empty. Parent skill consumes via `JSON.parse(stdout)`.

### 6.3 Init Domain (3 commands)

```bash
# Initialize new case (scaffold state.json + case.json + directories)
bonfire-tools.cjs init --request <text> --project-root <path>

# Archive current case (/bonfire:achieve calls this after completion)
bonfire-tools.cjs archive --name <name>

# List archived cases
bonfire-tools.cjs archive-list
```

`init` creates:
```
.bonfire/
├── state.json                              # All fields initialized
├── case.json                               # Empty skeleton from bonfire-v1.json schema
├── truth-surface/
│   ├── constraint-ledger-history.jsonl      # Empty
│   ├── constraint-ledger-snapshot.json      # Empty skeleton
│   └── constraint-ledger.md                 # Empty render
├── plan/
├── bundle/
├── runs/
├── logs/
└── archive/
```

case.json initial skeleton:
```json
{
  "bundle_version": 1,
  "title": null,
  "created_at": "2026-04-10T09:00:00Z",
  "source_request": "raw request text",
  "project_paths": { "root": "/path/to/target/repo" },
  "stages": {
    "preprocess": null,
    "divergence": null,
    "requirements": null,
    "critique": null,
    "closure": null,
    "probes": null,
    "red_blue": null,
    "review": null,
    "compile_for_code": null
  },
  "artifacts": {
    "compile_output": null
  }
}
```

### 6.4 State Domain (9 commands)

```bash
bonfire-tools.cjs state-read
bonfire-tools.cjs state-advance --step <step-name>
bonfire-tools.cjs state-reentry --conflict-type <type>
bonfire-tools.cjs state-pending-reentry --conflict-type <type> --from <step> --reason <text>
bonfire-tools.cjs state-clear-reentry
bonfire-tools.cjs state-step --step <step-name> --status <status>
bonfire-tools.cjs state-begin-run --run-id <id>
bonfire-tools.cjs state-complete-run --run-id <id> --verdict <achieved|not_achieved|achieved_with_followups>
bonfire-tools.cjs state-init-code-steps
```

`state-init-code-steps` reads `compile-output.json#handoff.implementation_units` and generates unit-1..unit-N steps in state.json.

### 6.5 Truth Surface Domain (9 commands)

```bash
bonfire-tools.cjs truth-propose --id <id> --category <cat> --content <text> --rationale <text> --source <stage>
bonfire-tools.cjs truth-update --id <id> --field <field> --value <value>
bonfire-tools.cjs truth-annotate --id <id> --field <field> --value <value>
bonfire-tools.cjs truth-freeze --id <id>
bonfire-tools.cjs truth-supersede --id <id> --supersedes <old-id> --content <text> --rationale <text>
bonfire-tools.cjs truth-discard --id <id> --rationale <text>
bonfire-tools.cjs truth-read
bonfire-tools.cjs truth-query --status <status> [--category <category>]
bonfire-tools.cjs truth-rebuild
```

### 6.6 Delta Validation Domain (3 commands)

```bash
bonfire-tools.cjs delta-validate --agent <agent-name> --file <path>
bonfire-tools.cjs delta-validate --agent <agent-name> --stdin
bonfire-tools.cjs handoff-validate
bonfire-tools.cjs bundle-validate
```

### 6.7 Render Domain (2 commands)

```bash
bonfire-tools.cjs render --note <note-id>
bonfire-tools.cjs render --all
bonfire-tools.cjs render --run <run-id> --note <note-id>
bonfire-tools.cjs render-check
```

### 6.8 Log Domain (3 commands)

```bash
bonfire-tools.cjs log-agent --event <spawn|completed|failed> --agent <name> --step <step> [--error <text>]
bonfire-tools.cjs log-transition --step <step> --from <status> --to <status>
bonfire-tools.cjs log-read --type <render|state-transitions|agent-invocations> [--since <timestamp>]
```

### 6.9 Route Domain (1 command)

```bash
bonfire-tools.cjs route --conflict-type <type>
# Output: {"to":"stage-c","crosses_pipeline":false}

bonfire-tools.cjs route --list
# Output: all conflict types and their routes
```

### 6.10 Preflight Domain (1 command)

```bash
bonfire-tools.cjs preflight-update --field <field> --value <value>
bonfire-tools.cjs preflight-update --field progress --unit <unit> --status <passed|failed|in_progress>
```

Mutable field whitelist: `current_focus`, `progress_snapshot`, `remaining_work`, `session_notes`, `blockers`, `pause_conditions`.

Fields outside whitelist (confirmed_repo_facts, do_not_reinterpret, do_first, context_bundle) are rejected with exit code 1.

Internally: reads compile-output.json → modifies only code_preflight mutable fields → writes back (atomic) → dual-write renders 97-code-preflight.md.

### 6.11 Command Summary

| Domain | Count | Commands |
|--------|-------|----------|
| Init | 3 | `init`, `archive`, `archive-list` |
| State | 9 | `state-read`, `state-advance`, `state-reentry`, `state-pending-reentry`, `state-clear-reentry`, `state-step`, `state-begin-run`, `state-complete-run`, `state-init-code-steps` |
| Truth | 9 | `truth-propose`, `truth-update`, `truth-annotate`, `truth-freeze`, `truth-supersede`, `truth-discard`, `truth-read`, `truth-query`, `truth-rebuild` |
| Delta | 3 | `delta-validate`, `handoff-validate`, `bundle-validate` |
| Render | 2 | `render`, `render-check` |
| Log | 3 | `log-agent`, `log-transition`, `log-read` |
| Route | 1 | `route` |
| Preflight | 1 | `preflight-update` |
| **Total** | **31** | |

### 6.12 Internal Call Graph

```
state-advance
  └─ log-transition (record state change)

state-reentry
  ├─ route (lookup route table)
  ├─ state-step × N (batch reset)
  └─ log-transition × N

truth-propose / truth-update / truth-freeze / truth-supersede / truth-discard / truth-annotate
  ├─ append to history.jsonl
  ├─ replay → regenerate snapshot.json (write-then-rename)
  └─ trigger dual-write hook → render constraint-ledger.md

state-init-code-steps
  └─ read compile-output.json#handoff.implementation_units
     → generate unit-1..unit-N steps in state.json

preflight-update
  ├─ read compile-output.json
  ├─ validate field in whitelist
  ├─ modify code_preflight mutable fields only
  ├─ write-then-rename compile-output.json
  └─ trigger dual-write hook → render 97-code-preflight.md
```

### 6.13 Runtime Dependencies

**Zero external dependencies.** bonfire-tools.cjs and all lib/ modules use only Node.js built-in modules:

| Function | Node.js built-in |
|----------|-----------------|
| JSON read/write | `fs.readFileSync` / writeAtomic (write-then-rename) |
| Path operations | `path` |
| Timestamps | `Date.toISOString()` |
| SHA256 | `crypto.createHash` |
| Directory operations | `fs.mkdirSync` / `fs.readdirSync` |

No npm dependencies, no node_modules/, no package.json dependencies. Install and run.

---

## Section 7: /bonfire:code and /bonfire:achieve Execution

### 7.1 /bonfire:code Entry Check

```
/bonfire:code skill startup
│
├─ Read state.json
│   ├─ Check pending_reentry → if present, abort with guidance
│   ├─ Check pipeline_stage == "plan" and stage-j.status == "passed"
│   └─ Otherwise abort: "Please complete /bonfire:plan first"
│
├─ Read compile-output.json
│   ├─ Check handoff.code_ready == true
│   └─ Otherwise abort: "handoff code_ready=false"
│
├─ bonfire-tools.cjs state-init-code-steps
│   └─ Generate unit steps from handoff.implementation_units
│
├─ state-step --step stage-code --status running
│   └─ pipeline_stage updates to "code"
│
├─ state-begin-run --run-id run-<timestamp>
│
└─ Enter unit execution loop
```

### 7.2 Coder/Evaluator Adversarial Loop

```
For each unit in implementation_units (dependency order from execution_manifest):

  iteration = 0, max_iterations = 5, feedback = null

  Loop:
    iteration += 1
    state-step --step unit-N --status running

    Spawn bonfire-coder:
      Input:
        compile-output.json#handoff (read-only, no reinterpretation)
        compile-output.json#code_preflight (active workboard)
        Current unit definition (function_contracts, file_plan, done_when)
        feedback (previous evaluator issues, null on first iteration)
        @references/code-playbook.md

      Coder CAN decide (low-impact engineering):
        helper decomposition, import paths, local variable names, lockfile updates

      Coder CANNOT decide (high-impact product semantics):
        user goal meaning, product semantics, data/state behavior,
        validation meaning, success criteria, dependency behavior, acceptance semantics

      Coder output: writes code files directly + coder-manifest.json

    coder-manifest.json → runs/<run-id>/unit-N-manifest.json:
    {
      "unit": "unit-1",
      "iteration": 2,
      "files_created": ["src/auth/oauth.ts"],
      "files_modified": ["src/auth/index.ts"],
      "commands_run": ["npm run build"],
      "notes": "Split oauth logic into standalone module"
    }

    Spawn bonfire-evaluator:
      Input:
        Current unit definition (done_when, verification_commands, acceptance_checks)
        runs/<run-id>/unit-N-manifest.json
        compile-output.json#handoff.frozen_product_decisions
        truth-surface snapshot (for algedonic check)
        @references/code-playbook.md

      Evaluator responsibilities:
        1. Run unit's verification_commands
        2. Check done_when conditions
        3. Verify implementation doesn't violate any FROZEN constraint (algedonic check)
        4. Check for handoff contradictions (reentry check)

    evaluator-verdict.json → runs/<run-id>/unit-N-verdict.json:
    {
      "unit": "unit-1",
      "iteration": 2,
      "verdict": "PASS|FAIL",
      "issues": [{"file": "...", "line": 42, "expected": "...", "got": "..."}],
      "verification_results": [
        {"command": "npm run build", "exit_code": 0},
        {"command": "npm test -- --grep oauth", "exit_code": 0}
      ],
      "algedonic": false,
      "conflict_type": null,
      "contradiction": null
    }

    Parent routing:

    PASS:
      git commit (unit-granularity atomic commit)
      Write runs/<run-id>/unit-N-pass.json (evidence)
      state-step --step unit-N --status passed
      preflight-update --field current_focus --value "unit-(N+1)"
      preflight-update --field progress --unit unit-N --status passed
      break → next unit

    FAIL + conflict_type != null:
      HALT — frozen constraint violated or handoff contradiction
      Write runs/<run-id>/unit-N-reentry.json
      state-pending-reentry --conflict-type <verdict.conflict_type> --from unit-N
      Output: "Constraint violated (<conflict_type>). Need /bonfire:plan"
      Skill terminates

    FAIL + conflict_type == null + iteration < max_iterations:
      feedback = verdict.issues
      log-agent --event failed --agent bonfire-evaluator --step unit-N
      continue → next iteration (issues as coder feedback)

    FAIL + conflict_type == null + iteration >= max_iterations:
      HALT — iterations exhausted
      state-step --step unit-N --status awaiting_user
      Output: "unit-N failed after 5 iterations, please intervene"
      Skill pauses
```

`algedonic` field is retained as a boolean marker for audit logs (distinguish "constraint violated" from "handoff contradiction") but does not participate in routing logic. Routing uses only `conflict_type`.

### 7.3 /code Completion

```
All units passed:
│
├─ Run global verification_commands (project-level checks from handoff)
│   ├─ All pass → continue
│   └─ Any fail → state-step --step global-verify --status awaiting_user
│
├─ Run browser_checks (if applicable, web projects)
│   └─ Results recorded in runs/<run-id>/browser-checks.json
│
├─ Write runs/<run-id>/code-run.json:
│   {
│     "run_id": "run-001",
│     "units_completed": 5,
│     "total_iterations": 11,
│     "algedonic_signals": 0,
│     "reentries": 0,
│     "global_verification": "passed",
│     "browser_checks": "passed",
│     "completed_at": "2026-04-10T15:30:00Z"
│   }
│
├─ Dual-write hook → renders runs/run-001/00-code-run.md
│
├─ state-complete-run --run-id run-001 --verdict pending_achieve
│
└─ Output: "/code complete. Please execute /bonfire:achieve"
```

### 7.4 /bonfire:achieve Flow

```
/bonfire:achieve skill startup
│
├─ Read state.json
│   ├─ Check pipeline_stage == "code"
│   ├─ Check current run exists and all units passed
│   └─ Otherwise abort
│
├─ Step 1: Bundle integrity check
│   bonfire-tools.cjs bundle-validate
│   ├─ Pass → continue
│   └─ Fail → abort, bundle corrupted
│
├─ Step 2: Verification review
│   ├─ Read runs/<run-id>/code-run.json
│   ├─ Confirm global_verification == passed
│   ├─ Confirm browser_checks result (if applicable)
│   └─ Write runs/<run-id>/verification.json
│
├─ Step 3: Acceptance verdict → state: awaiting_user
│   ├─ Present to user:
│   │   - handoff acceptance_checks listed one by one
│   │   - Verification results already passed
│   │   - Any high_impact_risk (OPEN status) current situation
│   │   - browser_checks results
│   │
│   ├─ User verdict:
│   │   a) achieved — all acceptance passed
│   │   b) achieved_with_followups — passed with follow-up items
│   │   c) not_achieved — failed
│   │
│   └─ Write runs/<run-id>/achieve.json:
│       {
│         "verdict": "achieved|achieved_with_followups|not_achieved",
│         "acceptance_results": [
│           {"check": "OAuth2 login flow complete", "result": "passed"}
│         ],
│         "followups": ["Need to add rate limiting"],
│         "failure_reason": null,
│         "judged_at": "..."
│       }
│
├─ Step 4: Archive decision
│   │
│   ├─ achieved / achieved_with_followups:
│   │   bonfire-tools.cjs archive --name <date>-<title>
│   │   Output: "Case archived: .bonfire/archive/<name>/"
│   │
│   └─ not_achieved:
│       Case stays active, not archived
│       User decides:
│       - Re-execute /bonfire:code (new run)
│       - Reentry to /bonfire:plan (manually set pending_reentry)
│       Output: "Acceptance failed. Case stays active."
│
└─ Dual-write hook → renders achieve.md + verification.md
```

### 7.5 /code Playbook Key Rules

1. **Sole input**: `compile-output.json` handoff + code_preflight + current unit definition
2. **Never read bundle/ markdown**: coder reads JSON only
3. **Never read plan/ agent deltas**: planning process intermediates invisible to coder
4. **Fail closed on ambiguity**: coder does not guess, marks ambiguity in manifest, evaluator routes as reentry
5. **Unit-granularity atomic commits**: git commit after each unit passes, no batching

---

## Section 8: Plugin Integration and Installation

### 8.1 File Distribution After Installation

```
~/.claude/
├── plugins/cache/<marketplace>/bonfire/<version>/
│   ├── .claude-plugin/plugin.json
│   ├── schemas/bonfire-v1.json
│   ├── bin/bonfire-tools.cjs + bin/lib/*.cjs
│   ├── templates/*.md
│   ├── references/*.md
│   ├── examples/sample-case/
│   └── tests/
│
├── commands/bonfire/              # Skills registered as commands
│   ├── pre.md
│   ├── plan.md
│   ├── code.md
│   ├── achieve.md
│   └── render.md
│
├── agents/                        # Agent definitions registered globally
│   ├── bonfire-intent-extractor.md
│   ├── bonfire-reality-checker.md
│   ├── bonfire-blind-spot-scout.md
│   ├── bonfire-d-critique.md
│   ├── bonfire-g-red.md
│   ├── bonfire-g-blue.md
│   ├── bonfire-h-review.md
│   ├── bonfire-j-compile.md
│   ├── bonfire-coder.md
│   └── bonfire-evaluator.md
```

### 8.2 Hook Registration

Installation writes to user's `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node $HOME/.claude/plugins/cache/<marketplace>/bonfire/<version>/hooks/bonfire-dual-write.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Hook command references the actual plugin cache path. Installation script writes the resolved path.

### 8.3 Skill Definition Structure

```yaml
---
name: bonfire:plan
description: "Run ECL planning pipeline stages B→J with adversarial review"
argument-hint: "[--from <stage>]"
---
```

Body contains `<objective>`, `<execution_context>` (with `@` file references to playbooks), and `<process>` (step-by-step orchestration logic).

### 8.4 Agent Definition Structure

```yaml
---
name: bonfire-d-critique
description: "Independent critique agent. Attacks requirements against truth surface. Must challenge >= 1 entry."
tools: Read, Glob, Grep
---
```

Body contains `<role>`, `<rules>`, `<delta_schema>`, and `<input>` sections.

### 8.5 First-Use Flow

```
User installs bonfire plugin
  → /bonfire:pre "Add OAuth2 authentication to this project"
    → bonfire-tools.cjs init (creates .bonfire/)
    → Stage A: support agents + user interaction + approval
    → Output: "Please execute /bonfire:plan"

  → /bonfire:plan
    → Stages B→J auto-advance
    → D/G/H adversarial review
    → J-Compile produces compile-output.json
    → Dual-write renders complete bundle
    → Output: "Please execute /bonfire:code"

  → /bonfire:code
    → Coder/Evaluator adversarial loop
    → Unit-granularity atomic commits
    → Output: "Please execute /bonfire:achieve"

  → /bonfire:achieve
    → Verification review
    → User acceptance verdict
    → Archive
    → Done
```

### 8.6 .gitignore

`.bonfire/` is not added to `.gitignore` by default (planning artifacts have version tracking value). `/bonfire:pre` prompts user to choose during init.
