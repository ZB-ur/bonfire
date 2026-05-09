#!/usr/bin/env node
// Round-4 Stage 0a: extend round-3 calibration analyzer with
//   (a) max_contiguous_orphan_run metric (Seed 1 candidate)
//   (b) per-slot legit-paraphrase vs invention tagging via spec §1 keyword anchor
// Spec: docs/superpowers/specs/2026-05-04-bonfire-assertion-4-design.md (round-3, invalidated)
// Errata: docs/superpowers/specs/2026-05-04-bonfire-assertion-4-errata-001.md

'use strict';

const fs = require('fs');
const path = require('path');
const {
  extractSubstantiveTokens,
  classifyAlignedByToken,
} = require('../../../../bin/lib/seam-validation.cjs');

const RAW_PATH = path.join(__dirname, '..', '2026-05-06-calibration', 'raw-output-2026-05-06.json');
const SNAPSHOT_PATH = '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json';
const OUT_PATH = path.join(__dirname, 'gto-trainer-distribution.json');

// 3a spec §1 cited invention shapes — empirical anchor for invention tagging.
// Per errata Seed 2: "gto-trainer's failed compile attempts contained known
// invention shapes — board textures / hand-strength tiers / mid-range Chinese
// copy bursts". The third j-compile attempt PASSED into archive after Layer 2b
// loosened; cited inventions originate from FAILED ATTEMPTS that are not
// archived. Keyword-detection in archive yields 0 matches per round-4 Stage 0a
// inspection 2026-05-10 — confirms gto-trainer archive contains 0 invention
// slots. Per round-3 dialectic, all 9 surviving slots categorized legit-paraphrase.
//
// CHINESE-CHAR detection was an initial proxy; first-run inspection rejected
// it as false-positive (gto-trainer is a Chinese-localized trainer; legit UI
// copy / IME composition / localStorage error states contain 中文). Removed.
const INVENTION_KEYWORDS = [
  'board texture',
  'board textures',
  'hand-strength tier',
  'hand strength tier',
  'hand-strength tiers',
  'hand strength tiers',
];

function isConRef(tok) {
  return /^con-\d+$/i.test(tok);
}

function detectInvention(slotText) {
  const lc = slotText.toLowerCase();
  const matchedKeywords = INVENTION_KEYWORDS.filter(k => lc.includes(k));
  return {
    is_invention: matchedKeywords.length > 0,
    matched_keywords: matchedKeywords,
  };
}

function maxContiguousOrphanRun(slotTokens, srcSet) {
  let maxRun = 0;
  let currentRun = 0;
  for (const tok of slotTokens) {
    if (isConRef(tok)) {
      // Ignore CON-* refs in run computation (per round-3 convention)
      currentRun = 0;
      continue;
    }
    if (srcSet.has(tok)) {
      currentRun = 0;
    } else {
      currentRun += 1;
      if (currentRun > maxRun) maxRun = currentRun;
    }
  }
  return maxRun;
}

function overlapRatio(slotTokens, srcSet) {
  const filtered = slotTokens.filter(t => !isConRef(t));
  if (filtered.length === 0) return { ratio: 0, slot_token_count: 0, overlap_count: 0 };
  const overlap = filtered.filter(t => srcSet.has(t)).length;
  return {
    ratio: overlap / filtered.length,
    slot_token_count: filtered.length,
    overlap_count: overlap,
  };
}

function orphanRunList(slotTokens, srcSet) {
  // Diagnostic: list all contiguous orphan runs with their length + first token.
  const runs = [];
  let current = [];
  for (const tok of slotTokens) {
    if (isConRef(tok)) {
      if (current.length > 0) {
        runs.push({ length: current.length, tokens: current.slice(0, 5) });
        current = [];
      }
      continue;
    }
    if (srcSet.has(tok)) {
      if (current.length > 0) {
        runs.push({ length: current.length, tokens: current.slice(0, 5) });
        current = [];
      }
    } else {
      current.push(tok);
    }
  }
  if (current.length > 0) {
    runs.push({ length: current.length, tokens: current.slice(0, 5) });
  }
  return runs;
}

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const handoff = raw.handoff || raw;

const allSlots = [];
const excluded = [];

function walk(collection, getSlotText, slotKind) {
  for (const slot of (collection || [])) {
    const ref = slot.source_ref;
    if (typeof ref !== 'string') continue;
    const src = snap.entries[ref];
    if (!src) {
      excluded.push({ ref, slot_kind: slotKind, reason: 'source_ref not in snapshot' });
      continue;
    }
    const cls = classifyAlignedByToken(src.aligned_by);
    if (cls === 'EXCLUDE') {
      excluded.push({ ref, slot_kind: slotKind, aligned_by: src.aligned_by, reason: 'transitive paraphrase' });
      continue;
    }
    const slotText = getSlotText(slot);
    const slotTokens = extractSubstantiveTokens(slotText);
    const srcSet = new Set(extractSubstantiveTokens(src.content));
    const ratioResult = overlapRatio(slotTokens, srcSet);
    const maxRun = maxContiguousOrphanRun(slotTokens, srcSet);
    const allRuns = orphanRunList(slotTokens, srcSet);
    const inventionTag = detectInvention(slotText);
    allSlots.push({
      ref,
      slot_id: slot.id || null,
      slot_kind: slotKind,
      class_tag: inventionTag.is_invention ? 'invention' : 'legit-paraphrase',
      invention_signal: inventionTag,
      overlap_ratio: ratioResult.ratio,
      slot_token_count: ratioResult.slot_token_count,
      overlap_count: ratioResult.overlap_count,
      max_contiguous_orphan_run: maxRun,
      orphan_runs_summary: {
        total_runs: allRuns.length,
        run_lengths: allRuns.map(r => r.length),
        top_runs: allRuns.sort((a, b) => b.length - a.length).slice(0, 3),
      },
      slot_text_preview: slotText.length > 200 ? slotText.substring(0, 200) + '...' : slotText,
    });
  }
}

