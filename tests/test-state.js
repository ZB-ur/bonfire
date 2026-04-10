'use strict';

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

function initCase(dir) {
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
}

function readState(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'state.json'), 'utf8'));
}

test('state-read returns current state', () => {
  const dir = makeTmpDir();
  initCase(dir);
  const stdout = execFileSync('node', [CLI, 'state-read'], { encoding: 'utf8', cwd: dir });
  const state = JSON.parse(stdout);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  fs.rmSync(dir, { recursive: true });
});

test('state-step updates step status', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'running'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.steps['stage-a'].status, 'running');
  fs.rmSync(dir, { recursive: true });
});

test('state-advance moves pipeline from pre to plan', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'plan');
  assert.ok(state.steps['stage-b']);
  assert.equal(state.current_step, 'stage-b');
  fs.rmSync(dir, { recursive: true });
});

test('state-reentry resets steps from target to current', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-b', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-c', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-d', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-e', '--status', 'running'], { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'state-reentry', '--conflict-type', 'requirement_conflict', '--reason', 'test'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.reentry_to, 'stage-c');
  assert.equal(result.depth, 1);
  const state = readState(dir);
  assert.equal(state.steps['stage-c'].status, 'pending');
  assert.equal(state.steps['stage-d'].status, 'pending');
  assert.equal(state.steps['stage-e'].status, 'pending');
  assert.equal(state.steps['stage-b'].status, 'passed');
  assert.equal(state.reentry.depth, 1);
  fs.rmSync(dir, { recursive: true });
});

test('state-reentry with goal_conflict crosses pipeline to pre', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'state-reentry', '--conflict-type', 'goal_conflict'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.crosses_pipeline, true);
  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  assert.equal(state.approval.stage_a_approved, false);
  fs.rmSync(dir, { recursive: true });
});

test('state-pending-reentry sets cross-skill signal', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-pending-reentry', '--conflict-type', 'requirement_conflict', '--from', 'unit-3', '--reason', 'CON-003 violated'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.ok(state.pending_reentry);
  assert.equal(state.pending_reentry.conflict_type, 'requirement_conflict');
  assert.equal(state.pending_reentry.target_step, 'stage-c');
  assert.equal(state.pending_reentry.target_pipeline, 'plan');
  assert.equal(state.pending_reentry.originated_from, 'unit-3');
  fs.rmSync(dir, { recursive: true });
});

test('state-clear-reentry clears pending signal', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-pending-reentry', '--conflict-type', 'requirement_conflict', '--from', 'unit-3', '--reason', 'test'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-clear-reentry'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.pending_reentry, null);
  fs.rmSync(dir, { recursive: true });
});

test('state-begin-run sets current run and creates directory', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-begin-run', '--run-id', 'run-001'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.runs.current_run_id, 'run-001');
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'runs', 'run-001')));
  fs.rmSync(dir, { recursive: true });
});

test('state-complete-run records completed run', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-begin-run', '--run-id', 'run-001'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-complete-run', '--run-id', 'run-001', '--verdict', 'achieved'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.runs.current_run_id, null);
  assert.equal(state.runs.completed_runs.length, 1);
  assert.equal(state.runs.completed_runs[0].verdict, 'achieved');
  fs.rmSync(dir, { recursive: true });
});

test('state-advance from last plan step moves to code pipeline with null current_step', () => {
  const dir = makeTmpDir();
  initCase(dir);
  // Advance from pre to plan
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { cwd: dir });
  // Mark all plan steps as passed
  for (const step of ['stage-b','stage-c','stage-d','stage-e','stage-f','stage-g','stage-h','stage-j']) {
    execFileSync('node', [CLI, 'state-step', '--step', step, '--status', 'passed'], { cwd: dir });
  }
  // Advance from stage-j (last step in plan) → should move to code pipeline
  const stdout = execFileSync('node', [CLI, 'state-advance', '--step', 'stage-j'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.advanced_to_pipeline, 'code');

  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'code');
  assert.equal(state.current_step, null);
  assert.equal(state.steps['stage-j'].status, 'passed');
  fs.rmSync(dir, { recursive: true });
});
