# Bonfire Plan 3: Delta Validator + Renderer + Hook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement agent delta JSON validation, the JSON→Markdown rendering pipeline, the dual-write hook, the preflight-update command, and wire all remaining CLI stubs.

**Architecture:** `delta-parser.cjs` validates agent output JSON against per-agent schemas from `bonfire-v1.json`. `schema.cjs` validates handoff and bundle structures. `renderer.cjs` loads note definitions from `bonfire-v1.json`, reads source JSON, applies templates, and writes markdown to `bundle/`. The `bonfire-dual-write.js` hook triggers rendering on PostToolUse Write events to `.bonfire/` JSON files.

**Tech Stack:** Node.js built-in modules only. CommonJS (.cjs). Zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md` — Sections 4 (delta), 5 (rendering), 6.10 (preflight).

**Depends on:** Plan 1 (utils, schema, CLI router), Plan 2 (truth-surface, state, logger).

**Deferred notes:**
- `evidence_required` maturity gate enforcement → Plan 4 (when reality-checker agent output is defined)
- `refs_valid` maturity gate → Plan 5 (when stage-e orchestrator is implemented)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Implement | `bin/lib/delta-parser.cjs` | Per-agent JSON schema validation |
| Implement | `bin/lib/schema.cjs` | Handoff + bundle structure validation |
| Implement | `bin/lib/renderer.cjs` | JSON → Markdown: template loading, placeholder injection, note rendering |
| Create | `hooks/bonfire-dual-write.js` | PostToolUse hook: detect .bonfire/ JSON writes, trigger render |
| Modify | `bin/bonfire-tools.cjs` | Wire remaining 6 stubs to real handlers |
| Create | `tests/test-delta-parser.js` | Delta validation tests |
| Create | `tests/test-renderer.js` | Renderer tests |
| Create | `tests/test-preflight.js` | Preflight-update tests |

---

### Task 1: Delta Parser — Agent Delta Validation

**Files:**
- Implement: `bin/lib/delta-parser.cjs`
- Create: `tests/test-delta-parser.js`

- [ ] **Step 1: Write tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validateDelta } = require('../bin/lib/delta-parser.cjs');

// --- D-Critique ---

test('d-critique: valid delta passes', () => {
  const delta = {
    agent: 'bonfire-d-critique',
    challenges: [{ target: 'CON-001', reason: 'Conflicts with CON-002' }],
    proposals: [{ id: 'CON-010', category: 'frozen_constraint', content: 'test', rationale: 'test' }]
  };
  const result = validateDelta('bonfire-d-critique', delta);
  assert.equal(result.valid, true);
});

test('d-critique: missing challenges rejects', () => {
  const delta = { agent: 'bonfire-d-critique', proposals: [] };
  const result = validateDelta('bonfire-d-critique', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /challenges/i.test(e)));
});

test('d-critique: empty challenges rejects', () => {
  const delta = { agent: 'bonfire-d-critique', challenges: [] };
  const result = validateDelta('bonfire-d-critique', delta);
  assert.equal(result.valid, false);
});

// --- G-Red ---

test('g-red: valid delta passes', () => {
  const delta = {
    agent: 'bonfire-g-red',
    challenges: [{ target: 'CON-003', reason: 'Untested assumption' }]
  };
  const result = validateDelta('bonfire-g-red', delta);
  assert.equal(result.valid, true);
});

// --- G-Blue ---

test('g-blue: valid delta passes', () => {
  const delta = {
    agent: 'bonfire-g-blue',
    alignments: [{ target: 'CON-001', evidence: 'Repo confirms pg14' }]
  };
  const result = validateDelta('bonfire-g-blue', delta);
  assert.equal(result.valid, true);
});

test('g-blue: missing alignments rejects', () => {
  const delta = { agent: 'bonfire-g-blue', proposals: [] };
  const result = validateDelta('bonfire-g-blue', delta);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /alignments/i.test(e)));
});

// --- H-Review ---

test('h-review: approved verdict passes', () => {
  const verdict = { verdict: 'approved', reason: 'All constraints reviewed' };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, true);
});

test('h-review: rejected without conflict_type rejects', () => {
  const verdict = { verdict: 'rejected', reason: 'Issues found' };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /conflict_type/i.test(e)));
});

test('h-review: rejected with valid conflict_type passes', () => {
  const verdict = { verdict: 'rejected', reason: 'Issues', conflict_type: 'requirement_conflict' };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, true);
});

test('h-review: invalid verdict enum rejects', () => {
  const verdict = { verdict: 'maybe', reason: 'unsure' };
  const result = validateDelta('bonfire-h-review', verdict);
  assert.equal(result.valid, false);
});

// --- Evaluator ---

test('evaluator: PASS verdict passes', () => {
  const verdict = { unit: 'unit-1', iteration: 1, verdict: 'PASS', verification_results: [{ command: 'npm test', exit_code: 0 }] };
  const result = validateDelta('bonfire-evaluator', verdict);
  assert.equal(result.valid, true);
});

test('evaluator: FAIL with invalid conflict_type rejects', () => {
  const verdict = { unit: 'unit-1', iteration: 1, verdict: 'FAIL', verification_results: [], conflict_type: 'invalid_type' };
  const result = validateDelta('bonfire-evaluator', verdict);
  assert.equal(result.valid, false);
});

// --- Unknown agent ---

test('unknown agent rejects', () => {
  const result = validateDelta('bonfire-unknown', {});
  assert.equal(result.valid, false);
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement delta-parser.cjs**

```javascript
'use strict';

