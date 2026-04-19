# Design: Bonfire H→J Seam Hardening

**Date:** 2026-04-18
**Status:** Proposed
**Scope:** Assertion 2 of the bonfire production-grade gap analysis — close the `approved_with_conditions` exit ramp that lets J-Compile invent product semantics.

---

## 1. Context

The `/bonfire:plan` pipeline ends at Stage J (compile). Before J runs, Stage H (`bonfire-h-review`) produces a verdict with three possible values: `approved`, `approved_with_conditions`, `rejected`. Rejection triggers `state-reentry` routed to an upstream stage. Approval (with or without conditions) lets Stage J proceed.

`approved_with_conditions` was intended as a lightweight escape valve: "the package is good enough to compile, but J-Compile should polish X, Y, Z before freezing." In practice, it became the default path for H-Review to hand off unresolved product decisions — including enumerations, classifications, and algorithms that properly belong in the constraint ledger.

Assertion 1 fixed the ledger state machine around freeze enforcement. Assertion 2 targets the next ring: the interface contract between H-Review and J-Compile, and the schema of what J-Compile is permitted to produce.

## 2. Problem

Evidence from the gto-trainer case at `/Users/lddmay/AiCoding/bonfire-test/gto-trainer`:

**H-Review verdict (`plan/h-review-verdict.json`):** `verdict: "approved_with_conditions"` with 6 conditions. Each condition reads like a work order to J-Compile:

- "J-Compile MUST enumerate the exact board texture categories (target 8-12) with explicit classification rules."
- "J-Compile MUST define the hand-strength classification algorithm for CON-020: explicit rules mapping hand+board to each of the 5 categories."
- "J-Compile MUST specify the TypeScript interfaces for preflop range data (13x13 matrix schema) and postflop strategy table JSON."
- "J-Compile MUST enumerate which position pairs are covered for postflop scenarios."
- "J-Compile MUST define UI state ownership: which component owns drill state, stats state, and mode selection state."
- "J-Compile MUST specify error/empty/loading states."

**J-Compile output (`plan/compile-output.json`):** J-Compile complied, inventing:

- 10 board texture categories + a 7-step classification algorithm (none in ledger)
- 5 hand strength categories + a priority-ordered classification algorithm (none in ledger)
- TypeScript interfaces for `PreflopRangeData`, `PostflopStrategyData`, `AggregateStats` (none in ledger)
- 6 specific position pairs: `BTN-BB, CO-BB, HJ-BB, SB-BB, BB-BTN, BB-CO` (none in ledger)
- UI state ownership assignments (none in ledger)
- Error/empty/loading state copy in Chinese (none in ledger)

Every item above is a product decision. The user did not approve any of them through the truth-surface adversarial review process. The bonfire premise — "frozen constraints are the only input to code" — is violated: the constraints were frozen, but most of the product decisions live in compile-output rather than in the ledger.

**H-Review also acknowledged the issue and proceeded anyway.** The verdict's `reasoning` field says: "CON-014 cannot remain at ~12-15 approximate" — an explicit admission that a FROZEN ledger entry is under-specified. The correct response would have been `rejected + scope_conflict → reentry to stage-c` (repropose CON-014 with exact count). Instead the verdict went `approved_with_conditions` and punted to J-Compile.

## 3. Root Cause

Two defects, compounding:

**Structural:** `approved_with_conditions` is an exit ramp around `state-reentry`. The schema (`schemas/bonfire-v1.json#delta_schemas.bonfire-h-review`) accepts `conditions` as an array of free-text strings with no enforcement on what they may demand. When H-Review needs to hand off an unresolved ledger gap, the structurally easiest path is to write a condition telling J-Compile to fill it in.

**Behavioral:** The `bonfire-h-review` agent prompt (`agents/bonfire-h-review.md`) does not contain an anti-goal against using `approved_with_conditions` as a compromise device. It permits "If approving with conditions, conditions must be specific and actionable" — which an LLM reads as an invitation to write specific, actionable work orders.

