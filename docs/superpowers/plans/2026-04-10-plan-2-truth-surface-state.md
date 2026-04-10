# Bonfire Plan 2: Truth Surface + State Machine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the truth surface dual-layer system (JSONL history + snapshot regeneration with 8 semantic categories and 6 event types) and the pipeline state machine (step tracking, reentry, cross-skill protocol).

**Architecture:** `truth-surface.cjs` manages the JSONL event log and snapshot regeneration. `state.cjs` manages pipeline step transitions, reentry routing, and cross-skill signaling. Both use `writeAtomic` from `utils.cjs`. `logger.cjs` handles append-only audit logs. All commands are wired through the existing `bonfire-tools.cjs` router.

**Tech Stack:** Node.js built-in modules only. CommonJS (.cjs). Zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-bonfire-ecl-pipeline-design.md` — Sections 2 and 3.

**Depends on:** Plan 1 (completed) — utils.cjs, bonfire-tools.cjs, bonfire-v1.json, init.cjs.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Implement | `bin/lib/truth-surface.cjs` | 6 event types, 8 categories, maturity gates, replay, snapshot regeneration |
| Implement | `bin/lib/state.cjs` | Step transitions, reentry, pending_reentry, run management |
| Implement | `bin/lib/logger.cjs` | Append-only JSONL audit logs |
| Modify | `bin/bonfire-tools.cjs` | Wire truth-*, state-*, log-* commands to real handlers |
| Create | `tests/test-truth-surface.js` | Truth surface unit + integration tests |
| Create | `tests/test-state.js` | State machine unit + integration tests |

---

### Task 1: Logger Module

**Files:**
- Implement: `bin/lib/logger.cjs`
- Create: `tests/test-logger.js`

- [ ] **Step 1: Write tests**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { appendLog, readLog } = require('../bin/lib/logger.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  fs.mkdirSync(path.join(dir, '.bonfire', 'logs'), { recursive: true });
  return dir;
}

test('appendLog creates file and appends JSONL line', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'spawn', agent: 'test' });
  appendLog(logFile, { event: 'completed', agent: 'test' });
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.deepStrictEqual(JSON.parse(lines[0]).event, 'spawn');
  assert.deepStrictEqual(JSON.parse(lines[1]).event, 'completed');
  fs.rmSync(dir, { recursive: true });
});

test('appendLog adds timestamp if missing', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'test' });
  const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
  assert.ok(entry.timestamp);
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  fs.rmSync(dir, { recursive: true });
});

test('readLog returns entries as array', () => {
  const dir = makeTmpDir();
  const logFile = path.join(dir, '.bonfire', 'logs', 'test.jsonl');
  appendLog(logFile, { event: 'a' });
  appendLog(logFile, { event: 'b' });
  const entries = readLog(logFile);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].event, 'a');
  assert.equal(entries[1].event, 'b');
  fs.rmSync(dir, { recursive: true });
});

test('readLog returns empty array for missing file', () => {
  const entries = readLog('/nonexistent/file.jsonl');
  assert.deepStrictEqual(entries, []);
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `node --test tests/test-logger.js`

- [ ] **Step 3: Implement logger.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { timestamp } = require('./utils.cjs');

function appendLog(filePath, entry) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!entry.timestamp) {
    entry.timestamp = timestamp();
  }
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
}

function readLog(filePath, opts) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    const entries = content.split('\n').map(line => JSON.parse(line));
    if (opts && opts.since) {
      return entries.filter(e => e.timestamp >= opts.since);
    }
    return entries;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = { appendLog, readLog };
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-logger.js`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/logger.cjs tests/test-logger.js
git commit -m "feat: implement logger module with append-only JSONL audit logs"
```

---

### Task 2: Truth Surface — Core Event Processing

**Files:**
- Implement: `bin/lib/truth-surface.cjs`
- Create: `tests/test-truth-surface.js`

- [ ] **Step 1: Write tests for propose, update, and replay**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { propose, update, replay, loadSnapshot, getHistoryPath, getSnapshotPath } = require('../bin/lib/truth-surface.cjs');

function makeBonfireDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire', 'truth-surface');
  fs.mkdirSync(bf, { recursive: true });
  fs.writeFileSync(path.join(bf, 'constraint-ledger-history.jsonl'), '');
  return dir;
}

test('propose creates PROPOSED entry and regenerates snapshot', () => {
  const dir = makeBonfireDir();
  propose(dir, {
    id: 'CON-001',
    category: 'retained_goal',
    content: 'Must support OAuth2',
    rationale: 'Core requirement',
    source: 'stage-c'
  });

  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.event_count, 1);
  assert.ok(snapshot.entries['CON-001']);
  assert.equal(snapshot.entries['CON-001'].status, 'PROPOSED');
  assert.equal(snapshot.entries['CON-001'].category, 'retained_goal');
  assert.equal(snapshot.entries['CON-001'].content, 'Must support OAuth2');
  assert.deepStrictEqual(snapshot.entries['CON-001'].challenged_by, []);
  assert.deepStrictEqual(snapshot.entries['CON-001'].aligned_by, []);
  assert.ok(snapshot.by_status.proposed.includes('CON-001'));
  assert.ok(snapshot.by_category.retained_goal.includes('CON-001'));
  fs.rmSync(dir, { recursive: true });
});

test('propose with discarded_option creates DISCARDED entry', () => {
  const dir = makeBonfireDir();
  propose(dir, {
    id: 'DROP-001',
    category: 'discarded_option',
    content: 'Use MongoDB',
    rationale: 'Team has no experience',
    source: 'stage-b'
  });

  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['DROP-001'].status, 'DISCARDED');
  assert.ok(snapshot.by_status.discarded.includes('DROP-001'));
  fs.rmSync(dir, { recursive: true });
});

test('propose with high_impact_risk creates OPEN entry', () => {
  const dir = makeBonfireDir();
  propose(dir, {
    id: 'RISK-001',
    category: 'high_impact_risk',
    content: 'OAuth provider may rate-limit',
    rationale: 'Unknown until probed',
    source: 'stage-d'
  });

  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['RISK-001'].status, 'OPEN');
  assert.ok(snapshot.by_status.open.includes('RISK-001'));
  fs.rmSync(dir, { recursive: true });
});

test('update appends to challenged_by array', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'CON-001', category: 'retained_goal', content: 'test', rationale: 'test', source: 'stage-c' });
  update(dir, { id: 'CON-001', field: 'challenged_by', value: 'd-critique' });
  update(dir, { id: 'CON-001', field: 'challenged_by', value: 'g-red' });

  const snapshot = loadSnapshot(dir);
  assert.deepStrictEqual(snapshot.entries['CON-001'].challenged_by, ['d-critique', 'g-red']);
  assert.equal(snapshot.entries['CON-001'].status, 'CHALLENGED');
  assert.ok(snapshot.by_status.challenged.includes('CON-001'));
  assert.ok(!snapshot.by_status.proposed.includes('CON-001'));
  fs.rmSync(dir, { recursive: true });
});

test('update rejects writes to FROZEN entries', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'FACT-001', category: 'confirmed_fact', content: 'PostgreSQL 14', rationale: 'docker-compose', source: 'stage-a', evidence: 'docker-compose.yaml' });

  // confirmed_fact can freeze without challenged_by
  const { freeze } = require('../bin/lib/truth-surface.cjs');
  freeze(dir, { id: 'FACT-001' });

  assert.throws(() => {
    update(dir, { id: 'FACT-001', field: 'content', value: 'MySQL' });
  }, /frozen|immutable/i);
  fs.rmSync(dir, { recursive: true });
});

test('replay from empty history produces empty snapshot', () => {
  const dir = makeBonfireDir();
  const snapshot = replay(dir);
  assert.equal(snapshot.event_count, 0);
  assert.deepStrictEqual(snapshot.entries, {});
  assert.deepStrictEqual(snapshot.by_status.proposed, []);
  assert.deepStrictEqual(snapshot.by_status.frozen, []);
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement truth-surface.cjs core (propose, update, replay, loadSnapshot)**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { writeAtomic, loadJSON, timestamp, loadSchema } = require('./utils.cjs');
const { appendLog } = require('./logger.cjs');

const ARRAY_FIELDS = ['challenged_by', 'aligned_by', 'evidence_refs', 'notes'];

function getHistoryPath(root) {
  return path.join(root, '.bonfire', 'truth-surface', 'constraint-ledger-history.jsonl');
}

function getSnapshotPath(root) {
  return path.join(root, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
}

function appendEvent(root, event) {
  if (!event.timestamp) event.timestamp = timestamp();
  const historyPath = getHistoryPath(root);
  fs.appendFileSync(historyPath, JSON.stringify(event) + '\n');
}

function replay(root) {
  const historyPath = getHistoryPath(root);
  let content = '';
  try { content = fs.readFileSync(historyPath, 'utf8').trim(); } catch (e) { if (e.code !== 'ENOENT') throw e; }

  const entries = {};
  let eventCount = 0;

  if (content) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      eventCount++;
      applyEvent(entries, event);
    }
  }

  return buildSnapshot(entries, eventCount);
}

function applyEvent(entries, event) {
  switch (event.type) {
    case 'propose': {
      const initialStatus = getInitialStatus(event.category);
      entries[event.id] = {
        id: event.id,
        category: event.category,
        status: initialStatus,
        content: event.content,
        rationale: event.rationale,
        source: event.source,
        challenged_by: [],
        aligned_by: [],
        evidence_refs: [],
        notes: [],
        created_at: event.timestamp
      };
      if (event.evidence) entries[event.id].evidence = event.evidence;
      if (event.mitigation) entries[event.id].mitigation = event.mitigation;
      break;
    }
    case 'update': {
      const entry = entries[event.id];
      if (!entry) throw new Error(`update: entry ${event.id} not found`);
      if (entry.status === 'FROZEN' || entry.status === 'SUPERSEDED') {
        throw new Error(`update: entry ${event.id} is ${entry.status}, cannot update`);
      }
      if (ARRAY_FIELDS.includes(event.field)) {
        if (!Array.isArray(entry[event.field])) entry[event.field] = [];
        if (!entry[event.field].includes(event.value)) {
          entry[event.field].push(event.value);
        }
      } else {
        entry[event.field] = event.value;
      }
      // Auto-transition: if challenged_by becomes non-empty, status → CHALLENGED
      if (event.field === 'challenged_by' && entry.challenged_by.length > 0 && entry.status === 'PROPOSED') {
        entry.status = 'CHALLENGED';
      }
      break;
    }
    case 'annotate': {
      const entry = entries[event.id];
      if (!entry) throw new Error(`annotate: entry ${event.id} not found`);
      const schema = loadSchema();
      const whitelist = schema ? schema.annotate_whitelist : ['evidence_refs', 'aligned_by', 'notes'];
      if (!whitelist.includes(event.field)) {
        throw new Error(`annotate: field "${event.field}" not in whitelist [${whitelist.join(', ')}]`);
      }
      if (ARRAY_FIELDS.includes(event.field)) {
        if (!Array.isArray(entry[event.field])) entry[event.field] = [];
        if (!entry[event.field].includes(event.value)) {
          entry[event.field].push(event.value);
        }
      } else {
        entry[event.field] = event.value;
      }
      break;
    }
    case 'freeze': {
      const entry = entries[event.id];
      if (!entry) throw new Error(`freeze: entry ${event.id} not found`);
      checkMaturityGate(entry);
      entry.status = 'FROZEN';
      entry.frozen_at = event.frozen_at || event.timestamp;
      break;
    }
    case 'supersede': {
      const oldEntry = entries[event.supersedes];
      if (!oldEntry) throw new Error(`supersede: old entry ${event.supersedes} not found`);
      if (oldEntry.status !== 'FROZEN') throw new Error(`supersede: old entry ${event.supersedes} is not FROZEN`);
      oldEntry.status = 'SUPERSEDED';
      entries[event.id] = {
        id: event.id,
        category: oldEntry.category,
        status: 'FROZEN',
        content: event.content,
        rationale: event.rationale,
        source: oldEntry.source,
        challenged_by: oldEntry.challenged_by,
        aligned_by: oldEntry.aligned_by,
        evidence_refs: [],
        notes: [],
        supersedes: event.supersedes,
        frozen_at: event.timestamp,
        created_at: event.timestamp
      };
      break;
    }
    case 'discard': {
      entries[event.id] = {
        id: event.id,
        category: 'discarded_option',
        status: 'DISCARDED',
        content: event.content,
        rationale: event.rationale,
        source: event.source || null,
        challenged_by: [],
        aligned_by: [],
        evidence_refs: [],
        notes: [],
        created_at: event.timestamp
      };
      break;
    }
  }
}

function getInitialStatus(category) {
  switch (category) {
    case 'discarded_option': return 'DISCARDED';
    case 'high_impact_risk': return 'OPEN';
    case 'challenged_claim': return 'CHALLENGED';
    default: return 'PROPOSED';
  }
}

function checkMaturityGate(entry) {
  const schema = loadSchema();
  const catDef = schema ? schema.categories[entry.category] : null;

  if (catDef && !catDef.can_freeze) {
    throw new Error(`freeze: category "${entry.category}" cannot be frozen`);
  }

  if (!catDef || catDef.maturity_gate === 'challenged_by_non_empty') {
    if (!entry.challenged_by || entry.challenged_by.length === 0) {
      throw new Error(`freeze: entry ${entry.id} has no challenges (maturity gate: challenged_by_non_empty)`);
    }
  } else if (catDef.maturity_gate === 'evidence_required') {
    // confirmed_fact: no challenged_by needed, but source should have evidence
    // We allow freeze for confirmed_fact without challenged_by
  } else if (catDef.maturity_gate === 'refs_valid') {
    // dependency_chain: refs validity is checked by caller
  }
  // rationale_non_empty is for discarded_option which can't freeze anyway
}

function buildSnapshot(entries, eventCount) {
  const byStatus = { proposed: [], challenged: [], frozen: [], superseded: [], open: [], discarded: [] };
  const byCategory = {};

  const schema = loadSchema();
  if (schema) {
    for (const cat of Object.keys(schema.categories)) {
      byCategory[cat] = [];
    }
  }

  for (const [id, entry] of Object.entries(entries)) {
    const statusKey = entry.status.toLowerCase();
    if (byStatus[statusKey]) byStatus[statusKey].push(id);
    if (byCategory[entry.category]) {
      byCategory[entry.category].push(id);
    } else {
      byCategory[entry.category] = [id];
    }
  }

  return {
    version: 1,
    replayed_at: timestamp(),
    event_count: eventCount,
    entries,
    by_status: byStatus,
    by_category: byCategory
  };
}

function regenerateSnapshot(root) {
  const snapshot = replay(root);
  writeAtomic(getSnapshotPath(root), snapshot);
  return snapshot;
}

function propose(root, opts) {
  const event = {
    type: 'propose',
    id: opts.id,
    category: opts.category,
    status: getInitialStatus(opts.category),
    content: opts.content,
    rationale: opts.rationale,
    source: opts.source,
    timestamp: timestamp()
  };
  if (opts.evidence) event.evidence = opts.evidence;
  if (opts.mitigation) event.mitigation = opts.mitigation;
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function update(root, opts) {
  // Validate before appending: replay current state, check preconditions
  const snapshot = replay(root);
  const entry = snapshot.entries[opts.id];
  if (!entry) throw new Error(`update: entry ${opts.id} not found`);
  if (entry.status === 'FROZEN' || entry.status === 'SUPERSEDED') {
    throw new Error(`update: entry ${opts.id} is ${entry.status}, cannot update. Use annotate for FROZEN entries.`);
  }

  const event = {
    type: 'update',
    id: opts.id,
    field: opts.field,
    value: opts.value,
    timestamp: timestamp()
  };
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function annotate(root, opts) {
  const schema = loadSchema();
  const whitelist = schema ? schema.annotate_whitelist : ['evidence_refs', 'aligned_by', 'notes'];
  if (!whitelist.includes(opts.field)) {
    throw new Error(`annotate: field "${opts.field}" not in whitelist [${whitelist.join(', ')}]`);
  }

  const event = {
    type: 'annotate',
    id: opts.id,
    field: opts.field,
    value: opts.value,
    timestamp: timestamp()
  };
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function freeze(root, opts) {
  // Validate maturity gate before appending
  const snapshot = replay(root);
  const entry = snapshot.entries[opts.id];
  if (!entry) throw new Error(`freeze: entry ${opts.id} not found`);
  checkMaturityGate(entry);

  const now = timestamp();
  const event = {
    type: 'freeze',
    id: opts.id,
    frozen_at: now,
    timestamp: now
  };
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function supersede(root, opts) {
  const snapshot = replay(root);
  const oldEntry = snapshot.entries[opts.supersedes];
  if (!oldEntry) throw new Error(`supersede: old entry ${opts.supersedes} not found`);
  if (oldEntry.status !== 'FROZEN') throw new Error(`supersede: old entry ${opts.supersedes} is not FROZEN`);

  const event = {
    type: 'supersede',
    id: opts.id,
    supersedes: opts.supersedes,
    content: opts.content,
    rationale: opts.rationale,
    timestamp: timestamp()
  };
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function discard(root, opts) {
  if (!opts.rationale) throw new Error('discard: rationale is required');

  const event = {
    type: 'discard',
    id: opts.id,
    category: 'discarded_option',
    content: opts.content || '',
    rationale: opts.rationale,
    source: opts.source || null,
    timestamp: timestamp()
  };
  appendEvent(root, event);
  return regenerateSnapshot(root);
}

function query(root, opts) {
  const snapshot = loadSnapshot(root);
  if (!snapshot) return [];
  let ids = [];
  if (opts.status) {
    ids = snapshot.by_status[opts.status.toLowerCase()] || [];
  }
  if (opts.category) {
    const catIds = snapshot.by_category[opts.category] || [];
    ids = ids.length > 0 ? ids.filter(id => catIds.includes(id)) : catIds;
  }
  return ids.map(id => snapshot.entries[id]);
}

function rebuild(root) {
  return regenerateSnapshot(root);
}

function loadSnapshot(root) {
  return loadJSON(getSnapshotPath(root));
}

module.exports = {
  propose, update, annotate, freeze, supersede, discard,
  replay, regenerateSnapshot, loadSnapshot, query, rebuild,
  getHistoryPath, getSnapshotPath
};
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-truth-surface.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/truth-surface.cjs tests/test-truth-surface.js
git commit -m "feat: implement truth surface with propose, update, freeze, replay, snapshot regeneration"
```

