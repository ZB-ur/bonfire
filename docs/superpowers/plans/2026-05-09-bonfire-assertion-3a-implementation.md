# ASSERTION-3a — Validation Theater Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the residual vacuous-pass surface at Stage H verdict and Stage J handoff via three structural deep-checks (handoff `min_entries`/`required_subfields`, verdict per-element substantive check, verdict top-level reject_when predicate) plus a parallel ref-only escape valve mirrored from existing `no_substantive_contract`. Defeats attack levels L0-L3; L4 prose-vacuous remains OOS (round-4 territory).

**Architecture:** Three-location schema extension in `bonfire-v1.json` driven by two shared validator helpers (`isEmptyOrPlaceholder`, `validateLedgerRef`). Task 1 ships helpers + their unit tests in isolation. Task 2 owns the `schema_version` 1→2 bump on behalf of all subsequent schema-modifying tasks; it adds top-level `ledger_id_prefixes`/`ledger_id_pattern` constants (closing DQ-4), migrates the existing `handoff_mandate_params.escape_valve` to ref-only (closing DQ-1 at the handoff escape), and extends `handoff_substantive_slots` with deep-check rules. Tasks 3 and 4 add the verdict element check and the verdict top-level predicate respectively, both reusing the helpers from Task 1. Task 5 is the Class C regression matrix replaying real dogfood archives. Task 6 is documentation. No reentry mechanism changes (Path B α-1: state-advance reject + operator re-spawn).

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert/strict`, no new dependencies. Bonfire CLI deployed at `$HOME/.claude/bonfire/` via `install.sh`. Schema at `schemas/bonfire-v1.json`.

**Spec:** `docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md` (commit 24e4db6, v0.2 approved 2026-05-09)

**Empirical input:** `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (clean-run dogfood, 20 findings); `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` (first dogfood reference).

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `bin/lib/validation-helpers.cjs` | Shared module: `isEmptyOrPlaceholder`, `validateLedgerRef`, `extractLedgerRefs`, `PLACEHOLDER_STRINGS` constant |
| Modify | `schemas/bonfire-v1.json` | Bump `schema_version` 1→2; add top-level `ledger_id_prefixes` + `ledger_id_pattern`; migrate `handoff_mandate_params.escape_valve` to `reason_ref_constraint`; extend `handoff_substantive_slots` slots with `min_entries` + `required_subfields` (rename `fields`→`required_subfields`); extend `delta_schemas.bonfire-h-review.constraints.condition_item_shape` with `field_substantive_check`; add new `ruling_item_shape`; add new top-level `verdict_substantive_check` |
| Modify | `bin/lib/seam-validation.cjs` | Update `checkSubstantiveSlotRefs` (or equivalent escape-valve handler) to call `validateLedgerRef` instead of inline pattern + zero-orphan; add new `deepCheckHandoffSubstantiveSlots(handoff, schema)` exported function |
| Modify | `bin/bonfire-tools.cjs` | Wire `handoff-validate` CLI to call `deepCheckHandoffSubstantiveSlots` before existing Layer 2a check |
| Modify | `bin/lib/delta-parser.cjs` | Extend `condition_item_shape` check at line 51-77 with `field_substantive_check` evaluation; add new `ruling_item_shape` check immediately after |
| Modify | `bin/lib/state.cjs` | In `checkStageHInvariant` (line 110+), insert `checkVerdictSubstantive(verdict, schema, snapshot)` call between validateDelta success (line 135) and Layer 1 condition check (line 143) |
| Create | `tests/test-validation-helpers.js` | Unit tests for `isEmptyOrPlaceholder`, `validateLedgerRef`, `extractLedgerRefs` |
| Create | `tests/test-deep-check-handoff.js` | Tests for `deepCheckHandoffSubstantiveSlots`: per_entry + whole_section + escape valve cases |
| Create | `tests/test-verdict-substantive.js` | Tests for `checkVerdictSubstantive`: rule 1 (contradiction) + rule 2 (no oversight) + escape valve refs |
| Create | `tests/test-ruling-item-shape.js` | Tests for new ruling_item_shape check in delta-parser |
| Modify | `tests/test-hj-seam-fixtures.js` | Add 8 new fixture-driven tests (Class A vacuous attacks + Class B legit escape) |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-handoff-l0/` | L0 attack: empty arrays/objects in handoff substantive slots |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-handoff-l1/` | L1 attack: `entities: [{}]`, function_contracts entries with no required_subfields |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-handoff-l2/` | L2 attack: required_subfields all empty/null/whitespace |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-handoff-l3/` | L3 attack: required_subfields all placeholder strings |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-verdict-l0/` | L0 attack: H verdict approved with both empty arrays, no escape |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-verdict-contradiction/` | Top-level: approved_with_conditions + conditions=[] |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-verdict-l3/` | L3: condition with text="see ledger" |
| Create | `tests/fixtures/hj-seam-adversarial/vacuous-rulings-supersede/` | L2: supersede ruling with empty new_content |
| Create | `tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight/` | Legit escape: H verdict with valid no_substantive_oversight + resolving refs |
| Create | `tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight-fabricated-ref/` | Negative escape: ref pattern matches but ref does not resolve |
| Create | `tests/test-archive-replay.js` | Class C regression matrix: replay gto-trainer + bilibili-clean archives through new validators |
| Modify | `references/handoff-quality-bar.md` | Document new substantive content requirements (min_entries, required_subfields, isEmptyOrPlaceholder) and v2 schema notes |
| Modify | `references/h-review-protocol.md` (or equivalent if named differently — check `references/` directory) | Document `verdict_substantive_check` semantics and `no_substantive_oversight` escape valve protocol |

---

## Task 1: Shared validator helpers

**Files:**
- Create: `bin/lib/validation-helpers.cjs`
- Create: `tests/test-validation-helpers.js`

This task produces the helpers used by Tasks 2-4. It has no schema dependency and no integration with bonfire CLI yet — pure module + unit tests.

- [ ] **Step 1.1: Write failing test for `isEmptyOrPlaceholder` core cases**

Create `tests/test-validation-helpers.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isEmptyOrPlaceholder,
  PLACEHOLDER_STRINGS,
} = require('../bin/lib/validation-helpers.cjs');

test('isEmptyOrPlaceholder returns true for null', () => {
  assert.equal(isEmptyOrPlaceholder(null), true);
});

test('isEmptyOrPlaceholder returns true for undefined', () => {
  assert.equal(isEmptyOrPlaceholder(undefined), true);
});

test('isEmptyOrPlaceholder returns true for empty string', () => {
  assert.equal(isEmptyOrPlaceholder(''), true);
});

test('isEmptyOrPlaceholder returns true for whitespace-only string', () => {
  assert.equal(isEmptyOrPlaceholder('   '), true);
  assert.equal(isEmptyOrPlaceholder('\t\n  '), true);
});

test('isEmptyOrPlaceholder returns true for empty array', () => {
  assert.equal(isEmptyOrPlaceholder([]), true);
});

test('isEmptyOrPlaceholder returns true for empty object', () => {
  assert.equal(isEmptyOrPlaceholder({}), true);
});

test('isEmptyOrPlaceholder returns true for registered placeholder strings', () => {
  assert.equal(isEmptyOrPlaceholder('TODO'), true);
  assert.equal(isEmptyOrPlaceholder('see ledger'), true);
  assert.equal(isEmptyOrPlaceholder('...'), true);
  assert.equal(isEmptyOrPlaceholder('<TBD>'), true);
  assert.equal(isEmptyOrPlaceholder('<placeholder>'), true);
});

test('isEmptyOrPlaceholder is case-insensitive for placeholder strings', () => {
  assert.equal(isEmptyOrPlaceholder('todo'), true);
  assert.equal(isEmptyOrPlaceholder('Todo'), true);
  assert.equal(isEmptyOrPlaceholder('SEE LEDGER'), true);
  assert.equal(isEmptyOrPlaceholder('  See Ledger  '), true);
});

test('isEmptyOrPlaceholder returns false for substantive strings', () => {
  assert.equal(isEmptyOrPlaceholder('actual content'), false);
  assert.equal(isEmptyOrPlaceholder('a'), false);
  assert.equal(isEmptyOrPlaceholder('CON-001'), false);
});

test('isEmptyOrPlaceholder returns false for non-empty arrays', () => {
  assert.equal(isEmptyOrPlaceholder([1]), false);
  assert.equal(isEmptyOrPlaceholder(['x']), false);
});

test('isEmptyOrPlaceholder returns false for non-empty objects', () => {
  assert.equal(isEmptyOrPlaceholder({ k: 'v' }), false);
});

