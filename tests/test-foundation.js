const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

test('CLI with no args prints usage to stderr and exits 2', () => {
  try {
    execFileSync('node', [CLI], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(err.stderr, /usage/i);
  }
});

test('CLI with unknown command exits 2', () => {
  try {
    execFileSync('node', [CLI, 'unknown-command'], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
    assert.match(err.stderr, /unknown command/i);
  }
});

test('CLI route --list returns all conflict types', () => {
  const stdout = execFileSync('node', [CLI, 'route', '--list'], { encoding: 'utf8' });
  const result = JSON.parse(stdout);
  assert.ok(result.goal_conflict);
  assert.equal(result.goal_conflict.to, 'stage-a');
  assert.equal(result.goal_conflict.crosses_pipeline, true);
  assert.ok(result.requirement_conflict);
  assert.equal(Object.keys(result).length, 9);
});

test('CLI route --conflict-type returns specific route', () => {
  const stdout = execFileSync('node', [CLI, 'route', '--conflict-type', 'dependency_gap'], { encoding: 'utf8' });
  const result = JSON.parse(stdout);
  assert.equal(result.to, 'stage-e');
  assert.equal(result.crosses_pipeline, false);
});

test('CLI route with invalid conflict-type exits 1', () => {
  try {
    execFileSync('node', [CLI, 'route', '--conflict-type', 'invalid'], { encoding: 'utf8' });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.ok(result.error);
  }
});
