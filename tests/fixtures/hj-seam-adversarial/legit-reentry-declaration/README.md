# legit-reentry-declaration

**This is NOT an attack fixture.** Unlike its 10 siblings under
`hj-seam-adversarial/`, this case represents J-Compile behaving correctly:
when a stage-h condition demands content that cannot be written without
inventing, J emits a top-level `reentry_request` field (sibling of
`handoff`) with `code_ready: false`, asking the pipeline to reenter
stage-h instead of compiling invented semantics.

The fixture validates the **wire integrity** of the reentry signal:

1. `validateHandoff` recognizes the structured request shape
2. `bin/bonfire-tools.cjs::handoffValidateCommand` surfaces it on stdout
   (exit code 1) instead of collapsing to a generic
   `handoff_incomplete` failure
3. Skill-layer routing can then dispatch on the declared `conflict_type`

For the conflict_type taxonomy and the substring rule that classifies
`aligned_by` tokens, see `docs/superpowers/specs/2026-04-18-bonfire-hj-seam-hardening-design.md`.
