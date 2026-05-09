'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');
const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'hj-seam-adversarial');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-hj-fix-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function installFixture(tmpDir, fixtureName) {
  const src = path.join(FIXTURE_ROOT, fixtureName);
  const dst = path.join(tmpDir, '.bonfire', 'plan');
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(src, 'h-review-verdict.json'), path.join(dst, 'h-review-verdict.json'));
}

function installProvenanceFixture(tmpDir, fixtureName) {
  const src = path.join(FIXTURE_ROOT, fixtureName);
  const bonfire = path.join(tmpDir, '.bonfire');
  fs.mkdirSync(path.join(bonfire, 'plan'), { recursive: true });
  fs.mkdirSync(path.join(bonfire, 'truth-surface'), { recursive: true });
  fs.copyFileSync(path.join(src, 'constraint-ledger-history.jsonl'),
    path.join(bonfire, 'truth-surface', 'constraint-ledger-history.jsonl'));
  fs.copyFileSync(path.join(src, 'h-review-verdict.json'),
    path.join(bonfire, 'plan', 'h-review-verdict.json'));
  fs.copyFileSync(path.join(src, 'compile-output.json'),
    path.join(bonfire, 'plan', 'compile-output.json'));
  execFileSync('node', [CLI, 'truth-rebuild'], { encoding: 'utf8', cwd: tmpDir });
}

function installReentryFixture(tmpDir, fixtureName) {
  const src = path.join(FIXTURE_ROOT, fixtureName);
  const dst = path.join(tmpDir, '.bonfire', 'plan');
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(src, 'compile-output.json'), path.join(dst, 'compile-output.json'));
}

