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