const { loadSchema } = require('./utils.cjs');

function validateDelta(agentName, delta) {
  const schema = loadSchema();
  if (!schema) return { valid: false, errors: ['Cannot load bonfire-v1.json schema'] };

  const agentSchema = schema.delta_schemas[agentName];
  if (!agentSchema) return { valid: false, errors: [`Unknown agent: ${agentName}`] };

  const errors = [];

  // Check required fields
  for (const field of agentSchema.required_fields) {
    if (delta[field] === undefined || delta[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check constraints
  const constraints = agentSchema.constraints || {};

  // Min length constraints (challenges_min_length, alignments_min_length)
  for (const [key, minLen] of Object.entries(constraints)) {
    if (key.endsWith('_min_length')) {
      const fieldName = key.replace('_min_length', '');
      const arr = delta[fieldName];
      if (!Array.isArray(arr) || arr.length < minLen) {
        errors.push(`${fieldName} must have at least ${minLen} item(s), got ${Array.isArray(arr) ? arr.length : 0}`);
      }
    }
  }

  // Enum constraints (verdict_enum)
  if (constraints.verdict_enum && delta.verdict !== undefined) {
    if (!constraints.verdict_enum.includes(delta.verdict)) {
      errors.push(`verdict must be one of [${constraints.verdict_enum.join(', ')}], got "${delta.verdict}"`);
    }
  }

  // conflict_type_required_when_rejected
  if (constraints.conflict_type_required_when_rejected && delta.verdict === 'rejected') {
    if (!delta.conflict_type) {
      errors.push('conflict_type is required when verdict is "rejected"');
    }
  }

  // conflict_type_from_reentry_routes
  if (constraints.conflict_type_from_reentry_routes && delta.conflict_type) {
    const validTypes = Object.keys(schema.reentry_routes);
    if (!validTypes.includes(delta.conflict_type)) {
      errors.push(`conflict_type "${delta.conflict_type}" not in reentry routes [${validTypes.join(', ')}]`);
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateDelta };
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-delta-parser.js`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/delta-parser.cjs tests/test-delta-parser.js
git commit -m "feat: implement delta-parser with per-agent JSON schema validation"
```

---

### Task 2: Schema Validator — Handoff + Bundle

**Files:**
- Implement: `bin/lib/schema.cjs`
- Create: `tests/test-schema.js`

- [ ] **Step 1: Write tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validateHandoff, validateBundle } = require('../bin/lib/schema.cjs');

test('validateHandoff: valid handoff passes', () => {
  const handoff = {
    status: 'code_ready',
    code_ready: true,
    handoff_summary: 'OAuth2 authentication',
    retained_goal: 'Add OAuth2',
    implementation_scope: 'Full OAuth2 flow',
    repo_targets: {},
    repo_grounding: {},
    frozen_product_decisions: [],
    domain_model: {},
    data_contract: {},
    ui_contract: {},
    function_contracts: [],
    file_plan: [],
    implementation_units: [{ id: 'unit-1', description: 'test' }],
    verification_commands: [],
    browser_checks: [],
    acceptance_checks: [],
    allowed_decisions: [],
    forbidden_decisions: [],
    reentry_triggers: {},
    unresolved_gaps: []
  };
  const result = validateHandoff({ handoff });
  assert.equal(result.valid, true);
});

test('validateHandoff: missing code_ready fails', () => {
  const result = validateHandoff({ handoff: { status: 'draft' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /code_ready/i.test(e)));
});

test('validateHandoff: missing implementation_units fails', () => {
  const result = validateHandoff({ handoff: { code_ready: true } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => /implementation_units/i.test(e)));
});

test('validateBundle: all sources present passes', () => {
  // This tests with a mock .bonfire/ that has the minimum files
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire');
  fs.mkdirSync(path.join(bf, 'truth-surface'), { recursive: true });
  fs.writeFileSync(path.join(bf, 'case.json'), '{"stages":{}}');
  fs.writeFileSync(path.join(bf, 'truth-surface', 'constraint-ledger-snapshot.json'), '{}');
  const result = validateBundle(dir);
  // Should report missing sources for notes that depend on plan/ files
  assert.ok(result.missing.length > 0); // plan files don't exist yet
  assert.ok(result.present.length > 0); // case.json and snapshot exist
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement schema.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { loadSchema, loadJSON } = require('./utils.cjs');

const HANDOFF_REQUIRED_FIELDS = [
  'code_ready', 'handoff_summary', 'retained_goal', 'implementation_scope',
  'implementation_units'
];

function validateHandoff(compileOutput) {
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

  return { valid: errors.length === 0, errors };
}

function validateBundle(root) {
  const schema = loadSchema();
  if (!schema) return { present: [], missing: [], errors: ['Cannot load schema'] };

  const bonfireDir = path.join(root, '.bonfire');
  const present = [];
  const missing = [];

  for (const note of schema.notes) {
    // Skip run-level notes (they have {run_id} in source)
    if (note.source && note.source.includes('{run_id}')) continue;

    const sourceParts = note.source.split('#');
    const sourceFile = sourceParts[0];
    const fullPath = path.join(bonfireDir, sourceFile);

    if (fs.existsSync(fullPath)) {
      present.push({ id: note.id, source: sourceFile });
    } else {
      // Handle multi-source (e.g., "plan/g-red+plan/g-blue")
      if (sourceFile.includes('+')) {
        const parts = sourceFile.split('+');
        const allExist = parts.every(p => fs.existsSync(path.join(bonfireDir, p)));
        if (allExist) {
          present.push({ id: note.id, source: sourceFile });
        } else {
          missing.push({ id: note.id, source: sourceFile });
        }
      } else {
        missing.push({ id: note.id, source: sourceFile });
      }
    }
  }

  return { present, missing, errors: [] };
}

module.exports = { validateHandoff, validateBundle };
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-schema.js`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/schema.cjs tests/test-schema.js
git commit -m "feat: implement schema validator for handoff and bundle structure"
```

---

### Task 3: Renderer — Template Engine + Note Rendering

**Files:**
- Implement: `bin/lib/renderer.cjs`
- Create: `tests/test-renderer.js`
- Create: `templates/constraint-ledger.md` (first real template for testing)

- [ ] **Step 1: Write tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { renderTemplate, renderNote, renderAll } = require('../bin/lib/renderer.cjs');

test('renderTemplate substitutes {{field}} placeholders', () => {
  const template = '# {{title}}\n\nBy {{author}}';
  const data = { title: 'Hello', author: 'World' };
  const result = renderTemplate(template, data);
  assert.equal(result, '# Hello\n\nBy World');
});

test('renderTemplate handles {{#each}} loops', () => {
  const template = '{{#each items}}\n- {{name}}: {{value}}\n{{/each}}';
  const data = { items: [{ name: 'a', value: '1' }, { name: 'b', value: '2' }] };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('- a: 1'));
  assert.ok(result.includes('- b: 2'));
});

test('renderTemplate handles {{.}} for primitive arrays', () => {
  const template = '{{#each tags}}\n- {{.}}\n{{/each}}';
  const data = { tags: ['alpha', 'beta'] };
  const result = renderTemplate(template, data);
  assert.ok(result.includes('- alpha'));
  assert.ok(result.includes('- beta'));
});

test('renderTemplate leaves unknown placeholders as empty', () => {
  const template = '# {{title}}\n\n{{missing_field}}';
  const data = { title: 'Test' };
  const result = renderTemplate(template, data);
  assert.equal(result, '# Test\n\n');
});

test('renderNote renders constraint-ledger from snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire');
  fs.mkdirSync(path.join(bf, 'truth-surface'), { recursive: true });
  fs.mkdirSync(path.join(bf, 'bundle'), { recursive: true });
  fs.mkdirSync(path.join(bf, 'logs'), { recursive: true });

  // Write a snapshot with one entry
  const snapshot = {
    version: 1,
    replayed_at: '2026-04-10T10:00:00Z',
    event_count: 1,
    entries: {
      'CON-001': {
        id: 'CON-001', category: 'retained_goal', status: 'FROZEN',
        content: 'Must support OAuth2', rationale: 'Core requirement',
        challenged_by: ['d-critique'], aligned_by: ['g-blue'],
        evidence_refs: [], notes: []
      }
    },
    by_status: { proposed: [], challenged: [], frozen: ['CON-001'], superseded: [], open: [], discarded: [] },
    by_category: { retained_goal: ['CON-001'] }
  };
  fs.writeFileSync(path.join(bf, 'truth-surface', 'constraint-ledger-snapshot.json'), JSON.stringify(snapshot));

  const result = renderNote(dir, 'constraint-ledger');
  assert.ok(result.success);
  assert.ok(fs.existsSync(path.join(bf, 'bundle', '05-constraint-ledger.md')));
  const content = fs.readFileSync(path.join(bf, 'bundle', '05-constraint-ledger.md'), 'utf8');
  assert.ok(content.includes('CON-001'));
  assert.ok(content.includes('Must support OAuth2'));

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Create templates/constraint-ledger.md**

```markdown
# Constraint Ledger

**Generated:** {{replayed_at}}
**Total entries:** {{event_count}}

## Frozen Constraints

{{#each frozen_entries}}
### {{id}} ({{category}})
- **Content:** {{content}}
- **Rationale:** {{rationale}}
- **Challenged by:** {{challenged_by_str}}
- **Aligned by:** {{aligned_by_str}}
{{/each}}

## Proposed / Challenged

{{#each active_entries}}
### {{id}} [{{status}}] ({{category}})
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}

## Open Risks

{{#each risk_entries}}
### {{id}}
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}

## Discarded Options

{{#each discarded_entries}}
### {{id}}
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}
```

- [ ] **Step 4: Implement renderer.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJSON, loadSchema } = require('./utils.cjs');
const { appendLog } = require('./logger.cjs');

// --- Template Engine ---

function renderTemplate(template, data) {
  let result = template;

  // Handle {{#each array}}...{{/each}} blocks
  result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, body) => {
    const arr = data[key];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return renderTemplate(body, item);
      } else {
        return body.replace(/\{\{\.\}\}/g, String(item));
      }
    }).join('');
  });

  // Handle {{field}} substitution
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  });

  return result;
}

