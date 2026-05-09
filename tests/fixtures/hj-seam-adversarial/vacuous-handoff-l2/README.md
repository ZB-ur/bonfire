# vacuous-handoff-l2 — Attack Level L2: Empty/Null/Whitespace Subfields

## Scenario

Attack level L2: required_subfields are present as keys but their values are
empty strings, null, or whitespace-only strings. The array/object structure
fully satisfies L0 and L1 checks; the attack only survives deeper content-
presence checks.

Slots under attack:
- `domain_model.entities[0].name`: `""` — empty string
- `domain_model.entities[0].fields`: `null`
- `function_contracts[0].purpose`: `"  "` — whitespace-only
- `function_contracts[0].invariants`: `""` — empty string
- `function_contracts[0].failure_modes`: `null`
- `data_contract.schema`: `""` — empty string
- `ui_contract.panels[0].description`: `null`
- `ui_contract.panels[0].elements`: `""` — empty string
- `ui_contract.panels[0].states`: `"  "` — whitespace-only
- `ui_contract.state_ownership.owner_map`: `null`
- `ui_contract.empty_states.surfaces`: `null`
- `ui_contract.empty_states.messaging`: `""`
- `ui_contract.error_states.error_map`: `null`

## Expected validator behavior

`handoff-validate` MUST exit non-zero. `isEmptyOrPlaceholder` returns true for
null, empty string, and whitespace-only string. The deep-check rejects on the
first violating required_subfield, reporting empty or placeholder.

Expected error pattern: `deep_check_failed` in output, mentioning
`empty or placeholder`.

## Spec pin

Spec §7.1 Class A — `vacuous-handoff-l2` is the canonical L2 fixture.
Implementation plan steps 2.14-2.15.