Fixing either alone is insufficient:

- Structural alone: H-Review will find other workarounds within a lax prompt.
- Behavioral alone: relies on prompt adherence, identical to Assertion 1's ledger-state-machine failure mode.

## 4. Goals

- Every `approved_with_conditions` condition is mechanically provable as a *format-only task* addressable by J-Compile without inventing product semantics.
- Every ledger gap requiring upstream-stage work (Stage C/D/E/F/G) is routed through `state-reentry` and cannot be laundered through conditions.
- Every "substantive slot" in `compile-output.json` declares a provenance pointer to a FROZEN ledger entry or to a specific stage-j condition; orphaned slots fail validation.
- Every orphan token in a provenanced slot — content present in the handoff but absent from the declared source — fails validation.
- The `bonfire-h-review` and `bonfire-j-compile` agent prompts carry explicit anti-goals that align with the structural checks.
- An adversarial fixture battery in `tests/fixtures/hj-seam-adversarial/` documents the known attack surface and pins the behavior of each defense layer against it.

## 5. Non-Goals

- Redesigning Stages A–G's internal logic.
- Changes to `state-reentry` depth limits or policy.
- Changes to the reentry route table beyond adding `invalid_stage_j_condition`.
- End-to-end Code + Achieve validation (Assertion 3).
- Enforcing provenance on every leaf of `compile-output.json` — only schema-designated substantive slots. Non-semantic fields (`file_plan` paths, execution manifest ordering) are excluded by design.
- Giving J-Compile semantic judgment capability — all three defense layers are mechanical (lexical, structural, diff-based).
- Retroactive repair of the gto-trainer `.bonfire/` artifacts.
- Preventing ledger-level drift introduced by supersede operations within the Stage A–G loop (separate concern).

## 6. Design

Three defense layers plus a prompt/behavior layer, each targeting a distinct failure class:

| Layer | Target failure | Check point | Mechanism |
|---|---|---|---|
| 1 (lexical) | Condition text demands a product decision | H→J entry, before Stage J runs | Token coverage + verb blacklist |
| 2a (structural provenance) | J-Compile produces content without declaring a source | J→handoff-validate | Schema-enforced `source_*` fields on substantive slots |
| 2b (token coverage diff) | J-Compile tags fabrication with a legitimate source | J→handoff-validate | Per-slot token-overlap check against declared source |
| 3 (behavior) | H-Review chooses `approved_with_conditions` as compromise | Agent prompt | Explicit anti-goal + decision tree |

### 6.1 Schema changes

**`schemas/bonfire-v1.json#delta_schemas.bonfire-h-review`** — extend the `conditions` entry shape:

```json
"bonfire-h-review": {
  "required_fields": ["verdict", "reason"],
  "optional_fields": ["conflict_type", "conditions", "rulings"],
  "constraints": {
    "verdict_enum": ["approved", "approved_with_conditions", "rejected"],
    "conflict_type_required_when_rejected": true,
    "condition_item_shape": {
      "type": "object",
      "required_fields": ["text", "target_stage"],
      "target_stage_enum": ["stage-j"]
    }
  }
}
```

Legacy free-string conditions no longer validate. Every condition must now be `{ text: string, target_stage: "stage-j" }`. The enum is a single value — `target_stage` exists for future extensibility (e.g., a stage-h-self condition) but currently admits only stage-j.

**Note on validator dispatch:** `condition_item_shape` is the first constraint in `bonfire-v1.json` that requires per-item validation inside a delta array. `bin/lib/delta-parser.cjs:validateDelta` currently only handles flat constraint keys (`*_min_length`, `verdict_enum`, `conflict_type_*`). This constraint needs a **targeted** dispatch branch: iterate `delta.conditions[]` and verify `required_fields` + `target_stage_enum` per item. Keep this branch targeted; do NOT introduce a generic nested-schema dispatcher or pull in a JSON Schema subset — defer that generalization until a second same-shape constraint appears.

