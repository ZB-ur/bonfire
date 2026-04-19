# each-evades-enumerate

**Attack:** The condition uses "document each" as a paraphrase of "enumerate" to
sidestep the single-word verb blacklist. A naive attacker uses `enumerate`; a
slightly more sophisticated one uses a paraphrase that means the same thing.

**Expected catch:** Layer 1 `PARAPHRASE_PATTERNS` (seam-validation.cjs, Task 5)
includes `\bdocument each\b`. The fixture test asserts the violation reason
names the paraphrase — NOT an orphan-token coincidence. If someone later
removes the pattern from the regex list, this fixture fails loudly.

**File list:**
- `h-review-verdict.json`
