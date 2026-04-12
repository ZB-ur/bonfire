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
