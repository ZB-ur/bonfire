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

test('stage-g-freeze-gate skips all can_freeze=false categories (not just high_impact_risk)', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CC-TWO', '--category', 'challenged_claim',
      '--content', 'contested claim', '--rationale', 'r', '--source', 'stage-d'],
      { encoding: 'utf8', cwd: dir });

    const result = runGate(dir);
    assert.equal(result.code, 0, 'can_freeze=false entries should not cause gate failure');

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['CC-TWO'].status, 'CHALLENGED', 'challenged_claim status preserved');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