**`schemas/bonfire-v1.json`** — add a new top-level section `handoff_substantive_slots`:

```json
"handoff_substantive_slots": {
  "handoff.domain_model.entities": { "_provenance_required": true, "kind": "per_entry" },
  "handoff.function_contracts": { "_provenance_required": true, "kind": "per_entry", "fields": ["purpose", "invariants", "failure_modes"] },
  "handoff.data_contract": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.panels": { "_provenance_required": true, "kind": "per_entry", "fields": ["description", "elements", "states"] },
  "handoff.ui_contract.state_ownership": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.empty_states": { "_provenance_required": true, "kind": "whole_section" },
  "handoff.ui_contract.error_states": { "_provenance_required": true, "kind": "whole_section" }
}
```

This is the **substantive slot whitelist** expressed at schema level, not hardcoded in the validator. When a future slot is added to the handoff shape, the schema author must either list it here (provenance required) or consciously decide to omit it. There is no "forget to update the validator" failure mode.

**J-Compile output schema extension — BLOCKED state:** When J-Compile determines during execution that an approved stage-j condition cannot be fulfilled without inventing content, it must not invent and must not produce a pass-through compile-output. Extend the compile-output schema to accept a `reentry_request` field on the top-level handoff:

```json
"reentry_request": {
  "conflict_type": "invalid_stage_j_condition",
  "reason": "<human-readable explanation naming the specific condition index and the missing source coverage>"
}
```

When `reentry_request` is present, `code_ready` MUST be `false`. `handoff-validate` detects this shape and emits the declared `conflict_type` to the caller without running Layer 2a/2b — the request IS the signal. This keeps validator responsibility clean: "validate a compile product that claims to be complete" vs "detect that J is refusing to complete." Explicit field, explicit semantics.

**`schemas/bonfire-v1.json#reentry_routes`** — add two routes:

```json
"invalid_stage_j_condition": { "to": "stage-h", "crosses_pipeline": false },
"handoff_provenance_failure": { "to": "stage-h", "crosses_pipeline": false }
```

