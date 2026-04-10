# Obsidian Layout

## Default Folder

Rendered bundle lives in `.bonfire/bundle/`. User opens this directory (or a parent) as an Obsidian vault.

## Required Files (bundle/)

| File | Source |
|------|--------|
| `00-overview.md` | case.json |
| `05-constraint-ledger.md` | truth-surface/constraint-ledger-snapshot.json |
| `10-a-preprocess.md` | case.json#stages.preprocess |
| `20-b-divergence.md` | case.json#stages.divergence |
| `30-c-requirements.md` | case.json#stages.requirements |
| `40-d-critique.md` | plan/bonfire-d-critique-delta.json |
| `50-e-closure.md` | case.json#stages.closure |
| `60-f-probes.md` | case.json#stages.probes |
| `70-g-red-blue.md` | plan/bonfire-g-red-delta.json + plan/bonfire-g-blue-delta.json |
| `80-h-review.md` | plan/h-review-verdict.json |
| `90-code-handoff.md` | plan/compile-output.json#handoff |
| `91-canonical-contracts.md` | plan/compile-output.json#canonical_contracts |
| `92-constraint-crosswalk.md` | plan/compile-output.json#constraint_crosswalk |
| `95-execution-manifest.md` | plan/compile-output.json#execution_manifest |
| `96-code-batches.md` | plan/compile-output.json#code_batches |
| `97-code-preflight.md` | plan/compile-output.json#code_preflight |
| `98-j-compile-for-code.md` | plan/compile-output.json#compile_summary |
| `99-final-handoff.md` | plan/compile-output.json#final_handoff |

## Optional Files (runs/)

| File | When |
|------|------|
| `runs/<run-id>/00-code-run.md` | After /code completes |
| `runs/<run-id>/01-verification.md` | After verification pass |
| `runs/<run-id>/02-reentry.md` | When /code blocks or refuses |
| `runs/<run-id>/03-achieve.md` | When /achieve is executed |

## Section Order

For `00-overview.md`:

1. Title
2. Summary
3. Source request
4. Stage status index
5. Paths

For every stage note:

1. Title
2. Navigation line (prev/next links)
3. Goal
4. Narrative
5. Key points
6. Decisions
7. Open questions
8. Next actions

For artifact notes (05, 90-99):

1. Title
2. Link back to `[[00-overview]]`
3. Goal or role summary
4. Key sections exposing frozen content

## Link Conventions

- Link every note back to `[[00-overview]]`.
- Link stage notes to immediate previous and next notes.
- Keep wikilinks filename-based without `.md` extension.
- Link `00-code-run.md` to `[[90-code-handoff]]`.
- Link `01-verification.md`, `02-reentry.md`, and `03-achieve.md` back to `[[00-code-run]]`.

## Numbering Convention

All note IDs, filenames, and numbering are defined declaratively in `bonfire-v1.json`. The renderer reads the schema — no numbering is hardcoded in templates or code.
