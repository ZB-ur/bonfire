# Round-4 Stage 0c distribution analysis

**Date:** 2026-05-10
**Stage 0 wrap-up + Stage 1 dialectic input**

**Empirical scope per (B) phased decision (architect dialectic 2026-05-10):**
single-archive distribution characterization from gto-trainer 2026-05-04 dogfood; bilibili-clean 2026-05-08 contributes 0 Layer 2b slot data per B2 vacuous-pass shape (see `bilibili-coverage-note.md`).

**Round-4 mandate scope:** (i) Layer 2b precision recalibration; L4 detection out-of-scope (architect ratify 2026-05-10).

## 1. Empirical reality check vs Seed 1 hypothesis

Errata Seed 1 hypothesis (line 71-72):
> "Legit slots: max run typically 1–2 tokens"
> "Invention slots: max run 4+ tokens"

Stage 0a empirical (gto-trainer 9 legit slots):

| Statistic | max_contiguous_orphan_run | overlap_ratio |
|---|---|---|
| min | 10 | 0.124 |
| p25 | 12 | 0.147 |
| median | 23 | 0.198 |
| p75 | 25 | 0.332 |
| p95 | 35 | 0.471 |
| max | 35 | 0.471 |
| mean | 20.67 | 0.250 |
| iqr | 13 | 0.185 |

**Seed 1 hypothesis falsified on absolute scale**: legit max_run min=10 (not 1-2). The hypothesis's intuition about prose patterns underestimated the legit J-Compile elaboration baseline. J-Compile naturally adds 10+ token elaboration runs over ledger source content (purpose/invariants/failure_modes prose vs single ledger `content` field).

**However, the relative-separation question remains open**: with 0 invention slots in the archive, we cannot empirically test whether invention max_run > legit max_run.

## 2. Per-class distribution

| Class | Slot count | max_run distribution | overlap_ratio distribution |
|---|---|---|---|
| Legit-paraphrase | 9 | min=10, median=23, p95=35 | min=0.124, median=0.198, p95=0.471 |
| Invention | 0 | n/a | n/a |
| Excluded (transitive paraphrase) | 2 | n/a | n/a |

Invention slot count = 0 because:
- spec §1 keyword anchor (`board texture`, `hand-strength tier`, etc.) matched 0 slots in archive — the cited inventions originate from FAILED j-compile attempts that are not logged anywhere in `bonfire-test/gto-trainer/.bonfire/archive/`
- per round-3 dialectic, all 9 surviving slots categorized legit-paraphrase; my Stage 0a inspection confirms

## 3. Outlier-edge detection (gap-based)

Sorted legit max_run values: `[10, 12, 12, 19, 23, 23, 25, 27, 35]`
Adjacent gaps between distinct values: `[2, 7, 4, 2, 2, 8]`
Average adjacent gap: 4.17
Outlier gap threshold: 4.17 × 1.5 = 6.25
Top-down rightmost gap > threshold: 27→35 (gap=8)

**Outlier-edge slot:**
- **CON-036 (ui_panel)**: max_run=35, ratio=0.146

Per (B) refinement (architect dialectic 2026-05-10): outlier-edge slots are NOT dismissed; CON-036 is treated as **threshold-edge fixture** for spec, expected behavior reviewed at ≥2-archive accumulation milestone.

## 4. Distribution shape characterization

```
max_contiguous_orphan_run distribution (gto-trainer 9 legit slots):

10  12  12      19      23 23  25  27              35
●   ●●          ●       ●●     ●   ●               ●
                                                   ↑ outlier-edge (CON-036)

main cluster: 10-27 (8 slots, p75=25)
isolated peak: 35 (1 slot, gap=8 from second-highest)
```

Cluster shape: bimodal-with-isolation. 8 slots cluster between 10-27 (left mode), 1 slot at 35 (right mode, isolated).

If 35 represents legit upper-bound, threshold formula `p95 + safety` overstates protection (single-slot anchor); `p75 + safety` under-protects (excludes meaningful spread).

