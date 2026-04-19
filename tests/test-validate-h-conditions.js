'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-vhc-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function writeVerdict(dir, verdict) {
  const p = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(verdict, null, 2));
}

function runValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'validate-h-conditions'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

test('validate-h-conditions: approved verdict returns exit 0', () => {
  const dir = makeTmpDir();
  try {
    writeVerdict(dir, { verdict: 'approved', reason: 'ok' });
    const result = runValidate(dir);
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: valid stage-j condition passes', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-001', '--category', 'retained_goal',
      '--content', 'user can select drill mode', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-001', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-001'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'minor format work',
      conditions: [{
        text: 'reformat CON-001 drill mode into given/when/then',
        target_stage: 'stage-j',
      }],
    });

    const result = runValidate(dir);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: verb blacklist violation fails', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-002', '--category', 'frozen_constraint',
      '--content', 'board texture', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'aligned_by', '--value', 'g-blue'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'challenged_by', '--value', 'd-critique'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-002'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{
        text: 'J-Compile MUST enumerate CON-002 categories',
        target_stage: 'stage-j',
      }],
    });

    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /enumerate/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: empty rulings orthogonal — only conditions matter', () => {
  const dir = makeTmpDir();
  try {
    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [],
    });
    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /empty|conditions/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: no verdict file produces error', () => {
  const dir = makeTmpDir();
  try {
    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /not found|verdict/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