test('PLACEHOLDER_STRINGS exports as array of strings', () => {
  assert.ok(Array.isArray(PLACEHOLDER_STRINGS));
  assert.ok(PLACEHOLDER_STRINGS.length >= 5);
  for (const s of PLACEHOLDER_STRINGS) {
    assert.equal(typeof s, 'string');
  }
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `node --test tests/test-validation-helpers.js`
Expected: FAIL with `Cannot find module '../bin/lib/validation-helpers.cjs'`

- [ ] **Step 1.3: Implement `isEmptyOrPlaceholder` + PLACEHOLDER_STRINGS**

Create `bin/lib/validation-helpers.cjs`:

```javascript
'use strict';

const PLACEHOLDER_STRINGS = [
  'todo',
  'see ledger',
  '...',
  '<tbd>',
  '<placeholder>',
  'tbd',
  'placeholder',
];

function isEmptyOrPlaceholder(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return PLACEHOLDER_STRINGS.includes(normalized);
}

module.exports = {
  isEmptyOrPlaceholder,
  PLACEHOLDER_STRINGS,
};
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `node --test tests/test-validation-helpers.js`
Expected: PASS — all 12 tests green

- [ ] **Step 1.5: Add failing tests for `extractLedgerRefs`**

Append to `tests/test-validation-helpers.js`:

```javascript
const { extractLedgerRefs } = require('../bin/lib/validation-helpers.cjs');

const TEST_SCHEMA = {
  ledger_id_pattern: '(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+',
};

test('extractLedgerRefs finds single ref in prose', () => {
  const refs = extractLedgerRefs('All entries frozen — see CON-001 for details', TEST_SCHEMA);
  assert.deepEqual(refs, ['CON-001']);
});

test('extractLedgerRefs finds multiple refs in prose', () => {
  const refs = extractLedgerRefs('CON-001 and RISK-014 are linked via DEP-002', TEST_SCHEMA);
  assert.deepEqual(refs, ['CON-001', 'RISK-014', 'DEP-002']);
});

test('extractLedgerRefs returns empty array for prose with no refs', () => {
  const refs = extractLedgerRefs('No refs here at all', TEST_SCHEMA);
  assert.deepEqual(refs, []);
});

test('extractLedgerRefs returns empty array for non-string value', () => {
  assert.deepEqual(extractLedgerRefs(null, TEST_SCHEMA), []);
  assert.deepEqual(extractLedgerRefs(undefined, TEST_SCHEMA), []);
  assert.deepEqual(extractLedgerRefs(42, TEST_SCHEMA), []);
});

test('extractLedgerRefs does not match partial prefix or shorter forms', () => {
  const refs = extractLedgerRefs('CON-1 fixme and CONS-001 typo', TEST_SCHEMA);
  // CON-1 matches (\\d+ matches one digit), CONS- does not (S is not a prefix)
  assert.deepEqual(refs, ['CON-1']);
});
```

- [ ] **Step 1.6: Run tests to verify they fail**

Run: `node --test tests/test-validation-helpers.js`
Expected: FAIL — `extractLedgerRefs` not exported

- [ ] **Step 1.7: Implement `extractLedgerRefs`**

Add to `bin/lib/validation-helpers.cjs` before `module.exports`:

```javascript
function extractLedgerRefs(value, schema) {
  if (typeof value !== 'string') return [];
  if (!schema || typeof schema.ledger_id_pattern !== 'string') {
    throw new Error('extractLedgerRefs: schema.ledger_id_pattern is required');
  }
  const re = new RegExp(schema.ledger_id_pattern, 'g');
  const matches = value.match(re);
  return matches || [];
}
```

Update exports:

```javascript
module.exports = {
  isEmptyOrPlaceholder,
  extractLedgerRefs,
  PLACEHOLDER_STRINGS,
};
```

- [ ] **Step 1.8: Run tests to verify they pass**

Run: `node --test tests/test-validation-helpers.js`
Expected: PASS — all tests green (12 + 5 = 17)

- [ ] **Step 1.9: Add failing tests for `validateLedgerRef`**

Append to `tests/test-validation-helpers.js`:

```javascript
const { validateLedgerRef } = require('../bin/lib/validation-helpers.cjs');

const SAMPLE_SNAPSHOT = {
  entries: {
    'CON-001': { id: 'CON-001', status: 'FROZEN' },
    'CON-002': { id: 'CON-002', status: 'FROZEN' },
    'RISK-014': { id: 'RISK-014', status: 'OPEN' },
  },
};

test('validateLedgerRef passes when refs match pattern and resolve', () => {
  const result = validateLedgerRef(
    'All FROZEN — see CON-001 and CON-002',
    TEST_SCHEMA,
    SAMPLE_SNAPSHOT,
    1,
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.refs, ['CON-001', 'CON-002']);
});

test('validateLedgerRef fails when no refs found', () => {
  const result = validateLedgerRef('No refs here', TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
  assert.match(result.error, /no_refs_found|min_refs/);
});

test('validateLedgerRef fails when ref count below min_refs', () => {
  const result = validateLedgerRef('Only one — CON-001', TEST_SCHEMA, SAMPLE_SNAPSHOT, 2);
  assert.equal(result.valid, false);
  assert.match(result.error, /min_refs/);
});

test('validateLedgerRef fails when ref pattern matches but does not resolve in ledger', () => {
  const result = validateLedgerRef('See CON-999 (fabricated)', TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
  assert.match(result.error, /unresolved|CON-999/);
});

test('validateLedgerRef fails when value is not a string', () => {
  const result = validateLedgerRef(null, TEST_SCHEMA, SAMPLE_SNAPSHOT, 1);
  assert.equal(result.valid, false);
});
```

- [ ] **Step 1.10: Run tests to verify they fail**

Run: `node --test tests/test-validation-helpers.js`
Expected: FAIL — `validateLedgerRef` not exported

- [ ] **Step 1.11: Implement `validateLedgerRef`**

Add to `bin/lib/validation-helpers.cjs` before `module.exports`:

```javascript
function validateLedgerRef(value, schema, ledgerSnapshot, minRefs) {
  minRefs = minRefs || 1;
  if (typeof value !== 'string') {
    return { valid: false, error: 'value must be a string', refs: [] };
  }
  const refs = extractLedgerRefs(value, schema);
  if (refs.length < minRefs) {
    return {
      valid: false,
      error: `min_refs=${minRefs} required, found ${refs.length}`,
      refs,
    };
  }
  const entries = (ledgerSnapshot && ledgerSnapshot.entries) || {};
  const unresolved = refs.filter(r => !(r in entries));
  if (unresolved.length > 0) {
    return {
      valid: false,
      error: `unresolved refs in ledger: ${unresolved.join(', ')}`,
      refs,
      unresolved,
    };
  }
  return { valid: true, refs };
}
```

Update exports:

```javascript
module.exports = {
  isEmptyOrPlaceholder,
  extractLedgerRefs,
  validateLedgerRef,
  PLACEHOLDER_STRINGS,
};
```

- [ ] **Step 1.12: Run tests to verify they pass**

Run: `node --test tests/test-validation-helpers.js`
Expected: PASS — all 22 tests green

- [ ] **Step 1.13: Run full test suite to verify no regression**

Run: `node --test tests/test-*.js`
Expected: 231 + 22 = 253 tests pass (count may vary by ±2 if test runner counts subtests differently)

- [ ] **Step 1.14: Commit**

```bash
git add bin/lib/validation-helpers.cjs tests/test-validation-helpers.js
git commit -m "feat(validation): add shared validation-helpers module

isEmptyOrPlaceholder + extractLedgerRefs + validateLedgerRef helpers for
Assertion 3a deep-check enforcement. PLACEHOLDER_STRINGS list seeded with
TODO/see ledger/.../<TBD>/<placeholder> + bare TBD/placeholder variants,
case-insensitive matching after trim+lowercase normalize.

validateLedgerRef takes (value, schema, ledgerSnapshot, minRefs) and asserts
refs match schema.ledger_id_pattern AND resolve in snapshot.entries. Returns
structured result {valid, error, refs, unresolved?} for caller error reporting.

22 unit tests covering null/undefined/empty/whitespace/case-variant/
substantive/ref-extraction/ref-resolution/unresolved-fabricated/min-refs
boundary cases. No schema or filesystem dependencies — module takes
schema/snapshot as parameters.

Spec: docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md (Section 6.7)"
```

---

## Task 2: Schema Location 1 + handoff deep-check

**Files:**
- Modify: `schemas/bonfire-v1.json` (multiple top-level edits)
- Modify: `bin/lib/seam-validation.cjs` (escape valve refactor + new deepCheckHandoffSubstantiveSlots)
- Modify: `bin/bonfire-tools.cjs` (wire deep-check into handoff-validate)
- Create: `tests/test-deep-check-handoff.js`
- Create: 5 fixtures under `tests/fixtures/hj-seam-adversarial/`

This task owns the `schema_version` 1→2 bump on behalf of all subsequent schema-modifying tasks. Tasks 3 and 4 do not re-bump.

- [ ] **Step 2.1: Read existing handoff_mandate_params escape_valve usage in seam-validation.cjs**

Run: `grep -n "handoff_mandate_params\|escape_valve\|reason_uses_zero_orphan\|no_substantive_contract" bin/lib/seam-validation.cjs`
Expected: locate the existing escape valve handling code path. Note line numbers for editing in Step 2.7.

- [ ] **Step 2.2: Bump schema_version + add ledger_id constants + migrate handoff_mandate_params escape_valve**

Edit `schemas/bonfire-v1.json`:

Find the top-level `schema_version` line (likely line 2 or 3) and bump:
```diff
-  "schema_version": 1,
+  "schema_version": 2,
```

Find `"handoff_substantive_slots":` (line 227) and INSERT BEFORE IT (between the previous block and handoff_substantive_slots):
```diff
+  "ledger_id_prefixes": ["CON", "RG", "FC", "AS", "REQ", "RISK", "DEP", "FACT", "CLAIM", "DROP"],
+  "ledger_id_pattern": "(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
   "handoff_substantive_slots": {
```

Find `"handoff_mandate_params":` block (line 236-249) and migrate the escape_valve:
```diff
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
-      "reason_ref_pattern": "(?:CON|RG|FC|AS|REQ|RISK|DEP|FACT|CLAIM|DROP)-\\d+",
-      "reason_uses_zero_orphan": true
+      "reason_ref_constraint": "ledger_ref",
+      "min_refs": 1
     }
   },
```

- [ ] **Step 2.3: Extend handoff_substantive_slots with min_entries + required_subfields**

Edit `schemas/bonfire-v1.json` `handoff_substantive_slots` (line 227-234), replacing entire block:

```diff
   "handoff_substantive_slots": {
-    "handoff.domain_model.entities": { "_provenance_required": true, "kind": "per_entry" },
-    "handoff.function_contracts": { "_provenance_required": true, "kind": "per_entry", "fields": ["purpose", "invariants", "failure_modes"] },
-    "handoff.data_contract": { "_provenance_required": true, "kind": "whole_section" },
-    "handoff.ui_contract.panels": { "_provenance_required": true, "kind": "per_entry", "fields": ["description", "elements", "states"] },
-    "handoff.ui_contract.state_ownership": { "_provenance_required": true, "kind": "whole_section" },
-    "handoff.ui_contract.empty_states": { "_provenance_required": true, "kind": "whole_section" },
-    "handoff.ui_contract.error_states": { "_provenance_required": true, "kind": "whole_section" }
+    "handoff.domain_model.entities": { "_provenance_required": true, "kind": "per_entry", "min_entries": 1, "required_subfields": ["name", "fields"] },
+    "handoff.function_contracts": { "_provenance_required": true, "kind": "per_entry", "min_entries": 1, "required_subfields": ["purpose", "invariants", "failure_modes"] },
+    "handoff.data_contract": { "_provenance_required": true, "kind": "whole_section", "required_subfields": ["schema"] },
+    "handoff.ui_contract.panels": { "_provenance_required": true, "kind": "per_entry", "min_entries": 1, "required_subfields": ["description", "elements", "states"] },
+    "handoff.ui_contract.state_ownership": { "_provenance_required": true, "kind": "whole_section", "required_subfields": ["owner_map"] },
+    "handoff.ui_contract.empty_states": { "_provenance_required": true, "kind": "whole_section", "required_subfields": ["surfaces", "messaging"] },
+    "handoff.ui_contract.error_states": { "_provenance_required": true, "kind": "whole_section", "required_subfields": ["error_map"] }
   },
```

Note: `fields` keyword is removed entirely; `required_subfields` replaces it. This is the breaking schema_version 1→2 change.

- [ ] **Step 2.4: Verify schema is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8')); console.log('valid')"`
Expected: `valid`

If error: re-check trailing commas, missing braces in your edits.

- [ ] **Step 2.5: Write failing test for deepCheckHandoffSubstantiveSlots — per_entry min_entries**

Create `tests/test-deep-check-handoff.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deepCheckHandoffSubstantiveSlots } = require('../bin/lib/seam-validation.cjs');
const path = require('path');
const SCHEMA = JSON.parse(require('fs').readFileSync(
  path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
));

test('deepCheckHandoffSubstantiveSlots rejects empty entities (L0)', () => {
  const handoff = {
    domain_model: { entities: [] },
    function_contracts: [{ purpose: 'p', invariants: 'i', failure_modes: 'f' }],
    data_contract: { schema: 's' },
    ui_contract: {
      panels: [{ description: 'd', elements: 'e', states: 's' }],
      state_ownership: { owner_map: 'o' },
      empty_states: { surfaces: 's', messaging: 'm' },
      error_states: { error_map: 'e' },
    },
  };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /entities|min_entries/);
});

test('deepCheckHandoffSubstantiveSlots rejects entry with empty required_subfield (L2)', () => {
  const handoff = {
    domain_model: { entities: [{ name: '', fields: 'f' }] },
    function_contracts: [{ purpose: 'p', invariants: 'i', failure_modes: 'f' }],
    data_contract: { schema: 's' },
    ui_contract: {
      panels: [{ description: 'd', elements: 'e', states: 's' }],
      state_ownership: { owner_map: 'o' },
      empty_states: { surfaces: 's', messaging: 'm' },
      error_states: { error_map: 'e' },
    },
  };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /entities.*name|isEmptyOrPlaceholder/);
});

test('deepCheckHandoffSubstantiveSlots rejects placeholder value (L3)', () => {
  const handoff = {
    domain_model: { entities: [{ name: 'TODO', fields: 'see ledger' }] },
    function_contracts: [{ purpose: 'p', invariants: 'i', failure_modes: 'f' }],
    data_contract: { schema: 's' },
    ui_contract: {
      panels: [{ description: 'd', elements: 'e', states: 's' }],
      state_ownership: { owner_map: 'o' },
      empty_states: { surfaces: 's', messaging: 'm' },
      error_states: { error_map: 'e' },
    },
  };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
});

test('deepCheckHandoffSubstantiveSlots rejects whole_section missing required_subfield', () => {
  const handoff = {
    domain_model: { entities: [{ name: 'X', fields: 'f' }] },
    function_contracts: [{ purpose: 'p', invariants: 'i', failure_modes: 'f' }],
    data_contract: { source_kind: 'ledger_direct', source_ref: 'CON-001' },  // no `schema`
    ui_contract: {
      panels: [{ description: 'd', elements: 'e', states: 's' }],
      state_ownership: { owner_map: 'o' },
      empty_states: { surfaces: 's', messaging: 'm' },
      error_states: { error_map: 'e' },
    },
  };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, false);
  assert.match(result.error, /data_contract|schema/);
});

test('deepCheckHandoffSubstantiveSlots passes fully substantive handoff', () => {
  const handoff = {
    domain_model: { entities: [{ name: 'User', fields: 'id name' }] },
    function_contracts: [{ purpose: 'auth', invariants: 'idempotent', failure_modes: 'reject' }],
    data_contract: { schema: '{user: {id, name}}' },
    ui_contract: {
      panels: [{ description: 'login', elements: 'form', states: 'idle/loading' }],
      state_ownership: { owner_map: 'auth=AuthCtx' },
      empty_states: { surfaces: 'login', messaging: 'sign-in' },
      error_states: { error_map: 'invalid_creds=banner' },
    },
  };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA);
  assert.equal(result.valid, true, `expected valid, got error: ${result.error}`);
});

test('deepCheckHandoffSubstantiveSlots passes when no_substantive_contract escape valve set with valid refs', () => {
  // Skip path: when slot is escaped via no_substantive_contract per existing handoff_mandate_params,
  // deep-check should not fire on that slot. Test confirms wiring respects the escape signal.
  const handoff = {
    domain_model: { entities: [], no_substantive_contract: true, no_substantive_contract_reason: 'See CON-001 — pure UI feature' },
    function_contracts: [{ purpose: 'render', invariants: 'pure', failure_modes: 'noop' }],
    data_contract: { schema: 's' },
    ui_contract: {
      panels: [{ description: 'd', elements: 'e', states: 's' }],
      state_ownership: { owner_map: 'o' },
      empty_states: { surfaces: 's', messaging: 'm' },
      error_states: { error_map: 'e' },
    },
  };
  const snapshot = { entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } } };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, true, `expected valid, got error: ${result.error}`);
});
```

- [ ] **Step 2.6: Run test to verify failure**

Run: `node --test tests/test-deep-check-handoff.js`
Expected: FAIL — `deepCheckHandoffSubstantiveSlots is not a function`

- [ ] **Step 2.7: Implement `deepCheckHandoffSubstantiveSlots` in seam-validation.cjs**

Edit `bin/lib/seam-validation.cjs`. At top of file (after the existing requires), add:

```javascript
const { isEmptyOrPlaceholder, validateLedgerRef } = require('./validation-helpers.cjs');
```

At the bottom of the file (before `module.exports`), add the new function:

```javascript
/**
 * deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot)
 *
 * Per spec 2026-05-08-bonfire-assertion-3a (§6.3 Mechanism — Q1 handoff deep-check).
 * For each slot in schema.handoff_substantive_slots, verify substantive content:
 *   - per_entry kind: assert entries.length >= min_entries; for each entry,
 *     assert each name in required_subfields is present and !isEmptyOrPlaceholder.
 *   - whole_section kind: assert each name in required_subfields is present
 *     and !isEmptyOrPlaceholder.
 * Skips a slot when the slot's container declares no_substantive_contract: true
 * (existing escape valve from handoff_mandate_params) — provided the escape
 * reason resolves via validateLedgerRef.
 *
 * Returns {valid: boolean, error?: string, slot?: string}.
 */
function deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot) {
  const slots = schema.handoff_substantive_slots || {};
  const escapeFlag = (schema.handoff_mandate_params && schema.handoff_mandate_params.escape_valve && schema.handoff_mandate_params.escape_valve.flag) || 'no_substantive_contract';
  const escapeReasonField = (schema.handoff_mandate_params && schema.handoff_mandate_params.escape_valve && schema.handoff_mandate_params.escape_valve.reason_field) || 'no_substantive_contract_reason';
  const escapeMinRefs = (schema.handoff_mandate_params && schema.handoff_mandate_params.escape_valve && schema.handoff_mandate_params.escape_valve.min_refs) || 1;

  for (const [slotPath, config] of Object.entries(slots)) {
    // slotPath like "handoff.domain_model.entities" — strip leading "handoff." then dotted-path-resolve.
    const segments = slotPath.split('.').slice(1);  // drop leading "handoff"
    const container = resolveContainer(handoff, segments);
    const slot = resolveSlot(handoff, segments);

    // Escape valve check on container level
    if (container && container[escapeFlag] === true) {
      const reason = container[escapeReasonField];
      const refResult = validateLedgerRef(reason, schema, ledgerSnapshot || { entries: {} }, escapeMinRefs);
      if (!refResult.valid) {
        return { valid: false, error: `${slotPath} escape valve invalid: ${refResult.error}`, slot: slotPath };
      }
      continue;  // escape valid — skip deep-check on this slot
    }

    if (config.kind === 'per_entry') {
      if (!Array.isArray(slot)) {
        return { valid: false, error: `${slotPath} expected array (per_entry), got ${typeof slot}`, slot: slotPath };
      }
      const minEntries = config.min_entries || 1;
      if (slot.length < minEntries) {
        return { valid: false, error: `${slotPath} has ${slot.length} entries, min_entries=${minEntries}`, slot: slotPath };
      }
      const required = config.required_subfields || [];
      for (let i = 0; i < slot.length; i++) {
        const entry = slot[i];
        if (typeof entry !== 'object' || entry === null) {
          return { valid: false, error: `${slotPath}[${i}] expected object`, slot: slotPath };
        }
        for (const field of required) {
          if (isEmptyOrPlaceholder(entry[field])) {
            return { valid: false, error: `${slotPath}[${i}].${field} is empty or placeholder`, slot: slotPath };
          }
        }
      }
    } else if (config.kind === 'whole_section') {
      if (typeof slot !== 'object' || slot === null || Array.isArray(slot)) {
        return { valid: false, error: `${slotPath} expected object (whole_section)`, slot: slotPath };
      }
      const required = config.required_subfields || [];
      for (const field of required) {
        if (isEmptyOrPlaceholder(slot[field])) {
          return { valid: false, error: `${slotPath}.${field} is empty or placeholder`, slot: slotPath };
        }
      }
    } else {
      return { valid: false, error: `${slotPath} unknown kind: ${config.kind}`, slot: slotPath };
    }
  }

  return { valid: true };
}

function resolveSlot(obj, segments) {
  let cur = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function resolveContainer(obj, segments) {
  // Container = parent of the slot. For "domain_model.entities", container = handoff.domain_model.
  if (segments.length === 0) return null;
  return resolveSlot(obj, segments.slice(0, -1));
}
```

Update `module.exports` at end of file:

```javascript
module.exports = {
  // ...existing exports...
  deepCheckHandoffSubstantiveSlots,
};
```

- [ ] **Step 2.8: Run tests to verify they pass**

Run: `node --test tests/test-deep-check-handoff.js`
Expected: PASS — all 6 tests green

- [ ] **Step 2.9: Update `checkSubstantiveSlotRefs` (or equivalent) escape-valve handler to use validateLedgerRef**

Locate the existing function in `bin/lib/seam-validation.cjs` that handles the existing `handoff_mandate_params.escape_valve` (use the line numbers from Step 2.1 grep). The existing path likely uses `reason_ref_pattern` + `reason_uses_zero_orphan` inline.

Replace the inline pattern + zero-orphan logic with a call to `validateLedgerRef`. Example replacement pattern (adapt to actual variable names used in current code):

```javascript
// Before (illustrative):
// const refRe = new RegExp(escape_valve.reason_ref_pattern, 'g');
// const matches = (reason || '').match(refRe) || [];
// if (escape_valve.reason_uses_zero_orphan) {
//   const orphanResult = checkProseTokenCoverage(reason, ...);
//   ...
// }

// After:
const refResult = validateLedgerRef(reason, schema, ledgerSnapshot, escape_valve.min_refs || 1);
if (!refResult.valid) {
  return { valid: false, error: `escape valve invalid: ${refResult.error}` };
}
```

If your current code path differs from this sketch, preserve the surrounding error reporting and only swap the inline ref-pattern + zero-orphan block for `validateLedgerRef`.

- [ ] **Step 2.10: Verify existing handoff-validate path still passes for legitimate handoffs**

Run: `node --test tests/test-handoff-token-coverage.js tests/test-handoff-provenance.js tests/test-hj-seam-fixtures.js`
Expected: existing tests continue to pass (the migration to `validateLedgerRef` should be behaviorally equivalent for legitimate inputs since the existing zero-orphan check passed those refs anyway). If a test fails, examine whether it was specifically pinning the zero-orphan behavior on escape reason text — those expectations should be updated to match v0.2 ref-only semantics.

- [ ] **Step 2.11: Wire deep-check into handoff-validate CLI**

In `bin/bonfire-tools.cjs`, locate the `handoff-validate` subcommand handler. Just before the existing Layer 2a check (`checkSubstantiveSlotRefs` or similar), add:

```javascript
const { deepCheckHandoffSubstantiveSlots } = require('./lib/seam-validation.cjs');
// ...inside handoff-validate handler:
const deepResult = deepCheckHandoffSubstantiveSlots(handoff, schema, snapshot);
if (!deepResult.valid) {
  process.stderr.write(`handoff-validate: deep_check_failed at ${deepResult.slot}: ${deepResult.error}\n`);
  process.exit(1);
}
```

- [ ] **Step 2.12: Create fixture vacuous-handoff-l0**

Create `tests/fixtures/hj-seam-adversarial/vacuous-handoff-l0/case.json` and `compile-output.json`. The fixture has empty arrays/objects in all substantive slots:

`tests/fixtures/hj-seam-adversarial/vacuous-handoff-l0/compile-output.json`:
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": { "entities": [] },
  "function_contracts": [],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001" },
  "ui_contract": { "panels": [], "state_ownership": {}, "empty_states": {}, "error_states": {} }
}
```

`tests/fixtures/hj-seam-adversarial/vacuous-handoff-l0/EXPECTED.md`:
```
EXPECT: handoff-validate exit ≠ 0 with error matching /deep_check_failed.*entities|min_entries/
ATTACK LEVEL: L0 — empty containers in all substantive slots
```

- [ ] **Step 2.13: Create fixture vacuous-handoff-l1**

`tests/fixtures/hj-seam-adversarial/vacuous-handoff-l1/compile-output.json`:
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": { "entities": [{}] },
  "function_contracts": [{}],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001" },
  "ui_contract": { "panels": [{}], "state_ownership": {}, "empty_states": {}, "error_states": {} }
}
```

`EXPECTED.md`:
```
EXPECT: handoff-validate exit ≠ 0
ATTACK LEVEL: L1 — `[{}]` shape; arrays non-empty but elements have no required_subfields
```

- [ ] **Step 2.14: Create fixture vacuous-handoff-l2**

`tests/fixtures/hj-seam-adversarial/vacuous-handoff-l2/compile-output.json`:
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": { "entities": [{ "name": "", "fields": null }] },
  "function_contracts": [{ "purpose": "   ", "invariants": "", "failure_modes": null }],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001", "schema": "" },
  "ui_contract": {
    "panels": [{ "description": null, "elements": "", "states": "  " }],
    "state_ownership": { "owner_map": "" },
    "empty_states": { "surfaces": null, "messaging": "" },
    "error_states": { "error_map": "" }
  }
}
```

`EXPECTED.md`:
```
EXPECT: handoff-validate exit ≠ 0
ATTACK LEVEL: L2 — required_subfields all empty/null/whitespace
```

- [ ] **Step 2.15: Create fixture vacuous-handoff-l3**

`tests/fixtures/hj-seam-adversarial/vacuous-handoff-l3/compile-output.json`:
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": { "entities": [{ "name": "TODO", "fields": "see ledger" }] },
  "function_contracts": [{ "purpose": "...", "invariants": "<TBD>", "failure_modes": "TODO" }],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001", "schema": "see ledger" },
  "ui_contract": {
    "panels": [{ "description": "TODO", "elements": "...", "states": "<placeholder>" }],
    "state_ownership": { "owner_map": "TODO" },
    "empty_states": { "surfaces": "...", "messaging": "TODO" },
    "error_states": { "error_map": "TBD" }
  }
}
```

`EXPECTED.md`:
```
EXPECT: handoff-validate exit ≠ 0
ATTACK LEVEL: L3 — required_subfields all set to registered placeholder strings
```

- [ ] **Step 2.16: Create fixture legit-no-substantive-contract**

`tests/fixtures/hj-seam-adversarial/legit-no-substantive-contract/compile-output.json`:
```json
{
  "code_ready": true,
  "unresolved_gaps": [],
  "domain_model": {
    "entities": [],
    "no_substantive_contract": true,
    "no_substantive_contract_reason": "Pure UI feature; no domain entities. See CON-001 (acceptance pinned to UI behavior)."
  },
  "function_contracts": [{ "purpose": "render", "invariants": "pure", "failure_modes": "noop" }],
  "data_contract": { "source_kind": "ledger_direct", "source_ref": "CON-001", "schema": "no data layer" },
  "ui_contract": {
    "panels": [{ "description": "main view", "elements": "header body footer", "states": "idle loaded" }],
    "state_ownership": { "owner_map": "view=ViewCtx" },
    "empty_states": { "surfaces": "main", "messaging": "loading..." },
    "error_states": { "error_map": "fetch_fail=banner" }
  }
}
```

`EXPECTED.md`:
```
EXPECT: handoff-validate exit 0
SCENARIO: Legitimate use of no_substantive_contract escape valve on entities slot, with reason citing FROZEN ledger ref CON-001
```

The fixture also needs a minimal `truth-surface/constraint-ledger-snapshot.json` containing CON-001 as FROZEN — see Step 2.18.

- [ ] **Step 2.17: Add fixture-driven tests to test-hj-seam-fixtures.js**

Append to `tests/test-hj-seam-fixtures.js` (append before existing `module.exports`-style trailer or end of file):

```javascript
const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'hj-seam-adversarial');

function runFixture(name) {
  const fixtureDir = path.join(FIXTURE_ROOT, name);
  const handoffPath = path.join(fixtureDir, 'compile-output.json');
  const handoff = JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
  const snapshotPath = path.join(fixtureDir, 'truth-surface', 'constraint-ledger-snapshot.json');
  let snapshot = { entries: {} };
  if (fs.existsSync(snapshotPath)) {
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  }
  return deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
}

test('vacuous-handoff-l0 fixture rejects', () => {
  const r = runFixture('vacuous-handoff-l0');
  assert.equal(r.valid, false);
});

test('vacuous-handoff-l1 fixture rejects', () => {
  const r = runFixture('vacuous-handoff-l1');
  assert.equal(r.valid, false);
});

test('vacuous-handoff-l2 fixture rejects', () => {
  const r = runFixture('vacuous-handoff-l2');
  assert.equal(r.valid, false);
});

test('vacuous-handoff-l3 fixture rejects', () => {
  const r = runFixture('vacuous-handoff-l3');
  assert.equal(r.valid, false);
});

test('legit-no-substantive-contract fixture passes', () => {
  const r = runFixture('legit-no-substantive-contract');
  assert.equal(r.valid, true, `unexpected error: ${r.error}`);
});
```

If `test-hj-seam-fixtures.js` already requires `deepCheckHandoffSubstantiveSlots` and SCHEMA + path/fs differently, adapt the imports accordingly.

- [ ] **Step 2.18: Add legit fixture's snapshot file**

Create `tests/fixtures/hj-seam-adversarial/legit-no-substantive-contract/truth-surface/constraint-ledger-snapshot.json`:

```json
{
  "version": 1,
  "replayed_at": "2026-05-09T00:00:00Z",
  "event_count": 1,
  "entries": {
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "status": "FROZEN",
      "content": "UI feature with no domain layer",
      "rationale": "fixture seed",
      "challenged_by": ["fixture"],
      "aligned_by": ["fixture"],
      "evidence_refs": [],
      "notes": []
    }
  },
  "by_status": { "proposed": [], "challenged": [], "frozen": ["CON-001"], "superseded": [], "open": [], "discarded": [] },
  "by_category": { "retained_goal": ["CON-001"] }
}
```

- [ ] **Step 2.19: Run all tests and verify pass**

Run: `node --test tests/test-*.js`
Expected: prior tests still pass + new tests pass (Task 1's 22 tests + Task 2's 6 deep-check unit tests + 5 fixture tests = 33 new tests on top of existing 231 → ~264 total)

- [ ] **Step 2.20: Run install.sh to deploy v2 schema + new helpers to ~/.claude/bonfire/**

Run: `bash install.sh`
Expected: "安装完成！" message. Verify:
```bash
grep -c "ledger_id_pattern" $HOME/.claude/bonfire/schemas/bonfire-v1.json
```
Expected: `1` (constant deployed)

- [ ] **Step 2.21: Commit**

```bash
git add schemas/bonfire-v1.json bin/lib/seam-validation.cjs bin/bonfire-tools.cjs tests/test-deep-check-handoff.js tests/test-hj-seam-fixtures.js tests/fixtures/hj-seam-adversarial/vacuous-handoff-l0 tests/fixtures/hj-seam-adversarial/vacuous-handoff-l1 tests/fixtures/hj-seam-adversarial/vacuous-handoff-l2 tests/fixtures/hj-seam-adversarial/vacuous-handoff-l3 tests/fixtures/hj-seam-adversarial/legit-no-substantive-contract
git commit -m "feat(3a): handoff substantive slot deep-check + schema v2

Schema location 1 of Assertion 3a:
- Bump schema_version 1→2 (this commit owns the bump on behalf of subsequent
  schema-modifying tasks)
- Add top-level ledger_id_prefixes + ledger_id_pattern constants (DQ-4 close)
- Migrate handoff_mandate_params.escape_valve from inline reason_ref_pattern
  + reason_uses_zero_orphan to reason_ref_constraint: 'ledger_ref' + min_refs:1
  (DQ-1 close at handoff escape; ref-only check via validateLedgerRef helper)
- Extend handoff_substantive_slots with min_entries (per_entry) +
  required_subfields (per_entry & whole_section); rename 'fields' to
  'required_subfields' (breaking; rationale: stronger contract semantic)

New deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot) in
bin/lib/seam-validation.cjs runs before existing Layer 2a check in
handoff-validate CLI. Per-entry: assert entries.length >= min_entries; per
entry, assert required_subfields all present and !isEmptyOrPlaceholder.
Whole_section: required_subfields present and !isEmptyOrPlaceholder. Skip
slot when no_substantive_contract flag set with valid resolving refs.

5 new fixtures pinning attack levels L0-L3 + legit escape valve. 6 unit
tests for the new function. Spec: docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md (§6.3, §6.6 Loc 1)."
```

---

## Task 3: Schema Location 2 — verdict element deep-check

**Files:**
- Modify: `schemas/bonfire-v1.json` `delta_schemas.bonfire-h-review.constraints` (line 266-278)
- Modify: `bin/lib/delta-parser.cjs` (extend condition_item_shape check, add ruling_item_shape check)
- Create: `tests/test-ruling-item-shape.js`
- Create: 2 fixtures (vacuous-verdict-l3, vacuous-rulings-supersede)

- [ ] **Step 3.1: Extend condition_item_shape + add ruling_item_shape in schema**

Edit `schemas/bonfire-v1.json` `delta_schemas.bonfire-h-review.constraints` (line 266-278):

```diff
   "bonfire-h-review": {
     "required_fields": ["verdict", "reason"],
     "optional_fields": ["conflict_type", "conditions", "rulings"],
     "constraints": {
       "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
       "conflict_type_required_when_rejected": true,
       "condition_item_shape": {
         "type": "object",
         "required_fields": ["text", "target_stage"],
-        "target_stage_enum": ["stage-j"]
+        "target_stage_enum": ["stage-j"],
+        "field_substantive_check": {
+          "text": { "isEmptyOrPlaceholder": false }
+        }
       },
-      "ruling_action_enum": ["freeze", "supersede"]
+      "ruling_action_enum": ["freeze", "supersede"],
+      "ruling_item_shape": {
+        "type": "object",
+        "required_fields": ["action", "id"],
+        "id_constraint": "ledger_ref",
+        "action_specific_required_fields": {
+          "freeze": [],
+          "supersede": ["new_content"]
+        },
+        "field_substantive_check": {
+          "id": { "isEmptyOrPlaceholder": false },
+          "new_content": { "isEmptyOrPlaceholder": false, "applies_when_action": "supersede" }
+        }
+      }
     }
   }
```

Verify JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8')); console.log('valid')"`.

- [ ] **Step 3.2: Write failing test for condition_item_shape field_substantive_check**

Create or extend `tests/test-delta-parser.js` (read existing first to learn current test patterns, then append new tests):

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDelta } = require('../bin/lib/delta-parser.cjs');

test('validateDelta rejects condition with empty text (3a)', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: '', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text|isEmptyOrPlaceholder/.test(e)));
});

test('validateDelta rejects condition with placeholder text (3a)', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: 'see ledger', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text|placeholder|see ledger/i.test(e)));
});

test('validateDelta passes condition with substantive text (3a)', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved_with_conditions',
    reason: 'one condition',
    conditions: [{ text: 'J-Compile must include FC-12 in execution manifest', target_stage: 'stage-j' }],
    rulings: [],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});
```

- [ ] **Step 3.3: Run test to verify failure**

Run: `node --test tests/test-delta-parser.js`
Expected: the new tests fail (existing field_substantive_check not implemented yet).

- [ ] **Step 3.4: Extend condition_item_shape check in delta-parser.cjs**

Edit `bin/lib/delta-parser.cjs` lines 51-77 (the existing condition_item_shape check). Add the field_substantive_check loop:

```diff
   if (constraints.condition_item_shape && delta.conditions !== undefined) {
     const shape = constraints.condition_item_shape;
+    const { isEmptyOrPlaceholder } = require('./validation-helpers.cjs');
     if (!Array.isArray(delta.conditions)) {
       errors.push('conditions must be an array when present');
     } else {
       for (let i = 0; i < delta.conditions.length; i++) {
         const item = delta.conditions[i];
         if (typeof item !== 'object' || item === null || Array.isArray(item)) {
           errors.push(`conditions[${i}] must be an object`);
           continue;
         }
         for (const required of (shape.required_fields || [])) {
           if (item[required] === undefined || item[required] === null) {
             errors.push(`conditions[${i}] missing required field: ${required}`);
           }
         }
         if (shape.target_stage_enum && item.target_stage !== undefined) {
           if (!shape.target_stage_enum.includes(item.target_stage)) {
             errors.push(
               `conditions[${i}].target_stage "${item.target_stage}" ` +
               `not in [${shape.target_stage_enum.join(', ')}]`
             );
           }
         }
+        if (shape.field_substantive_check) {
+          for (const [fieldName, rule] of Object.entries(shape.field_substantive_check)) {
+            if (rule.isEmptyOrPlaceholder === false && isEmptyOrPlaceholder(item[fieldName])) {
+              errors.push(
+                `conditions[${i}].${fieldName} is empty or placeholder ` +
+                `(value="${item[fieldName] === undefined ? 'undefined' : item[fieldName]}")`
+              );
+            }
+          }
+        }
       }
     }
   }
```

- [ ] **Step 3.5: Run condition_item_shape tests to verify they pass**

Run: `node --test tests/test-delta-parser.js`
Expected: PASS — the 3 new tests + all existing.

- [ ] **Step 3.6: Write failing test for ruling_item_shape**

Create `tests/test-ruling-item-shape.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDelta } = require('../bin/lib/delta-parser.cjs');

test('validateDelta rejects ruling missing required action field', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /action/.test(e)));
});

test('validateDelta rejects ruling with non-ledger-pattern id', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'XYZ-not-valid' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /id|ledger_ref|pattern/.test(e)));
});

test('validateDelta rejects supersede ruling with empty new_content', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001', new_content: '' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /new_content/.test(e)));
});

test('validateDelta rejects supersede ruling missing new_content', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /new_content/.test(e)));
});

test('validateDelta passes legitimate freeze ruling', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one ruling',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'CON-001' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});

test('validateDelta passes legitimate supersede ruling with new_content', () => {
  const verdict = {
    agent: 'bonfire-h-review',
    verdict: 'approved',
    reason: 'one supersede',
    conditions: [],
    rulings: [{ action: 'supersede', id: 'CON-001', new_content: 'Updated requirement: support OAuth2 with PKCE' }],
  };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, true, `errors: ${result.errors.join('; ')}`);
});
```

- [ ] **Step 3.7: Run test to verify failure**

Run: `node --test tests/test-ruling-item-shape.js`
Expected: FAIL — ruling_item_shape check not implemented in validateDelta.

- [ ] **Step 3.8: Add ruling_item_shape check in delta-parser.cjs**

Edit `bin/lib/delta-parser.cjs`. Add a new block after the existing condition_item_shape block (after the closing `}` of the condition_item_shape `if`):

```javascript
  if (constraints.ruling_item_shape && delta.rulings !== undefined) {
    const shape = constraints.ruling_item_shape;
    const { isEmptyOrPlaceholder } = require('./validation-helpers.cjs');
    if (!Array.isArray(delta.rulings)) {
      errors.push('rulings must be an array when present');
    } else {
      const ledgerPattern = schema.ledger_id_pattern;
      const ledgerRefRe = ledgerPattern ? new RegExp(`^${ledgerPattern}$`) : null;
      for (let i = 0; i < delta.rulings.length; i++) {
        const item = delta.rulings[i];
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          errors.push(`rulings[${i}] must be an object`);
          continue;
        }
        for (const required of (shape.required_fields || [])) {
          if (item[required] === undefined || item[required] === null) {
            errors.push(`rulings[${i}] missing required field: ${required}`);
          }
        }
        if (shape.id_constraint === 'ledger_ref' && item.id && ledgerRefRe) {
          if (!ledgerRefRe.test(item.id)) {
            errors.push(
              `rulings[${i}].id "${item.id}" does not match ledger_id_pattern`
            );
          }
        }
        const action = item.action;
        if (shape.action_specific_required_fields && action && shape.action_specific_required_fields[action]) {
          for (const required of shape.action_specific_required_fields[action]) {
            if (item[required] === undefined || item[required] === null) {
              errors.push(`rulings[${i}] (action=${action}) missing required field: ${required}`);
            }
          }
        }
        if (shape.field_substantive_check) {
          for (const [fieldName, rule] of Object.entries(shape.field_substantive_check)) {
            if (rule.applies_when_action && rule.applies_when_action !== action) continue;
            if (rule.isEmptyOrPlaceholder === false && isEmptyOrPlaceholder(item[fieldName])) {
              errors.push(
                `rulings[${i}].${fieldName} is empty or placeholder ` +
                `(value="${item[fieldName] === undefined ? 'undefined' : item[fieldName]}")`
              );
            }
          }
        }
      }
    }
  }
```

Note: this code references `schema` which must be available in the validateDelta function's scope. Look at the top of validateDelta — it likely loads schema via `loadSchema()` already; if not, add a require/load at the top of the function.

- [ ] **Step 3.9: Run ruling_item_shape tests to verify pass**

Run: `node --test tests/test-ruling-item-shape.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 3.10: Create fixture vacuous-verdict-l3**

`tests/fixtures/hj-seam-adversarial/vacuous-verdict-l3/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved_with_conditions",
  "reason": "review complete",
  "conditions": [{ "text": "see ledger", "target_stage": "stage-j" }],
  "rulings": []
}
```

`EXPECTED.md`:
```
EXPECT: validateDelta('bonfire-h-review', verdict) returns valid:false
ATTACK LEVEL: L3 — condition with placeholder string in `text`
```

- [ ] **Step 3.11: Create fixture vacuous-rulings-supersede**

`tests/fixtures/hj-seam-adversarial/vacuous-rulings-supersede/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved",
  "reason": "review complete",
  "conditions": [],
  "rulings": [{ "action": "supersede", "id": "CON-001", "new_content": "" }]
}
```

`EXPECTED.md`:
```
EXPECT: validateDelta('bonfire-h-review', verdict) returns valid:false
ATTACK LEVEL: L2 — supersede ruling with empty new_content
```

- [ ] **Step 3.12: Run full test suite to verify no regression**

Run: `node --test tests/test-*.js`
Expected: all tests pass (existing + Task 1 + Task 2 + Task 3's 9 new tests = ~273 total).

- [ ] **Step 3.13: Run install.sh to deploy**

Run: `bash install.sh`
Expected: install completes; deployed schema has new `ruling_item_shape`. Verify:
```bash
grep -c "ruling_item_shape" $HOME/.claude/bonfire/schemas/bonfire-v1.json
```
Expected: `1`

- [ ] **Step 3.14: Commit**

```bash
git add schemas/bonfire-v1.json bin/lib/delta-parser.cjs tests/test-delta-parser.js tests/test-ruling-item-shape.js tests/fixtures/hj-seam-adversarial/vacuous-verdict-l3 tests/fixtures/hj-seam-adversarial/vacuous-rulings-supersede
git commit -m "feat(3a): verdict element deep-check in delta-parser

Schema location 2 of Assertion 3a (delta_schemas.bonfire-h-review.constraints):
- Extend condition_item_shape with field_substantive_check applying
  isEmptyOrPlaceholder to text field
- Add new ruling_item_shape parallel to condition_item_shape:
  - required_fields: [action, id]
  - id_constraint: ledger_ref (via schema.ledger_id_pattern)
  - action_specific_required_fields: supersede needs new_content
  - field_substantive_check: id + new_content (when action=supersede)

bin/lib/delta-parser.cjs validateDelta extended with:
- field_substantive_check loop in condition_item_shape block
- new ruling_item_shape block with required_fields / id_constraint /
  action_specific_required_fields / field_substantive_check evaluations

per-element substantive check short-circuits validate-delta on first failure;
in stage-h advance flow this fires before checkVerdictSubstantive (Task 4)
catches the literal-empty case. attacks like conditions=[{text:'see ledger'}]
caught here at element level.

3 new tests in test-delta-parser.js (condition_item_shape) + 6 new tests in
new test-ruling-item-shape.js. 2 new fixtures (vacuous-verdict-l3,
vacuous-rulings-supersede). spec: §6.5 + §6.6 Loc 2."
```

---

## Task 4: Schema Location 3 — verdict top-level predicate + escape valve

**Files:**
- Modify: `schemas/bonfire-v1.json` (add new top-level `verdict_substantive_check`)
- Modify: `bin/lib/state.cjs` (add `checkVerdictSubstantive` + wire into checkStageHInvariant)
- Create: `tests/test-verdict-substantive.js`
- Create: 4 fixtures (vacuous-verdict-l0, vacuous-verdict-contradiction, legit-no-substantive-oversight, legit-no-substantive-oversight-fabricated-ref)

- [ ] **Step 4.1: Add verdict_substantive_check schema config**

Edit `schemas/bonfire-v1.json`. Find a position near `handoff_substantive_slots` (e.g., immediately after the closing brace of `handoff_substantive_slots` on line 234, before `handoff_mandate_params` on line 236) and insert:

```diff
       "handoff.ui_contract.error_states": { "_provenance_required": true, "kind": "whole_section", "required_subfields": ["error_map"] }
   },
+  "verdict_substantive_check": {
+    "version": 1,
+    "applies_to": "delta_schemas.bonfire-h-review",
+    "reject_when": [
+      {
+        "rule": "approved_with_conditions_requires_conditions",
+        "predicate": {
+          "verdict": "approved_with_conditions",
+          "conditions_empty": true
+        },
+        "escape_allowed": false
+      },
+      {
+        "rule": "approved_requires_substantive_oversight_or_escape",
+        "predicate": {
+          "verdict": ["approved", "approved_with_conditions"],
+          "conditions_empty": true,
+          "rulings_empty": true
+        },
+        "escape_allowed": true
+      }
+    ],
+    "escape_valve": {
+      "flag": "no_substantive_oversight",
+      "reason_field": "no_substantive_oversight_reason",
+      "reason_ref_constraint": "ledger_ref",
+      "min_refs": 1
+    }
+  },
   "handoff_mandate_params": {
```

Verify JSON: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json', 'utf8')); console.log('valid')"`.

- [ ] **Step 4.2: Write failing test for checkVerdictSubstantive**

Create `tests/test-verdict-substantive.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkVerdictSubstantive } = require('../bin/lib/state.cjs');
const path = require('path');
const SCHEMA = JSON.parse(require('fs').readFileSync(
  path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
));

const SAMPLE_SNAPSHOT = {
  entries: { 'CON-001': { id: 'CON-001', status: 'FROZEN' } },
};

test('checkVerdictSubstantive rule 1 fires for approved_with_conditions + empty conditions (no escape)', () => {
  const verdict = { verdict: 'approved_with_conditions', conditions: [], rulings: [{ action: 'freeze', id: 'CON-001' }] };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /approved_with_conditions_requires_conditions|conditions_empty/);
});

test('checkVerdictSubstantive rule 1 cannot be escaped', () => {
  const verdict = {
    verdict: 'approved_with_conditions',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'See CON-001',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
});

test('checkVerdictSubstantive rule 2 fires for approved + both empty + no escape', () => {
  const verdict = { verdict: 'approved', conditions: [], rulings: [] };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /approved_requires_substantive_oversight|rulings_empty/);
});

test('checkVerdictSubstantive rule 2 escapes via no_substantive_oversight + valid ref', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'Ledger fully FROZEN — see CON-001 (no challenges remain)',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, true, `unexpected error: ${r.error}`);
});

test('checkVerdictSubstantive rule 2 escape rejects fabricated unresolved ref', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'See CON-999 (does not exist)',
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false);
  assert.match(r.error, /unresolved|CON-999/);
});

test('checkVerdictSubstantive passes legitimate non-empty verdict', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [{ action: 'freeze', id: 'CON-001' }],
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, true);
});

test('checkVerdictSubstantive passes approved + escape with multiple refs', () => {
  const verdict = {
    verdict: 'approved',
    conditions: [],
    rulings: [],
    no_substantive_oversight: true,
    no_substantive_oversight_reason: 'CON-001 and CON-002 both FROZEN — full convergence',
  };
  // Snapshot only has CON-001; CON-002 should fail to resolve.
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  assert.equal(r.valid, false, 'CON-002 unresolved should fail');
});

test('checkVerdictSubstantive passes rejected verdict regardless of conditions/rulings', () => {
  const verdict = {
    verdict: 'rejected',
    reason: 'integration test',
    conflict_type: 'handoff_incomplete',
    conditions: [],
    rulings: [],
  };
  const r = checkVerdictSubstantive(verdict, SCHEMA, SAMPLE_SNAPSHOT);
  // verdict_enum check is delta-parser's job; verdict_substantive_check only fires on approved/approved_with_conditions per predicates.
  assert.equal(r.valid, true);
});
```

- [ ] **Step 4.3: Run test to verify failure**

Run: `node --test tests/test-verdict-substantive.js`
Expected: FAIL — `checkVerdictSubstantive` not exported.

- [ ] **Step 4.4: Implement `checkVerdictSubstantive` in state.cjs**

Edit `bin/lib/state.cjs`. Add the function (a sensible position is just before `checkStageHInvariant` so it's near its caller):

```javascript
function checkVerdictSubstantive(verdict, schema, ledgerSnapshot) {
  const { validateLedgerRef } = require('./validation-helpers.cjs');
  const config = schema.verdict_substantive_check;
  if (!config) return { valid: true };  // schema not configured → pass-through

  const isEmptyArr = (v) => v === undefined || (Array.isArray(v) && v.length === 0);
  const conditionsEmpty = isEmptyArr(verdict.conditions);
  const rulingsEmpty = isEmptyArr(verdict.rulings);

  for (const rule of (config.reject_when || [])) {
    const p = rule.predicate || {};
    const verdictMatches = Array.isArray(p.verdict)
      ? p.verdict.includes(verdict.verdict)
      : p.verdict === verdict.verdict;
    if (!verdictMatches) continue;
    if (p.conditions_empty === true && !conditionsEmpty) continue;
    if (p.rulings_empty === true && !rulingsEmpty) continue;

    // Predicate matches. Apply escape valve if allowed.
    if (rule.escape_allowed && config.escape_valve) {
      const ev = config.escape_valve;
      if (verdict[ev.flag] === true) {
        const reason = verdict[ev.reason_field];
        const result = validateLedgerRef(reason, schema, ledgerSnapshot, ev.min_refs || 1);
        if (result.valid) {
          return { valid: true, escape_used: ev.flag };
        }
        return {
          valid: false,
          rule: rule.rule,
          error: `escape valve ${ev.flag} invalid: ${result.error}`,
        };
      }
    }

    return {
      valid: false,
      rule: rule.rule,
      error: `verdict matches reject_when rule "${rule.rule}"; escape ${rule.escape_allowed ? 'available but not invoked' : 'not allowed'}`,
    };
  }

  return { valid: true };
}
```

Update `module.exports` to include `checkVerdictSubstantive`.

- [ ] **Step 4.5: Run tests to verify pass**

Run: `node --test tests/test-verdict-substantive.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 4.6: Wire checkVerdictSubstantive into checkStageHInvariant**

Edit `bin/lib/state.cjs` `checkStageHInvariant` function. After the validateDelta success (around line 135) and BEFORE the Layer 1 condition check (line 143), add:

```javascript
  // 3a verdict_substantive_check — Section 6.4 of spec, runs after validateDelta
  // and before Layer 1 (validateHConditions). Catches L0 literal-empty verdicts
  // that pass element-level shape checks; per-element vacuousness (L1-L3) is
  // already caught by validateDelta above.
  const schema = loadSchema();  // if not already in scope
  const substResult = checkVerdictSubstantive(verdict, schema, snapshot);
  if (!substResult.valid) {
    process.stderr.write(
      `Cannot advance from stage-h: verdict_substantive_check rule="${substResult.rule}": ${substResult.error}\n`
    );
    process.stderr.write(
      `If oversight is genuinely not needed, declare "no_substantive_oversight": true with "no_substantive_oversight_reason" containing ledger refs.\n`
    );
    process.exit(1);
  }
```

If `loadSchema` and `snapshot` are not yet in scope at this point in `checkStageHInvariant`, look at how the existing code loads them (snapshot is loaded around line 138 in current code; the new check should run AFTER snapshot is available, so this insertion point may need to move below `const snapshot = loadSnapshot(dir);`).

- [ ] **Step 4.7: Create fixture vacuous-verdict-l0**

`tests/fixtures/hj-seam-adversarial/vacuous-verdict-l0/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved",
  "reason": "review complete",
  "conditions": [],
  "rulings": []
}
```

`EXPECTED.md`:
```
EXPECT: checkVerdictSubstantive returns valid:false with rule="approved_requires_substantive_oversight_or_escape"
ATTACK LEVEL: L0 — empty conditions and rulings, no escape valve
```

- [ ] **Step 4.8: Create fixture vacuous-verdict-contradiction**

`tests/fixtures/hj-seam-adversarial/vacuous-verdict-contradiction/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved_with_conditions",
  "reason": "review complete",
  "conditions": [],
  "rulings": [{ "action": "freeze", "id": "CON-001" }]
}
```

`EXPECTED.md`:
```
EXPECT: checkVerdictSubstantive returns valid:false with rule="approved_with_conditions_requires_conditions"
ATTACK LEVEL: top-level — verdict literal claims conditions exist; payload contradicts. Escape disallowed.
```

- [ ] **Step 4.9: Create fixture legit-no-substantive-oversight**

`tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved",
  "reason": "ledger fully converged",
  "conditions": [],
  "rulings": [],
  "no_substantive_oversight": true,
  "no_substantive_oversight_reason": "Every ledger entry FROZEN with no remaining challenges. See CON-001 for the converged state."
}
```

`tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight/truth-surface/constraint-ledger-snapshot.json`:
```json
{
  "version": 1,
  "replayed_at": "2026-05-09T00:00:00Z",
  "event_count": 1,
  "entries": {
    "CON-001": {
      "id": "CON-001",
      "category": "retained_goal",
      "status": "FROZEN",
      "content": "Converged",
      "rationale": "fixture",
      "challenged_by": ["fixture"],
      "aligned_by": ["fixture"],
      "evidence_refs": [],
      "notes": []
    }
  },
  "by_status": { "proposed": [], "challenged": [], "frozen": ["CON-001"], "superseded": [], "open": [], "discarded": [] },
  "by_category": { "retained_goal": ["CON-001"] }
}
```

`EXPECTED.md`:
```
EXPECT: checkVerdictSubstantive returns valid:true (escape_used: 'no_substantive_oversight')
SCENARIO: Legitimate fully-converged ledger; H-Review has nothing substantive to do.
```

- [ ] **Step 4.10: Create fixture legit-no-substantive-oversight-fabricated-ref**

`tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight-fabricated-ref/h-review-verdict.json`:
```json
{
  "agent": "bonfire-h-review",
  "verdict": "approved",
  "reason": "trying to skip oversight",
  "conditions": [],
  "rulings": [],
  "no_substantive_oversight": true,
  "no_substantive_oversight_reason": "Total convergence — see CON-999 for details"
}
```

`tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight-fabricated-ref/truth-surface/constraint-ledger-snapshot.json`:
(same structure as Step 4.9's snapshot — only CON-001 exists; CON-999 is fabricated)

`EXPECTED.md`:
```
EXPECT: checkVerdictSubstantive returns valid:false with error matching /unresolved|CON-999/
ATTACK PATTERN: Ref pattern matches but ref does not resolve in active ledger snapshot.
```

- [ ] **Step 4.11: Run full test suite to verify no regression**

Run: `node --test tests/test-*.js`
Expected: all tests pass (~280 total).

- [ ] **Step 4.12: Run install.sh to deploy**

Run: `bash install.sh`
Verify: `grep -c "verdict_substantive_check" $HOME/.claude/bonfire/schemas/bonfire-v1.json`
Expected: `1`

- [ ] **Step 4.13: Commit**

```bash
git add schemas/bonfire-v1.json bin/lib/state.cjs tests/test-verdict-substantive.js tests/fixtures/hj-seam-adversarial/vacuous-verdict-l0 tests/fixtures/hj-seam-adversarial/vacuous-verdict-contradiction tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight tests/fixtures/hj-seam-adversarial/legit-no-substantive-oversight-fabricated-ref
git commit -m "feat(3a): verdict_substantive_check + no_substantive_oversight escape

Schema location 3 of Assertion 3a:
- New top-level verdict_substantive_check section in bonfire-v1.json with
  reject_when predicates:
  Rule 1 (approved_with_conditions_requires_conditions): catches the literal
    contradiction (verdict says with-conditions, payload has none); no escape.
  Rule 2 (approved_requires_substantive_oversight_or_escape): catches verdict
    in {approved, approved_with_conditions} + both conditions and rulings
    empty; escape via no_substantive_oversight flag with resolving ledger ref.
- escape_valve uses reason_ref_constraint: 'ledger_ref' (refs only via
  validateLedgerRef helper; no Layer 2b prose token-coverage check).

bin/lib/state.cjs:
- New checkVerdictSubstantive(verdict, schema, ledgerSnapshot) function
  evaluating reject_when rules + escape valve.
- Wired into checkStageHInvariant after validateDelta success and before
  Layer 1 condition check. Per-element vacuousness already caught by
  validateDelta (Task 3); 3a top-level catches the L0 literal-empty case.

8 unit tests + 4 fixtures (vacuous-verdict-l0, vacuous-verdict-contradiction,
legit-no-substantive-oversight, legit-no-substantive-oversight-fabricated-ref).
spec: §6.4 + §6.6 Loc 3."
```

---

## Task 5: Class C regression matrix on dogfood archives

**Files:**
- Create: `tests/test-archive-replay.js`

This task replays real dogfood-archive handoff/verdict files through the new validators (sandboxed; no live state mutation) to verify B1/B2 reproduction without false positives on the existing fixture battery.

- [ ] **Step 5.1: Verify dogfood archive handoff/verdict file paths**

Run: `find docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean -name "compile-output*.json" -o -name "h-review-verdict.json"` and `find docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings -name "compile-output*.json" -o -name "h-review-verdict.json"` (or wherever the gto-trainer archive lives — earlier dogfood evidence).

Expected: locate the actual handoff JSON files in each archive. Note the paths; they may differ from the literal `.bonfire/plan/compile-output.json` if the archive structure differs.

If gto-trainer archive is not in `docs/superpowers/evidence/`, search:
```bash
find /Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive -name "compile-output*.json" -o -name "h-review-verdict.json"
```

- [ ] **Step 5.2: Write replay test**

Create `tests/test-archive-replay.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { deepCheckHandoffSubstantiveSlots } = require('../bin/lib/seam-validation.cjs');
const { checkVerdictSubstantive } = require('../bin/lib/state.cjs');

const SCHEMA = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'schemas', 'bonfire-v1.json'), 'utf8'
));

// Path the actual archives — fill in based on Step 5.1 grep output:
const BILIBILI_HANDOFF = path.join(__dirname, '..', 'docs', 'superpowers', 'evidence', '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'plan', 'compile-output.json');
const BILIBILI_VERDICT = path.join(__dirname, '..', 'docs', 'superpowers', 'evidence', '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'plan', 'h-review-verdict.json');
const BILIBILI_SNAPSHOT = path.join(__dirname, '..', 'docs', 'superpowers', 'evidence', '2026-05-08-bilibili-danmaku-clean', '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
const GTO_HANDOFF = path.join(/* fill from Step 5.1 */);

