# Bonfire Plan 1: Foundation Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bonfire plugin scaffold, schema, CLI entry point, and init/archive commands so that `.bonfire/` directories can be created and managed.

**Architecture:** Single-entry CLI (`bonfire-tools.cjs`) routes subcommands to handler modules in `bin/lib/`. All state files use write-then-rename for atomicity. Schema (`bonfire-v1.json`) is the declarative source of truth for note definitions, route table, category rules, and delta validation.

**Tech Stack:** Node.js (built-in modules only: fs, path, crypto). CommonJS (.cjs). No npm dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `.claude-plugin/plugin.json` | Plugin manifest |
| Create | `schemas/bonfire-v1.json` | Bundle structure contract: notes, routes, categories, delta schemas |
| Create | `bin/bonfire-tools.cjs` | CLI entry point + subcommand router |
| Create | `bin/lib/utils.cjs` | Shared helpers: writeAtomic, loadJSON, resolveRoot, timestamp |
| Create | `bin/lib/init.cjs` | `init`, `archive`, `archive-list` command handlers |
| Create | `tests/test-foundation.js` | Tests for schema loading, init, archive |

---

### Task 1: Plugin Manifest

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: Create plugin.json**

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

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat: add bonfire plugin manifest"
```

---

### Task 2: Schema — Note Definitions and Route Table

**Files:**
- Create: `schemas/bonfire-v1.json`

- [ ] **Step 1: Create bonfire-v1.json with all note definitions, route table, categories, delta schemas, and preflight whitelist**

```json
{
  "schema_version": 1,
  "notes": [
    {
      "id": "overview",
      "filename": "00-overview.md",
      "template": "overview.md",
      "source": "case.json",
      "requires": []
    },
    {
      "id": "constraint-ledger",
      "filename": "05-constraint-ledger.md",
      "template": "constraint-ledger.md",
      "source": "truth-surface/constraint-ledger-snapshot.json",
      "requires": []
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
      "output_dir": "runs/{run_id}/",
      "requires": []
    },
    {
      "id": "verification",
      "filename": "01-verification.md",
      "template": "verification.md",
      "source": "runs/{run_id}/verification.json",
      "output_dir": "runs/{run_id}/",
      "requires": []
    },
    {
      "id": "reentry",
      "filename": "02-reentry.md",
      "template": "reentry.md",
      "source": "runs/{run_id}/reentry.json",
      "output_dir": "runs/{run_id}/",
      "requires": []
    },
    {
      "id": "achieve",
      "filename": "03-achieve.md",
      "template": "achieve.md",
      "source": "runs/{run_id}/achieve.json",
      "output_dir": "runs/{run_id}/",
      "requires": []
    }
  ],
  "reentry_routes": {
    "goal_conflict":          { "to": "stage-a", "crosses_pipeline": true },
    "scope_conflict":         { "to": "stage-b", "crosses_pipeline": false },
    "requirement_conflict":   { "to": "stage-c", "crosses_pipeline": false },
    "critique_gap":           { "to": "stage-d", "crosses_pipeline": false },
    "dependency_gap":         { "to": "stage-e", "crosses_pipeline": false },
    "probe_invalidated":      { "to": "stage-f", "crosses_pipeline": false },
    "adversarial_unresolved": { "to": "stage-g", "crosses_pipeline": false },
    "handoff_incomplete":     { "to": "stage-h", "crosses_pipeline": false },
    "handoff_contradiction":  { "to": "stage-j", "crosses_pipeline": false }
  },
  "categories": {
    "retained_goal": {
      "can_freeze": true,
      "maturity_gate": "challenged_by_non_empty",
      "terminal_status": null
    },
    "confirmed_fact": {
      "can_freeze": true,
      "maturity_gate": "evidence_required",
      "terminal_status": null
    },
    "frozen_constraint": {
      "can_freeze": true,
      "maturity_gate": "challenged_by_non_empty",
      "terminal_status": null
    },
    "challenged_claim": {
      "can_freeze": false,
      "maturity_gate": null,
      "terminal_status": null,
      "note": "stays CHALLENGED until resolved, then reclassified"
    },
    "discarded_option": {
      "can_freeze": false,
      "maturity_gate": "rationale_non_empty",
      "terminal_status": "discarded"
    },
    "high_impact_risk": {
      "can_freeze": false,
      "maturity_gate": null,
      "terminal_status": "open",
      "note": "never freezes, stays OPEN permanently"
    },
    "dependency_chain": {
      "can_freeze": true,
      "maturity_gate": "refs_valid",
      "terminal_status": null
    },
    "acceptance_semantic": {
      "can_freeze": true,
      "maturity_gate": "challenged_by_non_empty",
      "terminal_status": null
    }
  },
  "delta_schemas": {
    "bonfire-d-critique": {
      "required_fields": ["agent", "challenges"],
      "optional_fields": ["proposals", "alignments", "follow_up_questions"],
      "constraints": { "challenges_min_length": 1 }
    },
    "bonfire-g-red": {
      "required_fields": ["agent", "challenges"],
      "optional_fields": ["proposals", "follow_up_questions"],
      "constraints": { "challenges_min_length": 1 }
    },
    "bonfire-g-blue": {
      "required_fields": ["agent", "alignments"],
      "optional_fields": ["proposals", "follow_up_questions"],
      "constraints": { "alignments_min_length": 1 }
    },
    "bonfire-h-review": {
      "required_fields": ["verdict", "reason"],
      "optional_fields": ["conflict_type", "conditions", "rulings"],
      "constraints": {
        "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
        "conflict_type_required_when_rejected": true
      }
    },
    "bonfire-evaluator": {
      "required_fields": ["unit", "iteration", "verdict", "verification_results"],
      "optional_fields": ["issues", "algedonic", "conflict_type", "contradiction"],
      "constraints": {
        "verdict_enum": ["PASS", "FAIL"],
        "conflict_type_from_reentry_routes": true
      }
    }
  },
  "annotate_whitelist": ["evidence_refs", "aligned_by", "notes"],
  "preflight_mutable_fields": [
    "current_focus",
    "progress_snapshot",
    "remaining_work",
    "session_notes",
    "blockers",
    "pause_conditions"
  ],
  "step_order": {
    "pre":     ["stage-a"],
    "plan":    ["stage-b", "stage-c", "stage-d", "stage-e", "stage-f", "stage-g", "stage-h", "stage-j"],
    "achieve": ["verify", "accept", "archive"]
  },
  "step_statuses": ["pending", "running", "awaiting_agent", "awaiting_user", "integrating", "gate_check", "passed", "gate_failed"]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "feat: add bonfire-v1.json schema with notes, routes, categories, delta schemas"
```

---

### Task 3: Shared Utilities

**Files:**
- Create: `bin/lib/utils.cjs`

- [ ] **Step 1: Write tests for utils**

Create `tests/test-utils.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeAtomic, loadJSON, timestamp, resolveRoot, parseArgs } = require('../bin/lib/utils.cjs');

