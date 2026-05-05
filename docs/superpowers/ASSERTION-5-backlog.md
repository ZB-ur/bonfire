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