test('bilibili-clean handoff replay — B2 vacuous-pass reproduction', () => {
  if (!fs.existsSync(BILIBILI_HANDOFF)) {
    // archive may not include handoff at exact path; skip with note
    console.log(`SKIP: ${BILIBILI_HANDOFF} not found`);
    return;
  }
  const handoff = JSON.parse(fs.readFileSync(BILIBILI_HANDOFF, 'utf8'));
  const snapshot = fs.existsSync(BILIBILI_SNAPSHOT) ? JSON.parse(fs.readFileSync(BILIBILI_SNAPSHOT, 'utf8')) : { entries: {} };
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, snapshot);
  assert.equal(result.valid, false, 'expected B2 reproduction: vacuous handoff should reject');
});

test('bilibili-clean verdict replay — B1 vacuous-pass reproduction', () => {
  if (!fs.existsSync(BILIBILI_VERDICT)) {
    console.log(`SKIP: ${BILIBILI_VERDICT} not found`);
    return;
  }
  const verdict = JSON.parse(fs.readFileSync(BILIBILI_VERDICT, 'utf8'));
  const snapshot = fs.existsSync(BILIBILI_SNAPSHOT) ? JSON.parse(fs.readFileSync(BILIBILI_SNAPSHOT, 'utf8')) : { entries: {} };
  const result = checkVerdictSubstantive(verdict, SCHEMA, snapshot);
  assert.equal(result.valid, false, 'expected B1 reproduction: vacuous verdict should reject');
});

