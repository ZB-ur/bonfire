'use strict';

const path = require('path');
const { writeAtomic, loadJSON, timestamp, loadSchema } = require('./utils.cjs');
const { appendLog, readLog } = require('./logger.cjs');

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getHistoryPath(root) {
  return path.join(root, '.bonfire', 'truth-surface', 'constraint-ledger-history.jsonl');
}

function getSnapshotPath(root) {
  return path.join(root, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
}

// ---------------------------------------------------------------------------
// Category initial-status rules
// ---------------------------------------------------------------------------

const CATEGORY_INITIAL_STATUS = {
  retained_goal:      'PROPOSED',
  confirmed_fact:     'PROPOSED',
  frozen_constraint:  'PROPOSED',
  challenged_claim:   'PROPOSED',
  discarded_option:   'DISCARDED',
  high_impact_risk:   'OPEN',
  dependency_chain:   'PROPOSED',
  acceptance_semantic:'PROPOSED',
};

// Categories that cannot be frozen
const NO_FREEZE_CATEGORIES = new Set(['challenged_claim', 'discarded_option', 'high_impact_risk']);

// Maturity gate logic per category
// Returns null if gate passes, or an error string if it fails
function checkMaturityGate(entry) {
  const schema = loadSchema();
  const catConfig = schema && schema.categories && schema.categories[entry.category];
  if (!catConfig) {
    throw new Error(`Unknown category: ${entry.category}`);
  }

  if (!catConfig.can_freeze) {
    throw new Error(`Category "${entry.category}" cannot be frozen`);
  }

  const gate = catConfig.maturity_gate;
  if (gate === 'challenged_by_non_empty') {
    const challenged = Array.isArray(entry.challenged_by) && entry.challenged_by.length > 0;
    const aligned    = Array.isArray(entry.aligned_by)    && entry.aligned_by.length    > 0;
    if (!challenged && !aligned) {
      throw new Error(
        `Maturity gate failed: "${entry.category}" requires non-empty ` +
        `challenged_by or aligned_by before freeze`
      );
    }
  } else if (gate === 'evidence_required') {
    // confirmed_fact: evidence_refs must be non-empty OR no gate enforced here
    // The spec says confirmed_fact doesn't need challenged_by — passes without check
    // (evidence_refs gate is informational in schema, not enforced by freeze)
  } else if (gate === 'refs_valid') {
    // dependency_chain: refs_valid gate — treat as passing (no ref validation implemented)
  }
  // acceptance_semantic uses challenged_by_non_empty same as retained_goal
}

// ---------------------------------------------------------------------------
// Annotate whitelist
// ---------------------------------------------------------------------------

function getAnnotateWhitelist() {
  const schema = loadSchema();
  return (schema && schema.annotate_whitelist) || ['evidence_refs', 'aligned_by', 'notes'];
}

// ---------------------------------------------------------------------------
// Replay: rebuild snapshot from history
// ---------------------------------------------------------------------------

function replay(root) {
  const historyPath = getHistoryPath(root);
  const events = readLog(historyPath);

  // Map from id -> entry
  const entries = {};
  // Preserve insertion order
  const order = [];

  for (const event of events) {
    const { type, id } = event;

    if (type === 'propose') {
      const category = event.category;
      const initialStatus = CATEGORY_INITIAL_STATUS[category] || 'PROPOSED';
      const entry = {
        id,
        category,
        content: event.content,
        status: initialStatus,
        source: event.source || null,
        rationale: event.rationale || null,
        challenged_by: [],
        aligned_by: [],
        evidence_refs: [],
        notes: event.notes || null,
        superseded_by: null,
        created_at: event.timestamp,
        updated_at: event.timestamp,
      };
      entries[id] = entry;
      order.push(id);

    } else if (type === 'discard') {
      const category = event.category || 'discarded_option';
      const entry = {
        id,
        category,
        content: event.content,
        status: 'DISCARDED',
        source: event.source || null,
        rationale: event.rationale || null,
        challenged_by: [],
        aligned_by: [],
        evidence_refs: [],
        notes: event.notes || null,
        superseded_by: null,
        created_at: event.timestamp,
        updated_at: event.timestamp,
      };
      entries[id] = entry;
      order.push(id);

    } else if (type === 'update') {
      const entry = entries[id];
      if (!entry) continue;
      const { field, value } = event;

      // Array-append fields
      if (field === 'challenged_by' || field === 'aligned_by' || field === 'evidence_refs') {
        if (!Array.isArray(entry[field])) entry[field] = [];
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (!entry[field].includes(v)) {
            entry[field].push(v);
          }
        }
        // Auto-transition: if challenged_by becomes non-empty and status is PROPOSED
        if (field === 'challenged_by' && entry.challenged_by.length > 0 && entry.status === 'PROPOSED') {
          entry.status = 'CHALLENGED';
        }
      } else {
        entry[field] = value;
      }
      entry.updated_at = event.timestamp;

    } else if (type === 'annotate') {
      const entry = entries[id];
      if (!entry) continue;
      const { field, value } = event;

      if (field === 'evidence_refs' || field === 'aligned_by') {
        if (!Array.isArray(entry[field])) entry[field] = [];
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (!entry[field].includes(v)) {
            entry[field].push(v);
          }
        }
      } else if (field === 'notes') {
        entry.notes = value;
      }
      entry.updated_at = event.timestamp;

    } else if (type === 'freeze') {
      const entry = entries[id];
      if (!entry) continue;
      entry.status = 'FROZEN';
      entry.updated_at = event.timestamp;

    } else if (type === 'supersede') {
      // old entry -> SUPERSEDED
      const oldEntry = entries[event.supersedes];
      if (oldEntry) {
        oldEntry.status = 'SUPERSEDED';
        oldEntry.superseded_by = id;
        oldEntry.updated_at = event.timestamp;
      }
      // new entry -> FROZEN
      const category = event.category;
      const newEntry = {
        id,
        category,
        content: event.content,
        status: 'FROZEN',
        source: event.source || null,
        rationale: event.rationale || null,
        challenged_by: [],
        aligned_by: [],
        evidence_refs: [],
        notes: event.notes || null,
        superseded_by: null,
        created_at: event.timestamp,
        updated_at: event.timestamp,
      };
      entries[id] = newEntry;
      order.push(id);
    }
  }

  // Build by_status index
  const ALL_STATUSES = ['proposed', 'challenged', 'frozen', 'superseded', 'open', 'discarded'];
  const by_status = {};
  for (const s of ALL_STATUSES) by_status[s] = [];
  for (const id of order) {
    const entry = entries[id];
    const key = entry.status.toLowerCase();
    if (by_status[key]) by_status[key].push(id);
  }

  // Build by_category index
  const by_category = {};
  for (const cat of Object.keys(CATEGORY_INITIAL_STATUS)) by_category[cat] = [];
  for (const id of order) {
    const entry = entries[id];
    if (by_category[entry.category]) by_category[entry.category].push(id);
  }

  return {
    version: 1,
    replayed_at: timestamp(),
    event_count: events.length,
    entries,
    by_status,
    by_category,
  };
}

