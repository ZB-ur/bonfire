# Bonfire Plan 6: End-to-End Test Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues discovered during first end-to-end test of /bonfire:pre on a real project.

**Architecture:** Fixes span skills (@ paths, CLI paths), references (command format), templates (object rendering), and core modules (self-render after truth surface writes). No new files created.

**Tech Stack:** Markdown edits + Node.js code edits. Zero new dependencies.

**Spec:** Issues reported from e2e testing of /bonfire:pre.

**Depends on:** Plans 1–5 (completed) — 93 tests passing.

---

## File Map

| Action | File | Fix |
|--------|------|-----|
| Modify | `skills/pre/SKILL.md` | Fix 1 (@ paths) + Fix 2 (CLI path) |
| Modify | `skills/plan/SKILL.md` | Fix 1 (@ paths) + Fix 2 (CLI path) |
| Modify | `skills/code/SKILL.md` | Fix 1 (@ paths) + Fix 2 (CLI path) |
| Modify | `skills/achieve/SKILL.md` | Fix 1 (@ paths) + Fix 2 (CLI path) |
| Modify | `skills/render/SKILL.md` | Fix 2 (CLI path) |
| Modify | `references/approval-gate.md` | Fix 3 (full CLI format + ID conventions) |
| Modify | `references/stage-playbook.md` | Fix 3 (full CLI format) |
| Modify | `templates/overview.md` | Fix 4 (project_root instead of project_paths) |
| Modify | `bin/lib/renderer.cjs` | Fix 4 (overview preprocessor) |
| Modify | `bin/lib/truth-surface.cjs` | Fix 5 (self-render after snapshot) |
| Modify | `bin/bonfire-tools.cjs` | Fix 5 (self-render after preflight-update) |

---

### Task 1: Fix @ Reference Paths + CLI Path in All Skills (Fixes 1 & 2)

**Files:**
- Modify: `skills/pre/SKILL.md`
- Modify: `skills/plan/SKILL.md`
- Modify: `skills/code/SKILL.md`
- Modify: `skills/achieve/SKILL.md`
- Modify: `skills/render/SKILL.md`

- [ ] **Step 1: Fix skills/pre/SKILL.md**

Replace the `<execution_context>` block:

```
# Old
<execution_context>
Read these references before starting:
- @references/approval-gate.md
- @references/stage-playbook.md
- @references/diagnosis-and-observability.md (only for bug/diagnosis requests)
- @references/ecl-schema.md

CLI tool: `bonfire-tools.cjs` (all commands documented in ecl-schema reference)
</execution_context>

# New
<execution_context>
Read these references before starting:
- @$HOME/.claude/bonfire/references/approval-gate.md
- @$HOME/.claude/bonfire/references/stage-playbook.md
- @$HOME/.claude/bonfire/references/diagnosis-and-observability.md (only for bug/diagnosis requests)
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>
```

Also replace all bare `bonfire-tools.cjs` references in the process steps with `bonfire`. For example:
- `bonfire-tools.cjs init` → `bonfire init`
- `bonfire-tools.cjs state-step` → `bonfire state-step`
- `bonfire-tools.cjs render` → `bonfire render`
- etc.

- [ ] **Step 2: Fix skills/plan/SKILL.md**

Replace `<execution_context>`:

```
# Old
<execution_context>
Read these references before starting:
- @references/stage-playbook.md
- @references/subagent-protocol.md
- @references/handoff-quality-bar.md
- @references/ecl-schema.md

CLI tool: `bonfire-tools.cjs`
</execution_context>

# New
<execution_context>
Read these references before starting:
- @$HOME/.claude/bonfire/references/stage-playbook.md
- @$HOME/.claude/bonfire/references/subagent-protocol.md
- @$HOME/.claude/bonfire/references/handoff-quality-bar.md
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>
```

Also replace all bare `bonfire-tools.cjs` in process steps with `bonfire`.

- [ ] **Step 3: Fix skills/code/SKILL.md**

Replace `<execution_context>`:

```
# Old
<execution_context>
Read these references before starting:
- @references/code-playbook.md
- @references/ecl-schema.md
</execution_context>

# New
<execution_context>
Read these references before starting:
- @$HOME/.claude/bonfire/references/code-playbook.md
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>
```

Also fix the agent spawn prompts — replace `@references/code-playbook.md` with `@$HOME/.claude/bonfire/references/code-playbook.md` in both the coder and evaluator prompt templates (lines 58 and 73).

Replace all bare `bonfire-tools.cjs` in process steps with `bonfire`.

- [ ] **Step 4: Fix skills/achieve/SKILL.md**

Replace `<execution_context>`:

```
# Old
<execution_context>
Read these references before starting:
- @references/achieve-playbook.md
- @references/ecl-schema.md
</execution_context>

# New
<execution_context>
Read these references before starting:
- @$HOME/.claude/bonfire/references/achieve-playbook.md
- @$HOME/.claude/bonfire/references/ecl-schema.md

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.
</execution_context>
```

