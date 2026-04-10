const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
  const compileOutput = {
    handoff: { code_ready: true, implementation_units: [{ id: 'unit-1' }] },
    code_preflight: {
      confirmed_repo_facts: ['pg14'], do_not_reinterpret: ['semantics'],
      do_first: ['unit-1'], context_bundle: ['handoff.md'],
      current_focus: null, progress_snapshot: {},
      remaining_work: [], session_notes: null, blockers: [], pause_conditions: []
    }
  };
  fs.writeFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), JSON.stringify(compileOutput));
  return dir;
}

test('preflight-update updates mutable field', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'preflight-update', '--field', 'current_focus', '--value', 'unit-3'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);
  const co = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), 'utf8'));
  assert.equal(co.code_preflight.current_focus, 'unit-3');
  fs.rmSync(dir, { recursive: true });
});

test('preflight-update rejects immutable field', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'preflight-update', '--field', 'confirmed_repo_facts', '--value', 'changed'], { encoding: 'utf8', cwd: dir });
    assert.fail('should have failed');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.ok(result.error);
  }
  fs.rmSync(dir, { recursive: true });
});

test('preflight-update with --unit updates progress', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'preflight-update', '--field', 'progress', '--unit', 'unit-1', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  const co = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), 'utf8'));
  assert.equal(co.code_preflight.progress_snapshot['unit-1'], 'passed');
  fs.rmSync(dir, { recursive: true });
});
