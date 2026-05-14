const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyAlignedByToken } = require('../bin/lib/seam-validation.cjs');

test('substring rule: tokens with -via- or -by- → EXCLUDE', () => {
  assert.equal(classifyAlignedByToken('stage-e-superseded-by-CON-016'), 'EXCLUDE');
  assert.equal(classifyAlignedByToken('g-blue-mitigated-via-CON-026'), 'EXCLUDE');
});

test('substring rule: tokens without -via- or -by- → INCLUDE', () => {
  assert.equal(classifyAlignedByToken('stage-g-survival'), 'INCLUDE');
  assert.equal(classifyAlignedByToken('g-blue'), 'INCLUDE');
  assert.equal(classifyAlignedByToken('stage-e-accept-as-known-limitation-CON-022'), 'INCLUDE');
});

test('null/undefined/empty → INCLUDE', () => {
  assert.equal(classifyAlignedByToken(null), 'INCLUDE');
  assert.equal(classifyAlignedByToken(undefined), 'INCLUDE');
  assert.equal(classifyAlignedByToken(''), 'INCLUDE');
});

test('14-token dogfood forensic: 14/14 classify per ground truth', () => {
  const truth = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json'),
    'utf8'
  ));
  for (const { token, expected } of truth.tokens) {
    const actual = classifyAlignedByToken(token);
    assert.equal(actual, expected, `Token "${token}" classified ${actual}, expected ${expected}`);
  }
});
