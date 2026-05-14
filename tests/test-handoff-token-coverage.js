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
  // Round-4 Cat B fix: burst enlarged to 34 contiguous orphan tokens so
  // max_contiguous_orphan_run=34 > threshold=30 fires (was 2, below threshold).
  // Orphan tokens disjoint from source vocab {card, model, with, rank, and, suit}.
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Card monte-carlo simulator zeta alpha beta gamma delta epsilon theta iota kappa lambda sigma omega apex blaze cedar dusk flint grove haven inlet jetty knoll lunar marsh nexus orbit prism quartz ridge spiral torch vessel',
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
  // Round-4 Cat B fix: burst enlarged to 33 contiguous orphan tokens so
  // max_contiguous_orphan_run=33 > threshold=30 fires (was 4, below threshold).
  // fields populated with source token ('render') so deep_check clears.
  // Orphan tokens disjoint from source vocab {render, card, in, given/when/then, format}.
  const co = mkCompileOutput({
    domain_model: {
      entities: {
        Card: {
          name: 'Card with fancy holographic rendering zeta alpha beta gamma delta epsilon theta iota kappa lambda sigma omega apex blaze cedar dusk flint grove haven inlet jetty knoll lunar marsh nexus orbit prism quartz ridge',
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
  // Round-4 Cat B fix: description enlarged to 31 contiguous CJK orphan tokens
  // (each space-separated CJK word = 1 token) so max_contiguous_orphan_run=31
  // > threshold=30 fires (was 1, below threshold).
  // Orphan CJK tokens are all distinct and absent from source {panel,titled,开始,训练}.
  const co = mkCompileOutput({
    ui_contract: {
      panels: {
        Home: {
          description: '设置 模块 功能 界面 系统 数据 处理 存储 查询 显示 输出 输入 控制 管理 配置 参数 结果 状态 操作 流程 测试 验证 报告 记录 分析 统计 比较 计算 转换 执行 运行',
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

// ---------------------------------------------------------------------------
// Round-4 Layer 2b threshold tests (per ASSERTION-4 round-4 spec §5 + §6.2)
// ---------------------------------------------------------------------------

test('round-4 Layer 2b: slot with max_run > 30 rejects', () => {
  // Construct a handoff slot with a long contiguous orphan run (35 tokens,
  // all absent from "short ledger entry"). Exceeds threshold=30 → must reject.
  const co = {
    handoff: {
      code_ready: true,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'unit-1' }],
      function_contracts: [{
        id: 'FC-001',
        // 35 distinct orphan tokens (none appear in "short ledger entry")
        purpose: 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xxx yyy zzz aab bbc ccd dde eef ffg ggh hhi iij',
        invariants: [],
        failure_modes: [],
        source_kind: 'ledger_direct',
        source_ref: 'CON-FAKE',
      }],
    },
  };
  const ctx = {
    snapshot: { entries: { 'CON-FAKE': { id: 'CON-FAKE', status: 'FROZEN', content: 'short ledger entry' } } },
    conditions: [],
  };
  const result = validateHandoff(co, ctx);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(e => /max_contiguous_orphan_run|threshold/.test(e)),
    `expected max_contiguous threshold rejection, got: ${result.errors.join('; ')}`
  );
});

test('round-4 Layer 2b: slot with max_run ≤ 30 passes Layer 2b threshold', () => {
  // Slot with ≤ 9 orphan tokens, contiguous. Well below threshold=30.
  // May fail other validations, but must NOT fail for max_contiguous reason.
  const co = {
    handoff: {
      code_ready: true,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'unit-1' }],
      function_contracts: [{
        id: 'FC-001',
        purpose: 'short ledger entry plus one two three four five extra orphan tokens',
        invariants: [],
        failure_modes: [],
        source_kind: 'ledger_direct',
        source_ref: 'CON-LEGIT',
      }],
    },
  };
  const ctx = {
    snapshot: { entries: { 'CON-LEGIT': { id: 'CON-LEGIT', status: 'FROZEN', content: 'short ledger entry' } } },
    conditions: [],
  };
  const result = validateHandoff(co, ctx);
  // May fail other validations (function_contracts slot provenance checks etc.)
  // but must NOT fail for max_contiguous_orphan_run reason.
  if (!result.valid) {
    assert.ok(
      !result.errors.some(e => /max_contiguous_orphan_run|threshold/.test(e)),
      `unexpected max_contiguous threshold rejection on legit slot: ${result.errors.join('; ')}`
    );
  }
});
