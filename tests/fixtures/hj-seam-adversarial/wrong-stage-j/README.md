# wrong-stage-j

**Attack:** Condition uses `target_stage: stage-c` (bypasses stage-j restriction).

**Expected catch:** Schema validation (Task 2) — `condition_item_shape` enforces
`target_stage_enum: ["stage-j"]`.
