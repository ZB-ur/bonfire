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

// Schema validation tests

test('schema has exactly 22 notes', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(schema.notes.length, 22);
});

test('schema notes have unique ids', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const ids = schema.notes.map(n => n.id);
  const unique = new Set(ids);
  assert.equal(ids.length, unique.size, `Duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('schema notes have unique filenames', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const filenames = schema.notes.map(n => n.filename);
  const unique = new Set(filenames);
  assert.equal(filenames.length, unique.size);
});

test('schema note requires reference valid ids', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const ids = new Set(schema.notes.map(n => n.id));
  for (const note of schema.notes) {
    for (const req of (note.requires || [])) {
      assert.ok(ids.has(req), `Note "${note.id}" requires unknown note "${req}"`);
    }
  }
});

test('schema has 9 reentry routes', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.reentry_routes).length, 9);
});

test('schema reentry route targets are valid steps', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  const allSteps = Object.values(schema.step_order).flat();
  for (const [type, route] of Object.entries(schema.reentry_routes)) {
    assert.ok(allSteps.includes(route.to), `Route "${type}" targets unknown step "${route.to}"`);
  }
});

test('schema has 8 categories', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.categories).length, 8);
});

test('schema has 5 delta schemas', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(Object.keys(schema.delta_schemas).length, 5);
});

test('schema preflight_mutable_fields has 6 entries', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.equal(schema.preflight_mutable_fields.length, 6);
});

test('schema has pipeline_order with 4 pipelines', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.deepStrictEqual(schema.pipeline_order, ['pre', 'plan', 'code', 'achieve']);
});
