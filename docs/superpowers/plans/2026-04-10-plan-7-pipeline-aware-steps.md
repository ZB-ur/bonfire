# Bonfire Plan 7: Pipeline-Aware Step Architecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every step in state.json carry a `pipeline` field so the system correctly handles the dynamic `code` pipeline (pre→plan→code→achieve, not pre→plan→achieve).

**Architecture:** Schema declares `pipeline_order` for static pipeline sequence. `step_order` remains the initialization template. State.json becomes the runtime truth — every step is self-describing via its `pipeline` field. Four helper functions in state.cjs are refactored to query state first, fall back to schema.

**Tech Stack:** Node.js (state.cjs, init.cjs). JSON schema. Tests.

**Depends on:** Plans 1–6 (completed).

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `schemas/bonfire-v1.json` | Add `pipeline_order` field |
| Modify | `bin/lib/state.cjs` | Rewrite 4 helpers + update all callers |
| Modify | `bin/lib/init.cjs` | Add `pipeline: 'pre'` to stage-a step |
| Modify | `tests/test-state.js` | Update existing + add 4 new tests |
| Modify | `tests/test-foundation.js` | Add pipeline_order schema test |

---

### Task 1: Schema — Add pipeline_order

**Files:**
- Modify: `schemas/bonfire-v1.json`

- [ ] **Step 1: Add pipeline_order before step_order**

In `schemas/bonfire-v1.json`, insert before the `"step_order"` key:

```json
"pipeline_order": ["pre", "plan", "code", "achieve"],
```

`step_order` stays unchanged — no `code` key. Code steps are dynamic.

- [ ] **Step 2: Add schema test**

In `tests/test-foundation.js`, add after the last test:

```javascript
test('schema has pipeline_order with 4 pipelines', () => {
  const { loadSchema } = require('../bin/lib/utils.cjs');
  const schema = loadSchema();
  assert.deepStrictEqual(schema.pipeline_order, ['pre', 'plan', 'code', 'achieve']);
});
```

- [ ] **Step 3: Run foundation tests**

```bash
node --test tests/test-foundation.js
```

- [ ] **Step 4: Commit**

```bash
git add schemas/bonfire-v1.json tests/test-foundation.js
git commit -m "schema: add pipeline_order field for explicit pipeline sequencing"
```

---

### Task 2: state.cjs — Rewrite 4 Helpers

**Files:**
- Modify: `bin/lib/state.cjs`

- [ ] **Step 1: Rewrite pipelineOrder**

```javascript
// Old (line 37-39)
function pipelineOrder(schema) {
  return Object.keys(schema.step_order);
}

// New
function pipelineOrder(schema) {
  return schema.pipeline_order || Object.keys(schema.step_order);
}
```

- [ ] **Step 2: Rewrite stepsForPipeline**

```javascript
// Old (line 32-34)
function stepsForPipeline(schema, pipelineStage) {
  return (schema.step_order[pipelineStage] || []);
}

// New — state is runtime truth, schema is fallback for init
function stepsForPipeline(schema, pipelineStage, state) {
  if (state && state.steps) {
    const steps = [];
    for (const [name, info] of Object.entries(state.steps)) {
      if (info.pipeline === pipelineStage) {
        steps.push(name);
      }
    }
    if (steps.length > 0) return steps;
  }
  return (schema.step_order[pipelineStage] || []);
}
```

- [ ] **Step 3: Rewrite findPipelineForStep**

```javascript
// Old (line 42-46)
function findPipelineForStep(schema, stepName) {
  for (const [pipeline, steps] of Object.entries(schema.step_order)) {
    if (steps.includes(stepName)) return pipeline;
  }
  return null;
}

// New — state first, schema fallback
function findPipelineForStep(schema, stepName, state) {
  if (state && state.steps && state.steps[stepName] && state.steps[stepName].pipeline) {
    return state.steps[stepName].pipeline;
  }
  for (const [pipeline, steps] of Object.entries(schema.step_order)) {
    if (steps.includes(stepName)) return pipeline;
  }
  return null;
}
```

- [ ] **Step 4: Rewrite initPipelineSteps**

```javascript
// Old (line 50-56)
function initPipelineSteps(schema, pipelineStage) {
  const steps = {};
  for (const step of stepsForPipeline(schema, pipelineStage)) {
    steps[step] = { status: 'pending' };
  }
  return steps;
}

// New — each step carries pipeline field
function initPipelineSteps(schema, pipelineStage) {
  const steps = {};
  for (const step of (schema.step_order[pipelineStage] || [])) {
    steps[step] = { status: 'pending', pipeline: pipelineStage };
  }
  return steps;
}
```

- [ ] **Step 5: Commit helpers**

```bash
git add bin/lib/state.cjs
git commit -m "refactor: rewrite state helpers for pipeline-aware step queries"
```

---

### Task 3: state.cjs — Update All Callers

**Files:**
- Modify: `bin/lib/state.cjs`

- [ ] **Step 1: Update stateStep — infer pipeline on auto-create**

