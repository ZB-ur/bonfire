# tagged-correct-but-invents

**Attack:** compile-output declares `source_kind: ledger_direct, source_ref: CON-003`
but the slot content contains substantive tokens absent from CON-003.

**Expected catch:** Layer 2b (token coverage diff) — orphan tokens reported.
