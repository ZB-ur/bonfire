# cross-language-approved

**Pattern:** Ledger is English. H-Review issues a stage-j condition whose text
contains the exact approved Chinese copy. Compile-output slot declares
`source_kind: condition_rewrite, source_ref: { condition_index: 0 }` and its
CJK tokens match the condition text literally.

**Expected:** Layer 2b passes — all CJK tokens are in the condition source.
