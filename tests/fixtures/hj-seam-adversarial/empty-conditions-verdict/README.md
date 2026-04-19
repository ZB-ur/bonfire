# empty-conditions-verdict

**Attack:** `verdict: approved_with_conditions` with `conditions: []`. Semantic
nonsense — the verdict type exists because there are format tasks to do.

**Expected catch:** Layer 1 — `validateHConditions` explicitly rejects empty
conditions array (spec §7.6).
