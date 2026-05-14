# Design: Bonfire ASSERTION-4 Round 4 — Layer 2b Precision Recalibration

**Date:** 2026-05-10
**Status:** Proposed (draft v0.1, awaiting dialectic review)
**Scope:** Round-4 re-cut of ASSERTION-4 Layer 2b precision metric after round-3 calibration kill-criterion fired (5th-pct anchor 0.124 << floor 0.36, gap-width −0.24).

**Charter inputs (binding):**
- `2026-05-04-bonfire-assertion-4-design.md` — round-3 spec, status `invalidated-pending-round-4`
- `2026-05-04-bonfire-assertion-4-errata-001.md` — round-3 calibration halt record + dialectic seeds (Seeds 1+2+3) + charter constraints
- `bonfire-maturity-assessment-v2.md` — placeholder file demoted v1 row #1 to OPEN (per errata)

**Empirical inputs:**
- `docs/superpowers/evidence/2026-05-06-calibration/` — round-3 calibration evidence (raw + analyzed)
- `docs/superpowers/evidence/2026-05-10-round-4-data/` — round-4 Stage 0 distribution analysis (gto-trainer 9-slot legit corpus, bilibili-clean N=0 confirmation, max_contiguous_orphan_run + overlap_ratio per-slot data, gap-based outlier-edge detection)

---

## 1. Frontmatter context

Round-4 is the third dialectic re-cut of ASSERTION-4 Layer 2b precision after round-3 halt at calibration kill-criterion. Round-3 froze a numeric threshold (overlap_ratio ≥ 0.36) under "calibration sub-task with kill-criterion" framing; the calibration empirically falsified the floor (5th-pct legit anchor 0.124 << floor 0.36). Round-4 inherits the dialectic seeds from errata-001 and re-cuts the metric class itself, not the floor value.

Path B sequencing (3a before round-4) completed 2026-05-09 with 3a's 5 phases shipped (architectural commits 57a8441 [Phase 1] ... ca953bc [Phase 5]; final hash chain ac819c9...ca953bc post all autosquash cycles). 3a forced JSON-shape-layer thinking on "what is substantive content" — round-4 now operates at the prose-precision layer where 3a's structural checks pass.

This spec is direct-dialectic (anti-recursion principle: 3a-inherited scope-discipline; no bonfire-pipeline self-application within authoring).

## 1.5 Glossary

