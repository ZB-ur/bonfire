# ASSERTION-4 — Layer 2b Softening + Layer M Mandate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two orthogonal seam-validation gaps surfaced by 2026-05-04 dogfood — Layer 2b false-positive rate on legitimate handoff prose (anti-invention over-strictness) and substantive-slot vacuous-pass loophole (anti-omission absence). Introduces Layer M mandate as a distinct namespace from anti-invention layers.

**Architecture:** Two-axis. Axis (a) softens Layer 2b via two coupled changes: A1 passes `CON-NNN` cross-reference tokens through scaffolding (matches `/^con-\d+$/i` after lowercasing), A3 replaces zero-orphan with ratio threshold whose value is calibrated empirically during plan execution against fixture anchors. Axis (b) introduces Layer M: per-unit `substantive_slot_refs` declaration with a handoff-level disjunction (≥1 unit non-empty OR explicit `no_substantive_contract: true` with ledger-cited reason). New `mandate_failure` conflict_type with retry-bounded routing (J self-fixes up to 2 times, falls back to stage-h on exhaustion). Plus mechanical riders: `truth-propose --id auto`, discard ruling enum rejection, supersede error message tweak, skill doc update.

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert/strict`, no new dependencies. Bonfire CLI at `$HOME/.claude/bonfire/bin/bonfire-tools.cjs` (after install.sh re-runs).

**Spec:** `docs/superpowers/specs/2026-05-04-bonfire-assertion-4-design.md` (frozen-with-bounded-calibration; 4 commits of dialectic refinement)

**Maturity assessment:** `docs/superpowers/specs/2026-05-04-bonfire-maturity-assessment.md` (rows #1, #2, #4, #5, #8 in scope)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `schemas/bonfire-v1.json` | Add `handoff_mandate_params` block; add `ruling_action_enum` to `bonfire-h-review.constraints`; add `mandate_failure` to reentry routes with `retry_budget: 2`, `escalation_target_stage: "stage-h"` |
| Modify | `bin/lib/seam-validation.cjs` | Add A1 CON-* passthrough in `compareTokens`; expose `THRESHOLD` constant; new `classifyAlignedByToken(token)` substring rule helper |
| Modify | `bin/lib/schema.cjs` | Replace zero-orphan check with ratio-threshold; add `validateMandate` for Layer M; route `validateHandoff` through it |
| Modify | `bin/lib/state.cjs` | Add per-conflict retry budget counter to `stateReentry`; honor `escalation_target_stage` on budget exhaustion |
| Modify | `bin/lib/truth-surface.cjs` | Add `propose --id auto` resolver (next-numeric-CON); update supersede error message per §5.3 |
| Modify | `bin/lib/delta-parser.cjs` | Reject `bonfire-h-review` rulings with `action ∉ {freeze, supersede}` |
| Modify | `bin/bonfire-tools.cjs` | Wire `--id auto` flag for `truth-propose`; thread retry-budget context through `state-reentry` invocation |
| Create | `tests/test-mandate-validator.js` | M.1/M.2 disjunction + concrete-ref invariant tests |
| Create | `tests/test-substring-classifier.js` | aligned_by substring rule unit tests |
| Create | `tests/test-retry-budget.js` | Per-conflict retry budget + max_depth interaction tests |
| Create | `tests/test-tokenization-contract.js` | §3.1.1 CON-NNN atomicity regression |
| Create | `tests/test-ratio-threshold.js` | Layer 2b ratio rule replaces zero-orphan; threshold pinned by fixtures |
| Create | `tests/test-auto-id.js` | `truth-propose --id auto` resolves to next CON-NNN |
| Create | `tests/test-discard-ruling-rejection.js` | delta-validate rejects non-{freeze,supersede} rulings |
| Modify | `tests/test-hj-seam-fixtures.js` | Add 5 new fixture-driven tests |
| Create | `tests/fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json` | 14-token forensic ground truth |
| Create | `tests/fixtures/hj-seam-adversarial/omit-substantive-slots/` | Layer M mandate axis pin |
| Create | `tests/fixtures/hj-seam-adversarial/condition-index-out-of-range/` | Layer 2a condition_rewrite path |
| Create | `tests/fixtures/hj-seam-adversarial/pure-invention-floor/` | Layer 2b 0% overlap floor |
| Create | `tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes/` | Layer 2b upper anchor (calibration-derived) |
| Create | `.bonfire-calibration/2026-05-06-threshold-calibration.json` | Captured calibration dispatch output + percentile analysis |
| Modify | `skills/plan/SKILL.md` | Stage E note — align-via-token primary, supersede edge case (per spec §5.3) |
| Modify | `agents/bonfire-j-compile.md` | Mention substantive_slot_refs requirement + no_substantive_contract escape valve |
| Modify | `references/stage-j-format-whitelist.md` | (No additions expected — A1 regex passthrough handles CON-* without whitelist; verify only) |

---

## Task 1: Schema additions

**Files:**
- Modify: `schemas/bonfire-v1.json`
- Test: ad-hoc JSON-parse + key presence check (no test file yet — covered by Task 5/7 once validators consume the new keys)

**Rationale:** Foundation. All downstream validator code reads these schema fields. Additive; no removal or rename.

- [ ] **Step 1: Add `ruling_action_enum` to `bonfire-h-review.constraints`**

Edit `schemas/bonfire-v1.json`. Inside `delta_schemas.bonfire-h-review.constraints`, add the new field (preserving existing `verdict_enum`, `conflict_type_required_when_rejected`, `condition_item_shape`):

```json
"constraints": {
  "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
  "conflict_type_required_when_rejected": true,
  "condition_item_shape": { ... existing ... },
  "ruling_action_enum": ["freeze", "supersede"]
}
```

- [ ] **Step 2: Add `handoff_mandate_params` top-level block**

After the existing `handoff_substantive_slots` block in `schemas/bonfire-v1.json`, add a sibling block (parameters only — no rule logic per spec §6.0):

```json
"handoff_mandate_params": {
  "ref_field": "substantive_slot_refs",
  "concrete_ref_patterns": [
    "^FC-\\d+$",
    "^panel:.+$"
  ],
  "supplementary_ref_pattern": "^(?:CON|RG|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+$",
  "escape_valve": {
    "flag": "no_substantive_contract",
    "reason_field": "no_substantive_contract_reason",
    "reason_ref_pattern": "(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
    "reason_uses_zero_orphan": true
  }
}
```

- [ ] **Step 3: Add `mandate_failure` reentry route**

In `schemas/bonfire-v1.json`, locate the `reentry_routes` table. Add the new entry using the **same compact shape** as existing routes (`{to, crosses_pipeline}`), plus the new `retry_budget` and `escalation_target_stage` fields. Existing routes are preserved verbatim; only `mandate_failure` is added:

```json
"reentry_routes": {
  ... existing routes ...,
  "mandate_failure": {
    "to": "stage-j",
    "crosses_pipeline": false,
    "retry_budget": 2,
    "escalation_target_stage": "stage-h",
    "description": "J handoff failed Layer M mandate validation — substantive_slot_refs absent or no_substantive_contract escape valve invalid"
  }
}
```

**Plan-execution finding (2026-05-06, post-Task-1-implementer):** an earlier draft of this snippet used a richer shape (`from_pipelines`, `target_stage`, `target_pipeline` instead of `to`/`crosses_pipeline`). That would have failed at runtime because `bin/lib/state.cjs::stateReentry` reads `route.to` and `route.crosses_pipeline`. The compact shape above is the correct version. `retry_budget` and `escalation_target_stage` are net-new fields used by Task 8.

- [ ] **Step 4: Validate JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json'))" && echo OK
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "feat(schema): add handoff_mandate_params + ruling_action_enum + mandate_failure route

ASSERTION-4 §6.1 schema additions only (parameter-shaped per §6.0
boundary rule). No removals, no field renames. Existing routes unchanged.

Adds:
- ruling_action_enum: ['freeze', 'supersede'] in bonfire-h-review
- handoff_mandate_params block (Layer M params)
- mandate_failure reentry route with retry_budget=2 (first use of
  retry_budget field; defaults absent/null for existing routes)"
```

---

## Task 2: A1 CON cross-reference passthrough

**Files:**
- Modify: `bin/lib/seam-validation.cjs` (function `compareTokens`)
- Create: `tests/test-tokenization-contract.js`

**Rationale:** Spec §3.1 + §3.1.1. The tokenizer already produces `con-026` as atomic (verified during round 3 dialectic — `boundaryRegex` excludes hyphen, `lemmatizeToken` line 82 preserves identifiers). A1 only changes `compareTokens` to mask the CON-pattern out of both source-set and orphan-set. Plus adds a regression test to pin the tokenizer behavior as a contract.

