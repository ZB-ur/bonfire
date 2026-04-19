'use strict';

const path = require('path');
const { loadSnapshot, update, freeze } = require('./truth-surface.cjs');

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

  for (const [id, entry] of Object.entries(entries)) {
    if (entry.category === 'high_impact_risk') {
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

module.exports = {
  stageGFreezeGate,
  TOKEN_STAGE_G,
  TOKEN_STAGE_H,
};
