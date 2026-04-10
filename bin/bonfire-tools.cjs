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
  'delta-validate':   () => stub,
  'handoff-validate': () => stub,
  'bundle-validate':  () => stub,
  'render':           () => stub,
  'render-check':     () => stub,
  'log-agent':        () => logCommand('agent'),
  'log-transition':   () => logCommand('transition'),
  'log-read':         () => logCommand('logread'),
  'preflight-update': () => stub,
};

function stub(args) {
  exitError('Command not yet implemented (see Plan 2-3)', [], 3);
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
