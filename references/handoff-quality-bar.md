# Handoff Quality Bar

Use this reference before setting `code_ready=true` in `compile-output.json#handoff`.

## Core Rule

The handoff is code-ready only if the next coder agent can implement without inventing high-impact meaning.

If the coder would still need to ask what the product means, how data should behave, or how success is judged, the handoff is not ready.

## Required Freeze Surface

The handoff must explicitly freeze:

- `repo_grounding`: repo facts that the plan depends on
- `frozen_product_decisions`: high-impact product semantics that may not drift
- `domain_model`: key entities, fields, states, and invariants
- `data_contract`: persistence or API behavior, even if the answer is "browser local state only"
- `ui_contract`: routes, panels, forms, views, and empty/error/loading states
- `function_contracts`: the concrete functions or modules the coder must create or modify
- `file_plan`: file-by-file change plan
- `implementation_units`: ordered execution units
- `verification_commands`: command-level checks
- `browser_checks`: user-visible walkthrough checks
- `acceptance_checks`: what must be true to call the work done

## Implementation Unit Bar

Every implementation unit must answer:

- what it changes
- why it exists
- which files it owns
- which functions or modules it creates or edits
- which earlier units it depends on
- how the coder verifies it before moving on
- what "done" means for that unit

## Web App Quality Bar

For React, Next.js, or Vite work, also freeze:

- state ownership
- optimistic or pessimistic persistence behavior
- copy for visible failure states
- browser interactions that must work on first open
- whether tests alone are sufficient or a browser pass is mandatory
- the exact visible UI pattern, not a disjunction such as "grouped or labeled"

## Failure Rule

If any of the above is left to "implementer decides", `code_ready` must remain `false`.

## Validation

The bonfire CLI validates handoff structure:

```bash
bonfire-tools.cjs handoff-validate
```

Required fields: `code_ready`, `handoff_summary`, `retained_goal`, `implementation_scope`, `implementation_units` (non-empty array).

## v2 schema — substantive content deep-check (Assertion 3a)

As of `schema_version: 2`, every slot in `handoff_substantive_slots` enforces
a structural deep-check at validation time, not just a shape hint:

- **`min_entries: 1`** (per_entry kind): the slot's array must have at least one entry.
- **`required_subfields: [name, ...]`**: each entry (per_entry) or the section itself (whole_section) must contain these subfields, and each must pass `isEmptyOrPlaceholder = false`.

`isEmptyOrPlaceholder` rejects: null, undefined, empty arrays/objects, empty
or whitespace-only strings, and registered placeholder strings (`TODO`,
`see ledger`, `...`, `<TBD>`, `<placeholder>`, case-insensitive).

The existing `no_substantive_contract` escape valve continues to work but
now uses a ref-only check: the `no_substantive_contract_reason` must contain
≥1 ledger ID matching `schema.ledger_id_pattern` that resolves against the
active FROZEN ledger snapshot. The previous prose token-coverage check on
the reason field has been removed (see ASSERTION-3a spec DQ-1).
