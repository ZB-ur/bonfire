# ASSERTION-4 Round-4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #2's binary `orphans.length > 0` Layer 2b reject (currently at `bin/lib/schema.cjs:181`) with `max_contiguous_orphan_run > threshold` reject_when, with provisional threshold=30 from N=1 archive empirical baseline (per round-4 v0.1 spec §5+§6).

**Architecture:** Single-metric Layer 2b reject path. Helper module `bin/lib/seam-validation.cjs` adds `maxContiguousOrphanRun` (parallel to existing `compareTokens`); reject decision in `bin/lib/schema.cjs` reads schema config `layer_2b_calibration` for threshold; `overlap_ratio` (round-3 metric class) retained as telemetry-only. Backward-compat audit ensures existing fixtures behave as expected under more-permissive round-4 reject.

**Tech Stack:** CommonJS Node.js, `node:test` + `node:assert/strict`. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-10-bonfire-assertion-4-round-4-design.md` (v0.1 frozen at HEAD `15b84d1` as-amended).

**Empirical anchor:** `docs/superpowers/evidence/2026-05-10-round-4-data/gto-trainer-distribution.json` (Stage 0 9-slot legit corpus, p75=25, max_contiguous range 10-35).

---

## File Structure

| File | Role | Round-4 change |
|---|---|---|
| `bin/lib/seam-validation.cjs` | Layer 2b helpers | Add `maxContiguousOrphanRun(slotTokens, sourceText)` after existing `compareTokens` |
| `schemas/bonfire-v1.json` | Schema definitions | Add new top-level `layer_2b_calibration` section per spec §6.1 |
| `bin/lib/schema.cjs` | Layer 2b walk + reject decision (co-located with Layer 2a + 3a deep-check per 3a Phase 2 architecture) | Replace `orphans.length > 0` reject at line ~181 with `maxContiguousOrphanRun > threshold`; retain `compareTokens` call for `overlap_ratio` telemetry-only computation |
| `tests/test-seam-validation.js` | Helper unit tests | Append unit tests for `maxContiguousOrphanRun` |
| `tests/test-archive-replay.js` | Archive replay regression matrix (3a Phase 5 origin) | Extend with round-4 acceptance: CON-036 reject + 8/9 corpus-pass under threshold=30 |
| `tests/fixtures/hj-seam-adversarial/*` | Existing adversarial fixtures | Backward-compat audit: identify fixtures whose expected behavior depends on PR #2 binary reject; adjust expectations or fixtures under round-4 threshold |
| `tests/test-hj-seam-fixtures.js` | Fixture-driven integration | Adjust test expectations per Task 5 audit findings |

---

## Task 1: Helper `maxContiguousOrphanRun` in seam-validation.cjs

**Files:**
- Modify: `bin/lib/seam-validation.cjs` (append helper after `compareTokens` at line ~275)
- Modify: `tests/test-seam-validation.js` (append unit tests; verify file exists first)

**Spec ref:** §5 Mechanism per-slot metric computation pseudocode.

- [ ] **Step 1.1: Read existing `compareTokens` for tokenization conventions**

Read `bin/lib/seam-validation.cjs` lines 237-275 (the `compareTokens` function). Note the conventions:
- Tokens already lowercased by `extractSubstantiveTokens`
- CON-* refs are filtered via `/^con-\d+$/i` and ignored in run computation
- `lemmatizeToken` is applied for stemming
- Source text tokens are bag (Set), slot text tokens are ordered list

`maxContiguousOrphanRun` must mirror these conventions — same tokenization, same CON-* filter, same lemmatization, but compute max contiguous run of orphans rather than total orphan list.

- [ ] **Step 1.2: Write failing test for `maxContiguousOrphanRun`**

Verify `tests/test-seam-validation.js` exists. If it does, append. If not, the test file location may differ — `grep -n "function compareTokens\|describe\|test('" tests/test-seam-validation.js` to confirm or use an alternative file.

Append to `tests/test-seam-validation.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maxContiguousOrphanRun } = require('../bin/lib/seam-validation.cjs');

test('maxContiguousOrphanRun returns 0 for empty slot tokens', () => {
  assert.equal(maxContiguousOrphanRun([], 'source text'), 0);
});

test('maxContiguousOrphanRun returns 0 when all slot tokens overlap source', () => {
  assert.equal(maxContiguousOrphanRun(['hello', 'world'], 'hello world'), 0);
});

test('maxContiguousOrphanRun returns slot length when all tokens are orphans', () => {
  assert.equal(maxContiguousOrphanRun(['foo', 'bar', 'baz'], 'unrelated text'), 3);
});

test('maxContiguousOrphanRun handles mixed sequence — single 3-token burst', () => {
  // slot tokens: [in, source, foo, bar, baz, in]; orphans: foo, bar, baz (3 contiguous)
  assert.equal(maxContiguousOrphanRun(['in', 'source', 'foo', 'bar', 'baz', 'in'], 'in source'), 3);
});

test('maxContiguousOrphanRun resets run counter on overlap token', () => {
  // [foo, bar, in, baz, qux] orphans: foo bar (run 2), baz qux (run 2); max=2
  assert.equal(maxContiguousOrphanRun(['foo', 'bar', 'in', 'baz', 'qux'], 'in'), 2);
});

test('maxContiguousOrphanRun ignores CON-* refs (resets current run; CON-* is scaffolding gap)', () => {
  // [foo, CON-001, bar] — CON-001 resets run (breaks contiguous orphan sequence)
  // per spec §5 pseudocode. Run counts: foo (run=1, max=1), CON-001 reset, bar (run=1)
  // → max=1
  assert.equal(maxContiguousOrphanRun(['foo', 'CON-001', 'bar'], 'unrelated'), 1);
});

test('maxContiguousOrphanRun is case-insensitive on CON-* refs', () => {
  assert.equal(maxContiguousOrphanRun(['foo', 'con-002', 'bar'], 'unrelated'), 1);
});

test('maxContiguousOrphanRun selects the LONGER of multiple orphan runs', () => {
  // slot: [a, b, c, in, d, e, f, g, h, in, i] — orphan runs: 3 (abc), 5 (defgh), 1 (i)
  assert.equal(maxContiguousOrphanRun(['a', 'b', 'c', 'in', 'd', 'e', 'f', 'g', 'h', 'in', 'i'], 'in'), 5);
});
```

- [ ] **Step 1.3: Run test to verify failure**

Run: `node --test tests/test-seam-validation.js`
Expected: FAIL — `maxContiguousOrphanRun` not exported from seam-validation.cjs.

- [ ] **Step 1.4: Implement `maxContiguousOrphanRun` in seam-validation.cjs**

Edit `bin/lib/seam-validation.cjs`. Insert after the `compareTokens` function ends (function spans ~lines 240-276; locate the function's closing `}` via `grep -n "^function compareTokens\|^function classifyAlignedByToken" bin/lib/seam-validation.cjs` to confirm exact range), and before the `module.exports` block (currently at line ~317).

**Per spec §5: RAW comparison, NOT lemmatization.** compareTokens (PR #2 Layer 2b foundation) applies `lemmatizeToken` because PR #2's binary `orphans.length > 0` reject benefits from lemma-aware matching to reduce noise. Round-4's threshold metric is anchored to Stage 0 calibration baseline computed WITHOUT lemma (gto-trainer 9-slot corpus, CON-036 max_run=35 per `docs/superpowers/evidence/2026-05-10-round-4-data/gto-trainer-distribution.json`). Applying lemma in round-4 metric would invalidate the calibration baseline (CON-036 max_run drops to 28; spec §8 acceptance criterion would fail). DO NOT call `lemmatizeToken` in this helper. Membership check uses raw `extractSubstantiveTokens` output directly:

```javascript
// ---------------------------------------------------------------------------
// maxContiguousOrphanRun — Layer 2b round-4 metric (per ASSERTION-4 round-4
// spec §5). Computes the longest contiguous run of orphan tokens in slot
// (i.e., tokens NOT present in source content tokens), preserving slot
// token order. CON-* refs reset the current run (breaks contiguous orphan
// sequence) per spec §5 pseudocode. Round-4 primary reject_when metric.
//
// Orphan = slot token not in extractSubstantiveTokens(sourceText) bag.
//
// Per spec §5 (raw comparison; NOT lemmatization): membership check uses
// raw extractSubstantiveTokens output without lemma stemming. This anchors
// to Stage 0 calibration baseline. compareTokens (PR #2 Layer 2b foundation)
// applies lemmatization for binary orphans-presence reject; round-4's
// threshold metric uses raw to preserve Stage 0 calibration validity.
// ---------------------------------------------------------------------------
function maxContiguousOrphanRun(slotTokens, sourceText) {
  const sourceTokens = extractSubstantiveTokens(sourceText || '');
  const sourceSet = new Set(sourceTokens);
  let maxRun = 0;
  let currentRun = 0;
  for (const raw of (slotTokens || [])) {
    const tok = (raw || '').toString().toLowerCase();
    if (/^con-\d+$/i.test(tok)) {
      // CON-* refs: reset current run per spec §5 pseudocode (orphan_run = 0;
      // continue). Equivalent to a "gap" in the slot token sequence — CON-*
      // is scaffolding, not orphan content, so it terminates any preceding
      // orphan run.
      currentRun = 0;
      continue;
    }
    if (sourceSet.has(tok)) {
      currentRun = 0;
    } else {
      currentRun += 1;
      if (currentRun > maxRun) maxRun = currentRun;
    }
  }
  return maxRun;
}
```

Update `module.exports` block (currently around line 317-328) to include the new helper:

```diff
 module.exports = {
   loadFormatWhitelist,
   extractSubstantiveTokens,
   lemmatizeToken,
   isCJKToken,
   buildFrozenTokenVocabulary,
   validateHConditions,
   compareTokens,
+  maxContiguousOrphanRun,
   classifyAlignedByToken,
 };
```

- [ ] **Step 1.5: Run tests to verify pass**

Run: `node --test tests/test-seam-validation.js`
Expected: PASS — 8 new tests + all existing tests green.

- [ ] **Step 1.6: Run full test suite (regression sanity)**

Run: `node --test tests/*.js | tail -5`
Expected: 293 + 8 = 301 tests pass, 0 fail.

- [ ] **Step 1.7: Run install.sh to deploy**

Run: `bash install.sh`
Verify: `grep -c "maxContiguousOrphanRun" $HOME/.claude/bonfire/bin/lib/seam-validation.cjs` → `≥ 2` (definition + export).

- [ ] **Step 1.8: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-seam-validation.js
git commit -m "feat(round-4): add maxContiguousOrphanRun helper to seam-validation

Round-4 metric class candidate per ASSERTION-4 round-4 spec §5: computes
longest contiguous run of orphan tokens in slot text (orphans = tokens not
in source content). Mirrors compareTokens conventions: CON-* refs skip
(no run extension, no reset); lemmatization applied; tokens lowercased.

Helper isolated in seam-validation.cjs alongside compareTokens. Layer 2b
reject migration in schema.cjs comes in Task 3 (replaces orphans.length>0
binary with maxContiguousOrphanRun > threshold).

8 new unit tests cover: empty slot, all-overlap, all-orphan, single burst,
overlap-resets-run, CON-* skip, case-insensitive CON-*, longest-run-wins.

spec: round-4 v0.1 §5 + §6.1; empirical anchor:
docs/superpowers/evidence/2026-05-10-round-4-data/."
```

---

## Task 2: Schema addition — `layer_2b_calibration` config

**Files:**
- Modify: `schemas/bonfire-v1.json` (add new top-level section per spec §6.1 v0.1 schema)

**Spec ref:** §6.1 schema-driven configuration; source-of-truth contract binding.

- [ ] **Step 2.1: Find insertion point in schema**

Run: `grep -n "^  \"verdict_substantive_check\"\|^  \"handoff_substantive_slots\"\|^  \"handoff_mandate_params\"" schemas/bonfire-v1.json | head -5`

Expected: line numbers for top-level sibling sections. The new `layer_2b_calibration` section goes alongside these as a top-level sibling. A reasonable position is immediately after `verdict_substantive_check` (3a Phase 4 addition) and before `handoff_mandate_params`. Adjust based on actual file structure.

- [ ] **Step 2.2: Add `layer_2b_calibration` section**

Edit `schemas/bonfire-v1.json`. Insert the section per spec §6.1 v0.1 schema:

```json
"layer_2b_calibration": {
  "version": 1,
  "metric_class": "max_contiguous_orphan_run",
  "telemetry_metrics": ["overlap_ratio"],
  "threshold_provisional": 30,
  "threshold_status": "provisional",
  "p75_baseline": 25,
  "safety_margin_pct": 20,
  "aggregation_method": "median_per_archive_p75",
  "revisability_delta_pct": 25,
  "min_slots_per_archive": 5,
  "calibration_corpus_anchor": "gto-trainer-2026-05-04 N=1"
},
```

(Note the trailing comma if inserting before `handoff_mandate_params`.)

- [ ] **Step 2.3: Verify JSON valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 2.4: Verify source-of-truth consistency at schema level**

Per spec §6.1 source-of-truth binding: `threshold_provisional == round(p75_baseline × (1 + safety_margin_pct / 100))`. Verify:

```bash
node -e "
const s = JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8'));
const c = s.layer_2b_calibration;
const expected = Math.round(c.p75_baseline * (1 + c.safety_margin_pct / 100));
if (c.threshold_provisional !== expected) {
  console.error('SOURCE-OF-TRUTH DRIFT: threshold_provisional=' + c.threshold_provisional + ' expected=' + expected);
  process.exit(1);
}
console.log('source-of-truth consistent: ' + c.threshold_provisional + ' = round(' + c.p75_baseline + ' × ' + (1 + c.safety_margin_pct/100) + ')');
"
```

Expected: `source-of-truth consistent: 30 = round(25 × 1.2)`.

- [ ] **Step 2.5: Run install.sh + verify deployed**

Run: `bash install.sh`
Verify:
```bash
grep -c "layer_2b_calibration" $HOME/.claude/bonfire/schemas/bonfire-v1.json
```
Expected: `1`.

- [ ] **Step 2.6: Run full test suite (regression sanity)**

Run: `node --test tests/*.js | tail -5`
Expected: 301 tests pass (no test changes; schema addition is data-only).

- [ ] **Step 2.7: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "feat(round-4): add layer_2b_calibration schema config

Per ASSERTION-4 round-4 spec §6.1 (schema-driven configuration committed):
new top-level layer_2b_calibration section in schemas/bonfire-v1.json
with v0.1 calibration parameters:
- metric_class: max_contiguous_orphan_run
- threshold_provisional: 30 (p75=25 + 20% safety_margin, per spec §6.2)
- threshold_status: provisional (N=1 archive baseline; ≥2-archive
  validation per spec §6.5)
- aggregation_method: median_per_archive_p75 (cost-asymmetry-aligned)
- revisability_delta_pct: 25 (Q5 generic revisability trigger)
- min_slots_per_archive: 5 (B010 minimum contribution)
- calibration_corpus_anchor: gto-trainer-2026-05-04 N=1

Source-of-truth contract: p75_baseline + safety_margin_pct are canonical;
threshold_provisional is convenience-cached derived. Schema PR amendments
must update both atomically. (See spec §6.1 source-of-truth binding.)

Schema config consumer is bin/lib/schema.cjs Layer 2b walk + reject (per
Task 3); helper functions (compareTokens, maxContiguousOrphanRun from
Task 1) live in seam-validation.cjs.

spec: round-4 v0.1 §6.1 + §6.2."
```

---

## Task 3: schema.cjs Layer 2b reject migration (most substantive)

**Files:**
- Modify: `bin/lib/schema.cjs` (replace reject decision at line ~181; existing extraction logic retained for telemetry)

**Spec ref:** §5 Mechanism (REPLACES PR #2 binary); §6.4 reject formula; §11 Risk 5 (migration risk).

This task is the **most substantive code change**. It removes PR #2's binary `orphans.length > 0` reject and replaces with `maxContiguousOrphanRun > threshold` reject reading from schema config. `overlap_ratio` is computed as telemetry-only (no enforcement; logged for future analysis).

- [ ] **Step 3.1: Read current Layer 2b reject site**

Read `bin/lib/schema.cjs` lines 170-190 to confirm:
- Current reject site at ~line 181: `if (orphans.length > 0) errors.push(...)`
- `compareTokens` is imported at line ~178
- `extractEntryTokens` returns slot tokens
- `sourceText` is the source content (from snapshot entry or condition text)

The wider function context (likely a per-slot helper called by `validateProvenance` line 80) takes `entry`, `slotConfig`, `sourceText`, `kind`, `ref`, `pathLabel`, `errors`. Round-4 changes only the reject decision logic at line ~181, leaving extraction + comparison helpers intact.

- [ ] **Step 3.2: Confirm schema config accessibility**

Run: `grep -n "loadSchema\|require.*schema\|const schema =" bin/lib/schema.cjs | head -10`

Determine how schema config is currently loaded in this file (or by callers). If `loadSchema` is already imported, use it. If not, the function may receive `context` parameter that includes schema; check function signature.

If neither path is available cleanly, add `const { loadSchema } = require('./utils.cjs');` at top of `schema.cjs` and call `loadSchema()` inside the Layer 2b function. Mirror 3a Phase 2 pattern (deepCheckHandoffSubstantiveSlots receives `schema` as parameter).

- [ ] **Step 3.3: Write failing test for round-4 reject behavior**

Append to `tests/test-handoff-token-coverage.js` (the existing Layer 2b test file; verify location with `ls tests/test-handoff-token-coverage.js` first; if absent, use `tests/test-seam-validation.js` or extend `tests/test-archive-replay.js`):

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateHandoff } = require('../bin/lib/schema.cjs');

test('round-4 Layer 2b: slot with max_run > 30 rejects', () => {
  // Construct a handoff slot with a long contiguous orphan run
  const compileOutput = {
    handoff: {
      code_ready: true,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'unit-1' }],
      function_contracts: [{
        id: 'FC-001',
        // 35-token orphan run (contrived; exceeds threshold=30)
        purpose: 'aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp qqq rrr sss ttt uuu vvv www xxx yyy zzz aab bbc ccd dde eef ffg ggh hhi iij',
        invariants: [],
        failure_modes: [],
        source_kind: 'ledger_direct',
        source_ref: 'CON-FAKE',
      }],
    },
  };
  const context = {
    snapshot: { entries: { 'CON-FAKE': { id: 'CON-FAKE', status: 'FROZEN', content: 'short ledger entry' } } },
    conditions: [],
  };
  const result = validateHandoff(compileOutput, context);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(e => /max_contiguous_orphan_run|threshold/.test(e)),
    `expected max_contiguous threshold rejection, got: ${result.errors.join('; ')}`
  );
});

test('round-4 Layer 2b: slot with max_run ≤ 30 passes', () => {
  // Construct a handoff slot with all orphan runs ≤ 25 (well below threshold)
  const compileOutput = {
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
  const context = {
    snapshot: { entries: { 'CON-LEGIT': { id: 'CON-LEGIT', status: 'FROZEN', content: 'short ledger entry' } } },
    conditions: [],
  };
  const result = validateHandoff(compileOutput, context);
  // May still fail other validations (provenance, etc.) but should NOT fail
  // for max_contiguous_orphan_run reason.
  if (!result.valid) {
    assert.ok(
      !result.errors.some(e => /max_contiguous_orphan_run|threshold/.test(e)),
      `unexpected max_contiguous threshold rejection on legit slot: ${result.errors.join('; ')}`
    );
  }
});
```

- [ ] **Step 3.4: Run test to verify failure**

Run: `node --test tests/test-handoff-token-coverage.js`
Expected: FAIL — round-4 reject not yet implemented; current code uses binary `orphans.length > 0` which would still reject (or pass depending on construction).

The test "max_run > 30 rejects" should FAIL with binary path because the test text was contrived to have ALL orphans (35 tokens, none in "short ledger entry"). Binary would reject because orphans.length=35>0 — but the error message wouldn't mention `max_contiguous_orphan_run|threshold`, so the assert.match would fail.

The test "max_run ≤ 30 passes" should FAIL with binary path because the test text has orphans ("plus one two three four five extra orphan tokens" = 9 orphans), so binary rejects despite max_run being only 9.

Both tests demonstrate the migration need. Failure is confirmation.

- [ ] **Step 3.5: Replace reject decision in schema.cjs**

Edit `bin/lib/schema.cjs` lines ~178-185. Current code:

```javascript
const { compareTokens } = require('./seam-validation.cjs');
const slotTokens = extractEntryTokens(entry, slotConfig);
const orphans = compareTokens(slotTokens, sourceText);
if (orphans.length > 0) {
  const preview = orphans.slice(0, 10).join(', ');
  const more = orphans.length > 10 ? ` (+${orphans.length - 10} more)` : '';
  errors.push(`${pathLabel}: orphan tokens not in source (${kind}=${JSON.stringify(ref)}): ${preview}${more}`);
}
```

Replace with:

```javascript
const { compareTokens, maxContiguousOrphanRun } = require('./seam-validation.cjs');
const slotTokens = extractEntryTokens(entry, slotConfig);

// Telemetry: compute compareTokens orphans (and overlap_ratio derivable from them).
// NOT used in reject decision per round-4 spec §5; retained for future analysis
// and Q5 reverse-amendment trigger (per spec §6.4).
const orphans = compareTokens(slotTokens, sourceText);
const totalNonRef = slotTokens.filter(t => !/^con-\d+$/i.test((t || '').toString())).length;
const overlapRatio = totalNonRef === 0 ? 0 : (totalNonRef - orphans.length) / totalNonRef;
// Per spec §5 v0.1: telemetry is compute-only — no runtime persistence layer.
// If post-deployment telemetry consumer materializes (e.g., automated cross-
// archive trend detection per Q5 §6.4 trigger 1), persistence is amend-able
// via schema PR + code amendment. v0.1 does not pre-build that infrastructure.

// Round-4 reject: max_contiguous_orphan_run > threshold (per spec §5 + §6.2).
const calib = (schema && schema.layer_2b_calibration) || null;
if (calib && typeof calib.threshold_provisional === 'number') {
  // Source-of-truth assertion (per spec §6.1): warn on drift.
  const expected = Math.round(calib.p75_baseline * (1 + calib.safety_margin_pct / 100));
  if (calib.threshold_provisional !== expected) {
    process.stderr.write(
      `[layer_2b_calibration] WARN: threshold_provisional=${calib.threshold_provisional} ` +
      `differs from derived ${expected} (p75_baseline=${calib.p75_baseline} × ` +
      `(1 + ${calib.safety_margin_pct}/100)). Schema PR may have updated baseline ` +
      `without atomic threshold update; see spec §6.1 source-of-truth contract.\n`
    );
  }
  const maxRun = maxContiguousOrphanRun(slotTokens, sourceText);
  if (maxRun > calib.threshold_provisional) {
    errors.push(
      `${pathLabel}: max_contiguous_orphan_run=${maxRun} > threshold=${calib.threshold_provisional} ` +
      `(${kind}=${JSON.stringify(ref)}; metric_class=${calib.metric_class}; ` +
      `threshold_status=${calib.threshold_status})`
    );
  }
}
// Note: if calib is absent (schema not v2-round-4), Layer 2b reject is SILENT
// (no rejection). This is defensive: handoff still passes Layer 2a + 3a checks.
// Schema PR landing layer_2b_calibration is required to activate round-4 reject.
```

If `schema` is not in scope at this function point, load it: `const schema = (context && context.schema) || require('./utils.cjs').loadSchema();` near the top of the function, or add `schema` to the function's parameter list.

- [ ] **Step 3.6: Run test to verify pass**

Run: `node --test tests/test-handoff-token-coverage.js`
Expected: PASS — both round-4 tests green; existing tests may break (see Step 3.7).

- [ ] **Step 3.7: Run full test suite to identify backward-compat breakage**

Run: `node --test tests/*.js 2>&1 | tail -20`

**Expected:** Some pre-existing tests likely FAIL because round-4 reject is more permissive than PR #2 binary reject. Specifically:
- Tests that depended on "any orphan rejects" to validate adversarial fixtures may now PASS unexpectedly (slot was rejected by binary, now passes threshold).
- Test fixtures that relied on Layer 2b strict catch may need adjustment.

Identify failing tests; record in a list for Task 5 (backward-compat audit). Do NOT fix in this commit — Task 5 owns the audit. Round-4 reject behavior is correct per spec; it's the test expectations that need re-examination.

If the failure count is large (>10), pause and surface to architect — may indicate test-suite restructuring needed.

- [ ] **Step 3.8: Commit (with broken-tests acknowledgment)**

```bash
git add bin/lib/schema.cjs tests/test-handoff-token-coverage.js
git commit -m "feat(round-4): replace Layer 2b binary reject with threshold reject

Round-4 implements ASSERTION-4 round-4 spec §5: replaces PR #2's binary
'orphans.length > 0' reject at schema.cjs:181 with
'maxContiguousOrphanRun > threshold' reject. Threshold read from
schema.layer_2b_calibration.threshold_provisional (=30 v0.1 per Task 2).

Behavior change:
- Before: any single orphan token in slot triggers Layer 2b rejection
  (PR #2 binary; super-strict, dogfood-2026-05-04 finding #1 documented
  ~200 false-positive orphans on legit prose)
- After: only contiguous orphan runs > threshold (=30) trigger rejection
  (round-4 burst-shape detection; cost-asymmetry-aligned conservative
  threshold per spec §6.2 + Stage 0 9-slot empirical baseline)

overlap_ratio retained as telemetry-only compute (no enforcement, per
spec §5); useful for future amendment if Q5 §6.4 trigger fires on
sprinkled-invention pattern.

Source-of-truth assertion at load time (per spec §6.1): warns on
threshold_provisional vs derived round(p75_baseline × (1+safety_margin_pct/
100)) drift. Defensive against schema PR amending baseline without atomic
threshold update.

If schema config absent (pre-round-4 schema), Layer 2b reject is silent
(no rejection). Round-4 activation requires layer_2b_calibration deployed
(Task 2 prerequisite).

KNOWN BREAKAGE: existing tests may fail because round-4 reject is more
permissive than PR #2 binary reject. Backward-compat audit in Task 5
re-examines test expectations and fixture validity under new metric.

spec: round-4 v0.1 §5 + §6.1 + §6.2 + §11 Risk 5."
```

---

## Task 4: Acceptance test extension on archive replay

**Files:**
- Modify: `tests/test-archive-replay.js` (extend with round-4 assertions per spec §8)

**Spec ref:** §8 acceptance criteria (CON-036 reject + 8 of 9 corpus-pass).

- [ ] **Step 4.1: Read current test-archive-replay.js**

Read full file to understand the existing structure (3a Phase 5 commits at `ca953bc` shipped 2 bilibili tests + wrapper-unwrap pattern). Locate where to insert round-4 assertions.

- [ ] **Step 4.2: Write failing test for round-4 acceptance — CON-036 reject**

Append to `tests/test-archive-replay.js`:

```javascript
const path = require('path');
// Reuse existing imports + add:
const { maxContiguousOrphanRun } = require('../bin/lib/seam-validation.cjs');

const ROUND4_DATA = path.join(__dirname, '..', 'docs', 'superpowers', 'evidence', '2026-05-10-round-4-data', 'gto-trainer-distribution.json');

test('round-4 acceptance: CON-036 ui_panel rejects under threshold=30 (per spec §8 + outlier-edge anchor)', () => {
  if (!require('fs').existsSync(ROUND4_DATA)) {
    // Skip if Stage 0 data not present (preserves test isolation)
    return;
  }
  const dist = JSON.parse(require('fs').readFileSync(ROUND4_DATA, 'utf8'));
  const con036 = dist.per_slot.find(s => s.ref === 'CON-036' && s.slot_kind === 'ui_panel');
  assert.ok(con036, 'CON-036 ui_panel slot not found in distribution');
  // Per spec §8 fixture: max_contiguous_orphan_run=35 > threshold=30 → reject.
  assert.equal(con036.max_contiguous_orphan_run, 35, 'CON-036 max_run should be 35 (Stage 0 empirical)');
  const SCHEMA = JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = SCHEMA.layer_2b_calibration;
  assert.ok(calib, 'schemas/bonfire-v1.json missing layer_2b_calibration (Task 2)');
  assert.ok(con036.max_contiguous_orphan_run > calib.threshold_provisional,
    `CON-036 max_run=${con036.max_contiguous_orphan_run} should exceed threshold=${calib.threshold_provisional}`);
});

test('round-4 acceptance: 8 of 9 gto-trainer non-outlier slots pass under threshold=30 (per spec §8 corpus-aggregate)', () => {
  if (!require('fs').existsSync(ROUND4_DATA)) {
    return;
  }
  const dist = JSON.parse(require('fs').readFileSync(ROUND4_DATA, 'utf8'));
  const SCHEMA = JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = SCHEMA.layer_2b_calibration;
  const threshold = calib.threshold_provisional;
  const passing = dist.per_slot.filter(s => s.max_contiguous_orphan_run <= threshold);
  const rejecting = dist.per_slot.filter(s => s.max_contiguous_orphan_run > threshold);
  assert.equal(passing.length, 8, `expected 8 non-outlier slots to pass under threshold=${threshold}, got ${passing.length}`);
  assert.equal(rejecting.length, 1, `expected 1 outlier slot to reject under threshold=${threshold}, got ${rejecting.length}`);
  assert.equal(rejecting[0].ref, 'CON-036', `expected CON-036 as the rejecting slot, got ${rejecting[0].ref}`);
});

test('round-4 acceptance: source-of-truth consistency in schema (per spec §6.1)', () => {
  const SCHEMA = JSON.parse(require('fs').readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = SCHEMA.layer_2b_calibration;
  assert.ok(calib, 'layer_2b_calibration absent');
  const expected = Math.round(calib.p75_baseline * (1 + calib.safety_margin_pct / 100));
  assert.equal(calib.threshold_provisional, expected,
    `source-of-truth drift: threshold_provisional=${calib.threshold_provisional} expected=${expected}`);
});
```

- [ ] **Step 4.3: Run test to verify pass**

Run: `node --test tests/test-archive-replay.js`
Expected: 5 tests total (3 pre-existing bilibili tests from 3a Phase 5 + 2-3 new round-4 acceptance tests). All PASS.

If any new test fails, debug:
- "8 non-outlier pass" failure: check Stage 0 data + threshold derivation
- "CON-036 reject" failure: verify CON-036 in per_slot data
- Source-of-truth: schema math may have drifted; fix Task 2 schema atomically

- [ ] **Step 4.4: Run full test suite**

Run: `node --test tests/*.js | tail -5`
Expected: 301 + 3 = 304 tests (or similar; depends on Task 5 backward-compat outcome). Failures from Task 3 KNOWN BREAKAGE may still be present; record but defer to Task 5.

- [ ] **Step 4.5: Commit**

```bash
git add tests/test-archive-replay.js
git commit -m "test(round-4): acceptance criteria — CON-036 reject + 8/9 corpus-pass

Per ASSERTION-4 round-4 spec §8 acceptance criteria, three new tests in
tests/test-archive-replay.js extending 3a Phase 5 archive-replay matrix:

1. CON-036 ui_panel rejects under threshold=30 (outlier-edge anchor;
   max_contiguous_orphan_run=35 from Stage 0 empirical).
2. 8 of 9 gto-trainer non-outlier slots pass under threshold=30
   (corpus-aggregate acceptance; max_run ≤ 27 < 30 for all 8).
3. Source-of-truth consistency: schema.layer_2b_calibration verifies
   threshold_provisional == round(p75_baseline × (1+safety_margin_pct/100))
   per spec §6.1 binding.

Tests reuse Stage 0 deliverable
docs/superpowers/evidence/2026-05-10-round-4-data/gto-trainer-distribution.json
(committed at 8e1446e). Skip-if-absent guards preserve test isolation.

spec: round-4 v0.1 §6.1 + §8."
```

---

## Task 5: Backward-compat audit

**Files (read + modify):**
- `tests/fixtures/hj-seam-adversarial/*` — adversarial fixture battery (10+ fixtures)
- `tests/test-hj-seam-fixtures.js` — fixture-driven integration tests
- `tests/test-handoff-token-coverage.js` — direct Layer 2b tests (if any tests outside Task 3 additions need updating)

**Spec ref:** §11 Risk 5 mitigation 3 (acceptance test validates per-slot reject behavior); spec §3 problem framing (PR #2 binary was over-strict per dogfood-2026-05-04 finding #1).

This task addresses the KNOWN BREAKAGE from Task 3: existing tests that depended on PR #2's binary `orphans.length > 0` reject may now pass unexpectedly under round-4's threshold-based reject. Each affected fixture/test must be examined and adjudicated.

- [ ] **Step 5.1: Enumerate failing tests after Task 3**

Run: `node --test tests/*.js 2>&1 | grep -E "^✖|^not ok" | head -30`

Record the failing test names + files. Categorize:
- **Cat A:** Test was specifically validating PR #2 binary "any orphan rejects" behavior. Under round-4, the test premise is invalidated. Action: rewrite test or remove (with justification commit message).
- **Cat B:** Test fixture was constructed with short orphan bursts that PR #2 caught but round-4 lets pass. Action: enhance fixture with longer orphan run (>30 tokens) so round-4 catches it, OR re-classify fixture as "legit-borderline" and adjust expectation.
- **Cat C:** Test depends on Layer 2b reject as side effect of broader assertion. Action: adjust assertion to use a different layer (3a deep-check, Layer 2a provenance).

- [ ] **Step 5.2: Read each failing test + adjudicate category**

For each failing test:
1. Read the test code + fixture (if any)
2. Determine which Cat (A/B/C) applies
3. Document in audit file (or commit message)
4. Apply the corresponding action (rewrite, enhance, or adjust)

- [ ] **Step 5.3: Update fixtures or test expectations**

Apply adjudicated actions. Common patterns:

**Cat B fixture enhancement example:**

If fixture `each-evades-enumerate` had 5-token orphan burst that PR #2 caught but round-4 misses:
- Add 30+ token orphan burst to make round-4 catch it (preserves "must reject" semantic)
- OR re-classify as "legit-borderline-legit-prose" with new expected behavior

**Cat A test removal example:**

If test was specifically asserting "any single orphan triggers reject":
- Remove the test (round-4 supersedes that semantic)
- Add note in commit message + reference round-4 spec §3-4

- [ ] **Step 5.4: Run full test suite to verify all pass**

Run: `node --test tests/*.js | tail -5`
Expected: All tests pass (no FAIL). Test count may increase or decrease based on Cat A removals + new fixture enhancements.

- [ ] **Step 5.5: Run install.sh + verify deployed**

Run: `bash install.sh`
Verify deployment parity:
```bash
diff -q schemas/bonfire-v1.json $HOME/.claude/bonfire/schemas/bonfire-v1.json
diff -q bin/lib/schema.cjs $HOME/.claude/bonfire/bin/lib/schema.cjs
diff -q bin/lib/seam-validation.cjs $HOME/.claude/bonfire/bin/lib/seam-validation.cjs
```
Expected: no output (parity ✓).

- [ ] **Step 5.6: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/ tests/test-hj-seam-fixtures.js tests/test-handoff-token-coverage.js
# (adjust paths per actual files modified)
git commit -m "test(round-4): backward-compat audit — fixture and test adjustments

Round-4 spec §11 Risk 5 mitigation 3 audit: existing tests that depended
on PR #2's binary 'any orphan rejects' Layer 2b semantic re-examined
under round-4 threshold-based reject (max_contiguous > 30).

Audit categories:
- Cat A: tests directly asserting binary 'any orphan rejects' → removed
  with rationale; round-4 supersedes that semantic per spec §3-4.
- Cat B: fixtures with short orphan bursts caught by binary but missed by
  round-4 threshold → enhanced with 30+ token orphan bursts to preserve
  'must reject' semantic, OR re-classified as legit-borderline.
- Cat C: tests using Layer 2b as side-effect of broader assertion →
  re-pointed to alternative layer (3a deep-check / Layer 2a provenance).

Specific changes (replace with actual file:line list at commit time):
- [LIST OF CHANGES]

Result: all tests pass under round-4 reject behavior. Layer 2b is now
permissive on legit prose elaboration (cost-asymmetry-aligned) while
catching contiguous burst inventions per round-4 mandate (i).

spec: round-4 v0.1 §3 + §4 + §11 Risk 5 mitigation 3."
```

---

## Self-Review

After all 5 tasks committed, verify:

**Spec coverage:**
- [ ] §5 Mechanism: max_contiguous reject_when implemented (Task 1+3); overlap_ratio telemetry-only (Task 3)
- [ ] §6.1 schema-driven config: layer_2b_calibration deployed (Task 2)
- [ ] §6.1 source-of-truth contract: assertion in code (Task 3) + test (Task 4)
- [ ] §6.2 threshold formula: provisional T=30 from p75=25 + 20% (Task 2)
- [ ] §6.7 invention fixture procedure: spec contract only; no code change required (forward-looking)
- [ ] §7 enforcement scope: 3 collections walked (existing schema.cjs validateProvenance; no change needed)
- [ ] §8 acceptance criteria: CON-036 reject + 8/9 corpus pass (Task 4 tests)
- [ ] §11 Risk 5: PR #2 binary reject removed (Task 3); mitigations 1+2 in commit messages; mitigation 3 in Task 4 acceptance + Task 5 audit

**Placeholder scan:**
- [ ] Every step has actual code or exact command (no "TODO" / "fill in details" / "similar to Task N")
- [ ] Test code is verbatim, not "write tests for the above"
- [ ] Commit messages are complete with spec references

**Type consistency:**
- [ ] `maxContiguousOrphanRun(slotTokens, sourceText)` — same signature in all references (Task 1 helper, Task 3 consumer, Task 4 acceptance)
- [ ] `layer_2b_calibration` — same field names across schema (Task 2), code reads (Task 3), test verifications (Task 4)

**Gaps from spec:**
- DQ-5 schema bloat: not implemented (deferred per spec §10 DQ-5)
- DQ-6 RESOLVED: metric class chosen (Task 1) — already addressed
- §6.7 invention fixture procedure: implementation deferred until empirical trigger fires (per spec); no Task implements; spec contract only
- Telemetry persistence layer: not in v0.1 (compute-only); spec §5 acknowledges + amend candidate

These gaps are intentional per spec deferrals.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-05-10-bonfire-assertion-4-round-4-implementation.md`.

**Recommended execution mode:** subagent-driven-development (parallel to 3a Phase 1-5 execution pattern + Lessons 1-5 dispatch discipline).

**Sequencing notes:**
- Task 1 + Task 2 are independent (different files); could parallel-dispatch under Lesson 1 caution (small ROI for parallel given small scale; serial dispatch likely better per Phase 1 race lesson).
- Task 3 depends on Task 1 (uses helper) AND Task 2 (reads schema config).
- Task 4 depends on Task 3 (acceptance test runs against migrated reject behavior) AND Task 2 (schema config presence).
- Task 5 depends on Task 3 (failing tests surface from Task 3 commit).

**Recommended dispatch order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 (serial; total ~5 tasks).

**Per-task dispatch checklist** (from `feedback-subagent-execution-discipline.md` Lessons 1-5):
- Branch verification + plan-vs-reality grep at start
- Forbidden `git add .` / `-A`; explicit paths only
- Post-commit `bash install.sh` + dual-grep verify
- Status report numeric counts from `node --test tests/*.js | tail -5`
- Architect-side cross-check on test count post-receipt (Lesson 5 hardening)
- Spec-reviewer + quality-reviewer per task per Lesson 3 ordering
- Lesson 5 stop condition: Round 3 Suggestion-only → architect-substitute close

**Total estimate:** ~3-5 hours wall-clock + dispatch costs (sonnet model), per Phase-3-5 historical pace.

**End of round-4 implementation plan v0.1.**
