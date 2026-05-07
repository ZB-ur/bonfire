#!/usr/bin/env node
// .bonfire-calibration/analyze.js — one-shot analysis script (gitignored).
// Computes 5th-percentile overlap-ratio anchor from a calibration j-compile
// output, applying §3.3.2 substring-rule outlier exclusion.
// Spec: docs/superpowers/specs/2026-05-04-bonfire-assertion-4-design.md §3.3.

const fs = require('fs');
const path = require('path');
const { extractSubstantiveTokens, classifyAlignedByToken } = require('../bin/lib/seam-validation.cjs');

const RAW_PATH = path.join(__dirname, 'raw-output-2026-05-06.json');
const SNAPSHOT_PATH = '/Users/lddmay/AiCoding/bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/truth-surface/constraint-ledger-snapshot.json';
const OUT_PATH = path.join(__dirname, '2026-05-06-threshold-calibration.json');

if (!fs.existsSync(RAW_PATH)) {
  console.error(`Missing ${RAW_PATH}. Dispatch j-compile calibration first.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

const isConRef = (tok) => /^con-\d+$/i.test(tok);

function ratio(sourceText, slotText) {
  const slot = extractSubstantiveTokens(slotText).filter(t => !isConRef(t));
  const src = new Set(extractSubstantiveTokens(sourceText).filter(t => !isConRef(t)));
  if (slot.length === 0) return 0;
  const overlap = slot.filter(t => src.has(t)).length;
  return overlap / slot.length;
}

const ratios = [];
const excluded = [];
const includeReasons = [];

const handoff = raw.handoff || raw;

const walk = (collection, getSlotText) => {
  for (const slot of (collection || [])) {
    const ref = slot.source_ref;
    if (typeof ref !== 'string') continue;
    const src = snap.entries[ref];
    if (!src) {
      excluded.push({ ref, reason: 'source_ref not in snapshot' });
      continue;
    }
    const cls = classifyAlignedByToken(src.aligned_by);
    if (cls === 'EXCLUDE') {
      excluded.push({ ref, aligned_by: src.aligned_by, reason: 'transitive paraphrase' });
      continue;
    }
    const r = ratio(src.content, getSlotText(slot));
    ratios.push({ ref, slot_id: slot.id || null, overlap_ratio: r });
    includeReasons.push(`${ref} included: aligned_by=${JSON.stringify(src.aligned_by)} ratio=${r.toFixed(3)}`);
  }
};

walk(handoff.function_contracts, s => [s.purpose, ...(s.invariants || []), ...(s.failure_modes || [])].filter(Boolean).join(' '));
walk(handoff.domain_model?.entities, s => Object.values(s).filter(v => typeof v === 'string').join(' '));
walk(handoff.ui_contract?.panels, s => [s.description, ...(s.elements || []), ...(s.states || [])].filter(Boolean).join(' '));

ratios.sort((a, b) => a.overlap_ratio - b.overlap_ratio);
const sample_size = ratios.length;
const p5_idx = sample_size > 0 ? Math.floor(0.05 * sample_size) : -1;
const anchor = p5_idx >= 0 ? ratios[p5_idx].overlap_ratio : null;

const passes_minimum_sample = sample_size >= 6;
const passes_anchor_above_floor = anchor !== null && anchor > 0.36;
const passes_gap_width = anchor !== null && (anchor - 0.36) >= 0.10;

const threshold = (passes_minimum_sample && passes_anchor_above_floor && passes_gap_width)
  ? Math.round((0.36 + 0.01) * 100) / 100  // Lower-bias per §3.2.5: floor + ε
  : null;

const out = {
  calibration_date: '2026-05-06',
  spec_ref: 'specs/2026-05-04-bonfire-assertion-4-design.md §3.3',
  raw_output_ref: '.bonfire-calibration/raw-output-2026-05-06.json (gitignored)',
  source_archive: SNAPSHOT_PATH,
  sample_size_total: ratios.length + excluded.length,
  sample_size_after_outlier_exclusion: sample_size,
  outlier_exclusions: excluded,
  include_reasons_summary: includeReasons,
  ratios_sorted: ratios,
  fifth_percentile_index: p5_idx,
  fifth_percentile_anchor: anchor,
  passes_minimum_sample,
  passes_anchor_above_floor,
  passes_gap_width,
  threshold_picked: threshold,
  policy_note: 'Lower-biased per §3.2.5: floor (0.36) + ε (0.01). Operator override requires explicit rationale.',
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  passes_minimum_sample,
  passes_anchor_above_floor,
  passes_gap_width,
  fifth_percentile_anchor: anchor,
  threshold_picked: threshold,
  sample_size_after_outlier_exclusion: sample_size,
  outliers: excluded.length
}, null, 2));