- [ ] **Step 1: Add tokenization contract regression test**

Create `tests/test-tokenization-contract.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractSubstantiveTokens } = require('../bin/lib/seam-validation.cjs');

test('CON-NNN tokens stay atomic (no hyphen split)', () => {
  const tokens = extractSubstantiveTokens('CON-026 is foo. con-099, RG-014!');
  assert.deepEqual(tokens, ['con-026', 'is', 'foo', 'con-099', 'rg-014']);
});

test('Identifier tokens survive lemmatization', () => {
  // lemmatizeToken should NOT strip trailing chars from CON-026 etc.
  // (Indirect check: extractSubstantiveTokens output is what consumers see.)
  const tokens = extractSubstantiveTokens('mitigated by CON-026 and resolved');
  assert.ok(tokens.includes('con-026'));
  assert.ok(!tokens.some(t => t === 'con')); // no orphan 'con' from split
});
```

- [ ] **Step 2: Run new test to verify it passes (current behavior already correct)**

```bash
node --test tests/test-tokenization-contract.js
```

Expected: PASS (this is a regression guard; current behavior already conforms).

- [ ] **Step 3: Locate `compareTokens` in `bin/lib/seam-validation.cjs`**

```bash
grep -n "function compareTokens" bin/lib/seam-validation.cjs
```

- [ ] **Step 4: Add A1 mask before token comparison**

Edit `compareTokens` (around the line that builds slotTokens / sourceTokens sets). Insert the CON-passthrough filter:

```javascript
// A1: CON-NNN cross-reference tokens are scaffolding (per spec §3.1).
// Filter them from both slot-side and source-side before comparison.
const isConRef = (tok) => /^con-\d+$/i.test(tok);
const filteredSlotTokens = slotTokens.filter(t => !isConRef(t));
const filteredSourceTokens = new Set([...sourceTokens].filter(t => !isConRef(t)));
```

Then change downstream operations to use the filtered variants.

- [ ] **Step 5: Run existing seam-validation tests**

```bash
node --test tests/test-hj-seam-fixtures.js
```

Some tests may flake if fixtures contain CON-* tokens that previously appeared in orphans. Inspect failures; if any fixture's expected behavior was relying on CON-* being orphan, that fixture is mis-specified per A1 rule and needs adjustment in Task 14-18.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-tokenization-contract.js
git commit -m "feat(layer-2b): A1 CON-NNN cross-reference passthrough

Per ASSERTION-4 §3.1: tokens matching /^con-\\d+$/i are scaffolding,
masked from both slot-side and source-side before token coverage diff.

Adds tokenization contract regression test pinning current behavior
of extractSubstantiveTokens (CON-026 atomic; identifiers preserved
through lemmatize). Spec §3.1.1 makes this a load-bearing contract.

Note: existing fixture tests may show changed behavior where CON-*
orphans were counted; those fixtures are revisited in fixture tasks."
```

---

## Task 3: aligned_by substring classifier utility

**Files:**
- Modify: `bin/lib/seam-validation.cjs` (or new file `bin/lib/aligned-by-classifier.cjs`)
- Create: `tests/test-substring-classifier.js`
- Create: `tests/fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json`

**Rationale:** Spec §3.3.2 round 3 substring rule. Used by Task 5 (calibration outlier exclusion) and pinned by regression fixture (per round 3 patch 2). Implemented as a small standalone helper.

- [ ] **Step 1: Create the dogfood-2026-05-04-truth fixture**

Create `tests/fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json`:

```json
{
  "_source": "Forensic enumeration from /Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json",
  "_recorded": "2026-05-06",
  "_purpose": "Pin §3.3.2 substring rule against the 14 distinct aligned_by values from the 2026-05-04 dogfood archive. Test failure = rule drift.",
  "tokens": [
    {"token": "g-blue", "expected": "INCLUDE"},
    {"token": "g-blue-mitigated-via-CON-026", "expected": "EXCLUDE"},
    {"token": "g-blue-mitigated-via-CON-027", "expected": "EXCLUDE"},
    {"token": "g-blue-mitigated-via-CON-032", "expected": "EXCLUDE"},
    {"token": "g-blue-mitigated-via-CON-034", "expected": "EXCLUDE"},
    {"token": "g-blue-mitigated-via-CON-035", "expected": "EXCLUDE"},
    {"token": "g-blue-mitigated-via-CON-036", "expected": "EXCLUDE"},
    {"token": "stage-e-accept-30-as-v0.1-budget", "expected": "INCLUDE"},
    {"token": "stage-e-accept-as-known-limitation-CON-022", "expected": "INCLUDE"},
    {"token": "stage-e-drop-schema-version-via-CON-024", "expected": "EXCLUDE"},
    {"token": "stage-e-mitigate-via-mixed-flag-display", "expected": "EXCLUDE"},
    {"token": "stage-e-resolution-via-CON-023", "expected": "EXCLUDE"},
    {"token": "stage-e-superseded-by-CON-016", "expected": "EXCLUDE"},
    {"token": "stage-g-survival", "expected": "INCLUDE"}
  ]
}
```

- [ ] **Step 2: Add failing test for the classifier**

Create `tests/test-substring-classifier.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyAlignedByToken } = require('../bin/lib/seam-validation.cjs');

test('substring rule: tokens with -via- or -by- → EXCLUDE', () => {
  assert.equal(classifyAlignedByToken('stage-e-superseded-by-CON-016'), 'EXCLUDE');
  assert.equal(classifyAlignedByToken('g-blue-mitigated-via-CON-026'), 'EXCLUDE');
});

test('substring rule: tokens without -via- or -by- → INCLUDE', () => {
  assert.equal(classifyAlignedByToken('stage-g-survival'), 'INCLUDE');
  assert.equal(classifyAlignedByToken('g-blue'), 'INCLUDE');
  assert.equal(classifyAlignedByToken('stage-e-accept-as-known-limitation-CON-022'), 'INCLUDE');
});

test('null/undefined/empty → INCLUDE', () => {
  assert.equal(classifyAlignedByToken(null), 'INCLUDE');
  assert.equal(classifyAlignedByToken(undefined), 'INCLUDE');
  assert.equal(classifyAlignedByToken(''), 'INCLUDE');
});

test('14-token dogfood forensic: 14/14 classify per ground truth', () => {
  const truth = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json'),
    'utf8'
  ));
  for (const { token, expected } of truth.tokens) {
    const actual = classifyAlignedByToken(token);
    assert.equal(actual, expected, `Token "${token}" classified ${actual}, expected ${expected}`);
  }
});
```

- [ ] **Step 3: Run test to verify failure (function not yet exported)**

```bash
node --test tests/test-substring-classifier.js
```

Expected: FAIL — `classifyAlignedByToken is not a function`.

- [ ] **Step 4: Implement classifier in `bin/lib/seam-validation.cjs`**

Add near the top of the file (or in a logical grouping):

```javascript
/**
 * Spec §3.3.2 — empirical substring rule for aligned_by token classification.
 * Used by calibration outlier exclusion (§3.3.2) and pinned by regression
 * fixture (tests/fixtures/aligned-by-classification/dogfood-2026-05-04-truth.json).
 *
 * EXCLUDE iff token contains "-via-" or "-by-" substring.
 * INCLUDE otherwise (including null, undefined, empty array).
 *
 * False-positive whitelist is empty at spec freeze. Operators may add to it
 * via calibration log review (see spec §3.3.2 calibration log enumeration).
 */
const ALIGNED_BY_FALSE_POSITIVE_WHITELIST = new Set([
  // (empty — populated via calibration decisions)
]);

function classifyAlignedByToken(token) {
  if (token == null || token === '') return 'INCLUDE';
  if (Array.isArray(token)) {
    if (token.length === 0) return 'INCLUDE';
    // For an array of tokens, EXCLUDE if ANY single token would EXCLUDE
    return token.some(t => classifyAlignedByToken(t) === 'EXCLUDE') ? 'EXCLUDE' : 'INCLUDE';
  }
  const s = String(token);
  if (ALIGNED_BY_FALSE_POSITIVE_WHITELIST.has(s)) return 'INCLUDE';
  return (s.includes('-via-') || s.includes('-by-')) ? 'EXCLUDE' : 'INCLUDE';
}

module.exports = {
  ...,
  classifyAlignedByToken,
  ALIGNED_BY_FALSE_POSITIVE_WHITELIST,
};
```

- [ ] **Step 5: Run tests to verify pass**

```bash
node --test tests/test-substring-classifier.js
```

Expected: 4/4 PASS, including 14/14 in the forensic test.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-substring-classifier.js tests/fixtures/aligned-by-classification/
git commit -m "feat(seam-validation): aligned_by substring classifier per spec §3.3.2

Substring rule (-via- or -by- → EXCLUDE; otherwise INCLUDE) is
empirically derived from 2026-05-04 dogfood archive 14-token forensic.
14/14 classify correctly per ground truth.

ALIGNED_BY_FALSE_POSITIVE_WHITELIST exported (initially empty) so
operators can promote false-positive shapes during calibration log
review without code changes.

Per round 3 patch 2: dogfood-2026-05-04-truth.json sinks the forensic
into a permanent regression guard. Test failure = rule drift; reopen
spec §3.3.2 for empirical update."
```

