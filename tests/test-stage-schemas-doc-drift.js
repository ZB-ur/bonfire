'use strict';

/**
 * Assertion 3b acceptance test — schema-doc drift closure.
 *
 * Implements spec §7 predicates 1-8:
 * 1. bonfire-v1.json validity
 * 2. stage_schemas 8-key presence
 * 3. _note declarative declaration
 * 4. Schema field literal match (per §6 spec)
 * 5. ecl-schema.md 5-stage null replacement (positive + negative grep)
 * 6. ecl-schema.md D6 source_kind/source_ref ≥3 mentions
 * 7. stage-playbook.md D1 reconciliation
 * 8. handoff-quality-bar.md D6 inline ≥3 mentions
 *
 * spec: docs/superpowers/specs/2026-05-10-bonfire-assertion-3b-design.md §7
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'bonfire-v1.json');
const ECL_PATH = path.join(REPO_ROOT, 'references', 'ecl-schema.md');
const PLAYBOOK_PATH = path.join(REPO_ROOT, 'references', 'stage-playbook.md');
const HQB_PATH = path.join(REPO_ROOT, 'references', 'handoff-quality-bar.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Predicate 1: bonfire-v1.json validity
test('3b predicate 1: bonfire-v1.json parses as valid JSON', () => {
  assert.doesNotThrow(() => JSON.parse(readFile(SCHEMA_PATH)),
    'schemas/bonfire-v1.json must parse as valid JSON');
});

// Predicate 2: stage_schemas 8-key presence
test('3b predicate 2: stage_schemas has 8 keys', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  assert.ok(schema.stage_schemas, 'stage_schemas top-level section must exist');
  const keys = Object.keys(schema.stage_schemas).sort();
  const expected = ['_note', 'closure', 'compile_output_companion', 'divergence', 'preprocess', 'probes', 'requirements', 'version'].sort();
  assert.deepEqual(keys, expected,
    `stage_schemas keys mismatch — expected ${expected.join(',')}, got ${keys.join(',')}`);
});

// Predicate 3: _note declarative declaration
test('3b predicate 3: stage_schemas._note declares documentation-only', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  const note = schema.stage_schemas._note || '';
  assert.match(note, /Documentation-only|not runtime-enforced/i,
    `_note must declare documentation-only or not-runtime-enforced; got: ${note}`);
});

// Predicate 4: Schema field literal match per §6 spec
test('3b predicate 4: stage_schemas field shapes match spec §6 verbatim', () => {
  const schema = JSON.parse(readFile(SCHEMA_PATH));
  const ss = schema.stage_schemas;

  // preprocess
  const ppArr = Object.keys(ss.preprocess.array_fields).sort();
  assert.deepEqual(ppArr,
    ['ambiguity_points', 'critical_assumptions', 'excluded_scope', 'frozen_for_code', 'retained_scope'],
    'preprocess.array_fields keys mismatch');
  assert.deepEqual(ss.preprocess.required_fields, ['reframed_goal'],
    'preprocess.required_fields must be ["reframed_goal"] only (Issue 1 fix)');

  // divergence
  assert.ok(ss.divergence.array_fields.options.item_fields.includes('retained_option'),
    'divergence.options.item_fields must include retained_option (D2)');

  // requirements
  assert.deepEqual(ss.requirements.array_fields.requirement_units.item_fields,
    ['id', 'title', 'description', 'success_criteria', 'depends_on'],
    'requirements.requirement_units.item_fields mismatch (D3)');

  // closure
  assert.deepEqual(ss.closure.array_fields.dependency_chain.item_fields,
    ['id', 'description', 'upstream', 'downstream'],
    'closure.dependency_chain.item_fields mismatch (D4)');
  assert.equal(ss.closure.array_fields.resolved_gaps.items, 'string',
    'closure.resolved_gaps.items must be "string" (D4)');

  // probes
  assert.deepEqual(ss.probes.array_fields.probes.item_fields,
    ['hypothesis', 'method', 'expected_signal', 'kill_criteria', 'result'],
    'probes.probes.item_fields mismatch');

  // compile_output_companion sections
  const compKeys = Object.keys(ss.compile_output_companion.sections).sort();
  assert.deepEqual(compKeys,
    ['code_batches', 'compile_summary', 'constraint_crosswalk', 'execution_manifest', 'final_handoff'],
    'compile_output_companion.sections keys mismatch (D5)');
});

// Predicate 5: ecl-schema.md 5-stage null replacement
test('3b predicate 5a: ecl-schema.md positive field-spec assertion', () => {
  const ecl = readFile(ECL_PATH);
  const distinctive = ['retained_scope', 'requirement_units', 'dependency_chain', 'resolved_gaps', 'hypothesis'];
  const matchCount = distinctive.filter(t => ecl.includes(t)).length;
  assert.ok(matchCount >= 5,
    `ecl-schema.md must mention at least 5 distinctive field names; got ${matchCount}: ${distinctive.filter(t => !ecl.includes(t)).join(',')} missing`);
});

test('3b predicate 5b: ecl-schema.md no remaining stage:null for 5 reconciled stages', () => {
  const ecl = readFile(ECL_PATH);
  const re = /"(preprocess|divergence|requirements|closure|probes)": null,?/;
  const m = ecl.match(re);
  assert.equal(m, null,
    `ecl-schema.md must not contain stage:null for 5 reconciled stages; found: ${m && m[0]}`);
});

// Predicate 6: ecl-schema.md D6 source_kind/source_ref ≥3 mentions
test('3b predicate 6: ecl-schema.md mentions source_kind/source_ref ≥3 times', () => {
  const ecl = readFile(ECL_PATH);
  const matches = (ecl.match(/source_kind|source_ref/g) || []).length;
  assert.ok(matches >= 3,
    `ecl-schema.md must mention source_kind or source_ref ≥3 times (entity / FC / data_contract); got ${matches}`);
});

// Predicate 7: stage-playbook.md D1 reconciliation
test('3b predicate 7: stage-playbook.md Stage A 13-field artifacts removed', () => {
  const playbook = readFile(PLAYBOOK_PATH);

  // Required-output-field framing of artifacts must be removed.
  // Tolerance: artifacts may appear in caveat sentence ("agents emit working data X, Y, Z")
  // but not as required-output-field list items.
  const stageARegion = playbook.match(/## A \/[\s\S]*?(?=^## )/m);
  assert.ok(stageARegion, 'stage-playbook.md Stage A section must exist');
  const stageA = stageARegion[0];

  // Verify 6 flat fields are present in Stage A region
  for (const f of ['reframed_goal', 'retained_scope', 'excluded_scope', 'critical_assumptions', 'frozen_for_code', 'ambiguity_points']) {
    assert.ok(stageA.includes(f),
      `Stage A must list ${f} as required output field`);
  }

  // approval_pack as a wrapper-key in field list must be absent (caveat-mention OK).
  // We use a structural check: approval_pack should not appear as a top-level bullet point.
  const wrapperPattern = /^- `approval_pack`/m;
  assert.ok(!wrapperPattern.test(stageA),
    'Stage A must not list approval_pack as a top-level required field');
});

// Predicate 8: handoff-quality-bar.md D6 inline ≥3 mentions
test('3b predicate 8: handoff-quality-bar.md mentions source_kind/source_ref ≥3 times', () => {
  const hqb = readFile(HQB_PATH);
  const matches = (hqb.match(/source_kind|source_ref/g) || []).length;
  assert.ok(matches >= 3,
    `handoff-quality-bar.md must mention source_kind or source_ref ≥3 times; got ${matches}`);
});
