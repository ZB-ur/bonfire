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
