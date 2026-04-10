# Code Handoff

← [[00-overview]] | See also: [[05-constraint-ledger]]

**Code Ready:** {{code_ready}}

## Summary

{{handoff_summary}}

## Retained Goal

{{retained_goal}}

## Implementation Scope

{{implementation_scope}}

## Frozen Product Decisions

{{#each frozen_product_decisions}}
- {{.}}
{{/each}}

## Implementation Units

{{#each implementation_units}}
### {{id}}: {{title}}

**Objective:** {{objective}}
**Scope:** {{scope}}
**Depends on:** {{depends_on}}
**Done when:** {{done_when}}
{{/each}}

## Verification Commands

{{#each verification_commands}}
- `{{.}}`
{{/each}}

## Acceptance Checks

{{#each acceptance_checks}}
- {{.}}
{{/each}}

## Reentry Triggers

{{#each reentry_triggers}}
- {{.}}
{{/each}}