Both route to stage-h (not stage-c) because the bug is H's mislabeling or the compile of an under-specified condition, not C's content. The existing `handoff_contradiction` route (→ stage-j) is preserved unchanged for its original purpose (contradictions internal to J's own output); provenance/coverage failures use the new route so route semantics stay distinct.

### 6.2 Layer 1 — H→J entry lexical check

**New CLI command:** `bonfire validate-h-conditions`

Input: `.bonfire/plan/h-review-verdict.json` and `.bonfire/truth-surface/constraint-ledger-snapshot.json`.

Behavior:

1. If verdict is not `approved_with_conditions`, exit 0 (nothing to validate).
2. For each `conditions[i]`:
   - **Rule 1 (token coverage):** extract substantive tokens from `condition.text` (non-stopwords, non-format-keywords, non-punctuation). Each substantive token must appear in at least one of:
     - The `content` field of some FROZEN ledger entry.
     - The schema's format vocabulary (field names, JSON keys, stage labels, handoff slot names, `bonfire` CLI command names).
     - The format keyword whitelist (`Given`, `When`, `Then`, `MUST`, `SHOULD`, `MAY`, `NOT`, common English articles/conjunctions/prepositions).
   - **Rule 2 (verb blacklist):** reject if `condition.text` contains any of: `enumerate`, `enumerated`, `classify`, `classified`, `categorize`, `categorized`, `partition`, `define`, `defined`, `specify`, `specified`, `list` (as verb), `rank`, `order` (as verb), `distinguish`, `decompose`, `map` (as verb, unless followed by a known-format keyword). Also reject common paraphrases: "document each", "for each … produce", "give … for every".
3. On any rule failure: print the failing condition index and reason to stderr, exit non-zero.

`bonfire state-advance --step stage-h` is extended to call `validate-h-conditions` before its existing rulings check. Failure → `state-reentry --conflict-type invalid_stage_j_condition`, which the new reentry route sends back to stage-h.

**Format keyword whitelist** lives in a new file `references/stage-j-format-whitelist.md` so the team can iterate on its contents without modifying the validator. The validator reads from this file at runtime.

### 6.3 Layer 2a — structural provenance

**Whitelist semantics — conditional trigger, not mandatory production.** The `handoff_substantive_slots` whitelist declares: *if J-Compile produces a slot listed here, then it must carry provenance metadata*. The whitelist does NOT require J-Compile to produce every listed slot. Slots that legitimately don't apply to a given case (e.g., no UI panels in a CLI-only tool) are simply absent from compile-output — no error. This prevents the whitelist from being misread as a mandatory output contract.

**Compile-output contract change.** Every slot marked `_provenance_required: true` in `handoff_substantive_slots` must carry two additional fields:

```json
"source_kind": "ledger_direct" | "condition_rewrite",
"source_ref": "<FROZEN ledger id>" | { "condition_index": <int>, "verdict_path": ".bonfire/plan/h-review-verdict.json" }
```

- `source_kind: ledger_direct` — the slot content is a direct projection of a FROZEN ledger entry. `source_ref` is the ledger id.
- `source_kind: condition_rewrite` — the slot content is a format-only rewrite of the text of an approved stage-j condition. `source_ref` is `{ condition_index, verdict_path }`. The condition itself must have `target_stage: "stage-j"` and have passed Layer 1.

Slots with `kind: per_entry` require these fields on each entry (e.g., each entity in `domain_model.entities`, each function contract). Slots with `kind: whole_section` require them at the section root.

The optional `fields` list in a slot annotation (e.g., `function_contracts` has `fields: ["purpose", "invariants", "failure_modes"]`) does NOT restrict where provenance attaches — provenance always attaches at the annotated slot level. The `fields` list tells Layer 2b which sub-fields within an entry to include in the token extraction. Structural sub-fields like `id`, `name`, `signature`, `location` are excluded from token matching because they carry engineering-choice content (file paths, identifiers) rather than product semantics. This is a per-slot author decision made once in the schema.

**Default extraction when `fields` is absent:** For `kind: whole_section` slots without a `fields` declaration (e.g., `data_contract`), Layer 2b recursively walks all string-valued leaves beneath the slot root and extracts tokens from them; JSON keys are not tokenized. For `kind: per_entry` slots without `fields` (e.g., `domain_model.entities` if its annotation omitted `fields`), the same rule applies per entry. This makes the annotation terse for slots where "all prose is substantive" is the right default, while preserving the ability to narrow via `fields` when a slot mixes structural and prose content.

**`bin/lib/schema.cjs:validateHandoff`** is extended with a new pass. After the existing field-presence checks:

1. Walk each slot named in `handoff_substantive_slots`.
2. For each required entry/section:
   - Verify `source_kind` is present and valid enum value.
   - Verify `source_ref` is present.
   - If `source_kind === "ledger_direct"`: dereference `source_ref` against the FROZEN ledger snapshot. Must exist and be status `FROZEN`.
   - If `source_kind === "condition_rewrite"`: dereference against the verdict file. Condition must exist at the given index and have `target_stage: "stage-j"`.
3. On any failure: emit `{ valid: false, errors: [...] }` as today, but with failure details naming the slot path and the broken provenance.

**`bonfire-j-compile` agent output format** must produce `source_*` fields. This is a prompt change (agent file update, §6.5) plus a schema change (schemas/bonfire-v1.json).

### 6.4 Layer 2b — token coverage diff

Given a provenanced slot passed Layer 2a, verify that its content doesn't smuggle in tokens absent from the declared source.

**Algorithm (per slot):**

1. Load the declared source text:
   - `ledger_direct` → load `content` field of the FROZEN ledger entry.
   - `condition_rewrite` → load `text` field of the stage-j condition.
2. Extract substantive tokens from the slot content (same extractor as Layer 1: non-stopwords, non-format-keywords, non-punctuation, lowercased).
3. Extract substantive tokens from the source text.
4. Extract tokens from the format whitelist (`Given`, `When`, etc.).
5. For each slot-content token: must appear in source tokens OR format whitelist OR schema vocabulary.
6. Orphan tokens (in slot, not in source/whitelist/schema) → record as failure.

**Edge cases:**

- Plural/singular normalization: tokens are lemmatized via a simple rule (drop trailing `s`/`es` for nouns, `ing`/`ed` for verbs) before comparison. Not perfect but sufficient for the common case. Over-aggressive lemmatization false-positives cost nothing (just weaker check); under-aggressive costs extra flagging which is OK (author can fix).
- Multi-word phrases: matched as individual tokens. `"board texture"` splits into `board` and `texture`, each checked separately.
- Numbers: substantive. `10` in slot content requires `10` or an equivalent numeric expression in source.
- Proper nouns (e.g., `BTN`, `CON-014`): substantive, must be in source or schema vocabulary.
- **CJK (Chinese, Japanese, Korean) text — known gap.** The lemmatization rules above are latin-specific. CJK text is tokenized by whitespace/punctuation boundaries and compared literally; no word-form normalization is applied. This means a CJK UI string produced by J-Compile (e.g., Chinese drill titles) must match CJK tokens present in the FROZEN ledger or in a stage-j condition *exactly*. This is intentionally strict — if a ledger entry doesn't specify the exact Chinese copy, J-Compile cannot invent it. For legitimate cases where the ledger approves "a Chinese title" without specifying exact text, the fix is an explicit stage-j condition that carries the approved text. The `cross-language-smuggle/` adversarial fixture (§7.6) pins this behavior. A future enhancement could introduce a CJK-aware tokenizer, but not in this spec.

**Integration:** `validateHandoff` extended with Layer 2b pass after Layer 2a. On orphan tokens: fail and emit the `handoff_provenance_failure` conflict_type (defined in §6.1), which routes to stage-h.

The whitelist for format keywords is shared with Layer 1 (`references/stage-j-format-whitelist.md`) to prevent drift.

### 6.5 Layer 3 — agent prompt hardening

**`agents/bonfire-h-review.md`** — add an explicit decision tree and anti-goal block:

```markdown
<anti_goals>
- Do NOT use `approved_with_conditions` as a compromise when the package has
  unresolved product-semantic gaps. That is the exact misuse that motivated
  this verdict type's schema tightening.
- Do NOT write conditions that ask J-Compile to `enumerate`, `classify`,
  `define`, `specify`, `categorize`, `partition`, `distinguish`, `list`,
  `rank`, `order`, or any paraphrase thereof. If you want any of those
  things, the correct action is `rejected` + a `conflict_type` that routes
  to the stage that can produce the missing constraints.
</anti_goals>

<decision_tree>
For each gap you identify in the A-G package:

  Gap is a missing FROZEN ledger constraint required by the coder?
    → rejected + conflict_type: requirement_conflict (→ stage-c)

  Gap is a dependency chain gap?
    → rejected + conflict_type: dependency_gap (→ stage-e)

  Gap is an unresolved adversarial challenge?
    → rejected + conflict_type: adversarial_unresolved (→ stage-g)

  Gap is purely a format/schema/packaging shortcoming in the handoff?
    → approved_with_conditions + condition targeting stage-j.
    MUST verify: every substantive noun in the condition text appears in
    the FROZEN ledger or in the handoff schema vocabulary.

  Gap is ambiguous or fits multiple buckets?
    → rejected + conflict_type: requirement_conflict (the most
    conservative upstream stage).
    NEVER default to approved_with_conditions when uncertain. The cost
    of a false-positive reject is one reentry loop; the cost of a
    false-positive approve is J-Compile inventing product semantics.
    The former is recoverable; the latter is the bug we are fixing.
</decision_tree>
```

**`agents/bonfire-j-compile.md`** — add a provenance requirement block:

```markdown
<provenance_rules>
Every substantive slot in your compile-output (per
`handoff_substantive_slots` in the schema) MUST carry:
  - `source_kind`: either `ledger_direct` or `condition_rewrite`
  - `source_ref`: the FROZEN ledger id, or the condition index

You MUST NOT produce content whose substantive tokens do not appear in the
declared source. `handoff-validate` will reject orphan tokens and the
package will be bounced back to H-Review — not to you. Do not save yourself
the bounce by inventing content that coincidentally uses source tokens;
the diff is mechanical.

If a condition asks you to produce content for which no source is adequate
(the condition passed Layer 1 entry check but in execution you find no
way to write the slot without inventing), do NOT produce a pass-through
compile-output. Instead, emit a top-level `reentry_request` field:

```json
{
  "handoff": { "code_ready": false, ... },
  "reentry_request": {
    "conflict_type": "invalid_stage_j_condition",
    "reason": "condition[<index>] '<excerpt>' requires inventing <what> — no adequate source coverage"
  }
}
```

`handoff-validate` detects this shape and triggers the declared reentry
back to stage-h. Do not invent. Do not partial-fill with placeholders.
</provenance_rules>
```

### 6.6 state-machine routing

The two new reentry routes (`invalid_stage_j_condition`, `handoff_provenance_failure`) are defined in §6.1 alongside other schema changes. `bin/lib/state.cjs:stateReentry` requires no code change — the route table drives routing automatically.

Route semantics summary:

| Source layer | Failure mode | Conflict type | Routes to |
|---|---|---|---|
| Layer 1 | Condition text violates token coverage or verb blacklist | `invalid_stage_j_condition` | stage-h |
| Layer 2a | Substantive slot missing or invalid `source_*` fields | `handoff_provenance_failure` | stage-h |
| Layer 2b | Orphan tokens in slot content | `handoff_provenance_failure` | stage-h |
| (existing) | J-Compile internal contradiction | `handoff_contradiction` | stage-j |

`handoff_contradiction` is preserved for its existing meaning (self-inconsistency within J's output) and must not be reused for provenance failures — keeping semantic distinctness in the route table.

### 6.7 Skill rewrite

`skills/plan/SKILL.md` Stage H (currently steps 35–40 after Assertion 1 edits) gains one inserted step after the existing step 37 (validate delta):

```
37b. **Validate conditions:** run `bonfire validate-h-conditions`. If
     non-zero exit, H-Review's output violated the condition-schema
     contract (non-stage-j target_stage, orphan tokens, or blacklisted
     verbs). Do NOT retry H-Review with the same prompt — the failure
     indicates a semantic mislabeling, so re-run with the failure
     report in the agent's input. Run: `bonfire state-reentry
     --conflict-type invalid_stage_j_condition`, then resume from
     stage-h.
```

Stage J (currently step 43) gains extended validation semantics — `bonfire handoff-validate` now covers Layer 2a + 2b in addition to existing basic-field checks. No skill change needed for this.

## 7. Test Plan

### 7.1 Schema tests

- `tests/test-delta-parser.js` extension:
  - Valid verdict with one `stage-j` condition → passes.
  - Verdict with non-`stage-j` target_stage condition → fails with clear error.
  - Verdict with condition missing `target_stage` field → fails.
  - Verdict with condition missing `text` field → fails.

### 7.2 Layer 1 tests (new file `tests/test-validate-h-conditions.js`)

- Condition with all substantive tokens in FROZEN ledger → pass.
- Condition with `enumerate` verb → fail (verb blacklist).
- Condition mentioning a non-FROZEN ledger id → fail (token coverage).
- Condition mentioning a stage-j schema vocabulary word (`given`, `then`) → pass.
- Condition mentioning a plausible-but-undefined phrase → fail.
- Verdict with `verdict: approved` (no conditions) → exits 0 trivially.
- Verdict with `verdict: approved_with_conditions` and `conditions: []` → exits 0.

### 7.3 Layer 2a tests (new file `tests/test-handoff-provenance.js`)

- Substantive slot with valid `source_kind: ledger_direct` + existing FROZEN id → pass.
- Substantive slot with `source_kind: ledger_direct` + missing id → fail.
- Substantive slot with `source_kind: ledger_direct` + id that is PROPOSED (not FROZEN) → fail.
- Substantive slot with `source_kind: condition_rewrite` + valid condition index → pass.
- Substantive slot with `source_kind: condition_rewrite` + out-of-range index → fail.
- Substantive slot missing `source_kind` entirely → fail.
- Slot NOT in `handoff_substantive_slots` (e.g., `file_plan`) with no source fields → pass (exempt).

### 7.4 Layer 2b tests (new file `tests/test-handoff-token-coverage.js`)

- Slot content with all tokens in source text → pass.
- Slot content with one new substantive noun not in source → fail, orphan token reported.
- Slot content with format keyword (`Given`, `When`) → pass (whitelist).
- Slot content with pluralized form of source token (`cards` vs `card`) → pass (lemmatization).
- Slot content with number not in source (`10 categories` when source says `several categories`) → fail.

### 7.5 Layer 3 tests

Agent prompt changes are verified via small smoke tests (dispatch the agent against a minimal case, inspect output) rather than automated tests — LLM output is non-deterministic. Document expected behavior in `tests/agent-smoke/bonfire-h-review.md` and `tests/agent-smoke/bonfire-j-compile.md`.

### 7.6 Adversarial fixture battery

New directory `tests/fixtures/hj-seam-adversarial/`. Each fixture is a self-contained case (ledger + verdict + compile-output) designed to bypass one defense layer. Each fixture's README declares which layer must catch it.

Known attack surface (initial fixtures):

- `each-evades-enumerate/` — condition says `"handoff MUST document each board texture scenario"` (uses `each` to sidestep `enumerate`). Layer 1 verb blacklist must include this paraphrase.
- `tagged-correct-but-invents/` — compile-output slot declares `source_kind: ledger_direct, source_ref: CON-003` but content contains substantive tokens absent from CON-003. Layer 2b must catch.
- `chain-dilution/` — condition rewrites a condition that rewrites a ledger entry, each step introducing a new substantive token under the cover of "format rewrite". Layer 2b applied transitively must catch.
- `wrong-stage-j/` — H-Review writes a condition with `target_stage: "stage-c"` (not `stage-j`). Schema validation must catch.
- `condition-demands-field-add/` — condition says `"add a risk_level field"`. Defines a new semantic field. Layer 1 must catch via blacklist + token rules.
- `lemmatization-edge/` — source says `"classification algorithm"`, slot says `"classifier implementations"`. Is `classifier` a valid lemmatization of `classification`? Test pins the behavior; acceptable outcome either way as long as it's consistent.
- `empty-conditions-verdict/` — `verdict: "approved_with_conditions"` with `conditions: []`. The intuition is that `approved_with_conditions` without actual conditions is semantic nonsense — the verdict type exists *because* there are format tasks to do. Pin behavior: Layer 1 (`validate-h-conditions`) **must fail** this shape, forcing H-Review to emit `verdict: "approved"` when it has no conditions. Prevents `approved_with_conditions` from being used as a mood-signal separate from its functional meaning.
- `supersede-drift/` — compile-output slot declares `source_ref: CON-014` but at validation time CON-014 has been superseded by CON-014b (status SUPERSEDED). Layer 2a must fail: source_ref must resolve to a FROZEN (not SUPERSEDED) entry. Pins behavior against supersede-driven drift where the ledger moves underneath a stale compile-output.
- `cross-language-smuggle/` — ledger is English (e.g., CON-007 `"Chinese language UI throughout"`), slot produces specific Chinese UI copy (`"开始训练"`, `"重置统计"`). The declared source (CON-007) contains no CJK tokens. Layer 2b's CJK handling (§6.4) must reject the orphan CJK tokens. The legitimate resolution path is for H-Review to emit a stage-j condition carrying the exact Chinese copy — which this fixture does NOT include. Accompanying the rejection, a separate positive-case fixture `cross-language-approved/` shows the compliant pattern: stage-j condition provides the exact text, slot cites the condition, Layer 2b passes.

Each fixture's test asserts the exact layer at which it's caught. If all layers pass a fixture that should fail, that's a regression.

### 7.7 Regression fixture from Assertion 1

Not applicable — Assertion 1's gto-trainer fixture is specifically about ledger-state enforcement, not H→J semantics. Assertion 2 has its own fixture under §7.6.

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Format keyword whitelist becomes bloated, letting new semantics slip through as "format" | Whitelist lives in `references/stage-j-format-whitelist.md`. Every addition requires commit-level justification. Periodic review before each milestone. |
| Token lemmatization under- or over-aggressive, causing false positives or negatives | Start with a simple heuristic (trailing `s`/`es`/`ing`/`ed`). Document explicitly in the code. False positives force H-Review to rewrite; no correctness regression. False negatives rely on Layer 1 + 2a to still catch. |
| J-Compile agent prompt update causes output format drift in unrelated ways | Prompt change is isolated to a new `<provenance_rules>` block. Existing output shape is preserved. Smoke test verifies no regression on a baseline case. |
| H-Review agent prompt update makes it over-cautious, rejecting borderline-OK packages | Acceptable. False rejections trigger a reentry and re-evaluation. The bonfire design already tolerates reentry depth up to 2. |
| Schema-level `_provenance_required` annotation introduces new failure mode on legacy `.bonfire/` directories | Document in commit message. Pre-existing compile-output.json files without source fields will fail `handoff-validate` on next run — intended behavior for the gto-trainer fixture; real in-flight cases can be migrated by re-running J-Compile once the Assertion 2 plan lands. |
| Verb blacklist maintenance burden | Keep the list short and conservative. Expand only when an adversarial fixture demonstrates a gap. The fixture battery is the source of truth, not speculative future verbs. |
| Provenance mechanism creates performance overhead on large handoffs | Profile once. Real handoffs are O(hundreds of slots), not thousands. Token extraction is linear. No tree-level algorithms. |
| Layer 2b "orphan token" check too noisy for English-language slot content | The check is scoped to substantive tokens only (non-stopword, non-format-keyword). Format whitelist includes common connective words. Lemmatization reduces false positives. If the noise proves too high in practice, the whitelist expands — but only with explicit commits, never implicitly. |

## 9. Implementation Order (suggested)

This spec drives a plan that likely decomposes into ~20 commits. Sketched order:

1. Schema changes (bonfire-v1.json + references/stage-j-format-whitelist.md seed) — foundation.
2. Layer 1 CLI (`validate-h-conditions`) + tests.
3. Layer 2a provenance schema enforcement in `validateHandoff` + tests.
4. Layer 2b token coverage diff in `validateHandoff` + tests.
5. Agent prompt updates (`bonfire-h-review.md`, `bonfire-j-compile.md`).
6. Adversarial fixture battery + regression tests.
7. state-machine route additions (`invalid_stage_j_condition`, `handoff_provenance_failure`).
8. Skill rewrite (`skills/plan/SKILL.md` step 37b).
9. End-to-end verification sweep.

The writing-plans skill will produce the atomic task breakdown with exact steps per commit.

## 10. Deferred Questions

Left to follow-up specs:

- Should Layer 2b check transitively through `condition_rewrite` chains (condition rewriting condition rewriting ledger)? Current design: yes, by following `source_ref` to the ultimate ledger anchor.
- Should the format keyword whitelist be unit-tested against a corpus of known-good conditions (e.g., from past bonfire runs) to ensure it doesn't block legitimate usage? Deferred; initial whitelist is conservative.
- Should J-Compile's agent prompt include worked examples of valid vs invalid provenance slots? Deferred; the prompt gets the rules, fixtures demonstrate compliance via test.
- Should `approved_with_conditions` be renamed to reflect its narrowed scope (e.g., `approved_with_format_conditions`)? Deferred; schema churn not worth the signaling gain.
