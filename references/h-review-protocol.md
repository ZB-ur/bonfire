# H-Review Protocol Reference

Use this reference during the Stage H review verdict phase.

## Overview

H-Review is the independent code-readiness verdict stage. The reviewer evaluates the complete A–G package to determine if the next coder can implement without inventing high-impact meaning.

For detailed reviewer guidance and anti-patterns, see `agents/bonfire-h-review.md`.

## verdict_substantive_check (Assertion 3a, schema v2)

H-Review verdicts are now subject to a top-level structural check after
`validate-delta` and before state-advance:

- **Reject rule 1** (`approved_with_conditions_requires_conditions`):
  `verdict: "approved_with_conditions"` with `conditions: []` is a literal
  contradiction. Always rejected; no escape valve.
- **Reject rule 2** (`approved_requires_substantive_oversight_or_escape`):
  `verdict: "approved"` or `"approved_with_conditions"` with both
  `conditions: []` and `rulings: []` is rejected unless the verdict declares
  `no_substantive_oversight: true` with `no_substantive_oversight_reason`
  containing ≥1 ledger ID that resolves in the active FROZEN ledger snapshot.
  The escape valve is **ref-only**: only matches of `schema.ledger_id_pattern`
  in the reason text are validated (extracted, asserted ≥`min_refs`, asserted
  resolving in ledger). Prose surrounding refs is annotation, not validated —
  no Layer 2b token-coverage check applies (closes ASSERTION-3a spec DQ-1;
  breaks the circular dependency where Layer 2b's known false-positive rate
  would block legitimate escape valve usage).

Element-level vacuousness (e.g., a condition with `text: "see ledger"`, a
ruling with empty `target_id`, or a `supersede` ruling with empty
`new_content`) is caught earlier by `validate-delta`'s per-element checks,
which short-circuit before the top-level predicate is evaluated. The
top-level check therefore only sees verdicts whose elements are individually
substantive — its job is to catch the **literal-empty** case (`conditions: []`
and `rulings: []`).

If you are reviewing a fully-converged case where the H-Review agent has
nothing substantive to oversee, declare:
```json
{
  "verdict": "approved",
  "reason": "no remaining oversight",
  "conditions": [],
  "rulings": [],
  "no_substantive_oversight": true,
  "no_substantive_oversight_reason": "All ledger entries FROZEN — see CON-001 for converged scope."
}
```
