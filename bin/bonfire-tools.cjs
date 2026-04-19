#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseArgs, loadSchema, exitJSON, exitError } = require('./lib/utils.cjs');

const COMMANDS = {
  'init':             () => require('./lib/init.cjs').init,
  'archive':          () => require('./lib/init.cjs').archive,
  'archive-list':     () => require('./lib/init.cjs').archiveList,
  'route':            () => routeCommand,
  'state-read':       () => require('./lib/state.cjs').stateRead,
  'state-advance':    () => require('./lib/state.cjs').stateAdvance,
  'state-reentry':    () => require('./lib/state.cjs').stateReentry,
  'state-pending-reentry': () => require('./lib/state.cjs').statePendingReentry,
  'state-clear-reentry':   () => require('./lib/state.cjs').stateClearReentry,
  'state-step':       () => require('./lib/state.cjs').stateStep,
  'state-begin-run':  () => require('./lib/state.cjs').stateBeginRun,
  'state-complete-run': () => require('./lib/state.cjs').stateCompleteRun,
  'state-init-code-steps': () => require('./lib/state.cjs').stateInitCodeSteps,
  'truth-propose':    () => truthCommand('propose'),
  'truth-update':     () => truthCommand('update'),
  'truth-annotate':   () => truthCommand('annotate'),
  'truth-freeze':     () => truthCommand('freeze'),
  'truth-supersede':  () => truthCommand('supersede'),
  'truth-discard':    () => truthCommand('discard'),
  'truth-read':       () => truthCommand('read'),
  'truth-query':      () => truthCommand('query'),
  'truth-rebuild':    () => truthCommand('rebuild'),
  'stage-g-freeze-gate': () => stageGFreezeGateCommand,
  'apply-h-rulings':     () => applyHRulingsCommand,
  'delta-validate':   () => deltaValidateCommand,
  'handoff-validate': () => handoffValidateCommand,
  'bundle-validate':  () => bundleValidateCommand,
  'render':           () => renderCommand,
  'render-check':     () => renderCheckCommand,
  'log-agent':        () => logCommand('agent'),
  'log-transition':   () => logCommand('transition'),
  'log-read':         () => logCommand('logread'),
  'preflight-update': () => preflightCommand,
};

function deltaValidateCommand(args) {
  const { validateDelta } = require('./lib/delta-parser.cjs');
  const { loadJSON } = require('./lib/utils.cjs');
  const agent = args.agent;
  if (!agent) { process.stderr.write('Usage: delta-validate --agent <name> --file <path>\n'); process.exit(2); }
  let data;
  if (args.file) {
    data = loadJSON(args.file);
    if (!data) exitError(`Cannot read file: ${args.file}`, []);
  } else {
    data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  }
  const result = validateDelta(agent, data);
  if (result.valid) exitJSON({ valid: true });
  else exitError('Validation failed', result.errors);
}

function handoffValidateCommand(args) {
  const { validateHandoff } = require('./lib/schema.cjs');
  const { resolveRoot, loadJSON } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const co = loadJSON(path.join(root, 'plan', 'compile-output.json'));
  if (!co) exitError('compile-output.json not found', []);
  const result = validateHandoff(co);
  if (result.valid) exitJSON({ valid: true });
  else exitError('Handoff validation failed', result.errors);
}

function bundleValidateCommand(args) {
  const { validateBundle } = require('./lib/schema.cjs');
  const { resolveRoot } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  exitJSON(validateBundle(path.dirname(root)));
}

function renderCommand(args) {
  const { renderNote, renderAll } = require('./lib/renderer.cjs');
  const { resolveRoot } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);
  if (args.all) {
    exitJSON(renderAll(dir, { run_id: args.run }));
  } else if (args.note) {
    const result = renderNote(dir, args.note, { run_id: args.run });
    if (result.success) exitJSON(result);
    else exitError(result.error, []);
  } else {
    process.stderr.write('Usage: render --note <id> | --all [--run <run-id>]\n');
    process.exit(2);
  }
}

function renderCheckCommand(args) {
  const { renderCheck } = require('./lib/renderer.cjs');
  const { resolveRoot } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  exitJSON(renderCheck(path.dirname(root)));
}

function preflightCommand(args) {
  const { resolveRoot, loadJSON, writeAtomic, loadSchema } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const field = args.field;
  if (!field) { process.stderr.write('Usage: preflight-update --field <field> --value <value>\n'); process.exit(2); }
  const schema = loadSchema();
  const mutableFields = schema ? schema.preflight_mutable_fields : [];
  if (field === 'progress' && args.unit) {
    const coPath = path.join(root, 'plan', 'compile-output.json');
    const co = loadJSON(coPath);
    if (!co) exitError('compile-output.json not found', []);
    if (!co.code_preflight) co.code_preflight = {};
    if (!co.code_preflight.progress_snapshot) co.code_preflight.progress_snapshot = {};
    co.code_preflight.progress_snapshot[args.unit] = args.status || 'in_progress';
    writeAtomic(coPath, co);
    try { const { renderNote } = require('./lib/renderer.cjs'); renderNote(path.dirname(root), 'code-preflight'); } catch (_) {}
    exitJSON({ success: true, field: 'progress_snapshot', unit: args.unit, status: args.status });
    return;
  }
  if (!mutableFields.includes(field)) {
    exitError(`Field "${field}" is not in mutable whitelist [${mutableFields.join(', ')}]`, mutableFields);
  }
  const coPath = path.join(root, 'plan', 'compile-output.json');
  const co = loadJSON(coPath);
  if (!co) exitError('compile-output.json not found', []);
  if (!co.code_preflight) co.code_preflight = {};
  co.code_preflight[field] = args.value;
  writeAtomic(coPath, co);
  try { const { renderNote } = require('./lib/renderer.cjs'); renderNote(path.dirname(root), 'code-preflight'); } catch (_) {}
  exitJSON({ success: true, field, value: args.value });
}

