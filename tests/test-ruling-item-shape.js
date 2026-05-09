const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDelta } = require('../bin/lib/delta-parser.cjs');

test('validateDelta rejects ruling missing required action field', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /action/.test(e)));
});

test('validateDelta rejects ruling with non-ledger-pattern id', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'XYZ-not-valid' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /id|pattern/.test(e)));
});

test('validateDelta rejects supersede ruling with empty new_content', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001', new_content: '' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /new_content/.test(e)));
});

test('validateDelta rejects supersede ruling missing new_content', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /new_content/.test(e)));
});

test('validateDelta passes legitimate freeze ruling', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});

test('validateDelta passes legitimate supersede ruling with new_content', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001', new_content: 'Updated requirement: support OAuth2 with PKCE' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});

test('validateDelta rejects ruling with empty id (field_substantive_check path)', () => {
  // Coverage for ruling_item_shape.field_substantive_check.id when id_constraint
  // regex check is bypassed (item.id falsy → guard `&& item.id` short-circuits).
  // Per Round 3 quality-review S1 closure: id_constraint regex path tested
  // separately (XYZ-not-valid case); this test pins the substantive_check path.
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'empty id',
    conditions: [],
    rulings: [{ action: 'freeze', id: '' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /id is empty or placeholder/.test(e)),
    `expected field_substantive_check error for empty id, got: ${result.errors.join('; ')}`);
});

test('validateDelta rejects ruling with action not in ruling_action_enum (closes dogfood-2026-05-04 finding #3)', () => {
  // Pre-existing schema field `ruling_action_enum: ["freeze", "supersede"]`
  // was declared but never enforced — apply-h-rulings silently filtered
  // unknown actions (gto-trainer dogfood 2026-05-04 finding #3). Phase 3
  // mirrors verdict_enum pattern in validateDelta to enforce the enum at
  // validation time instead of silent downstream filtering.
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'unknown action',
    conditions: [],
    rulings: [{ action: 'discard', id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /must be one of.*freeze.*supersede/.test(e)),
    `expected ruling_action_enum violation, got: ${result.errors.join('; ')}`);
});