// --- Note Rendering ---

function findNote(schema, noteId) {
  return schema.notes.find(n => n.id === noteId);
}

function resolveSource(bonfireDir, sourceSpec) {
  // Handle # path selector: "case.json#stages.preprocess"
  const [filePart, jsonPath] = sourceSpec.split('#');

  // Handle multi-source: "plan/g-red-delta.json+plan/g-blue-delta.json"
  if (filePart.includes('+')) {
    const parts = filePart.split('+');
    const merged = {};
    for (const p of parts) {
      const fullPath = path.join(bonfireDir, p);
      const data = loadJSON(fullPath);
      if (data) Object.assign(merged, data);
    }
    return merged;
  }

  const fullPath = path.join(bonfireDir, filePart);
  let data = loadJSON(fullPath);
  if (!data) return null;

  // Navigate JSON path
  if (jsonPath) {
    const keys = jsonPath.split('.');
    for (const key of keys) {
      if (data && typeof data === 'object') {
        data = data[key];
      } else {
        return null;
      }
    }
  }

  return data;
}

function getTemplatesDir() {
  return path.join(__dirname, '..', '..', 'templates');
}

function preprocessData(noteId, rawData) {
  // Note-specific preprocessing to prepare data for templates
  if (noteId === 'constraint-ledger' && rawData) {
    const entries = rawData.entries || {};
    const allEntries = Object.values(entries);
    return {
      ...rawData,
      frozen_entries: allEntries.filter(e => e.status === 'FROZEN').map(e => ({
        ...e,
        challenged_by_str: Array.isArray(e.challenged_by) ? e.challenged_by.join(', ') : '',
        aligned_by_str: Array.isArray(e.aligned_by) ? e.aligned_by.join(', ') : ''
      })),
      active_entries: allEntries.filter(e => e.status === 'PROPOSED' || e.status === 'CHALLENGED'),
      risk_entries: allEntries.filter(e => e.status === 'OPEN'),
      discarded_entries: allEntries.filter(e => e.status === 'DISCARDED')
    };
  }

  // Generic: flatten data for template access
  if (rawData && typeof rawData === 'object') {
    return rawData;
  }
  return { data: rawData };
}

