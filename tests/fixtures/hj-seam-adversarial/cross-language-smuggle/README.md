# cross-language-smuggle

**Attack:** Ledger is English ("Chinese language UI throughout"); compile-output
slot produces specific Chinese UI text ("开始训练", "重置统计") claimed to be
derived from the English ledger entry. The declared source contains NO CJK
tokens.

**Expected catch:** Layer 2b — CJK tokens in slot are literal-only and have no
latin equivalents in source. All CJK tokens are orphans.

**Resolution pattern:** H-Review must issue a stage-j condition whose text
explicitly contains the approved Chinese copy. The companion fixture
`cross-language-approved/` shows the compliant pattern.
