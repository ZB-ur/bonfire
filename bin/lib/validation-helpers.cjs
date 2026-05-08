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
  const unresolved = refs.filter(r => !(r in entries));
  if (unresolved.length > 0) {
    return {
      valid: false,
      error: `unresolved refs in ledger: ${unresolved.join(', ')}`,
      refs,
      unresolved,
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
