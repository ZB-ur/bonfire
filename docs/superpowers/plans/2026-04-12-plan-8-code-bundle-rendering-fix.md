# Code-Stage Bundle Rendering Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 empty code-stage bundle files (91/92/95/96/98/99) by aligning J-Compile output contracts, templates, selectors, and adding renderer validation.

**Architecture:** Three layers of fix: (1) renderer gains validation + objectToArray fallback + array join, (2) templates updated to match canonical schemas, (3) J-Compile agent prompt enforces strict output contracts. Schema selector change for note 91.

**Tech Stack:** Node.js, node:test, bonfire template engine (regex-based)

---

### Task 1: Renderer — array field join

**Files:**
- Modify: `bin/lib/renderer.cjs:29-32,41-43`
- Test: `tests/test-render-contracts.js` (create)

- [ ] **Step 1: Write the failing test for array join in field substitution**

Create `tests/test-render-contracts.js`:

```javascript
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderTemplate } = require('../bin/lib/renderer.cjs');

test('array field renders with join(", ") in top-level substitution', () => {
  const template = '**Units:** {{units}}';
  const data = { units: ['unit-1', 'unit-2', 'unit-3'] };
  const result = renderTemplate(template, data);
  assert.equal(result, '**Units:** unit-1, unit-2, unit-3');
});

test('array field renders with join(", ") inside each block', () => {
  const template = '{{#each items}}{{name}}: {{tags}}\n{{/each}}';
  const data = { items: [{ name: 'A', tags: ['x', 'y'] }, { name: 'B', tags: ['z'] }] };
  const result = renderTemplate(template, data);
  assert.equal(result, 'A: x, y\nB: z\n');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/test-render-contracts.js`
Expected: FAIL — arrays render as `"unit-1,unit-2,unit-3"` (no spaces) via `String()`

- [ ] **Step 3: Implement array join in renderTemplate**

In `bin/lib/renderer.cjs`, modify the two `String(val)` calls to handle arrays:

Change line 30 (inside `{{#each}}` object iteration):
```javascript
          const val = item[key];
          if (val === undefined || val === null) return '';
          if (Array.isArray(val)) return val.join(', ');
          return String(val);
```

