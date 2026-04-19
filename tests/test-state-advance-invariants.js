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
