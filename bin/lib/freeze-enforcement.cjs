'use strict';

const path = require('path');
const { loadSnapshot, update, freeze, checkMaturityGate } = require('./truth-surface.cjs');

// Authorizer tokens written to aligned_by before an auto-freeze.
const TOKEN_STAGE_G = 'stage-g-survival';
const TOKEN_STAGE_H = 'stage-h-ruling';

/**
 * Run the Stage G truth-freeze gate.
 *
 * Rules (one per row of the decision table):
 *   - category == high_impact_risk             → skip (stays OPEN)
 *   - FROZEN / SUPERSEDED / DISCARDED          → skip
 *   - PROPOSED, challenged_by empty            → update aligned_by="stage-g-survival"
 *                                                 then freeze
 *   - CHALLENGED, aligned_by non-empty         → freeze (no new alignment)
 *   - CHALLENGED, aligned_by empty             → UNRESOLVED (warning, skip)
 *
 * Returns a summary object; the caller decides exit code based on unresolved.
 */
function stageGFreezeGate(root) {
  const snapshot = loadSnapshot(root);
  const entries = (snapshot && snapshot.entries) || {};

  const summary = {
    frozen: [],         // ids freshly frozen (directly, already CHALLENGED+aligned)
    autoAligned: [],    // ids auto-aligned + frozen (were PROPOSED with empty challenged_by)
    skippedRisk: [],    // high_impact_risk ids left OPEN
    skippedFrozen: [],  // ids already FROZEN / SUPERSEDED / DISCARDED
    unresolved: [],     // CHALLENGED ids without alignment — BLOCKING
  };

  const { loadSchema } = require('./utils.cjs');
  const schema = loadSchema();
  const noFreezeCategories = new Set(
    Object.entries((schema && schema.categories) || {})
      .filter(([_, cfg]) => cfg && cfg.can_freeze === false)
      .map(([name]) => name)
  );

  for (const [id, entry] of Object.entries(entries)) {
    if (noFreezeCategories.has(entry.category)) {
      summary.skippedRisk.push(id);
      continue;
    }

    const status = entry.status;
    if (status === 'FROZEN' || status === 'SUPERSEDED' || status === 'DISCARDED') {
      summary.skippedFrozen.push(id);
      continue;
    }

    const challengedByEmpty = !Array.isArray(entry.challenged_by) || entry.challenged_by.length === 0;
    const alignedByNonEmpty = Array.isArray(entry.aligned_by) && entry.aligned_by.length > 0;

    if (status === 'PROPOSED' && challengedByEmpty) {
      update(root, { id, field: 'aligned_by', value: TOKEN_STAGE_G });
      freeze(root, { id });
      summary.autoAligned.push(id);
      continue;
    }

    if (status === 'CHALLENGED' && alignedByNonEmpty) {
      freeze(root, { id });
      summary.frozen.push(id);
      continue;
    }

    if (status === 'CHALLENGED') {
      summary.unresolved.push(id);
      continue;
    }

    // PROPOSED with non-empty challenged_by shouldn't exist (replay auto-transitions
    // to CHALLENGED), but fall through as unresolved to surface the anomaly.
    summary.unresolved.push(id);
  }

  return summary;
}

/**
 * Apply all freeze/supersede rulings from an h-review-verdict.json file.
 *
 * Classification:
 *   1. filter rulings[] to action ∈ {freeze, supersede}
 *   2. freeze rulings whose target is already FROZEN → idempotent skip
 *   3. everything else → pre-validation (target exists, supersede preconditions)
 *   4. if pre-validation fails on any non-skip ruling → throw without writing
 *   5. otherwise emit planned events (update aligned_by + freeze, or supersede)
 */
