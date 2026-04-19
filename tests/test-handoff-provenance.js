'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { validateHandoff } = require('../bin/lib/schema.cjs');

function mkCompileOutput(overrides = {}) {
  return {
    handoff: {
      code_ready: true,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'unit-1' }],
      ...overrides,
    },
  };
}

function mkContext({ snapshot, verdict } = {}) {
  return {
    snapshot: snapshot || { entries: {} },
    verdict: verdict || null,
  };
}

test('validateHandoff: slot not listed in whitelist passes without source fields', () => {
  const co = mkCompileOutput({
    file_plan: [{ path: 'src/index.ts', action: 'create', why: 'entry point' }],
  });
  const result = validateHandoff(co, mkContext());
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('validateHandoff: domain_model.entities with valid ledger_direct passes', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          source_kind: 'ledger_direct',
          source_ref: 'CON-013',
        },
      },
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'FROZEN', content: 'card model' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('validateHandoff: entities with source_kind=ledger_direct but source_ref PROPOSED fails', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: { fields: {}, source_kind: 'ledger_direct', source_ref: 'CON-013' },
      },
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'PROPOSED', content: 'x' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /not FROZEN|FROZEN/.test(e)));
});

test('validateHandoff: entities missing source_kind fails', () => {
  const co = mkCompileOutput({
    domain_model: { entities: { Card: { fields: {}, source_ref: 'CON-013' } } },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'FROZEN', content: 'x' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /source_kind/.test(e)));
});

test('validateHandoff: entities missing source_ref fails', () => {
  const co = mkCompileOutput({
    domain_model: { entities: { Card: { fields: {}, source_kind: 'ledger_direct' } } },
  });
  const ctx = mkContext();
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /source_ref/.test(e)));
});

test('validateHandoff: source_kind=condition_rewrite with valid condition_index passes', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 0, verdict_path: '.bonfire/plan/h-review-verdict.json' },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'reformat Card into given/when/then', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('validateHandoff: condition_rewrite with out-of-range index fails', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 5, verdict_path: '.bonfire/plan/h-review-verdict.json' },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'x', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /condition_index|out of range/i.test(e)));
});

test('validateHandoff: whole_section slot (data_contract) validates at section root', () => {
  const co = mkCompileOutput({
    data_contract: {
      persistence_mechanism: 'localStorage',
      source_kind: 'ledger_direct',
      source_ref: 'CON-015',
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-015': { status: 'FROZEN', content: 'localStorage only' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});
