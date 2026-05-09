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
