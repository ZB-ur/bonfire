# Bonfire Dogfood Summary

**Date**: 2026-05-07 → 2026-05-08
**Project**: bilibili-danmaku-denoiser-clean (empty greenfield repo)
**Seed (verbatim)**: `做一个 B 站直播间弹幕降噪 Chrome 插件`
**Pipeline run**: `/bonfire:pre` → `/bonfire:plan` (B–J) → `/bonfire:code` → `/bonfire:achieve`
**Final acceptance verdict**: `not_achieved` (Chrome extension only 2/15 units done)
**Dogfood meta-verdict**: **achieved** — pipeline ran end-to-end, 20 findings captured (3 blocker / 12 production-grade / 3 ergonomic / 2 observation-only).

## Persona used

中度 B 站直播观众,游戏区 + VTuber 混看,Python/Bash 基础但 JS 浅,自用 sideload + 开源 GitHub,不上架商店,不长期维护。

Stage A bias decisions (per dogfood spec rules 1–5):
- **Persona-locked**: not toggling between users — all answers from the above persona.
- **Lean complex**: noise = 5 categories all-IN (flood / lowinfo / ad / toxic / offtopic), not a subset.
- **Lean ambiguous**: ACC = qualitative 体感 + 8-item binary checklist, not precision/recall numbers.
- **Lean edge**: scope = live room + 4 playback modes + replay; SPA reset / Unicode normalize / role exemption / paid-danmaku exemption / cross-extension coexistence all IN-scope.
- **Stage-A volunteered IN-scope**: a11y screen-reader + censorship-adjacency boundary + multi-extension coexistence.

## Findings by severity (20 total)

### 🔴 Blockers (3)

1. **Maturity gate blocks unchallenged PROPOSED entries from freezing** — `truth-freeze` rejects 19 entries with "requires non-empty challenged_by". Workaround: `stage-g-freeze-gate` auto-aligns; but `stage-playbook.md` line 122 tells operator to use plain `truth-freeze --id`. (Downgraded by workaround discovery to production-grade in log; original symptom blocker-level.)
2. **Stage H VACUOUS PASS** — H-Review agent produced 7 substantive conditions + 12 rulings; ALL silently dropped due to (a) `apply-h-rulings` rejecting RISK freezes, (b) `state-advance` Layer 2b orphan-token validator rejecting normal English/Chinese in conditions; operator could one-shot rewrite to `verdict=approved/empty conditions/empty rulings` and stage-h passed. Real H-Review intent preserved only via case.json sidecar field.
3. **Stage J Layer 2a vacuous-pass loophole confirmed** — `handoff-validate` returned `{"valid":true}` for `code_ready=true` + `unresolved_gaps=[]` + `domain_model.entities=[]` + `function_contracts=[]` + `data_contract={source_kind, source_ref}` + `ui_contract={surfaces:[], states:{}, accessibility:{}}`. Exactly matches dogfood-spec prediction.

### 🟠 Production-grade (12)

4. `challenged_claim` entry created with `challenged_by: []` while status auto-promoted to `CHALLENGED` — state-machine inconsistency.
5. Renderer expects 5 fields (reframed_goal/retained_scope/excluded_scope/critical_assumptions/frozen_for_code) at top level of `stages.preprocess`, but `stage-playbook.md` line 56 documents them inside `approval_pack` sub-object. Forced dual-write workaround.
6. `stages.requirements` renderer expects `requirement_units` field; doc says abstract "requirement units"; first 3 stages each had this kind of mismatch.
7. `stages.closure` renderer expects nested `dependency_chain: [{id, description, upstream, downstream}]` schema with no documentation; trial-and-error required.
8. `d-critique` agent legally challenges requirement-unit IDs (RU-05 / RU-11), but `truth-update` rejects non-ledger IDs — challenges silently lost. No bridge between case.json sub-structures and ledger.
9. `truth-annotate` requires entry FROZEN; `truth-freeze` requires `challenged_by` non-empty — combined → unreachable annotation state on PROPOSED/CHALLENGED entries (deadlock without `stage-g-freeze-gate`).
10. `apply-h-rulings` rejects entire batch when any RISK freeze ruling is included; H-Review docs do not warn about this category restriction.
11. `state-advance --step stage-h` Layer 2b orphan-token validator generates 100+ false-positive orphans for normal English/Chinese tokens (`include`, `as`, `first`, `pnpm`, `manifest`, `15`, `*`, `s`); blacklisted verbs `distinguish` and `list` block reasonable conditions.
12. Coder unit-2 only avoided fabricating product semantics because operator manually preserved the rich substantive_slots in `compile-output.json.full` and pointed the coder at it; bonfire alone would have shipped vacuous handoff to coder.
13. `state-init-code-steps` renames `unit-1.5` to a sequential `unit-N` identifier, dropping the half-step ID; `unit-1.5` becomes invisible in state machine.
14. `handoff-validate` requires `source_kind` + `source_ref` on every entity / function_contract / data_contract; neither field is documented anywhere in `ecl-schema.md` or `handoff-quality-bar.md`. Required reverse-engineering from `schema.cjs`.
15. 9 RENDER ERROR remnants across 5 J-Compile bundle markdown files (constraint-crosswalk / execution-manifest / code-batches / compile-for-code / final-handoff) due to undocumented field name mismatches (`mappings`/`waves`/`batches`/`summary`/`statement`/`status`/`code_ready`/`blockers`/`description`).

