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
  return dir;
}

test('truth-propose via CLI creates entry', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'retained_goal',
    '--content', 'Must support OAuth2', '--rationale', 'Core req',
    '--source', 'stage-c'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  assert.equal(snapshot.entries['CON-001'].status, 'PROPOSED');
  fs.rmSync(dir, { recursive: true });
});

test('truth-read via CLI returns snapshot', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'retained_goal',
    '--content', 'test', '--rationale', 'test', '--source', 'stage-c'],
    { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'truth-read'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  fs.rmSync(dir, { recursive: true });
});

test('full lifecycle via CLI: propose → challenge → freeze', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'frozen_constraint',
    '--content', 'Must use PostgreSQL', '--rationale', 'Team expertise',
    '--source', 'stage-c'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CON-001', '--field', 'challenged_by', '--value', 'd-critique'],
    { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-001'],
    { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.equal(snapshot.entries['CON-001'].status, 'FROZEN');
  fs.rmSync(dir, { recursive: true });
});

test('truth-rebuild regenerates from history', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'confirmed_fact',
    '--content', 'pg14', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });
  fs.unlinkSync(path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'));
  const stdout = execFileSync('node', [CLI, 'truth-rebuild'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  assert.equal(snapshot.entries['CON-001'].content, 'pg14');
  fs.rmSync(dir, { recursive: true });
});
