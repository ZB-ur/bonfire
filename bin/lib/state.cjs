'use strict';

const fs = require('fs');
const path = require('path');
const { writeAtomic, loadJSON, timestamp, loadSchema, resolveRoot, exitJSON, exitError } = require('./utils.cjs');

// ─── Internal helpers ────────────────────────────────────────────────────────

function loadState(root) {
  // root is the .bonfire/ directory
  return loadJSON(path.join(root, 'state.json'));
}

function saveState(root, state) {
  state.updated_at = timestamp();
  writeAtomic(path.join(root, 'state.json'), state);
}

function getRoot() {
  const root = resolveRoot(process.cwd());
  if (!root) exitError('No .bonfire/ directory found in current directory', [], 3);
  return root;
}

function getSchema() {
  const schema = loadSchema();
  if (!schema) exitError('Cannot load bonfire-v1.json schema', [], 3);
  return schema;
}

// Get ordered list of steps for a pipeline stage
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

// Get all pipeline stage names in order
function pipelineOrder(schema) {
  return schema.pipeline_order || Object.keys(schema.step_order);
}

// Find which pipeline a step belongs to
function findPipelineForStep(schema, stepName, state) {
  if (state && state.steps && state.steps[stepName] && state.steps[stepName].pipeline) {
    return state.steps[stepName].pipeline;
  }
  for (const [pipeline, steps] of Object.entries(schema.step_order)) {
    if (steps.includes(stepName)) return pipeline;
  }
  return null;
}

// Initialize steps for a pipeline as pending
function initPipelineSteps(schema, pipelineStage) {
  const steps = {};
  for (const step of (schema.step_order[pipelineStage] || [])) {
    steps[step] = { status: 'pending', pipeline: pipelineStage };
  }
  return steps;
}

// ─── Invariant gates ─────────────────────────────────────────────────────────

function checkStageGInvariant() {
  const { loadSnapshot } = require('./truth-surface.cjs');
  const root = getRoot();
  const dir = path.dirname(root);
  const snapshot = loadSnapshot(dir);
  const entries = (snapshot && snapshot.entries) || {};

  // Categories that cannot be frozen (can_freeze: false in schema) are expected
  // to remain in their terminal-per-category status and must not block advance.
  // Today this covers: high_impact_risk (OPEN), challenged_claim (CHALLENGED),
  // discarded_option (DISCARDED).
  const schema = getSchema();
  const noFreezeCategories = new Set(
    Object.entries(schema.categories || {})
      .filter(([_, cfg]) => cfg && cfg.can_freeze === false)
      .map(([name]) => name)
  );

  const unresolved = [];
  for (const [id, entry] of Object.entries(entries)) {
    if (noFreezeCategories.has(entry.category)) continue;
    if (entry.status === 'PROPOSED' || entry.status === 'CHALLENGED') {
      unresolved.push(id);
    }
  }

  if (unresolved.length > 0) {
    process.stderr.write(
      `Cannot advance from stage-g: ${unresolved.length} entries still unresolved:\n`
    );
    for (const id of unresolved) {
      process.stderr.write(`  - ${id}\n`);
    }
    process.stderr.write(`Run: bonfire stage-g-freeze-gate\n`);
    process.exit(1);
  }
}

/**
 * checkVerdictSubstantive(verdict, schema, ledgerSnapshot)
 *
 * Per spec 2026-05-08-bonfire-assertion-3a (§6.4 + §6.6 Loc 3).
 * Evaluates schema.verdict_substantive_check.reject_when rules against the verdict.
 * For each matching rule: if escape_allowed and escape flag set, validates escape ref
 * via validateLedgerRef (resolves refs + asserts >= min_refs). Otherwise rejects.
 *
 * Returns {valid: boolean, rule?: string, error?: string, escape_used?: string}.
 *
 * ARCHITECTURAL NOTE (inverse of Phase 3 IP2 choice): validateLedgerRef IS invoked
 * here (IP3) because snapshot is in scope and the escape decision depends on resolution
 * + FROZEN status check that only validateLedgerRef performs. This is the opposite of
 * delta-parser.cjs IP2 which uses pattern-only check because validateDelta is stateless.
 */
