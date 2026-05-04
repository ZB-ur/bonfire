# Bonfire Freeze Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Truth Surface freeze semantics mechanically enforced — the `/bonfire:plan` pipeline cannot advance past Stage G while unresolved PROPOSED/CHALLENGED entries remain, and cannot advance past Stage H while H-Review rulings are not satisfied in the ledger snapshot.

**Architecture:** Two new CLI commands (`stage-g-freeze-gate`, `apply-h-rulings`) backed by one new helper module (`bin/lib/freeze-enforcement.cjs`). State-advance gains invariant checks that compare the ledger snapshot against declarative expectations (no mtime, no hash markers). The existing `checkMaturityGate` is extended additively to accept non-empty `aligned_by` as satisfaction, so synthetic authorizer tokens (`stage-g-survival`, `stage-h-ruling`) appended before freeze events let unchallenged-but-affirmed entries pass the gate. `skills/plan/SKILL.md` Stage G step 32 and Stage H step 38 are replaced with single command invocations.

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert/strict`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-18-bonfire-freeze-enforcement-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `bin/lib/truth-surface.cjs` (`checkMaturityGate` body ~lines 39–63) | Extend `challenged_by_non_empty` gate check to accept non-empty `aligned_by` |
| Create | `bin/lib/freeze-enforcement.cjs` | Two business-logic helpers: `stageGFreezeGate(root)` and `applyHRulings(root)` |
| Modify | `bin/bonfire-tools.cjs` (`COMMANDS` table + two new handlers) | Wire `stage-g-freeze-gate` and `apply-h-rulings` CLI commands |
| Modify | `bin/lib/state.cjs` (`stateAdvance` function ~lines 121–191) | Add pre-advance invariant checks keyed by `stepName === 'stage-g'` / `'stage-h'` |
| Modify | `tests/test-truth-freeze.js` | One new test case: freeze succeeds with only `aligned_by` non-empty |
| Create | `tests/test-stage-g-freeze-gate.js` | Test the Stage G freeze gate command end-to-end |
| Create | `tests/test-apply-h-rulings.js` | Test the H-Review rulings application command end-to-end |
| Create | `tests/test-state-advance-invariants.js` | Test stage-g and stage-h invariant gates in `state-advance`, including regression fixture |
| Create | `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/constraint-ledger-history.jsonl` | Cut-down replica of gto-trainer's ledger history showing PROPOSED-stuck bug |
| Create | `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/h-review-verdict.json` | Verdict with unapplied rulings to repro the Stage H gap |
| Create | `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/state.json` | Minimal state.json placing pipeline at `stage-g` |
| Modify | `skills/plan/SKILL.md` (Stage G step 32 — ~lines 128–136; Stage H step 38 — ~line 159) | Replace prose sub-step enumeration with single CLI invocations |

---

## Task 1: Extend checkMaturityGate to accept aligned_by

**Files:**
- Modify: `tests/test-truth-freeze.js`
- Modify: `bin/lib/truth-surface.cjs` (function `checkMaturityGate`, lines 39–63)

Rationale: Everything downstream depends on this. Without extending the gate, the auto-alignment + freeze sequence in both new commands will fail on the `freeze()` call, because today's gate literally ignores `aligned_by`. This task is isolated and additive (no existing test breaks) — ship it in its own commit.

- [ ] **Step 1: Add failing test to `tests/test-truth-freeze.js`**

Insert this new test after the existing "freeze succeeds for retained_goal after challenge" test (after line 75 in the current file):

```javascript
// ---------------------------------------------------------------------------
// Test: freeze succeeds for retained_goal with only aligned_by set
// ---------------------------------------------------------------------------
test('freeze succeeds for retained_goal with only aligned_by set', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'rg-aligned-only',
      category: 'retained_goal',
      content: 'Survived adversarial review unchallenged.',
    });

    // No challenged_by — only aligned_by populated (simulating stage-g-survival
    // or stage-h-ruling auto-alignment path).
    update(root, { id: 'rg-aligned-only', field: 'aligned_by', value: 'stage-h-ruling' });

    freeze(root, { id: 'rg-aligned-only' });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries['rg-aligned-only'].status, 'FROZEN');
    assert.deepEqual(snapshot.entries['rg-aligned-only'].aligned_by, ['stage-h-ruling']);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
