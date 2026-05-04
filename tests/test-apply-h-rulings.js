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

test('apply-h-rulings fails pre-validation for can_freeze=false categories without partial writes', () => {
  const dir = makeTmpDir();
  try {
    // high_impact_risk has can_freeze: false in the schema
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'RISK-NO-FREEZE', '--category', 'high_impact_risk',
      '--content', 'x', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });

    const historyBefore = readHistory(dir).length;

    writeVerdict(dir, [{ action: 'freeze', id: 'RISK-NO-FREEZE' }]);
    const result = runApply(dir);
    assert.notEqual(result.code, 0, 'should fail pre-validation');

    const historyAfter = readHistory(dir).length;
    assert.equal(historyAfter, historyBefore, 'no events should have been appended (including no stray aligned_by update)');

    const snap = readSnapshot(dir);
    assert.equal(snap.entries['RISK-NO-FREEZE'].status, 'OPEN', 'risk entry unchanged');
    assert.deepEqual(snap.entries['RISK-NO-FREEZE'].aligned_by, [], 'no auto-alignment leaked through');
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