test('writeAtomic writes file atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'test.json');
  writeAtomic(file, { hello: 'world' });
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(result, { hello: 'world' });
  // no .tmp file left behind
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.equal(files[0], 'test.json');
  fs.rmSync(dir, { recursive: true });
});

test('writeAtomic creates parent directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'nested', 'deep', 'test.json');
  writeAtomic(file, { nested: true });
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(result, { nested: true });
  fs.rmSync(dir, { recursive: true });
});

test('loadJSON reads and parses JSON file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'data.json');
  fs.writeFileSync(file, JSON.stringify({ key: 'value' }));
  const result = loadJSON(file);
  assert.deepStrictEqual(result, { key: 'value' });
  fs.rmSync(dir, { recursive: true });
});

test('loadJSON returns null for missing file', () => {
  const result = loadJSON('/nonexistent/path/file.json');
  assert.equal(result, null);
});

test('timestamp returns ISO string', () => {
  const ts = timestamp();
  assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('resolveRoot finds .bonfire/ directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  fs.mkdirSync(path.join(dir, '.bonfire'));
  const root = resolveRoot(dir);
  assert.equal(root, path.join(dir, '.bonfire'));
  fs.rmSync(dir, { recursive: true });
});

test('resolveRoot returns null when no .bonfire/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const root = resolveRoot(dir);
  assert.equal(root, null);
  fs.rmSync(dir, { recursive: true });
});

