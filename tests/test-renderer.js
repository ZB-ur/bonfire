const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { renderTemplate, renderNote } = require('../bin/lib/renderer.cjs');

test('renderTemplate substitutes {{field}} placeholders', () => {
  const result = renderTemplate('# {{title}}\n\nBy {{author}}', { title: 'Hello', author: 'World' });
  assert.equal(result, '# Hello\n\nBy World');
});

test('renderTemplate handles {{#each}} loops', () => {
  const template = '{{#each items}}\n- {{name}}: {{value}}\n{{/each}}';
  const data = { items: [{ name: 'a', value: '1' }, { name: 'b', value: '2' }] };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('- a: 1'));
  assert.ok(result.includes('- b: 2'));
});

test('renderTemplate handles {{.}} for primitive arrays', () => {
  const template = '{{#each tags}}\n- {{.}}\n{{/each}}';
  const result = renderTemplate(template, { tags: ['alpha', 'beta'] });
  assert.ok(result.includes('- alpha'));
  assert.ok(result.includes('- beta'));
});

test('renderTemplate produces RENDER ERROR for missing placeholders', () => {
  const result = renderTemplate('# {{title}}\n\n{{missing}}', { title: 'Test' });
  assert.equal(result, '# Test\n\n<!-- RENDER ERROR: missing required field "missing" in source data -->');
});

test('renderNote injects opts.run_id into render data when source lacks it', () => {
  // Regression: pre-fix, renderNote used opts.run_id only for source-path/filename
  // templating — never merged into the data object passed to renderTemplate.
  // Templates with {{run_id}} (achieve.md, code-run.md, verification.md, reentry.md)
  // would emit RENDER ERROR unless the source JSON file happened to contain run_id.
  // achieve.json per SKILL.md contract does not contain it.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const runId = 'run-injection-test-001';
  const runDir = path.join(dir, '.bonfire', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.bonfire', 'logs'), { recursive: true });

  // achieve.json shape per skills/achieve/SKILL.md — note: no run_id field
  const achieve = {
    verdict: 'achieved',
    acceptance_results: [{ check: 'sample', result: 'passed' }],
    followups: [],
    failure_reason: '',
    judged_at: '2026-05-07T00:00:00Z',
  };
  fs.writeFileSync(path.join(runDir, 'achieve.json'), JSON.stringify(achieve));

  const result = renderNote(dir, 'achieve', { run_id: runId });
  assert.ok(result.success, `renderNote failed: ${result.error}`);

  const rendered = fs.readFileSync(result.outputPath, 'utf8');
  assert.ok(
    rendered.includes(`# Acceptance: ${runId}`),
    `expected run_id "${runId}" in output, got:\n${rendered}`,
  );
  assert.ok(
    !rendered.includes('missing required field "run_id"'),
    `unexpected RENDER ERROR for run_id in output:\n${rendered}`,
  );
  fs.rmSync(dir, { recursive: true });
});

test('renderNote produces clean achieve.md with no RENDER ERROR comments (dogfood regression)', () => {
  // Integration regression mirroring 2026-05-04 gto-trainer dogfood:
  // achieve.json with failure_reason="" (per corrected SKILL contract) +
  // no run_id field in data (per SKILL contract — only opts carries it) +
  // opts.run_id provided by caller. Expected: zero <!-- RENDER ERROR --> comments.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const runId = 'run-achieve-test-001';
  const runDir = path.join(dir, '.bonfire', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(path.join(dir, '.bonfire', 'logs'), { recursive: true });

  const achieve = {
    verdict: 'achieved_with_followups',
    acceptance_results: [
      { check: 'UNIT-1 sample', result: 'passed' },
      { check: 'UNIT-2 sample', result: 'passed' },
    ],
    followups: ['follow-up note 1'],
    failure_reason: '',
    judged_at: '2026-05-07T00:00:00Z',
  };
  fs.writeFileSync(path.join(runDir, 'achieve.json'), JSON.stringify(achieve));

  const result = renderNote(dir, 'achieve', { run_id: runId });
  assert.ok(result.success, `renderNote failed: ${result.error}`);

  const rendered = fs.readFileSync(result.outputPath, 'utf8');
  assert.ok(rendered.includes(`# Acceptance: ${runId}`), 'run_id not rendered in heading');
  assert.ok(rendered.includes('## Failure Reason'), 'Failure Reason heading missing');
  assert.ok(
    !rendered.includes('<!-- RENDER ERROR'),
    `expected zero RENDER ERROR comments, got:\n${rendered}`,
  );
  fs.rmSync(dir, { recursive: true });
});

test('renderNote renders constraint-ledger from snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire');
  fs.mkdirSync(path.join(bf, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(bf, 'bundle'), { recursive: true });
  fs.mkdirSync(path.join(bf, 'logs'), { recursive: true });

  const snapshot = {
    version: 1, replayed_at: '2026-04-10T10:00:00Z', event_count: 1,
    entries: {
      'CON-001': {
        id: 'CON-001', category: 'retained_goal', status: 'FROZEN',
        content: 'Must support OAuth2', rationale: 'Core requirement',
        challenged_by: ['d-critique'], aligned_by: ['g-blue'],
        evidence_refs: [], notes: []
      }
    },
    by_status: { proposed: [], challenged: [], frozen: ['CON-001'], superseded: [], open: [], discarded: [] },
    by_category: { retained_goal: ['CON-001'] }
  };
  fs.writeFileSync(path.join(bf, 'truth-surface', 'constraint-ledger-snapshot.json'), JSON.stringify(snapshot));

  const result = renderNote(dir, 'constraint-ledger');
  assert.ok(result.success);
  assert.ok(fs.existsSync(path.join(bf, 'bundle', '05-constraint-ledger.md')));
  const content = fs.readFileSync(path.join(bf, 'bundle', '05-constraint-ledger.md'), 'utf8');
  assert.ok(content.includes('CON-001'));
  assert.ok(content.includes('Must support OAuth2'));
  fs.rmSync(dir, { recursive: true });
});