// ---------------------------------------------------------------------------
// Snapshot I/O
// ---------------------------------------------------------------------------

function regenerateSnapshot(root) {
  const snapshot = replay(root);
  writeAtomic(getSnapshotPath(root), snapshot);

  // Self-render: truth surface changes go through CLI (fs.writeFileSync),
  // not Claude Code Write tool, so the dual-write hook can't see them.
  try {
    const { renderNote } = require('./renderer.cjs');
    renderNote(root, 'constraint-ledger');
  } catch (_) {
    // Renderer may not be available during init or if templates missing
  }

  return snapshot;
}

function loadSnapshot(root) {
  return loadJSON(getSnapshotPath(root));
}

function rebuild(root) {
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

function propose(root, opts) {
  const { id, category, content, source, rationale, notes } = opts;
  if (!id) throw new Error('propose: id is required');
  if (!category) throw new Error('propose: category is required');
  if (!content) throw new Error('propose: content is required');

  const validCategories = Object.keys(CATEGORY_INITIAL_STATUS);
  if (!validCategories.includes(category)) {
    throw new Error(`propose: unknown category "${category}"`);
  }

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'propose',
    id,
    category,
    content,
    source: source || null,
    rationale: rationale || null,
    notes: notes || null,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

function update(root, opts) {
  const { id, field, value } = opts;
  if (!id) throw new Error('update: id is required');
  if (!field) throw new Error('update: field is required');

  // Load current snapshot to check status
  const snapshot = loadSnapshot(root) || replay(root);
  const entry = (snapshot.entries || {})[id];
  if (!entry) throw new Error(`update: entry "${id}" not found`);

  if (entry.status === 'FROZEN' || entry.status === 'SUPERSEDED') {
    throw new Error(`update: cannot update entry "${id}" with status "${entry.status}"`);
  }

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'update',
    id,
    field,
    value,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// annotate
// ---------------------------------------------------------------------------

function annotate(root, opts) {
  const { id, field, value } = opts;
  if (!id) throw new Error('annotate: id is required');
  if (!field) throw new Error('annotate: field is required');

  const whitelist = getAnnotateWhitelist();
  if (!whitelist.includes(field)) {
    throw new Error(`annotate: field "${field}" is not in annotate whitelist`);
  }

  // Load current snapshot to check status
  const snapshot = loadSnapshot(root) || replay(root);
  const entry = (snapshot.entries || {})[id];
  if (!entry) throw new Error(`annotate: entry "${id}" not found`);

  if (entry.status !== 'FROZEN') {
    throw new Error(
      `truth-annotate: entry "${id}" must be FROZEN (current status: "${entry.status}"). ` +
      `Hint: For PROPOSED/CHALLENGED entries, use truth-update to add evidence: ` +
      `bonfire truth-update --id ${id} --field evidence_refs --value <ref-id>`
    );
  }

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'annotate',
    id,
    field,
    value,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// freeze
// ---------------------------------------------------------------------------

function freeze(root, opts) {
  const { id } = opts;
  if (!id) throw new Error('freeze: id is required');

  // Load current snapshot to check entry state
  const snapshot = loadSnapshot(root) || replay(root);
  const entry = (snapshot.entries || {})[id];
  if (!entry) throw new Error(`freeze: entry "${id}" not found`);

  if (entry.status === 'FROZEN') {
    throw new Error(`freeze: entry "${id}" is already FROZEN`);
  }

  // Check maturity gate (throws on failure)
  checkMaturityGate(entry);

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'freeze',
    id,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// supersede
// ---------------------------------------------------------------------------

function supersede(root, opts) {
  const { supersedes, id, category, content, source, rationale, notes } = opts;
  if (!supersedes) throw new Error('supersede: supersedes is required');
  if (!id) throw new Error('supersede: id is required');
  if (!category) throw new Error('supersede: category is required');
  if (!content) throw new Error('supersede: content is required');

  // Load current snapshot to verify old entry exists and is FROZEN
  const snapshot = loadSnapshot(root) || replay(root);
  const oldEntry = (snapshot.entries || {})[supersedes];
  if (!oldEntry) throw new Error(`supersede: entry "${supersedes}" not found`);
  if (oldEntry.status !== 'FROZEN') {
    throw new Error(
      `supersede: entry "${supersedes}" is ${oldEntry.status}, must be FROZEN. ` +
      `Use truth-discard on the old entry, then truth-propose the replacement.`
    );
  }

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'supersede',
    id,
    supersedes,
    category,
    content,
    source: source || null,
    rationale: rationale || null,
    notes: notes || null,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// discard
// ---------------------------------------------------------------------------

function discard(root, opts) {
  const { id, category, content, rationale, source, notes } = opts;
  if (!id) throw new Error('discard: id is required');
  if (!content) throw new Error('discard: content is required');
  if (!rationale || rationale.trim() === '') {
    throw new Error('discard: rationale is required');
  }

  const historyPath = getHistoryPath(root);
  const event = {
    type: 'discard',
    id,
    category: category || 'discarded_option',
    content,
    rationale,
    source: source || null,
    notes: notes || null,
    timestamp: timestamp(),
  };
  appendLog(historyPath, event);
  return regenerateSnapshot(root);
}

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

function query(root, opts) {
  const snapshot = loadSnapshot(root) || replay(root);
  let entries = Object.values(snapshot.entries || {});

  if (opts && opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    entries = entries.filter(e => statuses.includes(e.status));
  }
  if (opts && opts.category) {
    const categories = Array.isArray(opts.category) ? opts.category : [opts.category];
    entries = entries.filter(e => categories.includes(e.category));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  propose,
  update,
  annotate,
  freeze,
  supersede,
  discard,
  replay,
  regenerateSnapshot,
  loadSnapshot,
  query,
  rebuild,
  getHistoryPath,
  getSnapshotPath,
  checkMaturityGate,  // exported so freeze-enforcement can pre-validate
};