test('parseArgs parses --key value pairs', () => {
  const result = parseArgs(['--request', 'hello world', '--project-root', '/tmp']);
  assert.deepStrictEqual(result, { request: 'hello world', 'project-root': '/tmp' });
});

test('parseArgs handles flags without values', () => {
  const result = parseArgs(['--confirm']);
  assert.deepStrictEqual(result, { confirm: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-utils.js`
Expected: All tests FAIL with "Cannot find module"

- [ ] **Step 3: Implement utils.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

function writeAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function resolveRoot(cwd) {
  const candidate = path.join(cwd || process.cwd(), '.bonfire');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = next;
        i++;
      }
    }
  }
  return result;
}

function loadSchema() {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'bonfire-v1.json');
  return loadJSON(schemaPath);
}

function exitJSON(data, code = 0) {
  if (code === 0) {
    process.stdout.write(JSON.stringify(data) + '\n');
  } else {
    process.stdout.write(JSON.stringify(data) + '\n');
  }
  process.exit(code);
}

function exitError(message, details, code = 1) {
  exitJSON({ error: message, details: details || [] }, code);
}

module.exports = { writeAtomic, loadJSON, timestamp, resolveRoot, parseArgs, loadSchema, exitJSON, exitError };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-utils.js`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/utils.cjs tests/test-utils.js
git commit -m "feat: add shared utilities with atomic writes, JSON loading, arg parsing"
```

---

### Task 4: CLI Entry Point

**Files:**
- Create: `bin/bonfire-tools.cjs`

- [ ] **Step 1: Write test for CLI routing**

Append to `tests/test-foundation.js` (create file):

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

test('CLI with no args prints usage to stderr and exits 2', () => {
  try {
    execFileSync('node', [CLI], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(err.stderr, /usage/i);
  }
});

test('CLI with unknown command exits 2', () => {
  try {
    execFileSync('node', [CLI, 'unknown-command'], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(err.stderr, /unknown command/i);
  }
});

test('CLI route --list returns all conflict types', () => {
  const stdout = execFileSync('node', [CLI, 'route', '--list'], { encoding: 'utf8' });
  const result = JSON.parse(stdout);
  assert.ok(result.goal_conflict);
  assert.equal(result.goal_conflict.to, 'stage-a');
  assert.equal(result.goal_conflict.crosses_pipeline, true);
  assert.ok(result.requirement_conflict);
  assert.equal(Object.keys(result).length, 9);
});

test('CLI route --conflict-type returns specific route', () => {
  const stdout = execFileSync('node', [CLI, 'route', '--conflict-type', 'dependency_gap'], { encoding: 'utf8' });
  const result = JSON.parse(stdout);
  assert.equal(result.to, 'stage-e');
  assert.equal(result.crosses_pipeline, false);
});

test('CLI route with invalid conflict-type exits 1', () => {
  try {
    execFileSync('node', [CLI, 'route', '--conflict-type', 'invalid'], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.ok(result.error);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-foundation.js`
Expected: All tests FAIL (file doesn't exist)

- [ ] **Step 3: Implement bonfire-tools.cjs**

```javascript
#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseArgs, loadSchema, exitJSON, exitError } = require('./lib/utils.cjs');

const COMMANDS = {
  // Init domain
  'init':             () => require('./lib/init.cjs').init,
  'archive':          () => require('./lib/init.cjs').archive,
  'archive-list':     () => require('./lib/init.cjs').archiveList,
  // Route domain (inline, no separate module needed)
  'route':            () => routeCommand,
  // Stub domains (implemented in later plans)
  'state-read':       () => stub,
  'state-advance':    () => stub,
  'state-reentry':    () => stub,
  'state-pending-reentry': () => stub,
  'state-clear-reentry':   () => stub,
  'state-step':       () => stub,
  'state-begin-run':  () => stub,
  'state-complete-run': () => stub,
  'state-init-code-steps': () => stub,
  'truth-propose':    () => stub,
  'truth-update':     () => stub,
  'truth-annotate':   () => stub,
  'truth-freeze':     () => stub,
  'truth-supersede':  () => stub,
  'truth-discard':    () => stub,
  'truth-read':       () => stub,
  'truth-query':      () => stub,
  'truth-rebuild':    () => stub,
  'delta-validate':   () => stub,
  'handoff-validate': () => stub,
  'bundle-validate':  () => stub,
  'render':           () => stub,
  'render-check':     () => stub,
  'log-agent':        () => stub,
  'log-transition':   () => stub,
  'log-read':         () => stub,
  'preflight-update': () => stub,
};

function stub(args) {
  exitError('Command not yet implemented (see Plan 2-3)', [], 3);
}

function routeCommand(args) {
  const schema = loadSchema();
  if (!schema) exitError('Cannot load bonfire-v1.json schema', [], 3);

  if (args.list) {
    exitJSON(schema.reentry_routes);
    return;
  }

  const type = args['conflict-type'];
  if (!type) {
    process.stderr.write('Usage: bonfire-tools.cjs route --list | --conflict-type <type>\n');
    process.exit(2);
  }

  const route = schema.reentry_routes[type];
  if (!route) {
    exitError(`Unknown conflict type: ${type}`, Object.keys(schema.reentry_routes));
  }
  exitJSON(route);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stderr.write('Usage: bonfire-tools.cjs <command> [--flags]\n');
    process.stderr.write('Commands: ' + Object.keys(COMMANDS).join(', ') + '\n');
    process.exit(2);
  }

  const command = argv[0];
  const factory = COMMANDS[command];
  if (!factory) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write('Commands: ' + Object.keys(COMMANDS).join(', ') + '\n');
    process.exit(2);
  }

  const handler = factory();
  const args = parseArgs(argv.slice(1));
  handler(args);
}

main();
```

- [ ] **Step 4: Make CLI executable**

Run: `chmod +x bin/bonfire-tools.cjs`

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/test-foundation.js`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add bin/bonfire-tools.cjs tests/test-foundation.js
git commit -m "feat: add CLI entry point with subcommand routing and route command"
```

---

### Task 5: Init Command — Directory Scaffolding

**Files:**
- Create: `bin/lib/init.cjs`

- [ ] **Step 1: Write tests for init command**

Create `tests/test-init.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
}

test('init creates .bonfire/ with correct structure', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'init', '--request', 'Add OAuth2 auth', '--project-root', dir], {
    encoding: 'utf8',
    cwd: dir
  });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);

  // Check directories exist
  assert.ok(fs.existsSync(path.join(dir, '.bonfire')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'truth-surface')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'plan')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'bundle')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'runs')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'logs')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive')));

  // Check state.json
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'state.json'), 'utf8'));
  assert.equal(state.version, 1);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  assert.equal(state.steps['stage-a'].status, 'pending');
  assert.equal(state.pending_reentry, null);
  assert.equal(state.reentry.depth, 0);
  assert.equal(state.reentry.max_depth, 2);

  // Check case.json
  const caseJson = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'case.json'), 'utf8'));
  assert.equal(caseJson.bundle_version, 1);
  assert.equal(caseJson.source_request, 'Add OAuth2 auth');
  assert.equal(caseJson.project_paths.root, dir);
  assert.equal(caseJson.stages.preprocess, null);
  assert.equal(caseJson.stages.divergence, null);

  // Check truth surface files
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-history.jsonl')));
  const snapshot = JSON.parse(fs.readFileSync(
    path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'), 'utf8'
  ));
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.event_count, 0);
  assert.deepStrictEqual(snapshot.entries, {});

  fs.rmSync(dir, { recursive: true });
});

test('init fails if .bonfire/ already exists', () => {
  const dir = makeTmpDir();
  fs.mkdirSync(path.join(dir, '.bonfire'));
  try {
    execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
      encoding: 'utf8',
      cwd: dir
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.match(result.error, /already exists/i);
  }
  fs.rmSync(dir, { recursive: true });
});

test('init fails without --request', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'init', '--project-root', dir], {
      encoding: 'utf8',
      cwd: dir
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
  }
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-init.js`
Expected: All tests FAIL (init module doesn't exist)

- [ ] **Step 3: Implement init.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { writeAtomic, loadJSON, timestamp, exitJSON, exitError } = require('./utils.cjs');

function init(args) {
  const request = args.request;
  const projectRoot = args['project-root'] || process.cwd();

  if (!request) {
    process.stderr.write('Usage: bonfire-tools.cjs init --request <text> [--project-root <path>]\n');
    process.exit(2);
  }

  const bonfireDir = path.join(projectRoot, '.bonfire');
  if (fs.existsSync(bonfireDir)) {
    exitError('.bonfire/ already exists. Archive the current case first.', [bonfireDir]);
  }

  // Create directory structure
  const dirs = [
    '',
    'truth-surface',
    'plan',
    'bundle',
    'runs',
    'logs',
    'archive'
  ];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(bonfireDir, dir), { recursive: true });
  }

  const now = timestamp();

  // Scaffold state.json
  const state = {
    version: 1,
    created_at: now,
    updated_at: now,
    pipeline_stage: 'pre',
    current_step: 'stage-a',
    steps: {
      'stage-a': { status: 'pending' }
    },
    approval: {
      stage_a_approved: false,
      stage_a_approved_at: null
    },
    reentry: {
      depth: 0,
      max_depth: 2,
      history: []
    },
    pending_reentry: null,
    runs: {
      current_run_id: null,
      completed_runs: []
    }
  };
  writeAtomic(path.join(bonfireDir, 'state.json'), state);

  // Scaffold case.json
  const caseData = {
    bundle_version: 1,
    title: null,
    created_at: now,
    source_request: request,
    project_paths: { root: projectRoot },
    stages: {
      preprocess: null,
      divergence: null,
      requirements: null,
      critique: null,
      closure: null,
      probes: null,
      red_blue: null,
      review: null,
      compile_for_code: null
    }
  };
  writeAtomic(path.join(bonfireDir, 'case.json'), caseData);

  // Scaffold empty truth surface
  const emptySnapshot = {
    version: 1,
    replayed_at: now,
    event_count: 0,
    entries: {},
    by_status: {
      proposed: [],
      challenged: [],
      frozen: [],
      superseded: [],
      open: [],
      discarded: []
    },
    by_category: {
      retained_goal: [],
      confirmed_fact: [],
      frozen_constraint: [],
      challenged_claim: [],
      discarded_option: [],
      high_impact_risk: [],
      dependency_chain: [],
      acceptance_semantic: []
    }
  };
  writeAtomic(path.join(bonfireDir, 'truth-surface', 'constraint-ledger-snapshot.json'), emptySnapshot);
  fs.writeFileSync(path.join(bonfireDir, 'truth-surface', 'constraint-ledger-history.jsonl'), '');
  fs.writeFileSync(path.join(bonfireDir, 'truth-surface', 'constraint-ledger.md'),
    '# Constraint Ledger\n\n_No entries yet._\n');

  exitJSON({ success: true, path: bonfireDir, created_at: now });
}

function archive(args) {
  const name = args.name;
  if (!name) {
    process.stderr.write('Usage: bonfire-tools.cjs archive --name <name>\n');
    process.exit(2);
  }

  const bonfireDir = path.join(process.cwd(), '.bonfire');
  if (!fs.existsSync(bonfireDir)) {
    exitError('.bonfire/ does not exist', []);
  }

  const archiveDir = path.join(bonfireDir, 'archive', name);
  if (fs.existsSync(archiveDir)) {
    exitError(`Archive "${name}" already exists`, [archiveDir]);
  }

  fs.mkdirSync(archiveDir, { recursive: true });

  // Move everything except archive/ into the archive directory
  const entries = fs.readdirSync(bonfireDir);
  for (const entry of entries) {
    if (entry === 'archive') continue;
    const src = path.join(bonfireDir, entry);
    const dst = path.join(archiveDir, entry);
    fs.renameSync(src, dst);
  }

  // Re-scaffold empty directories for next case
  const dirs = ['truth-surface', 'plan', 'bundle', 'runs', 'logs'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(bonfireDir, dir), { recursive: true });
  }

  exitJSON({ success: true, archived_to: archiveDir });
}

function archiveList(args) {
  const archiveDir = path.join(process.cwd(), '.bonfire', 'archive');
  if (!fs.existsSync(archiveDir)) {
    exitJSON({ archives: [] });
    return;
  }

  const entries = fs.readdirSync(archiveDir)
    .filter(e => fs.statSync(path.join(archiveDir, e)).isDirectory())
    .sort();

  exitJSON({ archives: entries });
}

module.exports = { init, archive, archiveList };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-init.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/init.cjs tests/test-init.js
git commit -m "feat: add init, archive, archive-list commands with directory scaffolding"
```

---

### Task 6: Archive Commands Tests

**Files:**
- Modify: `tests/test-init.js`

- [ ] **Step 1: Add archive tests**

Append to `tests/test-init.js`:

```javascript
test('archive moves case to archive directory', () => {
  const dir = makeTmpDir();
  // First init
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });

  // Write something to verify it gets moved
  fs.writeFileSync(path.join(dir, '.bonfire', 'plan', 'test-marker.json'), '{}');

  // Archive
  const stdout = execFileSync('node', [CLI, 'archive', '--name', 'test-case'], {
    encoding: 'utf8', cwd: dir
  });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);

  // Verify archived
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'state.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'case.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'plan', 'test-marker.json')));

  // Verify clean slate
  assert.ok(!fs.existsSync(path.join(dir, '.bonfire', 'state.json')));
  assert.ok(!fs.existsSync(path.join(dir, '.bonfire', 'case.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'plan'))); // empty dir re-created
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.bonfire', 'plan')), []);

  fs.rmSync(dir, { recursive: true });
});

test('archive-list returns empty when no archives', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  const stdout = execFileSync('node', [CLI, 'archive-list'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.deepStrictEqual(result.archives, []);
  fs.rmSync(dir, { recursive: true });
});

test('archive-list returns archived cases sorted', () => {
  const dir = makeTmpDir();

  // Init and archive twice
  execFileSync('node', [CLI, 'init', '--request', 'first', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  execFileSync('node', [CLI, 'archive', '--name', 'beta-case'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'init', '--request', 'second', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  execFileSync('node', [CLI, 'archive', '--name', 'alpha-case'], { encoding: 'utf8', cwd: dir });

  const stdout = execFileSync('node', [CLI, 'archive-list'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.deepStrictEqual(result.archives, ['alpha-case', 'beta-case']);

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run all tests**

Run: `node --test tests/test-init.js`
Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test-init.js
git commit -m "test: add archive and archive-list integration tests"
```

---

### Task 7: Schema Loader Validation

**Files:**
- Modify: `tests/test-foundation.js`

- [ ] **Step 1: Add schema validation tests**

Append to `tests/test-foundation.js`:

```javascript
test('schema has exactly 22 notes', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(schema.notes.length, 22);
});

test('schema notes have unique ids', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const ids = schema.notes.map(n => n.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, `Duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('schema notes have unique filenames', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const filenames = schema.notes.map(n => n.filename);
  const unique = new Set(filenames);
  assert.equal(filenames.length, unique.size);
});

test('schema note requires reference valid ids', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const ids = new Set(schema.notes.map(n => n.id));
  for (const note of schema.notes) {
    for (const req of (note.requires || [])) {
      assert.ok(ids.has(req), `Note "${note.id}" requires unknown note "${req}"`);
    }
  }
});

test('schema has 9 reentry routes', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.reentry_routes).length, 9);
});

test('schema reentry route targets are valid steps', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const allSteps = Object.values(schema.step_order).flat();
  for (const [type, route] of Object.entries(schema.reentry_routes)) {
    assert.ok(allSteps.includes(route.to), `Route "${type}" targets unknown step "${route.to}"`);
  }
});

test('schema has 8 categories', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.categories).length, 8);
});

test('schema has 5 delta schemas', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.delta_schemas).length, 5);
});

test('schema preflight_mutable_fields has 6 entries', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(schema.preflight_mutable_fields.length, 6);
});
```

- [ ] **Step 2: Run all foundation tests**

Run: `node --test tests/test-foundation.js`
Expected: All 14 tests PASS (5 CLI + 9 schema)

- [ ] **Step 3: Commit**

```bash
git add tests/test-foundation.js
git commit -m "test: add schema integrity validation tests"
```

---

### Task 8: Run All Tests Together

- [ ] **Step 1: Run complete test suite**

Run: `node --test tests/test-utils.js tests/test-foundation.js tests/test-init.js`
Expected: All 24 tests PASS (9 utils + 14 foundation + 6 init (originally 3 + 3 appended))

Wait — let me recount. test-init.js has 3 original + 3 appended = 6. test-foundation.js has 5 original + 9 appended = 14. test-utils.js has 9. Total = 29.

Run: `node --test tests/test-utils.js tests/test-foundation.js tests/test-init.js`
Expected: All 29 tests PASS

- [ ] **Step 2: Verify no stale temp directories**

Run: `ls /tmp/bonfire-test-* 2>/dev/null | wc -l`
Expected: `0` (all temp dirs cleaned up)

---

### Task 9: Stub Module Files for Plan 2-3

Create empty module files so imports don't crash when Plan 2-3 implements them.

**Files:**
- Create: `bin/lib/truth-surface.cjs`
- Create: `bin/lib/state.cjs`
- Create: `bin/lib/renderer.cjs`
- Create: `bin/lib/delta-parser.cjs`
- Create: `bin/lib/schema.cjs`
- Create: `bin/lib/logger.cjs`

- [ ] **Step 1: Create all stub modules**

`bin/lib/truth-surface.cjs`:
```javascript
'use strict';
// Implemented in Plan 2
module.exports = {};
```

`bin/lib/state.cjs`:
```javascript
'use strict';
// Implemented in Plan 2
module.exports = {};
```

`bin/lib/renderer.cjs`:
```javascript
'use strict';
// Implemented in Plan 3
module.exports = {};
```

`bin/lib/delta-parser.cjs`:
```javascript
'use strict';
// Implemented in Plan 3
module.exports = {};
```

`bin/lib/schema.cjs`:
```javascript
'use strict';
// Implemented in Plan 3
module.exports = {};
```

`bin/lib/logger.cjs`:
```javascript
'use strict';
// Implemented in Plan 2
module.exports = {};
```

- [ ] **Step 2: Commit**

```bash
git add bin/lib/truth-surface.cjs bin/lib/state.cjs bin/lib/renderer.cjs bin/lib/delta-parser.cjs bin/lib/schema.cjs bin/lib/logger.cjs
git commit -m "chore: add stub modules for Plan 2-3 implementation"
```

---

### Task 10: Skeleton Template and Reference Directories

Create empty placeholder directories and one example template to validate the rendering pipeline later.

**Files:**
- Create: `templates/.gitkeep`
- Create: `references/.gitkeep`

- [ ] **Step 1: Create directories with .gitkeep**

```bash
mkdir -p templates references
touch templates/.gitkeep references/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add templates/.gitkeep references/.gitkeep
git commit -m "chore: add empty templates/ and references/ directories"
```

---

### Task 11: Golden Test Case Skeleton

**Files:**
- Create: `examples/sample-case/request.txt`
- Create: `examples/sample-case/case.json`

- [ ] **Step 1: Create request.txt**

```text
Add OAuth2 authentication to the existing Express.js API. Support Google and GitHub providers. Store sessions in PostgreSQL.
```

- [ ] **Step 2: Create case.json (Stage A completed state)**

```json
{
  "bundle_version": 1,
  "title": "OAuth2 Authentication",
  "created_at": "2026-04-10T09:00:00.000Z",
  "source_request": "Add OAuth2 authentication to the existing Express.js API. Support Google and GitHub providers. Store sessions in PostgreSQL.",
  "project_paths": { "root": "/example/project" },
  "stages": {
    "preprocess": {
      "ambiguity_points": ["Session storage strategy unclear", "Token refresh policy not specified"],
      "reframed_goal": "Add OAuth2 login with Google and GitHub to Express.js API, storing sessions in existing PostgreSQL database",
      "retained_scope": ["OAuth2 code flow for Google and GitHub", "Session persistence in PostgreSQL", "JWT token issuance"],
      "excluded_scope": ["Email/password auth", "SAML/LDAP", "Mobile deep linking"],
      "critical_assumptions": ["PostgreSQL is already running and accessible", "Express.js app uses standard middleware pattern"],
      "frozen_for_code": ["passport.js as OAuth library", "express-session with connect-pg-simple for session store"]
    },
    "divergence": null,
    "requirements": null,
    "critique": null,
    "closure": null,
    "probes": null,
    "red_blue": null,
    "review": null,
    "compile_for_code": null
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/sample-case/request.txt examples/sample-case/case.json
git commit -m "feat: add golden test case skeleton with Stage A sample data"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run complete test suite one more time**

Run: `node --test tests/test-utils.js tests/test-foundation.js tests/test-init.js`
Expected: All 29 tests PASS

- [ ] **Step 2: Verify file structure matches spec**

Run: `find . -not -path './.git/*' -not -path './node_modules/*' -not -name '.DS_Store' | sort`

Expected key paths:
```
./.claude-plugin/plugin.json
./bin/bonfire-tools.cjs
./bin/lib/delta-parser.cjs
./bin/lib/init.cjs
./bin/lib/logger.cjs
./bin/lib/renderer.cjs
./bin/lib/schema.cjs
./bin/lib/state.cjs
./bin/lib/truth-surface.cjs
./bin/lib/utils.cjs
./docs/superpowers/plans/2026-04-10-plan-1-foundation.md
./docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md
./examples/sample-case/case.json
./examples/sample-case/request.txt
./references/.gitkeep
./schemas/bonfire-v1.json
./templates/.gitkeep
./tests/test-foundation.js
./tests/test-init.js
./tests/test-utils.js
```

- [ ] **Step 3: Verify git log**

Run: `git log --oneline`

Expected: ~8 commits covering manifest, schema, utils, CLI, init, archive tests, schema tests, stubs, templates, golden case.
