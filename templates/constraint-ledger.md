# Constraint Ledger

**Generated:** {{replayed_at}}
**Total entries:** {{event_count}}

## Frozen Constraints

{{#each frozen_entries}}
### {{id}} ({{category}})
- **Content:** {{content}}
- **Rationale:** {{rationale}}
- **Challenged by:** {{challenged_by_str}}
- **Aligned by:** {{aligned_by_str}}
{{/each}}

## Proposed / Challenged

{{#each active_entries}}
### {{id}} [{{status}}] ({{category}})
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}

## Open Risks

{{#each risk_entries}}
### {{id}}
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}

## Discarded Options

{{#each discarded_entries}}
### {{id}}
- **Content:** {{content}}
- **Rationale:** {{rationale}}
{{/each}}