function renderNote(root, noteId, opts) {
  const schema = loadSchema();
  if (!schema) return { success: false, error: 'Cannot load schema' };

  const note = findNote(schema, noteId);
  if (!note) return { success: false, error: `Unknown note: ${noteId}` };

  const bonfireDir = path.join(root, '.bonfire');

  // Resolve source data
  let source = note.source;
  if (opts && opts.run_id) {
    source = source.replace('{run_id}', opts.run_id);
  }
  const rawData = resolveSource(bonfireDir, source);
  if (rawData === null) {
    return { success: false, error: `Source not found: ${source}` };
  }

  // Load template
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(templatesDir, note.template);
  let template;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    return { success: false, error: `Template not found: ${note.template}` };
  }

  // Preprocess data
  const data = preprocessData(noteId, rawData);

  // Render
  const rendered = renderTemplate(template, data);

  // Determine output path
  let outputDir = path.join(bonfireDir, 'bundle');
  if (note.output_dir) {
    let outDir = note.output_dir;
    if (opts && opts.run_id) {
      outDir = outDir.replace('{run_id}', opts.run_id);
    }
    outputDir = path.join(bonfireDir, outDir);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, note.filename);
  fs.writeFileSync(outputPath, rendered);

  // Log render
  const hash = crypto.createHash('sha256').update(rendered).digest('hex').slice(0, 16);
  const logPath = path.join(bonfireDir, 'logs', 'render.jsonl');
  appendLog(logPath, { note: noteId, source: note.source, rendered_at: new Date().toISOString(), hash });

  return { success: true, output: outputPath, hash };
}

