---
title: ASSERTION-4 — Layer 2b Softening + Layer M Mandate
charter: 2026-05-04-bonfire-maturity-assessment.md (rows #1, #2, #4, #5, #8)
errata: 2026-05-04-bonfire-maturity-assessment-errata.md
followup_routing: ASSERTION-5-backlog.md (B001–B007)
purpose: Close two orthogonal seam-validation gaps surfaced by 2026-05-04 dogfood — Layer 2b false-positive rate on legitimate handoff prose (anti-invention over-strictness) and substantive-slot vacuous-pass loophole (anti-omission absence).
---

# ASSERTION-4 — Layer 2b Softening + Layer M Mandate

## §1 — Scope contract

This spec implements rows #1, #2, #4, #5, #8 of `2026-05-04-bonfire-maturity-assessment.md` (frozen). Rows #3, #6, #7 + secondary findings are out of scope and routed to `ASSERTION-5-backlog.md` items B001–B007.

**Charter rule:** spec dialectic may not introduce new intervention items beyond the in-scope rows. New discoveries route to:
- `2026-05-04-bonfire-maturity-assessment-errata.md` if existing-row scoring was wrong → triggers re-charter
- `ASSERTION-5-backlog.md` if a new intervention emerged → out-of-scope deposit
- A hard-blocker dependency from in-scope on out-of-scope → triggers maturity-assessment v2 (not silent expansion)

## §2 — Layer naming taxonomy

PR #2 introduced Layer 1 / Layer 2a / Layer 2b. ASSERTION-4 introduces **Layer M** as a distinct namespace:

| Layer | Direction | Job |
|---|---|---|
| Layer 1 | anti-invention (H verdict text) | block bad conditions before they reach J |
| Layer 2a | anti-invention (J slot structure) | source_kind enum + source_ref dereferences to FROZEN |
| Layer 2b | anti-invention (J slot content) | substantive tokens overlap with referenced source |
| **Layer M (NEW)** | **anti-omission (J handoff completeness)** | **block J from passing validation by emitting too little** |

Future anti-invention layers reserve Layer 2c, 2d, etc. Future mandate refinements reserve Layer M2, M3. The two namespaces stay orthogonal.

## §3 — Axis (a): Layer 2b softening

**Rationale (from maturity-assessment row #1 + dogfood evidence):** Current zero-orphan rule produced ~200 false-positive orphans on a single legitimate handoff. Two coupled changes:

### §3.1 — A1: CON cross-reference passthrough

In `bin/lib/seam-validation.cjs::extractSubstantiveTokens` (or its consumer in `compareTokens`), tokens matching pattern `/^con-\d+$/i` are treated as scaffolding, not as substantive content. They count toward neither the source-set nor the orphan-set.

Justification: `CON-026` appearing in a J slot description as a cross-reference to a related ledger entry is meta-text, not invented product semantics. The dogfood produced ~50 such orphans alone.

### §3.2 — A3: Ratio threshold replacing zero-orphan rule

`compareTokens` returns `{ valid: boolean, overlap_ratio: number, ... }`. The validation rule changes from:
```
valid := orphan_tokens.length === 0
```
to:
```
valid := overlap_ratio >= THRESHOLD
```

`THRESHOLD` is **not a constant in this spec**. It is determined empirically during plan/code stages, bounded by fixture anchors (§7):
- MUST be > 36% (so `tagged-correct-but-invents` continues to fail — preserves PR #2 detection floor)
- MUST be > 0% (so `pure-invention-floor` fails — anchors the absolute lower bound)
- MUST be ≤ `legitimate-paraphrase-passes` empirical anchor (so legitimate prose can pass)

If the empirical legitimate-paraphrase anchor turns out to be ≤ 36% (i.e., legit prose overlaps less than tagged-correct-but-invents), the threshold range becomes empty — **this is a kill criterion** for the A3 approach. In that case, plan must escalate (re-charter via maturity-assessment errata, or shift to a different option from rows #1's A2/A4).

### §3.3 — Calibration step (during plan, not code)

Plan must include a calibration sub-task: dispatch a single j-compile on the gto-trainer dogfood case (`/Users/lddmay/AiCoding/bonfire-test/gto-trainer/`), instructing the agent to write "natural paraphrase, not literal quote", capture each populated substantive slot's overlap ratio against its source ledger entry under the new A1 rule (CON-* passthrough applied), record the distribution. The highest-frequency-cluster overlap ratio becomes fixture #5's anchor and informs the THRESHOLD choice.

This step is documented as part of the plan's calibration work, not deferred. If it fails (j-compile cannot produce natural paraphrase, OR the overlap distribution is degenerate), the spec's A3 commitment is at risk and plan must escalate before proceeding.

## §4 — Axis (b): Layer M mandate

**Rationale (from maturity-assessment row #2 + dogfood evidence):** Layer 2a/2b only fire when J populates substantive slots. The dogfood passed validation by omitting all substantive slots. Layer M closes this loophole.

### §4.1 — Per-unit declaration

Each `handoff.implementation_units[N]` gets a new field:
```json
{
  "id": "UNIT-3",
  ...,
  "substantive_slot_refs": ["FC-005", "FC-006", "CON-026"]
}
```

`substantive_slot_refs` is `string[]`. Default `[]`. Each entry MUST be the `id` of an entry that exists in one of the populated `handoff.{domain_model.entities, function_contracts, data_contract, ui_contract.panels}` arrays/objects.

### §4.2 — Handoff-level invariant

Layer M validates the following disjunction:

```
INVARIANT M (must satisfy ONE):
  (M.1)  ∃ unit ∈ handoff.implementation_units
         such that unit.substantive_slot_refs.length > 0
  
  OR
  
  (M.2)  handoff.no_substantive_contract === true
         AND handoff.no_substantive_contract_reason is a non-empty string
         AND no_substantive_contract_reason contains a token matching /CON-\d+|RG-\d+|FC-\d+|AS-\d+|REQ-\d+/
            (i.e., references at least one ledger entry id)
         AND no_substantive_contract_reason passes Layer 2b token-coverage
            against the FIRST referenced ledger entry (using same THRESHOLD as §3.2)
```

(M.2) is the legitimate escape valve for non-typical artifacts (e.g., `probe.sh` is a single shell script with no contract surface). Its dual constraints (must reference + must pass token coverage) prevent it from becoming a free pass.

### §4.3 — Per-ref resolution

For every unit's `substantive_slot_refs[i]`, the validator dereferences to a populated slot:
- Format `FC-NNN` → `handoff.function_contracts.find(fc => fc.id === ref)`
- Format `<entity-name>` → `handoff.domain_model.entities.find(e => e.id === ref || e.name === ref)`
- Format `panel:<id>` → `handoff.ui_contract.panels.find(p => p.id === ref)`
- Format `CON-NNN` → can resolve to ledger-direct provenance reference inside any substantive slot (delegates to existing Layer 2a)

Resolution failure → Layer M fail with specific orphan ref id.

### §4.4 — Reentry route

New conflict_type: `mandate_failure` → `target_stage: stage-h`.

Same routing as `handoff_provenance_failure` (PR #2): J cannot self-fix mandate failure because the missing content is product-semantic; H must reformulate verdict (issue conditions, or revise approval semantic).

(Open question for ASSERTION-5: should `mandate_failure` ever route back to stage-j? Deferred — same simplification PR #2 made for handoff_provenance_failure.)

## §5 — Mechanical riders

### §5.1 — Row #4: auto-id

`bonfire truth-propose --id auto` (new value alongside literal `--id CON-007`):
- Reads current snapshot.
- Picks `max(numeric tail of all entry ids matching /^CON-\d+$/) + 1` as the new id.
- Returns the assigned id in the JSON output.

Behavior is **flat CON-NNN only**. Other prefixes (RG / FC / RISK / DROP / etc.) remain valid as user-specified ids but are not auto-generated. Schema doc adds footnote: `prefix is recommendation only; tooling assumes flat numbering for auto-id`. Existing prefix entries unchanged.

ASSERTION-5 B007 owns the broader question of prefix-recommendation lifecycle.

### §5.2 — Row #5: discard ruling enum check

`bin/lib/delta-parser.cjs` (or wherever bonfire-h-review delta validation lives): add a constraint that for each `verdict.rulings[i]`:
```
ruling.action ∈ {"freeze", "supersede"}
```

Schema (`bonfire-v1.json`):
```json
"bonfire-h-review": {
  "constraints": {
    ...,
    "ruling_action_enum": ["freeze", "supersede"]
  }
}
```

Delta-validate fail message: `ruling.action "<X>" not in {freeze, supersede}; lifecycle ops (discard) are not valid h-review rulings`.

This implicitly confirms the design call: discarding belongs to lifecycle ops (`bonfire truth-discard`), not h-review verdicts.

### §5.3 — Row #8: supersede error message tweak

In `bin/lib/truth-surface.cjs::supersede`, the existing error:
```
supersede: entry "<id>" is <STATUS>, must be FROZEN. Use truth-discard on the old entry, then truth-propose the replacement.
```
becomes:
```
supersede: entry "<id>" is <STATUS>, must be FROZEN.
For CHALLENGED entries: prefer `truth-update --id <id> --field aligned_by --value <token>` (resolves via alignment).
For unwanted entries: use truth-discard then truth-propose the replacement.
```

`skills/plan/SKILL.md` Stage E section is updated to document align-via-token as the primary verb for resolving CHALLENGED entries; supersede stays for FROZEN-truth amendment.

## §6 — Schema deltas

`schemas/bonfire-v1.json` additions only (no removals, no field renames):

1. `delta_schemas.bonfire-h-review.constraints.ruling_action_enum: ["freeze", "supersede"]`
2. `handoff_substantive_slots` unchanged (the new `substantive_slot_refs` field is on `implementation_units`, not on substantive slots themselves)
3. New `handoff_mandate_invariant` block:
   ```json
   "handoff_mandate_invariant": {
     "_layer_m": true,
     "ref_field": "substantive_slot_refs",
     "escape_valve": {
       "flag": "no_substantive_contract",
       "reason_field": "no_substantive_contract_reason",
       "reason_must_reference_ledger": true,
       "reason_must_pass_token_coverage": true
     }
   }
   ```
4. New reentry route: `mandate_failure → stage-h`

`bundle_version` does NOT bump. Per F1, existing compile-output.json files (e.g., gto-trainer dogfood archive) are intended to fail validation under the new rules. Documented in commit message.

## §7 — Fixture battery

**5 new + 2 retained from PR #2:**

| # | Fixture | Status | Anchors |
|---|---|---|---|
| 1 | `omit-substantive-slots/` | new | Layer M (M.1 violation) |
| 2 | `supersede-drift/` | reuse PR #2 | Layer 2a FROZEN sub-check |
| 3 | `condition-index-out-of-range/` | new | Layer 2a condition_rewrite path |
| 4 | `pure-invention-floor/` | new | Layer 2b detection floor (0% overlap) |
| 5 | `legitimate-paraphrase-passes/` | new (calibration-derived) | Layer 2b upper anchor |
| (retained) | `tagged-correct-but-invents/` | PR #2 | Layer 2b mid-floor (~36%) |
| (retained) | `chain-dilution/` | PR #2 | Layer 2b mid-range |

Anchors collectively pin THRESHOLD between `tagged-correct-but-invents`'s 36% (must fail) and `legitimate-paraphrase-passes`'s empirical anchor (must pass). The retained fixtures are first-class regression guards — deletion is forbidden.

Fixture #5 content is produced during plan calibration (§3.3) and is the empirical anchor for THRESHOLD selection.

## §8 — Backward compatibility (F1)

Existing `compile-output.json` files produced by pre-ASSERTION-4 J-compile runs will fail Layer M validation (no `substantive_slot_refs`, no `no_substantive_contract` flag). This is intended. The gto-trainer 2026-05-04 dogfood archive at `bonfire-test/gto-trainer/.bonfire/archive/2026-05-04-gto-trainer-v0.1-dogfood/` is research-only and not affected by going-forward CI.

Commit message must explicitly state: `BREAKING: pre-ASSERTION-4 compile-output.json files fail handoff-validate under Layer M. Intended behavior — see specs/2026-05-04-bonfire-assertion-4-design.md §8.`

## §9 — Non-goals (rejected options preserved here for spec dialectic anchoring)

Options that were considered and rejected during brainstorm — these MUST NOT be reintroduced via dialectic:

- A2 (whitelist expansion as primary axis-(a) mechanism): rejected — runaway risk per dogfood
- A4 (skip prose fields entirely): rejected — would skip the surface where invention hides
- B1 (mandate emit-something at minimum): rejected — gameable with 1-line dummy slot
- B2 (mandate emit-non-trivial referencing FROZEN): rejected — partial coverage only
- B3 full (validator scans implementation_units prose for ref patterns): rejected — magic; B3-lite (declarative refs field) preferred
- C1 (make discard ruling work in apply-h-rulings): rejected — semantic mismatch
- C3 (rebound discard to lifecycle op): rejected — adds path, doesn't clarify
- D1 (loosen supersede to accept CHALLENGED): rejected — supersede semantic is FROZEN-truth amendment, loosening dilutes
- D3 (introduce new "resolve" verb): rejected — verb proliferation
- E1 (auto-id with arbitrary user prefix): rejected — fragments numbering across runs
- E2 (auto-id with category-derived prefix): rejected — caused dogfood inconsistency
- F2 (bundle_version bump for graceful migration): rejected — bonfire is pre-1.0
- H1 (Layer 2c naming for mandate): rejected — conflates orthogonal directions
- H3 (rename all layers): rejected — external surface too large for this scope

## §10 — Risks and known unknowns

1. **Calibration fixture #5 produces unusable anchor** (§3.3 kill criterion). If plan calibration shows legitimate-paraphrase overlap < 36%, axis (a) approach breaks. Mitigation: kill criterion explicit; plan must escalate to errata-and-recharter rather than ship a guessed THRESHOLD.

2. **Layer M (M.2) escape valve abuse**. A J agent could write `no_substantive_contract: true` with a reason that references an unrelated FROZEN entry to satisfy token coverage. Mitigation: dialectic during plan should weigh adding a `_min_reason_token_count: N` constraint or restricting reason references to specific ledger entries cited in implementation_scope. Currently relies on token-coverage stringency (same THRESHOLD as §3.2).

3. **mandate_failure → stage-h routing** may be overzealous for cases where J could self-fix. Same simplification as PR #2's handoff_provenance_failure. ASSERTION-5 B-pending may revisit per-route reset granularity (B002 in backlog).

4. **A1 regex passthrough false positives**. The pattern `/^con-\d+$/i` matches any token of that shape, including (theoretically) prose token sequences that happen to look like CON-NNN. Mitigation: regex is anchored start-to-end; whole-token match only; token boundary set by existing extractSubstantiveTokens whitespace+punctuation rules.

## §11 — Test plan summary

Plan must produce:
- Calibration step output (§3.3 j-compile dispatch + overlap distribution analysis)
- 5 new fixture directories + companion test entries in `tests/test-hj-seam-fixtures.js` (or wherever fixture-driven tests live)
- Schema delta tests
- Reentry route table test (mandate_failure presence)
- Auto-id behavior tests (truth-propose --id auto)
- Discard-ruling delta-validate rejection test
- Supersede error message string match test
- Backward-incompat regression: gto-trainer dogfood compile-output.json now fails handoff-validate (positive assertion that legacy correctly fails)

Plan should also include skill doc update commit (`skills/plan/SKILL.md` Stage E supersede→align guidance).

## §12 — Out-of-scope rerouting

Routes confirmed:
- Row #3 (case.json write CLI) → ASSERTION-5 B001
- Row #6 (Stage J retry-vs-degrade decision tree) → ASSERTION-5 B003 (conditional re-evaluation at this spec's close)
- Row #7 (reentry routes per-route reset granularity) → ASSERTION-5 B002
- Secondary findings (challenged_claim, render template, skill drift) → ASSERTION-5 B004/B005/B006
- E3 cascade (categories.md / agent prompts / category-aware paths) → ASSERTION-5 B007

If during plan or code execution any of these is discovered to be a hard blocker for in-scope work, the response is **errata + maturity-assessment v2 + spec re-charter**, not silent in-scope expansion.