function checkVerdictSubstantive(verdict, schema, ledgerSnapshot) {
  const { validateLedgerRef } = require('./validation-helpers.cjs');
  const config = schema.verdict_substantive_check;
  if (!config) return { valid: true };  // schema not configured → pass-through

  const isEmptyArr = (v) => v === undefined || (Array.isArray(v) && v.length === 0);
  const conditionsEmpty = isEmptyArr(verdict.conditions);
  const rulingsEmpty = isEmptyArr(verdict.rulings);

  for (const rule of (config.reject_when || [])) {
    const p = rule.predicate || {};
    const verdictMatches = Array.isArray(p.verdict)
      ? p.verdict.includes(verdict.verdict)
      : p.verdict === verdict.verdict;
    if (!verdictMatches) continue;
    if (p.conditions_empty === true && !conditionsEmpty) continue;
    if (p.rulings_empty === true && !rulingsEmpty) continue;

    // Predicate matches. Apply escape valve if allowed.
    if (rule.escape_allowed && config.escape_valve) {
      const ev = config.escape_valve;
      if (verdict[ev.flag] === true) {
        const reason = verdict[ev.reason_field];
        // min_refs uses ?? to preserve explicit 0 intent (though escape realistically requires >= 1)
        const result = validateLedgerRef(reason, schema, ledgerSnapshot, ev.min_refs ?? 1);
        if (result.valid) {
          return { valid: true, escape_used: ev.flag };
        }
        return {
          valid: false,
          rule: rule.rule,
          error: `escape valve ${ev.flag} invalid: ${result.error}`,
        };
      }
    }

    return {
      valid: false,
      rule: rule.rule,
      error: `verdict matches reject_when rule "${rule.rule}"; escape ${rule.escape_allowed ? 'available but not invoked' : 'not allowed'}`,
    };
  }

  return { valid: true };
}