Replace all bare `bonfire-tools.cjs` in process steps with `bonfire`.

- [ ] **Step 5: Fix skills/render/SKILL.md**

No @ references to fix. Add CLI path definition and replace bare `bonfire-tools.cjs`:

```
# Old (after </objective>)
<process>

1. If `--note` is specified:
   ```
   bonfire-tools.cjs render --note <note-id>
   ```

# New
<process>

Throughout this process, `bonfire` means `node $HOME/.claude/bonfire/bin/bonfire-tools.cjs`.

1. If `--note` is specified:
   ```
   bonfire render --note <note-id>
   ```
```

Replace all `bonfire-tools.cjs` with `bonfire` in the remaining steps.

- [ ] **Step 6: Commit**

```bash
git add skills/
git commit -m "fix: resolve @ reference paths and CLI path in all skills"
```

---

### Task 2: Fix truth-propose Command Format in References (Fix 3)

**Files:**
- Modify: `references/approval-gate.md`
- Modify: `references/stage-playbook.md`

- [ ] **Step 1: Fix references/approval-gate.md**

Replace the "Truth Surface Actions" section:

```
# Old
## Truth Surface Actions During Stage A

As answers come in, the parent skill should:

- `truth-propose confirmed_fact` for verified repo/environment facts (from reality-checker)
- `truth-propose challenged_claim` for dubious user claims
- `truth-propose retained_goal` for confirmed user goals
- `truth-propose acceptance_semantic` for acceptance criteria

# New
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
```

Also replace the Exit Rule section's bare commands with full format:

```
# Old
After the user approves:

- `truth-freeze` all `confirmed_fact` entries
- `truth-propose` remaining `retained_goal` and `acceptance_semantic` entries
- `state-step --step stage-a --status passed`
- `state-advance --step stage-a`

# New
After the user approves:

- `bonfire truth-freeze --id <ID>` for each `confirmed_fact` entry
- `bonfire truth-propose --id <ID> --category retained_goal --content "..." --rationale "..." --source stage-a` for remaining goals
- `bonfire truth-propose --id <ID> --category acceptance_semantic --content "..." --rationale "..." --source stage-a` for acceptance criteria
- `bonfire state-step --step stage-a --status passed`
- `bonfire state-advance --step stage-a`
```

- [ ] **Step 2: Fix references/stage-playbook.md**

In the D / Critique section, add full command format:

```
# Old
- Parent integrates: `truth-propose` (proposals), `truth-update challenged_by` (challenges).

# New
- Parent integrates:
  - For each proposal: `bonfire truth-propose --id <ID> --category <cat> --content "..." --rationale "..." --source stage-d`
  - For each challenge: `bonfire truth-update --id <target> --field challenged_by --value d-critique`
```

In the G / Red-Blue section, add freeze command format:

```
# Old
- Truth-Freeze Gate (part of stage-g exit): scan CHALLENGED entries, freeze those meeting maturity gate. `high_impact_risk` stays OPEN.

# New
- Truth-Freeze Gate (part of stage-g exit):
  - `bonfire truth-query --status CHALLENGED` to find eligible entries
  - `bonfire truth-freeze --id <ID>` for each entry meeting its category's maturity gate
  - `high_impact_risk` entries stay OPEN (never freeze)
```

- [ ] **Step 3: Commit**

```bash
git add references/approval-gate.md references/stage-playbook.md
git commit -m "fix: add full CLI command format and ID conventions to references"
```

---

### Task 3: Fix Overview Template [object Object] (Fix 4)

**Files:**
- Modify: `templates/overview.md`
- Modify: `bin/lib/renderer.cjs`

- [ ] **Step 1: Fix templates/overview.md**

```
# Old
Root: {{project_paths}}

# New
Root: {{project_root}}
```

- [ ] **Step 2: Add overview preprocessor to renderer.cjs**

In `bin/lib/renderer.cjs`, modify the `preprocessData` function:

```javascript
// Old
function preprocessData(noteId, data) {
  switch (noteId) {
    case 'constraint-ledger':
      return preprocessConstraintLedger(data);
    default:
      return data;
  }
}

// New
function preprocessData(noteId, data) {
  switch (noteId) {
    case 'constraint-ledger':
      return preprocessConstraintLedger(data);
    case 'overview':
      return preprocessOverview(data);
    default:
      return data;
  }
}
```

Add the `preprocessOverview` function before `preprocessData`:

```javascript
/**
 * Preprocess data for overview note.
 * Extracts project_paths.root into a flat string field.
 */
function preprocessOverview(data) {
  if (!data) return data;
  const root = data.project_paths && data.project_paths.root
    ? data.project_paths.root
    : JSON.stringify(data.project_paths);
  return Object.assign({}, data, { project_root: root });
}
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/*.js
```

