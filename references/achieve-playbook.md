# Achieve Playbook

Use this playbook during `/bonfire:achieve` for final validation, closure, and archival judgment after `/code`.

## Goal

Determine whether the delivered result satisfies the frozen acceptance meaning from the handoff, then record whether the case should be archived as closed evidence or left open.

## Inputs

- Validated bundle (`bundle-validate`)
- Latest code run evidence (`runs/<run-id>/code-run.json`)
- Acceptance checks from handoff
- Verification evidence from tests, builds, and browser checks
- Truth surface snapshot (for high_impact_risk review)

## Process

1. **Bundle integrity check**: `bonfire-tools.cjs bundle-validate`
2. **Verification review**: confirm global_verification passed, browser_checks passed
3. **Acceptance verdict**: present to user with acceptance_checks listed one by one
4. **Archive decision**: based on user verdict

## Required Output

Write `runs/<run-id>/achieve.json` with:

- `verdict`
- `acceptance_results`
- `followups`
- `failure_reason`
- `judged_at`

## Allowed Verdicts

| Verdict | Meaning | Archive |
|---------|---------|---------|
| `achieved` | All acceptance passed | Archive case |
| `achieved_with_followups` | Passed with follow-up items | Archive case |
| `not_achieved` | Failed | Case stays active |

## Rules

- Do not weaken acceptance meaning after the fact.
- Do not call a run achieved if the first-load experience is visibly broken.
- If achieved or achieved_with_followups: `bonfire-tools.cjs archive --name <date>-<title>`
- If not_achieved: case stays active. User decides:
  - Re-execute `/bonfire:code` (new run)
  - Reentry to `/bonfire:plan` (manually set pending_reentry)
