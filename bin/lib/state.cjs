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

  // Generate unit steps from compile output
  // Expects compile_output to have a units array or similar
  const units = compileOutput.units || compileOutput.code_batches || [];
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
  stateInitCodeSteps
};