function runValidateConditions(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'validate-h-conditions'], { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

function runDeltaValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'delta-validate',
      '--agent', 'bonfire-h-review',
      '--file', '.bonfire/plan/h-review-verdict.json'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

function runHandoffValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'handoff-validate'], { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

test('fixture: wrong-stage-j is caught by schema validation', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'wrong-stage-j');
    const result = runDeltaValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /target_stage/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: empty-conditions-verdict is caught by Layer 1', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'empty-conditions-verdict');
    const result = runValidateConditions(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /empty|conditions/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: condition-demands-field-add is caught by Layer 1', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'condition-demands-field-add');
    const result = runValidateConditions(dir);
    // Must be caught. Either blacklist or token coverage.
    assert.notEqual(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: each-evades-enumerate is caught by Layer 1 paraphrase pattern', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'each-evades-enumerate');
    const result = runValidateConditions(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    // Must be caught by the paraphrase pattern specifically, not by
    // accidental orphan-token coincidence. If a future change makes the
    // pattern too narrow, this assertion flags the regression.
    assert.match(out, /paraphrase|document each/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: tagged-correct-but-invents caught by Layer 2b', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'tagged-correct-but-invents');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orphan/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: supersede-drift caught by Layer 2a (source not FROZEN)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'supersede-drift');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /SUPERSEDED|FROZEN/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: chain-dilution caught by Layer 1 (condition introduces tokens not in ledger)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'chain-dilution');
    // The attack is at the condition-text level: "orthogonal" is not in CON-010.
    // validate-h-conditions rejects the verdict before J-Compile runs.
    const result = runValidateConditions(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orthogonal/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: lemmatization-edge pins behavior (either pass or fail, as long as consistent)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'lemmatization-edge');
    const result = runHandoffValidate(dir);
    // Behavior is pinned — the fixture README declares expected outcome.
    // For this test, we assert that the outcome is deterministic across runs.
    // (The README says: `classifier` vs `classification` — current lemmatizer
    // drops `classification` → `classificatio`, which doesn't match `classifier`.
    // Expected outcome: FAIL — orphan token `classifier`.)
    assert.notEqual(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: cross-language-smuggle — CJK orphans caught by Layer 2b', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'cross-language-smuggle');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orphan|开始|训练/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: cross-language-approved — Layer 2 (provenance + token coverage) accepts the slot', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'cross-language-approved');
    const result = runHandoffValidate(dir);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: legit-reentry-declaration surfaces structured reentry signal on stdout', () => {
  // Wire integrity test: J emits reentry_request as sibling of handoff with
  // code_ready=false. CLI must surface it on stdout (exit 1) instead of
  // collapsing to a generic errors-mode failure.
  const dir = makeTmpDir();
  try {
    installReentryFixture(dir, 'legit-reentry-declaration');
    const result = runHandoffValidate(dir);
    assert.equal(result.code, 1, 'B contract: explicit reentry exits non-zero');
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.valid, false);
    assert.ok(payload.reentry_request, 'reentry_request must be surfaced on stdout');
    assert.ok(
      ['invalid_stage_j_condition', 'handoff_provenance_failure'].includes(payload.reentry_request.conflict_type),
      `unexpected conflict_type: ${payload.reentry_request.conflict_type} (must be a registered route)`
    );
    // Source compile-output sanity: code_ready=false (consistency precondition)
    const co = JSON.parse(fs.readFileSync(
      path.join(dir, '.bonfire', 'plan', 'compile-output.json'), 'utf8'));
    assert.equal(co.handoff.code_ready, false, 'fixture must declare code_ready=false');
    // Backward-compat: reentry payload mutually exclusive with errors-mode shape
    assert.ok(!payload.error, 'reentry payload must not carry legacy error field');
    assert.ok(!payload.details, 'reentry payload must not carry legacy details field');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('errors-mode failure preserves legacy {error, details} payload (backward compat)', () => {
  // Pins the invariant that errors-mode and reentry-mode payloads are
  // mutually exclusive. Future changes to schema.cjs that fill `errors`
  // alongside `reentry_request` would break downstream callers; this lint
  // catches that drift.
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'tagged-correct-but-invents');
    const result = runHandoffValidate(dir);
    assert.equal(result.code, 1);
    const payload = JSON.parse(result.stdout);
    assert.ok(payload.error, 'legacy errors-mode must carry error field');
    assert.ok(Array.isArray(payload.details), 'legacy errors-mode must carry details array');
    assert.ok(!payload.reentry_request, 'errors-mode must not surface reentry_request');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Phase 2 follow-up: Class A (L0-L3) vacuous-handoff fixtures + Class B legit
// escape. Spec §7.1 / §7.2. Implementation plan steps 2.12-2.18.
// ---------------------------------------------------------------------------

test('fixture: vacuous-handoff-l0 — L0 empty containers rejected by deep-check', () => {
  // All substantive slots contain empty containers ([], {}). No semantic payload.
  // deepCheckHandoffSubstantiveSlots must fire before Layer 2a and reject.
  const dir = makeTmpDir();
  try {
    installReentryFixture(dir, 'vacuous-handoff-l0');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0, 'L0 vacuous handoff must fail handoff-validate');
    const out = result.stdout + result.stderr;
    assert.match(out, /deep_check_failed/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: vacuous-handoff-l1 — L1 [{}] shape rejected by deep-check', () => {
  // Per-entry slots have non-empty arrays but elements are {} with no required_subfields.
  // deep-check asserts each entry has all required_subfields present and non-placeholder.
  const dir = makeTmpDir();
  try {
    installReentryFixture(dir, 'vacuous-handoff-l1');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0, 'L1 [{}] handoff must fail handoff-validate');
    const out = result.stdout + result.stderr;
    assert.match(out, /deep_check_failed/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: vacuous-handoff-l2 — L2 empty/null/whitespace subfields rejected', () => {
  // required_subfields present but values are empty string, null, or whitespace.
  // isEmptyOrPlaceholder must return true for all three; deep-check rejects.
  const dir = makeTmpDir();
  try {
    installReentryFixture(dir, 'vacuous-handoff-l2');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0, 'L2 empty-subfield handoff must fail handoff-validate');
    const out = result.stdout + result.stderr;
    assert.match(out, /deep_check_failed/i);
    assert.match(out, /empty or placeholder/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: vacuous-handoff-l3 — L3 placeholder strings rejected', () => {
  // required_subfields set to registered placeholder strings (TODO, see ledger,
  // ..., <TBD>, <placeholder>, TBD, placeholder). isEmptyOrPlaceholder must
  // recognize all of these case-insensitively.
  const dir = makeTmpDir();
  try {
    installReentryFixture(dir, 'vacuous-handoff-l3');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0, 'L3 placeholder-string handoff must fail handoff-validate');
    const out = result.stdout + result.stderr;
    assert.match(out, /deep_check_failed/i);
    assert.match(out, /empty or placeholder/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: legit-no-substantive-contract — valid escape valve passes deep-check', () => {
  // Class B fixture: domain_model.entities is empty but no_substantive_contract=true
  // on the container with a valid reason referencing FROZEN CON-001. All other
  // substantive slots carry real content. handoff-validate must exit 0.
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'legit-no-substantive-contract');
    const result = runHandoffValidate(dir);
    assert.equal(result.code, 0, `legit escape valve must pass. stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: cross-language-approved — KNOWN GAP F1: Layer 1 still rejects despite valid Layer 2', () => {
  // Spec §6.4 claims a legitimate path: H-Review issues a stage-j condition whose
  // text carries the approved CJK UI copy; the compile-output slot cites the
  // condition as source and Layer 2b matches.
  //
  // In practice Layer 1 rejects the condition FIRST because its substantive tokens
  // (panel, titled, 开始训练, 和, 重置统计) are not in the FROZEN ledger and not
  // in the format whitelist. Real pipelines using state-advance --step stage-h
  // will never reach Layer 2.
  //
  // This test pins the current (broken) behavior. When the design decision lands
  // (flag on condition / require CJK in ledger / CJK Layer-1 exemption — see PR #2
  // follow-up list), this assertion flips from notEqual to equal.
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'cross-language-approved');
    const result = runValidateConditions(dir);
    assert.notEqual(
      result.code, 0,
      'F1 has been fixed — spec §6.4 positive path now flows through Layer 1. ' +
      'Flip this assertion to `assert.equal(result.code, 0)` and update the fixture README.'
    );
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
