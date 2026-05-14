'use strict';

const PLACEHOLDER_STRINGS = [
  'todo',
  'see ledger',
  '...',
  '<tbd>',
  '<placeholder>',
  'tbd',
  'placeholder',
];

function isEmptyOrPlaceholder(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return PLACEHOLDER_STRINGS.includes(normalized);
}

function extractLedgerRefs(value, schema) {
  if (typeof value !== 'string') return [];
  if (!schema || typeof schema.ledger_id_pattern !== 'string') return [];
  const re = new RegExp(schema.ledger_id_pattern, 'g');
  const matches = value.match(re);
  return matches || [];
}

function validateLedgerRef(value, schema, ledgerSnapshot, minRefs) {
  minRefs = minRefs ?? 1;
  if (typeof value !== 'string') {
    return { valid: false, error: 'value must be a string', refs: [] };
  }
  const refs = extractLedgerRefs(value, schema);
  if (refs.length < minRefs) {
    return {
      valid: false,
      error: `min_refs=${minRefs} required, found ${refs.length}`,
      refs,
    };
  }
  const entries = (ledgerSnapshot && ledgerSnapshot.entries) || {};
  const notFound = refs.filter(r => !(r in entries));
  if (notFound.length > 0) {
    return {
      valid: false,
      error: `unresolved refs in ledger (not found): ${notFound.join(', ')}`,
      refs,
      unresolved: notFound,
    };
  }
  // Per ASSERTION-3a spec §6.7 helper contract: "asserts each match resolves
  // against the active FROZEN ledger snapshot". Non-FROZEN entries (PROPOSED,
  // CHALLENGED, SUPERSEDED, etc.) are not authoritative and cannot back an
  // escape valve. Mirrors Layer 2a's bin/lib/schema.cjs:151-153 status check.
  const nonFrozen = refs.filter(r => entries[r].status !== 'FROZEN');
  if (nonFrozen.length > 0) {
    const details = nonFrozen.map(r => `${r} is ${entries[r].status || '<missing>'}, expected FROZEN`).join('; ');
    return {
      valid: false,
      error: `refs not FROZEN: ${details}`,
      refs,
      non_frozen: nonFrozen,
    };
  }
  return { valid: true, refs };
}

module.exports = {
  isEmptyOrPlaceholder,
  extractLedgerRefs,
  validateLedgerRef,
  PLACEHOLDER_STRINGS,
};
