# legit-no-substantive-contract — Class B: Valid Escape Valve

## Scenario

Legitimate case: a handoff for a pure UI feature that genuinely has no domain
entity model. The `domain_model.entities` slot is empty (`[]`), but the
operator has properly invoked the `no_substantive_contract` escape valve on the
`domain_model` container with a valid `no_substantive_contract_reason` that
contains a ledger ref (CON-001) resolving to a FROZEN entry.

Escape valve details:
- `domain_model.no_substantive_contract`: `true`
- `domain_model.no_substantive_contract_reason`: prose with embedded `CON-001`
  reference that resolves in the active FROZEN ledger snapshot
- CON-001 in constraint-ledger-history.jsonl: propose → freeze sequence

All other substantive slots (function_contracts, data_contract, ui_contract)
carry fully substantive content that passes the deep-check without requiring
escape.

## Expected validator behavior

`handoff-validate` MUST exit 0. The deep-check for `handoff.domain_model.entities`
detects `no_substantive_contract=true` on the container, validates the ref via
`validateLedgerRef`, finds CON-001 in the FROZEN snapshot, and skips the slot.
All other slots pass their required_subfields checks.

## Spec pin

Spec §7.2 Class B — `legit-no-substantive-contract` is the canonical valid
escape valve fixture. Implementation plan step 2.18.