```

- [ ] **Step 2: Run the test — confirm it fails**

Run: `node --test tests/test-truth-freeze.js`

Expected: the new test fails with an error matching `/Maturity gate failed.*requires non-empty challenged_by/` (the current gate ignores `aligned_by`). The two pre-existing tests (1 and 2) pass.

- [ ] **Step 3: Modify `checkMaturityGate` in `bin/lib/truth-surface.cjs`**

Replace the `challenged_by_non_empty` branch of `checkMaturityGate` (current lines 51–55) with:

```javascript
  if (gate === 'challenged_by_non_empty') {
    const challenged = Array.isArray(entry.challenged_by) && entry.challenged_by.length > 0;
    const aligned    = Array.isArray(entry.aligned_by)    && entry.aligned_by.length    > 0;
    if (!challenged && !aligned) {
      throw new Error(
        `Maturity gate failed: "${entry.category}" requires non-empty ` +
        `challenged_by or aligned_by before freeze`
      );
    }
  } else if (gate === 'evidence_required') {
```

- [ ] **Step 4: Run the full truth-freeze test suite — confirm all pass**

Run: `node --test tests/test-truth-freeze.js`

Expected: all tests pass. The pre-existing "freeze requires challenged_by for retained_goal" test still passes because the regex `/maturity gate failed|challenged_by/i` matches the new error message (which still contains the substring `challenged_by`).

- [ ] **Step 5: Run the broader truth-surface test suite as a regression sanity check**

Run: `node --test tests/test-truth-surface.js tests/test-truth-cli.js tests/test-delta-parser.js`

Expected: all tests pass. If any test regresses, the gate extension has broken existing contracts — stop and investigate; do not proceed.

- [ ] **Step 6: Commit**

```bash
git add tests/test-truth-freeze.js bin/lib/truth-surface.cjs
git commit -m "$(cat <<'EOF'
feat(truth-surface): extend checkMaturityGate to accept aligned_by

The challenged_by_non_empty maturity gate now passes when EITHER
challenged_by OR aligned_by is non-empty. This is an additive change:
no previously-valid freeze starts failing.

Rationale: Stage G auto-freeze and Stage H rulings need to freeze
entries that were never challenged but were affirmed by stage-g
survival or h-review ruling. Those affirmations are recorded as
aligned_by append events (new tokens: stage-g-survival, stage-h-ruling).

Spec: docs/superpowers/specs/2026-04-18-bonfire-freeze-enforcement-design.md §5.3
EOF
)"
```

---

## Task 2: stage-g-freeze-gate helper + CLI + tests

**Files:**
- Create: `bin/lib/freeze-enforcement.cjs`
- Modify: `bin/bonfire-tools.cjs` (`COMMANDS` table + new handler function)
- Create: `tests/test-stage-g-freeze-gate.js`

Rationale: Encode Stage G step 32 rules as a single deterministic command. The helper is the semantic source of truth; the CLI is a thin wrapper for the plan skill and for test harnesses.

- [ ] **Step 1: Create `tests/test-stage-g-freeze-gate.js` with all failing cases**

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-sg-gate-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function runGate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'stage-g-freeze-gate'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

function readSnapshot(dir) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'),
    'utf8'
  ));
}

test('stage-g-freeze-gate auto-aligns and freezes PROPOSED entries with empty challenged_by', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-001', '--category', 'retained_goal',
      '--content', 'survived', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });

    const result = runGate(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-001'].status, 'FROZEN');
    assert.deepEqual(snap.entries['CON-001'].aligned_by, ['stage-g-survival']);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('stage-g-freeze-gate freezes CHALLENGED entries that have alignment', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-002', '--category', 'frozen_constraint',
      '--content', 'defended', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'challenged_by', '--value', 'd-critique'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'aligned_by', '--value', 'g-blue'],
      { encoding: 'utf8', cwd: dir });

    const result = runGate(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-002'].status, 'FROZEN');
    // aligned_by should NOT have stage-g-survival appended — it was already aligned
    assert.deepEqual(snap.entries['CON-002'].aligned_by, ['g-blue']);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('stage-g-freeze-gate leaves unresolved CHALLENGED entries and exits non-zero', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-003', '--category', 'retained_goal',
      '--content', 'contested', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-003', '--field', 'challenged_by', '--value', 'd-critique'],
      { encoding: 'utf8', cwd: dir });

    const result = runGate(dir);
    assert.notEqual(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-003'].status, 'CHALLENGED');
    const out = result.stdout + result.stderr;
    assert.match(out, /CON-003/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('stage-g-freeze-gate leaves high_impact_risk entries OPEN', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'RISK-001', '--category', 'high_impact_risk',
      '--content', 'unresolved risk', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });

    const result = runGate(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['RISK-001'].status, 'OPEN');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('stage-g-freeze-gate is a no-op on an empty ledger', () => {
  const dir = makeTmpDir();
  try {
    const result = runGate(dir);
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run the new test file — confirm all fail with "Unknown command"**

Run: `node --test tests/test-stage-g-freeze-gate.js`

Expected: every test fails because `bonfire stage-g-freeze-gate` is not yet a registered command. The error string will contain `Unknown command: stage-g-freeze-gate`.

- [ ] **Step 3: Create `bin/lib/freeze-enforcement.cjs` with `stageGFreezeGate`**

```javascript
'use strict';

const path = require('path');
const { loadSnapshot, update, freeze } = require('./truth-surface.cjs');

// Authorizer tokens written to aligned_by before an auto-freeze.
const TOKEN_STAGE_G = 'stage-g-survival';
const TOKEN_STAGE_H = 'stage-h-ruling';

/**
 * Run the Stage G truth-freeze gate.
 *
 * Rules (one per row of the decision table):
 *   - category == high_impact_risk             → skip (stays OPEN)
 *   - FROZEN / SUPERSEDED / DISCARDED          → skip
 *   - PROPOSED, challenged_by empty            → update aligned_by="stage-g-survival"
 *                                                 then freeze
 *   - CHALLENGED, aligned_by non-empty         → freeze (no new alignment)
 *   - CHALLENGED, aligned_by empty             → UNRESOLVED (warning, skip)
 *
 * Returns a summary object; the caller decides exit code based on unresolved.
 */
function stageGFreezeGate(root) {
  const snapshot = loadSnapshot(root);
  const entries = (snapshot && snapshot.entries) || {};

  const summary = {
    frozen: [],         // ids freshly frozen (directly, already CHALLENGED+aligned)
    autoAligned: [],    // ids auto-aligned + frozen (were PROPOSED with empty challenged_by)
    skippedRisk: [],    // high_impact_risk ids left OPEN
    skippedFrozen: [],  // ids already FROZEN / SUPERSEDED / DISCARDED
    unresolved: [],     // CHALLENGED ids without alignment — BLOCKING
  };

  for (const [id, entry] of Object.entries(entries)) {
    if (entry.category === 'high_impact_risk') {
      summary.skippedRisk.push(id);
      continue;
    }

    const status = entry.status;
    if (status === 'FROZEN' || status === 'SUPERSEDED' || status === 'DISCARDED') {
      summary.skippedFrozen.push(id);
      continue;
    }

    const challengedByEmpty = !Array.isArray(entry.challenged_by) || entry.challenged_by.length === 0;
    const alignedByNonEmpty = Array.isArray(entry.aligned_by) && entry.aligned_by.length > 0;

    if (status === 'PROPOSED' && challengedByEmpty) {
      update(root, { id, field: 'aligned_by', value: TOKEN_STAGE_G });
      freeze(root, { id });
      summary.autoAligned.push(id);
      continue;
    }

    if (status === 'CHALLENGED' && alignedByNonEmpty) {
      freeze(root, { id });
      summary.frozen.push(id);
      continue;
    }

    if (status === 'CHALLENGED') {
      summary.unresolved.push(id);
      continue;
    }

    // PROPOSED with non-empty challenged_by shouldn't exist (replay auto-transitions
    // to CHALLENGED), but fall through as unresolved to surface the anomaly.
    summary.unresolved.push(id);
  }

  return summary;
}

module.exports = {
  stageGFreezeGate,
  TOKEN_STAGE_G,
  TOKEN_STAGE_H,
};
```

- [ ] **Step 4: Wire `stage-g-freeze-gate` CLI command in `bin/bonfire-tools.cjs`**

Add to the `COMMANDS` table (around line 38, after the `truth-*` entries):

```javascript
  'stage-g-freeze-gate': () => stageGFreezeGateCommand,
  'apply-h-rulings':     () => applyHRulingsCommand,
