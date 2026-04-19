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

// ─── Stage H invariant ───────────────────────────────────────────────────────

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