walk(
  handoff.function_contracts,
  s => [s.purpose, ...(s.invariants || []), ...(s.failure_modes || [])].filter(Boolean).join(' '),
  'function_contract',
);
walk(
  handoff.domain_model && handoff.domain_model.entities,
  s => Object.values(s).filter(v => typeof v === 'string').join(' '),
  'domain_entity',
);
walk(
  handoff.ui_contract && handoff.ui_contract.panels,
  s => [s.description, ...(s.elements || []), ...(s.states || [])].filter(Boolean).join(' '),
  'ui_panel',
);

// Aggregate per-class distributions
function distributionStats(values) {
  if (values.length === 0) return { count: 0, min: null, max: null, median: null, mean: null };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pickAt = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: pickAt(0.05),
    p25: pickAt(0.25),
    median: sorted[Math.floor(sorted.length / 2)],
    p75: pickAt(0.75),
    p95: pickAt(0.95),
    mean: Math.round((sum / sorted.length) * 100) / 100,
    iqr: pickAt(0.75) - pickAt(0.25),
  };
}

function flagOutlierEdges(slots, distKey) {
  // Gap-based outlier detection: a slot is outlier-edge if the gap between
  // its value and the next-lower distinct value is > 1.5x the average gap
  // between adjacent distinct values. For small N (e.g. 9 slots), strict
  // p95-based detection collapses (max == p95); gap-based is more robust.
  // Per Stage 0a refinement 2026-05-10: outlier-edge slots are NOT dismissed;
  // they become spec-fixture for future ≥2-archive review trigger.
  const sorted = [...slots.map(s => s[distKey])].sort((a, b) => a - b);
  const adjacentGaps = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1]) adjacentGaps.push(sorted[i] - sorted[i - 1]);
  }
  const avgGap = adjacentGaps.length > 0
    ? adjacentGaps.reduce((a, b) => a + b, 0) / adjacentGaps.length
    : 0;
  const outlierGapThreshold = avgGap * 1.5;
  // Find the topmost gap-isolated cluster only (top-end outlier).
  // Scanning from top-down: the first gap > threshold marks the lower bound
  // of the outlier-edge zone. This avoids over-flagging when the distribution
  // has multiple internal gaps (e.g., 12-19 gap of 7 is internal cluster
  // structure; only the 27-35 gap of 8 represents top-end outlier-edge).
  const outlierValues = new Set();
  for (let i = sorted.length - 1; i >= 1; i--) {
    if (sorted[i] - sorted[i - 1] > outlierGapThreshold) {
      for (let j = i; j < sorted.length; j++) outlierValues.add(sorted[j]);
      break;
    }
  }
  for (const s of slots) {
    s.outlier_edge = outlierValues.has(s[distKey]);
  }
  return { avg_adjacent_gap: avgGap, outlier_gap_threshold: outlierGapThreshold, outlier_values: [...outlierValues] };
}

const legit = allSlots.filter(s => s.class_tag === 'legit-paraphrase');
const invention = allSlots.filter(s => s.class_tag === 'invention');

// Mark outlier-edge slots via gap-based detection — these become spec fixtures
// for future ≥2-archive review trigger, not dismiss-or-include binary.
const outlierMeta = flagOutlierEdges(legit, 'max_contiguous_orphan_run');

const out = {
  analysis_date: new Date().toISOString().slice(0, 10),
  spec_ref: 'docs/superpowers/specs/2026-05-04-bonfire-assertion-4-design.md (round-3, invalidated)',
  errata_ref: 'docs/superpowers/specs/2026-05-04-bonfire-assertion-4-errata-001.md',
  source_archive: SNAPSHOT_PATH,
  raw_handoff_ref: RAW_PATH,
  scope: 'Stage 0a: gto-trainer single-archive distribution extraction with metric class candidates',
  invention_keywords: INVENTION_KEYWORDS,
  invention_chinese_check: 'unicode block 4e00-9fff and 3400-4dbf',
  total_slots_analyzed: allSlots.length,
  excluded_count: excluded.length,
  excluded,
  outlier_edge_detection: outlierMeta,
  per_slot: allSlots,
  distributions: {
    legit_paraphrase: {
      slot_count: legit.length,
      max_contiguous_orphan_run: distributionStats(legit.map(s => s.max_contiguous_orphan_run)),
      overlap_ratio: distributionStats(legit.map(s => s.overlap_ratio)),
    },
    invention: {
      slot_count: invention.length,
      max_contiguous_orphan_run: distributionStats(invention.map(s => s.max_contiguous_orphan_run)),
      overlap_ratio: distributionStats(invention.map(s => s.overlap_ratio)),
    },
    all_slots: {
      slot_count: allSlots.length,
      max_contiguous_orphan_run: distributionStats(allSlots.map(s => s.max_contiguous_orphan_run)),
      overlap_ratio: distributionStats(allSlots.map(s => s.overlap_ratio)),
    },
  },
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  total_slots: allSlots.length,
  legit_count: legit.length,
  invention_count: invention.length,
  excluded_count: excluded.length,
  legit_max_contiguous: out.distributions.legit_paraphrase.max_contiguous_orphan_run,
  invention_max_contiguous: out.distributions.invention.max_contiguous_orphan_run,
  legit_overlap_ratio: out.distributions.legit_paraphrase.overlap_ratio,
  invention_overlap_ratio: out.distributions.invention.overlap_ratio,
}, null, 2));
