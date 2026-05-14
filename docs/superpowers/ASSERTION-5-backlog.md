---
title: ASSERTION-5 Backlog
created: 2026-05-04
purpose: Container for items deferred from ASSERTION-4 charter + secondary findings
---

# ASSERTION-5 Backlog

This is a living document, NOT a frozen spec. Append items as discovered. When ASSERTION-5 milestone opens, this file becomes input to its scope-contract step (analogous to ASSERTION-4's maturity-assessment).

## Format

```markdown
### B<NNN> — <one-line title>

**Source:** <maturity-assessment row | dogfood finding | spec dialectic | other>
**Discovered:** <YYYY-MM-DD>
**Kind:** <knowledge | capability | mixed | design>
**Why deferred:** <one line>
**Estimated effort:** <S | M | L>
**Dependencies:** <none | <other-backlog-items> | <ASSERTION-X completion>>
**Notes:** <free text>
```

---

## Items

### B001 — case.json write CLI

**Source:** maturity-assessment row #3
**Discovered:** 2026-05-04
**Kind:** capability
**Why deferred:** Independent of ASSERTION-4 axes; would expand charter without unlocking other in-scope work
**Estimated effort:** M
**Dependencies:** ASSERTION-4 close (so substantive-slots mandate semantics is stable before designing CLI shape)
**Notes:** Stage A/B/C/E/F/G all hand-edit case.json today. New `case-write` command family needs schema validation path. Operator surface inconsistency vs full truth-surface CLI.

### B002 — reentry routes per-route reset granularity

**Source:** maturity-assessment row #7
**Discovered:** 2026-05-04
**Kind:** mixed
**Why deferred:** Self-contained mini-design effort (~1d spec + ~1d implement); design-call-deferred tag in row #7
**Estimated effort:** M
**Dependencies:** none direct; benefits from ASSERTION-4 settling reentry usage patterns
**Notes:** Add `resets_target_stage_status: yes/no` column to reentry_routes table. Per-route decisions: `handoff_provenance_failure` → reset J only; `invalid_stage_j_condition` → reset H; `handoff_contradiction` → reset J (current behavior, correct).

### B003 — Stage J retry-vs-degrade decision tree (CONDITIONAL)

**Source:** maturity-assessment row #6
**Discovered:** 2026-05-04
**Kind:** knowledge
**Why deferred:** Outcome dependent on ASSERTION-4 axis (a) success
**Estimated effort:** S (if needed) / 0 (if axis (a) eliminates FP rate)
**Dependencies:** ASSERTION-4 axis (a) close
**Notes:** Re-evaluate at ASSERTION-4 close. If axis (a) chosen option produces clean Layer 2b (zero residual FP under realistic prose), B003 is closed. If residual FP rate > 0, J needs documented retry-vs-reentry_request decision tree. Mark closed-at-ASSERTION-4-close OR upgrade to active backlog item.

### B004 — challenged_claim category semantic clarification

**Source:** dogfood retrospective (out of 8-intervention scope)
**Discovered:** 2026-05-04
**Kind:** design
**Why deferred:** Not in 8 operator-interventions; affects Stage A skill doc + schema semantic
**Estimated effort:** S
**Dependencies:** none
**Notes:** Skill says "challenged_claim for dubious user claims"; schema semantic is "challenged by external party". Implicit-assumption case has no clean home. Two fix options: (X) add `implicit_assumption` category, or (Y) loosen supersede to accept CHALLENGED-not-FROZEN with rationale. (Y) overlaps maturity-assessment row #8 — may auto-resolve via ASSERTION-4 row #8.

### B005 — render template field-vs-schema sync + render-check as archive preflight

**Source:** dogfood retrospective (漏掉 2)
**Discovered:** 2026-05-04
**Kind:** capability
**Why deferred:** Low priority (🟢); dogfood-only impact is RENDER ERROR comments injected into archive
**Estimated effort:** S
**Dependencies:** none
**Notes:** Two coupled fixes: (1) `failure_reason: null` should not be flagged "missing required field" — render template needs null-tolerance for nullable fields. (2) `archive` command should require `render-check` clean exit as preflight; otherwise silent doc rot. Make render-check failure block archive.

### B006 — Skill doc vs implementation drift (general)

**Source:** dogfood retrospective + maturity-assessment rows #7, #8 (cross-cutting pattern)
**Discovered:** 2026-05-04
**Kind:** knowledge
**Why deferred:** Cross-cutting; needs sweep, not point fix
**Estimated effort:** L
**Dependencies:** ASSERTION-4 close (some drift items resolved by ASSERTION-4 in-scope rows)
**Notes:** Pattern observed: skill docs (skills/pre/SKILL.md, skills/plan/SKILL.md, skills/code/SKILL.md, skills/achieve/SKILL.md) describe behaviors that have drifted from implementation post-PR#2. After ASSERTION-4 close, do a sweep audit of all four skill docs against current schema + CLI; produce drift-report; propagate fixes. Not a single fix; needs its own mini-milestone scoping.

### B007 — auto-id E3 cascade audit (categories.md / agent prompt prefix tables / category-aware paths)

**Source:** ASSERTION-4 brainstorm Fork E refinement
**Discovered:** 2026-05-04
**Kind:** capability
**Why deferred:** ASSERTION-4 only switches new-entry default to flat CON-NNN auto-id; existing prefix-aware references (RG- / FC- / AS- / RISK- / DROP- / DEP- / FACT- / CLAIM-) survive. Any sweep that touches references/categories.md, agent prompt prefix tables, or category-aware code paths in freeze gate / delta-validate / render templates is out of ASSERTION-4 scope.
**Estimated effort:** M
**Dependencies:** ASSERTION-4 close (so flat-CON behavior is observed in production for ≥1 dogfood cycle before cascade)
**Notes:** ASSERTION-4 spec adds `prefix is recommendation only; tooling assumes flat numbering for auto-id` footnote. B007 is the question of whether to also retire the recommendation entirely. Two sub-options: (X) keep prefix recommendation in references/categories.md but mark as informational-only; (Y) sweep-remove all prefix-aware code and docs. Prefer (X) — prefix carries cognitive value for human readers even if tooling ignores it.

### B008 — Migrate _provenance_required out of schema per §6.0 boundary rule

**Source:** ASSERTION-4 spec §6.0 dialectic round 2
**Discovered:** 2026-05-06
**Kind:** capability
**Why deferred:** ASSERTION-4 §6.0 declares that schema declares parameters and validator code owns rule shape. PR #2's `_provenance_required` annotation is borderline DSL (a marker key in schema influencing validator behavior) and predates that rule. ASSERTION-4 grandfathers it explicitly to avoid scope creep. B008 is the eventual cleanup.
**Estimated effort:** S
**Dependencies:** ASSERTION-4 close (so the §6.0 rule has lived for ≥1 cycle and §6.1's pure-parameter form is the current example)
**Notes:** Refactor target: move `_provenance_required: true` and the `kind` / `fields` per-slot annotations out of `schemas/bonfire-v1.json::handoff_substantive_slots` into `bin/lib/schema.cjs` as a code-level constant. Schema retains only the slot path list (parameter form). validator code owns "this slot needs provenance + walks these fields" (rule form). Keeps governance consistent across PR #2 and ASSERTION-4 work.

### B009 — Per-conflict retry budget independence from global max_depth (advanced reentry model)

**Source:** ASSERTION-4 spec §4.4.1 dialectic round 2
**Discovered:** 2026-05-06
**Kind:** design
**Why deferred:** ASSERTION-4 introduces per-conflict `retry_budget` but constrains it within global `max_depth` per §4.4.1. Making per-conflict budget independent (so mandate_failure can have a true budget of 2 regardless of other conflict types' depth consumption) requires redesigning the depth model — separate counters per conflict_type, or budget-aware max_depth raise.
**Estimated effort:** M
**Dependencies:** ASSERTION-4 close + B002 (per-route reset granularity; B009 is complementary axis on same reentry-routing surface)
**Notes:** Possible designs: (1) replace global max_depth with per-conflict depth tracking; (2) retain global max_depth but make it auto-raise when per-conflict budgets sum to a higher value; (3) cap chain (e.g., `max_total_depth` AND per-conflict budgets coexist as separate caps). Decision depends on dogfood evidence about whether mandate_failure retry frequency is actually constrained by max_depth in practice. ASSERTION-4 §10.3 records this as a known limitation.

### B010 — Codify aligned_by token shapes (replace free-form strings with structured tokens)

**Source:** ASSERTION-4 spec §3.3.2 round 3 dialectic + dogfood 2026-05-04 forensic
**Discovered:** 2026-05-06
**Kind:** design
**Why deferred:** ASSERTION-4 §3.3.2 currently classifies aligned_by tokens by substring detection (`-via-` or `-by-` → EXCLUDE; otherwise INCLUDE). Empirically correct on dogfood 14-token sample, but the rule is brittle: it relies on unwritten conventions about how agents/operators name alignment authorities. Long-term fix is structural codification at the source.
**Estimated effort:** M (touches `bin/lib/truth-surface.cjs::update`, all four `agents/bonfire-{d-critique,g-red,g-blue,h-review}.md` prompts, `bin/lib/freeze-enforcement.cjs` constants, render templates that stringify aligned_by, possibly schema delta validators)
**Dependencies:** ASSERTION-4 close + the §3.3.2 substring rule's empirical pain made visible during ≥1 production cycle
**Notes:** Replacement candidate shape: structured token `{kind: 'paraphrase_chain' | 'first_alignment' | 'survival' | 'ruling' | 'accept_residual', source_stage: 'stage-d' | 'stage-e' | 'stage-g' | 'stage-h' | 'agent', target_ref: 'CON-NNN' | null, descriptor: string | null}`. Structural codification eliminates the need for §3.3.2's empirical regex entirely; the rule becomes `kind === 'paraphrase_chain' → EXCLUDE`. Until B010 ships, the substring rule is technical debt with a known false-positive surface (§10.7).

**Pre-design intake (binding for B010 spec when it opens):** B010 should also be informed by 1-2 additional dogfood runs after ASSERTION-4 close, to widen the empirical sample of aligned_by shapes beyond gto-trainer's 14 distinct values. The current sample is monoculture: single seed (poker GTO trainer), single agent set, single operator (the architect). Designing the structured `kind` enum from this sample alone is over-fitting risk — a different seed with different agent paths could surface shapes like `stage-d-extended-by-*`, `cross-stage-coalign-*`, or other classes the current sample doesn't contain. B010 spec MUST therefore wait for ≥2 dogfood archives' aligned_by inventory before committing to a kind enum.

**PROMOTED 2026-05-06 (per errata-001 round 4 dialectic seed 3):** the "≥2 dogfood runs" constraint is no longer informational here. ASSERTION-4 round 4 spec re-cut MUST adopt this as a main-clause requirement: any positive THRESHOLD/anchor calibration in round 4 requires ≥2 dogfood archives. Single-archive negative falsification (kill-criterion fire) remains sufficient evidence to halt; positive calibration does not.