```

(The `apply-h-rulings` entry is wired now too so both commands share a handler section — the `applyHRulingsCommand` function body is added in Task 3.)

Add the handler function above `main()` (around line 197, after `routeCommand`):

```javascript
function stageGFreezeGateCommand(args) {
  const { stageGFreezeGate } = require('./lib/freeze-enforcement.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  try {
    const summary = stageGFreezeGate(dir);
    if (summary.unresolved.length > 0) {
      process.stderr.write(
        `stage-g-freeze-gate: ${summary.unresolved.length} unresolved CHALLENGED entries ` +
        `without alignment:\n`
      );
      for (const id of summary.unresolved) {
        process.stderr.write(`  - ${id}\n`);
      }
      process.stderr.write(
        `Return these to G-Blue for defense or escalate to H-Review.\n`
      );
      exitJSON(summary, 1);
    }
    exitJSON(summary, 0);
  } catch (err) {
    exitError(err.message, []);
  }
}

function applyHRulingsCommand(args) {
  // Implementation added in Task 3.
  const { exitError } = require('./lib/utils.cjs');
  exitError('apply-h-rulings not yet implemented', []);
}
```

- [ ] **Step 5: Run the stage-g-freeze-gate tests — confirm all pass**

Run: `node --test tests/test-stage-g-freeze-gate.js`

Expected: all 5 tests pass. If the auto-alignment test fails with "Maturity gate failed", Task 1 was not correctly applied — go back and verify.

- [ ] **Step 6: Run the existing truth-surface suite to verify no regression**

Run: `node --test tests/test-truth-freeze.js tests/test-truth-surface.js tests/test-truth-cli.js`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add bin/lib/freeze-enforcement.cjs bin/bonfire-tools.cjs tests/test-stage-g-freeze-gate.js
git commit -m "$(cat <<'EOF'
feat(freeze-enforcement): add stage-g-freeze-gate command

Encode Stage G step 32 rules as a deterministic CLI command instead of
orchestrator prose. Auto-aligns and freezes PROPOSED entries that
survived adversarial review unchallenged (token: stage-g-survival);
freezes CHALLENGED entries that have an alignment; blocks on
CHALLENGED entries without alignment (exit non-zero, surface ids for
escalation).

The apply-h-rulings command is stubbed with a "not yet implemented"
error to keep the COMMANDS table shape clean; real implementation
follows in the next commit.

Spec: §5.1 (stage-g-freeze-gate), §5.3 (auto-alignment tokens).
EOF
)"
```

---

## Task 3: apply-h-rulings helper + CLI + tests

**Files:**
- Modify: `bin/lib/freeze-enforcement.cjs` (add `applyHRulings` export)
- Modify: `bin/bonfire-tools.cjs` (replace the `applyHRulingsCommand` stub)
- Create: `tests/test-apply-h-rulings.js`

Rationale: Encode Stage H step 38 as a deterministic command. Pre-validate before emitting any events (atomic on failure). Idempotent on already-FROZEN ids.

- [ ] **Step 1: Create `tests/test-apply-h-rulings.js` with all failing cases**

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-apply-h-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function writeVerdict(dir, rulings, extra = {}) {
  const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
  fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
  fs.writeFileSync(verdictPath, JSON.stringify({
    verdict: extra.verdict || 'approved',
    reason: 'test',
    rulings: rulings,
    ...extra,
  }, null, 2));
  return verdictPath;
}

