'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { deepCheckHandoffSubstantiveSlots } = require('../bin/lib/schema.cjs');

const SCHEMA = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'),
  'utf8',
));

// Build a fully-substantive handoff for tests that should pass; tests that
// should fail then mutate one slot to a vacuous shape.
function fullySubstantiveHandoff() {
  return {
    domain_model: {
      entities: [{ name: 'User', fields: 'id name email' }],
    },
    function_contracts: [
      { purpose: 'authenticate', invariants: 'idempotent', failure_modes: 'reject_invalid_token' },
    ],
    data_contract: { schema: '{user: {id, name, email}}' },
    ui_contract: {
      panels: [{ description: 'login screen', elements: 'form', states: 'idle/loading' }],
      state_ownership: { owner_map: 'auth=AuthCtx' },
      empty_states: { surfaces: 'login', messaging: 'sign-in prompt' },
      error_states: { error_map: 'invalid_creds=banner' },
    },
  };
}

test('deepCheckHandoffSubstantiveSlots passes fully-substantive handoff', () => {
  const handoff = fullySubstantiveHandoff();
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, true, `unexpected error: ${result.error}`);
});

test('deepCheckHandoffSubstantiveSlots rejects empty entities array (L0)', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [];
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /entities|min_entries/i);
});

test('deepCheckHandoffSubstantiveSlots rejects [{}] entries (L1)', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [{}];
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /name|fields|isEmptyOrPlaceholder|empty.*placeholder/i);
});

test('deepCheckHandoffSubstantiveSlots rejects empty/null required_subfield (L2)', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [{ name: '', fields: 'f' }];
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /name|empty.*placeholder/i);
});

test('deepCheckHandoffSubstantiveSlots rejects placeholder string (L3)', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [{ name: 'TODO', fields: 'see ledger' }];
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
});

test('deepCheckHandoffSubstantiveSlots rejects whole_section missing required_subfield', () => {
  const handoff = fullySubstantiveHandoff();
  // data_contract has only provenance metadata, no `schema` substantive subfield
  handoff.data_contract = { source_kind: 'ledger_direct', source_ref: 'CON-001' };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /data_contract|schema/);
});

test('deepCheckHandoffSubstantiveSlots passes when no_substantive_contract escape valve set with valid resolving ref', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [];
  handoff.domain_model.no_substantive_contract = true;
  handoff.domain_model.no_substantive_contract_reason = 'Pure UI feature, no domain entities. See CON-001 for converged scope.';
  const snapshot = { entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } } };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, true, `unexpected error: ${result.error}`);
});

test('deepCheckHandoffSubstantiveSlots rejects when escape valve flag set but ref does not resolve in ledger', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [];
  handoff.domain_model.no_substantive_contract = true;
  handoff.domain_model.no_substantive_contract_reason = 'See CON-999 (fabricated)';
  const snapshot = { entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } } };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, false);
  assert.match(result.error, /unresolved|CON-999|escape/i);
});

test('deepCheckHandoffSubstantiveSlots rejects when escape valve flag set but no refs in reason', () => {
  const handoff = fullySubstantiveHandoff();
  handoff.domain_model.entities = [];
  handoff.domain_model.no_substantive_contract = true;
  handoff.domain_model.no_substantive_contract_reason = 'Just trust me, no oversight needed';
  const snapshot = { entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } } };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, false);
  assert.match(result.error, /min_refs|escape/i);
});