function truthCommand(action) {
  return function(args) {
    const ts = require('./lib/truth-surface.cjs');
    const { resolveRoot } = require('./lib/utils.cjs');
    const root = resolveRoot(process.cwd());
    if (!root) exitError('.bonfire/ not found', []);
    const dir = path.dirname(root);

    try {
      switch (action) {
        case 'propose': exitJSON(ts.propose(dir, args)); break;
        case 'update': exitJSON(ts.update(dir, args)); break;
        case 'annotate': exitJSON(ts.annotate(dir, args)); break;
        case 'freeze': exitJSON(ts.freeze(dir, args)); break;
        case 'supersede': exitJSON(ts.supersede(dir, args)); break;
        case 'discard': exitJSON(ts.discard(dir, args)); break;
        case 'read': {
          const snapshot = ts.loadSnapshot(dir);
          exitJSON(snapshot || { entries: {}, by_status: {}, by_category: {} });
          break;
        }
        case 'query': exitJSON(ts.query(dir, args)); break;
        case 'rebuild': exitJSON(ts.rebuild(dir)); break;
      }
    } catch (err) {
      exitError(err.message, []);
    }
  };
}

function logCommand(action) {
  return function(args) {
    const { appendLog, readLog } = require('./lib/logger.cjs');
    const { resolveRoot } = require('./lib/utils.cjs');
    const root = resolveRoot(process.cwd());
    if (!root) exitError('.bonfire/ not found', []);
    const logsDir = path.join(root, 'logs');

    switch (action) {
      case 'agent': {
        appendLog(path.join(logsDir, 'agent-invocations.jsonl'),
          { event: args.event, agent: args.agent, step: args.step, error: args.error || null });
        exitJSON({ success: true });
        break;
      }
      case 'transition': {
        appendLog(path.join(logsDir, 'state-transitions.jsonl'),
          { step: args.step, from: args.from, to: args.to });
        exitJSON({ success: true });
        break;
      }
      case 'logread': {
        const typeMap = { 'render': 'render.jsonl', 'state-transitions': 'state-transitions.jsonl', 'agent-invocations': 'agent-invocations.jsonl' };
        const filename = typeMap[args.type];
        if (!filename) exitError(`Unknown log type: ${args.type}`, Object.keys(typeMap));
        exitJSON(readLog(path.join(logsDir, filename), { since: args.since }));
        break;
      }
    }
  };
}

function routeCommand(args) {
  const schema = loadSchema();
  if (!schema) exitError('Cannot load bonfire-v1.json schema', [], 3);

  if (args.list) {
    exitJSON(schema.reentry_routes);
    return;
  }

  const type = args['conflict-type'];
  if (!type) {
    process.stderr.write('Usage: bonfire-tools.cjs route --list | --conflict-type <type>\n');
    process.exit(2);
  }

  const route = schema.reentry_routes[type];
  if (!route) {
    exitError(`Unknown conflict type: ${type}`, Object.keys(schema.reentry_routes));
  }
  exitJSON(route);
}

function stageGFreezeGateCommand(args) {
  const { stageGFreezeGate } = require('./lib/freeze-enforcement.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  try {
    const summary = stageGFreezeGate(dir);
    if (summary.unresolved.length > 0) {
      process.stderr.write(
        `stage-g-freeze-gate: ${summary.unresolved.length} unresolved CHALLENGED entries ` +
        `without alignment:\n`
      );
      for (const id of summary.unresolved) {
        process.stderr.write(`  - ${id}\n`);
      }
      process.stderr.write(
        `Return these to G-Blue for defense or escalate to H-Review.\n`
      );
      exitJSON(summary, 1);
    }
    exitJSON(summary, 0);
  } catch (err) {
    exitError(err.message, []);
  }
}

function applyHRulingsCommand(args) {
  const { applyHRulings } = require('./lib/freeze-enforcement.cjs');
  const { resolveRoot, exitJSON, exitError } = require('./lib/utils.cjs');
  const root = resolveRoot(process.cwd());
  if (!root) exitError('.bonfire/ not found', []);
  const dir = path.dirname(root);

  try {
    const result = applyHRulings(dir);
    exitJSON(result, 0);
  } catch (err) {
    exitError(err.message, []);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stderr.write('Usage: bonfire-tools.cjs <command> [--flags]\n');
    process.stderr.write('Commands: ' + Object.keys(COMMANDS).join(', ') + '\n');
    process.exit(2);
  }

  const command = argv[0];
  const factory = COMMANDS[command];
  if (!factory) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write('Commands: ' + Object.keys(COMMANDS).join(', ') + '\n');
    process.exit(2);
  }

  const handler = factory();
  const args = parseArgs(argv.slice(1));
  handler(args);
}

main();
