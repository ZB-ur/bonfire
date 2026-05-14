---
title: Bonfire Maturity Assessment v2 (placeholder)
parent: 2026-05-04-bonfire-maturity-assessment.md
trigger: errata-001 (ASSERTION-4 calibration kill-criterion)
status: placeholder-pending-round-4
---

# Maturity Assessment v2

This file is a placeholder. The v1 assessment at `2026-05-04-bonfire-maturity-assessment.md` was sufficient charter for ASSERTION-4 round 1-3, but round 3 plan execution falsified its row #1 scope assumption ("Layer 2b false-positive softening can be addressed by ASSERTION-4 in current scope"). Errata 001 records the empirical falsification.

## Status of v1 rows under v2

| v1 row | v1 decision | v2 status |
|---|---|---|
| #1 (Layer 2b false-positive softening) | in-scope:ASSERTION-4 | **OPEN — ASSERTION-4 round 4 required; metric class itself in question** |
| #2 (substantive-slot vacuous-pass) | in-scope:ASSERTION-4 | OPEN — Layer M was implemented (Task 7 not run; design intact); folds into round 4 |
| #4 (auto-id) | in-scope:ASSERTION-4 | OPEN — implementation not run; recoverable from round-3 plan |
| #5 (discard ruling enum) | in-scope:ASSERTION-4 | OPEN — implementation not run; recoverable from round-3 plan |
| #8 (supersede error msg + skill doc) | in-scope:ASSERTION-4 | OPEN — implementation not run; recoverable from round-3 plan |
| #3, #6, #7 (deferred) | defer:ASSERTION-5 | Unchanged |

## v2's job

Round 4 spec re-cut feeds INTO v2, not v2 feeding into round 4. v2 will be written AFTER round 4 spec is frozen, capturing the post-round-4 in-scope set + any new interventions surfaced by errata-001's empirical evidence.

Until round 4 ships, this file remains a placeholder with the table above as v2's only binding content.

## Cross-reference

- v1: `2026-05-04-bonfire-maturity-assessment.md` (frozen as historical record)
- v1 errata: `2026-05-04-bonfire-maturity-assessment-errata.md` (no entries; v1 was internally consistent)
- ASSERTION-4 spec round 3: `2026-05-04-bonfire-assertion-4-design.md` (frozen-as-historical, see its own frontmatter)
- ASSERTION-4 errata: `2026-05-04-bonfire-assertion-4-errata-001.md` (canonical halt record)
- ASSERTION-4 plan round 3: `docs/superpowers/plans/2026-05-06-bonfire-assertion-4-implementation.md` (halted at Task 4; Tasks 5-15 abandoned)
