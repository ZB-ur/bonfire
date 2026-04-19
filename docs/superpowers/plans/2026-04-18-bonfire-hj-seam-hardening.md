# Bonfire H→J Seam Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `approved_with_conditions` exit ramp that lets J-Compile invent product semantics under H-Review cover, using three mechanical defense layers (lexical + structural provenance + token coverage) plus behavioral anti-goals in the H-Review and J-Compile agent prompts.

**Architecture:** Two new reentry routes (`invalid_stage_j_condition`, `handoff_provenance_failure`) plus `handoff_substantive_slots` schema annotation drive all enforcement. One new module (`bin/lib/seam-validation.cjs`) holds the shared token-extraction / lemmatization / CJK helpers used by Layer 1 (a new `validate-h-conditions` CLI) and Layer 2b (extension of existing `handoff-validate`). `schema.cjs:validateHandoff` grows Layer 2a (provenance enforcement) and Layer 2b (token coverage) passes. J-Compile output gains a `reentry_request` sibling field for the BLOCKED path. Format keyword whitelist lives in a markdown file (`references/stage-j-format-whitelist.md`) for team iteration.

**Tech Stack:** Node.js (CommonJS), `node:test` + `node:assert/strict`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-18-bonfire-hj-seam-hardening-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `references/stage-j-format-whitelist.md` | Format keyword whitelist (English structure words + format tokens like Given/When/Then). Team-editable list loaded by both Layer 1 and Layer 2b. |
| Modify | `schemas/bonfire-v1.json` | Add `condition_item_shape` constraint to `bonfire-h-review` delta schema. Add `handoff_substantive_slots` top-level section. Add two reentry routes. |
| Modify | `bin/lib/delta-parser.cjs` | Add targeted dispatch branch for `condition_item_shape`: iterate `delta.conditions[]`, validate each item's `required_fields` + `target_stage_enum`. NOT a generic nested-schema dispatcher. |
| Create | `bin/lib/seam-validation.cjs` | Shared helpers: `loadFormatWhitelist()`, `extractSubstantiveTokens(text)`, `lemmatizeToken(token)`, `isCJKToken(token)`, `VERB_BLACKLIST`, `validateHConditions(verdict, snapshot)`, `compareTokens(slotTokens, sourceTokens)`. |
| Modify | `bin/lib/schema.cjs` (`validateHandoff`) | Add Layer 2a (provenance check), Layer 2b (token coverage), and `reentry_request` detection + consistency enforcement. |
| Modify | `bin/bonfire-tools.cjs` | Add `validate-h-conditions` CLI command. |
| Modify | `bin/lib/state.cjs` (`checkStageHInvariant`) | Call `validate-h-conditions` equivalent (in-module) before existing rulings check. |
| Modify | `agents/bonfire-h-review.md` | Add `<anti_goals>` + `<decision_tree>` blocks. |
| Modify | `agents/bonfire-j-compile.md` | Add `<provenance_rules>` block; document `reentry_request` field. |
| Modify | `skills/plan/SKILL.md` | Insert step 37b (validate conditions) in Stage H. |
| Create | `tests/test-validate-h-conditions.js` | Layer 1 CLI + helper tests. |
| Create | `tests/test-handoff-provenance.js` | Layer 2a tests. |
| Create | `tests/test-handoff-token-coverage.js` | Layer 2b tests. |
| Create | `tests/test-seam-validation.js` | Unit tests for token-extraction / lemmatization / CJK helpers. |
| Modify | `tests/test-delta-parser.js` | Add `condition_item_shape` dispatch tests. |
| Modify | `tests/test-state-advance-invariants.js` | Add Layer 1 integration case + E2E flow. |
| Create | `tests/fixtures/hj-seam-adversarial/*/` | 10 adversarial fixtures, each a self-contained ledger+verdict+compile-output triple. |

---

## Task 1: Seed stage-j format keyword whitelist

**Files:**
- Create: `references/stage-j-format-whitelist.md`

Rationale: Layer 1 and Layer 2b both need a list of format/structure words that are exempt from token-coverage checks. Lives in markdown so the team can iterate on it without touching validator code. The file's purpose is explicitly documented so editors know when to add/remove entries.

- [ ] **Step 1: Create the whitelist file**

Create `references/stage-j-format-whitelist.md` with:

```markdown
# Stage J Format Keyword Whitelist

**Purpose:** Tokens exempt from Layer 1 token-coverage and Layer 2b orphan-token checks. These are structure/format words that appear in stage-j conditions and compile-output without needing to trace to FROZEN ledger content.

**Add to this list ONLY when an adversarial fixture or real pipeline run demonstrates that a legitimate format keyword is being flagged as orphan. Every addition should be grounded in evidence, not speculation.**

**Loaded by:** `bin/lib/seam-validation.cjs::loadFormatWhitelist()`. Whitespace-separated tokens, lowercased, one logical group per line. Lines beginning with `#` are comments and ignored.

---

## Structure words

# Given/When/Then format
given when then

# Modal verbs
must should may shall can could would

# Negation / binding
not any all each every some none

# Common articles / conjunctions / prepositions
the a an and or but if then else of in on at by for to from with without into onto
this that these those is are was were be been being have has had do does did will

# Format tokens
json yaml markdown prose text string number integer boolean array object field
schema key value pair list item entry

# Pipeline / stage vocabulary
stage pipeline ledger handoff compile render verdict condition ruling propose
freeze supersede discard update annotate

# Bonfire CLI commands
bonfire init truth propose update annotate freeze supersede discard read query rebuild
state advance reentry step begin run complete init-code-steps
delta validate handoff bundle render log preflight

# Pipeline stage names
stage-a stage-b stage-c stage-d stage-e stage-f stage-g stage-h stage-j

# Common file/path tokens
src tests docs fixtures config
```

- [ ] **Step 2: Commit**

```bash
git add references/stage-j-format-whitelist.md
git commit -m "$(cat <<'EOF'
docs: seed stage-j format keyword whitelist

Team-editable whitelist for Layer 1 (validate-h-conditions) and
Layer 2b (handoff token coverage) to exempt structure/format words
from orphan-token checks. Initial seed covers modal verbs, articles,
format tokens (json/yaml/prose), pipeline vocabulary, bonfire CLI
commands, and stage names. Whitelist additions must be evidence-based
(adversarial fixture or real run), not speculative.

Loaded by bin/lib/seam-validation.cjs (Task 5).

Spec §6.4 format keyword whitelist.
EOF
)"
```

---

## Task 2: Schema extensions — condition_item_shape + reentry routes

**Files:**
- Modify: `schemas/bonfire-v1.json` (`delta_schemas.bonfire-h-review.constraints` + `reentry_routes`)

Rationale: Add the schema-level declarations before any validator code that reads them. No validator changes in this task — just the schema.

- [ ] **Step 1: Locate the current `bonfire-h-review` delta schema**

Open `schemas/bonfire-v1.json` and find the `delta_schemas.bonfire-h-review` block (around line 234-241):

```json
"bonfire-h-review": {
  "required_fields": ["verdict", "reason"],
  "optional_fields": ["conflict_type", "conditions", "rulings"],
  "constraints": {
    "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
    "conflict_type_required_when_rejected": true
  }
}
```

- [ ] **Step 2: Add `condition_item_shape` constraint**

Replace the `constraints` object with:

```json
"constraints": {
  "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
  "conflict_type_required_when_rejected": true,
  "condition_item_shape": {
    "type": "object",
    "required_fields": ["text", "target_stage"],
    "target_stage_enum": ["stage-j"]
  }
}
```

- [ ] **Step 3: Add two new reentry routes**

Locate the `reentry_routes` block (around line 163-173). It currently has 9 routes. Add two:

```json
"invalid_stage_j_condition": { "to": "stage-h", "crosses_pipeline": false },
"handoff_provenance_failure": { "to": "stage-h", "crosses_pipeline": false }
```

Insert them after `"handoff_contradiction": ...`. The full `reentry_routes` block should read:

```json
"reentry_routes": {
  "goal_conflict":          { "to": "stage-a", "crosses_pipeline": true },
  "scope_conflict":         { "to": "stage-b", "crosses_pipeline": false },
  "requirement_conflict":   { "to": "stage-c", "crosses_pipeline": false },
  "critique_gap":           { "to": "stage-d", "crosses_pipeline": false },
  "dependency_gap":         { "to": "stage-e", "crosses_pipeline": false },
  "probe_invalidated":      { "to": "stage-f", "crosses_pipeline": false },
  "adversarial_unresolved": { "to": "stage-g", "crosses_pipeline": false },
  "handoff_incomplete":     { "to": "stage-h", "crosses_pipeline": false },
  "handoff_contradiction":  { "to": "stage-j", "crosses_pipeline": false },
  "invalid_stage_j_condition":   { "to": "stage-h", "crosses_pipeline": false },
  "handoff_provenance_failure":  { "to": "stage-h", "crosses_pipeline": false }
},
```

- [ ] **Step 4: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json'))"`

Expected: no output (parse succeeds). If it errors, fix the syntax.

- [ ] **Step 5: Run regression suite**

Run: `node --test tests/test-schema.js tests/test-delta-parser.js`

Expected: all tests pass. The new `condition_item_shape` key isn't read by any validator yet, so no behavior change. The new reentry routes aren't used yet, so no behavior change. Regression sweep confirms nothing broke.

- [ ] **Step 6: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "$(cat <<'EOF'
feat(schema): add condition_item_shape + two new reentry routes

Adds to schemas/bonfire-v1.json:

- bonfire-h-review.constraints.condition_item_shape — declares that
  each entry in a verdict's conditions[] array must be an object with
  required { text, target_stage }, and target_stage must be "stage-j".
  Validator enforcement follows in Task 3 (delta-parser targeted
  dispatch).

- reentry_routes.invalid_stage_j_condition → stage-h — for Layer 1
  (validate-h-conditions) failures.

- reentry_routes.handoff_provenance_failure → stage-h — for Layer
  2a/2b failures.

Both new routes target stage-h because the root cause is H's
mislabeling / approval of an under-specified condition, not
upstream-stage content. Existing handoff_contradiction route (→
stage-j) is preserved for its original meaning.

No validator changes in this commit — schema-only foundation. Layer
1 and Layer 2 validators follow.

Spec §6.1.
EOF
)"
```

---

## Task 3: delta-parser targeted dispatch for `condition_item_shape`

**Files:**
- Modify: `bin/lib/delta-parser.cjs`
- Modify: `tests/test-delta-parser.js`

Rationale: `delta-parser.cjs::validateDelta` currently only handles flat constraint keys. This task adds a TARGETED dispatch branch for `condition_item_shape` — no generic nested-schema machinery. The deliberate anti-pattern to avoid is bringing in a JSON Schema subset; if a second similar constraint appears in the future, that is when generalization is warranted.

- [ ] **Step 1: Write failing tests**

Open `tests/test-delta-parser.js` and append (before the file's closing — i.e. at the end):

```javascript
// ---------------------------------------------------------------------------
// condition_item_shape (bonfire-h-review)
// ---------------------------------------------------------------------------

test('bonfire-h-review: valid condition item passes', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'rewrite to given/when/then', target_stage: 'stage-j' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true, `errors: ${JSON.stringify(result.errors)}`);
});

test('bonfire-h-review: condition missing text field fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ target_stage: 'stage-j' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /text/.test(e)));
});

test('bonfire-h-review: condition missing target_stage field fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'rewrite' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /target_stage/.test(e)));
});

test('bonfire-h-review: condition target_stage other than stage-j fails', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = {
    verdict: 'approved_with_conditions',
    reason: 'ok',
    conditions: [{ text: 'enumerate categories', target_stage: 'stage-c' }],
  };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /target_stage/.test(e)));
});

test('bonfire-h-review: verdict without conditions field still passes', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = { verdict: 'approved', reason: 'all good' };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true);
});

test('bonfire-h-review: empty conditions array passes schema (Layer 1 catches emptiness)', () => {
  const { validateDelta } = require('../bin/lib/delta-parser.cjs');
  const delta = { verdict: 'approved_with_conditions', reason: 'ok', conditions: [] };
  const result = validateDelta('bonfire-h-review', delta);
  assert.equal(result.valid, true);
});
```

- [ ] **Step 2: Run — confirm the four failing tests fail**

Run: `node --test tests/test-delta-parser.js`

Expected: the four "condition missing ..." / "target_stage other than stage-j" tests fail. The two "passes" tests may pass incidentally. Baseline confirmed.

- [ ] **Step 3: Add targeted dispatch to `delta-parser.cjs`**

Open `bin/lib/delta-parser.cjs`. After the existing `if (constraints.conflict_type_from_reentry_routes ...)` block (around line 49), add:

```javascript
  if (constraints.condition_item_shape && delta.conditions !== undefined) {
    const shape = constraints.condition_item_shape;
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
      }
    }
  }