function applyHRulings(root) {
  const { validateDelta } = require('./delta-parser.cjs');
  const { supersede } = require('./truth-surface.cjs');
  const fs = require('fs');

  const verdictPath = path.join(root, '.bonfire', 'plan', 'h-review-verdict.json');
  let verdict;
  try {
    verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read verdict at ${verdictPath}: ${err.message}`);
  }

  const validation = validateDelta('bonfire-h-review', verdict);
  if (!validation.valid) {
    throw new Error('Verdict failed schema validation: ' + validation.errors.join('; '));
  }

  const rulings = Array.isArray(verdict.rulings) ? verdict.rulings : [];
  const filtered = rulings.filter(r => r.action === 'freeze' || r.action === 'supersede');

  const snapshot = loadSnapshot(root);
  const entries = (snapshot && snapshot.entries) || {};

  // Classify
  const skips = [];       // { id }
  const toExecute = [];   // { ruling, plan: 'freeze-with-align' | 'freeze' | 'supersede' }
  const failures = [];    // { ruling, reason }

  for (const ruling of filtered) {
    if (ruling.action === 'freeze') {
      const entry = entries[ruling.id];
      if (!entry) {
        failures.push({ ruling, reason: `target id "${ruling.id}" does not exist` });
        continue;
      }
      if (entry.status === 'FROZEN') {
        skips.push({ id: ruling.id });
        continue;
      }
      // Plan auto-alignment if challenged_by empty; freeze either way.
      const challengedByEmpty = !Array.isArray(entry.challenged_by) || entry.challenged_by.length === 0;
      const plan = challengedByEmpty ? 'freeze-with-align' : 'freeze';

      // Project the post-alignment state and verify it would satisfy the
      // maturity gate. Without this, a can_freeze:false category (risk,
      // discarded_option, challenged_claim) would pass pre-validation, then
      // throw during execute AFTER the aligned_by update has already been
      // appended — a partial write. See spec §5.1 step 4.
      const projected = (plan === 'freeze-with-align')
        ? { ...entry, aligned_by: [...(entry.aligned_by || []), TOKEN_STAGE_H] }
        : entry;
      try {
        checkMaturityGate(projected);
      } catch (err) {
        failures.push({ ruling, reason: err.message });
        continue;
      }

      toExecute.push({ ruling, plan });
      continue;
    }

    if (ruling.action === 'supersede') {
      const oldEntry = entries[ruling.supersedes];
      if (!oldEntry) {
        failures.push({ ruling, reason: `supersedes target "${ruling.supersedes}" does not exist` });
        continue;
      }
      if (oldEntry.status !== 'FROZEN') {
        failures.push({ ruling, reason: `supersedes target "${ruling.supersedes}" must be FROZEN (is ${oldEntry.status})` });
        continue;
      }
      if (entries[ruling.id]) {
        failures.push({ ruling, reason: `new id "${ruling.id}" already exists` });
        continue;
      }
      if (!ruling.content || !ruling.category) {
        failures.push({ ruling, reason: `supersede ruling missing content or category` });
        continue;
      }
      toExecute.push({ ruling, plan: 'supersede' });
    }
  }

  if (failures.length > 0) {
    const msg = failures.map(f => {
      const rid = f.ruling.id || (f.ruling.supersedes ? `supersede(${f.ruling.supersedes})` : '<unknown>');
      return `  - ${rid}: ${f.reason}`;
    }).join('\n');
    throw new Error(`apply-h-rulings pre-validation failed:\n${msg}`);
  }

  // Execute — mutations happen here. Failures above guarantee this phase writes
  // no partial events.
  for (const item of toExecute) {
    const { ruling, plan } = item;
    if (plan === 'freeze-with-align') {
      update(root, { id: ruling.id, field: 'aligned_by', value: TOKEN_STAGE_H });
      freeze(root, { id: ruling.id });
    } else if (plan === 'freeze') {
      freeze(root, { id: ruling.id });
    } else if (plan === 'supersede') {
      supersede(root, {
        id: ruling.id,
        supersedes: ruling.supersedes,
        category: ruling.category,
        content: ruling.content,
        source: ruling.source || 'h-review',
        rationale: ruling.rationale || null,
      });
    }
  }

  return {
    applied: toExecute.map(t => ({
      id: t.ruling.id,
      action: t.ruling.action,
      autoAligned: t.plan === 'freeze-with-align',
    })),
    skipped: skips,
  };
}

module.exports = {
  stageGFreezeGate,
  applyHRulings,
  TOKEN_STAGE_G,
  TOKEN_STAGE_H,
};