function renderAll(root, opts) {
  const schema = loadSchema();
  if (!schema) return { success: false, error: 'Cannot load schema' };

  const results = [];
  for (const note of schema.notes) {
    // Skip run-level notes unless run_id provided
    if (note.source && note.source.includes('{run_id}') && !(opts && opts.run_id)) continue;

    const result = renderNote(root, note.id, opts);
    results.push({ id: note.id, ...result });
  }

  return { success: true, results };
}

function renderCheck(root) {
  const schema = loadSchema();
  if (!schema) return { dirty: [], clean: [], errors: ['Cannot load schema'] };

  const bonfireDir = path.join(root, '.bonfire');
  const dirty = [];
  const clean = [];

  for (const note of schema.notes) {
    if (note.source && note.source.includes('{run_id}')) continue;

    let outputDir = path.join(bonfireDir, 'bundle');
    if (note.output_dir) outputDir = path.join(bonfireDir, note.output_dir);
    const outputPath = path.join(outputDir, note.filename);

    if (!fs.existsSync(outputPath)) {
      dirty.push({ id: note.id, reason: 'missing' });
      continue;
    }

    // Check if source is newer than output
    const sourceParts = note.source.split('#')[0].split('+');
    let sourceNewest = 0;
    for (const sp of sourceParts) {
      const fp = path.join(bonfireDir, sp);
      try {
        const stat = fs.statSync(fp);
        if (stat.mtimeMs > sourceNewest) sourceNewest = stat.mtimeMs;
      } catch (_) {}
    }

    try {
      const outStat = fs.statSync(outputPath);
      if (sourceNewest > outStat.mtimeMs) {
        dirty.push({ id: note.id, reason: 'stale' });
      } else {
        clean.push({ id: note.id });
      }
    } catch (_) {
      dirty.push({ id: note.id, reason: 'unreadable' });
    }
  }

  return { dirty, clean };
}

