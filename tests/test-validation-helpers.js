const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isEmptyOrPlaceholder,
  PLACEHOLDER_STRINGS,
} = require('../bin/lib/validation-helpers.cjs');

test('isEmptyOrPlaceholder returns true for null', () => {
  assert.equal(isEmptyOrPlaceholder(null), true);
});

test('isEmptyOrPlaceholder returns true for undefined', () => {
  assert.equal(isEmptyOrPlaceholder(undefined), true);
});

test('isEmptyOrPlaceholder returns true for empty string', () => {
  assert.equal(isEmptyOrPlaceholder(''), true);
});

test('isEmptyOrPlaceholder returns true for whitespace-only string', () => {
  assert.equal(isEmptyOrPlaceholder('   '), true);
  assert.equal(isEmptyOrPlaceholder('\t\n  '), true);
});

test('isEmptyOrPlaceholder returns true for empty array', () => {
  assert.equal(isEmptyOrPlaceholder([]), true);
});

test('isEmptyOrPlaceholder returns true for empty object', () => {
  assert.equal(isEmptyOrPlaceholder({}), true);
});

test('isEmptyOrPlaceholder returns true for registered placeholder strings', () => {
  assert.equal(isEmptyOrPlaceholder('TODO'), true);
  assert.equal(isEmptyOrPlaceholder('see ledger'), true);
  assert.equal(isEmptyOrPlaceholder('...'), true);
  assert.equal(isEmptyOrPlaceholder('<TBD>'), true);
  assert.equal(isEmptyOrPlaceholder('<placeholder>'), true);
});

test('isEmptyOrPlaceholder is case-insensitive for placeholder strings', () => {
  assert.equal(isEmptyOrPlaceholder('todo'), true);
  assert.equal(isEmptyOrPlaceholder('Todo'), true);
  assert.equal(isEmptyOrPlaceholder('SEE LEDGER'), true);
  assert.equal(isEmptyOrPlaceholder('  See Ledger  '), true);
});

test('isEmptyOrPlaceholder returns false for substantive strings', () => {
  assert.equal(isEmptyOrPlaceholder('actual content'), false);
  assert.equal(isEmptyOrPlaceholder('a'), false);
  assert.equal(isEmptyOrPlaceholder('CON-001'), false);
});

test('isEmptyOrPlaceholder returns false for non-empty arrays', () => {
  assert.equal(isEmptyOrPlaceholder([1]), false);
  assert.equal(isEmptyOrPlaceholder(['x']), false);
});

test('isEmptyOrPlaceholder returns false for non-empty objects', () => {
  assert.equal(isEmptyOrPlaceholder({ k: 'v' }), false);
});

test('PLACEHOLDER_STRINGS exports as array of strings', () => {
  assert.ok(Array.isArray(PLACEHOLDER_STRINGS));
  assert.ok(PLACEHOLDER_STRINGS.length >= 5);
  for (const s of PLACEHOLDER_STRINGS) {
    assert.equal(typeof s, 'string');
  }
});

const { extractLedgerRefs } = require('../bin/lib/validation-helpers.cjs');

const TEST_SCHEMA = {
  ledger_id_pattern: '(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+',
};

test('extractLedgerRefs finds single ref in prose', () => {
  const refs = extractLedgerRefs('All entries frozen — see CON-001 for details', TEST_SCHEMA);
  assert.deepEqual(refs, ['CON-001']);
});

test('extractLedgerRefs finds multiple refs in prose', () => {
  const refs = extractLedgerRefs('CON-001 and RISK-014 are linked via DEP-002', TEST_SCHEMA);
  assert.deepEqual(refs, ['CON-001', 'RISK-014', 'DEP-002']);
});

test('extractLedgerRefs returns empty array for prose with no refs', () => {
  const refs = extractLedgerRefs('No refs here at all', TEST_SCHEMA);
  assert.deepEqual(refs, []);
});

test('extractLedgerRefs returns empty array for non-string value', () => {
  assert.deepEqual(extractLedgerRefs(null, TEST_SCHEMA), []);
  assert.deepEqual(extractLedgerRefs(undefined, TEST_SCHEMA), []);
  assert.deepEqual(extractLedgerRefs(42, TEST_SCHEMA), []);
});

test('extractLedgerRefs does not match partial prefix or shorter forms', () => {
  const refs = extractLedgerRefs('CON-1 fixme and CONS-001 typo', TEST_SCHEMA);
  // CON-1 matches (\\d+ matches one digit), CONS- does not (S is not a prefix)
  assert.deepEqual(refs, ['CON-1']);
});

test('extractLedgerRefs returns empty array for missing schema (graceful, no throw)', () => {
  // Per code-quality review I1: graceful return matches the module's structured-error
  // contract. Throwing would propagate to callers via validateLedgerRef.
  assert.deepEqual(extractLedgerRefs('CON-001', null), []);
  assert.deepEqual(extractLedgerRefs('CON-001', undefined), []);
  assert.deepEqual(extractLedgerRefs('CON-001', {}), []);
  assert.deepEqual(extractLedgerRefs('CON-001', { ledger_id_pattern: null }), []);
});

const { validateLedgerRef } = require('../bin/lib/validation-helpers.cjs');

const SAMPLE_SNAPSHOT = {
  entries: {
    'CON-001': { id: 'CON-001', status: 'FROZEN' },
    'CON-002': { id: 'CON-002', status: 'FROZEN' },
    'RISK-014': { id: 'RISK-014', status: 'OPEN' },
  },
};

test('validateLedgerRef passes when refs match pattern and resolve', () => {
  const result = validateLedgerRef(
    'All FROZEN — see CON-001 and CON-002',
    TEST_SCHEMA,
    SAMPLE_SNAPSHOT,
    1,
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.refs, ['CON-001', 'CON-002']);
});

test('validateLedgerRef fails when no refs found', () => {
  const result = validateLedgerRef('No refs here', TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
  assert.match(result.error, /no_refs_found|min_refs/);
});

test('validateLedgerRef fails when ref count below min_refs', () => {
  const result = validateLedgerRef('Only one — CON-001', TEST_SCHEMA, SAMPLE_SNAPSHOT, 2);
  assert.equal(result.valid, false);
  assert.match(result.error, /min_refs/);
});

test('validateLedgerRef fails when ref pattern matches but does not resolve in ledger', () => {
  const result = validateLedgerRef('See CON-999 (fabricated)', TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
  assert.match(result.error, /unresolved|CON-999/);
});

test('validateLedgerRef fails when value is not a string', () => {
  const result = validateLedgerRef(null, TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
});

test('validateLedgerRef respects minRefs=0 explicitly (?? semantics, not || which would coerce to 1)', () => {
  // Per code-quality review I2: minRefs=0 means "refs optional but validated if present".
  // Old code used `|| 1` which coerced 0 to 1. New code uses `?? 1` which preserves 0.
  const result = validateLedgerRef('No refs at all', TEST_SCHEMA, SAMPLE_SNAPSHOT, 0);
  assert.equal(result.valid, true);
  assert.deepEqual(result.refs, []);
});