---

## Task 4: Calibration j-compile dispatch

**Files:**
- Create: `.bonfire-calibration/2026-05-06-threshold-calibration.json`
- Create: `.bonfire-calibration/calibration-instructions.md` (one-shot, not committed long-term)

**Rationale:** Spec §3.3 binding step. Produces the empirical anchor for fixture #5 + informs THRESHOLD selection in Task 6. The output is an artifact, not production code. This task does NOT modify production code or run tests — its deliverable is the calibration data captured from a real j-compile dispatch.

⚠ **This task requires a live j-compile agent dispatch on the gto-trainer dogfood case** (`/Users/lddmay/AiCoding/bonfire-test/gto-trainer/`). It cannot be automated within an inline-execution loop. Must be performed by a subagent or interactively.

- [ ] **Step 1: Restore minimal handoff context for the dispatch**

The gto-trainer compile-output.json was overwritten at the end of dogfood. Reconstruct enough context for j-compile by reading the archive ledger snapshot directly. The dispatch instruction must use the archive's FROZEN snapshot, not regenerate it.

```bash
ls /Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/
# Verify constraint-ledger-snapshot.json + h-review-verdict.json present
```

- [ ] **Step 2: Verify pre-dispatch enumeration of aligned_by emit points**

Per spec §3.3.2 plan responsibility:

```bash
# Code-level constants
grep -n "TOKEN_STAGE\|aligned_by.*=" bin/lib/freeze-enforcement.cjs bin/lib/truth-surface.cjs

# Real-world emit values from dogfood archive
node -e "
const d = JSON.parse(require('fs').readFileSync(
  '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json'
));
const seen = new Set();
for (const e of Object.values(d.entries)) {
  for (const t of (e.aligned_by || [])) seen.add(t);
}
console.log([...seen].sort().join('\n'));
"
```

Cross-check against the substring classifier's 14-token ground truth fixture. Confirm 0 unclassified tokens. If novel tokens emerge (post-dogfood ledger growth), HALT and operator must extend the truth fixture before proceeding.

- [ ] **Step 3: Dispatch calibration j-compile**

Use Agent tool with `bonfire-j-compile`:

```
Agent({
  subagent_type: "bonfire-j-compile",
  description: "Calibration dispatch for threshold anchoring",
  prompt: <see calibration-instructions.md template below>
})
```

Calibration instructions template (write to `.bonfire-calibration/calibration-instructions.md`):

```markdown
You are bonfire-j-compile producing a CALIBRATION compile-output for ASSERTION-4 threshold anchoring.

This is NOT a normal compile. The output will not be used to drive code stage. Your goal is to produce ≥ 6 populated substantive slots (FC-NNN function_contracts, domain_model.entities, panels) with prose that is NATURAL PARAPHRASE of the cited ledger entries — not literal verbatim quotation, but not invented either. Aim for the kind of writing a domain-aware engineer would naturally produce given the source text, with their own word choices for clarity.

Source: /Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/

Constraints:
- Use source_kind: "ledger_direct" for all substantive slots
- Each source_ref must point to a FROZEN entry in the snapshot
- Apply A1 CON-* cross-reference passthrough principle (mention CON-NNN in prose where relevant; those tokens are scaffolding now)
- DO NOT pad with literal-quotation only — that defeats calibration
- DO NOT invent product semantics either — every claim should map to a citable ledger entry

Produce ≥ 6 populated function_contracts (or mix of contracts, entities, panels totaling ≥6).

Output: write to /Users/lddmay/AiCoding/bonfire/.bonfire-calibration/raw-output-2026-05-06.json
(NOT to the gto-trainer case directory — this artifact lives in the bonfire repo.)
```

- [ ] **Step 4: Compute overlap distribution from raw output**

Create `.bonfire-calibration/2026-05-06-threshold-calibration.json` by running an analysis script against the agent's raw output:

```javascript
// .bonfire-calibration/analyze.js (one-shot, not committed)
const fs = require('fs');
const path = require('path');
const { extractSubstantiveTokens, classifyAlignedByToken } = require('../bin/lib/seam-validation.cjs');

const raw = JSON.parse(fs.readFileSync('.bonfire-calibration/raw-output-2026-05-06.json'));
const snap = JSON.parse(fs.readFileSync('/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json'));

// For each populated substantive slot, compute overlap_ratio after A1 mask.
// Skip slots whose source_ref entry has aligned_by classified as EXCLUDE
// (transitive paraphrase outlier exclusion per §3.3.2).
const ratios = [];
const excluded = [];
const includeReasons = [];
const excludeReasons = [];

const isConRef = (tok) => /^con-\d+$/i.test(tok);
const ratio = (sourceText, slotText) => {
  const slot = extractSubstantiveTokens(slotText).filter(t => !isConRef(t));
  const src = new Set(extractSubstantiveTokens(sourceText).filter(t => !isConRef(t)));
  if (slot.length === 0) return 0;
  const overlap = slot.filter(t => src.has(t)).length;
  return overlap / slot.length;
};

const walk = (collection, getSlotText) => {
  for (const slot of collection) {
    const ref = slot.source_ref;
    if (typeof ref !== 'string') continue;
    const src = snap.entries[ref];
    if (!src) continue;
    const cls = classifyAlignedByToken(src.aligned_by);
    if (cls === 'EXCLUDE') {
      excluded.push({ ref, aligned_by: src.aligned_by });
      excludeReasons.push(`${ref} excluded: aligned_by=${JSON.stringify(src.aligned_by)}`);
      continue;
    }
    const r = ratio(src.content, getSlotText(slot));
    ratios.push({ ref, overlap_ratio: r });
    includeReasons.push(`${ref} included: aligned_by=${JSON.stringify(src.aligned_by)} ratio=${r.toFixed(3)}`);
  }
};

walk(raw.handoff.function_contracts || [], s => [s.purpose, ...(s.invariants||[]), ...(s.failure_modes||[])].join(' '));
walk(raw.handoff.domain_model?.entities || [], s => Object.values(s).filter(v => typeof v === 'string').join(' '));
walk(raw.handoff.ui_contract?.panels || [], s => [s.description, ...(s.elements||[]), ...(s.states||[])].join(' '));

// 5th percentile per spec §3.3.1
ratios.sort((a, b) => a.overlap_ratio - b.overlap_ratio);
const sample_size = ratios.length;
const p5_idx = Math.floor(0.05 * sample_size);
const anchor = sample_size > 0 ? ratios[p5_idx].overlap_ratio : null;

const out = {
  calibration_date: '2026-05-06',
  spec_ref: 'specs/2026-05-04-bonfire-assertion-4-design.md §3.3',
  raw_output_ref: '.bonfire-calibration/raw-output-2026-05-06.json',
  sample_size_total: ratios.length + excluded.length,
  sample_size_after_outlier_exclusion: sample_size,
  outlier_exclusions: excluded,
  include_reasons: includeReasons,
  exclude_reasons: excludeReasons,
  ratios_sorted: ratios,
  fifth_percentile_anchor: anchor,
  passes_minimum_sample: sample_size >= 6,
  passes_anchor_above_floor: anchor !== null && anchor > 0.36,
  passes_gap_width: anchor !== null && (anchor - 0.36) >= 0.10,
  threshold_picked: anchor !== null && anchor > 0.36 ? Math.round((0.36 + 0.01) * 100) / 100 : null,  // lower-bias per §3.2.5: floor + ε
};

fs.writeFileSync('.bonfire-calibration/2026-05-06-threshold-calibration.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
```

Run:

```bash
node .bonfire-calibration/analyze.js
```

- [ ] **Step 5: Inspect calibration log + ratify**

The output JSON contains:
- `passes_minimum_sample` → must be true (≥6 sample after exclusion)
- `passes_anchor_above_floor` → must be true (5th percentile > 36%)
- `passes_gap_width` → must be true (anchor - 36% ≥ 10pp)
- `outlier_exclusions` → operator inspects per spec §3.3.2 round 3 patch 1 (calibration log enumeration)

If any pass-flag is false, calibration FAILS. Halt plan; trigger errata + maturity-assessment v2.

- [ ] **Step 6: Commit calibration artifact**

