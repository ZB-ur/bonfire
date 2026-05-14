'use strict';

// Tokenization contract regression test (ASSERTION-4 §3.1.1).
//
// A1 (CON-NNN cross-reference passthrough in compareTokens) depends on the
// tokenizer producing `con-026` as a single atomic token, NOT splitting on
// the hyphen, AND the lemmatizer NOT stripping trailing chars off identifier
// tokens. These two facts are an explicit contract — if a future change to
// boundaryRegex or lemmatizeToken breaks either, A1 breaks silently. This
// test is the canary.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractSubstantiveTokens } = require('../bin/lib/seam-validation.cjs');

test('CON-NNN tokens stay atomic (no hyphen split)', () => {
  const tokens = extractSubstantiveTokens('CON-026 is foo. con-099, RG-014!');
  assert.deepEqual(tokens, ['con-026', 'is', 'foo', 'con-099', 'rg-014']);
});

test('Identifier tokens survive lemmatization', () => {
  // lemmatizeToken should NOT strip trailing chars from CON-026 etc.
  // (Indirect check: extractSubstantiveTokens output is what consumers see.)
  const tokens = extractSubstantiveTokens('mitigated by CON-026 and resolved');
  assert.ok(tokens.includes('con-026'));
  assert.ok(!tokens.some(t => t === 'con')); // no orphan 'con' from split
});