| Term | Definition |
|---|---|
| `max_contiguous_orphan_run` | Per-slot metric: longest contiguous run of orphan tokens (tokens in slot text but not in source ledger entry's content tokens), preserving original slot token order. CON-* refs ignored in run computation. Round-4 primary reject_when metric. |
| `overlap_ratio` | Per-slot metric: fraction of slot tokens that overlap with source ledger entry's content tokens (CON-* refs filtered). Round-3 reject_when metric, falsified during round-3 calibration. Round-4 retained as **telemetry-only** (compute + log, NOT in reject decision). |
| `p75` | 75th percentile of a distribution. Used in round-4 threshold formula `threshold = p75 + safety_margin`. |
| `safety_margin` | Multiplicative percentage above p75 baseline. Round-4 v0.1 fixed at 20% (`threshold = p75 × 1.20`). Cost-asymmetry-conservative. |
| `legit-paraphrase` | A J-Compile-produced slot prose that elaborates a ledger entry without inventing semantics. Default classification for J-handoff slots that survive Layer 2a provenance check. |
| `invention` | A J-Compile-produced slot prose whose semantic content is not derivable from any frozen ledger entry — the bonfire core promise violation. Round-4 detection target. |
| `burst-shape invention` | Invention pattern where invented prose appears as contiguous bursts of domain-specific tokens (e.g., "monte-carlo simulator pre-scored heatmap"). Round-4 metric class targets this shape. |
| `sprinkled invention` | Invention pattern where invented tokens are distributed throughout legit prose with short individual runs. **Out-of-scope for round-4** (see §4 mandate caveat + §11 risk + §10 DQ). |
| `substantive-slots-count` | Per-archive count of slots that survive Layer 2a substantive_slot_refs provenance check (i.e., slots with valid `source_ref` resolving to a FROZEN ledger entry). Used in B010 ≥5-slot minimum for archive contribution. |
| `outlier-edge slot` | A slot whose metric value is gap-isolated from the main distribution cluster (gap-from-next-lower > 1.5 × avg adjacent gap, top-down rightmost gap algorithm). Round-4 spec fixture status: not dismissed, treated as review-trigger anchor at ≥2-archive accumulation milestone. |
| `provisional threshold` | Threshold derived from N=1 archive corpus (gto-trainer 9-slot). Validated → permanent baseline upon ≥2-substantive-archive accumulation per S2.4 mechanical condition. |
| `validated threshold` | Threshold that has been re-derived via S2.1 aggregation rule from ≥2 substantive archives. "Validated" is binary mechanical (data condition met + aggregation applied), NOT absence-of-evidence-of-failure. |

## 2. Context

Bonfire's foundational design promise: **frozen constraints are the only input to code**. The /code stage must not invent product semantics. Layer 2b is the prose precision layer that, paired with Layer 2a structural provenance, defends this promise on the H→J seam.

PR #2 (Apr 2026) shipped Layer 2b as a token-coverage diff comparing handoff-side substantive tokens against the FROZEN ledger lexicon. Round-1 of ASSERTION-4 surfaced that PR #2's Layer 2b is too strict — false-positive rate on legitimate English/Chinese/path tokens (gto-trainer + bilibili-clean both surfaced >100 orphans on normal prose) made "submit substantive conditions" the high-cost path, pushing operators onto vacuous-pass paths (which 3a then closed).

Round-2 + round-3 dialectic produced a calibration sub-task with kill-criterion that allowed round-3 to freeze a tentative floor value (0.36) pending empirical verification. The calibration j-compile dispatch on 2026-05-06 fired the kill-criterion: 5th-pct legit anchor 0.124 << 0.36, gap-width −0.24. Errata-001 documents the halt + canonical seeds for round-4.

Round-4 charter (per errata-001):
1. **Seed 1** — replace `overlap_ratio` with `max_contiguous_orphan_run` (non-isomorphic alternative, not re-parameterization)
2. **Seed 2** — fixture lattice's "tagged-correct-but-invents" 36% is thought-experiment, not empirical; round-4 must take real invention examples from archives
3. **Seed 3** — N=1 dogfood enough to falsify, ≥2 needed to positive-calibrate (B010 promoted from backlog informational to spec main-clause requirement)

Round-4 architect dialectic 2026-05-10 added (B) phased commitment: spec converges metric class + methodology now; concrete threshold provisional from N=1 (gto-trainer); validated upon ≥2-substantive-archive accumulation.

## 3. Problem

Round-3 Layer 2b reject_when uses `overlap_ratio < threshold` with threshold=0.36 (frozen-with-bounded-calibration). Round-3 calibration empirically falsified this:

**Empirical record (per round-3 calibration evidence + round-4 Stage 0a):**

| Statistic | overlap_ratio (gto-trainer 9 legit slots) | max_contiguous_orphan_run (same corpus) |
|---|---|---|
| min | 0.124 | 10 |
| p25 | 0.147 | 12 |
| median | 0.198 | 23 |
| p75 | 0.332 | 25 |
| p95 | 0.471 | 35 |
| max | 0.471 | 35 |

**Round-3 problem (overlap_ratio):** 4× internal range (0.124–0.471) means any single ratio threshold either false-positives legit (threshold too high) or false-negatives invention (threshold too low). The metric class itself lacks discriminating power within the legit distribution, before considering invention.

**Round-4 candidate metric (max_contiguous_orphan_run):** Distribution shape is bimodal-with-isolation — main cluster 10-27 (8 slots, p75=25), isolated peak 35 (CON-036 ui_panel). The shape supports threshold anchoring at p75 + safety_margin (avoiding outlier-anchoring at max=35).

*Note on small-sample artifact:* with N=9 corpus, p95 ≈ max statistically (both equal 35); p75 (=25) is the more meaningful baseline statistic for this corpus size. Threshold formula uses p75 explicitly to anchor away from the outlier peak. Upon ≥2-archive accumulation, p75 distribution shape across archives becomes the more stable baseline.

**Round-4 problem framing:** Replace the invalidated overlap_ratio reject_when with max_contiguous_orphan_run reject_when. Threshold provisional from N=1 archive baseline; revisable upon ≥2-archive accumulation.

## 4. Mandate scope

Round-4 mandate is **strict Layer 2b precision recalibration**. L4 attack-class detection (prose-rich semantically-vacuous content beyond burst-shape invention) is **out-of-scope**.

**Burst-shape dependency caveat (binding):** The max_contiguous_orphan_run metric class is effective IFF invention manifests as max_contiguous bursts longer than legit prose scaffolding. Non-burst invention patterns (sprinkled, distributed) WILL escape this metric — round-4 mandate explicitly limited to burst-pattern detection. Sprinkled-invention coverage is OOS; if observed in post-deployment dogfood, **triggers amendment, not breach**.

**Reasons for narrow scope:**
- Errata Seed 1+2+3 are framed as metric/calibration discipline + empirical anchor + cross-project validation. None proposes new attack-class coverage.
- Round-3 dialectic burned 3 rounds; mandate expansion → round-5 risk.
- 3a deferred L4 to "round-4 territory" as descriptive of prose-precision territory, NOT promise of mandate. Round-4 mandate is defined by errata, not by 3a's table at §1 line 77.
- If max_contiguous incidentally catches L4 inventions cleanly in post-deployment dogfood, that's an "incidental coverage observation" worthy of spec backlog — NOT round-4 reject_when expansion.

## 5. Mechanism

**Round-4 REPLACES PR #2's binary `orphans.length > 0` reject (Layer 2b foundation, currently at `bin/lib/schema.cjs:181`) with `max_contiguous_orphan_run > threshold` reject_when. This also supersedes round-3's `overlap_ratio < threshold` spec intent (which never reached code due to round-3 calibration halt — round-3 was halted at calibration before implementation). Layer 2b reject path becomes single-metric (max_contiguous), not two-metric ensemble or binary presence-check. `overlap_ratio` (the round-3-intended metric class) is retained as telemetry-only: compute + log, NOT in reject decision.**

**Per-slot metric computation:**

```
For each slot s with source_ref → ledger entry e:
  slot_tokens = extractSubstantiveTokens(s.slot_text)  // existing helper
  src_tokens = Set(extractSubstantiveTokens(e.content))
  orphan_run = 0
  max_orphan_run = 0
  for tok in slot_tokens:
    if isConRef(tok): orphan_run = 0; continue  // CON-* refs ignored
    if tok in src_tokens: orphan_run = 0
    else: orphan_run += 1; max_orphan_run = max(max_orphan_run, orphan_run)
  // max_orphan_run is the metric value for this slot
```

**Reject decision:**

```
slot.max_contiguous_orphan_run > threshold  →  reject_when fires
```

**Telemetry (no enforcement, compute-only in v0.1):**

```
slot.overlap_ratio = ...                   // compute per round-3 method
// v0.1 ships compute-only; no runtime persistence layer (rationale below)
```

Telemetry retention rationale: (a) data continuity for future amend if Q1 burst-shape caveat surfaces sprinkled-invention — historical archives can be re-analyzed via `analyze-round-4.js` at amend time, NOT requiring runtime persistence; (b) Seed 1 spirit of "non-isomorphic alternative" preserves `overlap_ratio` as alternative metric class for future re-evaluation; (c) zero implementation cost since `extractSubstantiveTokens` already runs (compute-only). Persistence layer is deferred to post-deployment empirical trigger per Q5 §6.4 procedure: if a telemetry consumer materializes (e.g., automated cross-archive trend detection), persistence is amend-able via schema PR + code amendment, but v0.1 does not pre-build that infrastructure (operational complexity — file path / rotation / collection — without immediate consumer).

## 6. Calibration

### 6.1 Schema-driven configuration (committed)

Round-4 calibration parameters are configured in `schemas/bonfire-v1.json` under a new top-level `layer_2b_calibration` section. Code in `bin/lib/schema.cjs` (Layer 2b walk + reject decision; co-located with Layer 2a + 3a deep-check per 3a Phase 2 architecture discovery) reads from this schema config; helper functions (`compareTokens` existing, new `maxContiguousOrphanRun` per §5) live in `bin/lib/seam-validation.cjs`. Parameters can be amended via schema PR without code change.

**Rationale (per architect dialectic 2026-05-10):**
- Q5 revisability contract works cleanly with schema PR (not code change)
- Consistency with 3a's `verdict_substantive_check` schema-driven pattern (Phase 4 ship)
- Calibration accumulation = data amend, not code amend

**Schema config v0.1:**

```json
"layer_2b_calibration": {
  "version": 1,
  "metric_class": "max_contiguous_orphan_run",
  "telemetry_metrics": ["overlap_ratio"],
  "threshold_provisional": 30,
  "threshold_status": "provisional",
  "p75_baseline": 25,
  "safety_margin_pct": 20,
  "aggregation_method": "median_per_archive_p75",
  "revisability_delta_pct": 25,
  "min_slots_per_archive": 5,
  "calibration_corpus_anchor": "gto-trainer-2026-05-04 N=1"
}
```

**Source-of-truth contract (binding):** `p75_baseline` + `safety_margin_pct` are the canonical inputs. `threshold_provisional` is a convenience-cached derived value: `threshold_provisional = round(p75_baseline × (1 + safety_margin_pct / 100))`. When amending baseline or safety_margin, code MUST recompute `threshold_provisional` and update both fields atomically in the same schema PR. Implementations SHOULD assert consistency at load time (`assert(threshold_provisional == round(p75_baseline × (1 + safety_margin_pct / 100)))`) and log a warning if drift detected. This binding prevents calibration-amendment race where p75_baseline updates without threshold_provisional, leaving stale numeric reject value in production.

### 6.2 Threshold formula

```
threshold = round(p75_baseline × (1 + safety_margin_pct / 100))
          = round(25 × 1.20)
          = 30
```

`p75_baseline` is derived per S2.1 aggregation rule from the calibration corpus.

### 6.3 Aggregation methodology (S2.1)

- **N=1 archive case (current):** `p75_baseline = p75(gto-trainer-archive-substantive-slots)` = 25
- **N≥2 archives case:** `p75_baseline = median(per-archive p75 set)` — robust to single-archive outlier; cost-asymmetry-aligned (avoids high-p75 archive dominance pushing threshold up = more FN)

**Why median, not max:** max(per-archive p75) inflates threshold under outlier archive presence (e.g., one prose-heavy domain with p75=45 → threshold ~57+ → invention 25-56 slip through). median is robust to single-archive outlier; per-archive p75 already gives equal weight (no slot-count-based dominance), so median collapses fairly.

**Why median, not pooled-corpus p75:** pooled-corpus p75 lets large archives dominate by slot count. Each archive contributing an independent p75 statistic preserves cross-project validity.

### 6.4 Revisability methodology (S2.2)

**Adjudication authority:** All "adjudicated as X" trigger references in this section assume **spec author** as adjudicator (consistent with §6.4 procedure step 3 below + Q5 human-in-loop binding). No automated adjudication; no operator-self-adjudication.

**Trigger conditions (any one suffices for amendment proposal):**
1. **Cross-project shape change:** When ≥2 substantive archives accumulated, if `median(per-archive p75) - p75_baseline_current` exceeds 25% of `p75_baseline_current`, propose threshold update.
2. **Breach observation (Q5):** Post-deployment archive shows legit slot rejected (`max_contiguous_orphan_run > threshold` and operator did NOT invoke escape valve and slot is adjudicated by spec author as legit-paraphrase) — propose threshold raise.
3. **Invention escape:** Post-deployment archive contains slot adjudicated by spec author as invention that passed (`max_contiguous_orphan_run ≤ threshold`) — propose threshold lower OR mandate amend per §4 if sprinkled-invention pattern.

**Procedure:**
1. Operator runs `analyze-round-4.js` (or equivalent post-deployment analyzer) on new archive.
2. Analyzer outputs delta vs current baseline + emits review-trigger marker.
3. Spec author opens human PR (spec amend commit) referencing empirical evidence; not automated change.

**Human-in-loop binding:** No automated threshold updates. All amendments via PR review.

### 6.5 Provisional → validated transition (S2.4)

**Validated** is a binary mechanical state:
- Data condition met: ≥2 substantive archives accumulated (per S2.5 ≥5-slot rule)
- Aggregation rule applied: `p75_baseline = median(per-archive p75 set)`

When both conditions hold, `threshold_status` schema field is amended `provisional` → `validated`. The aggregated `p75_baseline` may differ from N=1 baseline (revisability §6.4).

**Tag transition is performed by spec author manually via schema PR** upon detecting ≥2-archive condition met. No automated transition; consistent with human-in-loop binding (§6.4). This avoids race where automated tag flip from incomplete or contaminated archive accumulation locks in a baseline before manual review.

**"Validated" is NOT absence-of-evidence-of-failure.** Q5 amendment triggers (§6.4) operate independently of validation status. Validated thresholds remain perpetually amendable per breach observations.

### 6.6 Minimum archive contribution (S2.5)

An archive contributes to the calibration corpus iff `count(substantive-slots) ≥ 5` (slots surviving Layer 2a provenance check). Archives below the threshold are excluded from calibration-corpus aggregation but remain valid evidence for other purposes (attack-pattern reproduction, regression testing, dogfood findings).

**Statistical rationale:** N=5 yields p75 = 4th sorted value with at least one data point below + above; minimum viable distribution shape. N<5 collapses p75 to max-equivalent statistic, undermining aggregation.

**Exclusion ≠ devaluation:** bilibili-clean (N=0 substantive Layer 2b slots per Phase 5 bilibili-coverage-note) is excluded from calibration corpus but retained as B2 vacuous-pass attack-pattern reproduction anchor in 3a Phase 5 regression matrix.

### 6.7 Invention fixture creation procedure (forward-looking)

Round-4 v0.1 ships with **0 invention fixtures** in spec acceptance criteria — the gto-trainer 2026-05-04 archive (sole calibration corpus N=1) contains 0 invention slots (cited inventions originate from FAILED j-compile attempts not logged in archive history; see Stage 0 distribution analysis). This is a **known limitation, not a deferral-without-exit-criterion**.

**Fixture creation trigger (binding 3 mechanical conditions, all must hold):**
1. A post-deployment dogfood produces J-Compile output where round-4 reject_when fires on a slot (`max_contiguous_orphan_run > threshold`).
2. Operator does NOT invoke the escape valve (`no_substantive_oversight: true` is NOT set; slot is not declared legit-with-override).
3. Spec author manually adjudicates the rejected slot as confirmed invention (not false-positive legit prose).

**Upon trigger,** the rejected slot becomes Class B negative-test fixture in spec amendment (slot text + ledger source ref + per-slot metric values archived in `docs/superpowers/evidence/`). Spec §8 acceptance criteria amended to include the new invention fixture as "MUST reject under threshold=N" assertion.

**Why this procedure is mechanical, not subjective:** all three conditions are observable events. Condition 1 fires automatically (analyzer output). Condition 2 is operator-observable in archive metadata. Condition 3 is spec-author judgment, but constrained to "is this archive prose semantically derivable from any frozen ledger entry, yes/no" — bounded by the same "core promise" definition that motivates the spec.

**Per Seed 2 binding** ("real not thought-experiment"): synthetic invention fixtures are not permitted; only empirical examples from real archives qualify. This procedure is the only path from "0 invention fixtures" to "≥1 invention fixture" in round-4's lifetime.

## 7. Enforcement scope

Round-4 Layer 2b walks **prose-bearing per_entry collections with per-slot `source_ref` provenance**:
- `handoff.function_contracts[]`
- `handoff.domain_model.entities[]`
- `handoff.ui_contract.panels[]`

**Why these three (justification, not history):** 3a's `handoff_substantive_slots` config declares 7 substantive slot kinds (entities, function_contracts, data_contract, ui_contract.{panels, state_ownership, empty_states, error_states}). Of these, only the three above are `kind: "per_entry"` collections of prose-elaborating items with individual `source_ref` per entry. The other four are structural shapes:
- `data_contract` is a `kind: "whole_section"` object (single source_kind + source_ref pair, no per-entry prose).
- `ui_contract.state_ownership` / `empty_states` / `error_states` are lookup maps (key → identifier or short string), not prose elaborations.

Layer 2b's `max_contiguous_orphan_run` metric computes over continuous prose token sequences. Structural shapes (whole-section objects, lookup maps) lack continuous prose to measure max_contiguous on; the metric is **inapplicable**, not under-implemented. Structural slot substantiveness is enforced by 3a deep-check (`isEmptyOrPlaceholder` on required subfields per `handoff_substantive_slots` config).

**Top-level prose non-goal clause:** Top-level fields without per-slot `source_ref` (`handoff_summary`, `retained_goal`, `implementation_scope`, similar) are out of Layer 2b enforcement domain. They are validated by:
- 3a structural deep-check (presence + isEmptyOrPlaceholder on required handoff fields)
- Other mandate-param rules
- OR accepted as out-of-scope per round-4 mandate (i)

This boundary is explicit to prevent future readers from reading "spec missed handoff_summary" as an oversight requiring fix. Round-4 mandate is precision recalibration on per-slot prose elaboration; top-level prose is a different validation surface entirely.

## 8. Acceptance criteria

Round-4 implementation is acceptance-tested against the gto-trainer 2026-05-04 archive (N=1 calibration corpus):

1. **CON-036 (ui_contract.panels[CON-036 ref]) MUST reject** under provisional threshold=30 (observed `max_contiguous_orphan_run`=35 > 30) — outlier-edge anchor.
2. **8 of 9 substantive slots (all non-outlier-edge) MUST pass** under provisional threshold=30 (observed `max_contiguous_orphan_run` ≤ 27 < 30) — corpus-aggregate acceptance.

**Implementation verification:** extend `tests/test-archive-replay.js` with two assertions reusing `analyze-round-4.js` data (script at `docs/superpowers/evidence/2026-05-10-round-4-data/analyze-round-4.js`; pre-computed per-slot output at `docs/superpowers/evidence/2026-05-10-round-4-data/gto-trainer-distribution.json`) + provisional-threshold check.

**CON-036 fixture status:** `threshold-edge-flagged-borderline` legit fixture. Three interpretations (legit-elaborate / round-3-leaked-invention-adjacent / mid-density legit) unfalsifiable with N=1; review at first ≥2-archive accumulation milestone (per S2.4 validation).

## 9. Phased contract

Round-4 ships as **provisional** threshold from N=1 archive empirical baseline. Spec contract clauses:

1. **Provisional → validated:** mechanical binary upon ≥2 substantive archives accumulated + aggregation applied (§6.5).
2. **Q5 revisability:** independent of breach triggers, threshold revisable upon ≥2-substantive-archive accumulation if cross-project median(per-archive p75) differs from current `p75_baseline` by >25% (§6.4 trigger 1).
3. **Breach amendment paths:** legit reject without escape (§6.4 trigger 2) → threshold raise candidate; invention escape (§6.4 trigger 3) → threshold lower OR mandate amend (per burst-shape caveat §4).
4. **Minimum contribution:** archives with substantive-slots-count < 5 excluded from calibration corpus aggregation (§6.6); excluded ≠ devalued.
5. **Human-in-loop:** all amendments via PR review (§6.4). No automated calibration updates.

## 10. Deferred Questions

| ID | Status | Description |
|---|---|---|
| **DQ-1** | DEFERRED | **Sprinkled-invention coverage:** Round-4 mandate (§4) excludes sprinkled invention patterns from reject_when. If post-deployment dogfood observes invention slipping due to short-but-frequent burst pattern, per §6.4 trigger 3 the mandate amends; the metric class itself may need to be revisited (Seed 1 successor candidate). |
| **DQ-2** | DEFERRED | **Aggregation alternative:** §6.3 commits `median(per-archive p75)` for ≥2-archive aggregation. If accumulated data shows median fragility (e.g., bimodal cross-project distribution), alternative aggregations (max-with-outlier-guard, weighted by slot count, ensemble) revisitable. Currently rejected for cost-asymmetry; reverse triggered by empirical evidence only. |
| **DQ-3** | DEFERRED | **Revisability sensitivity:** §6.4 trigger 1 uses 25% delta as cross-project shape-change threshold. Sensitivity TBD with accumulated data. Stricter (15%) → more frequent reviews; looser (50%) → larger drifts before review fires. Adjust upon accumulated data review at ≥3-archive milestone. (Why 3 not 4 not 5: ≥3 archives gives 2 inter-archive deltas — minimum sample for assessing the 25% trigger's empirical sensitivity vs noise across projects.) |
| **DQ-4** | DEFERRED | **Contaminated archives in calibration corpus:** bilibili-contaminated archive (existing in evidence/) — under what conditions can/should it contribute to calibration corpus? Currently grandfathered (excluded by N≥5 rule indirectly + by contamination tagging). Spec amend candidate if future archives surface "partial contamination" gradient. |
| **DQ-5** | DEFERRED | **Schema-driven vs hardcoded for `safety_margin_pct`:** §6.1 commits schema-driven for entire `layer_2b_calibration` section. If schema bloat surfaces operationally (e.g., schema PRs becoming review bottleneck for routine calibration), per-parameter migration to hardcoded reconsideration. Currently rejected for consistency with 3a Phase 4 pattern. |
| **DQ-6** | RESOLVED IN ROUND-4 | **Metric class falsification:** errata Seed 1 hypothesized "max_contiguous separates legit (1-2 tokens) from invention (4+ tokens)". Stage 0a empirical falsified absolute-scale (legit min=10); however, distribution shape (bimodal-with-isolation) is tractable. Resolution: adopt with §4 burst-shape caveat + Q5 amendment trigger; sprinkled-invention OOS. |
| **DQ-7** | DEFERRED | **CON-036 fixture interpretation:** Three paths (legit-elaborate / round-3-leaked / mid-density). Unfalsifiable with N=1. Resolution upon first ≥2-archive accumulation when CON-036's behavior cross-validates against second-archive analogous slots. |

## 11. Risks and Mitigations

**Risk 1 — Burst-shape hypothesis fails: sprinkled invention escapes.**

Round-4 metric class assumes invention manifests as max_contiguous bursts. If invention patterns are sprinkled (short individual runs, frequent occurrence), `max_contiguous_orphan_run` under-estimates invention density and lets it slip below threshold.

- *Mitigation 1:* §4 explicit caveat declares burst-shape dependency; OOS coverage explicitly limited.
- *Mitigation 2:* §6.4 trigger 3 (invention escape) catches reactive evidence; spec amends mandate per evidence-driven path.
- *Mitigation 3:* `overlap_ratio` retained as telemetry (§5); telemetry data accumulation supports future amend if sprinkled-invention surfaces and overlap_ratio shows discriminating shape on pooled empirical.
- *Residual risk:* bounded by burst-shape hypothesis validity. No defense within round-4 scope. Ownership: spec author monitors post-deployment for sprinkled-invention reports and triggers amend per Q5 procedure.

**Risk 2 — Cost-asymmetry ship: high false-positive rate causes operator escape-valve abuse.**

Round-4 conservative threshold (30 = p75+20%) flags more legit prose than round-3 floor (which never had a working empirical floor). High false-positive rate → operator routinely invokes `no_substantive_oversight` escape valve → escape valve loses signal value (becomes routine pass rather than exception path).

- *Mitigation 1:* CON-036 outlier-edge boundary chosen empirically not arbitrarily; threshold calibrated to actual distribution shape, not theoretical estimate.
- *Mitigation 2:* §6.4 trigger 2 (legit reject without escape) triggers threshold raise candidate; reactive evidence path.
- *Mitigation 3:* 3a Phase 4 escape-valve `validateLedgerRef` requirement (resolution + FROZEN check) maintains escape-valve integrity even at high invocation rate.
- *Residual risk:* operator behavior cannot be fully predicted; if escape-valve abuse pattern surfaces post-deployment, amendment via Q5 trigger 2 is the empirical path.

**Risk 3 — N=1 calibration baseline overfits gto-trainer prose patterns.**

Provisional threshold 30 derived from gto-trainer 9-slot legit corpus may under-represent legit prose elaboration in different domains (e.g., a backend infrastructure project might have shorter prose; a UI-heavy project longer).

- *Mitigation 1:* §6.5 provisional → validated transition mechanizes baseline re-derivation upon ≥2-archive accumulation.
- *Mitigation 2:* §6.4 trigger 1 (25% cross-project delta) catches systematic shape change.
- *Mitigation 3:* B010 ≥5-slot minimum (§6.6) prevents micro-archives from biasing aggregation.
- *Residual risk:* until ≥2-archive accumulation, single-archive bias is structural. Phased contract acknowledges this honestly.

**Risk 4 — Validation tag bypass: "validated" misread as "permanently safe".**

§6.5 defines validated as binary mechanical (data condition + aggregation applied). A future maintainer might misread validated as "no further amendment needed" and resist reactive amendments.

- *Mitigation:* §6.5 explicit "validated is NOT absence-of-evidence-of-failure"; validated thresholds remain perpetually amendable per Q5.
- *Mitigation 2:* Glossary §1.5 entry pin definition; spec wording unambiguous.

**Risk 5 — Migration risk: stale binary reject path 残留.**

Round-4 implementation in `bin/lib/schema.cjs` MUST remove PR #2's binary `orphans.length > 0` reject at line ~181 AND add `max_contiguous_orphan_run > threshold` reject_when. (Note: round-3's `overlap_ratio < threshold` reject_when never reached code due to calibration halt; the actual stale path is PR #2's binary one.) If implementer leaves stale binary path:
- Both reject paths active → all slots with any orphan still reject (PR #2 binary path), regardless of round-4 threshold. Round-4's intended discrimination is bypassed.
- Reject reason ambiguity in error messages — operator unclear which path fired.
- §8 acceptance criteria fail (8 of 9 corpus-pass criterion fails because PR #2 binary path rejects every slot with ≥1 orphan; round-4's max_contiguous discrimination has no effect).

- *Mitigation 1:* §5 explicit "REPLACES PR #2's binary reject" wording binds removal not augmentation; spec-reviewer should catch stale path during quality review (per Lesson 4 literal-contract verification pattern from 3a Phase 3).
- *Mitigation 2:* Round-4 plan-phase implementation tasks must explicitly call out "remove PR #2 binary reject at schema.cjs:181 before adding round-4 threshold reject" as a checklist item; commit message should cite removal.
- *Mitigation 3:* Acceptance test §8 validates per-slot reject behavior end-to-end on gto-trainer corpus; stale-binary-path bugs would cause 8 of 9 corpus-pass criterion to fail (because PR #2 binary path rejects every slot with any orphan, irrespective of round-4 threshold value).
- *Residual risk:* none if mitigations applied; visible in code diff review.

## 12. Cross-references

**Specs:**
- `2026-05-04-bonfire-assertion-4-design.md` — round-3 spec (status: invalidated-pending-round-4)
- `2026-05-04-bonfire-assertion-4-errata-001.md` — round-3 halt record + Seeds 1-3 + charter constraints
- `2026-04-18-bonfire-hj-seam-hardening-design.md` — Assertion 2 (PR #2) Layer 2a + 2b foundation
- `2026-05-08-bonfire-assertion-3a-validation-theater-design.md` — Assertion 3a (5 phases shipped 2026-05-09); §1 attack-level taxonomy line 77 punts L4 to "round-4 territory" (descriptive of prose-precision territory, not round-4 mandate per §4)
- `bonfire-maturity-assessment-v2.md` — placeholder file demoted v1 row #1 to OPEN per errata

**Evidence:**
- `docs/superpowers/evidence/2026-05-06-calibration/` — round-3 calibration evidence
- `docs/superpowers/evidence/2026-05-10-round-4-data/` — round-4 Stage 0 distribution analysis (this spec's empirical anchor); contains `gto-trainer-distribution.json` analyzed extracts of the gto-trainer dogfood archive
- `bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/` — gto-trainer raw dogfood archive (external to this repo; analyzed extracts in `2026-05-10-round-4-data/` are the canonical spec reference); raw archive retained externally per dogfood-evidence convention
- `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` — second dogfood (3a closure regression matrix anchor; round-4 N=0 contribution per Phase 5 bilibili-coverage-note)

**Memory:**
- `bonfire-project-state.md` — assertion sequencing + round-4 prerequisite history
- `dogfood-2026-05-04-findings.md` — Layer 2b false-positive evidence (finding #1 ASSERTION-4 candidate origin)
- `dogfood-2026-05-08-bilibili-danmaku-findings.md` — bilibili-clean 20 findings + 3a closure context
- `feedback-subagent-execution-discipline.md` — 5 lessons (3a Phase 1-3) including Lesson 4 literal-contract verification + Lesson 5 architect-substitute close pattern (relevant for round-4 implementation phase)

**Code (touched by round-4 implementation):**
- `bin/lib/schema.cjs` — Layer 2b walk + reject decision (line ~181 reject site replaced; co-located with Layer 2a + 3a deep-check per 3a Phase 2 architecture discovery). Round-4 replaces PR #2's binary `orphans.length > 0` reject with threshold-based reject reading from `schema.layer_2b_calibration` config.
- `bin/lib/seam-validation.cjs` — Layer 2b helper functions: existing `compareTokens` retained (returns orphan list, used for new metric + telemetry); new `maxContiguousOrphanRun` helper added; existing `extractSubstantiveTokens` / `classifyAlignedByToken` unchanged.
- `schemas/bonfire-v1.json` — `layer_2b_calibration` new top-level section (per §6.1).
- `tests/test-archive-replay.js` — round-4 acceptance test extension (per §8).

---

**End of round-4 v0.1 spec draft.**

Awaits architect dialectic review (author + reader 二角). v0.1 freeze upon converged review; entry to round-4 plan creation phase parallel to 3a plan-creation pattern.
