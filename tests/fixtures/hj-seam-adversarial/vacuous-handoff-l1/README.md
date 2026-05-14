# vacuous-handoff-l1 — Attack Level L1: [{}] Shape

## Scenario

Attack level L1: per-entry slots have non-empty arrays but each element is an
empty object `{}`. The arrays satisfy `length >= 1` but the entries contain no
required_subfields.

Slots under attack:
- `domain_model.entities`: `[{}]` — one entity, but no `name` or `fields`
- `function_contracts`: `[{}]` — one contract, but no `purpose`, `invariants`,
  or `failure_modes`
- `ui_contract.panels`: `[{}]` — one panel, but no `description`, `elements`,
  or `states`

Other whole-section slots (state_ownership, empty_states, error_states) are
given minimal valid content so this fixture isolates the per-entry L1 attack.

## Expected validator behavior

`handoff-validate` MUST exit non-zero. `deepCheckHandoffSubstantiveSlots`
checks each entry for required_subfields after asserting `length >= min_entries`.
An empty object `{}` has no subfields at all, so `entry["name"]` is undefined,
which `isEmptyOrPlaceholder(undefined)` returns true for.

Expected error pattern: `deep_check_failed` in output, with the violating slot
path and the missing required_subfield name.

## Spec pin

Spec §7.1 Class A — `vacuous-handoff-l1` is the canonical L1 fixture.
Implementation plan steps 2.13-2.14.
