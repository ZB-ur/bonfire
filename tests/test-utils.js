const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeAtomic, loadJSON, timestamp, resolveRoot, parseArgs } = require('../bin/lib/utils.cjs');

test('writeAtomic writes file atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'test.json');
  writeAtomic(file, { hello: 'world' });
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(result, { hello: 'world' });
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.equal(files[0], 'test.json');
  fs.rmSync(dir, { recursive: true });
});

test('writeAtomic creates parent directories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'nested', 'deep', 'test.json');
  writeAtomic(file, { nested: true });
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(result, { nested: true });
  fs.rmSync(dir, { recursive: true });
});

test('loadJSON reads and parses JSON file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const file = path.join(dir, 'data.json');
  fs.writeFileSync(file, JSON.stringify({ key: 'value' }));
  const result = loadJSON(file);
  assert.deepStrictEqual(result, { key: 'value' });
  fs.rmSync(dir, { recursive: true });
});

test('loadJSON returns null for missing file', () => {
  const result = loadJSON('/nonexistent/path/file.json');
  assert.equal(result, null);
});

test('timestamp returns ISO string', () => {
  const ts = timestamp();
  assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('resolveRoot finds .bonfire/ directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  fs.mkdirSync(path.join(dir, '.bonfire'));
  const root = resolveRoot(dir);
  assert.equal(root, path.join(dir, '.bonfire'));
  fs.rmSync(dir, { recursive: true });
});

test('resolveRoot returns null when no .bonfire/', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const root = resolveRoot(dir);
  assert.equal(root, null);
  fs.rmSync(dir, { recursive: true });
});

test('parseArgs parses --key value pairs', () => {
  const result = parseArgs(['--request', 'hello world', '--project-root', '/tmp']);
  assert.deepStrictEqual(result, { request: 'hello world', 'project-root': '/tmp' });
});

test('parseArgs handles flags without values', () => {
  const result = parseArgs(['--confirm']);
  assert.deepStrictEqual(result, { confirm: true });
});
