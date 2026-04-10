const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { appendLog, readLog } = require('../bin/lib/logger.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  fs.mkdirSync(path.join(dir, '.bonfire', 'logs'), { recursive: true });
  return dir;
}

test('appendLog creates file and appends JSONL line', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'spawn', agent: 'test' });
  appendLog(logFile, { event: 'completed', agent: 'test' });
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.deepStrictEqual(JSON.parse(lines[0]).event, 'spawn');
  assert.deepStrictEqual(JSON.parse(lines[1]).event, 'completed');
  fs.rmSync(dir, { recursive: true });
});

test('appendLog adds timestamp if missing', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'test' });
  const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
  assert.ok(entry.timestamp);
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  fs.rmSync(dir, { recursive: true });
});

test('readLog returns entries as array', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'a' });
  appendLog(logFile, { event: 'b' });
  const entries = readLog(logFile);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].event, 'a');
  assert.equal(entries[1].event, 'b');
  fs.rmSync(dir, { recursive: true });
});

test('readLog returns empty array for missing file', () => {
  const entries = readLog('/nonexistent/file.jsonl');
  assert.deepStrictEqual(entries, []);
});
