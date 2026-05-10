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

  // ASSERTION-3a deep-check (runs BEFORE Layer 2a per spec §6.7 IP1) — defeats
  // L0-L3 attacks (empty containers / [{}] / empty subfields / placeholder strings).
  // Honors no_substantive_contract escape valve via ref-only validateLedgerRef.
  const schema = loadSchema();
  const ctx = context || {};
  const deepResult = deepCheckHandoffSubstantiveSlots(handoff, schema, ctx.snapshot);
  if (!deepResult.valid) {
    errors.push(`deep_check_failed at ${deepResult.slot}: ${deepResult.error}`);
  }

  // Layer 2a: provenance enforcement
  const provenanceErrors = validateProvenance(compileOutput, ctx);
  errors.push(...provenanceErrors);

  return { valid: errors.length === 0, errors };
}

function validateProvenance(compileOutput, context) {
  const errors = [];
  const schema = loadSchema();
  const slots = (schema && schema.handoff_substantive_slots) || {};
  // Extract layer_2b_calibration once per validateHandoff invocation (per
  // round-4 quality-review S2 fix: avoid per-slot loadSchema disk reads).
  // Threaded into checkEntryProvenance via parameter; constant for full run.
  const calib = (schema && schema.layer_2b_calibration) || null;

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
        const entryErrors = checkEntryProvenance(entry, `${slotPath}[${i}]`, context, slotConfig, calib);
        errors.push(...entryErrors);
      }
    } else if (slotConfig.kind === 'whole_section') {
      const sectionErrors = checkEntryProvenance(target, slotPath, context, slotConfig, calib);
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

function checkEntryProvenance(entry, pathLabel, context, slotConfig, calib) {
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

  // Layer 2b: round-4 max_contiguous_orphan_run threshold reject.
  const { maxContiguousOrphanRun, compareTokens } = require('./seam-validation.cjs');
  const slotTokens = extractEntryTokens(entry, slotConfig);

  // Round-4 v0.1 telemetry omitted: per spec §5 R-A amend, telemetry is
  // "compute-only no persistence"; pure-function compute with discarded
  // result has zero observable effect. Re-analysis at amend time uses
  // analyze-round-4.js on archived data per rationale (a). Reintroduce
  // here if Q5 §6.4 trigger materializes a runtime consumer.

  // Round-4 reject: max_contiguous_orphan_run > threshold (per spec §5 + §6.2).
  // calib threaded from validateProvenance (extracted once per handoff
  // invocation per quality-review S2 fix; avoids per-slot loadSchema reads).
  if (calib && typeof calib.threshold_provisional === 'number') {
    // Source-of-truth assertion (per spec §6.1): warn on drift at call time.
    // Guard on p75_baseline + safety_margin_pct typeof per quality-review S1
    // fix: prevents NaN-flood when those fields are absent from schema config.
    if (typeof calib.p75_baseline === 'number' && typeof calib.safety_margin_pct === 'number') {
      const expected = Math.round(calib.p75_baseline * (1 + calib.safety_margin_pct / 100));
      if (calib.threshold_provisional !== expected) {
        process.stderr.write(
          `[layer_2b_calibration] WARN: threshold_provisional=${calib.threshold_provisional} ` +
          `differs from derived ${expected} (p75_baseline=${calib.p75_baseline} × ` +
          `(1 + ${calib.safety_margin_pct}/100)). Schema PR may have updated baseline ` +
          `without atomic threshold update; see spec §6.1 source-of-truth contract.\n`
        );
      }
    }
    const maxRun = maxContiguousOrphanRun(slotTokens, sourceText);
    if (maxRun > calib.threshold_provisional) {
      const allOrphans = compareTokens(slotTokens, sourceText);
      const preview = allOrphans.slice(0, 5).join(', ');
      const moreCount = allOrphans.length > 5 ? ` +${allOrphans.length - 5} more` : '';
      errors.push(
        `${pathLabel}: max_contiguous_orphan_run=${maxRun} > threshold=${calib.threshold_provisional} ` +
        `(${kind}=${JSON.stringify(ref)}; metric_class=${calib.metric_class}; ` +
        `threshold_status=${calib.threshold_status}; orphan_sample=[${preview}${moreCount}])`
      );
    }
  }
  // Note: if calib is absent (schema not yet round-4), Layer 2b reject is SILENT
  // (no rejection). This is defensive: handoff still passes Layer 2a + 3a checks.
  // Schema PR landing layer_2b_calibration is required to activate round-4 reject.

  return errors;
}

// Extract substantive tokens from an entry's string leaves for Layer 2b
// comparison. Honors `slotConfig.required_subfields` at the top level — when
// present, only the listed top-level keys are walked. Always skips
// `source_kind` and `source_ref` (provenance metadata, never substantive
// content). Schema v2 renamed `fields` to `required_subfields` for stronger
// contract semantics (per ASSERTION-3a spec §6.3 + §6.8).
function extractEntryTokens(entry, slotConfig) {
  const { extractSubstantiveTokens } = require('./seam-validation.cjs');
  const tokens = [];
  const fields = (slotConfig && Array.isArray(slotConfig.required_subfields)) ? slotConfig.required_subfields : null;

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

/**
 * deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot)
 *
 * Per ASSERTION-3a spec §6.3 + §6.7 IP1. Runs structural deep-check on every
 * slot in schema.handoff_substantive_slots. Defeats attack levels L0-L3
 * (empty containers, [{}], empty/null subfields, placeholder strings); L4
 * prose-vacuous content is OOS (round-4 territory).
 *
 *   per_entry kind: assert entries.length >= min_entries (default 1); for each
 *     entry, assert required_subfields all present and !isEmptyOrPlaceholder.
 *   whole_section kind: assert required_subfields all present and
 *     !isEmptyOrPlaceholder on the section object.
 *
 * Escape valve (existing handoff_mandate_params.escape_valve) supports the
 * legitimate "no substantive contract" case. When the slot's container has
 * the escape flag (`no_substantive_contract: true`) AND the reason field
 * resolves via validateLedgerRef per the schema's reason_ref_constraint
 * mechanism (DQ-1 closure: ref-only check, NO Layer 2b prose token-coverage),
 * the slot's deep-check is skipped.
 *
 * Fail-fast on first violation. Returns {valid, error?, slot?, escape_used?}.
 */
function deepCheckHandoffSubstantiveSlots(handoff, schema, ledgerSnapshot) {
  const { isEmptyOrPlaceholder, validateLedgerRef } = require('./validation-helpers.cjs');
  const slots = (schema && schema.handoff_substantive_slots) || {};
  const params = (schema && schema.handoff_mandate_params) || {};
  const escapeCfg = params.escape_valve || {};
  const escapeFlag = escapeCfg.flag || 'no_substantive_contract';
  const escapeReasonField = escapeCfg.reason_field || 'no_substantive_contract_reason';
  const escapeMinRefs = escapeCfg.min_refs || 1;

  for (const [slotPath, config] of Object.entries(slots)) {
    // slotPath like "handoff.domain_model.entities" — strip leading "handoff." then dotted-path-resolve.
    const segments = slotPath.split('.').slice(1);
    const slot = resolveSlotPath(handoff, segments.join('.'));
    // Container = parent of the slot. If slot is at handoff top-level (e.g.,
    // "handoff.function_contracts"), container is the handoff root itself.
    const container = segments.length > 1
      ? resolveSlotPath(handoff, segments.slice(0, -1).join('.'))
      : handoff;

    // Skip-if-undefined convention (matches validateProvenance:78). Catches
    // operators who EMPTY a present slot (the dogfood vacuous-pass attack);
    // does not require every slot to be present (some handoffs legitimately
    // lack ui_contract sections, etc.). Explicit absence is allowed; explicit
    // emptiness is the attack signature.
    if (slot === undefined) continue;

    // Escape valve check on container — if set, validate refs and skip slot deep-check.
    if (container && container[escapeFlag] === true) {
      const reason = container[escapeReasonField];
      const refResult = validateLedgerRef(
        reason,
        schema,
        ledgerSnapshot || { entries: {} },
        escapeMinRefs,
      );
      if (!refResult.valid) {
        return {
          valid: false,
          slot: slotPath,
          error: `escape valve "${escapeFlag}" invoked but invalid: ${refResult.error}`,
        };
      }
      continue;  // escape valid — skip deep-check on this slot
    }

    if (config.kind === 'per_entry') {
      // Accept either an array (preferred shape) or a plain object (entries-by-key).
      const entries = Array.isArray(slot)
        ? slot
        : (slot && typeof slot === 'object' ? Object.values(slot) : null);
      if (entries === null) {
        return {
          valid: false,
          slot: slotPath,
          error: `${slotPath}: expected array or object, got ${typeof slot}`,
        };
      }
      const minEntries = config.min_entries || 1;
      if (entries.length < minEntries) {
        return {
          valid: false,
          slot: slotPath,
          error: `${slotPath} has ${entries.length} entries, min_entries=${minEntries}`,
        };
      }
      const required = config.required_subfields || [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (typeof entry !== 'object' || entry === null) {
          return {
            valid: false,
            slot: slotPath,
            error: `${slotPath}[${i}]: expected object`,
          };
        }
        for (const field of required) {
          if (isEmptyOrPlaceholder(entry[field])) {
            return {
              valid: false,
              slot: slotPath,
              error: `${slotPath}[${i}].${field} is empty or placeholder`,
            };
          }
        }
      }
    } else if (config.kind === 'whole_section') {
      if (typeof slot !== 'object' || slot === null || Array.isArray(slot)) {
        return {
          valid: false,
          slot: slotPath,
          error: `${slotPath}: expected object (whole_section)`,
        };
      }
      const required = config.required_subfields || [];
      for (const field of required) {
        if (isEmptyOrPlaceholder(slot[field])) {
          return {
            valid: false,
            slot: slotPath,
            error: `${slotPath}.${field} is empty or placeholder`,
          };
        }
      }
    } else {
      return {
        valid: false,
        slot: slotPath,
        error: `${slotPath}: unknown kind "${config.kind}"`,
      };
    }
  }

  return { valid: true };
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

module.exports = { validateHandoff, validateBundle, deepCheckHandoffSubstantiveSlots };
