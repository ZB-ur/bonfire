// Installation: Add this to ~/.claude/settings.json under hooks.PostToolUse:
//
// {
//   "matcher": "Write|Edit",
//   "hooks": [
//     {
//       "type": "command",
//       "command": "node $HOME/.claude/bonfire/hooks/bonfire-dual-write.js",
//       "timeout": 10
//     }
//   ]
// }
//
// This hook captures agent Write/Edit tool calls to .bonfire/ JSON files
// (h-review-verdict.json, compile-output.json, run evidence).
// Truth surface changes go through CLI and self-render (Fix 5), not this hook.

#!/usr/bin/env node
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const WATCHED_PATTERNS = [
  { pattern: /\.bonfire\/truth-surface\/constraint-ledger-snapshot\.json$/, note: 'constraint-ledger' },
  { pattern: /\.bonfire\/plan\/bonfire-d-critique-delta\.json$/, note: 'stage-d' },
  { pattern: /\.bonfire\/plan\/bonfire-g-(red|blue)-delta\.json$/, note: 'stage-g' },
  { pattern: /\.bonfire\/plan\/h-review-verdict\.json$/, note: 'stage-h' },
  { pattern: /\.bonfire\/plan\/compile-output\.json$/, note: '__compile__' },
  { pattern: /\.bonfire\/runs\/([^/]+)\/([^/]+)\.json$/, note: '__run__' }
];

try {
  const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  const toolName = input.tool_name;
  const filePath = input.tool_input && input.tool_input.file_path;

  if (!filePath || (toolName !== 'Write' && toolName !== 'Edit')) {
    process.stdout.write(JSON.stringify({}) + '\n');
    process.exit(0);
  }

  for (const { pattern, note } of WATCHED_PATTERNS) {
    const match = filePath.match(pattern);
    if (!match) continue;

    const toolsPath = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');
    const cwd = filePath.replace(/\.bonfire\/.*$/, '').replace(/\/$/, '') || '.';

    try {
      if (note === '__compile__') {
        execFileSync('node', [toolsPath, 'render', '--all'], { cwd, timeout: 9000 });
      } else if (note === '__run__') {
        const runId = match[1];
        const fileName = match[2];
        const noteMap = { 'code-run': 'code-run', 'verification': 'verification', 'reentry': 'reentry', 'achieve': 'achieve' };
        if (noteMap[fileName]) {
          execFileSync('node', [toolsPath, 'render', '--note', noteMap[fileName], '--run', runId], { cwd, timeout: 9000 });
        }
      } else {
        execFileSync('node', [toolsPath, 'render', '--note', note], { cwd, timeout: 9000 });
      }
    } catch (_) {}
    break;
  }
  process.stdout.write(JSON.stringify({}) + '\n');
} catch (_) {
  process.stdout.write(JSON.stringify({}) + '\n');
}