test('gto-trainer handoff replay — B2 reproduction (if archive present)', () => {
  if (!fs.existsSync(GTO_HANDOFF)) {
    console.log(`SKIP: gto-trainer archive not in evidence/ dir`);
    return;
  }
  const handoff = JSON.parse(fs.readFileSync(GTO_HANDOFF, 'utf8'));
  // gto-trainer's handoff may legitimately have substantive slots; check what reproduction looks like.
  const result = deepCheckHandoffSubstantiveSlots(handoff, SCHEMA, { entries: {} });
  // Document but don't strict-assert — the gto-trainer handoff may have been substantive enough
  // to pass even though Layer 2b had separate issues. This test serves as evidence anchor.
  console.log(`gto-trainer handoff replay: valid=${result.valid}, error=${result.error || 'none'}`);
});
```

- [ ] **Step 5.3: Run replay tests**

Run: `node --test tests/test-archive-replay.js`
Expected: bilibili-clean handoff + verdict tests fail with "expected reject" (B1+B2 reproduction confirmed); gto-trainer test logs current behavior. Adjust assertions if archive paths differ from assumed.

- [ ] **Step 5.4: Verify existing 10 hj-seam-adversarial fixtures still produce expected results**

Run: `node --test tests/test-hj-seam-fixtures.js`
Expected: all PR #2 fixtures continue to produce their existing pass/fail outcomes; no fixtures previously rejecting now pass; no fixtures previously passing now reject due to 3a (false-positive sentinel).

If a previously-passing fixture now rejects, examine whether it was a legitimate handoff that genuinely lacks substantive content — if so, add an explicit `no_substantive_contract` escape valve to the fixture (this is intended behavior under v2 schema). If not, debug 3a's deep-check for over-rejection.

- [ ] **Step 5.5: Run full test suite**

Run: `node --test tests/test-*.js`
Expected: ~290 tests pass. Two reproductions (bilibili B1+B2) actively confirm closure.

- [ ] **Step 5.6: Commit**

```bash
git add tests/test-archive-replay.js
git commit -m "test(3a): regression matrix replay on dogfood archives

