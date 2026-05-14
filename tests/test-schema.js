const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateHandoff, validateBundle } = require('../bin/lib/schema.cjs');

test('validateHandoff: valid handoff passes', () => {
  // Schema v2: data_contract requires `schema`; function_contracts requires entries with
  // [purpose, invariants, failure_modes]; empty/missing slots skip per validateProvenance:78
  // convention. Token coverage requires substantive tokens to overlap source.
  const handoff = {
    status: 'code_ready', code_ready: true, handoff_summary: 'OAuth2',
    retained_goal: 'Add OAuth2', implementation_scope: 'Full flow',
    repo_targets: {}, repo_grounding: {}, frozen_product_decisions: [],
    domain_model: {},
    data_contract: { schema: 'token store', source_kind: 'ledger_direct', source_ref: 'CON-001' },
    ui_contract: {},
    function_contracts: [
      { purpose: 'token', invariants: 'token', failure_modes: 'token', source_kind: 'ledger_direct', source_ref: 'CON-001' }
    ],
    file_plan: [],
    implementation_units: [{ id: 'unit-1', description: 'test' }],
    verification_commands: [], browser_checks: [], acceptance_checks: [],
    allowed_decisions: [], forbidden_decisions: [],
    reentry_triggers: {}, unresolved_gaps: []
  };
  const ctx = { snapshot: { entries: { 'CON-001': { status: 'FROZEN', content: 'token store' } } } };
  assert.equal(validateHandoff({ handoff }, ctx).valid, true);
});

test('validateHandoff: missing code_ready fails', () => {
  const result = validateHandoff({ handoff: { status: 'draft' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /code_ready/i.test(e)));
});

test('validateHandoff: missing implementation_units fails', () => {
  const result = validateHandoff({ handoff: { code_ready: true } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /implementation_units/i.test(e)));
});

test('validateBundle: reports present and missing sources', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire');
  fs.mkdirSync(path.join(bf, 'truth-surface'), { recursive: true });
  fs.writeFileSync(path.join(bf, 'case.json'), '{"stages":{}}');
  fs.writeFileSync(path.join(bf, 'truth-surface', 'constraint-ledger-snapshot.json'), '{}');
  const result = validateBundle(dir);
  assert.ok(result.missing.length > 0);
  assert.ok(result.present.length > 0);
  fs.rmSync(dir, { recursive: true });
});
