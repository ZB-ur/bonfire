# Evidence: 2026-05-08 Bilibili 弹幕降噪 Chrome 插件 dogfood (clean run)

**Pipeline**: `/bonfire:pre` → `/bonfire:plan` → `/bonfire:code` → `/bonfire:achieve`
**Seed (verbatim)**: `做一个 B 站直播间弹幕降噪 Chrome 插件`
**Operator session**: autonomous, fresh Claude Code session at `/Users/lddmay/AiCoding/bonfire-test/bilibili-danmaku-denoiser-clean/`. No memory contamination from bonfire repo session.
**Bonfire CLI under test**: deployed at `$HOME/.claude/bonfire/` from branch `fix/bonfire-production-gap` HEAD `dbfaab3` (includes commits `64230c7` SKILL achieve null→"" + `dbfaab3` renderer run_id injection).

## Run summary

- All 9 plan stages PASSED (some vacuously — see findings)
- Code: unit-1 + unit-2 PASS via coder/evaluator loop; unit-3..15 awaiting_user (intentional dogfood scope cap)
- Achieve: `gate_failed` (1/10 acceptance_checks passed; 9 not_run because units 3-15 not implemented)
- 20 findings: 3 🔴 blocker / 12 🟠 production-grade / 3 🟡 ergonomic / 2 🟢 observation-only

## Entry points for review

- **`dogfood-summary.md`** — meta-verdict, top 3 production-grade gaps, stage status table, persona description
- **`dogfood-log.md`** — full 20 findings with symptom/expected/actual/severity/workaround/hypothesis per entry
- **`.bonfire/bundle/`** — 18 rendered markdown bundles (one per stage + canonical-contracts + crosswalks)
- **`.bonfire/plan/`** — D-critique / G-Red / G-Blue / H-Review / J-Compile delta JSON files
- **`.bonfire/truth-surface/constraint-ledger-snapshot.json`** — final ledger (frozen + open + risks)
- **`src/`** — actual code produced for unit-1 (MV3 skeleton + manifest + toolchain) and unit-2 (shared types/settings/messaging)

## Predicted bugs all confirmed

The dogfood spec predicted four production-grade gaps; the clean operator independently reproduced all four:

| Predicted | Confirmed at | Clean finding # |
|---|---|---|
| RENDER ERROR substring residue | Stages A/B/C/E/J (5 stages, ~17 rounds) | #2/#3/#4/#7/#20 |
| Layer 2a vacuous-pass loophole | Empty `domain_model` + `function_contracts` + `data_contract` + `ui_contract` with `code_ready=true` → `{"valid":true}` | #19 |
| `challenged_claim` state-machine inconsistency | `status=CHALLENGED` + `challenged_by=[]` simultaneously | #1 |
| Layer 2b orphan-token false-positive (>50) | >100 orphans on normal English/Chinese/path tokens | #14 |

## Three blockers (root-cause failures of bonfire's design promises)

1. **Stage H VACUOUS PASS** (finding #18) — H-Review's substantive 7 conditions + 12 rulings all silently dropped by validators (apply-h-rulings batch-rejects RISK freezes; state-advance Layer 2b rejects condition prose). Operator one-shot rewrite to empty/approved → stage PASS.
2. **Stage J Layer 2a vacuous-pass loophole** (finding #19) — exact prediction reproduced. Empty handoff slots pass validation; coder must invent product semantics.
3. **Maturity gate freeze deadlock** (finding #15) — `truth-freeze` rejects 19 unchallenged PROPOSED entries; only undocumented `stage-g-freeze-gate` unblocks. stage-playbook line 122 misleads operator into manual `truth-freeze` loop.

## Sibling evidence

- `../2026-05-08-bilibili-danmaku-contaminated/` — same seed, paused mid-Stage A by bonfire-architect session. Preserved as **stance-contamination demonstration** — overlap on the one finding I caught (CHA-001 empty challenged_by) was zero, but stance bias prevented systematic adversarial probing. See that dir's `STANCE-NOTE.md`.
- `../../2026-05-04-gto-trainer-v0.1-dogfood-findings/` (memory: `dogfood-2026-05-04-findings.md`) — first dogfood, 7 findings; confirms #1 (`challenged_claim` empty `challenged_by`) is **second independent observation**, raising the production-grade signal.

## Round-4 ASSERTION-4 calibration relevance

This evidence + the gto-trainer archive give errata-001's required `≥2 dogfood archives` for any positive THRESHOLD calibration. The handoff prose tokenization data (`compile-output.json` + `compile-output.json.full` sidecar) is the empirical input for Layer 2b orphan-ratio recalibration.