Expect: all 93 tests pass (overview smoke test should now render `project_root` correctly).

- [ ] **Step 4: Commit**

```bash
git add templates/overview.md bin/lib/renderer.cjs
git commit -m "fix: resolve [object Object] in overview template by preprocessing project_paths"
```

---

### Task 4: CLI Self-Render for Truth Surface + Preflight (Fix 5)

**Files:**
- Modify: `bin/lib/truth-surface.cjs`
- Modify: `bin/bonfire-tools.cjs`

- [ ] **Step 1: Add self-render to truth-surface.cjs regenerateSnapshot**

In `bin/lib/truth-surface.cjs`, modify `regenerateSnapshot`:

```javascript
// Old
function regenerateSnapshot(root) {
  const snapshot = replay(root);
  writeAtomic(getSnapshotPath(root), snapshot);
  return snapshot;
}

// New
function regenerateSnapshot(root) {
  const snapshot = replay(root);
  writeAtomic(getSnapshotPath(root), snapshot);

  // Self-render: truth surface changes go through CLI (fs.writeFileSync),
  // not Claude Code Write tool, so the dual-write hook can't see them.
  try {
    const { renderNote } = require('./renderer.cjs');
    renderNote(root, 'constraint-ledger');
  } catch (_) {
    // Renderer may not be available during init or if templates missing
  }

  return snapshot;
}
```

Note: `root` in truth-surface.cjs IS the project root (it does `path.join(root, '.bonfire', ...)`), and `renderNote(root, noteId)` also expects the project root. They are consistent.

- [ ] **Step 2: Add self-render to preflightCommand in bonfire-tools.cjs**

In `bin/bonfire-tools.cjs`, modify `preflightCommand` to render after both write paths.

After the `progress` branch's `writeAtomic(coPath, co)` (around line 119), add:

```javascript
    writeAtomic(coPath, co);
    // Self-render code-preflight after update
    try {
      const { renderNote } = require('./lib/renderer.cjs');
      renderNote(path.dirname(root), 'code-preflight');
    } catch (_) {}
    exitJSON({ success: true, field: 'progress_snapshot', unit: args.unit, status: args.status });
```

After the normal field branch's `writeAtomic(coPath, co)` (around line 131), add:

```javascript
  writeAtomic(coPath, co);
  // Self-render code-preflight after update
  try {
    const { renderNote } = require('./lib/renderer.cjs');
    renderNote(path.dirname(root), 'code-preflight');
  } catch (_) {}
  exitJSON({ success: true, field, value: args.value });
```

Note: `root` in bonfire-tools.cjs comes from `resolveRoot()` which returns the `.bonfire/` directory path. So `path.dirname(root)` is the project root that `renderNote` expects.

- [ ] **Step 3: Run tests**

```bash
node --test tests/*.js
```

Expect: all 93 tests pass.

- [ ] **Step 4: Commit**

```bash
git add bin/lib/truth-surface.cjs bin/bonfire-tools.cjs
git commit -m "fix: add self-render after truth surface and preflight writes"
```

---

### Task 5: Document Hook Registration (Fix 6)

**Files:**
- Modify: `hooks/bonfire-dual-write.js` (add install instructions as comment)

- [ ] **Step 1: Add installation instructions**

Add a comment block at the top of `hooks/bonfire-dual-write.js`:

```javascript
// Installation: Add this to ~/.claude/settings.json under hooks.PostToolUse:
//
// {
//   "matcher": "Write|Edit",
//   "hooks": [
//     {
//       "type": "command",
//       "command": "node $HOME/.claude/bonfire/hooks/bonfire-dual-write.js",
//       "timeout": 10
//     }
//   ]
// }
//
// This hook captures agent Write/Edit tool calls to .bonfire/ JSON files
// (h-review-verdict.json, compile-output.json, run evidence).
// Truth surface changes go through CLI and self-render (Fix 5), not this hook.
```

- [ ] **Step 2: Commit**

```bash
git add hooks/bonfire-dual-write.js
git commit -m "fix: add hook installation instructions to bonfire-dual-write.js"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run all tests**

```bash
node --test tests/*.js
```

Expected: 93 tests pass.

- [ ] **Step 2: Verify @ paths are correct**

```bash
grep -r '@references/' skills/     # Should return 0 matches
grep -r '@\$HOME/.claude/bonfire/references/' skills/  # Should return matches in pre, plan, code, achieve
```

- [ ] **Step 3: Verify CLI shorthand is defined**

```bash
grep 'bonfire.*means' skills/*/SKILL.md  # Should return 5 matches
```

- [ ] **Step 4: Verify overview template**

```bash
grep 'project_root' templates/overview.md  # Should find it
grep 'project_paths' templates/overview.md  # Should NOT find it
```
