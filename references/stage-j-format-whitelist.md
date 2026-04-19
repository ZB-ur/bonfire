# Stage J Format Keyword Whitelist

**Purpose:** Tokens exempt from Layer 1 token-coverage and Layer 2b orphan-token checks. These are structure/format words that appear in stage-j conditions and compile-output without needing to trace to FROZEN ledger content.

**Add to this list ONLY when an adversarial fixture or real pipeline run demonstrates that a legitimate format keyword is being flagged as orphan. Every addition should be grounded in evidence, not speculation.**

**Loaded by:** `bin/lib/seam-validation.cjs::loadFormatWhitelist()`. Whitespace-separated tokens, lowercased, one logical group per line. Lines beginning with `#` are comments and ignored.

---

## Structure words

# Given/When/Then format
given when then given/when/then

# Format/render verbs (stage-j structure words)
format formatted formats rendered render renders reformat reformatted

# Modal verbs
must should may shall can could would

# Negation / binding
not any all each every some none

# Common articles / conjunctions / prepositions
the a an and or but if then else of in on at by for to from with without into onto
this that these those is are was were be been being have has had do does did will

# Format tokens
json yaml markdown prose text string number integer boolean array object field
schema key value pair list item entry

# Pipeline / stage vocabulary
stage pipeline ledger handoff compile render verdict condition ruling propose
freeze supersede discard update annotate

# Bonfire CLI commands
bonfire init truth propose update annotate freeze supersede discard read query rebuild
state advance reentry step begin run complete init-code-steps
delta validate handoff bundle render log preflight

# Pipeline stage names
stage-a stage-b stage-c stage-d stage-e stage-f stage-g stage-h stage-j

# Common file/path tokens
src tests docs fixtures config
