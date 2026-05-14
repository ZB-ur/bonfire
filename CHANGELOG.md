# Changelog

## [unreleased] — 2026-05-09

### Changed
- **BREAKING**: `schema_version` bumped from 1 to 2. `handoff_substantive_slots`
  field name `fields` renamed to `required_subfields`. Existing v1 inputs are
  rejected by v2 validators at entry. Migration: re-init or freeze workspaces
  at v1.

### Added
- Assertion 3a: structural deep-check at H verdict and J handoff. Closes
  vacuous-pass surface surfaced by 2026-05-04 gto-trainer and 2026-05-08
  bilibili-danmaku-denoiser dogfood runs. See
  `docs/superpowers/specs/2026-05-08-bonfire-assertion-3a-validation-theater-design.md`.
- New top-level `ledger_id_prefixes` and `ledger_id_pattern` constants in
  `bonfire-v1.json` (closes DQ-4 from spec).
- New `verdict_substantive_check` schema config and shared
  `bin/lib/validation-helpers.cjs` module (`isEmptyOrPlaceholder`,
  `validateLedgerRef`, `extractLedgerRefs`).
