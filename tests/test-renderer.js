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

test('renderTemplate leaves unknown placeholders as empty', () => {
  const result = renderTemplate('# {{title}}\n\n{{missing}}', { title: 'Test' });
  assert.equal(result, '# Test\n\n');
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
