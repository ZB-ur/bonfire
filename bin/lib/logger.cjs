'use strict';

const fs = require('fs');
const path = require('path');
const { timestamp } = require('./utils.cjs');

function appendLog(filePath, entry) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!entry.timestamp) {
    entry.timestamp = timestamp();
  }
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
}

function readLog(filePath, opts) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    const entries = content.split('\n').map(line => JSON.parse(line));
    if (opts && opts.since) {
      return entries.filter(e => e.timestamp >= opts.since);
    }
    return entries;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

module.exports = { appendLog, readLog };
