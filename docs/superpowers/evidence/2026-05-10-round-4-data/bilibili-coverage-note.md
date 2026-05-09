# Bilibili-clean coverage note (Stage 0b)

**Date:** 2026-05-10
**Archive:** `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/.bonfire/plan/compile-output.json`
**Round-4 Stage 0b purpose:** cross-archive validation per B010 ≥2-dogfood binding (errata-001 Seed 3).

## Finding: 0 substantive Layer 2b slot data contributed

Inspected bilibili-clean compile-output.json shape:

| Field | Value | Layer 2b relevance |
|---|---|---|
| `domain_model.entities` | `[]` (empty array) | 0 walkable slots |
| `function_contracts` | `0 items` | 0 walkable slots |
| `data_contract` | `{source_kind, source_ref}` provenance only | not collection-walked |
| `ui_contract.surfaces` | empty/vacuous | 0 walkable panels |
| `handoff_summary` | 1239 chars substantive prose | top-level field, no `source_ref`, NOT walked by analyze.js |
| `retained_goal` | 432 chars substantive prose | top-level field, no `source_ref`, NOT walked |

The Layer 2b token-coverage analyzer (`analyze.js` walk function) iterates collection-typed slots with `source_ref` (function_contracts, domain_model.entities, ui_contract.panels). Bilibili-clean has 0 such slots — all collection slots are empty per B2 vacuous-pass attack surface that 3a closed.

The prose-bearing fields (handoff_summary, retained_goal) are top-level strings without `source_ref`, so they're outside Layer 2b's per-slot precision evaluation domain.

**Net contribution to round-4 calibration: 0 slot-level data points.**

## Why this is consistent with 3a Phase 5 regression matrix

Phase 5 commit `427bf65` (3a) closed B2 vacuous-pass at handoff_substantive_slots. After 3a, vacuous J handoffs reject at deep-check before reaching Layer 2b. Bilibili-clean archive predates 3a; its vacuous shape is preserved as historical empirical evidence of the closed attack pattern, NOT as input to round-4 Layer 2b precision calibration.

Future dogfood archives running with 3a-active will be FORCED by the deep-check to populate substantive slots. Those future archives WILL provide Layer 2b slot data, contributing to ≥2-archive accumulation.

## B010 binding status under (B) phased approach

Per round-4 (B) phased decision (architect dialectic 2026-05-10):
- gto-trainer (2026-05-04): N=1 substantive archive, 9 legit slots
- bilibili-clean (2026-05-08): N=0 substantive Layer 2b contribution
- B010 ≥2-archive requirement: **NOT satisfied** for positive threshold calibration
- Round-4 spec response: provisional threshold from N=1 archive, contract clause "revisable upon ≥2 substantive archive accumulation"

This file documents the empirical justification for the phased approach. It is **NOT a deficiency** — Seed 3 verbatim "N=1 enough to falsify, ≥2 needed for positive calibration" anticipates exactly this asymmetry.

## Cross-reference

- `gto-trainer-distribution.json` — N=1 archive distribution data
- `distribution-analysis.md` — Stage 0c synthesis + Stage 1 dialectic input
- `2026-05-04-bonfire-assertion-4-errata-001.md` — Seed 3 binding for B010
- `2026-05-08-bilibili-danmaku-findings.md` — finding #19 documents bilibili B2 vacuous-pass that 3a closed