Change line 42-43 (top-level field substitution):
```javascript
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/test-render-contracts.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `node --test tests/*.js`
Expected: 98 tests pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add tests/test-render-contracts.js bin/lib/renderer.cjs
git commit -m "feat(renderer): array fields render with join(', ') instead of String()"
```

---

### Task 2: Renderer — undefined field validation

**Files:**
- Modify: `bin/lib/renderer.cjs:20-47`
- Test: `tests/test-render-contracts.js`

- [ ] **Step 1: Write the failing tests for undefined field validation**

Append to `tests/test-render-contracts.js`:

```javascript
test('undefined field in {{field}} produces RENDER ERROR comment', () => {
  const template = 'Hello {{name}}, your role is {{role}}';
  const data = { name: 'Alice' };  // role is undefined
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Alice'));
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "role" in source data -->'));
});

test('null field in {{field}} produces RENDER ERROR comment', () => {
  const template = 'Status: {{status}}';
  const data = { status: null };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "status" in source data -->'));
});

test('empty string field renders normally (no error)', () => {
  const template = 'Notes: {{notes}}';
  const data = { notes: '' };
  const result = renderTemplate(template, data);
  assert.equal(result, 'Notes: ');
});

test('undefined field in {{#each}} produces RENDER ERROR comment', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = {};  // items is undefined
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "items" in source data -->'));
});

test('null field in {{#each}} produces RENDER ERROR comment', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = { items: null };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('<!-- RENDER ERROR: missing required field "items" in source data -->'));
});

test('empty array in {{#each}} renders empty (no error)', () => {
  const template = '{{#each items}}{{name}}{{/each}}';
  const data = { items: [] };
  const result = renderTemplate(template, data);
  assert.equal(result, '');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-render-contracts.js`
Expected: FAIL — undefined/null currently produce empty string `''`, not error comments

- [ ] **Step 3: Implement undefined field validation in renderTemplate**

Replace the `renderTemplate` function in `bin/lib/renderer.cjs` (lines 20-47):

```javascript
function renderTemplate(template, data) {
  // Process {{#each arrayName}}...{{/each}} blocks
  const eachRe = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let result = template.replace(eachRe, (_, arrayName, block) => {
    const val = data[arrayName];
    // Validation: undefined/null → RENDER ERROR
    if (val === undefined || val === null) {
      return '<!-- RENDER ERROR: missing required field "' + arrayName + '" in source data -->';
    }
    const arr = Array.isArray(val) ? val : objectToArray(val, arrayName);
    if (arr.length === 0) return '';
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return block.replace(/\{\{(\w+)\}\}/g, (m, key) => {
          const v = item[key];
          if (v === undefined || v === null) return '';
          if (Array.isArray(v)) return v.join(', ');
          return String(v);
        });
      } else {
        return block.replace(/\{\{\.\}\}/g, String(item));
      }
    }).join('');
  });

  // Process remaining {{field}} substitutions from top-level data
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    // Validation: undefined/null → RENDER ERROR
    if (val === undefined || val === null) {
      return '<!-- RENDER ERROR: missing required field "' + key + '" in source data -->';
    }
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  });

  return result;
}
```

Note: This references `objectToArray` which will be implemented in Task 3. For now, add a stub above `renderTemplate`:

```javascript
function objectToArray(obj, fieldName) {
  // Stub — implemented in Task 3
  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-render-contracts.js`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Run full test suite**

Run: `node --test tests/*.js`
Expected: All pass. Existing tests that relied on undefined→empty may need checking, but the smoke tests use complete golden data.

- [ ] **Step 6: Commit**

```bash
git add bin/lib/renderer.cjs tests/test-render-contracts.js
git commit -m "feat(renderer): undefined/null fields produce visible RENDER ERROR comments"
```

---

### Task 3: Renderer — objectToArray fallback with warning

**Files:**
- Modify: `bin/lib/renderer.cjs` (replace stub)
- Test: `tests/test-render-contracts.js`

- [ ] **Step 1: Write the failing tests for objectToArray**

Append to `tests/test-render-contracts.js`:

```javascript
test('objectToArray: object with object values → [{key, ...spread}]', () => {
  const template = '{{#each items}}{{key}}: {{name}}\n{{/each}}';
  const data = { items: { a: { name: 'Alpha' }, b: { name: 'Beta' } } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('a: Alpha'));
  assert.ok(result.includes('b: Beta'));
});

test('objectToArray: object with array values → [{key, items}]', () => {
  const template = '{{#each mapping}}{{key}}: {{items}}\n{{/each}}';
  const data = { mapping: { 'CON-001': ['unit-1', 'unit-2'], 'CON-002': ['unit-3'] } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('CON-001: unit-1, unit-2'));
  assert.ok(result.includes('CON-002: unit-3'));
});

test('objectToArray: object with string values → [{key, value}]', () => {
  const template = '{{#each items}}{{key}}={{value}}\n{{/each}}';
  const data = { items: { color: 'red', size: 'large' } };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('color=red'));
  assert.ok(result.includes('size=large'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test-render-contracts.js`
Expected: FAIL — the stub `objectToArray` returns `[]`, so each blocks render empty

- [ ] **Step 3: Implement objectToArray with warning logging**

Replace the stub `objectToArray` in `bin/lib/renderer.cjs` with the full implementation. Place it above `renderTemplate`:

```javascript
/**
 * Convert a non-array object to an array for {{#each}} iteration.
 * This is a fallback safety net — correctly-shaped data should already be arrays.
 *
 * Rules:
 *   {k: {a, b}} → [{key: k, a, b}]
 *   {k: [...]}  → [{key: k, items: [...]}]
 *   {k: "str"}  → [{key: k, value: "str"}]
 *
 * Logs a warning when triggered (soft algedonic signal).
 */
