'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderTemplate } = require('../bin/lib/renderer.cjs');

// --- Array join tests ---

test('array field renders with join(", ") in top-level substitution', () => {
  const template = '**Units:** {{units}}';
  const data = { units: ['unit-1', 'unit-2', 'unit-3'] };
  const result = renderTemplate(template, data);
  assert.equal(result, '**Units:** unit-1, unit-2, unit-3');
});

test('array field renders with join(", ") inside each block', () => {
  const template = '{{#each items}}{{name}}: {{tags}}\n{{/each}}';
  const data = { items: [{ name: 'A', tags: ['x', 'y'] }, { name: 'B', tags: ['z'] }] };
  const result = renderTemplate(template, data);
  assert.equal(result, 'A: x, y\nB: z\n');
});

// --- Undefined/null validation tests ---

test('undefined field in {{field}} produces RENDER ERROR comment', () => {
  const template = 'Hello {{name}}, your role is {{role}}';
  const data = { name: 'Alice' };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Alice'));
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "role" in source data -->'));
});

test('null field in {{field}} produces RENDER ERROR comment', () => {
  const template = 'Status: {{status}}';
  const data = { status: null };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "status" in source data -->'));
});

test('empty string field renders normally (no error)', () => {
  const template = 'Notes: {{notes}}';
  const data = { notes: '' };
  const result = renderTemplate(template, data);
  assert.equal(result, 'Notes: ');
});

test('undefined field in {{#each}} produces RENDER ERROR comment', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = {};
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "items" in source data -->'));
});

test('null field in {{#each}} produces RENDER ERROR comment', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = { items: null };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "items" in source data -->'));
});

test('empty array in {{#each}} renders empty (no error)', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = { items: [] };
  const result = renderTemplate(template, data);
  assert.equal(result, '');
});

// --- objectToArray fallback tests ---

test('objectToArray: object with object values → [{key, ...spread}]', () => {
  const template = '{{#each items}}{{key}}: {{name}}\n{{/each}}';
  const data = { items: { a: { name: 'Alpha' }, b: { name: 'Beta' } } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('a: Alpha'));
  assert.ok(result.includes('b: Beta'));
});

test('objectToArray: object with array values → [{key, items}]', () => {
  const template = '{{#each mapping}}{{key}}: {{items}}\n{{/each}}';
  const data = { mapping: { 'CON-001': ['unit-1', 'unit-2'], 'CON-002': ['unit-3'] } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('CON-001: unit-1, unit-2'));
  assert.ok(result.includes('CON-002: unit-3'));
});

test('objectToArray: object with string values → [{key, value}]', () => {
  const template = '{{#each items}}{{key}}={{value}}\n{{/each}}';
  const data = { items: { color: 'red', size: 'large' } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('color=red'));
  assert.ok(result.includes('size=large'));
});

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'templates', name), 'utf8');
}

test('constraint-crosswalk template renders with correct data', () => {
  const template = loadTemplate('constraint-crosswalk.md');
  const data = {
    mappings: [
      { constraint_id: 'CON-001', content: 'Must support 6-max', unit_ids: ['unit-1', 'unit-2'] },
      { constraint_id: 'CON-002', content: 'Chinese UI', unit_ids: ['unit-3'] }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('### CON-001'));
  assert.ok(result.includes('**Constraint:** Must support 6-max'));
  assert.ok(result.includes('**Implemented by:** unit-1, unit-2'));
  assert.ok(result.includes('### CON-002'));
  assert.ok(result.includes('**Implemented by:** unit-3'));
});

test('execution-manifest template renders with correct data', () => {
  const template = loadTemplate('execution-manifest.md');
  const data = {
    description: 'Build in dependency order',
    waves: [
      { wave: 1, units: 'unit-1', description: 'Scaffolding' },
      { wave: 2, units: 'unit-2, unit-3', description: 'Core engine' }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Build in dependency order'));
  assert.ok(result.includes('### Wave 1: Scaffolding'));
  assert.ok(result.includes('**Units:** unit-1'));
  assert.ok(result.includes('### Wave 2: Core engine'));
  assert.ok(result.includes('**Units:** unit-2, unit-3'));
});

test('code-batches template renders with correct data', () => {
  const template = loadTemplate('code-batches.md');
  const data = {
    batches: [
      { batch_id: 'batch_1_foundation', description: 'Set up project', units: ['unit-1', 'unit-2'] },
      { batch_id: 'batch_2_engine', description: 'Build engine', units: ['unit-3'] }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('### batch_1_foundation'));
  assert.ok(result.includes('Set up project'));
  assert.ok(result.includes('**Units:** unit-1, unit-2'));
  assert.ok(result.includes('### batch_2_engine'));
});

test('stage-j template renders with compile_summary object', () => {
  const template = loadTemplate('stage-j.md');
  const data = {
    summary: 'Compiled successfully',
    code_ready: true,
    blockers: ['Missing API key', 'Incomplete docs']
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Compiled successfully'));
  assert.ok(result.includes('true'));
  assert.ok(result.includes('- Missing API key'));
  assert.ok(result.includes('- Incomplete docs'));
});

test('final-handoff template renders with object data', () => {
  const template = loadTemplate('final-handoff.md');
  const data = {
    statement: 'Handoff is code-ready',
    status: 'code_ready'
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Handoff is code-ready'));
  assert.ok(result.includes('code_ready'));
});