```bash
git add .bonfire-calibration/2026-05-06-threshold-calibration.json
git commit -m "calibration: ASSERTION-4 threshold anchor + fixture #5 source

Captured from j-compile dispatch on 2026-05-04 gto-trainer dogfood case.
5th-percentile anchor + outlier exclusions + gap-width check per spec
§3.3.1 / §3.3.2.

Threshold picked per §3.2.5 lower-bias policy. Gap and floor checks
both pass. Produced via .bonfire-calibration/analyze.js (one-shot,
not committed)."
```

(Raw output `.bonfire-calibration/raw-output-2026-05-06.json` is gitignored — privacy of agent prompt + token count noise.)

---

## Task 5: Generate fixture #5 from calibration output

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes/`

**Rationale:** Spec §7 fixture #5 anchors Layer 2b ratio threshold's upper bound. Content derived from Task 4's calibrated output — pick the 5th-percentile slot (the one establishing the anchor) as the fixture's substantive slot.

- [ ] **Step 1: Identify the 5th-percentile slot from calibration data**

```bash
node -e "
const c = JSON.parse(require('fs').readFileSync('.bonfire-calibration/2026-05-06-threshold-calibration.json'));
const idx = Math.floor(0.05 * c.ratios_sorted.length);
console.log('5th percentile slot:', JSON.stringify(c.ratios_sorted[idx], null, 2));
"
```

- [ ] **Step 2: Copy raw slot prose into fixture**

```bash
mkdir -p tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes
```

Create `tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes/README.md`:

```markdown
# legitimate-paraphrase-passes

**Anchors:** Layer 2b upper bound (calibration-derived from j-compile on 2026-05-04 dogfood case).

**Source slot:** Pick from `.bonfire-calibration/2026-05-06-threshold-calibration.json` — the slot at 5th-percentile of overlap ratios (minus outlier exclusions). Source ledger entry CON-NNN cited verbatim below.

**Expected behavior under ASSERTION-4 ratio rule:** PASS — overlap_ratio > THRESHOLD.

**If this fixture FAILS:** ratio threshold drifted upward, OR A1 mask broken. Investigate before proceeding.

**Author note:** This fixture is NOT a stable artifact — its source slot's prose was generated by an LLM during calibration. Re-running calibration on a different date may produce a different anchor. The fixture is anchored to spec freeze date only.
```

Create `tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes/fixture.json`:

```json
{
  "_meta": "Calibration-derived fixture; see README.md",
  "compile_output_fragment": {
    "handoff": {
      "function_contracts": [
        {
          "id": "FC-CALIBRATION",
          "purpose": "<copy slot prose from raw-output, the 5th-percentile entry>",
          "invariants": ["<copy from raw-output>"],
          "failure_modes": ["<copy from raw-output>"],
          "source_kind": "ledger_direct",
          "source_ref": "<copy from raw-output>"
        }
      ]
    }
  },
  "snapshot_fragment": {
    "entries": {
      "<copy>": {
        "id": "<copy>",
        "content": "<paste FROZEN entry content from gto-trainer archive snapshot>",
        "status": "FROZEN",
        "aligned_by": []
      }
    }
  },
  "expected_validation_result": "PASS",
  "expected_overlap_ratio_min": "<calibrated 5th percentile minus 2pp tolerance>"
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/legitimate-paraphrase-passes/
git commit -m "test(fixture): #5 legitimate-paraphrase-passes (Layer 2b upper anchor)

Calibration-derived per spec §7 + §3.3. Anchors Layer 2b ratio
threshold's upper bound — slot must PASS validation under chosen
THRESHOLD.

Source slot is the 5th-percentile entry from
.bonfire-calibration/2026-05-06-threshold-calibration.json (after
substring-rule outlier exclusion). README documents the calibration
provenance."
```

---

## Task 6: A3 ratio threshold replaces zero-orphan in compareTokens

**Files:**
- Modify: `bin/lib/seam-validation.cjs` (function `compareTokens`)
- Create: `tests/test-ratio-threshold.js`

**Rationale:** Spec §3.2 + §3.2.5. Replace zero-orphan with ratio comparison. THRESHOLD = floor + ε from Task 4 calibration (lower-bias). Pin via the 0% / 36% / calibrated-anchor fixture lattice.

- [ ] **Step 1: Read calibrated THRESHOLD from artifact**

```bash
node -e "
const c = JSON.parse(require('fs').readFileSync('.bonfire-calibration/2026-05-06-threshold-calibration.json'));
console.log('THRESHOLD:', c.threshold_picked);
"
```

Hard-code this value into the constant in step 3.

- [ ] **Step 2: Write failing tests**

Create `tests/test-ratio-threshold.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareTokens, LAYER_2B_THRESHOLD } = require('../bin/lib/seam-validation.cjs');

test('THRESHOLD is exposed and within fixture-bounded range', () => {
  assert.ok(typeof LAYER_2B_THRESHOLD === 'number');
  assert.ok(LAYER_2B_THRESHOLD > 0.36); // above tagged-correct-but-invents floor
  assert.ok(LAYER_2B_THRESHOLD < 1.0);
});

test('compareTokens returns valid: false for 0% overlap (pure invention)', () => {
  const r = compareTokens('alpha beta gamma', 'completely unrelated text');
  assert.equal(r.valid, false);
  assert.ok(r.overlap_ratio < 0.05);
});

test('compareTokens returns valid: true for high overlap (verbatim)', () => {
  const r = compareTokens('alpha beta gamma delta epsilon', 'alpha beta gamma delta epsilon zeta');
  assert.equal(r.valid, true);
  assert.ok(r.overlap_ratio > LAYER_2B_THRESHOLD);
});

test('A1 CON-* tokens are masked from ratio computation', () => {
  // Slot: 4 substantive tokens + CON-026 (masked) → 4 effective
  // Source: 4 matching tokens + CON-099 (masked) → matches
  const r = compareTokens('alpha beta CON-026 gamma delta', 'alpha beta CON-099 gamma delta');
  assert.equal(r.valid, true);
  assert.equal(r.overlap_ratio, 1.0);
});
```

Run:

```bash
node --test tests/test-ratio-threshold.js
```

Expected: FAIL (LAYER_2B_THRESHOLD not yet exported, current behavior may be zero-orphan returning a different shape).

- [ ] **Step 3: Modify `compareTokens` to ratio-based with calibrated threshold**

In `bin/lib/seam-validation.cjs`:

```javascript
// Spec §3.2.5 — calibrated lower-bias from
// .bonfire-calibration/2026-05-06-threshold-calibration.json
const LAYER_2B_THRESHOLD = <PASTE-CALIBRATED-NUMBER>;  // e.g., 0.37

function compareTokens(slotText, sourceText) {
  const isConRef = (tok) => /^con-\d+$/i.test(tok);
  const slot = extractSubstantiveTokens(slotText).filter(t => !isConRef(t));
  const src = new Set(extractSubstantiveTokens(sourceText).filter(t => !isConRef(t)));
  if (slot.length === 0) {
    return { valid: false, overlap_ratio: 0, reason: 'empty slot' };
  }
  const overlap = slot.filter(t => src.has(t)).length;
  const overlap_ratio = overlap / slot.length;
  return {
    valid: overlap_ratio >= LAYER_2B_THRESHOLD,
    overlap_ratio,
    threshold: LAYER_2B_THRESHOLD,
    matched_tokens: overlap,
    total_tokens: slot.length,
  };
}

module.exports = {
  ...,
  compareTokens,
  LAYER_2B_THRESHOLD,
};
```

- [ ] **Step 4: Run tests to verify pass**

```bash
node --test tests/test-ratio-threshold.js
```

Expected: 4/4 PASS.

- [ ] **Step 5: Run all existing seam-validation tests**

```bash
node --test tests/test-hj-seam-fixtures.js tests/test-hj-seam-foundation.js
```

Some fixtures designed for zero-orphan rule may now misbehave. Triage failures — most should be acceptable behavior changes that the fixture battery work in Tasks 14-18 will reconcile.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-ratio-threshold.js
git commit -m "feat(layer-2b): A3 ratio threshold replaces zero-orphan

Per ASSERTION-4 §3.2 + §3.2.5. THRESHOLD calibrated to <VALUE> via
.bonfire-calibration/2026-05-06-threshold-calibration.json (lower-bias
= floor + ε). Validates against 0% pure-invention fixture (must fail)
+ tagged-correct-but-invents 36% (must fail) + calibrated upper anchor
(must pass).

LAYER_2B_THRESHOLD is exported as a named constant. Future calibration
re-runs that wish to revise it must update both this constant and the
calibration artifact in the same commit.

Existing fixtures that relied on zero-orphan semantics are addressed
in subsequent fixture-battery tasks."
```

---

## Task 7: Layer M validator (M.1 / M.2 disjunction + concrete-ref invariant)

