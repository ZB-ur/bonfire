const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDelta } = require('../bin/lib/delta-parser.cjs');

test('d-critique: valid delta passes', () => {
  const delta = { agent: 'bonfire-d-critique', challenges: [{ target: 'CON-001', reason: 'Conflicts' }], proposals: [] };
  assert.equal(validateDelta('bonfire-d-critique', delta).valid, true);
});
test('d-critique: missing challenges rejects', () => {
  const result = validateDelta('bonfire-d-critique', { agent: 'bonfire-d-critique', proposals: [] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /challenges/i.test(e)));
});
test('d-critique: empty challenges rejects', () => {
  assert.equal(validateDelta('bonfire-d-critique', { agent: 'bonfire-d-critique', challenges: [] }).valid, false);
});
test('g-red: valid delta passes', () => {
  assert.equal(validateDelta('bonfire-g-red', { agent: 'bonfire-g-red', challenges: [{ target: 'X', reason: 'Y' }] }).valid, true);
});
test('g-blue: valid delta passes', () => {
  assert.equal(validateDelta('bonfire-g-blue', { agent: 'bonfire-g-blue', alignments: [{ target: 'X', evidence: 'Y' }] }).valid, true);
});
test('g-blue: missing alignments rejects', () => {
  const result = validateDelta('bonfire-g-blue', { agent: 'bonfire-g-blue', proposals: [] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /alignments/i.test(e)));
});
test('h-review: approved verdict passes', () => {
  assert.equal(validateDelta('bonfire-h-review', { verdict: 'approved', reason: 'OK' }).valid, true);
});
test('h-review: rejected without conflict_type rejects', () => {
  const result = validateDelta('bonfire-h-review', { verdict: 'rejected', reason: 'Issues' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /conflict_type/i.test(e)));
});
test('h-review: rejected with valid conflict_type passes', () => {
  assert.equal(validateDelta('bonfire-h-review', { verdict: 'rejected', reason: 'X', conflict_type: 'requirement_conflict' }).valid, true);
});
test('h-review: invalid verdict enum rejects', () => {
  assert.equal(validateDelta('bonfire-h-review', { verdict: 'maybe', reason: 'X' }).valid, false);
});
test('evaluator: PASS verdict passes', () => {
  assert.equal(validateDelta('bonfire-evaluator', { unit: 'u1', iteration: 1, verdict: 'PASS', verification_results: [{ command: 'test', exit_code: 0 }] }).valid, true);
});
test('evaluator: FAIL with invalid conflict_type rejects', () => {
  assert.equal(validateDelta('bonfire-evaluator', { unit: 'u1', iteration: 1, verdict: 'FAIL', verification_results: [], conflict_type: 'invalid' }).valid, false);
});
test('unknown agent rejects', () => {
  assert.equal(validateDelta('bonfire-unknown', {}).valid, false);
});

// ---------------------------------------------------------------------------
// condition_item_shape (bonfire-h-review)
// ---------------------------------------------------------------------------

test('bonfire-h-review: valid condition item passes', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'rewrite to given/when/then', target_stage: 'stage-j' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('bonfire-h-review: condition missing text field fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ target_stage: 'stage-j' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text/.test(e)));
});

test('bonfire-h-review: condition missing target_stage field fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'rewrite' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /target_stage/.test(e)));
});

test('bonfire-h-review: condition target_stage other than stage-j fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'enumerate categories', target_stage: 'stage-c' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /target_stage/.test(e)));
});

test('bonfire-h-review: verdict without conditions field still passes', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = { verdict: 'approved', reason: 'all good' };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true);
});

test('bonfire-h-review: empty conditions array passes schema (Layer 1 catches emptiness)', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = { verdict: 'approved_with_conditions', reason: 'ok', conditions: [] };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true);
});

// ---------------------------------------------------------------------------
// field_substantive_check in condition_item_shape (3a Task 3)
// ---------------------------------------------------------------------------

test('validateDelta rejects condition with empty text (3a)', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: '', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text/.test(e)));
});

test('validateDelta rejects condition with placeholder text (3a)', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: 'see ledger', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text|placeholder|see ledger/i.test(e)));
});

test('validateDelta passes condition with substantive text (3a)', () => {
  const delta = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: 'J-Compile must include FC-12 in execution manifest', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});
