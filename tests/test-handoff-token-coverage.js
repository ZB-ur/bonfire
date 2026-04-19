'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validateHandoff } = require('../bin/lib/schema.cjs');

function mkCompileOutput(overrides = {}) {
  return {
    handoff: {
      code_ready: true,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'u1' }],
      ...overrides,
    },
  };
}

function mkContext(opts = {}) {
  return { snapshot: opts.snapshot || { entries: {} }, verdict: opts.verdict || null };
}

test('Layer 2b: slot with all tokens in source passes', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: { rank: 'Rank', suit: 'Suit' },
          notes: 'card model rank suit',
          source_kind: 'ledger_direct',
          source_ref: 'CON-013',
        },
      },
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'FROZEN', content: 'card model with rank and suit fields' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('Layer 2b: slot with orphan token fails', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: { rank: 'Rank', suit: 'Suit' },
          notes: 'card model rank suit monte-carlo simulator',
          source_kind: 'ledger_direct',
          source_ref: 'CON-013',
        },
      },
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'FROZEN', content: 'card model with rank and suit' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /orphan|monte-carlo|simulator/i.test(e)));
});

test('Layer 2b: condition_rewrite — tokens must come from condition text', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          notes: 'card rendered in given when then format',
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 0 },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'render card in Given/When/Then format', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('Layer 2b: condition_rewrite with new token not in condition fails', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          notes: 'card with fancy holographic rendering',
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 0 },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'render card in Given/When/Then format', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /fancy|holographic/i.test(e)));
});

test('Layer 2b: CJK literal match — Chinese slot with Chinese source passes', () => {
  const co = mkCompileOutput({
    ui_contract: {
      panels: {
        Home: {
          description: '开始 训练',
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 0 },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'panel titled 开始 训练', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('Layer 2b: CJK literal match — slot CJK not in source → orphan', () => {
  const co = mkCompileOutput({
    ui_contract: {
      panels: {
        Home: {
          description: '设置',  // not in source
          source_kind: 'condition_rewrite',
          source_ref: { condition_index: 0 },
        },
      },
    },
  });
  const ctx = mkContext({
    verdict: {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{ text: 'panel titled 开始 训练', target_stage: 'stage-j' }],
    },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
});

test('Layer 2b: lemmatization — plural slot matches singular source', () => {
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          fields: {},
          notes: 'cards with suits and ranks',
          source_kind: 'ledger_direct',
          source_ref: 'CON-013',
        },
      },
    },
  });
  const ctx = mkContext({
    snapshot: { entries: { 'CON-013': { status: 'FROZEN', content: 'card with suit and rank' } } },
  });
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});
