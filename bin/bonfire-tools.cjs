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
  'truth-propose':    () => stub,
  'truth-update':     () => stub,
  'truth-annotate':   () => stub,
  'truth-freeze':     () => stub,
  'truth-supersede':  () => stub,
  'truth-discard':    () => stub,
  'truth-read':       () => stub,
  'truth-query':      () => stub,
  'truth-rebuild':    () => stub,
  'delta-validate':   () => stub,
  'handoff-validate': () => stub,
  'bundle-validate':  () => stub,
  'render':           () => stub,
  'render-check':     () => stub,
  'log-agent':        () => stub,
  'log-transition':   () => stub,
  'log-read':         () => stub,
  'preflight-update': () => stub,
};

function stub(args) {
  exitError('Command not yet implemented (see Plan 2-3)', [], 3);
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