function runApply(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'apply-h-rulings'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

function readSnapshot(dir) {
  return JSON.parse(fs.readFileSync(
    path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'),
    'utf8'
  ));
}

function readHistory(dir) {
  const p = path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-history.jsonl');
  return fs.readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

test('apply-h-rulings freezes all targets on happy path', () => {
  const dir = makeTmpDir();
  try {
    for (const id of ['CON-A', 'CON-B', 'CON-C']) {
      execFileSync('node', [CLI, 'truth-propose',
        '--id', id, '--category', 'retained_goal',
        '--content', 'x', '--rationale', 'r', '--source', 'stage-a'],
        { encoding: 'utf8', cwd: dir });
    }
    writeVerdict(dir, [
      { action: 'freeze', id: 'CON-A' },
      { action: 'freeze', id: 'CON-B' },
      { action: 'freeze', id: 'CON-C' },
    ]);

    const result = runApply(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    for (const id of ['CON-A', 'CON-B', 'CON-C']) {
      assert.equal(snap.entries[id].status, 'FROZEN');
    }
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings auto-aligns targets with empty challenged_by', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-X', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });
    writeVerdict(dir, [{ action: 'freeze', id: 'CON-X' }]);

    const result = runApply(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-X'].status, 'FROZEN');
    assert.deepEqual(snap.entries['CON-X'].aligned_by, ['stage-h-ruling']);

    // History should have update-then-freeze ordering.
    const history = readHistory(dir);
    const xEvents = history.filter(e => e.id === 'CON-X' && e.type !== 'propose');
    assert.equal(xEvents[0].type, 'update');
    assert.equal(xEvents[0].field, 'aligned_by');
    assert.equal(xEvents[0].value, 'stage-h-ruling');
    assert.equal(xEvents[1].type, 'freeze');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings appends (not replaces) when aligned_by is pre-populated', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-Y', '--category', 'frozen_constraint',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-Y', '--field', 'aligned_by', '--value', 'g-blue'],
      { encoding: 'utf8', cwd: dir });
    writeVerdict(dir, [{ action: 'freeze', id: 'CON-Y' }]);

    const result = runApply(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.deepEqual(snap.entries['CON-Y'].aligned_by, ['g-blue', 'stage-h-ruling']);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings is idempotent: already-FROZEN target skipped, exit 0', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-Z', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-Z', '--field', 'challenged_by', '--value', 'd-critique'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-Z'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, [{ action: 'freeze', id: 'CON-Z' }]);
    const result = runApply(dir);
    assert.equal(result.code, 0);

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-Z'].status, 'FROZEN');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings is atomic: nonexistent id fails pre-validation, no events written', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-REAL', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });

    const historyBefore = readHistory(dir).length;

    writeVerdict(dir, [
      { action: 'freeze', id: 'CON-REAL' },
      { action: 'freeze', id: 'CON-GHOST' },
    ]);
    const result = runApply(dir);
    assert.notEqual(result.code, 0);

    const historyAfter = readHistory(dir).length;
    assert.equal(historyAfter, historyBefore, 'no events should have been appended');

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CON-REAL'].status, 'PROPOSED', 'real target untouched');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings accepts a verdict with empty rulings array', () => {
  const dir = makeTmpDir();
  try {
    writeVerdict(dir, []);
    const result = runApply(dir);
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('apply-h-rulings accepts a verdict with no rulings field', () => {
  const dir = makeTmpDir();
  try {
    const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
    fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
    fs.writeFileSync(verdictPath, JSON.stringify({ verdict: 'approved', reason: 'test' }, null, 2));

    const result = runApply(dir);
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run the new test file — confirm all fail**

Run: `node --test tests/test-apply-h-rulings.js`

Expected: every test fails with `apply-h-rulings not yet implemented` (the stub from Task 2). This confirms the stub is reachable and ready to be replaced.

- [ ] **Step 3: Add `applyHRulings` to `bin/lib/freeze-enforcement.cjs`**

Append to the existing `freeze-enforcement.cjs` (before `module.exports`):

```javascript
/**
 * Apply all freeze/supersede rulings from an h-review-verdict.json file.
 *
 * Classification:
 *   1. filter rulings[] to action ∈ {freeze, supersede}
 *   2. freeze rulings whose target is already FROZEN → idempotent skip
 *   3. everything else → pre-validation (target exists, supersede preconditions)
 *   4. if pre-validation fails on any non-skip ruling → throw without writing
 *   5. otherwise emit planned events (update aligned_by + freeze, or supersede)
 */
function applyHRulings(root) {
  const { validateDelta } = require('./delta-parser.cjs');
  const { supersede } = require('./truth-surface.cjs');
  const fs = require('fs');
  const path = require('path');

  const verdictPath = path.join(root, '.bonfire', 'plan', 'h-review-verdict.json');
  let verdict;
  try {
    verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read verdict at ${verdictPath}: ${err.message}`);
  }

  const validation = validateDelta('bonfire-h-review', verdict);
  if (!validation.valid) {
    throw new Error('Verdict failed schema validation: ' + validation.errors.join('; '));
  }

  const rulings = Array.isArray(verdict.rulings) ? verdict.rulings : [];
  const filtered = rulings.filter(r => r.action === 'freeze' || r.action === 'supersede');

  const snapshot = loadSnapshot(root);
  const entries = (snapshot && snapshot.entries) || {};

  // Classify
  const skips = [];       // { id }
  const toExecute = [];   // { ruling, plan: 'freeze-with-align' | 'freeze' | 'supersede' }
  const failures = [];    // { ruling, reason }

  for (const ruling of filtered) {
    if (ruling.action === 'freeze') {
      const entry = entries[ruling.id];
      if (!entry) {
        failures.push({ ruling, reason: `target id "${ruling.id}" does not exist` });
        continue;
      }
      if (entry.status === 'FROZEN') {
        skips.push({ id: ruling.id });
        continue;
      }
      // Plan auto-alignment if challenged_by empty; freeze either way.
      const challengedByEmpty = !Array.isArray(entry.challenged_by) || entry.challenged_by.length === 0;
      toExecute.push({
        ruling,
        plan: challengedByEmpty ? 'freeze-with-align' : 'freeze',
      });
      continue;
    }

    if (ruling.action === 'supersede') {
      const oldEntry = entries[ruling.supersedes];
      if (!oldEntry) {
        failures.push({ ruling, reason: `supersedes target "${ruling.supersedes}" does not exist` });
        continue;
      }
      if (oldEntry.status !== 'FROZEN') {
        failures.push({ ruling, reason: `supersedes target "${ruling.supersedes}" must be FROZEN (is ${oldEntry.status})` });
        continue;
      }
      if (entries[ruling.id]) {
        failures.push({ ruling, reason: `new id "${ruling.id}" already exists` });
        continue;
      }
      if (!ruling.content || !ruling.category) {
        failures.push({ ruling, reason: `supersede ruling missing content or category` });
        continue;
      }
      toExecute.push({ ruling, plan: 'supersede' });
    }
  }

  if (failures.length > 0) {
    const msg = failures.map(f => {
      const rid = f.ruling.id || (f.ruling.supersedes ? `supersede(${f.ruling.supersedes})` : '<unknown>');
      return `  - ${rid}: ${f.reason}`;
    }).join('\n');
    throw new Error(`apply-h-rulings pre-validation failed:\n${msg}`);
  }

  // Execute — mutations happen here. Failures above guarantee this phase writes
  // no partial events.
  for (const item of toExecute) {
    const { ruling, plan } = item;
    if (plan === 'freeze-with-align') {
      update(root, { id: ruling.id, field: 'aligned_by', value: TOKEN_STAGE_H });
      freeze(root, { id: ruling.id });
    } else if (plan === 'freeze') {
      freeze(root, { id: ruling.id });
    } else if (plan === 'supersede') {
      supersede(root, {
        id: ruling.id,
        supersedes: ruling.supersedes,
        category: ruling.category,
        content: ruling.content,
        source: ruling.source || 'h-review',
        rationale: ruling.rationale || null,
      });
    }
  }

  return {
    applied: toExecute.map(t => ({
      id: t.ruling.id,
      action: t.ruling.action,
      autoAligned: t.plan === 'freeze-with-align',
    })),
    skipped: skips,
  };
}
```

Update the `module.exports` at the bottom of the file:

```javascript
module.exports = {
  stageGFreezeGate,
  applyHRulings,
  TOKEN_STAGE_G,
  TOKEN_STAGE_H,
};
```

- [ ] **Step 4: Replace the `applyHRulingsCommand` stub in `bin/bonfire-tools.cjs`**

Replace the stub with:

```javascript
function applyHRulingsCommand(args) {
  const { applyHRulings } = require('./lib/freeze-enforcement.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  try {
    const result = applyHRulings(dir);
    exitJSON(result, 0);
  } catch (err) {
    exitError(err.message, []);
  }
}
```

- [ ] **Step 5: Run the apply-h-rulings tests — confirm all pass**

Run: `node --test tests/test-apply-h-rulings.js`

Expected: all 7 tests pass. If the "atomic" test fails because events were partially written, the pre-validation short-circuit in `applyHRulings` is broken — inspect the `failures.length > 0` throw path.

- [ ] **Step 6: Run the stage-g-freeze-gate tests to verify no cross-regression**

Run: `node --test tests/test-stage-g-freeze-gate.js tests/test-truth-freeze.js tests/test-truth-surface.js tests/test-truth-cli.js`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add bin/lib/freeze-enforcement.cjs bin/bonfire-tools.cjs tests/test-apply-h-rulings.js
git commit -m "$(cat <<'EOF'
feat(freeze-enforcement): add apply-h-rulings command

Encode Stage H step 38 as a deterministic CLI command. Reads
.bonfire/plan/h-review-verdict.json, filters rulings to freeze/supersede,
classifies idempotent skips (already-FROZEN targets), pre-validates
remaining rulings atomically (no partial event writes on failure), then
emits the planned event sequence. Auto-aligns freeze targets with empty
challenged_by using the stage-h-ruling token.

Spec: §5.1 (apply-h-rulings behavior), §5.3 (auto-alignment).
EOF
)"
```

---

## Task 4: state-advance invariant — stage-g

**Files:**
- Modify: `bin/lib/state.cjs` (`stateAdvance` function)
- Create: `tests/test-state-advance-invariants.js`

Rationale: Mechanical enforcement that `state-advance --step stage-g` refuses to progress while `PROPOSED` or `CHALLENGED` entries remain (other than `high_impact_risk`). This is the tests that would have caught the gto-trainer bug.

- [ ] **Step 1: Create `tests/test-state-advance-invariants.js` with stage-g cases**

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-inv-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function runAdvance(dir, step) {
  try {
    const stdout = execFileSync('node', [CLI, 'state-advance', '--step', step],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

// Move the pipeline to stage-g by marking all prior plan steps passed.
// Requires init to have already created state.json.
function setPipelineToStageG(dir) {
  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.pipeline_stage = 'plan';
  state.current_step = 'stage-g';
  for (const step of ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f']) {
    state.steps[step] = { status: 'passed', pipeline: 'plan', passed_at: new Date().toISOString() };
  }
  state.steps['stage-g'] = { status: 'running', pipeline: 'plan', started_at: new Date().toISOString() };
  state.approval = state.approval || {};
  state.approval.stage_a_approved = true;
  state.approval.stage_a_approved_at = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

test('state-advance from stage-g blocks when PROPOSED entries remain', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageG(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-STUCK', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });

    const result = runAdvance(dir, 'stage-g');
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /CON-STUCK/);
    assert.match(out, /stage-g-freeze-gate/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-g allows when only high_impact_risk PROPOSED remains', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageG(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'RISK-ONE', '--category', 'high_impact_risk',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });

    const result = runAdvance(dir, 'stage-g');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-g allows after stage-g-freeze-gate runs successfully', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageG(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-OK', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });

    execFileSync('node', [CLI, 'stage-g-freeze-gate'], { encoding: 'utf8', cwd: dir });

    const result = runAdvance(dir, 'stage-g');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run — confirm all 3 tests fail**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: the first test (blocking case) fails because state-advance currently succeeds without checking the invariant; the other two may pass incidentally but won't once the gate is wired correctly. The exact failure mode tells you the baseline.

- [ ] **Step 3: Add the stage-g invariant to `bin/lib/state.cjs`**

At the top of `stateAdvance` (after the argument check, before the `const schema = getSchema();` line around line 128), insert the gate dispatch:

```javascript
  // Invariant gates: refuse to advance when ledger state violates contract.
  if (stepName === 'stage-g') {
    checkStageGInvariant();
  }
```

Add the helper function in the same file, above `stateAdvance`:

```javascript
function checkStageGInvariant() {
  const { loadSnapshot } = require('./truth-surface.cjs');
  const root = getRoot();
  const dir = path.dirname(root);
  const snapshot = loadSnapshot(dir);
  const entries = (snapshot && snapshot.entries) || {};

  const unresolved = [];
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.category === 'high_impact_risk') continue;
    if (entry.status === 'PROPOSED' || entry.status === 'CHALLENGED') {
      unresolved.push(id);
    }
  }

  if (unresolved.length > 0) {
    process.stderr.write(
      `Cannot advance from stage-g: ${unresolved.length} entries still unresolved:\n`
    );
    for (const id of unresolved) {
      process.stderr.write(`  - ${id}\n`);
    }
    process.stderr.write(`Run: bonfire stage-g-freeze-gate\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the invariant tests — confirm they pass**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: all 3 tests pass.

- [ ] **Step 5: Run the full state/truth test suite to verify no regression**

Run: `node --test tests/test-state.js tests/test-truth-surface.js tests/test-truth-cli.js tests/test-stage-g-freeze-gate.js`

Expected: all tests pass. If `test-state.js` regresses, the invariant was invoked on non-stage-g advances — check the `if (stepName === 'stage-g')` guard.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/state.cjs tests/test-state-advance-invariants.js
git commit -m "$(cat <<'EOF'
feat(state): enforce stage-g invariant in state-advance

state-advance --step stage-g now refuses to advance while any
constraint ledger entry is in PROPOSED or CHALLENGED status, excluding
high_impact_risk (which is designed to stay OPEN permanently).
Remediation hint points at bonfire stage-g-freeze-gate.

This is the mechanical counterpart to skill prose that was previously
silently skipped on the gto-trainer case.

Spec: §5.2 (stage-g invariant row).
EOF
)"
```

---

## Task 5: state-advance invariant — stage-h

**Files:**
- Modify: `bin/lib/state.cjs` (extend `stateAdvance` + add `checkStageHInvariant`)
- Modify: `tests/test-state-advance-invariants.js` (append stage-h cases)

- [ ] **Step 1: Append stage-h test cases to `tests/test-state-advance-invariants.js`**

Add below the existing tests (still inside the same file). First, a helper to move the pipeline to stage-h:

```javascript
function setPipelineToStageH(dir) {
  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.pipeline_stage = 'plan';
  state.current_step = 'stage-h';
  for (const step of ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f', 'stage-g']) {
    state.steps[step] = { status: 'passed', pipeline: 'plan', passed_at: new Date().toISOString() };
  }
  state.steps['stage-h'] = { status: 'running', pipeline: 'plan', started_at: new Date().toISOString() };
  state.approval = state.approval || {};
  state.approval.stage_a_approved = true;
  state.approval.stage_a_approved_at = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function writeVerdict(dir, rulings) {
  const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
  fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
  fs.writeFileSync(verdictPath, JSON.stringify({
    verdict: 'approved_with_conditions',
    reason: 'test',
    rulings,
  }, null, 2));
}

test('state-advance from stage-h blocks when rulings are unsatisfied', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-UNSAT', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    writeVerdict(dir, [{ action: 'freeze', id: 'CON-UNSAT' }]);

    const result = runAdvance(dir, 'stage-h');
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /CON-UNSAT/);
    assert.match(out, /expected=FROZEN/);
    assert.match(out, /actual=PROPOSED/);
    assert.match(out, /apply-h-rulings/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-h allows when all rulings satisfied by apply-h-rulings', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-APPLIED', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    writeVerdict(dir, [{ action: 'freeze', id: 'CON-APPLIED' }]);
    execFileSync('node', [CLI, 'apply-h-rulings'], { encoding: 'utf8', cwd: dir });

    const result = runAdvance(dir, 'stage-h');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-h allows when verdict has empty rulings', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    writeVerdict(dir, []);

    const result = runAdvance(dir, 'stage-h');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-h allows when ruling is redundant (target already FROZEN)', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-PRE', '--category', 'retained_goal',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-PRE', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-PRE'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, [{ action: 'freeze', id: 'CON-PRE' }]);
    // No apply-h-rulings — target was already frozen by stage-g.

    const result = runAdvance(dir, 'stage-h');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run — confirm all 4 new tests fail**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: all stage-h tests fail because the stage-h invariant isn't wired. Earlier stage-g tests still pass.

- [ ] **Step 3: Add the stage-h invariant to `bin/lib/state.cjs`**

Extend the invariant dispatch in `stateAdvance`:

```javascript
  if (stepName === 'stage-g') {
    checkStageGInvariant();
  } else if (stepName === 'stage-h') {
    checkStageHInvariant();
  }
```

Add the helper function (below `checkStageGInvariant`):

```javascript
function checkStageHInvariant() {
  const { loadSnapshot } = require('./truth-surface.cjs');
  const root = getRoot();
  const dir = path.dirname(root);
  const verdictPath = path.join(root, 'plan', 'h-review-verdict.json');

  const verdict = loadJSON(verdictPath);
  if (!verdict) exitError(`h-review-verdict.json not found at ${verdictPath}`, [], 3);

  const rulings = Array.isArray(verdict.rulings) ? verdict.rulings : [];
  const filtered = rulings.filter(r => r.action === 'freeze' || r.action === 'supersede');
  if (filtered.length === 0) return;  // trivial pass

  const snapshot = loadSnapshot(dir);
  const entries = (snapshot && snapshot.entries) || {};

  const failures = [];
  for (const ruling of filtered) {
    if (ruling.action === 'freeze') {
      const actual = entries[ruling.id] && entries[ruling.id].status;
      if (actual !== 'FROZEN') {
        failures.push(`  - freeze(id=${ruling.id}) expected=FROZEN actual=${actual || '<missing>'}`);
      }
    } else if (ruling.action === 'supersede') {
      const oldStatus = entries[ruling.supersedes] && entries[ruling.supersedes].status;
      const newStatus = entries[ruling.id] && entries[ruling.id].status;
      const oldOk = oldStatus === 'SUPERSEDED';
      const newOk = newStatus === 'FROZEN';
      if (!oldOk || !newOk) {
        failures.push(
          `  - supersede(supersedes=${ruling.supersedes}, id=${ruling.id}) ` +
          `expected: ${ruling.supersedes}=SUPERSEDED, ${ruling.id}=FROZEN; ` +
          `actual: ${ruling.supersedes}=${oldStatus || '<missing>'}, ${ruling.id}=${newStatus || '<missing>'}`
        );
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Cannot advance from stage-h: ${failures.length} rulings not satisfied:\n`
    );
    process.stderr.write(failures.join('\n') + '\n');
    process.stderr.write(`Run: bonfire apply-h-rulings\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the invariant tests — confirm all pass**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: all 7 tests (3 stage-g + 4 stage-h) pass.

- [ ] **Step 5: Run the full test suite as a regression sweep**

Run: `node --test tests/*.js`

Expected: every test file passes. This is the broad sanity check before committing the invariant.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/state.cjs tests/test-state-advance-invariants.js
git commit -m "$(cat <<'EOF'
feat(state): enforce stage-h invariant in state-advance

state-advance --step stage-h now refuses to advance unless the current
snapshot satisfies every freeze/supersede ruling in
.bonfire/plan/h-review-verdict.json. State-based comparison — no mtime,
no hash markers. Redundant rulings (target already FROZEN by stage-g)
are trivially satisfied; empty rulings[] passes trivially.

Failure output includes expected/actual status per ruling, including
both sides of a supersede pair when either is wrong.

Spec: §5.2 (stage-h invariant row + failure output sample).
EOF
)"
```

---

## Task 6: Regression fixture for gto-trainer bug

**Files:**
- Create: `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/constraint-ledger-history.jsonl`
- Create: `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/h-review-verdict.json`
- Create: `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/state.json`
- Modify: `tests/test-state-advance-invariants.js` (append fixture-driven test)

Rationale: Concrete proof that the same bug pattern observed in gto-trainer (22 stuck PROPOSED entries + 14 unapplied rulings) cannot recur under the new gates. Cut down to minimal structure — the PATTERN matters, not the exact numbers.

- [ ] **Step 1: Create `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/constraint-ledger-history.jsonl`**

```jsonl
{"type":"propose","id":"CON-002","category":"retained_goal","content":"Web application SPA","source":"stage-a","rationale":"User chose web platform","notes":null,"timestamp":"2026-04-11T17:31:57.113Z"}
{"type":"propose","id":"CON-007","category":"retained_goal","content":"Chinese language UI","source":"stage-a","rationale":"User request","notes":null,"timestamp":"2026-04-11T17:34:32.324Z"}
{"type":"propose","id":"CON-012","category":"frozen_constraint","content":"Tech stack React + Vite","source":"stage-c","rationale":"Retained option A","notes":null,"timestamp":"2026-04-11T17:42:21.545Z"}
{"type":"propose","id":"ACC-001","category":"acceptance_semantic","content":"User can select drill mode","source":"stage-a","rationale":"Core flow","notes":null,"timestamp":"2026-04-11T17:38:26.112Z"}
{"type":"propose","id":"DEP-001","category":"dependency_chain","content":"REQ-02 blocks REQ-03","source":"stage-c","rationale":"Type dependency","notes":null,"timestamp":"2026-04-11T17:42:28.786Z"}
{"type":"propose","id":"RISK-001","category":"high_impact_risk","content":"Full GTO data infeasible","source":"stage-a","rationale":"Intractable","notes":null,"timestamp":"2026-04-11T16:07:38.674Z"}
{"type":"propose","id":"CON-001","category":"retained_goal","content":"Preflop + simplified postflop scope","source":"stage-a","rationale":"User tradeoff","notes":null,"timestamp":"2026-04-11T17:30:48.278Z"}
{"type":"update","id":"CON-001","field":"challenged_by","value":"d-critique","timestamp":"2026-04-11T17:44:52.000Z"}
{"type":"freeze","id":"CON-001","timestamp":"2026-04-11T17:49:40.071Z"}
```

Pattern captured:
- 4 PROPOSED entries with empty `challenged_by` (CON-002, CON-007, CON-012, ACC-001, DEP-001) — the stuck bug
- 1 high_impact_risk entry (RISK-001) — should NOT block
- 1 entry (CON-001) that was correctly challenged and frozen — baseline that works

- [ ] **Step 2: Create `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/h-review-verdict.json`**

```json
{
  "verdict": "approved_with_conditions",
  "reason": "Conditions addressable in J-Compile",
  "conflict_type": null,
  "conditions": [
    "J-Compile MUST enumerate board textures"
  ],
  "rulings": [
    { "action": "freeze", "id": "CON-002" },
    { "action": "freeze", "id": "CON-007" },
    { "action": "freeze", "id": "CON-012" },
    { "action": "freeze", "id": "ACC-001" },
    { "action": "freeze", "id": "DEP-001" }
  ]
}
```

- [ ] **Step 3: Create `tests/fixtures/freeze-enforcement/gto-trainer-bug-repro/state.json`**

```json
{
  "version": 1,
  "created_at": "2026-04-11T16:04:52.721Z",
  "updated_at": "2026-04-11T17:57:54.917Z",
  "pipeline_stage": "plan",
  "current_step": "stage-g",
  "steps": {
    "stage-a": { "status": "passed", "pipeline": "pre", "passed_at": "2026-04-11T17:39:41.596Z" },
    "stage-b": { "status": "passed", "pipeline": "plan", "passed_at": "2026-04-11T17:41:27.876Z" },
    "stage-c": { "status": "passed", "pipeline": "plan", "passed_at": "2026-04-11T17:42:49.689Z" },
    "stage-d": { "status": "passed", "pipeline": "plan", "passed_at": "2026-04-11T17:45:03.019Z" },
    "stage-e": { "status": "passed", "pipeline": "plan", "passed_at": "2026-04-11T17:45:34.677Z" },
    "stage-f": { "status": "passed", "pipeline": "plan", "passed_at": "2026-04-11T17:46:00.045Z" },
    "stage-g": { "status": "running", "pipeline": "plan", "started_at": "2026-04-11T17:49:46.236Z" }
  },
  "approval": {
    "stage_a_approved": true,
    "stage_a_approved_at": "2026-04-11T17:39:41.949Z"
  },
  "reentry": { "depth": 0, "max_depth": 2, "history": [] },
  "pending_reentry": null,
  "runs": { "current_run_id": null, "completed_runs": [] }
}
```

- [ ] **Step 4: Append fixture-driven test to `tests/test-state-advance-invariants.js`**

Add at the bottom of the file:

```javascript
// ---------------------------------------------------------------------------
// Regression: reproduce gto-trainer freeze-bug and verify the new gates catch it
// ---------------------------------------------------------------------------

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'freeze-enforcement', 'gto-trainer-bug-repro');

function loadFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-fixture-'));
  const bonfireDir = path.join(dir, '.bonfire');
  fs.mkdirSync(path.join(bonfireDir, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'plan'), { recursive: true });

  fs.copyFileSync(
    path.join(FIXTURE_DIR, 'constraint-ledger-history.jsonl'),
    path.join(bonfireDir, 'truth-surface', 'constraint-ledger-history.jsonl')
  );
  fs.copyFileSync(
    path.join(FIXTURE_DIR, 'h-review-verdict.json'),
    path.join(bonfireDir, 'plan', 'h-review-verdict.json')
  );
  fs.copyFileSync(
    path.join(FIXTURE_DIR, 'state.json'),
    path.join(bonfireDir, 'state.json')
  );

  // Rebuild snapshot from history.
  execFileSync('node', [CLI, 'truth-rebuild'], { encoding: 'utf8', cwd: dir });

  return dir;
}

test('regression: gto-trainer fixture — stage-g advance blocks on stuck PROPOSED entries', () => {
  const dir = loadFixture();
  try {
    const result = runAdvance(dir, 'stage-g');
    assert.notEqual(result.code, 0);

    const out = result.stdout + result.stderr;
    // Should list the 5 PROPOSED entries (risk excluded).
    for (const id of ['CON-002', 'CON-007', 'CON-012', 'ACC-001', 'DEP-001']) {
      assert.match(out, new RegExp(id));
    }
    // Should NOT list the risk.
    assert.doesNotMatch(out, /RISK-001/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('regression: gto-trainer fixture — after stage-g-freeze-gate, stage-g advance succeeds', () => {
  const dir = loadFixture();
  try {
    execFileSync('node', [CLI, 'stage-g-freeze-gate'], { encoding: 'utf8', cwd: dir });
    const result = runAdvance(dir, 'stage-g');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('regression: gto-trainer fixture — after stage-g freezes, stage-h advance blocks until rulings applied', () => {
  const dir = loadFixture();
  try {
    execFileSync('node', [CLI, 'stage-g-freeze-gate'], { encoding: 'utf8', cwd: dir });
    // Move pipeline pointer to stage-h.
    const statePath = path.join(dir, '.bonfire', 'state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.steps['stage-g'] = { status: 'passed', pipeline: 'plan', passed_at: new Date().toISOString() };
    state.current_step = 'stage-h';
    state.steps['stage-h'] = { status: 'running', pipeline: 'plan', started_at: new Date().toISOString() };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Stage G already froze all 5 — verdict rulings are redundant. State-comparison
    // should treat them as trivially satisfied (targets already FROZEN).
    const result = runAdvance(dir, 'stage-h');
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 5: Run the fixture-driven tests — confirm they pass**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: all tests including the 3 new regression tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/freeze-enforcement/ tests/test-state-advance-invariants.js
git commit -m "$(cat <<'EOF'
test: regression fixture for gto-trainer freeze-bug

Cut-down replica of the gto-trainer case where 22 PROPOSED entries
stuck in the ledger while state.json recorded stage-g/h as passed.
Fixture has 5 PROPOSED entries + 1 high_impact_risk + 1 correctly-frozen
baseline. Three tests verify:

  1. stage-g advance blocks on the 5 stuck entries (risk excluded)
  2. After stage-g-freeze-gate, stage-g advance succeeds
  3. Stage-h rulings redundant to stage-g freezes are trivially
     satisfied by state-comparison (no apply-h-rulings needed)

This is the proof that the gto-trainer class of bugs cannot recur.
EOF
)"
```

---

## Task 7: Rewrite skills/plan/SKILL.md Stage G and Stage H steps

**Files:**
- Modify: `skills/plan/SKILL.md`

Rationale: Remove the prose that was silently skipped. Replace with single CLI invocations. The state-advance invariants now enforce the contract even if the orchestrator forgets.

- [ ] **Step 1: Rewrite Stage G step 32 in `skills/plan/SKILL.md`**

Find the section starting `32. **Truth-Freeze Gate** (part of stage-g exit):` and ending at the empty line before `33. Render: \`bonfire render --note stage-g\``.

Replace the entire block (currently sub-steps a through e) with:

```markdown
32. **Truth-Freeze Gate:** run `bonfire stage-g-freeze-gate`.
    - Exit 0 → all eligible PROPOSED/CHALLENGED entries are now FROZEN
      (high_impact_risk stays OPEN by design).
    - Non-zero exit → the command lists CHALLENGED entries without
      alignment. Return these to G-Blue for defense, or escalate to
      H-Review. Do not proceed until the command exits 0.
```

- [ ] **Step 2: Rewrite Stage H step 38 in the same file**

Find the section starting `38. Execute rulings:` (currently describes a loop over rulings). Replace with:

```markdown
38. **Apply rulings:** run `bonfire apply-h-rulings`.
    - Exit 0 → all freeze/supersede rulings are materialized in the
      ledger (auto-alignment via `stage-h-ruling` token is handled
      internally for unchallenged targets).
    - Non-zero exit → pre-validation surfaced a problem (missing id,
      supersede precondition, etc.). Inspect stderr, revise the verdict
      if the rulings themselves are wrong, and re-run. Do not retry
      blindly.
```

- [ ] **Step 3: Add a sentence to Stage G step 34 and Stage H step 40 about state-advance enforcement**

Find step 34 (current text: `Gate: red/blue complete + residual risks recorded + freeze verification passed → advance`). Append:

```markdown
34. Gate: red/blue complete + residual risks recorded + freeze verification passed → advance. `state-advance --step stage-g` now enforces the invariant: if any entry is still PROPOSED or CHALLENGED (excluding `high_impact_risk`), advance is refused and the command prints the offending ids.
```

Find step 40 (Stage H verdict routing). After the routing table/list, append:

```markdown
Note: `state-advance --step stage-h` enforces that every `freeze`/`supersede` ruling in the verdict is satisfied by the current ledger snapshot. A verdict with empty `rulings` passes trivially; redundant rulings (target already FROZEN by Stage G) are trivially satisfied without requiring `apply-h-rulings`.
```

- [ ] **Step 4: Verify no other references to the old prose remain**

Run: `grep -n "truth-freeze --id" skills/plan/SKILL.md`

Expected: no matches in the Stage G or Stage H sections (the old loops are gone). If other mentions exist in unrelated contexts (Stage E closure, etc.), leave them.

Run: `grep -n "For each.*freeze" skills/plan/SKILL.md`

Expected: no matches. If any remain, they are likely leftover from the old step-38 loop — remove them.

- [ ] **Step 5: Commit**

```bash
git add skills/plan/SKILL.md
git commit -m "$(cat <<'EOF'
docs(skill): collapse Stage G/H prose into single CLI commands

Stage G step 32 was a 5-sub-step enumeration telling Claude to loop
over PROPOSED/CHALLENGED entries and call truth-freeze per id. Stage H
step 38 was a loop over verdict.rulings. Both were silently skipped on
the gto-trainer case.

Replaced with single command invocations: stage-g-freeze-gate and
apply-h-rulings. Steps 34 and 40 note that state-advance now enforces
the ledger invariants mechanically.

Spec: §5.4 skill rewrites.
EOF
)"
```

---

## Task 8: Full test suite verification

**Files:** None modified.

Rationale: Single sweep after all changes to confirm nothing regressed across the 114-test baseline.

- [ ] **Step 1: Run the entire test suite**

Run: `node --test tests/*.js`

Expected: every test passes. Baseline 114 tests + the new tests added in this plan (approx +19 new tests across 3 new files + 1 existing file). Exact count may differ slightly depending on how `node --test` reports; count failures not passes.

- [ ] **Step 2: Verify new commands appear in bonfire-tools.cjs help**

Run: `node bin/bonfire-tools.cjs 2>&1 | head -5`

Expected: the "Commands:" line includes both `stage-g-freeze-gate` and `apply-h-rulings`.

- [ ] **Step 3: Inspect git log to confirm 7 atomic commits**

Run: `git log --oneline -10`

Expected: 7 new commits (one per task 1–7), each scoped to its own concern. If any commit mixed changes from multiple tasks, that's a plan-execution error worth noting; the work is still valid.

- [ ] **Step 4: No commit — plan complete**

This is a verification-only task. If all previous steps passed, the freeze enforcement implementation is ready for PR.

---

## Notes for the implementing engineer

- **Idempotency is a design property, not a test afterthought.** If you find yourself adding "is this already done?" checks outside the locations marked in Tasks 2 and 3, stop — the wrong layer is doing the check.
- **Don't silently coerce ledger event shapes.** The truth-surface module is event-sourced: corrupt events in history.jsonl will poison the replay forever. If your test fixtures look weird, compare against an existing .bonfire/ directory from a real run.
- **The `stderr` vs `stdout` separation matters.** User-facing failure messages (the Stage G/H invariant output, the apply-h-rulings failures) go to `stderr`. Machine-readable success payloads go to `stdout` via `exitJSON`. Do not mix.
- **`process.exit()` inside a helper is a smell.** The state-advance helpers use `process.exit` directly because that's how `state.cjs` already handles fatal errors. The freeze-enforcement module does NOT — it throws and lets the CLI wrapper decide. Follow the pattern of the module you're editing.
