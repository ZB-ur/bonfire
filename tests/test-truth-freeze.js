'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  propose,
  update,
  annotate,
  freeze,
  supersede,
  discard,
  loadSnapshot,
} = require('../bin/lib/truth-surface.cjs');

function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-freeze-'));
  const tsDir = path.join(dir, '.bonfire', 'truth-surface');
  fs.mkdirSync(tsDir, { recursive: true });
  fs.writeFileSync(path.join(tsDir, 'constraint-ledger-history.jsonl'), '');
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1: freeze requires challenged_by for retained_goal
// ---------------------------------------------------------------------------
test('freeze requires challenged_by for retained_goal', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'rg-001',
      category: 'retained_goal',
      statement: 'Must support multi-tenancy.',
    });

    // No challenged_by — should throw
    assert.throws(
      () => freeze(root, { id: 'rg-001' }),
      /maturity gate failed|challenged_by/i
    );

    // Entry should still be PROPOSED
    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'PROPOSED');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: freeze succeeds for retained_goal after challenge
// ---------------------------------------------------------------------------
test('freeze succeeds for retained_goal after challenge', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'rg-002',
      category: 'retained_goal',
      statement: 'Must support multi-tenancy.',
    });

    update(root, { id: 'rg-002', field: 'challenged_by', value: 'stage-d-agent' });

    // Status auto-transitioned to CHALLENGED, now freeze
    freeze(root, { id: 'rg-002' });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'FROZEN');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: freeze confirmed_fact without challenged_by succeeds
// ---------------------------------------------------------------------------
test('freeze confirmed_fact without challenged_by succeeds', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'cf-001',
      category: 'confirmed_fact',
      statement: 'The API returns JSON.',
    });

    // confirmed_fact has evidence_required gate — freeze passes without challenged_by
    freeze(root, { id: 'cf-001' });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'FROZEN');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: freeze high_impact_risk throws
// ---------------------------------------------------------------------------
test('freeze high_impact_risk throws', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'hi-001',
      category: 'high_impact_risk',
      statement: 'Vendor may discontinue API.',
    });

    assert.throws(
      () => freeze(root, { id: 'hi-001' }),
      /cannot be frozen/i
    );

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries[0].status, 'OPEN');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: annotate adds evidence_refs to FROZEN entry
// ---------------------------------------------------------------------------
test('annotate adds evidence_refs to FROZEN entry', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'cf-010',
      category: 'confirmed_fact',
      statement: 'Response time under 200ms in 95th percentile.',
    });

    freeze(root, { id: 'cf-010' });

    annotate(root, {
      id: 'cf-010',
      field: 'evidence_refs',
      value: 'perf-test-report-2024-01',
    });

    const snapshot = loadSnapshot(root);
    const entry = snapshot.entries[0];
    assert.equal(entry.status, 'FROZEN');
    assert.deepStrictEqual(entry.evidence_refs, ['perf-test-report-2024-01']);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: annotate rejects non-whitelist field
// ---------------------------------------------------------------------------
test('annotate rejects non-whitelist field', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'cf-011',
      category: 'confirmed_fact',
      statement: 'Auth tokens expire after 1 hour.',
    });

    freeze(root, { id: 'cf-011' });

    assert.throws(
      () => annotate(root, { id: 'cf-011', field: 'statement', value: 'Overridden!' }),
      /not in annotate whitelist/i
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: supersede creates new FROZEN, old becomes SUPERSEDED
// ---------------------------------------------------------------------------
test('supersede creates new FROZEN, old becomes SUPERSEDED', () => {
  const root = makeTempRoot();
  try {
    propose(root, {
      id: 'rg-010',
      category: 'retained_goal',
      statement: 'Support 1k concurrent users.',
    });

    supersede(root, {
      old_id: 'rg-010',
      new_id: 'rg-011',
      category: 'retained_goal',
      statement: 'Support 10k concurrent users.',
      rationale: 'Scale requirements increased.',
    });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries.length, 2);

    const oldEntry = snapshot.entries.find(e => e.id === 'rg-010');
    const newEntry = snapshot.entries.find(e => e.id === 'rg-011');

    assert.ok(oldEntry, 'old entry should exist');
    assert.ok(newEntry, 'new entry should exist');

    assert.equal(oldEntry.status, 'SUPERSEDED');
    assert.equal(oldEntry.superseded_by, 'rg-011');

    assert.equal(newEntry.status, 'FROZEN');
    assert.equal(newEntry.category, 'retained_goal');
    assert.equal(newEntry.statement, 'Support 10k concurrent users.');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: discard creates DISCARDED entry
// ---------------------------------------------------------------------------
test('discard creates DISCARDED entry', () => {
  const root = makeTempRoot();
  try {
    discard(root, {
      id: 'do-001',
      category: 'discarded_option',
      statement: 'Use Redis for session storage.',
      rationale: 'Unnecessary complexity for current scale.',
    });

    const snapshot = loadSnapshot(root);
    assert.equal(snapshot.entries.length, 1);

    const entry = snapshot.entries[0];
    assert.equal(entry.id, 'do-001');
    assert.equal(entry.status, 'DISCARDED');
    assert.equal(entry.category, 'discarded_option');
    assert.equal(entry.rationale, 'Unnecessary complexity for current scale.');
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: discard requires rationale
// ---------------------------------------------------------------------------
test('discard requires rationale', () => {
  const root = makeTempRoot();
  try {
    assert.throws(
      () => discard(root, {
        id: 'do-002',
        statement: 'Use GraphQL everywhere.',
        // no rationale
      }),
      /rationale is required/i
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