function checkStageHInvariant() {
  const { loadSnapshot } = require('./truth-surface.cjs');
  const { validateDelta } = require('./delta-parser.cjs');
  const { validateHConditions } = require('./seam-validation.cjs');
  const root = getRoot();
  const dir = path.dirname(root);
  const verdictPath = path.join(root, 'plan', 'h-review-verdict.json');

  let verdict;
  try {
    verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      exitError(`h-review-verdict.json not found at ${verdictPath}`, [], 3);
    }
    exitError(`h-review-verdict.json unreadable at ${verdictPath}: ${err.message}`, [], 3);
  }

  const validation = validateDelta('bonfire-h-review', verdict);
  if (!validation.valid) {
    exitError(
      `h-review-verdict.json failed schema validation: ${validation.errors.join('; ')}`,
      [],
      3
    );
  }

  // Load snapshot once — reused by 3a verdict_substantive_check, Layer 1, and rulings check.
  const snapshot = loadSnapshot(dir);
  const entries = (snapshot && snapshot.entries) || {};

  // 3a verdict_substantive_check — Section 6.4 of spec, runs after validateDelta
  // and before Layer 1 (validateHConditions). Catches L0 literal-empty verdicts
  // that pass element-level shape checks; per-element vacuousness (L1-L3) is
  // already caught by validateDelta above.
  const schema = loadSchema();
  const substResult = checkVerdictSubstantive(verdict, schema, snapshot);
  if (!substResult.valid) {
    process.stderr.write(
      `Cannot advance from stage-h: verdict_substantive_check rule="${substResult.rule}": ${substResult.error}\n`
    );
    process.stderr.write(
      `If oversight is genuinely not needed, declare "no_substantive_oversight": true with "no_substantive_oversight_reason" containing ledger refs.\n`
    );
    process.exit(1);
  }

  // Layer 1: condition-text invariants (blacklisted verbs, paraphrase patterns,
  // orphan tokens). Runs after schema validation and verdict_substantive_check.
  const condResult = validateHConditions(verdict, snapshot);
  if (!condResult.valid) {
    process.stderr.write(
      `Cannot advance from stage-h: ${condResult.violations.length} condition violation(s):\n`
    );
    for (const v of condResult.violations) {
      const idx = v.index === null ? 'verdict' : `conditions[${v.index}]`;
      process.stderr.write(`  - ${idx}: ${v.reason}\n`);
    }
    process.stderr.write(
      `Run: bonfire state-reentry --conflict-type invalid_stage_j_condition\n`
    );
    process.exit(1);
  }

  const rulings = Array.isArray(verdict.rulings) ? verdict.rulings : [];
  const filtered = rulings.filter(r => r.action === 'freeze' || r.action === 'supersede');
  if (filtered.length === 0) return;  // trivial pass

  const failures = [];
  for (const ruling of filtered) {
    if (ruling.action === 'freeze') {
      const actual = entries[ruling.id] && entries[ruling.id].status;
      if (actual !== 'FROZEN') {
        failures.push(`  - freeze(id=${ruling.id}) expected=FROZEN actual=${actual || '<missing>'}`);
      }
    } else if (ruling.action === 'supersede') {
      const oldStatus = entries[ruling.supersedes] && entries[ruling.supersedes].status;
      const newStatus = entries[ruling.id] && entries[ruling.id].status;
      const oldOk = oldStatus === 'SUPERSEDED';
      const newOk = newStatus === 'FROZEN';
      if (!oldOk || !newOk) {
        failures.push(
          `  - supersede(supersedes=${ruling.supersedes}, id=${ruling.id}) ` +
          `expected: ${ruling.supersedes}=SUPERSEDED, ${ruling.id}=FROZEN; ` +
          `actual: ${ruling.supersedes}=${oldStatus || '<missing>'}, ${ruling.id}=${newStatus || '<missing>'}`
        );
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Cannot advance from stage-h: ${failures.length} rulings not satisfied:\n`
    );
    process.stderr.write(failures.join('\n') + '\n');
    process.stderr.write(`Run: bonfire apply-h-rulings\n`);
    process.exit(1);
  }
}

// ─── Exported command handlers ────────────────────────────────────────────────

function stateRead(args) {
  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);
  exitJSON(state);
}

function stateStep(args) {
  const stepName = args.step;
  const status = args.status;

  if (!stepName || !status) {
    exitError('Usage: state-step --step <name> --status <status>', [], 2);
  }

  const schema = getSchema();
  if (!schema.step_statuses.includes(status)) {
    exitError(`Invalid status: ${status}`, schema.step_statuses);
  }

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  if (!state.steps[stepName]) {
    const pipeline = findPipelineForStep(schema, stepName, state);
    state.steps[stepName] = { pipeline: pipeline };
  }

  const step = state.steps[stepName];
  step.status = status;

  const now = timestamp();
  if (status === 'running' && !step.started_at) {
    step.started_at = now;
  }
  if (status === 'passed') {
    step.passed_at = now;
  }

  // Update current_step if this step is now running
  if (status === 'running') {
    state.current_step = stepName;
  }

  saveState(root, state);
  exitJSON({ success: true, step: stepName, status });
}

function stateAdvance(args) {
  const stepName = args.step;

  if (!stepName) {
    exitError('Usage: state-advance --step <name>', [], 2);
  }

  // Invariant gates: refuse to advance when ledger state violates contract.
  if (stepName === 'stage-g') {
    checkStageGInvariant();
  } else if (stepName === 'stage-h') {
    checkStageHInvariant();
  }

  const schema = getSchema();
  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  const currentPipeline = state.pipeline_stage;
  const currentSteps = stepsForPipeline(schema, currentPipeline, state);
  const stepIndex = currentSteps.indexOf(stepName);

  if (stepIndex === -1) {
    exitError(`Step ${stepName} not found in current pipeline ${currentPipeline}`, currentSteps);
  }

  // Stage A approval: mark approved when advancing past it
  if (stepName === 'stage-a' && state.approval) {
    state.approval.stage_a_approved = true;
    state.approval.stage_a_approved_at = timestamp();
  }

  // Check if this is the last step in the current pipeline
  if (stepIndex === currentSteps.length - 1) {
    // Advance to next pipeline
    const pipelines = pipelineOrder(schema);
    const pipelineIndex = pipelines.indexOf(currentPipeline);

    if (pipelineIndex === pipelines.length - 1) {
      exitError('Already at last pipeline stage', []);
    }

    const nextPipeline = pipelines[pipelineIndex + 1];
    const nextSteps = stepsForPipeline(schema, nextPipeline, state);

    state.pipeline_stage = nextPipeline;

    // Initialize next pipeline's steps as pending
    const newSteps = initPipelineSteps(schema, nextPipeline);
    for (const [step, info] of Object.entries(newSteps)) {
      if (!state.steps[step]) {
        state.steps[step] = info;
      }
    }

    // Set current_step to first step of next pipeline
    if (nextSteps.length > 0) {
      state.current_step = nextSteps[0];
    } else {
      state.current_step = null;
    }

    saveState(root, state);
    exitJSON({ success: true, advanced_to_pipeline: nextPipeline, current_step: state.current_step });
  } else {
    // Move to next step in same pipeline
    const nextStep = currentSteps[stepIndex + 1];

    if (!state.steps[nextStep]) {
      state.steps[nextStep] = { status: 'pending' };
    }

    state.current_step = nextStep;
    saveState(root, state);
    exitJSON({ success: true, current_step: nextStep });
  }
}

function stateReentry(args) {
  const conflictType = args['conflict-type'];
  const reason = args.reason || '';

  if (!conflictType) {
    exitError('Usage: state-reentry --conflict-type <type> [--reason <text>]', [], 2);
  }

  const schema = getSchema();
  const route = schema.reentry_routes[conflictType];
  if (!route) {
    exitError(`Unknown conflict type: ${conflictType}`, Object.keys(schema.reentry_routes));
  }

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  const now = timestamp();

  if (route.crosses_pipeline) {
    // Reset to pre pipeline
    state.pipeline_stage = 'pre';
    state.current_step = route.to;

    // Reset the target step to pending
    const existingPipeline = state.steps[route.to] && state.steps[route.to].pipeline;
    state.steps[route.to] = { status: 'pending', pipeline: existingPipeline || findPipelineForStep(schema, route.to, state) };

    // Clear approval
    if (state.approval) {
      state.approval.stage_a_approved = false;
      state.approval.stage_a_approved_at = null;
    }

    state.reentry.depth += 1;
    state.reentry.history.push({
      at: now,
      conflict_type: conflictType,
      reason,
      to: route.to,
      crosses_pipeline: true
    });

    // Check max depth
    if (state.reentry.depth > state.reentry.max_depth) {
      if (state.steps[route.to]) {
        state.steps[route.to].status = 'awaiting_user';
      }
    }

    saveState(root, state);
    exitJSON({
      success: true,
      reentry_to: route.to,
      crosses_pipeline: true,
      depth: state.reentry.depth
    });
  } else {
    // Reset steps from route.to through current_step (inclusive)
    const targetStep = route.to;
    const currentStep = state.current_step;

    // Find the pipeline that contains the target step
    const targetPipeline = findPipelineForStep(schema, targetStep, state);
    const targetSteps = stepsForPipeline(schema, targetPipeline, state);

    const targetIdx = targetSteps.indexOf(targetStep);
    const currentIdx = targetSteps.indexOf(currentStep);

    // Reset from targetIdx to currentIdx (or end of steps if currentStep not in same pipeline)
    const endIdx = currentIdx >= targetIdx ? currentIdx : targetSteps.length - 1;

    for (let i = targetIdx; i <= endIdx; i++) {
      const step = targetSteps[i];
      if (state.steps[step]) {
        state.steps[step] = { status: 'pending', pipeline: state.steps[step].pipeline };
      }
    }

    // Also reset current_step if it's in a different pipeline after target
    state.current_step = targetStep;

    state.reentry.depth += 1;
    state.reentry.history.push({
      at: now,
      conflict_type: conflictType,
      reason,
      to: targetStep,
      crosses_pipeline: false
    });

    // Check max depth
    if (state.reentry.depth > state.reentry.max_depth) {
      if (state.steps[targetStep]) {
        state.steps[targetStep].status = 'awaiting_user';
      }
    }

    saveState(root, state);
    exitJSON({
      success: true,
      reentry_to: targetStep,
      crosses_pipeline: false,
      depth: state.reentry.depth
    });
  }
}

function statePendingReentry(args) {
  const conflictType = args['conflict-type'];
  const from = args.from;
  const reason = args.reason || '';

  if (!conflictType || !from) {
    exitError('Usage: state-pending-reentry --conflict-type <type> --from <step> --reason <text>', [], 2);
  }

  const schema = getSchema();
  const route = schema.reentry_routes[conflictType];
  if (!route) {
    exitError(`Unknown conflict type: ${conflictType}`, Object.keys(schema.reentry_routes));
  }

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);
  const targetStep = route.to;
  const targetPipeline = findPipelineForStep(schema, targetStep, state);

  state.pending_reentry = {
    conflict_type: conflictType,
    target_step: targetStep,
    target_pipeline: targetPipeline,
    originated_from: from,
    reason,
    created_at: timestamp()
  };

  saveState(root, state);
  exitJSON({ success: true, pending_reentry: state.pending_reentry });
}

function stateClearReentry(args) {
  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  state.pending_reentry = null;

  saveState(root, state);
  exitJSON({ success: true });
}

function stateBeginRun(args) {
  const runId = args['run-id'];

  if (!runId) {
    exitError('Usage: state-begin-run --run-id <id>', [], 2);
  }

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  state.pipeline_stage = 'code';
  state.runs.current_run_id = runId;

  // Create runs directory for this run
  const runDir = path.join(root, 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });

  saveState(root, state);
  exitJSON({ success: true, run_id: runId });
}

function stateCompleteRun(args) {
  const runId = args['run-id'];
  const verdict = args.verdict;

  if (!runId || !verdict) {
    exitError('Usage: state-complete-run --run-id <id> --verdict <verdict>', [], 2);
  }

  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  state.runs.current_run_id = null;
  state.runs.completed_runs.push({
    run_id: runId,
    verdict,
    completed_at: timestamp()
  });

  saveState(root, state);
  exitJSON({ success: true, run_id: runId, verdict });
}

function stateInitCodeSteps(args) {
  const root = getRoot();
  const state = loadState(root);
  if (!state) exitError('state.json not found', [], 3);

  // Read compile-output.json
  const compileOutputPath = path.join(root, 'plan', 'compile-output.json');
  const compileOutput = loadJSON(compileOutputPath);
  if (!compileOutput) {
    exitError('plan/compile-output.json not found', [], 3);
  }

  // Generate unit steps from handoff.implementation_units
  const handoff = compileOutput.handoff;
  if (!handoff || !Array.isArray(handoff.implementation_units)) {
    exitError('compile-output.json missing handoff.implementation_units', [], 3);
  }
  const units = handoff.implementation_units;
  const steps = {};

  for (let i = 0; i < units.length; i++) {
    const stepName = `unit-${i + 1}`;
    steps[stepName] = { status: 'pending', pipeline: 'code' };
  }

  // Merge into state steps
  Object.assign(state.steps, steps);

  // Set current_step to first unit if not set
  if (units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))) {
    state.current_step = 'unit-1';
  }

  saveState(root, state);
  exitJSON({ success: true, steps_created: Object.keys(steps) });
}

module.exports = {
  loadState,
  saveState,
  stateRead,
  stateStep,
  stateAdvance,
  stateReentry,
  statePendingReentry,
  stateClearReentry,
  stateBeginRun,
  stateCompleteRun,
  stateInitCodeSteps,
  checkVerdictSubstantive,
};
