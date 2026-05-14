# vacuous-handoff-l0 — Attack Level L0: Empty Containers

## Scenario

Attack level L0: all substantive slots in the handoff contain empty containers
(empty arrays, empty objects). The data is structurally valid JSON but contains
zero semantic payload.

Slots under attack:
- `domain_model.entities`: `[]` — empty array, zero domain entity definitions
- `function_contracts`: `[]` — empty array, zero function contracts
- `data_contract`: provenance metadata only, no `schema` field
- `ui_contract.panels`: `[]` — empty array, zero panel definitions
- `ui_contract.state_ownership`: `{}` — empty object, no owner_map
- `ui_contract.empty_states`: `{}` — empty object, no surfaces/messaging
- `ui_contract.error_states`: `{}` — empty object, no error_map

## Expected validator behavior

`handoff-validate` MUST exit non-zero. The `deepCheckHandoffSubstantiveSlots`
function (ASSERTION-3a §6.3, §6.7 IP1) runs BEFORE Layer 2a provenance checks
and rejects on the first slot with too few entries (min_entries=1) or missing
required_subfields.

Expected error pattern: `deep_check_failed` in the output, naming the first
violating slot (likely `handoff.domain_model.entities` or `handoff.function_contracts`).

## Spec pin

Spec §7.1 Class A — `vacuous-handoff-l0` is the canonical L0 fixture.
Implementation plan steps 2.12-2.13.