**Files:**
- Modify: `bin/lib/schema.cjs` (add `validateMandate`; route from `validateHandoff`)
- Create: `tests/test-mandate-validator.js`

**Rationale:** Spec §4. Closes vacuous-pass loophole. Most code-heavy task in this plan.

- [ ] **Step 1: Write failing tests covering the §4.2 disjunction**

Create `tests/test-mandate-validator.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateMandate } = require('../bin/lib/schema.cjs');

const minimal_handoff = {
  code_ready: true,
  handoff_summary: 's',
  retained_goal: 'g',
  implementation_scope: ['s'],
  implementation_units: [{
    id: 'UNIT-1',
    name: 'unit',
    files: ['x.js'],
    description: 'd',
    substantive_slot_refs: []
  }],
};

const minimal_snapshot = {
  entries: {
    'CON-001': { id: 'CON-001', status: 'FROZEN', content: 'foo bar baz', aligned_by: [] }
  }
};

test('M FAIL: all units have empty refs AND no escape valve', () => {
  const r = validateMandate(minimal_handoff, minimal_snapshot);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /substantive_slot_refs.*empty/i);
});

test('M.1 PASS: ≥1 unit has non-empty refs with concrete ref', () => {
  const h = { ...minimal_handoff,
    function_contracts: [{ id: 'FC-005', purpose: 'foo bar baz', source_kind: 'ledger_direct', source_ref: 'CON-001' }],
    implementation_units: [{ ...minimal_handoff.implementation_units[0], substantive_slot_refs: ['FC-005'] }]
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, true);
});

test('M.1 FAIL: refs has only supplementary CON-NNN, no concrete', () => {
  const h = { ...minimal_handoff,
    implementation_units: [{ ...minimal_handoff.implementation_units[0], substantive_slot_refs: ['CON-001'] }]
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /concrete ref/i);
});

test('M.2 PASS: no_substantive_contract with valid reason', () => {
  const h = { ...minimal_handoff,
    no_substantive_contract: true,
    no_substantive_contract_reason: 'shell script artifact, see CON-001 (foo bar baz)'
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, true);
});

test('M.2 FAIL: no_substantive_contract reason missing ledger ref', () => {
  const h = { ...minimal_handoff,
    no_substantive_contract: true,
    no_substantive_contract_reason: 'no contracts because it is a script'
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /reason.*ledger reference/i);
});

test('M.2 FAIL: no_substantive_contract reason fails zero-orphan', () => {
  const h = { ...minimal_handoff,
    no_substantive_contract: true,
    no_substantive_contract_reason: 'CON-001: completely unrelated alpha beta gamma'
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /reason.*orphan/i);
});

test('M FAIL: ref points to non-existent slot', () => {
  const h = { ...minimal_handoff,
    function_contracts: [{ id: 'FC-001', source_kind: 'ledger_direct', source_ref: 'CON-001' }],
    implementation_units: [{ ...minimal_handoff.implementation_units[0], substantive_slot_refs: ['FC-999'] }]
  };
  const r = validateMandate(h, minimal_snapshot);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /FC-999.*not found/i);
});
```

Run:

```bash
node --test tests/test-mandate-validator.js
```

Expected: FAIL — function not exported.

- [ ] **Step 2: Implement `validateMandate` in `bin/lib/schema.cjs`**

Read schema params, then:

```javascript
function validateMandate(handoff, snapshot) {
  const errors = [];
  const params = loadSchema().handoff_mandate_params;
  const refField = params.ref_field;
  const concretePatterns = params.concrete_ref_patterns.map(p => new RegExp(p));
  const supplementaryPattern = new RegExp(params.supplementary_ref_pattern);
  const escape = params.escape_valve;

  // M.2 escape valve check first (short-circuit)
  if (handoff[escape.flag] === true) {
    const reason = handoff[escape.reason_field];
    if (typeof reason !== 'string' || reason.length === 0) {
      errors.push(`${escape.flag}=true but ${escape.reason_field} is empty`);
      return { valid: false, errors };
    }
    const refMatch = reason.match(new RegExp(escape.reason_ref_pattern));
    if (!refMatch) {
      errors.push(`${escape.reason_field} must contain a ledger reference (pattern ${escape.reason_ref_pattern})`);
      return { valid: false, errors };
    }
    const refId = refMatch[0];
    const cited = (snapshot.entries || {})[refId];
    if (!cited) {
      errors.push(`${escape.reason_field} cites ${refId} but entry not found in snapshot`);
      return { valid: false, errors };
    }
    // Zero-orphan token coverage against cited entry, excluding the literal id token itself
    const reasonTokens = extractSubstantiveTokens(reason).filter(t => !new RegExp(escape.reason_ref_pattern, 'i').test(t.toUpperCase()));
    const sourceTokens = new Set(extractSubstantiveTokens(cited.content || ''));
    const orphans = reasonTokens.filter(t => !sourceTokens.has(t));
    if (orphans.length > 0) {
      errors.push(`${escape.reason_field} has orphan tokens (zero-orphan rule): ${orphans.join(', ')}`);
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  }

  // M.1 path: at least one unit must have non-empty refs with ≥1 concrete ref
  const units = handoff.implementation_units || [];
  let anyValidUnit = false;
  for (const unit of units) {
    const refs = unit[refField] || [];
    if (refs.length === 0) continue;
    const hasConcrete = refs.some(ref => concretePatterns.some(p => p.test(ref)) || resolveEntityName(ref, handoff));
    if (!hasConcrete) {
      errors.push(`unit ${unit.id} ${refField} contains only supplementary refs; need ≥1 concrete ref (FC-NNN, panel:X, or entity name)`);
      continue;
    }
    // Resolve every ref
    for (const ref of refs) {
      const resolved = resolveRef(ref, handoff);
      if (!resolved) {
        errors.push(`unit ${unit.id}: ref ${ref} not found in any populated substantive slot`);
      }
    }
    if (errors.length === 0) anyValidUnit = true;
  }

  if (!anyValidUnit && errors.length === 0) {
    errors.push(`Layer M: all units have empty substantive_slot_refs and no_substantive_contract is not set`);
  }

  return { valid: errors.length === 0, errors };
}

function resolveRef(ref, handoff) {
  // FC-NNN: lookup in function_contracts
  if (/^FC-\d+$/.test(ref)) {
    return (handoff.function_contracts || []).find(fc => fc.id === ref);
  }
  // panel:X: lookup in ui_contract.panels
  if (/^panel:/.test(ref)) {
    const id = ref.slice(6);
    return (handoff.ui_contract?.panels || []).find(p => p.id === id);
  }
  // CON-NNN / RG-NNN etc: supplementary; resolve to any source_ref in any slot
  if (/^(?:CON|RG|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\d+$/.test(ref)) {
    return findSourceRefInAnySlot(ref, handoff);
  }
  // Otherwise: try entity name
  return resolveEntityName(ref, handoff);
}

function resolveEntityName(name, handoff) {
  return (handoff.domain_model?.entities || []).find(e => e.id === name || e.name === name);
}

function findSourceRefInAnySlot(refId, handoff) {
  const all = [
    ...(handoff.function_contracts || []),
    ...(handoff.domain_model?.entities || []),
    ...(handoff.ui_contract?.panels || [])
  ];
  return all.find(s => s.source_ref === refId);
}
```

Wire from `validateHandoff`:

```javascript
function validateHandoff(compileOutput, context) {
  // ... existing reentry_request / required-fields / provenance checks ...

  // Layer M (new in ASSERTION-4)
  const mandateResult = validateMandate(compileOutput.handoff, context.snapshot);
  if (!mandateResult.valid) {
    return {
      valid: false,
      errors: mandateResult.errors.map(e => `[Layer M] ${e}`),
      conflict_type: 'mandate_failure',
    };
  }

  // ... rest of validation ...
}
```

- [ ] **Step 3: Run tests to verify pass**

```bash
node --test tests/test-mandate-validator.js
```

Expected: 7/7 PASS.

- [ ] **Step 4: Commit**

```bash
git add bin/lib/schema.cjs tests/test-mandate-validator.js
git commit -m "feat(layer-m): mandate validator with M.1/M.2 disjunction

Per ASSERTION-4 §4.2. Layer M closes the vacuous-pass loophole
surfaced by 2026-05-04 dogfood (J could pass validation by omitting
substantive slots).

M.1 path: ≥1 implementation_unit must have non-empty substantive_slot_refs
with at least one concrete ref (FC-NNN, panel:X, or entity name).
Supplementary CON-NNN refs alone do not satisfy.

M.2 escape valve: handoff.no_substantive_contract=true with reason
that (a) cites at least one ledger entry id (pattern match) and
(b) passes zero-orphan token coverage against the cited entry's content.

validateHandoff routed through validateMandate; conflict_type
'mandate_failure' returned on failure (route to stage-j retry-bounded;
see Task 8)."
```