```javascript
// Old (line 84-85)
  if (!state.steps[stepName]) {
    state.steps[stepName] = {};
  }

// New
  if (!state.steps[stepName]) {
    const pipeline = findPipelineForStep(schema, stepName, state);
    state.steps[stepName] = { pipeline: pipeline };
  }
```

- [ ] **Step 2: Update stateAdvance — pass state to helpers + handle empty pipeline**

Line 121: `stepsForPipeline(schema, currentPipeline)` → `stepsForPipeline(schema, currentPipeline, state)`

Line 145: `stepsForPipeline(schema, nextPipeline)` → `stepsForPipeline(schema, nextPipeline, state)`

Lines 150-153 (init next pipeline steps): replace with `initPipelineSteps` call:

```javascript
// Old
    for (const step of nextSteps) {
      if (!state.steps[step]) {
        state.steps[step] = { status: 'pending' };
      }
    }

// New
    const newSteps = initPipelineSteps(schema, nextPipeline);
    for (const [step, info] of Object.entries(newSteps)) {
      if (!state.steps[step]) {
        state.steps[step] = info;
      }
    }
```

Lines 157-159 (current_step): handle empty nextSteps:

```javascript
// Old
    if (nextSteps.length > 0) {
      state.current_step = nextSteps[0];
    }

// New
    if (nextSteps.length > 0) {
      state.current_step = nextSteps[0];
    } else {
      state.current_step = null;
    }
```

- [ ] **Step 3: Update stateReentry — preserve pipeline on range reset**

Cross-pipeline path (line 203): preserve pipeline field:

```javascript
// Old
    state.steps[route.to] = { status: 'pending' };

// New
    const existingPipeline = state.steps[route.to] && state.steps[route.to].pipeline;
    state.steps[route.to] = { status: 'pending', pipeline: existingPipeline || findPipelineForStep(schema, route.to, state) };
```

Non-cross-pipeline path: pass state to helpers (lines 240-241):

```javascript
// Old
    const targetPipeline = findPipelineForStep(schema, targetStep);
    const targetSteps = stepsForPipeline(schema, targetPipeline);

// New
    const targetPipeline = findPipelineForStep(schema, targetStep, state);
    const targetSteps = stepsForPipeline(schema, targetPipeline, state);
```

Range reset loop (lines 251-253): preserve pipeline:

```javascript
// Old
      if (state.steps[step]) {
        state.steps[step] = { status: 'pending' };
      }

// New
      if (state.steps[step]) {
        state.steps[step] = { status: 'pending', pipeline: state.steps[step].pipeline };
      }
```

- [ ] **Step 4: Update statePendingReentry — load state before findPipelineForStep**

```javascript
// Old (lines 300-305)
  const targetStep = route.to;
  const targetPipeline = findPipelineForStep(schema, targetStep);

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

// New — load state first so findPipelineForStep can use it
  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  const targetStep = route.to;
  const targetPipeline = findPipelineForStep(schema, targetStep, state);
```

- [ ] **Step 5: Update stateInitCodeSteps — add pipeline: 'code'**

```javascript
// Old (line 395)
    steps[stepName] = { status: 'pending' };

// New
    steps[stepName] = { status: 'pending', pipeline: 'code' };
```

Also fix potential null dereference on current_step (line 402):

```javascript
// Old
  if (units.length > 0 && !state.current_step.startsWith('unit-')) {

// New
  if (units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))) {
```

- [ ] **Step 6: Commit callers**

```bash
git add bin/lib/state.cjs
git commit -m "refactor: update all state.cjs callers for pipeline-aware helpers"
```

---

### Task 4: init.cjs — Pipeline Field on stage-a

**Files:**
- Modify: `bin/lib/init.cjs`

- [ ] **Step 1: Add pipeline field to stage-a init**

```javascript
// Old (line 35)
      'stage-a': { status: 'pending' }

// New
      'stage-a': { status: 'pending', pipeline: 'pre' }
```

- [ ] **Step 2: Commit**

```bash
git add bin/lib/init.cjs
git commit -m "fix: add pipeline field to stage-a in init"
```

---

### Task 5: Update Existing Tests

**Files:**
- Modify: `tests/test-state.js`

All existing tests use `initCase(dir)` which calls `init` — after Task 4, the init'd state already has `pipeline: 'pre'` on stage-a. Tests that assert on step objects now get objects with the pipeline field.

- [ ] **Step 1: Update state-advance test assertions**

The test `state-advance moves pipeline from pre to plan` checks `state.steps['stage-b']`. After the refactor, stage-b will have `{ status: 'pending', pipeline: 'plan' }`. The existing `assert.ok(state.steps['stage-b'])` still passes. No change needed.

- [ ] **Step 2: Update state-reentry test assertions**

The test `state-reentry resets steps from target to current` checks:
```javascript
assert.equal(state.steps['stage-c'].status, 'pending');
```
After refactor, the reset step is `{ status: 'pending', pipeline: 'plan' }`. The `.status` assertion still works. But add pipeline preservation check:

```javascript
// Add after existing assertions
assert.equal(state.steps['stage-c'].pipeline, 'plan');
assert.equal(state.steps['stage-d'].pipeline, 'plan');
assert.equal(state.steps['stage-e'].pipeline, 'plan');
```

