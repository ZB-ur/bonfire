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
  // Schema v2: required_subfields=["name","fields"] for entities. `notes` is no longer walked.
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Card model',
          fields: 'rank suit',
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
  // Schema v2: required_subfields=["name","fields"] for domain_model.entities.
  // Orphan tokens must live in a substantive subfield to be checked. Pre-v2
  // this test put orphans in `notes` (which v1 walked because no `fields`
  // filter was declared); v2 restricts walking to required_subfields, so
  // orphans now go into `name`.
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Card model with rank suit monte-carlo simulator',
          fields: { rank: 'Rank', suit: 'Suit' },
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
          name: 'Card render given when then format',
          fields: 'render',
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
  // Schema v2: orphans must be in a substantive subfield (name/fields) per
  // required_subfields. Moved from `notes` to `name` to reflect v2 walk semantics.
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Card with fancy holographic rendering',
          fields: {},
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
  // Schema v2: ui_contract.panels.required_subfields=["description","elements","states"]
  const co = mkCompileOutput({
    ui_contract: {
      panels: {
        Home: {
          description: '开始 训练',
          elements: '开始',
          states: '训练',
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
          elements: '开始',
          states: '训练',
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
  // Schema v2: substantive content in name + fields. Tokens: cards, suits, ranks (plural).
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Cards with suits and ranks',
          fields: 'cards',
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