---

## Task 8: Retry-budget mechanism in state-reentry

**Files:**
- Modify: `bin/lib/state.cjs` (`stateReentry` function)
- Modify: `bin/bonfire-tools.cjs` (state-reentry handler)
- Create: `tests/test-retry-budget.js`

**Rationale:** Spec §4.4 + §4.4.1. Per-conflict counter from history (NOT global depth); interaction with global max_depth (hard-stop first, per-conflict within ceiling).

- [ ] **Step 1: Write failing tests**

Create `tests/test-retry-budget.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { stateReentry } = require('../bin/lib/state.cjs');

function setupTempState(reentryHistory) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-budget-'));
  const bonfireDir = path.join(dir, '.bonfire');
  fs.mkdirSync(bonfireDir, { recursive: true });
  fs.writeFileSync(path.join(bonfireDir, 'state.json'), JSON.stringify({
    pipeline_stage: 'plan',
    current_step: 'stage-j',
    steps: { 'stage-j': { status: 'failed', pipeline: 'plan' } },
    reentry: { history: reentryHistory, max_depth: 2 }
  }));
  return dir;
}

test('mandate_failure 1st reentry: depth=1, budget_used=1 → accept', () => {
  const dir = setupTempState([]);
  const result = stateReentry(dir, { conflict_type: 'mandate_failure' });
  assert.equal(result.success, true);
  assert.equal(result.target_stage, 'stage-j');
});

test('mandate_failure 2nd reentry: budget_used=2, retry_budget=2 → accept', () => {
  const dir = setupTempState([{ conflict_type: 'mandate_failure', depth: 1 }]);
  const result = stateReentry(dir, { conflict_type: 'mandate_failure' });
  assert.equal(result.success, true);
  assert.equal(result.target_stage, 'stage-j');
});

test('mandate_failure 3rd reentry: budget_used would be 3, exceeds budget → escalate', () => {
  const dir = setupTempState([
    { conflict_type: 'mandate_failure', depth: 1 },
    { conflict_type: 'mandate_failure', depth: 2 }
  ]);
  // global max_depth=2 already at ceiling; this should also hit hard-stop first
  assert.throws(() => stateReentry(dir, { conflict_type: 'mandate_failure' }), /max_depth|escalat/i);
});

test('global max_depth hits before per-conflict budget', () => {
  const dir = setupTempState([
    { conflict_type: 'handoff_provenance_failure', depth: 1 },
    { conflict_type: 'handoff_provenance_failure', depth: 2 }
  ]);
  // global depth=2; mandate_failure has 0 budget used but global is at ceiling
  assert.throws(() => stateReentry(dir, { conflict_type: 'mandate_failure' }), /max_depth/i);
});
```

- [ ] **Step 2: Modify `stateReentry` in `bin/lib/state.cjs`**

```javascript
function stateReentry(root, opts) {
  const state = loadState(root);
  const { conflict_type } = opts;
  const route = lookupReentryRoute(conflict_type);
  if (!route) throw new Error(`Unknown conflict_type: ${conflict_type}`);

  // Global max_depth check (hard-stop, per spec §4.4.1)
  const history = state.reentry?.history || [];
  const globalDepth = history.length;
  const maxDepth = state.reentry?.max_depth ?? 2;
  if (globalDepth >= maxDepth) {
    throw new Error(`Global reentry max_depth ${maxDepth} reached; halt.`);
  }

  // Per-conflict retry_budget check (within ceiling, per spec §4.4)
  const retryBudget = route.retry_budget; // null = unlimited
  if (retryBudget !== null && retryBudget !== undefined) {
    const usedForThisConflict = history.filter(h => h.conflict_type === conflict_type).length;
    if (usedForThisConflict >= retryBudget) {
      // Escalate to escalation_target_stage
      const escalation = route.escalation_target_stage || 'stage-h';
      writeReentry(state, conflict_type, escalation, globalDepth + 1, /*escalated*/ true);
      saveState(root, state);
      return { success: true, target_stage: escalation, escalated: true, depth: globalDepth + 1 };
    }
  }

  // Normal path: route to target_stage
  writeReentry(state, conflict_type, route.target_stage, globalDepth + 1, /*escalated*/ false);
  resetTargetStage(state, route.target_stage);
  saveState(root, state);

  return { success: true, target_stage: route.target_stage, depth: globalDepth + 1 };
}
```

(`lookupReentryRoute` reads from schema's `reentry_routes` table.)

- [ ] **Step 3: Run tests to verify pass**

```bash
node --test tests/test-retry-budget.js
```

Expected: 4/4 PASS.

- [ ] **Step 4: Commit**

```bash
git add bin/lib/state.cjs tests/test-retry-budget.js
git commit -m "feat(reentry): per-conflict retry budget with max_depth interaction

Per ASSERTION-4 §4.4 + §4.4.1. Counter is per-conflict-type
(filtered from reentry history), NOT global reentry depth.

Interaction order:
1. Global max_depth (hard-stop) → halt
2. Per-conflict retry_budget within ceiling → escalate to
   escalation_target_stage on exhaustion (default stage-h)
3. First-violator-wins

mandate_failure: retry_budget=2, escalation_target_stage=stage-h.
Existing routes default retry_budget=null (unlimited; PR #2 behavior
unchanged).

Logging requirement (per §4.4): each reentry attempt should emit
log-agent event — wired in subsequent task by extending CLI handler."
```

---

## Task 9: Mechanical riders — discard ruling enum + auto-id + supersede msg

**Files:**
- Modify: `bin/lib/delta-parser.cjs` (h-review ruling enum check)
- Modify: `bin/lib/truth-surface.cjs` (`propose` accepts `--id auto`; `supersede` error message)
- Modify: `bin/bonfire-tools.cjs` (parse `--id auto` flag)
- Create: `tests/test-discard-ruling-rejection.js`
- Create: `tests/test-auto-id.js`

**Rationale:** Spec §5.1 + §5.2 + §5.3. Three small additive changes; one commit each for atomicity.

- [ ] **Step 1: discard ruling enum — failing test**

Create `tests/test-discard-ruling-rejection.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDelta } = require('../bin/lib/delta-parser.cjs');

test('h-review delta rejects discard ruling', () => {
  const delta = {
    verdict: 'approved',
    reason: 'fine',
    rulings: [{ action: 'discard', id: 'CON-004' }]
  };
  const r = validateDelta('bonfire-h-review', delta);
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /discard.*not.*freeze.*supersede/i);
});

test('h-review delta accepts freeze ruling', () => {
  const delta = {
    verdict: 'approved',
    reason: 'fine',
    rulings: [{ action: 'freeze', id: 'CON-004' }]
  };
  const r = validateDelta('bonfire-h-review', delta);
  assert.equal(r.valid, true);
});
```

- [ ] **Step 2: discard ruling enum — implement**

In `bin/lib/delta-parser.cjs`, locate the bonfire-h-review validation and add:

```javascript
const allowedRulingActions = constraints.ruling_action_enum || ['freeze', 'supersede'];
for (const [i, ruling] of (delta.rulings || []).entries()) {
  if (!allowedRulingActions.includes(ruling.action)) {
    errors.push(`rulings[${i}].action "${ruling.action}" not in {${allowedRulingActions.join(', ')}}; lifecycle ops (discard) are not valid h-review rulings`);
  }
}
```

Run test: `node --test tests/test-discard-ruling-rejection.js` → 2/2 PASS.

Commit:

```bash
git add bin/lib/delta-parser.cjs tests/test-discard-ruling-rejection.js
git commit -m "feat(delta-parser): h-review ruling enum check (freeze/supersede only)

Per ASSERTION-4 §5.2. Closes the discard-ruling silent-filter gap
surfaced by 2026-05-04 dogfood — H verdict's discard ruling was
no-op'd by apply-h-rulings without warning.

discard belongs to lifecycle ops (truth-discard CLI), not h-review
verdicts. delta-validate now rejects with explicit error message."
```

- [ ] **Step 3: auto-id — failing test**

Create `tests/test-auto-id.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { propose } = require('../bin/lib/truth-surface.cjs');
// ... setup tmp .bonfire dir with snapshot containing CON-001 through CON-014 ...

test('propose --id auto picks next CON-NNN above max', () => {
  // After CON-014 in snapshot
  const result = propose(tmpDir, { id: 'auto', category: 'frozen_constraint', content: 'x', rationale: 'y' });
  assert.equal(result.entries['CON-015'].id, 'CON-015');
});

test('propose --id auto with mixed-prefix snapshot still picks flat CON', () => {
  // Snapshot with CON-001, RISK-005, FC-002 → max numeric tail of CON-* is 1; auto = CON-002
  // ...
});
```

- [ ] **Step 4: auto-id — implement**

In `bin/lib/truth-surface.cjs::propose`:

```javascript
function propose(root, opts) {
  let { id, category, content, rationale, source, notes } = opts;

  if (id === 'auto') {
    const snapshot = loadSnapshot(root) || replay(root);
    const maxConId = Math.max(0, ...Object.keys(snapshot.entries || {})
      .filter(k => /^CON-\d+$/.test(k))
      .map(k => parseInt(k.slice(4), 10)));
    id = `CON-${String(maxConId + 1).padStart(3, '0')}`;
  }

  // ... rest of existing propose logic ...
}
```

In `bin/bonfire-tools.cjs`, ensure `--id auto` is parsed and forwarded as a literal string to propose.

Run test → PASS.

Commit:

```bash
git add bin/lib/truth-surface.cjs bin/bonfire-tools.cjs tests/test-auto-id.js
git commit -m "feat(truth-surface): truth-propose --id auto for flat CON-NNN

Per ASSERTION-4 §5.1 (maturity-assessment row #4). Auto-id picks
next-numeric-id above max CON-NNN in current snapshot. Other prefixes
(RG, FC, RISK, etc.) remain valid as user-supplied ids but are not
auto-generated. ASSERTION-5 B007 owns the broader prefix recommendation
question.

Schema doc footnote pending in ASSERTION-5 B007."
```

- [ ] **Step 5: supersede error message tweak**

In `bin/lib/truth-surface.cjs::supersede`, replace existing error string:

```javascript
throw new Error(
  `supersede: entry "${supersedes}" is ${oldEntry.status}, must be FROZEN.\n` +
  `For CHALLENGED entries: prefer \`truth-update --id ${supersedes} --field aligned_by --value <token>\` (resolves via alignment).\n` +
  `For unwanted entries: use truth-discard then truth-propose the replacement.`
);
```

Add quick assertion test in existing `tests/test-truth-surface.js` (no new file needed — just one test case appended):

```javascript
test('supersede error message mentions align-via-token alternative', () => {
  // ... call supersede on a CHALLENGED entry, catch, assert message contents ...
  assert.throws(
    () => supersede(tmpDir, { supersedes: 'CON-001', id: 'CON-002', category: 'frozen_constraint', content: 'x' }),
    /align.*aligned_by/i
  );
});
```

Commit:

```bash
git add bin/lib/truth-surface.cjs tests/test-truth-surface.js
git commit -m "feat(truth-surface): supersede error message points to align-via-token