## 5. Stage 1 dialectic input — metric class verdict

### 5.1 max_contiguous_orphan_run as metric class candidate

**Pro:**
- Distribution has finite shape (9 slots cluster 10-27 + 1 outlier 35)
- p75=25 + safety provides actionable threshold formula
- Replaces overlap_ratio's 0.124-0.471 spread (no working threshold per Seed 1 line 51)

**Contra:**
- Single-archive data; B010 cross-project validation deferred per (B) phased
- Outlier-edge of 1 slot adds threshold-formula complexity
- No invention-class empirical data → false-negative rate unknown
- Seed 1 absolute-scale hypothesis falsified (legit min=10, not 1-2) — suggests metric is not as cleanly separating as Seed 1 imagined

### 5.2 Threshold formula per (B-refined)

Per architect dialectic 2026-05-10:
- **Anchor**: p75 not max (avoid outlier-anchoring; CON-036 is borderline fixture not calibration anchor)
- **Formula**: `threshold = p75(observed_legit_corpus) + safety_margin`
- **Current value**: from gto-trainer p75=25, safety_margin TBD (Stage 2 dialectic sub-decision)
- **Asymmetry rationale**: false-negative cost (invention escapes → coder invents semantics → core promise breaks) > false-positive cost (legit prose flagged → operator escape valve / rewrite); bias toward conservative

### 5.3 CON-036 fixture status

Spec §7.x candidate: include CON-036 as `threshold-edge-legit` fixture. Three possible interpretations of its outlier status are unfalsifiable with N=1:

| Interpretation | Implication |
|---|---|
| CON-036 is legit-but-elaborate prose | spec false-positive; operator uses escape valve or rewrites |
| CON-036 contains invention-adjacent content slipped through round-3 Layer 2b | round-4 retroactively catches round-3 miss — positive signal |
| CON-036 is mid-density legit (between norm and invention) | spec hints author to write tighter prose; friction controllable |

Spec contract: "CON-036 fixture revisited at ≥2-substantive-archive accumulation". Until then, treat as edge case acknowledged, not adjudicated.

## 6. Stage 1 dialectic open questions

**Q1 (metric class)**: Adopt `max_contiguous_orphan_run` as primary metric, OR seek different metric class? Seed 1 hypothesis falsified on absolute scale but distribution shape is still tractable. Verdict needed before Stage 2.

**Q2 (overlap_ratio fate)**: With max_contiguous adopted, what happens to overlap_ratio? Three options:
- (i) Drop entirely (Seed 1 spirit "non-isomorphic alternative")
- (ii) Retain as secondary diagnostic (no enforcement, telemetry only)
- (iii) Retain as conservative cross-check ("reject if max_run > threshold OR ratio < some-floor") — but this risks Seed 1 violation by re-introducing ratio as validator rather than diagnostic

**Q3 (safety_margin parameterization)**: Stage 2 sub-decision but conceptually constrains Stage 1 closure. Given asymmetry (FN > FP), what magnitude? Examples:
- p75 + 20% = 30 (~conservative tilt minor)
- p75 + 50% = 38 (~moderate; flags CON-036 + future borderline)
- p75 + 100% = 50 (~heavy conservative; permits much elaboration before flag)

**Q4 (CON-036 spec status)**: Confirm `threshold-edge-legit` fixture status; spec name; review milestone.

**Q5 (B010 contract clause)**: Verify spec wording for "revisable upon ≥2-substantive-archive accumulation" — what triggers a review? what triggers a threshold update?

## 7. Cross-reference

- `analyze-round-4.js` — Stage 0a script (extends round-3 with max_contiguous + invention-keyword tagging + gap-based outlier detection)
- `gto-trainer-distribution.json` — full per-slot data
- `bilibili-coverage-note.md` — Stage 0b 0-contribution explanation
- `2026-05-04-bonfire-assertion-4-errata-001.md` — Seeds 1+2+3 + charter constraints
- `2026-05-04-bonfire-assertion-4-design.md` — round-3 spec (status: invalidated-pending-round-4)
