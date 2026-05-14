# Evidence: 2026-05-08 Bilibili 弹幕降噪 dogfood (contaminated, paused mid-Stage A)

**Status**: paused mid-Stage A; not a complete pipeline run. Preserved as **stance-contamination demonstration**.

**Why archived**: when paired with the sibling clean run at `../2026-05-08-bilibili-danmaku-clean/`, this directory provides empirical evidence that operator-stance contamination is structurally distinct from memory-state contamination.

## Setup

Same seed (`做一个 B 站直播间弹幕降噪 Chrome 插件`) and same deployed bonfire CLI as the clean run. The only variable changed: the operator was run inside the bonfire-architect's Claude Code session at `/Users/lddmay/AiCoding/bonfire/`, with full memory of bonfire repo internals, recent commits (`64230c7`, `dbfaab3`), and the entire production-gap audit history.

## Run state at pause

- Stage A: `awaiting_user` (running, support agents complete)
- Three support agents spawned and returned: intent-extractor, reality-checker, blind-spot-scout
- 5 truth-surface entries seeded: CON-001/002/003 confirmed_fact, CHA-001 challenged_claim, RISK-001 high_impact_risk
- One finding observed before pause: CHA-001 created with `challenged_by: []` while `status=CHALLENGED` — the same `challenged_claim` state-machine inconsistency the gto-trainer dogfood originally surfaced and the clean run subsequently confirmed (clean finding #1)
- User question loop entered (Q1 = noise definition) but never answered — pause triggered when bonfire architect noticed operator-role contamination

## Contamination diagnosis

Comparing this against the clean run's 20 findings:

**Single-finding overlap**: 1 (the CHA-001 issue). On this point, contamination on the substantive observation is **zero** — the architect-operator and the naive-operator both saw it.

**Structural stance contamination is the dominant signal, not finding overlap**: even with the literally identical seed, identical CLI, identical agent outputs, the architect-operator unconsciously played "good student of bonfire" — dutifully recording `confirmed_fact` entries from the reality-checker's output and treating Stage A as a successful preprocessing run. The clean operator played adversary from turn 1: every CLI invocation was an attempt to find a gate that pretends to validate but doesn't. The 20 vs 1 finding count gap is the structural cost.

This means **memory-clearing is necessary but not sufficient to defeat stance contamination**. The architect-operator carries internalized "bonfire works as designed" priors that no SessionStart context-clearing can erase. For round-4 calibration evidence and any future production-gap dogfood, the operator must be a session with no design-intent priors.

## What this archive is good for

- **Round-4 ASSERTION-4 calibration**: do **NOT** include in the `≥2 dogfood archives` count. Use only `2026-05-04-gto-trainer-v0.1-dogfood` and `../2026-05-08-bilibili-danmaku-clean/`.
- **Stance-contamination methodology paper**: this is a 1-data-point demonstration that stance > memory as the contamination axis.
- **Future dogfood operator instruction refinement**: the prompt template that ran the clean session is the canonical "naive operator" briefing — see project memory `bonfire-project-state.md` step (c) for the prompt content.

## Sibling evidence

- `../2026-05-08-bilibili-danmaku-clean/EVIDENCE-NOTE.md` — full pipeline run, 20 findings, this is the scientific evidence