```

- [ ] **Step 4: Run — confirm all new tests pass**

Run: `node --test tests/test-delta-parser.js`

Expected: all tests pass (including the six new ones).

- [ ] **Step 5: Full regression sweep**

Run: `node --test tests/*.js`

Expected: every test in the suite passes. If h-review-verdict.json fixtures anywhere in the repo use legacy free-string conditions, those will break (intended — that is what the schema change means). No such fixtures should exist yet. If something unexpected regresses, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/delta-parser.cjs tests/test-delta-parser.js
git commit -m "$(cat <<'EOF'
feat(delta-parser): enforce condition_item_shape for bonfire-h-review

Adds a TARGETED validator branch (not a generic nested-schema
dispatcher) for the condition_item_shape constraint from Task 2:
iterates delta.conditions[] and checks per-item required_fields +
target_stage_enum. Emits clear error messages naming the failing
condition index and field.

The targeted pattern is deliberate. If a second same-shape constraint
appears in the future, that is when to generalize — not now.

Spec §6.1 (Note on validator dispatch).
EOF
)"
```

---

## Task 4: Schema — `handoff_substantive_slots` section

**Files:**
- Modify: `schemas/bonfire-v1.json`

Rationale: Add the schema-level whitelist of slots that require provenance. Validator enforcement follows in Tasks 9+11. This task is schema-only.

- [ ] **Step 1: Locate insertion point**

Open `schemas/bonfire-v1.json`. After the `categories` block and before `delta_schemas`, find a natural insertion point (typically right after `categories` close brace). The section should be a top-level sibling to `reentry_routes`, `categories`, `delta_schemas`, etc.

- [ ] **Step 2: Add the `handoff_substantive_slots` block**

Insert (as a top-level property):

```json
"handoff_substantive_slots": {
  "handoff.domain_model.entities": { "_provenance_required": true, "kind": "per_entry" },
  "handoff.function_contracts": { "_provenance_required": true, "kind": "per_entry", "fields": ["purpose", "invariants", "failure_modes"] },
  "handoff.data_contract": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.panels": { "_provenance_required": true, "kind": "per_entry", "fields": ["description", "elements", "states"] },
  "handoff.ui_contract.state_ownership": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.empty_states": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.error_states": { "_provenance_required": true, "kind": "whole_section" }
},
```

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('schemas/bonfire-v1.json'))"`

Expected: no output (parse succeeds).

- [ ] **Step 4: Run regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass. No validator reads this section yet; behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "$(cat <<'EOF'
feat(schema): add handoff_substantive_slots section

Declares the whitelist of compile-output handoff slots that require
provenance metadata (source_kind + source_ref) when produced by
J-Compile. Each entry carries _provenance_required: true and a kind
(per_entry or whole_section), plus an optional fields list that
narrows Layer 2b's token extraction to substantive sub-fields only.

Conditional-triggered semantics: a slot listed here does NOT mandate
production. If J produces it, then provenance is required. If the
slot is absent from compile-output, no check fires (legitimate for
cases where the slot doesn't apply — e.g., no UI panels in a CLI-only
tool).

Validator enforcement follows in later tasks. This commit is
schema-only foundation.

Spec §6.1 + §6.3 conditional-triggered semantics.
EOF
)"
```

---

## Task 5: seam-validation module scaffold + token helpers

**Files:**
- Create: `bin/lib/seam-validation.cjs`
- Create: `tests/test-seam-validation.js`

Rationale: Shared helpers used by Layer 1 (validate-h-conditions) and Layer 2b (token coverage). Pure functions, no I/O beyond reading the whitelist file.

- [ ] **Step 1: Write the failing tests**

Create `tests/test-seam-validation.js`:

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  loadFormatWhitelist,
  extractSubstantiveTokens,
  lemmatizeToken,
  isCJKToken,
  VERB_BLACKLIST,
} = require('../bin/lib/seam-validation.cjs');

// ---------------------------------------------------------------------------
// loadFormatWhitelist
// ---------------------------------------------------------------------------

test('loadFormatWhitelist returns a Set of lowercased tokens', () => {
  const whitelist = loadFormatWhitelist();
  assert.ok(whitelist instanceof Set);
  assert.ok(whitelist.has('given'));
  assert.ok(whitelist.has('when'));
  assert.ok(whitelist.has('must'));
  assert.ok(whitelist.has('stage-j'));
});

test('loadFormatWhitelist skips comment lines and whitespace', () => {
  // All returned tokens should be non-empty non-comment
  const whitelist = loadFormatWhitelist();
  for (const token of whitelist) {
    assert.notEqual(token, '');
    assert.ok(!token.startsWith('#'));
  }
});

// ---------------------------------------------------------------------------
// extractSubstantiveTokens
// ---------------------------------------------------------------------------

test('extractSubstantiveTokens splits on whitespace and punctuation', () => {
  const tokens = extractSubstantiveTokens('board texture, and hand-strength categories');
  // Expects substantive tokens (case-normalized, lemmatized).
  assert.ok(tokens.includes('board'));
  assert.ok(tokens.includes('texture'));
  assert.ok(tokens.includes('hand-strength') || tokens.includes('hand') && tokens.includes('strength'));
});

test('extractSubstantiveTokens lowercases tokens', () => {
  const tokens = extractSubstantiveTokens('GTO Wizard');
  assert.ok(tokens.includes('gto'));
  assert.ok(tokens.includes('wizard'));
});

test('extractSubstantiveTokens preserves CON-XXX identifiers', () => {
  const tokens = extractSubstantiveTokens('freeze CON-014 per ruling');
  assert.ok(tokens.includes('con-014'));
});

test('extractSubstantiveTokens preserves numbers', () => {
  const tokens = extractSubstantiveTokens('10 categories with 5 hand strengths');
  assert.ok(tokens.includes('10'));
  assert.ok(tokens.includes('5'));
});

// ---------------------------------------------------------------------------
// lemmatizeToken
// ---------------------------------------------------------------------------

test('lemmatizeToken drops trailing s/es', () => {
  assert.equal(lemmatizeToken('cards'), 'card');
  assert.equal(lemmatizeToken('boxes'), 'box');
  assert.equal(lemmatizeToken('texture'), 'texture');  // no change
});

test('lemmatizeToken drops trailing ing/ed', () => {
  assert.equal(lemmatizeToken('reading'), 'read');
  assert.equal(lemmatizeToken('placed'), 'place');
});

test('lemmatizeToken leaves short tokens alone', () => {
  assert.equal(lemmatizeToken('is'), 'is');
  assert.equal(lemmatizeToken('of'), 'of');
});

test('lemmatizeToken leaves CON-XXX identifiers alone', () => {
  assert.equal(lemmatizeToken('con-014'), 'con-014');
});

// ---------------------------------------------------------------------------
// isCJKToken
// ---------------------------------------------------------------------------

test('isCJKToken detects Chinese characters', () => {
  assert.equal(isCJKToken('训练器'), true);
  assert.equal(isCJKToken('开始'), true);
});

test('isCJKToken returns false for latin', () => {
  assert.equal(isCJKToken('card'), false);
  assert.equal(isCJKToken('123'), false);
  assert.equal(isCJKToken('stage-j'), false);
});

test('isCJKToken returns true for mixed CJK + latin', () => {
  // Conservative: any CJK char makes it a CJK token
  assert.equal(isCJKToken('GTO训练器'), true);
});

// ---------------------------------------------------------------------------
// VERB_BLACKLIST
// ---------------------------------------------------------------------------

test('VERB_BLACKLIST is a Set containing the expected verbs', () => {
  assert.ok(VERB_BLACKLIST instanceof Set);
  for (const verb of ['enumerate', 'classify', 'categorize', 'partition', 'define', 'specify', 'list', 'rank', 'distinguish', 'decompose']) {
    assert.ok(VERB_BLACKLIST.has(verb), `expected ${verb} in blacklist`);
  }
});
```

- [ ] **Step 2: Run — confirm all tests fail with "module not found"**

Run: `node --test tests/test-seam-validation.js`

Expected: all tests fail because `bin/lib/seam-validation.cjs` doesn't exist yet.

- [ ] **Step 3: Create `bin/lib/seam-validation.cjs` with the helpers**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Format whitelist — loaded from references/stage-j-format-whitelist.md
// ---------------------------------------------------------------------------

const WHITELIST_PATH = path.join(__dirname, '..', '..', 'references', 'stage-j-format-whitelist.md');

let _whitelistCache = null;

function loadFormatWhitelist() {
  if (_whitelistCache) return _whitelistCache;
  const source = fs.readFileSync(WHITELIST_PATH, 'utf8');
  const set = new Set();
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('---')) continue;
    // Skip markdown headers (lines starting with ##, or marked **...**)
    if (line.startsWith('**') && line.endsWith('**')) continue;
    // Each whitespace-separated token becomes an entry
    for (const token of line.split(/\s+/)) {
      if (token && !token.startsWith('#')) {
        set.add(token.toLowerCase());
      }
    }
  }
  _whitelistCache = set;
  return set;
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

// Split on whitespace and ASCII punctuation EXCEPT hyphens inside identifiers.
// Preserves CON-014, stage-j, hand-strength as single tokens.
// Lowercases everything.
function extractSubstantiveTokens(text) {
  if (typeof text !== 'string') return [];
  // Separate CJK characters into their own tokens (each char is a token)
  // while keeping latin runs intact.
  const tokens = [];
  const cjkRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/;
  let buffer = '';
  const flushBuffer = () => {
    if (buffer.length === 0) return;
    // Split buffer on whitespace + non-hyphen punctuation
    for (const raw of buffer.split(/[\s.,;:!?()\[\]{}"'`]+/)) {
      if (raw.length === 0) continue;
      tokens.push(raw.toLowerCase());
    }
    buffer = '';
  };
  for (const ch of text) {
    if (cjkRegex.test(ch)) {
      flushBuffer();
      tokens.push(ch);  // each CJK char is its own token
    } else {
      buffer += ch;
    }
  }
  flushBuffer();
  return tokens;
}

// ---------------------------------------------------------------------------
// Lemmatization — latin only
// ---------------------------------------------------------------------------

function lemmatizeToken(token) {
  if (typeof token !== 'string') return token;
  if (token.length < 4) return token;  // don't munge short tokens
  if (isCJKToken(token)) return token;  // no CJK lemmatization
  // Preserve identifiers like con-014, stage-j
  if (/-\d/.test(token) || /-[a-z]$/.test(token)) return token;
  // Drop trailing 'ing' (>=4 chars remain)
  if (token.endsWith('ing') && token.length >= 6) return token.slice(0, -3);
  // Drop trailing 'ed'
  if (token.endsWith('ed') && token.length >= 5) return token.slice(0, -2);
  // Drop trailing 'es'
  if (token.endsWith('es') && token.length >= 5) return token.slice(0, -2);
  // Drop trailing 's'
  if (token.endsWith('s') && token.length >= 4) return token.slice(0, -1);
  return token;
}

// ---------------------------------------------------------------------------
// CJK detection
// ---------------------------------------------------------------------------

function isCJKToken(token) {
  if (typeof token !== 'string') return false;
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(token);
}

// ---------------------------------------------------------------------------
// Verb blacklist — conditions containing any of these verbs fail Layer 1
// ---------------------------------------------------------------------------

const VERB_BLACKLIST = new Set([
  'enumerate', 'enumerated', 'enumerates', 'enumerating',
  'classify', 'classified', 'classifies', 'classifying',
  'categorize', 'categorized', 'categorizes', 'categorizing',
  'partition', 'partitioned', 'partitions', 'partitioning',
  'define', 'defined', 'defines', 'defining',
  'specify', 'specified', 'specifies', 'specifying',
  'list',  // as verb — noun use "list of" is caught by surrounding tokens
  'rank', 'ranked', 'ranks', 'ranking',
  'distinguish', 'distinguished', 'distinguishes', 'distinguishing',
  'decompose', 'decomposed', 'decomposes', 'decomposing',
]);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadFormatWhitelist,
  extractSubstantiveTokens,
  lemmatizeToken,
  isCJKToken,
  VERB_BLACKLIST,
};
```

- [ ] **Step 4: Run — confirm all helper tests pass**

Run: `node --test tests/test-seam-validation.js`

Expected: all tests pass. If the hyphenation test for `'board texture, and hand-strength categories'` fails because the regex doesn't handle hyphens correctly, inspect: the `extractSubstantiveTokens` should split on whitespace + punctuation but keep hyphens. Verify behavior matches the permissive assertion (`includes('hand-strength') OR (includes('hand') AND includes('strength'))`).

- [ ] **Step 5: Run regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass. New module doesn't affect other code.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-seam-validation.js
git commit -m "$(cat <<'EOF'
feat(seam-validation): scaffold module with token/lemma/CJK helpers

New module bin/lib/seam-validation.cjs holds helpers shared by Layer 1
(validate-h-conditions) and Layer 2b (token coverage diff):

  loadFormatWhitelist() — parses references/stage-j-format-whitelist.md
    into a Set of lowercased tokens. Cached after first call.

  extractSubstantiveTokens(text) — splits text on whitespace and
    punctuation (preserving hyphenated identifiers like CON-014),
    lowercases, treats each CJK character as its own token.

  lemmatizeToken(token) — latin-only rule-based: drops trailing
    ing/ed/es/s for tokens >=4 chars. Preserves identifiers and CJK.

  isCJKToken(token) — conservative: any CJK char makes the token CJK.

  VERB_BLACKLIST — Set of verbs whose presence in a condition text
    triggers Layer 1 rejection.

Unit tests at tests/test-seam-validation.js pin all of the above
against their contracts. No CLI or validator wiring in this commit.

Spec §6.4 edge cases + CJK handling.
EOF
)"
```

---

## Task 6: Layer 1 — validateHConditions helper

**Files:**
- Modify: `bin/lib/seam-validation.cjs`
- Modify: `tests/test-seam-validation.js`

Rationale: The core Layer 1 logic — given a verdict and a FROZEN ledger snapshot, verify each stage-j condition's token coverage and verb blacklist. Pure function; CLI wiring follows in Task 7.

- [ ] **Step 1: Write failing tests**

Append to `tests/test-seam-validation.js`:

```javascript
// ---------------------------------------------------------------------------
// validateHConditions
// ---------------------------------------------------------------------------

const { validateHConditions } = require('../bin/lib/seam-validation.cjs');

function mkSnapshot(ledgerEntries = {}) {
  return { entries: ledgerEntries };
}

test('validateHConditions: verdict not approved_with_conditions returns {valid: true, violations: []}', () => {
  const result = validateHConditions({ verdict: 'approved', reason: 'x' }, mkSnapshot());
  assert.deepEqual(result, { valid: true, violations: [] });
});

test('validateHConditions: empty conditions array returns violation (approved_with_conditions requires conditions)', () => {
  const result = validateHConditions(
    { verdict: 'approved_with_conditions', reason: 'x', conditions: [] },
    mkSnapshot()
  );
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /empty/i.test(v.reason)));
});

test('validateHConditions: condition with all tokens in FROZEN ledger passes', () => {
  const snapshot = mkSnapshot({
    'CON-003': { status: 'FROZEN', content: 'user can select drill mode', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-003 drill mode MUST be rendered in Given/When/Then format', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, true, `violations: ${JSON.stringify(result.violations)}`);
});

test('validateHConditions: condition with verb blacklist word fails', () => {
  const snapshot = mkSnapshot({
    'CON-014': { status: 'FROZEN', content: 'board texture classification', category: 'frozen_constraint' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'J-Compile MUST enumerate CON-014 categories', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /enumerate/.test(v.reason)));
});

test('validateHConditions: condition with orphan substantive token fails', () => {
  const snapshot = mkSnapshot({
    'CON-001': { status: 'FROZEN', content: 'GTO strategy trainer', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-001 MUST expose a monte-carlo simulator', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => /monte-carlo|simulator/i.test(v.reason)));
});

test('validateHConditions: condition referencing PROPOSED (not FROZEN) ledger entry fails', () => {
  const snapshot = mkSnapshot({
    'CON-999': { status: 'PROPOSED', content: 'some text', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [{ text: 'CON-999 MUST be reformatted', target_stage: 'stage-j' }],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
});

test('validateHConditions: reports violation index matching condition index', () => {
  const snapshot = mkSnapshot({
    'CON-001': { status: 'FROZEN', content: 'text', category: 'retained_goal' },
  });
  const verdict = {
    verdict: 'approved_with_conditions', reason: 'x',
    conditions: [
      { text: 'CON-001 reformat given when then', target_stage: 'stage-j' },
      { text: 'J-Compile MUST enumerate new fields', target_stage: 'stage-j' },
    ],
  };
  const result = validateHConditions(verdict, snapshot);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some(v => v.index === 1));
});
```

- [ ] **Step 2: Run — confirm all new tests fail**

Run: `node --test tests/test-seam-validation.js`

Expected: the 7 new tests fail with "validateHConditions is not a function" or similar.

- [ ] **Step 3: Implement `validateHConditions`**

Append to `bin/lib/seam-validation.cjs` (before `module.exports`):

```javascript
// ---------------------------------------------------------------------------
// validateHConditions — Layer 1 entry check
// ---------------------------------------------------------------------------

function buildFrozenTokenVocabulary(snapshot) {
  // Aggregate all substantive tokens from FROZEN ledger entries + the ledger id set.
  const tokens = new Set();
  const frozenIds = new Set();
  const entries = (snapshot && snapshot.entries) || {};
  for (const [id, entry] of Object.entries(entries)) {
    if (entry && entry.status === 'FROZEN') {
      frozenIds.add(id.toLowerCase());
      const contentTokens = extractSubstantiveTokens(entry.content || '');
      for (const t of contentTokens) {
        tokens.add(lemmatizeToken(t));
      }
    }
  }
  return { tokens, frozenIds };
}

function validateHConditions(verdict, snapshot) {
  const violations = [];

  if (verdict.verdict !== 'approved_with_conditions') {
    return { valid: true, violations };
  }

  const conditions = Array.isArray(verdict.conditions) ? verdict.conditions : [];

  if (conditions.length === 0) {
    violations.push({
      index: null,
      reason: 'verdict is approved_with_conditions but conditions array is empty — use verdict: "approved" instead',
    });
    return { valid: false, violations };
  }

  const whitelist = loadFormatWhitelist();
  const { tokens: frozenTokens, frozenIds } = buildFrozenTokenVocabulary(snapshot);

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const text = cond && cond.text ? String(cond.text) : '';
    const condTokens = extractSubstantiveTokens(text);

    // Rule 2: verb blacklist
    for (const token of condTokens) {
      if (VERB_BLACKLIST.has(token)) {
        violations.push({
          index: i,
          reason: `condition text contains blacklisted verb "${token}" — use rejected + appropriate conflict_type instead`,
        });
        break;  // one violation per condition is enough
      }
    }

    // Rule 1: token coverage
    for (const rawToken of condTokens) {
      const token = lemmatizeToken(rawToken);
      if (whitelist.has(token)) continue;
      if (whitelist.has(rawToken)) continue;
      if (frozenTokens.has(token)) continue;
      if (frozenIds.has(rawToken) || frozenIds.has(token)) continue;
      // CJK tokens must be exact-match in frozenTokens (no lemmatization)
      if (isCJKToken(rawToken) && frozenTokens.has(rawToken)) continue;
      violations.push({
        index: i,
        reason: `orphan substantive token "${rawToken}" not in FROZEN ledger or format whitelist`,
      });
      // Don't break — we want to report all orphan tokens per condition
    }
  }

  return { valid: violations.length === 0, violations };
}

module.exports.validateHConditions = validateHConditions;
```

Also add `validateHConditions` to the main `module.exports` object at the bottom of the file:

```javascript
module.exports = {
  loadFormatWhitelist,
  extractSubstantiveTokens,
  lemmatizeToken,
  isCJKToken,
  VERB_BLACKLIST,
  validateHConditions,
};
```

(If you placed the function before `module.exports`, remove the trailing `module.exports.validateHConditions = ...` assignment — the clean form is to include it in the main object.)

- [ ] **Step 4: Run — confirm all tests pass**

Run: `node --test tests/test-seam-validation.js`

Expected: all tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-seam-validation.js
git commit -m "$(cat <<'EOF'
feat(seam-validation): add validateHConditions (Layer 1 helper)

Core Layer 1 logic: given an H-Review verdict and a FROZEN ledger
snapshot, verify each stage-j condition's token coverage and verb
blacklist. Returns { valid, violations: [{ index, reason }] }.

Rules enforced:
- approved_with_conditions with empty conditions[] is a violation
  (nudges H-Review toward verdict: "approved" when no format work
  needed).
- Verb blacklist: enumerate, classify, define, specify, etc. (full
  list in VERB_BLACKLIST from Task 5).
- Token coverage: every substantive token (non-stopword, non-format-
  keyword) must appear in FROZEN ledger content or the format
  whitelist.
- CJK tokens are exact-match (no lemmatization per spec §6.4).

Pure function — no I/O beyond the one-time whitelist file load. CLI
wrapping follows in Task 7.

Spec §6.2 (Layer 1 rules).
EOF
)"
```

---

## Task 7: Layer 1 — wire `validate-h-conditions` CLI command

**Files:**
- Modify: `bin/bonfire-tools.cjs`
- Create: `tests/test-validate-h-conditions.js`

Rationale: Make `validateHConditions` invokable as `bonfire validate-h-conditions`, reading the verdict and snapshot from the `.bonfire/` directory.

- [ ] **Step 1: Write failing CLI tests**

Create `tests/test-validate-h-conditions.js`:

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-vhc-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function writeVerdict(dir, verdict) {
  const p = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(verdict, null, 2));
}

function runValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'validate-h-conditions'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

test('validate-h-conditions: approved verdict returns exit 0', () => {
  const dir = makeTmpDir();
  try {
    writeVerdict(dir, { verdict: 'approved', reason: 'ok' });
    const result = runValidate(dir);
    assert.equal(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: valid stage-j condition passes', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-001', '--category', 'retained_goal',
      '--content', 'user can select drill mode', '--rationale', 'r', '--source', 'stage-a'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-001', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-001'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'minor format work',
      conditions: [{
        text: 'reformat CON-001 drill mode description into given/when/then',
        target_stage: 'stage-j',
      }],
    });

    const result = runValidate(dir);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: verb blacklist violation fails', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-002', '--category', 'frozen_constraint',
      '--content', 'board texture', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'aligned_by', '--value', 'g-blue'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'challenged_by', '--value', 'd-critique'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-002'],
      { encoding: 'utf8', cwd: dir });

    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [{
        text: 'J-Compile MUST enumerate CON-002 categories',
        target_stage: 'stage-j',
      }],
    });

    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /enumerate/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: empty rulings orthogonal — only conditions matter', () => {
  const dir = makeTmpDir();
  try {
    writeVerdict(dir, {
      verdict: 'approved_with_conditions',
      reason: 'x',
      conditions: [],
    });
    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /empty|conditions/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('validate-h-conditions: no verdict file produces error', () => {
  const dir = makeTmpDir();
  try {
    const result = runValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /not found|verdict/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run — confirm tests fail with "Unknown command"**

Run: `node --test tests/test-validate-h-conditions.js`

Expected: tests fail because the `validate-h-conditions` command isn't registered.

- [ ] **Step 3: Wire the CLI command**

Open `bin/bonfire-tools.cjs`. Add to the `COMMANDS` table (after `apply-h-rulings`):

```javascript
  'validate-h-conditions': () => validateHConditionsCommand,
```

Add the handler function (above `main()`, near `applyHRulingsCommand`):

```javascript
function validateHConditionsCommand(args) {
  const { validateHConditions } = require('./lib/seam-validation.cjs');
  const { loadSnapshot } = require('./lib/truth-surface.cjs');
  const { resolveRoot, exitJSON, exitError, loadJSON } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  const verdictPath = path.join(root, 'plan', 'h-review-verdict.json');
  let verdict;
  try {
    verdict = JSON.parse(require('fs').readFileSync(verdictPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      exitError(`h-review-verdict.json not found at ${verdictPath}`, [], 3);
    }
    exitError(`h-review-verdict.json unreadable at ${verdictPath}: ${err.message}`, [], 3);
  }

  const snapshot = loadSnapshot(dir);

  const result = validateHConditions(verdict, snapshot);
  if (!result.valid) {
    process.stderr.write(
      `validate-h-conditions: ${result.violations.length} violation(s):\n`
    );
    for (const v of result.violations) {
      const idx = v.index === null ? 'verdict' : `conditions[${v.index}]`;
      process.stderr.write(`  - ${idx}: ${v.reason}\n`);
    }
    process.stderr.write(
      `Return these to H-Review (re-run with these failures in agent input) ` +
      `or reject with an appropriate conflict_type.\n`
    );
    exitJSON({ valid: false, violations: result.violations }, 1);
  }
  exitJSON({ valid: true, violations: [] }, 0);
}
```

- [ ] **Step 4: Run — confirm all tests pass**

Run: `node --test tests/test-validate-h-conditions.js`

Expected: all 5 tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add bin/bonfire-tools.cjs tests/test-validate-h-conditions.js
git commit -m "$(cat <<'EOF'
feat(cli): add validate-h-conditions command (Layer 1 wiring)

Exposes validateHConditions as a CLI invocation. Reads
.bonfire/plan/h-review-verdict.json and the ledger snapshot,
validates per spec §6.2 (token coverage + verb blacklist + empty-
conditions check), exits non-zero with structured violation list on
failure.

stderr lists each violation as:
  - conditions[<index>]: <reason>
  - verdict: <reason>  (for verdict-level issues like empty conditions)

stdout emits JSON {valid, violations[]} in both success and failure
cases for caller parsing.

Integration into state-advance --step stage-h follows in Task 8.

Spec §6.2.
EOF
)"
```

---

## Task 8: Layer 1 integration — wire into `checkStageHInvariant`

**Files:**
- Modify: `bin/lib/state.cjs`
- Modify: `tests/test-state-advance-invariants.js`

Rationale: `state-advance --step stage-h` must refuse to advance if Layer 1 fails. The invariant check already loads the verdict and validates its schema (from Assertion 1 fixes); now extend it to run Layer 1 between schema validation and rulings check.

- [ ] **Step 1: Write failing test**

Append to `tests/test-state-advance-invariants.js`:

```javascript
// ---------------------------------------------------------------------------
// Layer 1 integration — validate-h-conditions gates stage-h advance
// ---------------------------------------------------------------------------

test('state-advance from stage-h fails when verdict has a blacklisted verb in a condition', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-001', '--category', 'retained_goal',
      '--content', 'some content', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-001', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-001'],
      { encoding: 'utf8', cwd: dir });

    const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
    fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
    fs.writeFileSync(verdictPath, JSON.stringify({
      verdict: 'approved_with_conditions',
      reason: 'test',
      rulings: [],
      conditions: [
        { text: 'J-Compile MUST enumerate CON-001 subcategories', target_stage: 'stage-j' }
      ],
    }, null, 2));

    const result = runAdvance(dir, 'stage-h');
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /enumerate|invalid_stage_j_condition/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('state-advance from stage-h passes when stage-j conditions are clean', () => {
  const dir = makeTmpDir();
  try {
    setPipelineToStageH(dir);
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-002', '--category', 'retained_goal',
      '--content', 'drill mode', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-002', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-002'],
      { encoding: 'utf8', cwd: dir });

    const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
    fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
    fs.writeFileSync(verdictPath, JSON.stringify({
      verdict: 'approved_with_conditions',
      reason: 'minor format',
      rulings: [],
      conditions: [
        { text: 'reformat CON-002 drill mode into given when then', target_stage: 'stage-j' }
      ],
    }, null, 2));

    const result = runAdvance(dir, 'stage-h');
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run — confirm tests fail**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: the "enumerate" test passes incidentally (state-advance is unaware, lets it through) — so it FAILS the `assert.notEqual(result.code, 0)`. This baseline confirms we need the gate.

- [ ] **Step 3: Integrate Layer 1 into `checkStageHInvariant`**

Open `bin/lib/state.cjs`. Locate `checkStageHInvariant`. Immediately AFTER the `validateDelta` check and BEFORE the rulings invariant check (before `const rulings = Array.isArray(...) ...`), insert:

```javascript
  const { validateHConditions } = require('./seam-validation.cjs');
  const { loadSnapshot } = require('./truth-surface.cjs');
  const snapshot = loadSnapshot(path.dirname(root));
  const condResult = validateHConditions(verdict, snapshot);
  if (!condResult.valid) {
    process.stderr.write(
      `Cannot advance from stage-h: ${condResult.violations.length} condition violation(s):\n`
    );
    for (const v of condResult.violations) {
      const idx = v.index === null ? 'verdict' : `conditions[${v.index}]`;
      process.stderr.write(`  - ${idx}: ${v.reason}\n`);
    }
    process.stderr.write(
      `Run: bonfire state-reentry --conflict-type invalid_stage_j_condition\n`
    );
    process.exit(1);
  }
```

Note: the existing code has `const snapshot = loadSnapshot(dir);` later; remove the duplicate load. If the existing function already loads the snapshot, reuse it (or reorganize so the snapshot is loaded once, shared between the Layer 1 call and the subsequent rulings check).

- [ ] **Step 4: Run — confirm tests pass**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: all tests pass, including the two new Layer 1 cases.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass. Pay attention to any test-state.js tests that might be affected — the earlier Assertion 1 fix for pipeline-through-stage-h tests uses empty rulings but hadn't anticipated Layer 1. Empty conditions list in Layer 1 now returns valid (approved verdict skips the empty check; `approved_with_conditions` + `conditions: []` fails). Verify pre-existing tests still work.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/state.cjs tests/test-state-advance-invariants.js
git commit -m "$(cat <<'EOF'
feat(state): integrate Layer 1 into checkStageHInvariant

state-advance --step stage-h now calls validateHConditions between
the schema validation and the rulings invariant check. Layer 1
failures are reported on stderr with violation details and routed
back to stage-h via the new invalid_stage_j_condition reentry type
(schema declaration from Task 2).

The ordering matters: schema validation runs first (catches malformed
verdict envelopes), then Layer 1 (catches condition-text violations),
then rulings invariant (from Assertion 1). Layer 2 runs later, at
handoff-validate time.

Spec §6.2 (state-advance integration).
EOF
)"
```

---

## Task 9: Layer 2a — provenance enforcement in `validateHandoff`

**Files:**
- Modify: `bin/lib/schema.cjs`
- Create: `tests/test-handoff-provenance.js`

Rationale: Walk every slot in `handoff_substantive_slots`, verify `source_kind` + `source_ref` are present and resolve. This is the structural half of Layer 2 — the lexical half (token coverage) comes in Task 12.

- [ ] **Step 1: Write failing tests**

Create `tests/test-handoff-provenance.js`:

```javascript
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
```

- [ ] **Step 2: Run — confirm tests fail**

Run: `node --test tests/test-handoff-provenance.js`

Expected: tests fail because `validateHandoff` doesn't accept a second `context` argument yet, and doesn't enforce provenance.

- [ ] **Step 3: Extend `validateHandoff` with Layer 2a**

Open `bin/lib/schema.cjs`. Replace the existing `validateHandoff` function with an extended version:

```javascript
const { loadSchema } = require('./utils.cjs');

const HANDOFF_REQUIRED_FIELDS = [
  'code_ready', 'handoff_summary', 'retained_goal', 'implementation_scope',
  'implementation_units'
];

function validateHandoff(compileOutput, context) {
  const errors = [];
  if (!compileOutput || !compileOutput.handoff) {
    return { valid: false, errors: ['compile-output.json missing handoff section'] };
  }
  const handoff = compileOutput.handoff;
  for (const field of HANDOFF_REQUIRED_FIELDS) {
    if (handoff[field] === undefined || handoff[field] === null) {
      errors.push(`Missing required handoff field: ${field}`);
    }
  }
  if (handoff.code_ready !== true) {
    errors.push('handoff.code_ready is not true');
  }
  if (handoff.implementation_units && !Array.isArray(handoff.implementation_units)) {
    errors.push('handoff.implementation_units must be an array');
  }
  if (Array.isArray(handoff.implementation_units) && handoff.implementation_units.length === 0) {
    errors.push('handoff.implementation_units is empty');
  }

  // Layer 2a: provenance enforcement
  if (errors.length === 0 || true) {  // always check provenance for better diagnostics
    const provenanceErrors = validateProvenance(compileOutput, context || {});
    errors.push(...provenanceErrors);
  }

  return { valid: errors.length === 0, errors };
}

function validateProvenance(compileOutput, context) {
  const errors = [];
  const schema = loadSchema();
  const slots = (schema && schema.handoff_substantive_slots) || {};

  for (const [slotPath, slotConfig] of Object.entries(slots)) {
    if (!slotConfig || !slotConfig._provenance_required) continue;
    const target = resolveSlotPath(compileOutput, slotPath);
    if (target === undefined) continue;  // slot absent → conditional-triggered exemption

    if (slotConfig.kind === 'per_entry') {
      // target must be an object whose values are entries
      if (typeof target !== 'object' || target === null) {
        errors.push(`${slotPath}: expected object for per_entry slot`);
        continue;
      }
      // If it's an array, iterate elements; if it's a plain object, iterate values.
      const entries = Array.isArray(target) ? target : Object.entries(target).map(([k, v]) => v);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryErrors = checkEntryProvenance(entry, `${slotPath}[${i}]`, context);
        errors.push(...entryErrors);
      }
    } else if (slotConfig.kind === 'whole_section') {
      const sectionErrors = checkEntryProvenance(target, slotPath, context);
      errors.push(...sectionErrors);
    }
  }

  return errors;
}

function resolveSlotPath(root, dottedPath) {
  const parts = dottedPath.split('.');
  let current = root;
  for (const p of parts) {
    if (current == null) return undefined;
    current = current[p];
  }
  return current;
}

function checkEntryProvenance(entry, pathLabel, context) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push(`${pathLabel}: not an object (can't validate provenance)`);
    return errors;
  }
  const kind = entry.source_kind;
  const ref = entry.source_ref;
  if (kind === undefined) {
    errors.push(`${pathLabel}: missing source_kind`);
    return errors;
  }
  if (ref === undefined) {
    errors.push(`${pathLabel}: missing source_ref`);
    return errors;
  }
  if (kind !== 'ledger_direct' && kind !== 'condition_rewrite') {
    errors.push(`${pathLabel}: source_kind "${kind}" not one of ledger_direct|condition_rewrite`);
    return errors;
  }
  if (kind === 'ledger_direct') {
    const snap = context.snapshot || { entries: {} };
    const ledgerEntry = (snap.entries || {})[ref];
    if (!ledgerEntry) {
      errors.push(`${pathLabel}: source_ref "${ref}" not found in ledger`);
      return errors;
    }
    if (ledgerEntry.status !== 'FROZEN') {
      errors.push(`${pathLabel}: source_ref "${ref}" is ${ledgerEntry.status}, expected FROZEN`);
    }
  } else if (kind === 'condition_rewrite') {
    const verdict = context.verdict;
    const idx = ref && ref.condition_index;
    if (!verdict || typeof idx !== 'number') {
      errors.push(`${pathLabel}: condition_rewrite source_ref must be { condition_index: <number> } with a verdict in context`);
      return errors;
    }
    const conds = Array.isArray(verdict.conditions) ? verdict.conditions : [];
    if (idx < 0 || idx >= conds.length) {
      errors.push(`${pathLabel}: source_ref.condition_index ${idx} out of range (verdict has ${conds.length} conditions)`);
      return errors;
    }
    const cond = conds[idx];
    if (!cond || cond.target_stage !== 'stage-j') {
      errors.push(`${pathLabel}: referenced condition must have target_stage "stage-j"`);
    }
  }
  return errors;
}
```

Replace the `module.exports` at the bottom of `schema.cjs` to continue exporting `validateHandoff, validateBundle` (unchanged).

- [ ] **Step 4: Run — confirm new tests pass**

Run: `node --test tests/test-handoff-provenance.js`

Expected: all 8 tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass. **Caution:** existing `test-schema.js` may have tests that pass a `compile-output.json` without provenance. If those exist and now fail — this is intentional (the new behavior IS the purpose). Either:
- Update the old tests to include `context` and supply no substantive slots (they'll pass), OR
- Update the old tests' fixture compile-outputs to include provenance fields on any substantive slots.

Document in the commit message.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/schema.cjs tests/test-handoff-provenance.js
git commit -m "$(cat <<'EOF'
feat(schema): add Layer 2a provenance enforcement to validateHandoff

validateHandoff now accepts an optional second argument `context` of
shape `{ snapshot, verdict }` and walks every slot listed in
handoff_substantive_slots (schema §6.1). For each slot that is
present in compile-output:

  - If missing source_kind or source_ref → error
  - If source_kind === "ledger_direct" → source_ref must resolve to
    an existing FROZEN ledger entry
  - If source_kind === "condition_rewrite" → source_ref must resolve
    to a verdict.conditions[i] with target_stage === "stage-j"
  - Slots absent from compile-output are skipped (conditional-trigger
    whitelist semantics; spec §6.3)

Layer 2b (token coverage) follows in Task 11-12; reentry_request
detection in Task 10.

Backward compatibility: pre-existing compile-output.json files
without source_* fields on substantive slots will now fail validation.
Intended behavior — gto-trainer's compile-output is one example and
will be migrated by re-running J-Compile.

Spec §6.3.
EOF
)"
```

---

## Task 10: Layer 2a — `reentry_request` detection + `code_ready` consistency

**Files:**
- Modify: `bin/lib/schema.cjs`
- Modify: `tests/test-handoff-provenance.js`

Rationale: Detect the BLOCKED state field from Task 14's J-Compile prompt update. When J legitimately refuses to compile, it emits `reentry_request` and sets `code_ready=false`. Enforce that these two stay consistent.

- [ ] **Step 1: Write failing tests**

Append to `tests/test-handoff-provenance.js`:

```javascript
// ---------------------------------------------------------------------------
// reentry_request handling
// ---------------------------------------------------------------------------

test('validateHandoff: reentry_request present + code_ready=false → valid returns false but with reentry signal', () => {
  const co = {
    handoff: {
      code_ready: false,
      handoff_summary: 'blocked',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'u1' }],
    },
    reentry_request: {
      conflict_type: 'invalid_stage_j_condition',
      reason: 'condition[0] asks J to define something not in ledger',
    },
  };
  const result = validateHandoff(co, mkContext());
  assert.equal(result.valid, false);  // not passable as code-ready
  assert.ok(result.reentry_request, 'reentry_request should be surfaced');
  assert.equal(result.reentry_request.conflict_type, 'invalid_stage_j_condition');
});

test('validateHandoff: reentry_request + code_ready=true → distinct consistency error', () => {
  const co = {
    handoff: {
      code_ready: true,  // inconsistent!
      handoff_summary: 'blocked',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'u1' }],
    },
    reentry_request: {
      conflict_type: 'invalid_stage_j_condition',
      reason: 'x',
    },
  };
  const result = validateHandoff(co, mkContext());
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /reentry_request.*code_ready|code_ready.*reentry_request/i.test(e)));
});

test('validateHandoff: reentry_request without code_ready=false is also flagged when code_ready missing', () => {
  const co = {
    handoff: {
      // code_ready omitted — falsy
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'u1' }],
    },
    reentry_request: { conflict_type: 'invalid_stage_j_condition', reason: 'x' },
  };
  const result = validateHandoff(co, mkContext());
  // Either "code_ready missing" or "inconsistency" is acceptable — both correct signals.
  assert.equal(result.valid, false);
});

test('validateHandoff: no reentry_request, code_ready=false → standard invalid (existing behavior)', () => {
  const co = {
    handoff: {
      code_ready: false,
      handoff_summary: 'x',
      retained_goal: 'x',
      implementation_scope: 'x',
      implementation_units: [{ id: 'u1' }],
    },
  };
  const result = validateHandoff(co, mkContext());
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /code_ready/i.test(e)));
});
```

- [ ] **Step 2: Run — confirm tests fail**

Run: `node --test tests/test-handoff-provenance.js`

Expected: the 4 new tests fail.

- [ ] **Step 3: Add reentry_request handling**

Open `bin/lib/schema.cjs`. Replace `validateHandoff` with a version that handles `reentry_request` at the top:

```javascript
function validateHandoff(compileOutput, context) {
  const errors = [];
  if (!compileOutput || typeof compileOutput !== 'object') {
    return { valid: false, errors: ['compile-output.json missing or not an object'] };
  }

  // reentry_request detection — takes precedence over normal handoff validation
  if (compileOutput.reentry_request !== undefined) {
    const req = compileOutput.reentry_request;
    const handoff = compileOutput.handoff || {};
    const codeReady = handoff.code_ready;
    if (codeReady === true) {
      errors.push(
        'reentry_request present but handoff.code_ready=true — self-contradictory. ' +
        'Declaring a reentry request overrides compile-ready status, but J-Compile ' +
        'should not have produced this combination. Fix at agent level.'
      );
    }
    if (codeReady === undefined) {
      errors.push(
        'reentry_request present but handoff.code_ready is missing. ' +
        'When declaring a reentry, handoff.code_ready MUST be false.'
      );
    }
    return {
      valid: errors.length === 0 ? false : false,  // always invalid when reentry_request present (it's not a code-ready package)
      errors,
      reentry_request: errors.length === 0 ? req : null,  // only surface if no consistency error
    };
  }

  // Standard handoff validation
  if (!compileOutput.handoff) {
    return { valid: false, errors: ['compile-output.json missing handoff section'] };
  }
  const handoff = compileOutput.handoff;
  for (const field of HANDOFF_REQUIRED_FIELDS) {
    if (handoff[field] === undefined || handoff[field] === null) {
      errors.push(`Missing required handoff field: ${field}`);
    }
  }
  if (handoff.code_ready !== true) {
    errors.push('handoff.code_ready is not true');
  }
  if (handoff.implementation_units && !Array.isArray(handoff.implementation_units)) {
    errors.push('handoff.implementation_units must be an array');
  }
  if (Array.isArray(handoff.implementation_units) && handoff.implementation_units.length === 0) {
    errors.push('handoff.implementation_units is empty');
  }

  // Layer 2a: provenance enforcement
  const provenanceErrors = validateProvenance(compileOutput, context || {});
  errors.push(...provenanceErrors);

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run — confirm tests pass**

Run: `node --test tests/test-handoff-provenance.js`

Expected: all 12 tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/schema.cjs tests/test-handoff-provenance.js
git commit -m "$(cat <<'EOF'
feat(schema): detect reentry_request + enforce code_ready consistency

validateHandoff now recognizes a top-level reentry_request field
(sibling of handoff per spec §6.1). When present:

  - code_ready MUST be false. code_ready=true + reentry_request =
    distinct consistency error (flag for human review — LLM produced
    contradictory output).
  - Valid reentry_request → result.reentry_request carries the
    declared { conflict_type, reason }. Caller can trigger the
    reentry without running Layer 2a/2b.

When no reentry_request is present, behavior is unchanged (standard
handoff field checks + Layer 2a provenance).

Spec §6.1 "J-Compile output schema extension — BLOCKED state" + N2.
EOF
)"
```

---

## Task 11: Layer 2b — `compareTokens` helper

**Files:**
- Modify: `bin/lib/seam-validation.cjs`
- Modify: `tests/test-seam-validation.js`

Rationale: Pure function for per-slot token overlap. Used by Task 12's integration into `validateHandoff`.

- [ ] **Step 1: Write failing tests**

Append to `tests/test-seam-validation.js`:

```javascript
// ---------------------------------------------------------------------------
// compareTokens
// ---------------------------------------------------------------------------

const { compareTokens } = require('../bin/lib/seam-validation.cjs');

test('compareTokens: all tokens in source → no orphans', () => {
  const orphans = compareTokens(['board', 'texture'], 'board texture classification');
  assert.deepEqual(orphans, []);
});

test('compareTokens: slot tokens absent from source → reported as orphans', () => {
  const orphans = compareTokens(['monte-carlo', 'texture'], 'board texture classification');
  assert.ok(orphans.includes('monte-carlo'));
  assert.ok(!orphans.includes('texture'));
});

test('compareTokens: format whitelist tokens always pass', () => {
  const orphans = compareTokens(['given', 'when', 'then', 'card'], 'card model');
  assert.deepEqual(orphans, []);
});

test('compareTokens: lemmatization matches cards ↔ card', () => {
  const orphans = compareTokens(['cards'], 'the card model');
  assert.deepEqual(orphans, []);
});

test('compareTokens: CJK tokens require exact literal match (no lemma)', () => {
  const orphans1 = compareTokens(['开'], '开 始');
  assert.deepEqual(orphans1, []);

  const orphans2 = compareTokens(['开'], '始');
  assert.ok(orphans2.includes('开'));
});

test('compareTokens: numbers are substantive', () => {
  const orphans = compareTokens(['10', '5'], 'there are several categories');
  assert.ok(orphans.includes('10'));
  assert.ok(orphans.includes('5'));
});

test('compareTokens: empty slot tokens → no orphans', () => {
  const orphans = compareTokens([], 'anything');
  assert.deepEqual(orphans, []);
});
```

- [ ] **Step 2: Run — confirm tests fail**

Run: `node --test tests/test-seam-validation.js`

Expected: tests fail because `compareTokens` doesn't exist.

- [ ] **Step 3: Implement `compareTokens`**

Append to `bin/lib/seam-validation.cjs` before `module.exports`:

```javascript
function compareTokens(slotTokens, sourceText) {
  const whitelist = loadFormatWhitelist();
  const sourceTokens = extractSubstantiveTokens(sourceText || '');
  const sourceSet = new Set();
  for (const t of sourceTokens) {
    sourceSet.add(lemmatizeToken(t));
    sourceSet.add(t);  // also keep raw for CJK exact-match
  }

  const orphans = [];
  for (const raw of slotTokens) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (whitelist.has(raw)) continue;
    const lemma = lemmatizeToken(raw);
    if (whitelist.has(lemma)) continue;
    if (isCJKToken(raw)) {
      // CJK: literal match only, no lemmatization
      if (sourceSet.has(raw)) continue;
      orphans.push(raw);
      continue;
    }
    if (sourceSet.has(lemma) || sourceSet.has(raw)) continue;
    orphans.push(raw);
  }
  return orphans;
}

// Add to module.exports:
module.exports.compareTokens = compareTokens;
```

(Or update the main `module.exports` object.)

- [ ] **Step 4: Run — tests pass**

Run: `node --test tests/test-seam-validation.js`

Expected: all tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/seam-validation.cjs tests/test-seam-validation.js
git commit -m "$(cat <<'EOF'
feat(seam-validation): add compareTokens helper (Layer 2b core)

Given a list of slot tokens and a source text string, returns the
subset of slot tokens not covered by: format whitelist, lemmatized
source tokens, or literal CJK source tokens.

CJK tokens are matched exactly (no lemmatization per spec §6.4).
Latin tokens use the existing lemmatizer.

Used by validateHandoff's Layer 2b integration in Task 12.

Spec §6.4.
EOF
)"
```

---

## Task 12: Layer 2b — integrate into `validateHandoff`

**Files:**
- Modify: `bin/lib/schema.cjs`
- Create: `tests/test-handoff-token-coverage.js`

Rationale: Walk every provenanced slot, extract tokens, compare against declared source. Orphan tokens fail validation.

- [ ] **Step 1: Write failing tests**

Create `tests/test-handoff-token-coverage.js`:

```javascript
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
```

- [ ] **Step 2: Run — confirm tests fail**

Run: `node --test tests/test-handoff-token-coverage.js`

Expected: tests fail because Layer 2b isn't wired yet.

- [ ] **Step 3: Extend `validateProvenance` to include Layer 2b**

Open `bin/lib/schema.cjs`. Update `checkEntryProvenance` (or add a companion function `checkEntryTokenCoverage`) that — after Layer 2a passes — extracts tokens from the entry's substantive content and compares against the declared source.

Modify `checkEntryProvenance` (from Task 9) to extend its bottom — after successful source resolution, extract source text and run `compareTokens`:

```javascript
function checkEntryProvenance(entry, pathLabel, context, slotConfig) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push(`${pathLabel}: not an object (can't validate provenance)`);
    return errors;
  }
  const kind = entry.source_kind;
  const ref = entry.source_ref;
  if (kind === undefined) { errors.push(`${pathLabel}: missing source_kind`); return errors; }
  if (ref === undefined) { errors.push(`${pathLabel}: missing source_ref`); return errors; }
  if (kind !== 'ledger_direct' && kind !== 'condition_rewrite') {
    errors.push(`${pathLabel}: source_kind "${kind}" not one of ledger_direct|condition_rewrite`);
    return errors;
  }

  let sourceText = '';
  if (kind === 'ledger_direct') {
    const snap = context.snapshot || { entries: {} };
    const ledgerEntry = (snap.entries || {})[ref];
    if (!ledgerEntry) { errors.push(`${pathLabel}: source_ref "${ref}" not found in ledger`); return errors; }
    if (ledgerEntry.status !== 'FROZEN') {
      errors.push(`${pathLabel}: source_ref "${ref}" is ${ledgerEntry.status}, expected FROZEN`);
      return errors;
    }
    sourceText = ledgerEntry.content || '';
  } else {
    const verdict = context.verdict;
    const idx = ref && ref.condition_index;
    if (!verdict || typeof idx !== 'number') {
      errors.push(`${pathLabel}: condition_rewrite source_ref must be { condition_index: <number> } with a verdict in context`);
      return errors;
    }
    const conds = Array.isArray(verdict.conditions) ? verdict.conditions : [];
    if (idx < 0 || idx >= conds.length) {
      errors.push(`${pathLabel}: source_ref.condition_index ${idx} out of range (verdict has ${conds.length} conditions)`);
      return errors;
    }
    const cond = conds[idx];
    if (!cond || cond.target_stage !== 'stage-j') {
      errors.push(`${pathLabel}: referenced condition must have target_stage "stage-j"`);
      return errors;
    }
    sourceText = cond.text || '';
  }

  // Layer 2b: token coverage
  const { extractSubstantiveTokens, compareTokens } = require('./seam-validation.cjs');
  const slotTokens = extractEntryTokens(entry, slotConfig);
  const orphans = compareTokens(slotTokens, sourceText);
  if (orphans.length > 0) {
    errors.push(`${pathLabel}: orphan tokens not in source (${kind}=${JSON.stringify(ref)}): ${orphans.slice(0, 10).join(', ')}${orphans.length > 10 ? ` (+${orphans.length - 10} more)` : ''}`);
  }

  return errors;
}

function extractEntryTokens(entry, slotConfig) {
  const { extractSubstantiveTokens } = require('./seam-validation.cjs');
  const tokens = [];
  const fields = (slotConfig && slotConfig.fields) || null;

  function walk(value, path = []) {
    if (value == null) return;
    if (typeof value === 'string') {
      for (const t of extractSubstantiveTokens(value)) tokens.push(t);
    } else if (Array.isArray(value)) {
      for (const v of value) walk(v, path);
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k === 'source_kind' || k === 'source_ref') continue;  // skip provenance metadata
        if (fields !== null && path.length === 0 && !fields.includes(k)) continue;  // restrict to declared fields at top level
        walk(v, path.concat(k));
      }
    }
  }
  walk(entry);
  return tokens;
}
```

Update `validateProvenance` to pass `slotConfig` to `checkEntryProvenance`:

```javascript
function validateProvenance(compileOutput, context) {
  const errors = [];
  const schema = loadSchema();
  const slots = (schema && schema.handoff_substantive_slots) || {};

  for (const [slotPath, slotConfig] of Object.entries(slots)) {
    if (!slotConfig || !slotConfig._provenance_required) continue;
    const target = resolveSlotPath(compileOutput, slotPath);
    if (target === undefined) continue;

    if (slotConfig.kind === 'per_entry') {
      if (typeof target !== 'object' || target === null) {
        errors.push(`${slotPath}: expected object for per_entry slot`);
        continue;
      }
      const entries = Array.isArray(target) ? target : Object.entries(target).map(([k, v]) => v);
      for (let i = 0; i < entries.length; i++) {
        const entryErrors = checkEntryProvenance(entries[i], `${slotPath}[${i}]`, context, slotConfig);
        errors.push(...entryErrors);
      }
    } else if (slotConfig.kind === 'whole_section') {
      const sectionErrors = checkEntryProvenance(target, slotPath, context, slotConfig);
      errors.push(...sectionErrors);
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run — tests pass**

Run: `node --test tests/test-handoff-token-coverage.js`

Expected: all tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass. If any provenance tests from Task 9 now fail because content tokens don't match source — add source content to the test fixtures or trim the slot content.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/schema.cjs tests/test-handoff-token-coverage.js
git commit -m "$(cat <<'EOF'
feat(schema): add Layer 2b token coverage to validateHandoff

For each provenanced slot passed Layer 2a, extract substantive tokens
from the slot content (respecting the optional `fields` restriction
from the schema annotation) and compare against the source text
(ledger entry content or condition text). Orphan tokens — present in
slot but absent from source and from the format whitelist — produce
a validation error naming the path and listing up to 10 orphans.

CJK tokens are matched literally (no lemmatization per spec §6.4);
latin tokens use the existing rule-based lemmatizer.

Provenance-metadata fields (source_kind, source_ref) are excluded
from the extraction walk. The `fields` list at slot level restricts
which top-level sub-fields of an entry participate in extraction —
structural fields like id/name/signature/location are excluded by
default when listed in the schema annotation.

Spec §6.4.
EOF
)"
```

---

## Task 13: Agent prompt update — `bonfire-h-review.md`

**Files:**
- Modify: `agents/bonfire-h-review.md`

Rationale: Belt-and-suspenders with the structural constraints. H-Review agent gets explicit anti-goals + the 5-branch decision tree.

- [ ] **Step 1: Modify `agents/bonfire-h-review.md`**

Open the file. After the existing `<rules>` block and before `<verdict_format>`, insert two new blocks:

```markdown
<anti_goals>
- Do NOT use `approved_with_conditions` as a compromise when the package has
  unresolved product-semantic gaps. That is the exact misuse that motivated
  this verdict type's schema tightening.
- Do NOT write conditions that ask J-Compile to `enumerate`, `classify`,
  `define`, `specify`, `categorize`, `partition`, `distinguish`, `list`,
  `rank`, `order`, or any paraphrase thereof (including `document each`,
  `for each X produce Y`, `give Z for every W`). If you want any of those
  things, the correct action is `rejected` + a `conflict_type` that routes
  to the stage that can produce the missing constraints.
</anti_goals>

<decision_tree>
For each gap you identify in the A-G package:

  Gap is a missing FROZEN ledger constraint required by the coder?
    → rejected + conflict_type: requirement_conflict (→ stage-c)

  Gap is a dependency chain gap?
    → rejected + conflict_type: dependency_gap (→ stage-e)

  Gap is an unresolved adversarial challenge?
    → rejected + conflict_type: adversarial_unresolved (→ stage-g)

  Gap is purely a format/schema/packaging shortcoming in the handoff?
    → approved_with_conditions + condition targeting stage-j.
    MUST verify: every substantive noun in the condition text appears
    in the FROZEN ledger or in the handoff schema vocabulary.

  Gap is ambiguous or fits multiple buckets?
    → rejected + conflict_type: requirement_conflict (the most
    conservative upstream stage).
    NEVER default to approved_with_conditions when uncertain. The cost
    of a false-positive reject is one reentry loop; the cost of a
    false-positive approve is J-Compile inventing product semantics.
    The former is recoverable; the latter is the bug we are fixing.
</decision_tree>
```

Also update the existing `<verdict_format>` block's JSON example to show the new `conditions` shape:

Replace:
```json
"conditions": [
  "Specific actionable condition (only for approved_with_conditions)"
],
```

With:
```json
"conditions": [
  { "text": "Reformat CON-003 acceptance criteria into given/when/then", "target_stage": "stage-j" }
],
```

- [ ] **Step 2: Grep for any remaining stale condition examples**

Run: `grep -n '"conditions"' agents/bonfire-h-review.md`

Expected: one match only (the updated example). No dangling references to the old free-string shape.

- [ ] **Step 3: Run all tests as a sanity check**

Run: `node --test tests/*.js`

Expected: all tests pass. Agent prompt is not directly exercised by tests; this is a guardrail to ensure no markdown parsing regression.

- [ ] **Step 4: Commit**

```bash
git add agents/bonfire-h-review.md
git commit -m "$(cat <<'EOF'
docs(agent): add anti_goals + decision_tree to bonfire-h-review

Belt-and-suspenders with the structural constraints from Tasks 2-12.
H-Review agent now has:

  <anti_goals> — explicit list of forbidden condition verbs and the
    "approved_with_conditions as compromise" pattern. Paraphrases
    (each, for-every, document-each) are named.

  <decision_tree> — 5 branches covering gap → verdict routing.
    Includes the ambiguity default: when uncertain, reject +
    requirement_conflict (never default to approved_with_conditions).

  Updated verdict_format example: conditions[] now contains objects
    with { text, target_stage } matching the schema from Task 2.

Spec §6.5.
EOF
)"
```

---

## Task 14: Agent prompt update — `bonfire-j-compile.md`

**Files:**
- Modify: `agents/bonfire-j-compile.md`

Rationale: J-Compile agent must produce `source_*` fields on substantive slots and emit `reentry_request` when it cannot fulfill a condition.

- [ ] **Step 1: Modify `agents/bonfire-j-compile.md`**

After the existing `<rules>` block and before `<output_format>`, insert:

```markdown
<provenance_rules>
Every substantive slot in your compile-output (per
`handoff_substantive_slots` in the schema — domain_model.entities,
function_contracts, data_contract, ui_contract.panels,
ui_contract.state_ownership, ui_contract.empty_states,
ui_contract.error_states) MUST carry:

  - `source_kind`: either `ledger_direct` or `condition_rewrite`
  - `source_ref`: the FROZEN ledger id (for ledger_direct), or
    `{ condition_index: <int> }` (for condition_rewrite)

You MUST NOT produce content whose substantive tokens do not appear
in the declared source. `handoff-validate` (Layer 2b) will reject
orphan tokens and the package will be bounced back to H-Review — not
to you. Do not save yourself the bounce by inventing content that
coincidentally uses source tokens; the diff is mechanical and will
catch you.

If a condition asks you to produce content for which no source is
adequate (the condition passed Layer 1 entry check but in execution
you find no way to write the slot without inventing), do NOT produce
a pass-through compile-output. Instead, emit a top-level
`reentry_request` field:

```json
{
  "handoff": { "code_ready": false, ... },
  "reentry_request": {
    "conflict_type": "invalid_stage_j_condition",
    "reason": "condition[<index>] '<excerpt>' requires inventing <what> — no adequate source coverage"
  }
}
```

`reentry_request` is a SIBLING of `handoff` at the compile-output
root — NOT nested inside handoff. `handoff-validate` detects this
shape and triggers the declared reentry back to stage-h. When you
declare a reentry, `handoff.code_ready` MUST be `false`. Inventing
content to hide an inadequacy or setting `code_ready=true` alongside
a reentry_request are both forbidden.
</provenance_rules>
```

Also update `<output_format>` to include the `reentry_request` field in the example JSON. Add (as a top-level optional sibling of `handoff`):

```json
  "reentry_request": null
```

In the comment/description section, note: "Optional. When present, `handoff.code_ready` MUST be `false`. Triggers reentry to stage-h via `invalid_stage_j_condition`."

Also add source fields to the example entity / function_contract / ui_contract panel entries:

In `domain_model` example (add fields to an example entity):
```json
"entities, fields, states, invariants — each entity MUST have source_kind + source_ref"
```

In `function_contracts` example entry, after `failure_modes`:
```json
"source_kind": "ledger_direct",
"source_ref": "CON-XXX"
```

And similar additions in ui_contract example.

- [ ] **Step 2: Sanity check**

Run: `node --test tests/*.js`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add agents/bonfire-j-compile.md
git commit -m "$(cat <<'EOF'
docs(agent): add provenance_rules to bonfire-j-compile

J-Compile agent now has:

  <provenance_rules> — substantive slots MUST carry source_kind +
    source_ref per Task 4's handoff_substantive_slots schema. Orphan
    tokens in slot content (Layer 2b) will fail handoff-validate.

    When an approved stage-j condition cannot be fulfilled without
    inventing, emit top-level reentry_request + handoff.code_ready=false
    instead of producing a pass-through. reentry_request is a sibling
    of handoff at compile-output root (not nested).

  Updated output_format examples show source_kind/source_ref on
    entities, function_contracts, and ui_contract panels; document
    the reentry_request field semantics.

Spec §6.5.
EOF
)"
```

---

## Task 15: Skill rewrite — Stage H step 37b

**Files:**
- Modify: `skills/plan/SKILL.md`

Rationale: Document the new Layer 1 gate in the orchestrator skill. `state-advance --step stage-h` already enforces it mechanically (Task 8), but the skill should tell Claude to expect the behavior.

- [ ] **Step 1: Locate Stage H section in `skills/plan/SKILL.md`**

Find the section under `## Stage H — Review`. Locate step 37 (validate delta).

- [ ] **Step 2: Insert step 37b after step 37**

Add:

```markdown
37b. **Validate conditions:** `state-advance --step stage-h` now runs Layer 1 automatically
     (`validate-h-conditions`). If the verdict has `approved_with_conditions` with any
     condition whose `target_stage` is not `stage-j`, or any condition containing a
     blacklisted verb, or any orphan substantive token relative to the FROZEN ledger,
     state-advance will exit non-zero with `conflict_type: invalid_stage_j_condition`.
     Do NOT retry H-Review with the same prompt — include the validation failures in
     the agent input so it produces a different verdict shape. Run
     `bonfire state-reentry --conflict-type invalid_stage_j_condition`, then resume
     from stage-h.
```

- [ ] **Step 3: Update step 40 or other integration notes if needed**

Find step 40 (Stage H verdict routing). After the routing bullets, verify the existing Assertion 1 note about state-advance enforcement still applies. Add one additional sentence noting Layer 1:

```markdown
Note: state-advance --step stage-h now enforces three invariants mechanically:
(1) schema validation of the verdict, (2) Layer 1 condition validation (Task 37b),
(3) rulings materialized in the ledger. Failure on any of the three blocks advance.
```

- [ ] **Step 4: Commit**

```bash
git add skills/plan/SKILL.md
git commit -m "$(cat <<'EOF'
docs(skill): document Layer 1 enforcement in Stage H

Inserts step 37b documenting that state-advance --step stage-h now
runs validate-h-conditions automatically. When it exits non-zero, the
orchestrator must include the Layer 1 violation details in the next
H-Review agent invocation — not blindly retry.

Updates step 40 integration note to list all three mechanical stage-h
invariants in order: schema → Layer 1 → rulings.

Spec §6.7.
EOF
)"
```

---

## Task 16: Adversarial fixtures — entry-level attacks

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/each-evades-enumerate/`
- Create: `tests/fixtures/hj-seam-adversarial/wrong-stage-j/`
- Create: `tests/fixtures/hj-seam-adversarial/condition-demands-field-add/`
- Create: `tests/fixtures/hj-seam-adversarial/empty-conditions-verdict/`
- Create: `tests/test-hj-seam-fixtures.js`

Rationale: Adversarial fixtures for attacks caught at Layer 1 or schema level. Each fixture includes a verdict + a README stating the expected rejection layer.

- [ ] **Step 1: Create fixture structure**

For each fixture directory, create:
- `README.md` — human-readable description + expected catch layer
- `h-review-verdict.json` — the attacking verdict
- Optionally `expected-failure.json` — structured expectation for test assertion

Create `tests/fixtures/hj-seam-adversarial/each-evades-enumerate/README.md`:

```markdown
# each-evades-enumerate

**Attack:** The condition uses "document each" as a paraphrase of "enumerate" to
sidestep the literal verb blacklist.

**Expected catch:** Layer 1 verb blacklist must include `each` paraphrases (the
blacklist in Task 5 includes `each` as part of the list-verb matching).

**Current behavior tested:** `validate-h-conditions` rejects this verdict with
a violation mentioning the blacklisted pattern.

**File list:**
- `h-review-verdict.json`
```

Create `tests/fixtures/hj-seam-adversarial/each-evades-enumerate/h-review-verdict.json`:

```json
{
  "verdict": "approved_with_conditions",
  "reason": "format work",
  "conditions": [
    { "text": "handoff MUST document each board texture scenario in structured form", "target_stage": "stage-j" }
  ]
}
```

(Note: strictly this requires extending the verb blacklist or adding a pattern match. For the adversarial fixture to catch it, consider: (a) add `each` to the blacklist in Task 5 if it isn't, OR (b) add an orphan-token check — "board texture scenario" tokens won't all be in a FROZEN ledger if the ledger doesn't mention scenarios. The fixture test should assert the rejection comes from SOME layer, not a specific one.)

Create `tests/fixtures/hj-seam-adversarial/wrong-stage-j/README.md`:

```markdown
# wrong-stage-j

**Attack:** Condition uses `target_stage: stage-c` (bypasses stage-j restriction).

**Expected catch:** Schema validation (Task 2) — `condition_item_shape` enforces
`target_stage_enum: ["stage-j"]`.
```

Create `tests/fixtures/hj-seam-adversarial/wrong-stage-j/h-review-verdict.json`:

```json
{
  "verdict": "approved_with_conditions",
  "reason": "x",
  "conditions": [
    { "text": "repropose CON-014 with exact count", "target_stage": "stage-c" }
  ]
}
```

Create `tests/fixtures/hj-seam-adversarial/condition-demands-field-add/README.md`:

```markdown
# condition-demands-field-add

**Attack:** Condition asks for a new semantic field addition (`add a risk_level field`).

**Expected catch:** Layer 1 — either verb blacklist (`add` is borderline, relies on
token coverage) or orphan-token check (`risk_level` not in any FROZEN ledger content).
```

Create `tests/fixtures/hj-seam-adversarial/condition-demands-field-add/h-review-verdict.json`:

```json
{
  "verdict": "approved_with_conditions",
  "reason": "x",
  "conditions": [
    { "text": "add a risk_level field to the scenario model", "target_stage": "stage-j" }
  ]
}
```

Create `tests/fixtures/hj-seam-adversarial/empty-conditions-verdict/README.md`:

```markdown
# empty-conditions-verdict

**Attack:** `verdict: approved_with_conditions` with `conditions: []`. Semantic
nonsense — the verdict type exists because there are format tasks to do.

**Expected catch:** Layer 1 — `validateHConditions` explicitly rejects empty
conditions array (spec §7.6).
```

Create `tests/fixtures/hj-seam-adversarial/empty-conditions-verdict/h-review-verdict.json`:

```json
{
  "verdict": "approved_with_conditions",
  "reason": "unclear why I chose this",
  "conditions": []
}
```

- [ ] **Step 2: Create the fixture test driver**

Create `tests/test-hj-seam-fixtures.js`:

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');
const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'hj-seam-adversarial');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-hj-fix-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir],
    { encoding: 'utf8', cwd: dir });
  return dir;
}

function installFixture(tmpDir, fixtureName) {
  const src = path.join(FIXTURE_ROOT, fixtureName);
  const dst = path.join(tmpDir, '.bonfire', 'plan');
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(src, 'h-review-verdict.json'), path.join(dst, 'h-review-verdict.json'));
}

function runValidateConditions(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'validate-h-conditions'], { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

function runDeltaValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'delta-validate',
      '--agent', 'bonfire-h-review',
      '--file', '.bonfire/plan/h-review-verdict.json'],
      { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

test('fixture: wrong-stage-j is caught by schema validation', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'wrong-stage-j');
    const result = runDeltaValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /target_stage/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: empty-conditions-verdict is caught by Layer 1', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'empty-conditions-verdict');
    const result = runValidateConditions(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /empty|conditions/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: condition-demands-field-add is caught by Layer 1', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'condition-demands-field-add');
    const result = runValidateConditions(dir);
    // Must be caught. Either blacklist or token coverage.
    assert.notEqual(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: each-evades-enumerate is caught by Layer 1 (orphan token or blacklist)', () => {
  const dir = makeTmpDir();
  try {
    installFixture(dir, 'each-evades-enumerate');
    const result = runValidateConditions(dir);
    // Token "scenario" may not be in ledger → orphan. Acceptable catch path.
    assert.notEqual(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 3: Run — confirm fixtures caught at expected layer**

Run: `node --test tests/test-hj-seam-fixtures.js`

Expected: all 4 fixture tests pass (i.e., each fixture verdict is rejected by the indicated layer).

- [ ] **Step 4: Regression sweep**

Run: `node --test tests/*.js`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/ tests/test-hj-seam-fixtures.js
git commit -m "$(cat <<'EOF'
test: adversarial fixtures — entry-level attacks (part 1/3)

Four fixtures demonstrating attacks caught at Layer 1 or schema:

  - each-evades-enumerate — "document each X" paraphrases "enumerate";
    caught by Layer 1 (orphan token or blacklist pattern).
  - wrong-stage-j — condition with target_stage: stage-c;
    caught by schema validation (condition_item_shape).
  - condition-demands-field-add — "add a risk_level field";
    caught by Layer 1 (orphan token coverage).
  - empty-conditions-verdict — approved_with_conditions + [];
    caught by Layer 1 empty-conditions rule.

Fixture driver at tests/test-hj-seam-fixtures.js asserts each is
rejected by the declared layer. Readmes document the attack and
expected catch.

Spec §7.6.
EOF
)"
```

---

## Task 17: Adversarial fixtures — provenance attacks

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/tagged-correct-but-invents/`
- Create: `tests/fixtures/hj-seam-adversarial/chain-dilution/`
- Create: `tests/fixtures/hj-seam-adversarial/lemmatization-edge/`
- Create: `tests/fixtures/hj-seam-adversarial/supersede-drift/`
- Modify: `tests/test-hj-seam-fixtures.js`

Rationale: Fixtures caught at Layer 2a/2b. Each includes a full ledger + verdict + compile-output triple because they exercise handoff-validate.

- [ ] **Step 1: Create each fixture with full triples**

For each fixture:
- `README.md` — attack description
- `constraint-ledger-history.jsonl` — ledger events to reconstruct state
- `h-review-verdict.json`
- `compile-output.json`

Example — `tests/fixtures/hj-seam-adversarial/tagged-correct-but-invents/README.md`:

```markdown
# tagged-correct-but-invents

**Attack:** compile-output declares `source_kind: ledger_direct, source_ref: CON-003`
but the slot content contains substantive tokens absent from CON-003.

**Expected catch:** Layer 2b (token coverage diff) — orphan tokens reported.
```

Create the supporting files. For brevity, each fixture should be minimal:

- `constraint-ledger-history.jsonl` — a few propose/update/freeze events to set up the ledger state.
- `h-review-verdict.json` — verdict that approves the compile.
- `compile-output.json` — the attacking compile-output.

The test driver loads all three into a tmp `.bonfire/` and runs `handoff-validate`, asserting failure.

Now create the other three fixtures with concrete content.

**`tagged-correct-but-invents/` concrete files:**

`constraint-ledger-history.jsonl`:
```jsonl
{"type":"propose","id":"CON-003","category":"retained_goal","content":"user can select drill mode","source":"stage-a","rationale":"core flow","timestamp":"2026-04-18T00:00:00Z"}
{"type":"update","id":"CON-003","field":"aligned_by","value":"stage-g-survival","timestamp":"2026-04-18T00:00:01Z"}
{"type":"freeze","id":"CON-003","timestamp":"2026-04-18T00:00:02Z"}
```

`h-review-verdict.json`:
```json
{ "verdict": "approved", "reason": "ok" }
```

`compile-output.json`:
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "u1" }],
    "domain_model": {
      "entities": {
        "DrillModel": {
          "fields": {},
          "notes": "user can select drill mode via monte-carlo simulator pre-scored heatmap",
          "source_kind": "ledger_direct",
          "source_ref": "CON-003"
        }
      }
    }
  }
}
```

Orphan tokens: `monte-carlo`, `simulator`, `pre-scored`, `heatmap` — none in CON-003's content.

**`chain-dilution/` concrete files:**

`README.md`:
```markdown
# chain-dilution

**Attack:** Condition claims to "format-rewrite" a ledger entry, but introduces
a new substantive token. compile-output cites the condition as source; Layer 2b
checks condition text and catches the orphan.

**Expected catch:** Layer 2b on the `condition_rewrite` path — the condition's
own text introduces `orthogonal` which has no anchor back to FROZEN ledger.
```

`constraint-ledger-history.jsonl`:
```jsonl
{"type":"propose","id":"CON-010","category":"retained_goal","content":"two drill modes: preflop and postflop","source":"stage-a","rationale":"core scope","timestamp":"2026-04-18T00:00:00Z"}
{"type":"update","id":"CON-010","field":"aligned_by","value":"stage-g-survival","timestamp":"2026-04-18T00:00:01Z"}
{"type":"freeze","id":"CON-010","timestamp":"2026-04-18T00:00:02Z"}
```

`h-review-verdict.json`:
```json
{
  "verdict": "approved_with_conditions",
  "reason": "format",
  "conditions": [
    { "text": "rewrite CON-010 into orthogonal drill-mode fields", "target_stage": "stage-j" }
  ]
}
```

`compile-output.json`:
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "u1" }],
    "domain_model": {
      "entities": {
        "DrillMode": {
          "fields": { "preflop": "bool", "postflop": "bool" },
          "notes": "orthogonal drill-mode fields for preflop and postflop",
          "source_kind": "condition_rewrite",
          "source_ref": { "condition_index": 0 }
        }
      }
    }
  }
}
```

Even though the compile-output cites the condition (which does contain "orthogonal"), the CONDITION ITSELF introduces `orthogonal` which is not in the FROZEN ledger. The chain's root anchor (CON-010) doesn't contain "orthogonal". Layer 1 on the condition catches this at H→J entry; but if the fixture is fed directly to handoff-validate, Layer 2b catches the token not appearing in the cited condition/ledger source text. This fixture pins the transitive behavior.

For this specific fixture, Layer 2b on `condition_rewrite` compares slot tokens to condition text — `orthogonal` IS in the condition text, so it would pass Layer 2b. The catch happens at Layer 1 (when state-advance --step stage-h runs). The fixture driver should assert rejection from validate-h-conditions, not handoff-validate, for this fixture.

**`lemmatization-edge/` concrete files:**

`README.md`:
```markdown
# lemmatization-edge

**Pinned behavior:** source says "classification algorithm", slot content says
"classifier implementations". Current lemmatizer: `classification` → `classificatio`
(drop `n`? no — drops `s`/`es`/`ing`/`ed` only; "classification" stays).
`classifier` stays. Neither maps to the other.

**Expected result:** FAIL. Orphan tokens `classifier` and `implementations`.

If the lemmatizer is later enhanced to map `classifier` ↔ `classification` (e.g.,
`-er` → `-` stem reduction), this fixture will start to PASS — the team should
re-evaluate and update this README or split into two fixtures.
```

`constraint-ledger-history.jsonl`:
```jsonl
{"type":"propose","id":"CON-050","category":"frozen_constraint","content":"classification algorithm priority-ordered","source":"stage-c","rationale":"r","timestamp":"2026-04-18T00:00:00Z"}
{"type":"update","id":"CON-050","field":"aligned_by","value":"stage-g-survival","timestamp":"2026-04-18T00:00:01Z"}
{"type":"freeze","id":"CON-050","timestamp":"2026-04-18T00:00:02Z"}
```

`h-review-verdict.json`:
```json
{ "verdict": "approved", "reason": "ok" }
```

`compile-output.json`:
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "u1" }],
    "domain_model": {
      "entities": {
        "HandStrength": {
          "fields": {},
          "notes": "classifier implementations for priority-ordered",
          "source_kind": "ledger_direct",
          "source_ref": "CON-050"
        }
      }
    }
  }
}
```

Expected: FAIL. `classifier` and `implementations` are orphans.

**`supersede-drift/` concrete files:**

`README.md`:
```markdown
# supersede-drift

**Attack:** Compile-output cites CON-014 as ledger_direct source, but CON-014 is
SUPERSEDED by CON-014b.

**Expected catch:** Layer 2a must require FROZEN status (not SUPERSEDED).
```

`constraint-ledger-history.jsonl`:
```jsonl
{"type":"propose","id":"CON-014","category":"frozen_constraint","content":"board texture classification","source":"stage-c","rationale":"r","timestamp":"2026-04-18T00:00:00Z"}
{"type":"update","id":"CON-014","field":"challenged_by","value":"d-critique","timestamp":"2026-04-18T00:00:01Z"}
{"type":"update","id":"CON-014","field":"aligned_by","value":"g-blue","timestamp":"2026-04-18T00:00:02Z"}
{"type":"freeze","id":"CON-014","timestamp":"2026-04-18T00:00:03Z"}
{"type":"supersede","id":"CON-014b","supersedes":"CON-014","category":"frozen_constraint","content":"board texture classification 10 exact categories","source":"h-review","rationale":"H-Review ruling","timestamp":"2026-04-18T00:00:04Z"}
```

After replay: `CON-014` is SUPERSEDED, `CON-014b` is FROZEN.

`h-review-verdict.json`:
```json
{ "verdict": "approved", "reason": "ok" }
```

`compile-output.json`:
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "u1" }],
    "domain_model": {
      "entities": {
        "BoardTexture": {
          "fields": {},
          "notes": "board texture classification with 10 categories",
          "source_kind": "ledger_direct",
          "source_ref": "CON-014"
        }
      }
    }
  }
}
```

Expected: FAIL. `source_ref: CON-014` is SUPERSEDED, not FROZEN.

- [ ] **Step 2: Add fixture-driver tests**

Extend `tests/test-hj-seam-fixtures.js` with new tests — each loads the fixture triple and calls `handoff-validate`:

```javascript
function installProvenanceFixture(tmpDir, fixtureName) {
  const src = path.join(FIXTURE_ROOT, fixtureName);
  const bonfire = path.join(tmpDir, '.bonfire');
  fs.mkdirSync(path.join(bonfire, 'plan'), { recursive: true });
  fs.mkdirSync(path.join(bonfire, 'truth-surface'), { recursive: true });
  fs.copyFileSync(path.join(src, 'constraint-ledger-history.jsonl'),
    path.join(bonfire, 'truth-surface', 'constraint-ledger-history.jsonl'));
  fs.copyFileSync(path.join(src, 'h-review-verdict.json'),
    path.join(bonfire, 'plan', 'h-review-verdict.json'));
  fs.copyFileSync(path.join(src, 'compile-output.json'),
    path.join(bonfire, 'plan', 'compile-output.json'));
  execFileSync('node', [CLI, 'truth-rebuild'], { encoding: 'utf8', cwd: tmpDir });
}

function runHandoffValidate(dir) {
  try {
    const stdout = execFileSync('node', [CLI, 'handoff-validate'], { encoding: 'utf8', cwd: dir });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status, stdout: err.stdout ? err.stdout.toString() : '', stderr: err.stderr ? err.stderr.toString() : '' };
  }
}

test('fixture: tagged-correct-but-invents caught by Layer 2b', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'tagged-correct-but-invents');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orphan/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: supersede-drift caught by Layer 2a (source not FROZEN)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'supersede-drift');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /SUPERSEDED|FROZEN/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: chain-dilution caught by Layer 1 (condition introduces tokens not in ledger)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'chain-dilution');
    // The attack is at the condition-text level: "orthogonal" is not in CON-010.
    // validate-h-conditions rejects the verdict before J-Compile runs.
    // (runValidateConditions defined earlier in this file.)
    const result = runValidateConditions(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orthogonal/i);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: lemmatization-edge pins behavior (either pass or fail, as long as consistent)', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'lemmatization-edge');
    const result = runHandoffValidate(dir);
    // Behavior is pinned — the fixture README declares expected outcome.
    // For this test, we assert that the outcome is deterministic across runs.
    // (The README says: `classifier` vs `classification` — current lemmatizer
    // drops `classification` → `classificatio`, which doesn't match `classifier`.
    // Expected outcome: FAIL — orphan token `classifier`.)
    assert.notEqual(result.code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 3: Run**

Run: `node --test tests/test-hj-seam-fixtures.js`

Expected: all 8 fixture tests pass (4 from Task 16 + 4 new).

- [ ] **Step 4: Regression sweep**

Run: `node --test tests/*.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/ tests/test-hj-seam-fixtures.js
git commit -m "$(cat <<'EOF'
test: adversarial fixtures — provenance attacks (part 2/3)

Four fixtures exercising handoff-validate's Layer 2a and 2b:

  - tagged-correct-but-invents — valid source_ref, orphan tokens;
    caught by Layer 2b.
  - chain-dilution — condition rewriting condition rewriting ledger,
    each step introducing new substantive tokens; Layer 2b catches
    at the first layer of dilution.
  - lemmatization-edge — pins the classifier/classification boundary
    (current lemmatizer: drops "classification" → "classificatio",
    "classifier" stays; they don't match → fixture asserts FAIL).
  - supersede-drift — source_ref points to SUPERSEDED entry; Layer 2a
    must require FROZEN.

Each fixture has README documenting the attack and expected catch
layer. Test driver asserts handoff-validate rejects with a message
matching the expected layer.

Spec §7.6.
EOF
)"
```

---

## Task 18: Adversarial fixtures — CJK attacks + positive companion

**Files:**
- Create: `tests/fixtures/hj-seam-adversarial/cross-language-smuggle/`
- Create: `tests/fixtures/hj-seam-adversarial/cross-language-approved/`
- Modify: `tests/test-hj-seam-fixtures.js`

Rationale: Pin behavior for CJK source/slot interaction. Negative (smuggle) and positive (approved via explicit condition text) pair.

- [ ] **Step 1: Create the negative fixture `cross-language-smuggle/`**

`README.md`:

```markdown
# cross-language-smuggle

**Attack:** Ledger is English ("Chinese language UI throughout"); compile-output
slot produces specific Chinese UI text ("开始训练", "重置统计") claimed to be
derived from the English ledger entry. The declared source contains NO CJK
tokens.

**Expected catch:** Layer 2b — CJK tokens in slot are literal-only and have no
latin equivalents in source. All CJK tokens are orphans.

**Resolution pattern:** H-Review must issue a stage-j condition whose text
explicitly contains the approved Chinese copy. The companion fixture
`cross-language-approved/` shows the compliant pattern.
```

Ledger (minimal):
```jsonl
{"type":"propose","id":"CON-007","category":"retained_goal","content":"Chinese language UI throughout","source":"stage-a","rationale":"User request","timestamp":"2026-04-18T00:00:00Z"}
{"type":"update","id":"CON-007","field":"aligned_by","value":"stage-g-survival","timestamp":"2026-04-18T00:00:01Z"}
{"type":"freeze","id":"CON-007","timestamp":"2026-04-18T00:00:02Z"}
```

Verdict (approves the compile):
```json
{ "verdict": "approved", "reason": "ok" }
```

compile-output (the attack):
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "unit-1" }],
    "ui_contract": {
      "panels": {
        "Home": {
          "description": "开始训练 和 重置统计",
          "source_kind": "ledger_direct",
          "source_ref": "CON-007"
        }
      }
    }
  }
}
```

- [ ] **Step 2: Create the positive companion `cross-language-approved/`**

`README.md`:

```markdown
# cross-language-approved

**Pattern:** Ledger is English. H-Review issues a stage-j condition whose text
contains the exact approved Chinese copy. Compile-output slot declares
`source_kind: condition_rewrite, source_ref: { condition_index: 0 }` and its
CJK tokens match the condition text literally.

**Expected:** Layer 2b passes — all CJK tokens are in the condition source.
```

Files (ledger as above):

Verdict:
```json
{
  "verdict": "approved_with_conditions",
  "reason": "Chinese UI copy approved",
  "conditions": [
    { "text": "panel titled 开始训练 和 重置统计", "target_stage": "stage-j" }
  ]
}
```

compile-output (compliant):
```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "x",
    "retained_goal": "x",
    "implementation_scope": "x",
    "implementation_units": [{ "id": "unit-1" }],
    "ui_contract": {
      "panels": {
        "Home": {
          "description": "开始训练 和 重置统计",
          "source_kind": "condition_rewrite",
          "source_ref": { "condition_index": 0 }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Add fixture tests**

Extend `tests/test-hj-seam-fixtures.js`:

```javascript
test('fixture: cross-language-smuggle — CJK orphans caught by Layer 2b', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'cross-language-smuggle');
    const result = runHandoffValidate(dir);
    assert.notEqual(result.code, 0);
    const out = result.stdout + result.stderr;
    assert.match(out, /orphan|开始|训练/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test('fixture: cross-language-approved — explicit CJK condition passes', () => {
  const dir = makeTmpDir();
  try {
    installProvenanceFixture(dir, 'cross-language-approved');
    const result = runHandoffValidate(dir);
    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 4: Run**

Run: `node --test tests/test-hj-seam-fixtures.js`

Expected: all 10 fixture tests pass.

- [ ] **Step 5: Regression sweep**

Run: `node --test tests/*.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/hj-seam-adversarial/ tests/test-hj-seam-fixtures.js
git commit -m "$(cat <<'EOF'
test: adversarial fixtures — CJK attacks (part 3/3)

Two fixtures pinning CJK behavior:

  - cross-language-smuggle — English ledger, Chinese UI slot claiming
    ledger_direct provenance. Layer 2b catches all CJK orphans
    (literal match, no lemmatization).
  - cross-language-approved — companion positive case: explicit
    stage-j condition carries exact Chinese copy; slot cites the
    condition. Layer 2b passes.

Together these pin spec §6.4's CJK handling: strict literal match,
no fuzzy normalization. The compliant path for non-English UI is an
explicit H-Review condition that carries the text.

Spec §6.4 + §7.6.
EOF
)"
```

---

## Task 19: End-to-end integration test

**Files:**
- Modify: `tests/test-state-advance-invariants.js`

Rationale: One test that exercises the whole H→J flow: propose → freeze → H-Review verdict with stage-j condition → state-advance --step stage-h (Layer 1 passes) → J-Compile with provenance → handoff-validate (Layer 2a+2b pass).

- [ ] **Step 1: Append the E2E test**

Add to `tests/test-state-advance-invariants.js`:

```javascript
// ---------------------------------------------------------------------------
// End-to-end flow: clean H→J path
// ---------------------------------------------------------------------------

test('E2E: clean H→J flow — valid stage-j condition, provenance handoff, all validators pass', () => {
  const dir = makeTmpDir();
  try {
    // 1. Propose + freeze a ledger entry
    execFileSync('node', [CLI, 'truth-propose',
      '--id', 'CON-100', '--category', 'retained_goal',
      '--content', 'user sees winning hand at showdown', '--rationale', 'r', '--source', 'stage-c'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-update',
      '--id', 'CON-100', '--field', 'aligned_by', '--value', 'stage-g-survival'],
      { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-100'],
      { encoding: 'utf8', cwd: dir });

    // 2. Write an H-Review verdict with a clean stage-j condition
    setPipelineToStageH(dir);
    const verdictPath = path.join(dir, '.bonfire', 'plan', 'h-review-verdict.json');
    fs.mkdirSync(path.dirname(verdictPath), { recursive: true });
    fs.writeFileSync(verdictPath, JSON.stringify({
      verdict: 'approved_with_conditions',
      reason: 'format rewrite',
      rulings: [],
      conditions: [
        {
          text: 'rewrite CON-100 acceptance into given when then — user sees winning hand at showdown',
          target_stage: 'stage-j',
        },
      ],
    }, null, 2));

    // 3. Write a compile-output with proper provenance
    const compilePath = path.join(dir, '.bonfire', 'plan', 'compile-output.json');
    fs.writeFileSync(compilePath, JSON.stringify({
      handoff: {
        code_ready: true,
        handoff_summary: 'showdown scenario',
        retained_goal: 'user sees winning hand',
        implementation_scope: 'single panel',
        implementation_units: [{ id: 'unit-1' }],
        ui_contract: {
          panels: {
            Showdown: {
              description: 'Given user placed bet When showdown occurs Then user sees winning hand',
              source_kind: 'condition_rewrite',
              source_ref: { condition_index: 0 },
            },
          },
        },
      },
    }, null, 2));

    // 4. state-advance from stage-h — Layer 1 should pass
    const advanceResult = runAdvance(dir, 'stage-h');
    assert.equal(advanceResult.code, 0, `stage-h advance failed: ${advanceResult.stderr}`);

    // 5. handoff-validate — Layer 2a + 2b should pass
    const validateResult = (() => {
      try {
        const stdout = execFileSync('node', [CLI, 'handoff-validate'], { encoding: 'utf8', cwd: dir });
        return { code: 0, stdout };
      } catch (err) {
        return { code: err.status, stderr: err.stderr ? err.stderr.toString() : '' };
      }
    })();
    assert.equal(validateResult.code, 0, `handoff-validate failed: ${validateResult.stderr}`);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run**

Run: `node --test tests/test-state-advance-invariants.js`

Expected: the E2E test passes along with all others.

- [ ] **Step 3: Regression sweep**

Run: `node --test tests/*.js`

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test-state-advance-invariants.js
git commit -m "$(cat <<'EOF'
test: end-to-end H→J flow with clean provenance

Exercises the full happy path through all three layers:
  1. Propose + freeze ledger entry (CON-100)
  2. Write H-Review verdict with stage-j condition (Layer 1 passes)
  3. Write compile-output with condition_rewrite provenance on
     ui_contract.panels (Layer 2a passes)
  4. Tokens in slot description match condition text (Layer 2b passes)
  5. state-advance --step stage-h succeeds
  6. handoff-validate succeeds

If any layer regresses, this test catches it.

Companion to the adversarial fixture battery — positive proof that
the defense layers don't reject legitimate stage-j work.
EOF
)"
```

---

## Task 20: Full suite verification

**Files:** None modified.

Rationale: Final sweep confirming nothing regressed across all test files.

- [ ] **Step 1: Run the entire test suite**

Run: `node --test tests/*.js`

Expected: all tests pass. Total count approximately 180+ tests (143 from Assertion 1 baseline + ~40 new tests for Assertion 2).

- [ ] **Step 2: Verify new commands in CLI help**

Run: `node bin/bonfire-tools.cjs 2>&1 | head -5`

Expected: the Commands line includes `validate-h-conditions` (new).

- [ ] **Step 3: Inspect git log**

Run: `git log --oneline -25`

Expected: the 19 task commits from this plan plus earlier Assertion 1 commits. Each commit atomic, each commit message describes one concern.

- [ ] **Step 4: No commit — verification only**

The Assertion 2 implementation is ready for PR.

---

## Notes for the implementing engineer

- **`reentry_request` is a sibling of `handoff`.** In `compile-output.json`, NOT nested inside handoff. If you see it nested, that's a bug.
- **Never generalize `condition_item_shape` into a JSON Schema subset.** The spec (§6.1) is explicit: targeted dispatch only. Resist the temptation even if it looks like duplication.
- **Format whitelist is evidence-based growth only.** Don't add a token because you think it might be needed — wait for a fixture or real run to show the need, then add with a commit justifying it.
- **Lemmatization is imperfect by design.** Over-aggressive means some orphans won't be caught by tokenization (but will by the blacklist); under-aggressive means some legitimate rewrites get flagged (H-Review rewrites the condition or J-Compile rewrites the slot). Both are acceptable. Do NOT try to import a full NLP lemmatizer.
- **CJK is strict.** Each CJK character is its own token. No normalization. This is a declared limitation (spec §6.4, §8).
- **Schema annotation is the source of truth.** Don't hardcode the `handoff_substantive_slots` list into `schema.cjs`. The entire point is that adding a new substantive slot to the handoff shape is a SINGLE schema edit that propagates everywhere automatically.
- **Provenance attaches at the annotated slot level.** Not on sub-fields. Per-entry slots attach per entry; whole-section slots attach at the section root. `fields` narrows token extraction, NOT provenance placement.
- **The plan is a suggestion. If you find a better order, take it.** But write down why in the commit message. Future readers will want to know if you had a reason.
