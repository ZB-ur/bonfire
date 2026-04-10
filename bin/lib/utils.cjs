'use strict';

const fs = require('fs');
const path = require('path');

function writeAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw err;
  }
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function resolveRoot(cwd) {
  const candidate = path.join(cwd || process.cwd(), '.bonfire');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        result[key] = true;
      } else {
        result[key] = next;
        i++;
      }
    }
  }
  return result;
}

function loadSchema() {
  const schemaPath = path.join(__dirname, '..', '..', 'schemas', 'bonfire-v1.json');
  return loadJSON(schemaPath);
}

function exitJSON(data, code = 0) {
  process.stdout.write(JSON.stringify(data) + '\n');
  process.exit(code);
}

function exitError(message, details, code = 1) {
  exitJSON({ error: message, details: details || [] }, code);
}

module.exports = { writeAtomic, loadJSON, timestamp, resolveRoot, parseArgs, loadSchema, exitJSON, exitError };
