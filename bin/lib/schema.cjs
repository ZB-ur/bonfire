'use strict';

const fs = require('fs');
const path = require('path');
const { loadSchema, loadJSON } = require('./utils.cjs');

const HANDOFF_REQUIRED_FIELDS = [
  'code_ready', 'handoff_summary', 'retained_goal', 'implementation_scope',
  'implementation_units'
];

function validateHandoff(compileOutput) {
  const errors = [];
  if (!compileOutput || !compileOutput.handoff) {
    return { valid: false, errors: ['compile-output.json missing handoff section'] };
  }
  const handoff = compileOutput.handoff;
  for (const field of HANDOFF_REQUIRED_FIELDS) {
    if (handoff[field] === undefined || handoff[field] === null) {
      errors.push(`Missing required handoff field: ${field}`);
    }
  }
  if (handoff.code_ready !== true) {
    errors.push('handoff.code_ready is not true');
  }
  if (handoff.implementation_units && !Array.isArray(handoff.implementation_units)) {
    errors.push('handoff.implementation_units must be an array');
  }
  if (Array.isArray(handoff.implementation_units) && handoff.implementation_units.length === 0) {
    errors.push('handoff.implementation_units is empty');
  }
  return { valid: errors.length === 0, errors };
}

function validateBundle(root) {
  const schema = loadSchema();
  if (!schema) return { present: [], missing: [], errors: ['Cannot load schema'] };
  const bonfireDir = path.join(root, '.bonfire');
  const present = [];
  const missing = [];
  for (const note of schema.notes) {
    if (note.source && note.source.includes('{run_id}')) continue;
    const sourceParts = note.source.split('#');
    const sourceFile = sourceParts[0];
    if (sourceFile.includes('+')) {
      const parts = sourceFile.split('+');
      const allExist = parts.every(p => fs.existsSync(path.join(bonfireDir, p)));
      (allExist ? present : missing).push({ id: note.id, source: sourceFile });
    } else {
      const fullPath = path.join(bonfireDir, sourceFile);
      (fs.existsSync(fullPath) ? present : missing).push({ id: note.id, source: sourceFile });
    }
  }
  return { present, missing, errors: [] };
}

module.exports = { validateHandoff, validateBundle };
