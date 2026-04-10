'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  propose,
  update,
  replay,
  loadSnapshot,
  getHistoryPath,
} = require('../bin/lib/truth-surface.cjs');

function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-ts-'));
  const tsDir = path.join(dir, '.bonfire', 'truth-surface');
  fs.mkdirSync(tsDir, { recursive: true });
  fs.writeFileSync(path.join(tsDir, 'constraint-ledger-history.jsonl'), '');
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1: propose creates PROPOSED entry with correct snapshot indices
// ---------------------------------------------------------------------------
test('propose creates PROPOSED entry with correct snapshot indices', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'c-001',
      category: 'retained_goal',
      statement: 'The system must support offline mode.',
    });

    propose(root, {
      id: 'c-002',
      category: 'confirmed_fact',
      statement: 'Users have intermittent connectivity.',
    });

    const snapshot = loadSnapshot(root);
    assert.ok(snapshot, 'snapshot should exist');
    assert.equal(snapshot.entries.length, 2);

    const first = snapshot.entries[0];
    assert.equal(first.id, 'c-001');
    assert.equal(first.status, 'PROPOSED');
    assert.equal(first.category, 'retained_goal');

    const second = snapshot.entries[1];
    assert.equal(second.id, 'c-002');
    assert.equal(second.status, 'PROPOSED');
    assert.equal(second.category, 'confirmed_fact');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: propose with discarded_option creates DISCARDED entry
// ---------------------------------------------------------------------------
test('propose with discarded_option creates DISCARDED entry', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'c-010',
      category: 'discarded_option',
      statement: 'Use blockchain for storage.',
      rationale: 'Too complex and unnecessary.',
    });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries.length, 1);
    const entry = snapshot.entries[0];
    assert.equal(entry.id, 'c-010');
    assert.equal(entry.status, 'DISCARDED');
    assert.equal(entry.category, 'discarded_option');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: propose with high_impact_risk creates OPEN entry
// ---------------------------------------------------------------------------
test('propose with high_impact_risk creates OPEN entry', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'c-020',
      category: 'high_impact_risk',
      statement: 'Vendor may discontinue API by Q4.',
    });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries.length, 1);
    const entry = snapshot.entries[0];
    assert.equal(entry.id, 'c-020');
    assert.equal(entry.status, 'OPEN');
    assert.equal(entry.category, 'high_impact_risk');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: update appends to challenged_by array, auto-transitions to CHALLENGED
// ---------------------------------------------------------------------------
test('update appends to challenged_by array, auto-transitions to CHALLENGED', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'c-030',
      category: 'retained_goal',
      statement: 'Must support 10k concurrent users.',
    });

    // Verify initial status
    let snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'PROPOSED');

    // Update challenged_by
    update(root, {
      id: 'c-030',
      field: 'challenged_by',
      value: 'stage-d-agent',
    });

    snapshot = loadSnapshot(root);
    const entry = snapshot.entries[0];
    assert.equal(entry.status, 'CHALLENGED');
    assert.deepStrictEqual(entry.challenged_by, ['stage-d-agent']);

    // Append another challenger
    update(root, {
      id: 'c-030',
      field: 'challenged_by',
      value: 'stage-g-red',
    });

    snapshot = loadSnapshot(root);
    assert.deepStrictEqual(snapshot.entries[0].challenged_by, ['stage-d-agent', 'stage-g-red']);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: update rejects writes to FROZEN entries
// ---------------------------------------------------------------------------
test('update rejects writes to FROZEN entries', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'c-040',
      category: 'confirmed_fact',
      statement: 'The API returns JSON.',
    });

    // Freeze it (confirmed_fact has evidence_required gate, which passes without checks)
    const { freeze } = require('../bin/lib/truth-surface.cjs');
    freeze(root, { id: 'c-040' });

    let snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'FROZEN');

    // Attempt to update should throw
    assert.throws(
      () => update(root, { id: 'c-040', field: 'statement', value: 'New value' }),
      /cannot update.*FROZEN/i
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: replay from empty history produces empty snapshot
// ---------------------------------------------------------------------------
test('replay from empty history produces empty snapshot', () => {
  const root = makeTempRoot();
  try {
    const snapshot = replay(root);
    assert.ok(snapshot, 'snapshot should be returned');
    assert.ok(Array.isArray(snapshot.entries), 'entries should be an array');
    assert.equal(snapshot.entries.length, 0);
    assert.ok(snapshot.generated_at, 'generated_at should be set');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