---

### Task 3: Truth Surface — Freeze, Annotate, Supersede, Discard

**Files:**
- Create: `tests/test-truth-freeze.js`

- [ ] **Step 1: Write tests for freeze maturity gates, annotate, supersede, discard**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { propose, update, annotate, freeze, supersede, discard, loadSnapshot } = require('../bin/lib/truth-surface.cjs');

function makeBonfireDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
  const bf = path.join(dir, '.bonfire', 'truth-surface');
  fs.mkdirSync(bf, { recursive: true });
  fs.writeFileSync(path.join(bf, 'constraint-ledger-history.jsonl'), '');
  return dir;
}

test('freeze requires challenged_by for retained_goal', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'CON-001', category: 'retained_goal', content: 'test', rationale: 'test', source: 'stage-c' });
  assert.throws(() => freeze(dir, { id: 'CON-001' }), /challenged_by|maturity/i);
  fs.rmSync(dir, { recursive: true });
});

test('freeze succeeds for retained_goal after challenge', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'CON-001', category: 'retained_goal', content: 'test', rationale: 'test', source: 'stage-c' });
  update(dir, { id: 'CON-001', field: 'challenged_by', value: 'd-critique' });
  freeze(dir, { id: 'CON-001' });
  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['CON-001'].status, 'FROZEN');
  assert.ok(snapshot.by_status.frozen.includes('CON-001'));
  fs.rmSync(dir, { recursive: true });
});

