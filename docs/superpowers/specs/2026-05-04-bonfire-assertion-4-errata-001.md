---
title: ASSERTION-4 Spec Errata 001
parent: 2026-05-04-bonfire-assertion-4-design.md
date: 2026-05-06
status: spec-invalidated-pending-round-4
trigger: calibration kill-criterion fired during plan Task 4
---

# Errata 001 — calibration kill-criterion fired (round 3 plan, Task 4)

## Trigger

Spec §3.3.3 kill-criterion: two of three pass-flags failed.

| Flag | Pass? | Value |
|---|---|---|
| `passes_minimum_sample` | ✓ | 9 ≥ 6 |
| `passes_anchor_above_floor` | **✗** | 5th-percentile anchor 0.124 ≤ floor 0.36 |
| `passes_gap_width` | **✗** | 0.124 − 0.36 = −0.24 << +0.10 required |

## Empirical record

**N = 9 slots** (gto-trainer 2026-05-04 dogfood archive; 11 total populated, 2 outliers excluded per §3.3.2 substring rule).

**Outliers excluded:**
- `CON-017` (slot referenced source whose `aligned_by = ["g-blue-mitigated-via-CON-026"]` — transitive paraphrase via -via- substring rule)
- `CON-019` (slot referenced source whose `aligned_by = ["stage-e-drop-schema-version-via-CON-024", "g-blue-mitigated-via-CON-027"]` — both EXCLUDE-classified)

**9-slot ratio distribution (sorted):**

```
0.124  CON-020 / FC-002 grade
0.146  CON-036 / PANEL-002 spot-display
0.147  CON-035 / PANEL-001 history-panel
0.189  CON-029 / FC-005 keyboardShortcutHandler
0.198  CON-027 / FC-004 loadStats/saveStats
0.263  CON-034 / FC-003 drawSpot
0.332  CON-036 / FC-006 bootGuard
0.387  CON-030 / FC-007 verifyRangesIntegrity
0.471  CON-026 / FC-001 canonicalize
```

- 5th-percentile anchor: **0.124**
- Spec-mandated floor (tagged-correct-but-invents): **0.36**
- Gap-width: **−0.24** (required ≥ +0.10)

## Inference (binding for round 4)

The 36% "floor" of `tagged-correct-but-invents` was a thought-experiment anchor (5 source tokens / 11 slot tokens), not empirically grounded. **8/9 legit slots score below 36%**, meaning the spec's fixture lattice's "must-fail boundary" actually sits in the middle of the legit distribution.

But the deeper finding (per dialectic round 4 reinforcement) is: **the overlap_ratio metric itself lacks discriminating power**. Legit-paraphrase slots span 0.124–0.471 — a 4× internal range. Any single ratio THRESHOLD applied to this distribution either false-positives legit (THRESHOLD too high) or false-negatives invention (THRESHOLD too low). It is not the case that floor was wrong; it is the case that the metric class is wrong.

## Status changes

| Artifact | Change |
|---|---|
| `2026-05-04-bonfire-assertion-4-design.md` frontmatter `freeze_status` | `frozen-with-bounded-calibration` → `invalidated-pending-round-4` |
| ASSERTION-4 plan (4c46751) | Halted at Task 4. Tasks 5–15 abandoned (not reverted; kept as comparison reference). New plan after round 4 spec re-cut as separate file. |
| `2026-05-04-bonfire-maturity-assessment.md` row #1 (Layer 2b false-positive) | "Addressed-by-ASSERTION-4" → "Open, see maturity-assessment-v2.md" |
| `ASSERTION-5-backlog.md` B010 (≥2 dogfood runs intake) | Promoted from backlog note → spec main-clause requirement for round 4 |

## Round 4 dialectic seeds (carry into spec re-cut, not implementation)

These three seeds are derived from the failed calibration's empirical data. They are NOT decisions — they are starting points for round 4 dialectic. Spec round 4 must run them through full dialectic before any commit.

### Seed 1 — replace `overlap_ratio` with `max_contiguous_orphan_run`

The empirical 9-slot distribution suggests overlap_ratio's failure mode: legit-paraphrase orphans are SPARSE common-English scaffolding (`per`, `uses`, `owns`), distributed throughout the slot. Invention orphans (e.g. dogfood's "monte-carlo simulator pre-scored heatmap") are CONTIGUOUS bursts of domain-specific terms.

A different metric — maximum length of contiguous run of orphan tokens — would naturally separate these:
- Legit slots: max run typically 1–2 tokens
- Invention slots: max run 4+ tokens

This is a non-isomorphic alternative to ratio, not a re-parameterization. Round 4 should explore whether contiguity is the primary signal, ratio is a secondary check, or some combination thereof.

### Seed 2 — fixture lattice's "tagged-correct-but-invents" 36% is thought-experiment, not empirical

The 36% anchor came from hand-counting tokens in a spec-time fixture (5/11). When dogfood empirically measured legit slots, 8/9 fell below this. The fixture lattice was built on an unvalidated assumption.

Round 4 spec re-cut MUST take real invention examples from archives (gto-trainer's failed compile attempts contained known invention shapes — "board textures / hand-strength tiers / mid-range Chinese copy bursts"). Run candidate metrics on them. Anchor fixtures to empirical data, not thought-experiments.

### Seed 3 — N=1 dogfood is enough to falsify, but not enough to positive-calibrate

The current 9-slot data is from a single project (Texas Hold'em GTO trainer, single agent set, single operator). It is sufficient to falsify the 36% floor (negative evidence is monotonic — additional dogfoods will only confirm/deepen the falsification, not reverse it).

Positive THRESHOLD calibration of any new metric requires ≥2 distinct dogfood runs to give cross-project validation. Spec round 4's calibration sub-task MUST mandate ≥2 dogfood runs before THRESHOLD selection. (B010 in ASSERTION-5-backlog already noted "informed by ≥2 dogfood runs"; round 4 promotes this from backlog informational to spec main-clause requirement.)

## Round 4 charter constraints

- Errata 001 IS the new charter input — it supersedes the maturity-assessment §1's row #1 scope statement
- Round 4 spec re-cut may NOT silently re-introduce overlap_ratio as primary metric without engaging Seed 1's contiguity argument
- Round 4 spec re-cut MUST cite this errata file in its frontmatter alongside the maturity assessment
- Round 4 plan executes ONLY after spec round 4 is frozen + user-approved — no parallel work

## Cross-reference

This errata is the canonical halt record. Plan execution state otherwise has no ledger; this file IS the ledger.
