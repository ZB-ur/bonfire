'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkVerdictSubstantive } = require('../bin/lib/state.cjs');
const path = require('path');
const SCHEMA = JSON.parse(require('fs').readFileSync(
  path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
));

const SAMPLE_SNAPSHOT = {
  entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } },
};

test('checkVerdictSubstantive rule 1 fires for approved_with_conditions + empty conditions (no escape)', () => {
  const verdict = { verdict: 'approved_with_conditions', conditions: [], rulings: [{ action: 'freeze', id: 'CON-001' }] };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /approved_with_conditions_requires_conditions|conditions_empty/);
});

test('checkVerdictSubstantive rule 1 cannot be escaped', () => {
  const verdict = {
    verdict: 'approved_with_conditions',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'See CON-001',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
});

test('checkVerdictSubstantive rule 2 fires for approved + both empty + no escape', () => {
  const verdict = { verdict: 'approved', conditions: [], rulings: [] };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /approved_requires_substantive_oversight|rulings_empty/);
});

test('checkVerdictSubstantive rule 2 escapes via no_substantive_oversight + valid ref', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'Ledger fully FROZEN — see CON-001 (no challenges remain)',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, true, `unexpected error: ${r.error}`);
  // Per Round 1 quality-review Finding 1: assert structured success field
  // matches the JSDoc contract (state.cjs:118 documents `escape_used?: string`)
  // and the legit-no-substantive-oversight fixture EXPECTED.md. Without this
  // pin, an implementation regression dropping/renaming escape_used would go
  // undetected.
  assert.equal(r.escape_used, 'no_substantive_oversight');
});

test('checkVerdictSubstantive rejects truthy-but-not-true escape flag (=== true required)', () => {
  // Per Round 1 quality-review Finding 2: state.cjs:146 uses strict-equality
  // `verdict[ev.flag] === true` to gate the escape valve. Pin this behavior
  // so a future refactor that loosens the check to `verdict[ev.flag]` (truthy)
  // would silently widen the acceptance surface and be caught here.
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: 1, // truthy, but NOT literally === true
    no_substantive_oversight_reason: 'Ledger fully FROZEN — see CON-001',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false, 'truthy-but-not-true should not bypass the escape gate');
});

test('checkVerdictSubstantive rule 2 escape rejects fabricated unresolved ref', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'See CON-999 (does not exist)',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /unresolved|CON-999/);
});

test('checkVerdictSubstantive passes legitimate non-empty verdict', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'CON-001' }],
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, true);
});

test('checkVerdictSubstantive passes approved + escape with multiple refs — fails if any unresolved', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'CON-001 and CON-002 both FROZEN — full convergence',
  };
  // Snapshot only has CON-001; CON-002 should fail to resolve.
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false, 'CON-002 unresolved should fail');
});

test('checkVerdictSubstantive passes rejected verdict regardless of conditions/rulings', () => {
  const verdict = {
    verdict: 'rejected',
    reason: 'integration test',
    conflict_type: 'handoff_incomplete',
    conditions: [],
    rulings: [],
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  // verdict_enum check is delta-parser's job; verdict_substantive_check only fires on approved/approved_with_conditions per predicates.
  assert.equal(r.valid, true);
});
