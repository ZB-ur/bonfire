'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  loadFormatWhitelist,
  extractSubstantiveTokens,
  lemmatizeToken,
  isCJKToken,
  VERB_BLACKLIST,
} = require('../bin/lib/seam-validation.cjs');

// ---------------------------------------------------------------------------
// loadFormatWhitelist
// ---------------------------------------------------------------------------

test('loadFormatWhitelist returns a Set of lowercased tokens', () => {
  const whitelist = loadFormatWhitelist();
  assert.ok(whitelist instanceof Set);
  assert.ok(whitelist.has('given'));
  assert.ok(whitelist.has('when'));
  assert.ok(whitelist.has('must'));
  assert.ok(whitelist.has('stage-j'));
});

test('loadFormatWhitelist skips comment lines and whitespace', () => {
  // All returned tokens should be non-empty non-comment
  const whitelist = loadFormatWhitelist();
  for (const token of whitelist) {
    assert.notEqual(token, '');
    assert.ok(!token.startsWith('#'));
  }
});

// ---------------------------------------------------------------------------
// extractSubstantiveTokens
// ---------------------------------------------------------------------------

test('extractSubstantiveTokens splits on whitespace and punctuation', () => {
  const tokens = extractSubstantiveTokens('board texture, and hand-strength categories');
  // Expects substantive tokens (case-normalized, lemmatized).
  assert.ok(tokens.includes('board'));
  assert.ok(tokens.includes('texture'));
  assert.ok(tokens.includes('hand-strength') || tokens.includes('hand') && tokens.includes('strength'));
});

test('extractSubstantiveTokens lowercases tokens', () => {
  const tokens = extractSubstantiveTokens('GTO Wizard');
  assert.ok(tokens.includes('gto'));
  assert.ok(tokens.includes('wizard'));
});

test('extractSubstantiveTokens preserves CON-XXX identifiers', () => {
  const tokens = extractSubstantiveTokens('freeze CON-014 per ruling');
  assert.ok(tokens.includes('con-014'));
});

test('extractSubstantiveTokens preserves numbers', () => {
  const tokens = extractSubstantiveTokens('10 categories with 5 hand strengths');
  assert.ok(tokens.includes('10'));
  assert.ok(tokens.includes('5'));
});

test('extractSubstantiveTokens: CJK run is a single whole-string token, not per-char', () => {
  const tokens = extractSubstantiveTokens('开始训练 和 重置统计');
  assert.ok(tokens.includes('开始训练'), 'whole CJK segment should be a token');
  assert.ok(tokens.includes('和'), 'single-char CJK between whitespace is a token');
  assert.ok(tokens.includes('重置统计'), 'second whole segment is a token');
  // Individual characters inside a segment must NOT appear as separate tokens —
  // that would let "开 始 训 练" (comma-separated enumerations of single chars)
  // authorize any recombination like "开训" or "始练". See spec §6.4.
  assert.ok(!tokens.includes('开'), 'individual char inside segment must NOT be separate token');
  assert.ok(!tokens.includes('训'), 'individual char inside segment must NOT be separate token');
});

test('extractSubstantiveTokens: mixed latin+CJK word (no whitespace) is a single token', () => {
  const tokens = extractSubstantiveTokens('GTO训练器');
  // Either "gto训练器" as a single token, or split on the latin/CJK boundary,
  // is acceptable as long as the CJK segment is whole. Flexible assertion.
  const hasWhole = tokens.includes('gto训练器');
  const hasCjkSegment = tokens.includes('训练器');
  assert.ok(hasWhole || hasCjkSegment, 'CJK segment preserved whole one way or another');
  assert.ok(!tokens.includes('训'), 'no per-char split');
});

// ---------------------------------------------------------------------------
// lemmatizeToken
// ---------------------------------------------------------------------------

test('lemmatizeToken drops trailing s/es', () => {
  assert.equal(lemmatizeToken('cards'), 'card');
  assert.equal(lemmatizeToken('boxes'), 'box');
  assert.equal(lemmatizeToken('texture'), 'texture');  // no change
});

test('lemmatizeToken drops trailing ing/ed', () => {
  assert.equal(lemmatizeToken('reading'), 'read');
  assert.equal(lemmatizeToken('placed'), 'place');
});

test('lemmatizeToken leaves short tokens alone', () => {
  assert.equal(lemmatizeToken('is'), 'is');
  assert.equal(lemmatizeToken('of'), 'of');
});