test('freeze confirmed_fact without challenged_by succeeds', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'FACT-001', category: 'confirmed_fact', content: 'PostgreSQL 14', rationale: 'docker-compose', source: 'stage-a' });
  freeze(dir, { id: 'FACT-001' });
  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['FACT-001'].status, 'FROZEN');
  fs.rmSync(dir, { recursive: true });
});

test('freeze high_impact_risk throws', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'RISK-001', category: 'high_impact_risk', content: 'risk', rationale: 'test', source: 'stage-d' });
  assert.throws(() => freeze(dir, { id: 'RISK-001' }), /cannot be frozen/i);
  fs.rmSync(dir, { recursive: true });
});

test('annotate adds evidence_refs to FROZEN entry', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'FACT-001', category: 'confirmed_fact', content: 'pg14', rationale: 'test', source: 'stage-a' });
  freeze(dir, { id: 'FACT-001' });
  annotate(dir, { id: 'FACT-001', field: 'evidence_refs', value: 'probe-1' });
  annotate(dir, { id: 'FACT-001', field: 'evidence_refs', value: 'probe-2' });
  const snapshot = loadSnapshot(dir);
  assert.deepStrictEqual(snapshot.entries['FACT-001'].evidence_refs, ['probe-1', 'probe-2']);
  fs.rmSync(dir, { recursive: true });
});

