const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-3c-test-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
  return dir;
}

function readSnapshot(dir) {
  const snapPath = path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
  return JSON.parse(fs.readFileSync(snapPath, 'utf8'));
}

function writeCompileOutput(dir, units) {
  const planDir = path.join(dir, '.bonfire', 'plan');
  fs.mkdirSync(planDir, { recursive: true });
  const compileOutput = {
    handoff: { implementation_units: units },
  };
  fs.writeFileSync(path.join(planDir, 'compile-output.json'), JSON.stringify(compileOutput));
}

// ===== Predicates 1-3: truth-surface.cjs (T1 changes) =====

test('3c #1: challenged_claim created PROPOSED, auto-transitions on first challenged_by', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CC-001', '--category', 'challenged_claim',
    '--content', 'Some questionable claim', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });

  let snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'PROPOSED',
    'challenged_claim must default to PROPOSED (§5.1)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, [],
    'newly proposed entry has empty challenged_by');

  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-1'],
    { encoding: 'utf8', cwd: dir });

  snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED',
    'auto-transition fires on first non-empty challenged_by (§5.1 line 150-152)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, ['CHALLENGER-1']);

  fs.rmSync(dir, { recursive: true });
});

test('3c #1: second challenged_by append does not re-trigger transition', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CC-001', '--category', 'challenged_claim',
    '--content', 'test', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-1'],
    { encoding: 'utf8', cwd: dir });

  let snapshot = readSnapshot(dir);
  const updatedAtAfterFirst = snapshot.entries['CC-001'].updated_at;
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED');

  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-2'],
    { encoding: 'utf8', cwd: dir });

  snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED',
    'status stays CHALLENGED on second challenged_by append (no re-transition)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, ['CHALLENGER-1', 'CHALLENGER-2']);

  fs.rmSync(dir, { recursive: true });
});

test('3c #7: truth-annotate on PROPOSED entry errors with truth-update CLI hint', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'RG-001', '--category', 'retained_goal',
    '--content', 'test goal', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });

  let error = null;
  try {
    execFileSync('node', [CLI, 'truth-annotate',
      '--id', 'RG-001', '--field', 'evidence_refs', '--value', 'REF-1'],
      { encoding: 'utf8', cwd: dir });
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'truth-annotate on PROPOSED entry must exit non-zero');
  const stderr = (error.stderr || '') + (error.stdout || '');
  assert.match(stderr, /truth-update/,
    'error must contain literal CLI name "truth-update" (§5.2 binding contract)');
  assert.match(stderr, /--field evidence_refs --value/,
    'error must contain literal example invocation (§5.2 binding contract)');
  assert.match(stderr, /RG-001/,
    'error must reference the entry ID');

  fs.rmSync(dir, { recursive: true });
});

// ===== Predicates 4-6: state.cjs (T2 changes) =====

test('3c #11: stateInitCodeSteps preserves literal unit.id (no sequential rename)', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-1' },
    { id: 'unit-1.5' },
    { id: 'unit-2' },
  ]);

  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });

  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.ok(state.steps['unit-1'], 'unit-1 step key preserved');
  assert.ok(state.steps['unit-1.5'], 'unit-1.5 step key preserved (was lost via sequential rename pre-3c)');
  assert.ok(state.steps['unit-2'], 'unit-2 step key preserved');
  assert.equal(Object.keys(state.steps).filter(k => k.startsWith('unit-')).length, 3,
    'exactly 3 unit- steps, no sequential rename ghosts');

  fs.rmSync(dir, { recursive: true });
});

test('3c #11: stateInitCodeSteps fail-louds on invalid unit.id (space character)', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-foo bar' },
  ]);

  let error = null;
  try {
    execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'invalid unit.id must exit non-zero');
  const stderr = (error.stderr || '') + (error.stdout || '');
  assert.match(stderr, /invalid id/, 'error must contain "invalid id"');
  assert.match(stderr, /unit-\[\\\\w\.-\]\+/,
    'error must surface the expected format regex unit-[\\w.-]+ (JSON-encoded as unit-[\\\\w.-]+)');

  fs.rmSync(dir, { recursive: true });
});

test('3c #11: stateInitCodeSteps transitions current_step from stage-a to units[0].id', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-1.5' },
    { id: 'unit-2' },
  ]);

  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.current_step = 'stage-a';
  fs.writeFileSync(statePath, JSON.stringify(state));

  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });

  const stateAfter = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(stateAfter.current_step, 'unit-1.5',
    'current_step transitions to units[0].id (literal preserve, not hardcoded unit-1)');

  fs.rmSync(dir, { recursive: true });
});