Per ASSERTION-4 §5.3 (maturity-assessment row #8). The existing
supersede error was silent about align-via-token as the primary
alternative for CHALLENGED entries; now it surfaces both.

Skill doc update follows in Task 13."
```

---

## Task 10: mandate_failure conflict_type wired through agent prompts

**Files:**
- Modify: `agents/bonfire-j-compile.md`

**Rationale:** Spec §4 + §4.4. J needs to know about substantive_slot_refs as required output, and about no_substantive_contract escape valve, and about mandate_failure reentry behavior so J can self-fix during retry.

- [ ] **Step 1: Add substantive_slot_refs guidance to bonfire-j-compile.md**

In the prompt template's output description, add:

```markdown
## substantive_slot_refs (NEW per ASSERTION-4 Layer M)

For each `implementation_units[N]`, you MUST include a `substantive_slot_refs: string[]` field declaring which substantive slots in your handoff this unit owns/relies on.

**Per-unit invariant:** if non-empty, the array MUST contain ≥ 1 concrete ref:
- `FC-NNN` (function_contracts entry id)
- `panel:<id>` (ui_contract.panels entry id)
- An entity name from `domain_model.entities`

Supplementary refs (CON-NNN, RG-NNN, etc.) may be added but are not sufficient alone.

**Escape valve (rare, for non-typical artifacts):** if your handoff has zero substantive contract surface (e.g., a single shell-script unit), set:
```json
"handoff": {
  "no_substantive_contract": true,
  "no_substantive_contract_reason": "<explanation citing ≥ 1 ledger entry id, with literal token overlap to that entry's content>"
}
```

The reason field must (a) cite a CON-NNN-style ledger reference, AND (b) pass zero-orphan token coverage against the cited entry. Paraphrase will fail; literal restatement of the cited claim is required.

## On reentry from mandate_failure

If validate returns `conflict_type: mandate_failure`, you may be re-dispatched up to 2 times to self-fix. The frozen ledger snapshot is intact — re-read it, populate substantive_slot_refs correctly, and retry. After 2 retries, escalation routes to stage-h.
```

- [ ] **Step 2: Smoke-test by dispatching j-compile in dry-run mode**

(Manual / inspection step — verify the prompt template still parses and the agent definition reloads.)

- [ ] **Step 3: Commit**

```bash
git add agents/bonfire-j-compile.md
git commit -m "docs(agent): bonfire-j-compile mandate awareness

Per ASSERTION-4 §4. Adds substantive_slot_refs requirement +
no_substantive_contract escape valve documentation + mandate_failure
reentry self-fix expectation.

J agent now understands the per-unit invariant (≥1 concrete ref)
and the escape valve constraints (literal restatement only)."
```

---

## Task 11: Fixture — omit-substantive-slots/

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/omit-substantive-slots/`

**Rationale:** Spec §7 fixture #1. Anchors Layer M mandate axis: J handoff with all units `substantive_slot_refs: []` and no escape valve must FAIL validation.

- [ ] **Step 1: Create fixture directory + content**

```bash
mkdir -p tests/fixtures/hj-seam-adversarial/omit-substantive-slots
```

Create `tests/fixtures/hj-seam-adversarial/omit-substantive-slots/README.md`:

```markdown
# omit-substantive-slots

**Anchors:** Layer M mandate axis (M.1 violation).

**Compile-output shape:** All implementation_units have empty `substantive_slot_refs`. No `no_substantive_contract` escape valve set. No populated function_contracts / domain_model / ui_contract slots.

**Expected validation result:** FAIL with `conflict_type: mandate_failure`.

**Why this fixture exists:** This is precisely the bypass pattern the dogfood used to pass validation under PR #2's pre-ASSERTION-4 rules. Layer M closes it.
```

Create `tests/fixtures/hj-seam-adversarial/omit-substantive-slots/compile-output.json`:

```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "Build a hello-world script.",
    "retained_goal": "Print 'hello world' to stdout.",
    "implementation_scope": ["a single hello.js file"],
    "implementation_units": [
      {
        "id": "UNIT-1",
        "name": "hello.js",
        "files": ["hello.js"],
        "description": "console.log hello world",
        "substantive_slot_refs": []
      }
    ]
  }
}
```

Create `tests/fixtures/hj-seam-adversarial/omit-substantive-slots/snapshot.json`:

```json
{
  "version": 1,
  "entries": {
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "content": "Print hello world to stdout.",
      "status": "FROZEN",
      "aligned_by": ["stage-g-survival"]
    }
  }
}
```

- [ ] **Step 2: Add fixture-driven test**

In `tests/test-hj-seam-fixtures.js`, append:

```javascript
test('omit-substantive-slots: fails Layer M with mandate_failure', () => {
  const fixturePath = 'tests/fixtures/hj-seam-adversarial/omit-substantive-slots';
  const compile = JSON.parse(fs.readFileSync(`${fixturePath}/compile-output.json`));
  const snapshot = JSON.parse(fs.readFileSync(`${fixturePath}/snapshot.json`));
  const result = validateHandoff(compile, { snapshot });
  assert.equal(result.valid, false);
  assert.equal(result.conflict_type, 'mandate_failure');
  assert.match(result.errors.join(' '), /Layer M/);
});
```

Run: `node --test tests/test-hj-seam-fixtures.js` → new test PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/omit-substantive-slots/ tests/test-hj-seam-fixtures.js
git commit -m "test(fixture): #1 omit-substantive-slots (Layer M mandate axis pin)

Per ASSERTION-4 §7. This is the exact bypass the 2026-05-04 dogfood
used to pass validation under PR #2 rules. Layer M now rejects it
with conflict_type=mandate_failure."
```

---

## Task 12: Fixtures #3, #4 (condition-index-out-of-range, pure-invention-floor)

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/condition-index-out-of-range/`
- Create: `tests/fixtures/hj-seam-adversarial/pure-invention-floor/`

**Rationale:** Spec §7 fixtures #3 + #4. Ship together because they both anchor Layer 2a/2b boundaries that aren't covered by existing PR #2 fixtures.

- [ ] **Step 1: condition-index-out-of-range — content**

```bash
mkdir -p tests/fixtures/hj-seam-adversarial/condition-index-out-of-range
```

Compile-output uses `source_kind: "condition_rewrite"` with `source_ref: { condition_index: 99 }` referencing an h-review verdict that has only 2 conditions. Expected: Layer 2a fail with index-out-of-range error.

(Full file content omitted here for brevity — coder fills in following the omit-substantive-slots template.)

- [ ] **Step 2: pure-invention-floor — content**

```bash
mkdir -p tests/fixtures/hj-seam-adversarial/pure-invention-floor
```

Compile-output has a populated function_contracts slot whose prose has 0% token overlap with its source ledger entry. Expected: Layer 2b fail.

- [ ] **Step 3: Add fixture-driven tests for both**

Two `test()` blocks in `tests/test-hj-seam-fixtures.js`.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/condition-index-out-of-range/ tests/fixtures/hj-seam-adversarial/pure-invention-floor/ tests/test-hj-seam-fixtures.js
git commit -m "test(fixtures): #3 condition-index-out-of-range + #4 pure-invention-floor

Per ASSERTION-4 §7. #3 anchors Layer 2a condition_rewrite path
boundary check. #4 anchors Layer 2b detection floor (0% overlap).
Together with existing tagged-correct-but-invents (~36%) and
calibrated legitimate-paraphrase-passes (Task 5), the four-fixture
lattice prevents silent threshold drift in any axis-(a) implementation."
```

---

## Task 13: skills/plan/SKILL.md Stage E doc update

**Files:**
- Modify: `skills/plan/SKILL.md` (Stage E section)

**Rationale:** Spec §5.3 row #8. Document align-via-token as primary verb for resolving CHALLENGED entries.

- [ ] **Step 1: Locate Stage E section in skills/plan/SKILL.md**

```bash
grep -n "Stage E" skills/plan/SKILL.md
```

- [ ] **Step 2: Append guidance after the existing Stage E body**

Add a sub-section explaining:

```markdown
### Resolution verbs at Stage E

When a Stage E closure resolves a CHALLENGED entry, prefer **align-via-token** over supersede:

- `truth-update --id <id> --field aligned_by --value <descriptive-token>` — primary
- `truth-supersede` — only when amending an already FROZEN truth (rare in Stage E)

Reason: supersede semantically implies "previously authoritative truth being amended"; align-via-token is "this challenged claim has been answered by X authority". Stage E closures are usually the latter.

Example tokens used in dogfood (illustrative, not prescriptive):
- `stage-e-superseded-by-CON-016` — paraphrase chain (forward-port to a new entry)
- `stage-e-resolution-via-CON-023` — same family
- `stage-e-accept-as-known-limitation-CON-022` — residual acceptance
- `stage-e-mitigate-via-mixed-flag-display` — descriptive forward-port

The `-via-` / `-by-` substring matters: per ASSERTION-4 §3.3.2 it's used to classify aligned_by tokens during Layer 2b calibration.
```

- [ ] **Step 3: Commit**

```bash
git add skills/plan/SKILL.md
git commit -m "docs(skill): Stage E primary verb is align-via-token

Per ASSERTION-4 §5.3. Skill doc previously implied supersede was
primary; the implementation requires FROZEN target which CHALLENGED
entries (the typical Stage E case) are not. Doc now matches reality.

Token shape note explains -via- / -by- substring's role in §3.3.2
calibration outlier exclusion (forward-compat with future B010
codification)."
```

---

## Task 14: Backward-compat regression assertions

**Files:**
- Modify: `tests/test-hj-seam-fixtures.js` (or a new `tests/test-backward-compat.js`)

**Rationale:** Spec §8. Asserts that pre-ASSERTION-4 stage products correctly fail under new rules. Positive guard — proves intended-fail is happening.

- [ ] **Step 1: Add test asserting gto-trainer compile-output now fails**

```javascript
test('gto-trainer dogfood compile-output.json fails Layer M (intended)', () => {
  const compile = JSON.parse(fs.readFileSync(
    '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/plan/compile-output.json'
  ));
  const snapshot = JSON.parse(fs.readFileSync(
    '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json'
  ));
  const r = validateHandoff(compile, { snapshot });
  assert.equal(r.valid, false);
  assert.equal(r.conflict_type, 'mandate_failure');
});

test('gto-trainer h-review-verdict.json discard ruling fails delta-validate (intended)', () => {
  const verdict = JSON.parse(fs.readFileSync(
    '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/plan/h-review-verdict.json'
  ));
  const r = validateDelta('bonfire-h-review', verdict);
  assert.equal(r.valid, false);
  assert.match(r.errors.join(' '), /discard.*not.*freeze.*supersede/i);
});
```

- [ ] **Step 2: Run tests**

```bash
node --test tests/test-hj-seam-fixtures.js
```

Both new assertions PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test-hj-seam-fixtures.js
git commit -m "test(backward-compat): pre-ASSERTION-4 dogfood artifacts now fail

Per ASSERTION-4 §8. Positive regression assertions:
- gto-trainer compile-output.json (no substantive_slot_refs, no escape
  valve) fails Layer M with mandate_failure
- gto-trainer h-review-verdict.json (discard ruling) fails delta-validate

BREAKING per spec §8 — intended behavior. Documents the legacy-failure
posture in test form so any future regression that accidentally accepts
these legacy artifacts is caught."
```

---

## Task 15: Full suite verification + reinstall

**Files:**
- (none directly — runs all tests)

**Rationale:** Final integration — all changes together, plus refresh `$HOME/.claude/bonfire/` install so dogfood / next bonfire run uses ASSERTION-4 code.

- [ ] **Step 1: Run full test suite**

```bash
node --test tests/
```

Expected: all PASS.

- [ ] **Step 2: Re-run install.sh**

```bash
bash install.sh
```

Expected: install completes, `bonfire-tools.cjs` now lists new flags / commands as expected.

- [ ] **Step 3: Smoke-test end-to-end**

Run a small bonfire pipeline end-to-end (or verify existing tests cover the integration). At minimum:

```bash
node $HOME/.claude/bonfire/bin/bonfire-tools.cjs handoff-validate --help 2>&1 | head -5
# (No --help support — just verify CLI loads without error)

node $HOME/.claude/bonfire/bin/bonfire-tools.cjs 2>&1 | grep -E "stage-g-freeze-gate|apply-h-rulings|truth-propose"
# All three should appear; no command was removed
```

- [ ] **Step 4: Final commit (if any cleanup or formatting touched files)**

```bash
git status
# If only tracked files changed: review and commit
# If clean: skip
```

---

## Self-review checklist

After all tasks complete, run:

1. **Spec coverage scan:** for each row in maturity-assessment in-scope set (#1, #2, #4, #5, #8) + each spec section §3-§8, point to the task that implemented it. List any gaps.

   - §3.1 A1 → Task 2 ✓
   - §3.2 A3 → Task 6 ✓
   - §3.2.5 lower-bias → Task 6 (constant value derived per §3.2.5) ✓
   - §3.3 calibration → Task 4 ✓
   - §3.3.1 5th percentile → Task 4 (analyze.js script) ✓
   - §3.3.2 substring rule → Task 3 ✓
   - §3.3.3 failure paths → Task 4 (calibration kill criteria) ✓
   - §4.1 substantive_slot_refs + concrete invariant → Task 7 ✓
   - §4.2 M.1/M.2 disjunction → Task 7 ✓
   - §4.3 ref resolution → Task 7 ✓
   - §4.4 mandate_failure routing → Task 1 (schema) + Task 8 (mechanics) + Task 10 (agent) ✓
   - §4.4.1 max_depth interaction → Task 8 ✓
   - §5.1 auto-id → Task 9 step 3-4 ✓
   - §5.2 ruling enum → Task 9 step 1-2 ✓
   - §5.3 supersede msg + skill doc → Task 9 step 5 + Task 13 ✓
   - §6 schema → Task 1 ✓
   - §7 fixtures → Tasks 5, 11, 12 ✓
   - §8 backward-compat regression → Task 14 ✓
   - §11 test plan → all tasks emit tests ✓

2. **Placeholder scan:** search plan for "TBD", "TODO", "fill in" — fix any.

3. **Type consistency:** verify substantive_slot_refs / concrete_ref_patterns / ref_field naming is consistent across spec, schema, validator, agent prompt.

4. **Calibration kill-criterion handling:** verify Task 4 step 5's failure paths route to errata + maturity-assessment v2 (not silent acceptance).

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-06-bonfire-assertion-4-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Controller dispatches one subagent per task, two-stage review (spec compliance + code quality) between tasks, fast iteration in same session. Best for this plan because: 14 of 15 tasks are independent; subagent context per task is clean; calibration step (Task 4) is the only multi-step interactive task that benefits from controller oversight.

**2. Inline Execution** — Execute tasks sequentially in current session. Slower but no agent spawn overhead. Best if you want to inspect each commit live.

**Which approach?**
