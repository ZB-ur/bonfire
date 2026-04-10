# Execution Manifest

← [[90-code-handoff]]

## Execution Order

{{#each phases}}
### Phase {{phase_number}}: {{title}}

{{#each units}}
- **{{id}}**: {{title}} (depends on: {{depends_on}})
{{/each}}
{{/each}}