module.exports = { renderTemplate, renderNote, renderAll, renderCheck };
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-renderer.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/renderer.cjs tests/test-renderer.js templates/constraint-ledger.md
git commit -m "feat: implement renderer with template engine, note rendering, and constraint-ledger template"
```

---

### Task 4: Preflight Update Command

**Files:**
- Create: `tests/test-preflight.js`

- [ ] **Step 1: Write tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
  // Create a minimal compile-output.json
  const compileOutput = {
    handoff: { code_ready: true, implementation_units: [{ id: 'unit-1' }] },
    code_preflight: {
      confirmed_repo_facts: ['pg14'],
      do_not_reinterpret: ['handoff semantics'],
      do_first: ['unit-1'],
      context_bundle: ['handoff.md'],
      current_focus: null,
      progress_snapshot: {},
      remaining_work: [],
      session_notes: null,
      blockers: [],
      pause_conditions: []
    }
  };
  fs.writeFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), JSON.stringify(compileOutput));
  return dir;
}

test('preflight-update updates mutable field', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'preflight-update', '--field', 'current_focus', '--value', 'unit-3'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);
  const co = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), 'utf8'));
  assert.equal(co.code_preflight.current_focus, 'unit-3');
  fs.rmSync(dir, { recursive: true });
});

test('preflight-update rejects immutable field', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'preflight-update', '--field', 'confirmed_repo_facts', '--value', 'changed'], { encoding: 'utf8', cwd: dir });
    assert.fail('should have failed');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.ok(result.error);
  }
  fs.rmSync(dir, { recursive: true });
});

test('preflight-update with --unit updates progress', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'preflight-update', '--field', 'progress', '--unit', 'unit-1', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  const co = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'plan', 'compile-output.json'), 'utf8'));
  assert.equal(co.code_preflight.progress_snapshot['unit-1'], 'passed');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Add preflight-update handler to bonfire-tools.cjs**

Add a `preflightCommand` function and wire it:

```javascript
function preflightCommand(args) {
  const { resolveRoot, loadJSON, writeAtomic, loadSchema, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);

  const field = args.field;
  if (!field) {
    process.stderr.write('Usage: bonfire-tools.cjs preflight-update --field <field> --value <value>\n');
    process.exit(2);
  }

  const schema = loadSchema();
  const mutableFields = schema ? schema.preflight_mutable_fields : [];

  // Special case: --field progress --unit <unit> --status <status>
  if (field === 'progress' && args.unit) {
    const coPath = path.join(root, 'plan', 'compile-output.json');
    const co = loadJSON(coPath);
    if (!co) exitError('compile-output.json not found', []);
    if (!co.code_preflight) co.code_preflight = {};
    if (!co.code_preflight.progress_snapshot) co.code_preflight.progress_snapshot = {};
    co.code_preflight.progress_snapshot[args.unit] = args.status || 'in_progress';
    writeAtomic(coPath, co);
    exitJSON({ success: true, field: 'progress_snapshot', unit: args.unit, status: args.status });
    return;
  }

  if (!mutableFields.includes(field)) {
    exitError(`Field "${field}" is not in mutable whitelist [${mutableFields.join(', ')}]`, mutableFields);
  }

  const coPath = path.join(root, 'plan', 'compile-output.json');
  const co = loadJSON(coPath);
  if (!co) exitError('compile-output.json not found', []);
  if (!co.code_preflight) co.code_preflight = {};
  co.code_preflight[field] = args.value;
  writeAtomic(coPath, co);
  exitJSON({ success: true, field, value: args.value });
}
```

Wire in COMMANDS:
```javascript
'preflight-update': () => preflightCommand,
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-preflight.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/bonfire-tools.cjs tests/test-preflight.js
git commit -m "feat: implement preflight-update with mutable field whitelist enforcement"
```

---

### Task 5: Wire Remaining CLI Stubs + Dual-Write Hook

**Files:**
- Modify: `bin/bonfire-tools.cjs` — wire delta-validate, handoff-validate, bundle-validate, render, render-check
- Create: `hooks/bonfire-dual-write.js`

- [ ] **Step 1: Wire validation and render commands**

In bonfire-tools.cjs, replace remaining stubs:

```javascript
'delta-validate':   () => deltaValidateCommand,
'handoff-validate': () => handoffValidateCommand,
'bundle-validate':  () => bundleValidateCommand,
'render':           () => renderCommand,
'render-check':     () => renderCheckCommand,
```

Add handlers:

```javascript
function deltaValidateCommand(args) {
  const { validateDelta } = require('./lib/delta-parser.cjs');
  const { loadJSON, exitJSON, exitError } = require('./lib/utils.cjs');

  const agent = args.agent;
  if (!agent) exitError('Usage: delta-validate --agent <name> --file <path> | --stdin', [], 2);

  let data;
  if (args.file) {
    data = loadJSON(args.file);
    if (!data) exitError(`Cannot read file: ${args.file}`, []);
  } else if (args.stdin) {
    const input = require('fs').readFileSync(0, 'utf8');
    data = JSON.parse(input);
  } else {
    exitError('Provide --file <path> or --stdin', [], 2);
  }

  const result = validateDelta(agent, data);
  if (result.valid) {
    exitJSON({ valid: true });
  } else {
    exitError('Validation failed', result.errors);
  }
}

