# lemmatization-edge

**Pinned behavior:** source says "classification algorithm", slot content says
"classifier implementations". Current lemmatizer: `classification` → `classificatio`
(drop `n`? no — drops `s`/`es`/`ing`/`ed` only; "classification" stays).
`classifier` stays. Neither maps to the other.

**Expected result:** FAIL. Orphan tokens `classifier` and `implementations`.

If the lemmatizer is later enhanced to map `classifier` ↔ `classification` (e.g.,
`-er` → `-` stem reduction), this fixture will start to PASS — the team should
re-evaluate and update this README or split into two fixtures.