test('lemmatizeToken leaves CON-XXX identifiers alone', () => {
  assert.equal(lemmatizeToken('con-014'), 'con-014');
});

// ---------------------------------------------------------------------------
// isCJKToken
// ---------------------------------------------------------------------------

test('isCJKToken detects Chinese characters', () => {
  assert.equal(isCJKToken('训练器'), true);
  assert.equal(isCJKToken('开始'), true);
});

test('isCJKToken returns false for latin', () => {
  assert.equal(isCJKToken('card'), false);
  assert.equal(isCJKToken('123'), false);
  assert.equal(isCJKToken('stage-j'), false);
});

test('isCJKToken returns true for mixed CJK + latin', () => {
  // Conservative: any CJK char makes it a CJK token
  assert.equal(isCJKToken('GTO训练器'), true);
});

// ---------------------------------------------------------------------------
// VERB_BLACKLIST
// ---------------------------------------------------------------------------

test('VERB_BLACKLIST is a Set containing the expected verbs', () => {
  assert.ok(VERB_BLACKLIST instanceof Set);
  for (const verb of ['enumerate', 'classify', 'categorize', 'partition', 'define', 'specify', 'list', 'rank', 'distinguish', 'decompose']) {
    assert.ok(VERB_BLACKLIST.has(verb), `expected ${verb} in blacklist`);
  }
});

// ---------------------------------------------------------------------------
// validateHConditions
// ---------------------------------------------------------------------------

const { validateHConditions } = require('../bin/lib/seam-validation.cjs');

function mkSnapshot(ledgerEntries = {}) {
  return { entries: ledgerEntries };
}

test('validateHConditions: verdict not approved_with_conditions returns {valid: true, violations: []}', () => {
  const result = validateHConditions({ verdict: 'approved', reason: 'x' }, mkSnapshot());
  assert.deepEqual(result, { valid: true, violations: [] });
});

test('validateHConditions: empty conditions array returns violation (approved_with_conditions requires conditions)', () => {
  const result = validateHConditions(
    { verdict: 'approved_with_conditions', reason: 'x', conditions: [] },
    mkSnapshot()
  );
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /empty/i.test(v.reason)));
});

test('validateHConditions: condition with all tokens in FROZEN ledger passes', () => {
  const snapshot = mkSnapshot({
    'CON-003': { status: 'FROZEN', content: 'user can select drill mode', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-003 drill mode MUST be rendered in Given/When/Then format', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, true, `violations: ${JSON.stringify(result.violations)}`);
});

test('validateHConditions: condition with verb blacklist word fails', () => {
  const snapshot = mkSnapshot({
    'CON-014': { status: 'FROZEN', content: 'board texture classification', category: 'frozen_constraint' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'J-Compile MUST enumerate CON-014 categories', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /enumerate/.test(v.reason)));
});

test('validateHConditions: paraphrase pattern "document each" fails even with no blacklisted verb', () => {
  const snapshot = mkSnapshot({
    'CON-014': { status: 'FROZEN', content: 'board texture', category: 'frozen_constraint' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'handoff MUST document each board texture', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /paraphrase|document each/i.test(v.reason)));
});

test('validateHConditions: paraphrase pattern "for each X produce Y" fails', () => {
  const snapshot = mkSnapshot({
    'CON-020': { status: 'FROZEN', content: 'hand strength categories', category: 'frozen_constraint' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'for each hand strength produce a row', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /paraphrase|for each/i.test(v.reason)));
});

test('validateHConditions: condition with orphan substantive token fails', () => {
  const snapshot = mkSnapshot({
    'CON-001': { status: 'FROZEN', content: 'GTO strategy trainer', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-001 MUST expose a monte-carlo simulator', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /monte-carlo|simulator/i.test(v.reason)));
});

test('validateHConditions: condition referencing PROPOSED (not FROZEN) ledger entry fails', () => {
  const snapshot = mkSnapshot({
    'CON-999': { status: 'PROPOSED', content: 'some text', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-999 MUST be reformatted', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
});

test('validateHConditions: reports violation index matching condition index', () => {
  const snapshot = mkSnapshot({
    'CON-001': { status: 'FROZEN', content: 'text', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [
      { text: 'CON-001 reformat given when then', target_stage: 'stage-j' },
      { text: 'J-Compile MUST enumerate new fields', target_stage: 'stage-j' },
    ],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => v.index === 1));
});
