'use strict';

const fs = require('fs');
const path = require('path');
const { loadSchema, loadJSON } = require('./utils.cjs');

const HANDOFF_REQUIRED_FIELDS = [
  'code_ready', 'handoff_summary', 'retained_goal', 'implementation_scope',
  'implementation_units'
];

function validateHandoff(compileOutput, context) {
  const errors = [];
  if (!compileOutput || typeof compileOutput !== 'object') {
    return { valid: false, errors: ['compile-output.json missing or not an object'] };
  }

  // reentry_request detection — takes precedence over normal handoff validation
  if (compileOutput.reentry_request !== undefined) {
    const req = compileOutput.reentry_request;
    const handoff = compileOutput.handoff || {};
    const codeReady = handoff.code_ready;
    if (codeReady === true) {
      errors.push(
        'reentry_request present but handoff.code_ready=true — self-contradictory. ' +
        'Declaring a reentry request overrides compile-ready status, but J-Compile ' +
        'should not have produced this combination. Fix at agent level.'
      );
    }
    if (codeReady === undefined) {
      errors.push(
        'reentry_request present but handoff.code_ready is missing. ' +
        'When declaring a reentry, handoff.code_ready MUST be false.'
      );
    }
    return {
      valid: false,  // never valid: reentry_request means "refuse to compile", not a code-ready package
      errors,
      reentry_request: errors.length === 0 ? req : null,  // only surface when consistency check passed
    };
  }

  // Standard handoff validation
  if (!compileOutput.handoff) {
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

  // Layer 2a: provenance enforcement
  const provenanceErrors = validateProvenance(compileOutput, context || {});
  errors.push(...provenanceErrors);

  return { valid: errors.length === 0, errors };
}

function validateProvenance(compileOutput, context) {
  const errors = [];
  const schema = loadSchema();
  const slots = (schema && schema.handoff_substantive_slots) || {};

  for (const [slotPath, slotConfig] of Object.entries(slots)) {
    if (!slotConfig || !slotConfig._provenance_required) continue;
    const target = resolveSlotPath(compileOutput, slotPath);
    if (target === undefined) continue;  // slot absent → conditional-triggered exemption

    if (slotConfig.kind === 'per_entry') {
      // target must be an object whose values are entries
      if (typeof target !== 'object' || target === null) {
        errors.push(`${slotPath}: expected object for per_entry slot`);
        continue;
      }
      // If it's an array, iterate elements; if it's a plain object, iterate values.
      const entries = Array.isArray(target) ? target : Object.entries(target).map(([k, v]) => v);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryErrors = checkEntryProvenance(entry, `${slotPath}[${i}]`, context, slotConfig);
        errors.push(...entryErrors);
      }
    } else if (slotConfig.kind === 'whole_section') {
      const sectionErrors = checkEntryProvenance(target, slotPath, context, slotConfig);
      errors.push(...sectionErrors);
    }
  }

  return errors;
}

function resolveSlotPath(root, dottedPath) {
  const parts = dottedPath.split('.');
  let current = root;
  for (const p of parts) {
    if (current == null) return undefined;
    current = current[p];
  }
  return current;
}

function checkEntryProvenance(entry, pathLabel, context, slotConfig) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push(`${pathLabel}: not an object (can't validate provenance)`);
    return errors;
  }
  const kind = entry.source_kind;
  const ref = entry.source_ref;
  if (kind === undefined) {
    errors.push(`${pathLabel}: missing source_kind`);
    return errors;
  }
  if (ref === undefined) {
    errors.push(`${pathLabel}: missing source_ref`);
    return errors;
  }
  if (kind !== 'ledger_direct' && kind !== 'condition_rewrite') {
    errors.push(`${pathLabel}: source_kind "${kind}" not one of ledger_direct|condition_rewrite`);
    return errors;
  }

  let sourceText = '';
  if (kind === 'ledger_direct') {
    const snap = context.snapshot || { entries: {} };
    const ledgerEntry = (snap.entries || {})[ref];
    if (!ledgerEntry) {
      errors.push(`${pathLabel}: source_ref "${ref}" not found in ledger`);
      return errors;
    }
    if (ledgerEntry.status !== 'FROZEN') {
      errors.push(`${pathLabel}: source_ref "${ref}" is ${ledgerEntry.status}, expected FROZEN`);
      return errors;
    }
    sourceText = ledgerEntry.content || '';
  } else if (kind === 'condition_rewrite') {
    const verdict = context.verdict;
    const idx = ref && ref.condition_index;
    if (!verdict || typeof idx !== 'number') {
      errors.push(`${pathLabel}: condition_rewrite source_ref must be { condition_index: <number> } with a verdict in context`);
      return errors;
    }
    const conds = Array.isArray(verdict.conditions) ? verdict.conditions : [];
    if (idx < 0 || idx >= conds.length) {
      errors.push(`${pathLabel}: source_ref.condition_index ${idx} out of range (verdict has ${conds.length} conditions)`);
      return errors;
    }
    const cond = conds[idx];
    if (!cond || cond.target_stage !== 'stage-j') {
      errors.push(`${pathLabel}: referenced condition must have target_stage "stage-j"`);
      return errors;
    }
    sourceText = cond.text || '';
  }

  // Layer 2b: token coverage — after Layer 2a resolves the source, extract
  // substantive tokens from the slot content and compare against source text.
  const { compareTokens } = require('./seam-validation.cjs');
  const slotTokens = extractEntryTokens(entry, slotConfig);
  const orphans = compareTokens(slotTokens, sourceText);
  if (orphans.length > 0) {
    const preview = orphans.slice(0, 10).join(', ');
    const more = orphans.length > 10 ? ` (+${orphans.length - 10} more)` : '';
    errors.push(`${pathLabel}: orphan tokens not in source (${kind}=${JSON.stringify(ref)}): ${preview}${more}`);
  }

  return errors;
}

// Extract substantive tokens from an entry's string leaves for Layer 2b
// comparison. Honors `slotConfig.fields` at the top level — when present,
// only the listed top-level keys are walked. Always skips `source_kind`
// and `source_ref` (provenance metadata, never substantive content).
function extractEntryTokens(entry, slotConfig) {
  const { extractSubstantiveTokens } = require('./seam-validation.cjs');
  const tokens = [];
  const fields = (slotConfig && Array.isArray(slotConfig.fields)) ? slotConfig.fields : null;

  function walk(value, path) {
    if (value == null) return;
    if (typeof value === 'string') {
      for (const t of extractSubstantiveTokens(value)) tokens.push(t);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, path);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k === 'source_kind' || k === 'source_ref') continue;
        if (fields !== null && path.length === 0 && !fields.includes(k)) continue;
        walk(v, path.concat(k));
      }
    }
  }

  walk(entry, []);
  return tokens;
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