- [ ] **Step 3: Update goal_conflict reentry test**

The test `state-reentry with goal_conflict crosses pipeline to pre` resets stage-a. Add:

```javascript
assert.equal(state.steps['stage-a'].pipeline, 'pre');
```

- [ ] **Step 4: Run existing tests**

```bash
node --test tests/test-state.js
```

All 9 should pass.

- [ ] **Step 5: Commit**

```bash
git add tests/test-state.js
git commit -m "test: add pipeline field assertions to existing state tests"
```

---

### Task 6: Add New Tests

**Files:**
- Modify: `tests/test-state.js`

- [ ] **Step 1: Add test — advance from plan to code**

```javascript
test('state-advance from plan last step sets pipeline_stage to code', () => {
  const dir = makeTmpDir();
  initCase(dir);
  // Advance through pre → plan
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  // Advance through all plan steps
  const planSteps = ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f', 'stage-g', 'stage-h', 'stage-j'];
  for (const step of planSteps) {
    execFileSync('node', [CLI, 'state-step', '--step', step, '--status', 'passed'], { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'state-advance', '--step', step], { encoding: 'utf8', cwd: dir });
  }
  const state = readState(dir);
  assert.equal(state.pipeline_stage, 'code');
  assert.equal(state.current_step, null); // code steps injected later
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Add test — init-code-steps creates steps with pipeline field**

```javascript
test('state-init-code-steps creates unit steps with pipeline code', () => {
  const dir = makeTmpDir();
  initCase(dir);
  // Setup: advance to code pipeline
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const planSteps = ['stage-b', 'stage-c', 'stage-d', 'stage-e', 'stage-f', 'stage-g', 'stage-h', 'stage-j'];
  for (const step of planSteps) {
    execFileSync('node', [CLI, 'state-step', '--step', step, '--status', 'passed'], { encoding: 'utf8', cwd: dir });
    execFileSync('node', [CLI, 'state-advance', '--step', step], { encoding: 'utf8', cwd: dir });
  }
  // Create compile-output.json with 2 units
  const coPath = path.join(dir, '.bonfire', 'plan', 'compile-output.json');
  fs.writeFileSync(coPath, JSON.stringify({
    units: [{ id: 'unit-1' }, { id: 'unit-2' }],
    handoff: { code_ready: true, implementation_units: [{}, {}] }
  }));
  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.steps['unit-1'].pipeline, 'code');
  assert.equal(state.steps['unit-2'].pipeline, 'code');
  assert.equal(state.steps['unit-1'].status, 'pending');
  assert.equal(state.current_step, 'unit-1');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3: Add test — init produces stage-a with pipeline field**

```javascript
test('init creates stage-a with pipeline pre', () => {
  const dir = makeTmpDir();
  initCase(dir);
  const state = readState(dir);
  assert.equal(state.steps['stage-a'].pipeline, 'pre');
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 4: Add test — approval set on advance past stage-a**

```javascript
test('state-advance past stage-a sets approval', () => {
  const dir = makeTmpDir();
  initCase(dir);
  execFileSync('node', [CLI, 'state-step', '--step', 'stage-a', '--status', 'passed'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'state-advance', '--step', 'stage-a'], { encoding: 'utf8', cwd: dir });
  const state = readState(dir);
  assert.equal(state.approval.stage_a_approved, true);
  assert.ok(state.approval.stage_a_approved_at);
  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 5: Run all tests**

```bash
node --test tests/*.js
```

- [ ] **Step 6: Commit**

```bash
git add tests/test-state.js
git commit -m "test: add pipeline-aware state tests (code pipeline, init, approval)"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
node --test tests/*.js
```

Expected: 93 existing + 1 schema + 4 new state = 98 tests.

- [ ] **Step 2: Verify pipeline_order in schema**

```bash
node -e "const s = require('./schemas/bonfire-v1.json'); console.log(s.pipeline_order)"
```

Expected: `[ 'pre', 'plan', 'code', 'achieve' ]`

- [ ] **Step 3: Verify advance pre→plan→code**

```bash
# Quick manual verification via CLI
dir=$(mktemp -d)
node bin/bonfire-tools.cjs init --request test --project-root "$dir"
cd "$dir"
node /Users/lddmay/AiCoding/bonfire/bin/bonfire-tools.cjs state-step --step stage-a --status passed
node /Users/lddmay/AiCoding/bonfire/bin/bonfire-tools.cjs state-advance --step stage-a
# Advance all plan steps
for s in stage-b stage-c stage-d stage-e stage-f stage-g stage-h stage-j; do
  node /Users/lddmay/AiCoding/bonfire/bin/bonfire-tools.cjs state-step --step $s --status passed
  node /Users/lddmay/AiCoding/bonfire/bin/bonfire-tools.cjs state-advance --step $s
done
node /Users/lddmay/AiCoding/bonfire/bin/bonfire-tools.cjs state-read | node -e "const s=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('pipeline:', s.pipeline_stage, 'step:', s.current_step)"
cd -
rm -rf "$dir"
```

Expected: `pipeline: code step: null`
