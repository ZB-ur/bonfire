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
  assert.equal(state.steps['stage-c'].pipeline, 'plan');
  assert.equal(state.steps['stage-d'].pipeline, 'plan');
  assert.equal(state.steps['stage-e'].pipeline, 'plan');
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
  assert.equal(state.steps['stage-a'].pipeline, 'pre');
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

test('init creates stage-a with pipeline pre', () => {
  const dir = makeTmpDir();
  initCase(dir);
  const state = readState(dir);
  assert.equal(state.steps['stage-a'].pipeline, 'pre');
  fs.rmSync(dir, { recursive: true });
});

test('state-advance past stage-a sets approval', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.approval.stage_a_approved, true);
  assert.ok(state.approval.stage_a_approved_at);
  fs.rmSync(dir, { recursive: true });
});

function writeEmptyHVerdict(dir) {
  // Stage-h invariant requires verdict to exist.
  // 3a verdict_substantive_check (Assertion 3a §6.4): approved + empty conditions/rulings
  // requires the no_substantive_oversight escape valve with a resolving ledger ref.
  // Provide a minimal FROZEN snapshot so the ref resolves.
  const snapshotPath = path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({
    version: 1, replayed_at: '2026-05-09T00:00:00Z', event_count: 1,
    entries: { 'CON-001': { id: 'CON-001', category: 'retained_goal', status: 'FROZEN', content: 'test', rationale: 'test fixture', challenged_by: [], aligned_by: [], evidence_refs: [], notes: [] } },
    by_status: { proposed: [], challenged: [], frozen: ['CON-001'], superseded: [], open: [], discarded: [] },
    by_category: { retained_goal: ['CON-001'] },
  }, null, 2));

  const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
  fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
  fs.writeFileSync(verdictPath, JSON.stringify({
    verdict: 'approved',
    reason: 'test — ledger fully converged',
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'All ledger entries FROZEN. See CON-001 for converged state.',
  }, null, 2));
}

test('state-advance from plan last step sets pipeline_stage to code', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  writeEmptyHVerdict(dir);
  const planSteps = ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f', 'stage-g', 'stage-h', 'stage-j'];
  for (const step of planSteps) {
    execFileSync('node', [CLI, 'state-step', '--step', step, '--status', 'passed'], { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'state-advance', '--step', step], { encoding: 'utf8', cwd: dir });
  }
  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'code');
  assert.equal(state.current_step, null);
  fs.rmSync(dir, { recursive: true });
});

test('state-init-code-steps creates unit steps with pipeline code', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  writeEmptyHVerdict(dir);
  const planSteps = ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f', 'stage-g', 'stage-h', 'stage-j'];
  for (const step of planSteps) {
    execFileSync('node', [CLI, 'state-step', '--step', step, '--status', 'passed'], { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'state-advance', '--step', step], { encoding: 'utf8', cwd: dir });
  }
  const coPath = path.join(dir, '.bonfire', 'plan', 'compile-output.json');
  fs.writeFileSync(coPath, JSON.stringify({
    handoff: { code_ready: true, implementation_units: [{ id: 'unit-1' }, { id: 'unit-2' }] }
  }));
  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.steps['unit-1'].pipeline, 'code');
  assert.equal(state.steps['unit-2'].pipeline, 'code');
  assert.equal(state.steps['unit-1'].status, 'pending');
  assert.equal(state.current_step, 'unit-1');
  fs.rmSync(dir, { recursive: true });
});
