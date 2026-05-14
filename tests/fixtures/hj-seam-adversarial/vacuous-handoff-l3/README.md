# vacuous-handoff-l3 — Attack Level L3: Placeholder Strings

## Scenario

Attack level L3: required_subfields are present with non-empty, non-whitespace
values, but every value is a registered placeholder string from the
PLACEHOLDER_STRINGS constant in bin/lib/validation-helpers.cjs. These strings
pass visual inspection and naive string-length checks but convey zero semantic
content.

Placeholder strings used:
- `"TODO"` — classic deferred-work marker
- `"see ledger"` — empty deferral to ledger (no substantive info)
- `"..."` — ellipsis placeholder
- `"<TBD>"` — angle-bracket TBD variant
- `"<placeholder>"` — explicit placeholder marker
- `"TBD"` — bare TBD (case-insensitive match)
- `"placeholder"` — bare word variant

The values cover all registered placeholder strings across the slot battery.

## Expected validator behavior

`handoff-validate` MUST exit non-zero. `isEmptyOrPlaceholder` normalizes each
value to lowercase and checks against the PLACEHOLDER_STRINGS list.

Expected error pattern: `deep_check_failed` in output, mentioning
`empty or placeholder`.

## Spec pin

Spec §7.1 Class A — `vacuous-handoff-l3` is the canonical L3 fixture.
Implementation plan steps 2.15-2.16.