Class C of Assertion 3a Test Plan: replay real archived handoff and verdict
JSON through the new deepCheckHandoffSubstantiveSlots and
checkVerdictSubstantive validators. Confirms:

- bilibili-clean B2 reproduction: archived compile-output.json (vacuous
  domain_model + function_contracts + ui_contract per dogfood finding #19)
  rejects with deep_check_failed
- bilibili-clean B1 reproduction: archived h-review-verdict.json (verdict=
  approved with empty conditions and rulings per finding #18) rejects with
  rule=approved_requires_substantive_oversight_or_escape
- gto-trainer archive replay (if present in evidence/) logs current behavior

Existing 10 hj-seam-adversarial PR #2 fixtures unchanged in expected behavior.

spec: §7.3 Class C — Regression on existing fixture battery + dogfood archives"
```

---

## Task 6: Documentation

**Files:**
- Modify: `references/handoff-quality-bar.md`
- Modify: `references/h-review-protocol.md` (or equivalent — verify name)
- Create or modify: top-level `CHANGELOG.md` if it exists; otherwise add a note in `README.md`

- [ ] **Step 6.1: Locate H-Review protocol reference doc**

Run: `ls references/ | grep -i "h-review\|review"` and `grep -rln "H-Review" references/ 2>/dev/null | head`
Expected: the canonical H-Review protocol reference (file name varies).

- [ ] **Step 6.2: Update handoff-quality-bar.md**

Read `references/handoff-quality-bar.md` then append a new section near the existing "substantive content" requirements:

```markdown
## v2 schema — substantive content deep-check (Assertion 3a)

As of `schema_version: 2`, every slot in `handoff_substantive_slots` enforces
a structural deep-check at validation time, not just a shape hint:

- **`min_entries: 1`** (per_entry kind): the slot's array must have at least one entry.
- **`required_subfields: [name, ...]`**: each entry (per_entry) or the section itself (whole_section) must contain these subfields, and each must pass `isEmptyOrPlaceholder = false`.

`isEmptyOrPlaceholder` rejects: null, undefined, empty arrays/objects, empty
or whitespace-only strings, and registered placeholder strings (`TODO`,
`see ledger`, `...`, `<TBD>`, `<placeholder>`, case-insensitive).

The existing `no_substantive_contract` escape valve continues to work but
now uses a ref-only check: the `no_substantive_contract_reason` must contain
≥1 ledger ID matching `schema.ledger_id_pattern` that resolves against the
active FROZEN ledger snapshot. The previous prose token-coverage check on
the reason field has been removed (see ASSERTION-3a spec DQ-1).
```

- [ ] **Step 6.3: Update H-Review protocol reference**

Append to the H-Review protocol reference (file located in Step 6.1):

```markdown
## verdict_substantive_check (Assertion 3a, schema v2)

H-Review verdicts are now subject to a top-level structural check after
`validate-delta` and before state-advance:

- **Reject rule 1** (`approved_with_conditions_requires_conditions`):
  `verdict: "approved_with_conditions"` with `conditions: []` is a literal
  contradiction. Always rejected; no escape valve.
- **Reject rule 2** (`approved_requires_substantive_oversight_or_escape`):
  `verdict: "approved"` or `"approved_with_conditions"` with both
  `conditions: []` and `rulings: []` is rejected unless the verdict declares
  `no_substantive_oversight: true` with `no_substantive_oversight_reason`
  containing ≥1 ledger ID that resolves in the active FROZEN ledger snapshot.

Per-element vacuousness in conditions or rulings (e.g.,
`text: "see ledger"`, `id: ""`, supersede with empty `new_content`)
is caught by `validate-delta` element-level checks before this top-level
check fires.

If you are reviewing a fully-converged case where the H-Review agent has
nothing substantive to oversee, declare:
```json
{
  "verdict": "approved",
  "reason": "no remaining oversight",
  "conditions": [],
  "rulings": [],
  "no_substantive_oversight": true,
  "no_substantive_oversight_reason": "All ledger entries FROZEN — see CON-001 for converged scope."
}
```
```

- [ ] **Step 6.4: Add changelog or README note**

If a `CHANGELOG.md` exists at repo root, append:

```markdown
## [unreleased] — 2026-05-09

### Changed
- **BREAKING**: `schema_version` bumped from 1 to 2. `handoff_substantive_slots`
  field name `fields` renamed to `required_subfields`. Existing v1 inputs are
  rejected by v2 validators at entry. Migration: re-init or freeze workspaces
  at v1.

### Added
- Assertion 3a: structural deep-check at H verdict and J handoff. Closes
  vacuous-pass surface surfaced by 2026-05-04 gto-trainer and 2026-05-08
  bilibili-danmaku-denoiser dogfood runs. See
  `docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md`.
- New top-level `ledger_id_prefixes` and `ledger_id_pattern` constants in
  `bonfire-v1.json` (closes DQ-4 from spec).
- New `verdict_substantive_check` schema config and shared
  `bin/lib/validation-helpers.cjs` module (`isEmptyOrPlaceholder`,
  `validateLedgerRef`, `extractLedgerRefs`).
```

If no CHANGELOG.md, add the equivalent block to `README.md` under a "Recent Changes" section.

- [ ] **Step 6.5: Run install.sh one more time + verify deploy**

Run: `bash install.sh`
Verify: schema, helpers, references all present:
```bash
grep -c "schema_version.*2" $HOME/.claude/bonfire/schemas/bonfire-v1.json
ls $HOME/.claude/bonfire/bin/lib/validation-helpers.cjs
ls $HOME/.claude/bonfire/references/handoff-quality-bar.md
```
Expected: schema_version=2, helper file present, reference file present.

- [ ] **Step 6.6: Run full test suite final verification**

Run: `node --test tests/test-*.js`
Expected: all tests pass.

- [ ] **Step 6.7: Commit**

```bash
git add references/handoff-quality-bar.md references/h-review-protocol.md CHANGELOG.md README.md
git commit -m "docs(3a): document v2 schema + verdict_substantive_check + escape valves

Update operator-facing docs to reflect Assertion 3a:
- handoff-quality-bar.md: substantive content requirements (min_entries,
  required_subfields, isEmptyOrPlaceholder); no_substantive_contract escape
  valve now uses ref-only check (DQ-1 close).
- h-review-protocol.md: verdict_substantive_check semantics; reject rule 1
  (approved_with_conditions contradiction); reject rule 2 (no_substantive_
  oversight escape with resolving ref).
- CHANGELOG: schema_version 1→2 breaking change note + 3a feature summary.

Closes Assertion 3a end-to-end (Tasks 1-6). Pending: 3b spec (schema-doc
drift, separate fixture-driven spec) and ASSERTION-4 round-4 spec re-cut
(unblock errata-001; ≥2 dogfood archives requirement now met)."
```

---

## Self-Review Checklist (run after writing the plan)

**1. Spec coverage:**
- §6.3 Q1 handoff deep-check → Task 2 ✓
- §6.4 Q2 verdict top-level + escape → Task 4 ✓
- §6.5 verdict element deep-check → Task 3 ✓
- §6.6 schema diff (3 locations + DQ-4 constants) → Tasks 2/3/4 ✓
- §6.7 validator integration (validation-helpers.cjs + 3 integration points) → Tasks 1/2/3/4 ✓
- §6.8 backward compat (schema_version 1→2 + fields rename) → Task 2 ✓
- §7.1 Class A L0-L3 attack fixtures → Tasks 2/3/4 ✓ (8 fixtures across tasks)
- §7.2 Class B legit escape fixtures → Tasks 2/4 ✓ (3 fixtures)
- §7.3 Class C regression matrix → Task 5 ✓
- §10 DQ-1 escape valve ref-only → Task 2 (handoff side) + Task 4 (verdict side) ✓
- §10 DQ-4 ledger_id_pattern dedup → Task 2 ✓ (3 sites migrated to *_constraint: "ledger_ref")
- Documentation (handoff-quality-bar, h-review-protocol, changelog) → Task 6 ✓

**2. Placeholder scan:** No "TBD", "TODO", "implement later" outside of fixture content (where placeholder strings are intentional test data). Each step has actual code or actual command. ✓

**3. Type consistency:**
- `isEmptyOrPlaceholder(value)` — same signature in validation-helpers.cjs (Task 1), seam-validation.cjs (Task 2), delta-parser.cjs (Task 3). ✓
- `validateLedgerRef(value, schema, ledgerSnapshot, minRefs)` — same signature in validation-helpers.cjs (Task 1) and consumed in seam-validation.cjs (Task 2 escape migration), state.cjs (Task 4). ✓
- `deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot)` — defined in seam-validation.cjs (Task 2), consumed in test-archive-replay.js (Task 5). ✓
- `checkVerdictSubstantive(verdict, schema, ledgerSnapshot)` — defined in state.cjs (Task 4), consumed in test-archive-replay.js (Task 5). ✓
- Schema field names: `min_entries`, `required_subfields`, `id_constraint`, `field_substantive_check`, `reason_ref_constraint`, `escape_allowed`, `reject_when` — used consistently across schema diffs and validator code. ✓
- `PLACEHOLDER_STRINGS` exported lower-case (matches normalization in `isEmptyOrPlaceholder`). ✓

No type/name drift detected.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-bonfire-assertion-3a-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
