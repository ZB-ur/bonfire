const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { renderNote, renderAll, renderCheck } = require('../bin/lib/renderer.cjs');

const SAMPLE_DIR = path.join(__dirname, '..', 'examples', 'sample-case');

function setupSampleBonfire(tmpDir) {
  const bonfireDir = path.join(tmpDir, '.bonfire');
  fs.mkdirSync(path.join(bonfireDir, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'plan'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'bundle'), { recursive: true });
  fs.mkdirSync(path.join(bonfireDir, 'logs'), { recursive: true });

  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'case.json'),
    path.join(bonfireDir, 'case.json')
  );
  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'truth-surface', 'constraint-ledger-snapshot.json'),
    path.join(bonfireDir, 'truth-surface', 'constraint-ledger-snapshot.json')
  );
  fs.copyFileSync(
    path.join(SAMPLE_DIR, 'plan', 'bonfire-d-critique-delta.json'),
    path.join(bonfireDir, 'plan', 'bonfire-d-critique-delta.json')
  );

  return tmpDir;
}

test('renderNote renders overview from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'overview');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('OAuth2 Authentication'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-a from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-a');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('Reframed Goal'));
    assert.ok(content.includes('OAuth2 login'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-b from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-b');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('passport.js'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders constraint-ledger from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'constraint-ledger');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('CON-001'));
    assert.ok(content.includes('RISK-001'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderNote renders stage-d from sample case', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const result = renderNote(tmpDir, 'stage-d');
    assert.equal(result.success, true);
    const content = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(content.includes('bonfire-d-critique'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderAll renders available notes without errors', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const results = renderAll(tmpDir);
    const successes = results.filter(r => r.success);
    assert.ok(successes.length >= 4, `Expected >= 4 successful renders, got ${successes.length}`);
    const successIds = successes.map(r => r.note_id);
    assert.ok(successIds.includes('overview'));
    assert.ok(successIds.includes('constraint-ledger'));
    assert.ok(successIds.includes('stage-a'));
    assert.ok(successIds.includes('stage-b'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('renderCheck reports stale and missing notes', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bonfire-smoke-'));
  try {
    setupSampleBonfire(tmpDir);
    const checks = renderCheck(tmpDir);
    const missing = checks.filter(c => c.status === 'missing');
    assert.ok(missing.length > 0, 'Expected missing notes before rendering');

    renderNote(tmpDir, 'overview');
    const checksAfter = renderCheck(tmpDir);
    const overviewCheck = checksAfter.find(c => c.note_id === 'overview');
    assert.ok(overviewCheck && overviewCheck.status === 'ok', 'overview should be ok after render');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
