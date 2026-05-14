'use strict';

/**
 * Task 5 — Class C: Regression replay on real dogfood archives.
 *
 * Replays bilibili-clean handoff + verdict through the Assertion 3a validators
 * to confirm B1 (vacuous verdict) and B2 (vacuous handoff) reproduction.
 *
 * Scope: bilibili-clean only per spec §7.3 + §9 Task 5 amendment (2026-05-09).
 * gto-trainer archive excluded: lives outside this repo and is Layer 2b /
 * Assertion-4 territory, not 3a vacuous-pass territory.
 *
 * spec: docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md §7.3 Class C
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { deepCheckHandoffSubstantiveSlots } = require('../bin/lib/schema.cjs');
const { checkVerdictSubstantive } = require('../bin/lib/state.cjs');

const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8')
);

// bilibili-clean dogfood archive paths (2026-05-08 second dogfood)
const BILIBILI_HANDOFF = path.join(
  __dirname, '..', 'docs', 'superpowers', 'evidence',
  '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'plan', 'compile-output.json'
);
const BILIBILI_VERDICT = path.join(
  __dirname, '..', 'docs', 'superpowers', 'evidence',
  '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'plan', 'h-review-verdict.json'
);
const BILIBILI_SNAPSHOT = path.join(
  __dirname, '..', 'docs', 'superpowers', 'evidence',
  '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'
);

test('bilibili-clean handoff replay — B2 vacuous-pass reproduction', () => {
  if (!fs.existsSync(BILIBILI_HANDOFF)) {
    console.log(`SKIP: ${BILIBILI_HANDOFF} not found`);
    return;
  }
  // compile-output.json is a wrapper; the handoff object lives at .handoff
  // deepCheckHandoffSubstantiveSlots expects the inner handoff (slot paths
  // like "handoff.domain_model.entities" strip the "handoff." prefix).
  const compileOutput = JSON.parse(fs.readFileSync(BILIBILI_HANDOFF, 'utf8'));
  const handoff = compileOutput.handoff || compileOutput;
  const snapshot = fs.existsSync(BILIBILI_SNAPSHOT)
    ? JSON.parse(fs.readFileSync(BILIBILI_SNAPSHOT, 'utf8'))
    : { entries: {} };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, false, 'expected B2 reproduction: vacuous handoff should reject');
  // Per Round 1 quality-review S1: pin the specific failure field so test
  // does not pass on unrelated validator firing. Mirror test-deep-check-handoff.js
  // pattern. B2 surface is empty entities array under handoff_substantive_slots.
  assert.match(result.error, /entities|min_entries/i,
    `expected entities/min_entries failure, got: ${result.error}`);
});

test('bilibili-clean verdict replay — B1 vacuous-pass reproduction', () => {
  if (!fs.existsSync(BILIBILI_VERDICT)) {
    console.log(`SKIP: ${BILIBILI_VERDICT} not found`);
    return;
  }
  const verdict = JSON.parse(fs.readFileSync(BILIBILI_VERDICT, 'utf8'));
  const snapshot = fs.existsSync(BILIBILI_SNAPSHOT)
    ? JSON.parse(fs.readFileSync(BILIBILI_SNAPSHOT, 'utf8'))
    : { entries: {} };
  const result = checkVerdictSubstantive(verdict, SCHEMA, snapshot);
  assert.equal(result.valid, false, 'expected B1 reproduction: vacuous verdict should reject');
  // Per Round 1 quality-review S1: pin the specific reject_when rule so test
  // does not pass on unrelated validator firing. Mirror test-verdict-substantive.js
  // pattern. B1 surface is approved verdict + empty conditions/rulings + no escape.
  assert.match(result.error, /approved_requires_substantive_oversight|rulings_empty/,
    `expected approved_requires_substantive_oversight rule match, got: ${result.error}`);
});

// ---------------------------------------------------------------------------
// Round-4 acceptance tests — per ASSERTION-4 round-4 spec §8 acceptance
// criteria. Tests read Stage 0 empirical data + deployed schema config.
// ---------------------------------------------------------------------------

const ROUND4_DATA = path.join(__dirname, '..', 'docs', 'superpowers', 'evidence', '2026-05-10-round-4-data', 'gto-trainer-distribution.json');

test('round-4 acceptance: CON-036 ui_panel rejects under threshold=30 (per spec §8 + outlier-edge anchor)', () => {
  if (!fs.existsSync(ROUND4_DATA)) {
    // Skip if Stage 0 data not present (preserves test isolation)
    return;
  }
  const dist = JSON.parse(fs.readFileSync(ROUND4_DATA, 'utf8'));
  const con036 = dist.per_slot.find(s => s.ref === 'CON-036' && s.slot_kind === 'ui_panel');
  assert.ok(con036, 'CON-036 ui_panel slot not found in distribution');
  // Per spec §8 fixture: max_contiguous_orphan_run=35 > threshold=30 → reject.
  assert.equal(con036.max_contiguous_orphan_run, 35, 'CON-036 max_run should be 35 (Stage 0 empirical)');
  const ROUND4_SCHEMA = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = ROUND4_SCHEMA.layer_2b_calibration;
  assert.ok(calib, 'schemas/bonfire-v1.json missing layer_2b_calibration (Task 2)');
  assert.ok(con036.max_contiguous_orphan_run > calib.threshold_provisional,
    `CON-036 max_run=${con036.max_contiguous_orphan_run} should exceed threshold=${calib.threshold_provisional}`);
});

test('round-4 acceptance: 8 of 9 gto-trainer non-outlier slots pass under threshold=30 (per spec §8 corpus-aggregate)', () => {
  if (!fs.existsSync(ROUND4_DATA)) {
    return;
  }
  const dist = JSON.parse(fs.readFileSync(ROUND4_DATA, 'utf8'));
  const ROUND4_SCHEMA = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = ROUND4_SCHEMA.layer_2b_calibration;
  const threshold = calib.threshold_provisional;
  const passing = dist.per_slot.filter(s => s.max_contiguous_orphan_run <= threshold);
  const rejecting = dist.per_slot.filter(s => s.max_contiguous_orphan_run > threshold);
  assert.equal(passing.length, 8, `expected 8 non-outlier slots to pass under threshold=${threshold}, got ${passing.length}`);
  assert.equal(rejecting.length, 1, `expected 1 outlier slot to reject under threshold=${threshold}, got ${rejecting.length}`);
  assert.equal(rejecting[0].ref, 'CON-036', `expected CON-036 as the rejecting slot, got ${rejecting[0].ref}`);
  assert.equal(rejecting[0].slot_kind, 'ui_panel', `expected ui_panel as the rejecting slot_kind, got ${rejecting[0].slot_kind}`);
});

test('round-4 acceptance: source-of-truth consistency in schema (per spec §6.1)', () => {
  const ROUND4_SCHEMA = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
  ));
  const calib = ROUND4_SCHEMA.layer_2b_calibration;
  assert.ok(calib, 'layer_2b_calibration absent');
  const expected = Math.round(calib.p75_baseline * (1 + calib.safety_margin_pct / 100));
  assert.equal(calib.threshold_provisional, expected,
    `source-of-truth drift: threshold_provisional=${calib.threshold_provisional} expected=${expected}`);
});