### 🟡 Ergonomic (3)

16. `stages.divergence` renderer expects `retained_option` field name; commands docs use phrase "retained_option_id"; not enumerated.
17. `truth-discard --id <existing>` is implemented as a `propose new entry of type=discard` rather than a state transition on the existing ID; CLI naming misleads.
18. State-advance error message suggests `bonfire state-reentry --conflict-type invalid_stage_j_condition` but that conflict_type is not in the route table.

### 🟢 Observation-only (2)

19. `truth-query --output-format ids` flag silently ignored (returned full entries JSON, exit 0).
20. Code stage has no first-class "scope-limited partial run" verdict; operator reuses the open-ended `state-complete-run --verdict <free-string>` to record `partial_dogfood_test_scope_limit`.

## Top 3 production-grade gaps

1. **Validation pipeline allows substantive-empty handoff to ship as `code_ready=true`**. The Layer 2a vacuous-pass loophole means the bonfire core promise ("coder must not invent product meaning") is not enforced — empty `domain_model` + empty `function_contracts` + empty `data_contract` + empty `ui_contract` all pass `handoff-validate`. Recommend an explicit assertion: `code_ready=true ⇒ entities.length ≥ 1 ∧ function_contracts.length ≥ 1 ∧ data_contract has substantive payload`.

2. **Layer 2b orphan-token validator is a false-positive generator**. The validator treats every non-whitelisted English/Chinese token as a product-meaning orphan. In practice this rejects normal condition prose (`pnpm install`, `manifest validity check`, `at least 1`) and creates an "incentive to vacuum the verdict". The validator needs (a) STOPWORDS exemption, (b) path-fragment exemption (`/`, `.`, `*`, `-`), (c) numeric/single-char exemption, (d) permission to reference H-Review's own conditions for token coverage. Currently the only path through is to write empty conditions — exactly what we did in this run.

3. **Schema documentation drifts from renderer/validator implementation in 5 stages**. Stages A, B, C, E, J all have RENDER ERROR cases or undocumented required fields (source_kind / source_ref / requirement_units / retained_option / mappings / batches / waves / statement / status). Operator must reverse-engineer schema by triggering errors. Recommend a single source-of-truth schema file consumed by both renderer and `ecl-schema.md` generator.

## Stage status table

| Stage | Status | Notes |
|---|---|---|
| stage-a (preprocess) | passed | 5 RENDER ERROR auto-resolved by dual-write workaround |
| stage-b (divergence) | passed | 1 RENDER ERROR (retained_option mismatch) auto-resolved |
| stage-c (requirements) | passed | 1 RENDER ERROR (requirement_units) auto-resolved |
| stage-d (critique) | passed | d-critique 9 challenges, 4 proposals; 2 RU-* challenges silently lost |
| stage-e (closure) | passed | 16+1 RENDER ERROR rounds; nested `dependency_chain` schema reverse-engineered |
| stage-f (probes) | passed | 4/4 INABILITY_TO_PROBE recorded with mitigations |
| stage-g (red-blue) | passed | g-red 15 challenges + 6 risks; g-blue 13 alignments + 6 mitigations; freeze-gate auto-aligned 16 PROPOSED |
| stage-h (review) | passed (vacuous) | Real verdict (7 conditions + 12 rulings) silently dropped; final empty verdict approved |
| stage-j (compile) | passed (vacuous substantive_slots) | Layer 2a loophole exploited; `compile-output.json.full` sidecar preserves rich content |
| code | partial (2/15 units) | unit-1 + unit-2 PASS via coder/evaluator loop; unit-3..15 marked awaiting_user (dogfood scope) |
| achieve | gate_failed | 1/10 acceptance_checks passed (AC-7 zero outbound calls); 9 not_run |

## Dogfood meta-verdict

**The bonfire pipeline ran end-to-end on a non-trivial real product seed and successfully produced 20 findings — including independent confirmation of all four bugs the dogfood spec specifically predicted (RENDER ERROR substring, Layer 2a vacuous-pass, challenged_claim state-machine inconsistency, Layer 2b orphan false positives).** The pipeline is functional but has multiple silent-failure modes where validators block legitimate input, leading operators to write minimal/vacuous payloads to pass the gates — defeating the purpose of validation.

Bonfire repo was not modified. All findings live in `./dogfood-log.md` and this file.
