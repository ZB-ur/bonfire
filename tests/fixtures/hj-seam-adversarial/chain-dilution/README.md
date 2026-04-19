# chain-dilution

**Attack:** Condition claims to "format-rewrite" a ledger entry, but introduces
a new substantive token. compile-output cites the condition as source; Layer 2b
checks condition text and catches the orphan.

**Expected catch:** Layer 2b on the `condition_rewrite` path — the condition's
own text introduces `orthogonal` which has no anchor back to FROZEN ledger.
