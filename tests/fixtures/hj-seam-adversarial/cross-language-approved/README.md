# cross-language-approved

**⚠ KNOWN GAP F1 (see PR #2 follow-up list)**

**Intent (per spec §6.4):** H-Review issues a stage-j condition whose text contains the
exact approved Chinese copy. The compile-output slot cites the condition as
`source_kind: condition_rewrite`. Layer 2b matches CJK tokens literally.

**Current implementation diverges:** Layer 1 (`validate-h-conditions`) rejects the
condition before Layer 2 runs. The condition's substantive tokens (CJK and English
alike) are not in the FROZEN ledger or the format whitelist, so every token is an
orphan.

**Real pipeline impact:** `state-advance --step stage-h` will block on any condition
that carries CJK text not already in the ledger. The "approved path" from spec §6.4 is
not walkable today.

**Open design decision:**
- Option A: add `carries_approved_text: true` flag to conditions; Layer 1 skips
  orphan check for flagged conditions (Layer 2b still uses condition text as source)
- Option B: require the ledger to carry the exact CJK strings (return to
  ledger-as-source-of-truth — may be impractical for large UIs)
- Option C: CJK tokens exempt from Layer 1 orphan check (weakens defense against
  笔画字罗列 attacks — not recommended)

Tests in `test-hj-seam-fixtures.js`:
- `Layer 2 ... accepts the slot` — passes today (Layer 2a/2b work as designed)
- `KNOWN GAP F1` — asserts Layer 1 currently fails; flips when design lands