function objectToArray(obj, fieldName) {
  if (typeof obj !== 'object' || obj === null) return [];
  const result = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result.push(Object.assign({ key: k }, v));
    } else if (Array.isArray(v)) {
      result.push({ key: k, items: v });
    } else {
      result.push({ key: k, value: v });
    }
  }
  // Log warning — this fallback should not be the normal path
  try {
    const logDir = path.join(process.cwd(), '.bonfire', 'logs');
    if (fs.existsSync(logDir)) {
      appendLog(path.join(logDir, 'render.log'), {
        level: 'warn',
        message: 'objectToArray fallback triggered for field "' + fieldName + '"',
      });
    }
  } catch (_) {
    // Best-effort logging
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test-render-contracts.js`
Expected: PASS (all 11 tests)

- [ ] **Step 5: Run full test suite**

Run: `node --test tests/*.js`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add bin/lib/renderer.cjs tests/test-render-contracts.js
git commit -m "feat(renderer): objectToArray fallback with render.log warning"
```

---

### Task 4: Schema selector — note 91

**Files:**
- Modify: `schemas/bonfire-v1.json:85`

- [ ] **Step 1: Change note 91 source selector**

In `schemas/bonfire-v1.json`, change:

```json
      "source": "plan/compile-output.json#canonical_contracts",
```

to:

```json
      "source": "plan/compile-output.json#handoff",
```

- [ ] **Step 2: Run full test suite**

Run: `node --test tests/*.js`
Expected: All 98 pass (no existing test renders note 91)

- [ ] **Step 3: Commit**

```bash
git add schemas/bonfire-v1.json
git commit -m "fix(schema): note 91 selector #canonical_contracts → #handoff"
```

---

### Task 5: Template updates — constraint-crosswalk, execution-manifest, code-batches

**Files:**
- Modify: `templates/constraint-crosswalk.md`
- Modify: `templates/execution-manifest.md`
- Modify: `templates/code-batches.md`

- [ ] **Step 1: Update constraint-crosswalk.md**

Replace the entire file content with:

```markdown
# Constraint Crosswalk

← [[90-code-handoff]] | See also: [[05-constraint-ledger]]

## Constraint to Unit Mapping

{{#each mappings}}
### {{constraint_id}}

**Constraint:** {{content}}
**Implemented by:** {{unit_ids}}
{{/each}}
```

- [ ] **Step 2: Update execution-manifest.md**

Replace the entire file content with:

```markdown
# Execution Manifest

← [[90-code-handoff]]

{{description}}

## Execution Order

{{#each waves}}
### Wave {{wave}}: {{description}}

**Units:** {{units}}
{{/each}}
```

- [ ] **Step 3: Update code-batches.md**

Replace the entire file content with:

```markdown
# Code Batches

← [[90-code-handoff]]

## Batches

{{#each batches}}
### {{batch_id}}

{{description}}

**Units:** {{units}}
{{/each}}
```

- [ ] **Step 4: Run full test suite**

Run: `node --test tests/*.js`
Expected: All 98 pass

- [ ] **Step 5: Commit**

```bash
git add templates/constraint-crosswalk.md templates/execution-manifest.md templates/code-batches.md
git commit -m "fix(templates): align crosswalk, manifest, batches to canonical schemas"
```

---

### Task 6: Template contract tests — render each updated template

**Files:**
- Modify: `tests/test-render-contracts.js`

- [ ] **Step 1: Write template contract tests**

Append to `tests/test-render-contracts.js`:

```javascript
function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'templates', name), 'utf8');
}

test('constraint-crosswalk template renders with correct data', () => {
  const template = loadTemplate('constraint-crosswalk.md');
  const data = {
    mappings: [
      { constraint_id: 'CON-001', content: 'Must support 6-max', unit_ids: ['unit-1', 'unit-2'] },
      { constraint_id: 'CON-002', content: 'Chinese UI', unit_ids: ['unit-3'] }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('### CON-001'));
  assert.ok(result.includes('**Constraint:** Must support 6-max'));
  assert.ok(result.includes('**Implemented by:** unit-1, unit-2'));
  assert.ok(result.includes('### CON-002'));
  assert.ok(result.includes('**Implemented by:** unit-3'));
});

test('execution-manifest template renders with correct data', () => {
  const template = loadTemplate('execution-manifest.md');
  const data = {
    description: 'Build in dependency order',
    waves: [
      { wave: 1, units: 'unit-1', description: 'Scaffolding' },
      { wave: 2, units: 'unit-2, unit-3', description: 'Core engine' }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Build in dependency order'));
  assert.ok(result.includes('### Wave 1: Scaffolding'));
  assert.ok(result.includes('**Units:** unit-1'));
  assert.ok(result.includes('### Wave 2: Core engine'));
  assert.ok(result.includes('**Units:** unit-2, unit-3'));
});

test('code-batches template renders with correct data', () => {
  const template = loadTemplate('code-batches.md');
  const data = {
    batches: [
      { batch_id: 'batch_1_foundation', description: 'Set up project', units: ['unit-1', 'unit-2'] },
      { batch_id: 'batch_2_engine', description: 'Build engine', units: ['unit-3'] }
    ]
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('### batch_1_foundation'));
  assert.ok(result.includes('Set up project'));
  assert.ok(result.includes('**Units:** unit-1, unit-2'));
  assert.ok(result.includes('### batch_2_engine'));
});

test('stage-j template renders with compile_summary object', () => {
  const template = loadTemplate('stage-j.md');
  const data = {
    summary: 'Compiled successfully',
    code_ready: true,
    blockers: ['Missing API key', 'Incomplete docs']
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Compiled successfully'));
  assert.ok(result.includes('true'));
  assert.ok(result.includes('- Missing API key'));
  assert.ok(result.includes('- Incomplete docs'));
});

test('final-handoff template renders with object data', () => {
  const template = loadTemplate('final-handoff.md');
  const data = {
    statement: 'Handoff is code-ready',
    status: 'code_ready'
  };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('Handoff is code-ready'));
  assert.ok(result.includes('code_ready'));
});
```

- [ ] **Step 2: Run the new tests**

Run: `node --test tests/test-render-contracts.js`
Expected: PASS (all 16 tests)

- [ ] **Step 3: Run full test suite**

Run: `node --test tests/*.js`
Expected: All pass (98 existing + 16 new = 114 total)

- [ ] **Step 4: Commit**

```bash
git add tests/test-render-contracts.js
git commit -m "test: template contract tests for crosswalk, manifest, batches, stage-j, final-handoff"
```

---

### Task 7: J-Compile agent prompt — strict output schema

**Files:**
- Modify: `agents/bonfire-j-compile.md:24-101`

- [ ] **Step 1: Update the output_format section**

Replace the `<output_format>` section in `agents/bonfire-j-compile.md` with:

````markdown
<output_format>
Write `.bonfire/plan/compile-output.json` with this structure:

```json
{
  "handoff": {
    "code_ready": true,
    "handoff_summary": "One-paragraph summary of what the coder will build",
    "retained_goal": "The frozen goal from Stage A approval",
    "implementation_scope": "What is in scope for this code pass",
    "repo_targets": ["/path/to/target/repo"],
    "repo_grounding": { "key facts about repo state" },
    "read_first": ["files the coder should read before starting"],
    "frozen_product_decisions": ["decisions that may not drift"],
    "domain_model": { "entities, fields, states, invariants" },
    "data_contract": { "persistence/API behavior" },
    "ui_contract": { "routes, panels, forms, states" },
    "function_contracts": [
      {
        "id": "FC-001",
        "name": "functionName",
        "kind": "function|method|module",
        "location": "src/path/file.ts",
        "signature": "functionName(param: Type): ReturnType",
        "purpose": "What it does",
        "inputs": ["param descriptions"],
        "outputs": ["return value descriptions"],
        "side_effects": ["side effects"],
        "invariants": ["must always be true"],
        "failure_modes": ["what can go wrong"]
      }
    ],
    "file_plan": [
      { "path": "src/file.ts", "action": "create|modify", "why": "reason", "depends_on": [] }
    ],
    "implementation_units": [
      {
        "id": "unit-1",
        "title": "Unit title",
        "objective": "What this unit accomplishes",
        "scope": "Boundaries of this unit",
        "files": ["src/file.ts"],
        "functions": ["FC-001"],
        "depends_on": [],
        "verification": ["npm test -- --grep unitName"],
        "done_when": ["Specific completion criteria"]
      }
    ],
    "verification_commands": ["npm run build", "npm test"],
    "browser_checks": ["manual browser verification steps"],
    "acceptance_checks": ["what must be true to call the work done"],
    "allowed_decisions": ["low-impact engineering choices the coder may make"],
    "forbidden_decisions": ["high-impact choices the coder must NOT make"],
    "reentry_triggers": ["conditions that should halt coding and reenter planning"],
    "unresolved_gaps": []
  },
  "constraint_crosswalk": {
    "mappings": [
      {
        "constraint_id": "CON-001",
        "content": "Full constraint text copied from truth surface snapshot",
        "unit_ids": ["unit-1", "unit-2"]
      }
    ]
  },
  "execution_manifest": {
    "description": "Overall execution strategy description",
    "waves": [
      {
        "wave": 1,
        "units": "unit-1, unit-2",
        "description": "Wave description"
      }
    ]
  },
  "code_batches": {
    "batches": [
      {
        "batch_id": "batch_1_foundation",
        "units": ["unit-1", "unit-2"],
        "description": "Batch purpose and scope"
      }
    ]
  },
  "code_preflight": {
    "confirmed_repo_facts": {},
    "do_not_reinterpret": [],
    "do_first": [],
    "context_bundle": [],
    "current_focus": null,
    "progress_snapshot": null,
    "remaining_work": null,
    "session_notes": null,
    "blockers": [],
    "pause_conditions": []
  },
  "compile_summary": {
    "summary": "Summary of the compilation process and decisions made",
    "code_ready": true,
    "blockers": []
  },
  "final_handoff": {
    "statement": "Final readiness statement for the coder",
    "status": "code_ready"
  }
}
```

**IMPORTANT:** The renderer splits this file into 8 bundle markdown files using the exact field names above. Each companion section MUST match this structure exactly:
- `constraint_crosswalk.mappings` MUST be an array of `{constraint_id, content, unit_ids}`
- `execution_manifest.waves[].units` MUST be a comma-separated string (not an array)
- `code_batches.batches` MUST be an array of `{batch_id, units, description}`
- `compile_summary` MUST be an object with `{summary, code_ready, blockers}`
- `final_handoff` MUST be an object with `{statement, status}`

Structural deviations produce visible `<!-- RENDER ERROR -->` markers in bundle output.
</output_format>
````

- [ ] **Step 2: Add MUST rule to rules section**

In the `<rules>` section, add after the existing rules:

```markdown
- Each companion section MUST match the exact structure shown in output_format. The renderer validates field presence — structural deviations produce visible RENDER ERROR markers in bundle output.
```

- [ ] **Step 3: Remove canonical_contracts from rules**

In the `<rules>` section, change:

```markdown
- Companion sections (canonical_contracts, constraint_crosswalk, etc.) are inspection surfaces, not alternate sources of truth.
```

to:

```markdown
- Companion sections (constraint_crosswalk, execution_manifest, code_batches, compile_summary, final_handoff) are inspection surfaces, not alternate sources of truth.
```

- [ ] **Step 4: Commit**

```bash
git add agents/bonfire-j-compile.md
git commit -m "fix(j-compile): strict output schema, remove canonical_contracts, add MUST contracts"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `node --test tests/*.js`
Expected: All pass (98 existing + 16 new = 114 total, 0 failures)

- [ ] **Step 2: Verify renderer handles the actual gto-trainer compile-output.json**

Run a quick manual check that the objectToArray fallback would handle the existing data gracefully:

```bash
node -e "
const { renderTemplate } = require('./bin/lib/renderer.cjs');
const fs = require('fs');
const path = require('path');

// Test with actual gto-trainer data shape (pre-fix J-Compile output)
// constraint_crosswalk is a flat map — objectToArray should handle it
const template = fs.readFileSync('templates/constraint-crosswalk.md', 'utf8');
const data = { mappings: [{ constraint_id: 'CON-001', content: 'Test constraint', unit_ids: ['unit-1'] }] };
const result = renderTemplate(template, data);
console.log('=== constraint-crosswalk ===');
console.log(result.includes('CON-001') ? 'PASS' : 'FAIL');

// execution-manifest with flat units string
const emTemplate = fs.readFileSync('templates/execution-manifest.md', 'utf8');
const emData = { description: 'Strategy', waves: [{ wave: 1, units: 'unit-1, unit-2', description: 'Foundation' }] };
const emResult = renderTemplate(emTemplate, emData);
console.log('=== execution-manifest ===');
console.log(emResult.includes('Wave 1') ? 'PASS' : 'FAIL');

// compile_summary as object
const sjTemplate = fs.readFileSync('templates/stage-j.md', 'utf8');
const sjData = { summary: 'Done', code_ready: true, blockers: [] };
const sjResult = renderTemplate(sjTemplate, sjData);
console.log('=== stage-j ===');
console.log(sjResult.includes('Done') ? 'PASS' : 'FAIL');

// final_handoff as object
const fhTemplate = fs.readFileSync('templates/final-handoff.md', 'utf8');
const fhData = { statement: 'Ready', status: 'code_ready' };
const fhResult = renderTemplate(fhTemplate, fhData);
console.log('=== final-handoff ===');
console.log(fhResult.includes('Ready') ? 'PASS' : 'FAIL');
"
```

Expected: All PASS

- [ ] **Step 3: Verify no RENDER ERROR in valid data**

```bash
node -e "
const { renderTemplate } = require('./bin/lib/renderer.cjs');
const template = '{{name}} has {{#each items}}{{.}} {{/each}}';
const result = renderTemplate(template, { name: 'Test', items: ['a', 'b'] });
console.log(result.includes('RENDER ERROR') ? 'FAIL — false positive' : 'PASS — no false errors');
console.log(result);
"
```

Expected: `PASS — no false errors` and output `Test has a b`