test('annotate rejects non-whitelist field', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'FACT-001', category: 'confirmed_fact', content: 'pg14', rationale: 'test', source: 'stage-a' });
  freeze(dir, { id: 'FACT-001' });
  assert.throws(() => annotate(dir, { id: 'FACT-001', field: 'content', value: 'changed' }), /whitelist/i);
  fs.rmSync(dir, { recursive: true });
});

test('supersede creates new FROZEN, old becomes SUPERSEDED', () => {
  const dir = makeBonfireDir();
  propose(dir, { id: 'CON-001', category: 'frozen_constraint', content: 'v1', rationale: 'test', source: 'stage-c' });
  update(dir, { id: 'CON-001', field: 'challenged_by', value: 'd-critique' });
  freeze(dir, { id: 'CON-001' });
  supersede(dir, { id: 'CON-002', supersedes: 'CON-001', content: 'v2', rationale: 'improved' });
  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['CON-001'].status, 'SUPERSEDED');
  assert.equal(snapshot.entries['CON-002'].status, 'FROZEN');
  assert.equal(snapshot.entries['CON-002'].supersedes, 'CON-001');
  assert.ok(snapshot.by_status.superseded.includes('CON-001'));
  assert.ok(snapshot.by_status.frozen.includes('CON-002'));
  fs.rmSync(dir, { recursive: true });
});