function handoffValidateCommand(args) {
  const { validateHandoff } = require('./lib/schema.cjs');
  const { resolveRoot, loadJSON, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const co = loadJSON(path.join(root, 'plan', 'compile-output.json'));
  if (!co) exitError('compile-output.json not found', []);
  const result = validateHandoff(co);
  if (result.valid) {
    exitJSON({ valid: true });
  } else {
    exitError('Handoff validation failed', result.errors);
  }
}

function bundleValidateCommand(args) {
  const { validateBundle } = require('./lib/schema.cjs');
  const { resolveRoot, exitJSON } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) require('./lib/utils.cjs').exitError('.bonfire/ not found', []);
  const result = validateBundle(path.dirname(root));
  exitJSON(result);
}

function renderCommand(args) {
  const { renderNote, renderAll } = require('./lib/renderer.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  if (args.all) {
    exitJSON(renderAll(dir, { run_id: args.run }));
  } else if (args.note) {
    const result = renderNote(dir, args.note, { run_id: args.run });
    if (result.success) {
      exitJSON(result);
    } else {
      exitError(result.error, []);
    }
  } else {
    exitError('Usage: render --note <id> | --all [--run <run-id>]', [], 2);
  }
}

function renderCheckCommand(args) {
  const { renderCheck } = require('./lib/renderer.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  exitJSON(renderCheck(path.dirname(root)));
}
```

- [ ] **Step 2: Create hooks/bonfire-dual-write.js**

```javascript
#!/usr/bin/env node
'use strict';

// PostToolUse hook: detect .bonfire/ JSON file writes, trigger render
// Triggered by Claude Code on Write|Edit tool calls
// Input: JSON on stdin with tool_input.file_path
// Output: JSON on stdout (hookSpecificOutput)

const path = require('path');
const { execFileSync } = require('child_process');

const WATCHED_PATTERNS = [
  // truth surface → constraint-ledger
  { pattern: /\.bonfire\/truth-surface\/constraint-ledger-snapshot\.json$/, note: 'constraint-ledger' },
  // agent deltas → corresponding stage notes
  { pattern: /\.bonfire\/plan\/bonfire-d-critique-delta\.json$/, note: 'stage-d' },
  { pattern: /\.bonfire\/plan\/bonfire-g-(red|blue)-delta\.json$/, note: 'stage-g' },
  // H-Review verdict → stage-h
  { pattern: /\.bonfire\/plan\/h-review-verdict\.json$/, note: 'stage-h' },
  // J-Compile → all companion notes (render --all handles this)
  { pattern: /\.bonfire\/plan\/compile-output\.json$/, note: '__compile__' },
  // Run evidence
  { pattern: /\.bonfire\/runs\/([^/]+)\/([^/]+)\.json$/, note: '__run__' }
];

try {
  const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const toolName = input.tool_name;
  const filePath = input.tool_input && input.tool_input.file_path;

  if (!filePath || (toolName !== 'Write' && toolName !== 'Edit')) {
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  for (const { pattern, note } of WATCHED_PATTERNS) {
    const match = filePath.match(pattern);
    if (!match) continue;

    // Find bonfire-tools.cjs relative to this hook
    const toolsPath = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');
    const cwd = path.dirname(filePath.replace(/\.bonfire\/.*$/, ''));

    try {
      if (note === '__compile__') {
        // Render all companion notes
        execFileSync('node', [toolsPath, 'render', '--all'], { cwd, timeout: 9000 });
      } else if (note === '__run__') {
        // Render run evidence note
        const runId = match[1];
        const fileName = match[2];
        const noteMap = { 'code-run': 'code-run', 'verification': 'verification', 'reentry': 'reentry', 'achieve': 'achieve' };
        const noteId = noteMap[fileName];
        if (noteId) {
          execFileSync('node', [toolsPath, 'render', '--note', noteId, '--run', runId], { cwd, timeout: 9000 });
        }
      } else {
        execFileSync('node', [toolsPath, 'render', '--note', note], { cwd, timeout: 9000 });
      }
    } catch (_) {
      // Silent fail — never block tool execution
    }

    break; // Only match first pattern
  }

  process.stdout.write(JSON.stringify({}) + '\n');
} catch (_) {
  // Silent fail
  process.stdout.write(JSON.stringify({}) + '\n');
}
```

- [ ] **Step 3: Run full test suite**

Run: `node --test tests/test-delta-parser.js tests/test-schema.js tests/test-renderer.js tests/test-preflight.js`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add bin/bonfire-tools.cjs hooks/bonfire-dual-write.js
git commit -m "feat: wire all remaining CLI commands and add dual-write hook"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run complete test suite**

Run: `node --test tests/*.js`

Expected: All tests PASS. Approximate count:
- test-utils: 9
- test-foundation: 14
- test-init: 6
- test-logger: 4
- test-truth-surface: 6
- test-truth-freeze: 9
- test-state: 9
- test-truth-cli: 4
- test-delta-parser: 13
- test-schema: 4
- test-renderer: 5
- test-preflight: 3
- **Total: ~86 tests**

- [ ] **Step 2: Verify zero remaining stubs**

Run: `node -e "const cli = require('fs').readFileSync('bin/bonfire-tools.cjs','utf8'); const stubs = cli.split('\n').filter(l => l.includes('() => stub')); console.log('Remaining stubs:', stubs.length); stubs.forEach(l => console.log(l.trim()))"`

Expected: 0 remaining stubs. The `stub` function definition may still exist but should have no references.

- [ ] **Step 3: Verify file structure**

Run: `find . -name '*.cjs' -o -name '*.js' -o -name '*.json' -o -name '*.md' | grep -v node_modules | grep -v .git | sort`

Expected key new files:
```
./bin/lib/delta-parser.cjs    (implemented)
./bin/lib/renderer.cjs        (implemented)
./bin/lib/schema.cjs          (implemented)
./hooks/bonfire-dual-write.js (new)
./templates/constraint-ledger.md (new)
./tests/test-delta-parser.js  (new)
./tests/test-renderer.js      (new)
./tests/test-schema.js        (new)
./tests/test-preflight.js     (new)
```