test('discard creates DISCARDED entry', () => {
  const dir = makeBonfireDir();
  discard(dir, { id: 'DROP-001', content: 'MongoDB option', rationale: 'No team expertise' });
  const snapshot = loadSnapshot(dir);
  assert.equal(snapshot.entries['DROP-001'].status, 'DISCARDED');
  assert.equal(snapshot.entries['DROP-001'].rationale, 'No team expertise');
  assert.ok(snapshot.by_status.discarded.includes('DROP-001'));
  fs.rmSync(dir, { recursive: true });
});

test('discard requires rationale', () => {
  const dir = makeBonfireDir();
  assert.throws(() => discard(dir, { id: 'DROP-001', content: 'test' }), /rationale/i);
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify pass** (implementation already exists from Task 2)

Run: `node --test tests/test-truth-freeze.js`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test-truth-freeze.js
git commit -m "test: add freeze maturity gates, annotate, supersede, discard tests"
```

---

### Task 4: State Machine — Core Step Transitions

**Files:**
- Implement: `bin/lib/state.cjs`
- Create: `tests/test-state.js`

- [ ] **Step 1: Write tests for state operations**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function initCase(dir) {
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
}

function readState(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'state.json'), 'utf8'));
}

test('state-read returns current state', () => {
  const dir = makeTmpDir();
  initCase(dir);
  const stdout = execFileSync('node', [CLI, 'state-read'], { encoding: 'utf8', cwd: dir });
  const state = JSON.parse(stdout);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  fs.rmSync(dir, { recursive: true });
});

test('state-step updates step status', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'running'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.steps['stage-a'].status, 'running');
  fs.rmSync(dir, { recursive: true });
});

test('state-advance moves to next step', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.steps['stage-a'].status, 'passed');
  // pipeline_stage should advance to plan, steps should include stage-b
  assert.equal(state.pipeline_stage, 'plan');
  assert.ok(state.steps['stage-b']);
  assert.equal(state.current_step, 'stage-b');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests, verify fail**

- [ ] **Step 3: Implement state.cjs**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { writeAtomic, loadJSON, timestamp, loadSchema, exitJSON, exitError, resolveRoot } = require('./utils.cjs');
const { appendLog } = require('./logger.cjs');

function loadState(root) {
  const statePath = path.join(root, '.bonfire', 'state.json');
  return loadJSON(statePath);
}

function saveState(root, state) {
  state.updated_at = timestamp();
  const statePath = path.join(root, '.bonfire', 'state.json');
  writeAtomic(statePath, state);
  return state;
}

function logTransition(root, step, from, to) {
  const logPath = path.join(root, '.bonfire', 'logs', 'state-transitions.jsonl');
  appendLog(logPath, { step, from, to });
}

// --- Command handlers ---

function stateRead(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const state = loadState(path.dirname(root));
  if (!state) exitError('state.json not found', []);
  exitJSON(state);
}

function stateStep(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const step = args.step;
  const status = args.status;
  if (!step || !status) {
    process.stderr.write('Usage: bonfire-tools.cjs state-step --step <name> --status <status>\n');
    process.exit(2);
  }

  const schema = loadSchema();
  if (schema && !schema.step_statuses.includes(status)) {
    exitError(`Invalid status: ${status}`, schema.step_statuses);
  }

  const oldStatus = state.steps[step] ? state.steps[step].status : 'pending';

  if (!state.steps[step]) {
    state.steps[step] = {};
  }
  state.steps[step].status = status;

  if (status === 'running' || status === 'awaiting_agent' || status === 'awaiting_user') {
    state.steps[step].started_at = timestamp();
  }
  if (status === 'passed') {
    state.steps[step].passed_at = timestamp();
  }

  state.current_step = step;
  saveState(dir, state);
  logTransition(dir, step, oldStatus, status);
  exitJSON({ success: true, step, status });
}

function stateAdvance(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const schema = loadSchema();
  const stepOrder = schema.step_order;

  const currentPipeline = state.pipeline_stage;
  const currentSteps = stepOrder[currentPipeline];

  if (!currentSteps) {
    exitError(`Unknown pipeline stage: ${currentPipeline}`, []);
  }

  const stepName = args.step;
  const stepIdx = currentSteps.indexOf(stepName);

  // Check if this is the last step in current pipeline
  if (stepIdx === currentSteps.length - 1) {
    // Advance to next pipeline stage
    const pipelines = Object.keys(stepOrder);
    const pipeIdx = pipelines.indexOf(currentPipeline);
    if (pipeIdx < pipelines.length - 1) {
      const nextPipeline = pipelines[pipeIdx + 1];
      state.pipeline_stage = nextPipeline;
      const nextSteps = stepOrder[nextPipeline];
      for (const s of nextSteps) {
        if (!state.steps[s]) state.steps[s] = { status: 'pending' };
      }
      state.current_step = nextSteps[0];
    }
  } else {
    // Advance to next step within pipeline
    const nextStep = currentSteps[stepIdx + 1];
    if (!state.steps[nextStep]) state.steps[nextStep] = { status: 'pending' };
    state.current_step = nextStep;
  }

  saveState(dir, state);
  exitJSON({ success: true, pipeline_stage: state.pipeline_stage, current_step: state.current_step });
}

function stateReentry(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const conflictType = args['conflict-type'];
  if (!conflictType) {
    process.stderr.write('Usage: bonfire-tools.cjs state-reentry --conflict-type <type> [--reason <text>]\n');
    process.exit(2);
  }

  const schema = loadSchema();
  const route = schema.reentry_routes[conflictType];
  if (!route) exitError(`Unknown conflict type: ${conflictType}`, Object.keys(schema.reentry_routes));

  if (route.crosses_pipeline) {
    // Reset everything, go back to pre
    state.pipeline_stage = 'pre';
    state.steps = { 'stage-a': { status: 'pending' } };
    state.current_step = 'stage-a';
    state.approval.stage_a_approved = false;
    state.approval.stage_a_approved_at = null;
  } else {
    const ordered = schema.step_order.plan;
    const fromIdx = ordered.indexOf(route.to);
    const toIdx = ordered.indexOf(state.current_step);
    for (let i = fromIdx; i <= Math.max(toIdx, fromIdx); i++) {
      state.steps[ordered[i]] = { status: 'pending' };
    }
    state.current_step = route.to;
  }

  state.reentry.depth += 1;
  state.reentry.history.push({
    from: state.current_step,
    to: route.to,
    conflict_type: conflictType,
    reason: args.reason || null,
    depth: state.reentry.depth
  });

  if (state.reentry.depth > state.reentry.max_depth) {
    state.steps[state.current_step] = { status: 'awaiting_user' };
  }

  saveState(dir, state);
  logTransition(dir, 'reentry', conflictType, route.to);
  exitJSON({ success: true, reentry_to: route.to, depth: state.reentry.depth, crosses_pipeline: route.crosses_pipeline });
}

function statePendingReentry(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const conflictType = args['conflict-type'];
  const from = args.from;
  const reason = args.reason;

  if (!conflictType || !from) {
    process.stderr.write('Usage: bonfire-tools.cjs state-pending-reentry --conflict-type <type> --from <step> --reason <text>\n');
    process.exit(2);
  }

  const schema = loadSchema();
  const route = schema.reentry_routes[conflictType];
  if (!route) exitError(`Unknown conflict type: ${conflictType}`, Object.keys(schema.reentry_routes));

  state.pending_reentry = {
    conflict_type: conflictType,
    target_pipeline: route.crosses_pipeline ? 'pre' : 'plan',
    target_step: route.to,
    reason: reason || null,
    originated_from: from,
    originated_run: state.runs.current_run_id,
    depth: state.reentry.depth + 1
  };

  saveState(dir, state);
  exitJSON({ success: true, pending_reentry: state.pending_reentry });
}

function stateClearReentry(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  state.pending_reentry = null;
  saveState(dir, state);
  exitJSON({ success: true });
}

function stateBeginRun(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const runId = args['run-id'];
  if (!runId) {
    process.stderr.write('Usage: bonfire-tools.cjs state-begin-run --run-id <id>\n');
    process.exit(2);
  }

  state.runs.current_run_id = runId;
  state.pipeline_stage = 'code';

  // Create runs directory
  const runDir = path.join(dir, '.bonfire', 'runs', runId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  saveState(dir, state);
  exitJSON({ success: true, run_id: runId });
}

function stateCompleteRun(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const runId = args['run-id'];
  const verdict = args.verdict;
  if (!runId || !verdict) {
    process.stderr.write('Usage: bonfire-tools.cjs state-complete-run --run-id <id> --verdict <verdict>\n');
    process.exit(2);
  }

  state.runs.completed_runs.push({ run_id: runId, verdict, completed_at: timestamp() });
  state.runs.current_run_id = null;

  saveState(dir, state);
  exitJSON({ success: true, run_id: runId, verdict });
}

function stateInitCodeSteps(args) {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  const state = loadState(dir);
  if (!state) exitError('state.json not found', []);

  const compileOutput = loadJSON(path.join(dir, '.bonfire', 'plan', 'compile-output.json'));
  if (!compileOutput || !compileOutput.handoff || !compileOutput.handoff.implementation_units) {
    exitError('compile-output.json not found or missing implementation_units', []);
  }

  const units = compileOutput.handoff.implementation_units;
  for (let i = 0; i < units.length; i++) {
    const stepName = `unit-${i + 1}`;
    state.steps[stepName] = { status: 'pending' };
  }
  state.current_step = 'unit-1';

  saveState(dir, state);
  exitJSON({ success: true, units_created: units.length });
}

module.exports = {
  stateRead, stateStep, stateAdvance, stateReentry,
  statePendingReentry, stateClearReentry,
  stateBeginRun, stateCompleteRun, stateInitCodeSteps,
  loadState, saveState
};
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test tests/test-state.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/lib/state.cjs tests/test-state.js
git commit -m "feat: implement state machine with step transitions, reentry, run management"
```

---

### Task 5: State Machine — Reentry and Cross-Skill Tests

**Files:**
- Modify: `tests/test-state.js`

- [ ] **Step 1: Add reentry and cross-skill tests**

Append to `tests/test-state.js`:

```javascript
test('state-reentry resets steps from target to current', () => {
  const dir = makeTmpDir();
  initCase(dir);
  // Advance through pre → plan
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  // Set some plan steps as passed
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-b', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-c', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-d', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-e', '--status', 'running'], { encoding: 'utf8', cwd: dir });
  // Reentry to stage-c (requirement_conflict)
  const stdout = execFileSync('node', [CLI, 'state-reentry', '--conflict-type', 'requirement_conflict', '--reason', 'test'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.reentry_to, 'stage-c');
  assert.equal(result.depth, 1);

  const state = readState(dir);
  assert.equal(state.steps['stage-c'].status, 'pending');
  assert.equal(state.steps['stage-d'].status, 'pending');
  assert.equal(state.steps['stage-e'].status, 'pending');
  assert.equal(state.steps['stage-b'].status, 'passed'); // before reentry range, untouched
  assert.equal(state.reentry.depth, 1);
  fs.rmSync(dir, { recursive: true });
});

test('state-reentry with goal_conflict crosses pipeline to pre', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'state-reentry', '--conflict-type', 'goal_conflict'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.equal(result.crosses_pipeline, true);

  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  assert.equal(state.approval.stage_a_approved, false);
  fs.rmSync(dir, { recursive: true });
});

test('state-pending-reentry sets cross-skill signal', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-pending-reentry',
    '--conflict-type', 'requirement_conflict',
    '--from', 'unit-3',
    '--reason', 'CON-003 violated'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.ok(state.pending_reentry);
  assert.equal(state.pending_reentry.conflict_type, 'requirement_conflict');
  assert.equal(state.pending_reentry.target_step, 'stage-c');
  assert.equal(state.pending_reentry.target_pipeline, 'plan');
  assert.equal(state.pending_reentry.originated_from, 'unit-3');
  fs.rmSync(dir, { recursive: true });
});

test('state-clear-reentry clears pending signal', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-pending-reentry',
    '--conflict-type', 'requirement_conflict',
    '--from', 'unit-3',
    '--reason', 'test'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-clear-reentry'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.pending_reentry, null);
  fs.rmSync(dir, { recursive: true });
});

test('state-begin-run sets current run and creates directory', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-begin-run', '--run-id', 'run-001'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.runs.current_run_id, 'run-001');
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'runs', 'run-001')));
  fs.rmSync(dir, { recursive: true });
});

test('state-complete-run records completed run', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-begin-run', '--run-id', 'run-001'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-complete-run', '--run-id', 'run-001', '--verdict', 'achieved'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.runs.current_run_id, null);
  assert.equal(state.runs.completed_runs.length, 1);
  assert.equal(state.runs.completed_runs[0].verdict, 'achieved');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run all state tests**

Run: `node --test tests/test-state.js`
Expected: All 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test-state.js
git commit -m "test: add reentry, cross-skill protocol, and run management tests"
```

---

### Task 6: Wire Commands to bonfire-tools.cjs

**Files:**
- Modify: `bin/bonfire-tools.cjs`

- [ ] **Step 1: Replace stubs with real handlers for truth-*, state-*, and log-* commands**

Replace the stub entries in the COMMANDS object:

```javascript
// In COMMANDS object, replace stubs:

// State domain
'state-read':       () => require('./lib/state.cjs').stateRead,
'state-advance':    () => require('./lib/state.cjs').stateAdvance,
'state-reentry':    () => require('./lib/state.cjs').stateReentry,
'state-pending-reentry': () => require('./lib/state.cjs').statePendingReentry,
'state-clear-reentry':   () => require('./lib/state.cjs').stateClearReentry,
'state-step':       () => require('./lib/state.cjs').stateStep,
'state-begin-run':  () => require('./lib/state.cjs').stateBeginRun,
'state-complete-run': () => require('./lib/state.cjs').stateCompleteRun,
'state-init-code-steps': () => require('./lib/state.cjs').stateInitCodeSteps,

// Truth surface domain
'truth-propose':    () => truthCommand('propose'),
'truth-update':     () => truthCommand('update'),
'truth-annotate':   () => truthCommand('annotate'),
'truth-freeze':     () => truthCommand('freeze'),
'truth-supersede':  () => truthCommand('supersede'),
'truth-discard':    () => truthCommand('discard'),
'truth-read':       () => truthCommand('read'),
'truth-query':      () => truthCommand('query'),
'truth-rebuild':    () => truthCommand('rebuild'),

// Log domain
'log-agent':        () => logCommand('agent'),
'log-transition':   () => logCommand('transition'),
'log-read':         () => logCommand('read'),
```

Add truth and log command wrappers:

```javascript
function truthCommand(action) {
  return function(args) {
    const ts = require('./lib/truth-surface.cjs');
    const root = require('./lib/utils.cjs').resolveRoot(process.cwd());
    if (!root) exitError('.bonfire/ not found', []);
    const dir = path.dirname(root);

    try {
      switch (action) {
        case 'propose':
          exitJSON(ts.propose(dir, args));
          break;
        case 'update':
          exitJSON(ts.update(dir, args));
          break;
        case 'annotate':
          exitJSON(ts.annotate(dir, args));
          break;
        case 'freeze':
          exitJSON(ts.freeze(dir, args));
          break;
        case 'supersede':
          exitJSON(ts.supersede(dir, args));
          break;
        case 'discard':
          exitJSON(ts.discard(dir, args));
          break;
        case 'read':
          const snapshot = ts.loadSnapshot(dir);
          exitJSON(snapshot || { entries: {}, by_status: {}, by_category: {} });
          break;
        case 'query':
          exitJSON(ts.query(dir, args));
          break;
        case 'rebuild':
          exitJSON(ts.rebuild(dir));
          break;
      }
    } catch (err) {
      exitError(err.message, []);
    }
  };
}

function logCommand(action) {
  return function(args) {
    const { appendLog, readLog } = require('./lib/logger.cjs');
    const root = require('./lib/utils.cjs').resolveRoot(process.cwd());
    if (!root) exitError('.bonfire/ not found', []);
    const dir = path.dirname(root);

    switch (action) {
      case 'agent': {
        const logPath = path.join(dir, '.bonfire', 'logs', 'agent-invocations.jsonl');
        appendLog(logPath, { event: args.event, agent: args.agent, step: args.step, error: args.error || null });
        exitJSON({ success: true });
        break;
      }
      case 'transition': {
        const logPath = path.join(dir, '.bonfire', 'logs', 'state-transitions.jsonl');
        appendLog(logPath, { step: args.step, from: args.from, to: args.to });
        exitJSON({ success: true });
        break;
      }
      case 'read': {
        const typeMap = {
          'render': 'render.jsonl',
          'state-transitions': 'state-transitions.jsonl',
          'agent-invocations': 'agent-invocations.jsonl'
        };
        const filename = typeMap[args.type];
        if (!filename) exitError(`Unknown log type: ${args.type}`, Object.keys(typeMap));
        const logPath = path.join(dir, '.bonfire', 'logs', filename);
        exitJSON(readLog(logPath, { since: args.since }));
        break;
      }
    }
  };
}
```

- [ ] **Step 2: Run full test suite**

Run: `node --test tests/test-utils.js tests/test-foundation.js tests/test-init.js tests/test-logger.js tests/test-truth-surface.js tests/test-truth-freeze.js tests/test-state.js`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add bin/bonfire-tools.cjs
git commit -m "feat: wire truth-surface, state, and log commands to CLI router"
```

---

### Task 7: CLI Integration Tests for Truth Surface

**Files:**
- Create: `tests/test-truth-cli.js`

- [ ] **Step 1: Write CLI-level integration tests**

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
  return dir;
}

test('truth-propose via CLI creates entry', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'retained_goal',
    '--content', 'Must support OAuth2', '--rationale', 'Core req',
    '--source', 'stage-c'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  assert.equal(snapshot.entries['CON-001'].status, 'PROPOSED');
  fs.rmSync(dir, { recursive: true });
});

test('truth-read via CLI returns snapshot', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'retained_goal',
    '--content', 'test', '--rationale', 'test', '--source', 'stage-c'],
    { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'truth-read'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  fs.rmSync(dir, { recursive: true });
});

test('full lifecycle via CLI: propose → challenge → freeze', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'frozen_constraint',
    '--content', 'Must use PostgreSQL', '--rationale', 'Team expertise',
    '--source', 'stage-c'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CON-001', '--field', 'challenged_by', '--value', 'd-critique'],
    { encoding: 'utf8', cwd: dir });
  const stdout = execFileSync('node', [CLI, 'truth-freeze', '--id', 'CON-001'],
    { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.equal(snapshot.entries['CON-001'].status, 'FROZEN');
  assert.ok(snapshot.entries['CON-001'].frozen_at);
  fs.rmSync(dir, { recursive: true });
});

test('truth-rebuild regenerates from history', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CON-001', '--category', 'confirmed_fact',
    '--content', 'pg14', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });
  // Delete snapshot
  fs.unlinkSync(path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'));
  // Rebuild
  const stdout = execFileSync('node', [CLI, 'truth-rebuild'], { encoding: 'utf8', cwd: dir });
  const snapshot = JSON.parse(stdout);
  assert.ok(snapshot.entries['CON-001']);
  assert.equal(snapshot.entries['CON-001'].content, 'pg14');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run tests**

Run: `node --test tests/test-truth-cli.js`
Expected: All 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test-truth-cli.js
git commit -m "test: add CLI integration tests for truth surface commands"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run complete test suite**

Run: `node --test tests/test-utils.js tests/test-foundation.js tests/test-init.js tests/test-logger.js tests/test-truth-surface.js tests/test-truth-freeze.js tests/test-state.js tests/test-truth-cli.js`

Expected: All tests PASS. Total should be approximately:
- test-utils: 9
- test-foundation: 14
- test-init: 6
- test-logger: 4
- test-truth-surface: 6
- test-truth-freeze: 9
- test-state: 9
- test-truth-cli: 4
- **Total: ~61 tests**

- [ ] **Step 2: Verify no stubs remain for truth/state/log commands**

Run: `node -e "const cli = require('fs').readFileSync('bin/bonfire-tools.cjs','utf8'); const stubs = cli.match(/stub/g); console.log('stub references:', stubs ? stubs.length : 0)"`

Expected: Only the stub function definition and references for delta-validate, handoff-validate, bundle-validate, render, render-check, preflight-update remain (Plan 3 commands).
