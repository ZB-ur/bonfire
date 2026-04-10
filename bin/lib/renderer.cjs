'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJSON, loadSchema, timestamp } = require('./utils.cjs');
const { appendLog } = require('./logger.cjs');

// ---------------------------------------------------------------------------
// Template engine
// ---------------------------------------------------------------------------

/**
 * Render a template string with data.
 * Supports:
 *   {{field}}           — value substitution (empty string for undefined)
 *   {{#each array}}...{{/each}} — array iteration
 *   {{.}}               — current element in primitive array iteration
 */
function renderTemplate(template, data) {
  // Process {{#each arrayName}}...{{/each}} blocks
  const eachRe = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let result = template.replace(eachRe, (_, arrayName, block) => {
    const arr = data[arrayName];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        // Substitute {{field}} inside block using item's properties
        return block.replace(/\{\{(\w+)\}\}/g, (m, key) => {
          const val = item[key];
          return val === undefined || val === null ? '' : String(val);
        });
      } else {
        // Primitive — substitute {{.}}
        return block.replace(/\{\{\.\}\}/g, String(item));
      }
    }).join('');
  });

  // Process remaining {{field}} substitutions from top-level data
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    return val === undefined || val === null ? '' : String(val);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Source resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dotted path selector into a JSON object.
 * e.g. "stages.preprocess" on { stages: { preprocess: {...} } }
 */
function resolvePath(obj, selector) {
  return selector.split('.').reduce((cur, key) => {
    if (cur === null || cur === undefined) return undefined;
    return cur[key];
  }, obj);
}

/**
 * Load data for a note definition's source field.
 * Handles:
 *   - plain path:            "case.json"
 *   - path with selector:   "case.json#stages.preprocess"
 *   - multi-source (+ sep): "plan/a.json+plan/b.json"
 *   - run template vars:    "runs/{run_id}/code-run.json"
 */
function resolveSource(bonfireDir, sourceSpec, opts) {
  opts = opts || {};

  // Replace template vars like {run_id}
  let spec = sourceSpec.replace(/\{(\w+)\}/g, (_, key) => {
    return opts[key] || key;
  });

  // Multi-source (+ separator, no #)
  if (spec.includes('+')) {
    const parts = spec.split('+');
    const combined = {};
    for (const part of parts) {
      const data = loadJSON(path.join(bonfireDir, part));
      if (data && typeof data === 'object') {
        Object.assign(combined, data);
      }
    }
    return combined;
  }

  // Path selector (#)
  if (spec.includes('#')) {
    const [filePart, selector] = spec.split('#');
    const data = loadJSON(path.join(bonfireDir, filePart));
    if (!data) return null;
    return resolvePath(data, selector);
  }

  // Plain path
  return loadJSON(path.join(bonfireDir, spec));
}

// ---------------------------------------------------------------------------
// Per-note data preprocessors
// ---------------------------------------------------------------------------

/**
 * Preprocess data for constraint-ledger note.
 * Splits entries object into frozen/active/risk/discarded arrays,
 * and stringifies array fields like challenged_by / aligned_by.
 */
function preprocessConstraintLedger(data) {
  if (!data || !data.entries) return data;

  const entries = data.entries;
  const byStatus = data.by_status || {};

  const frozenIds = new Set(byStatus.frozen || []);
  const openIds = new Set(byStatus.open || []);
  const discardedIds = new Set(byStatus.discarded || []);

  const frozen_entries = [];
  const active_entries = [];
  const risk_entries = [];
  const discarded_entries = [];

  for (const [id, entry] of Object.entries(entries)) {
    const enriched = Object.assign({}, entry, {
      challenged_by_str: Array.isArray(entry.challenged_by)
        ? entry.challenged_by.join(', ')
        : (entry.challenged_by || ''),
      aligned_by_str: Array.isArray(entry.aligned_by)
        ? entry.aligned_by.join(', ')
        : (entry.aligned_by || ''),
    });

    if (frozenIds.has(id)) {
      frozen_entries.push(enriched);
    } else if (discardedIds.has(id)) {
      discarded_entries.push(enriched);
    } else if (openIds.has(id)) {
      risk_entries.push(enriched);
    } else {
      active_entries.push(enriched);
    }
  }

  return Object.assign({}, data, {
    frozen_entries,
    active_entries,
    risk_entries,
    discarded_entries,
  });
}

/**
 * Dispatch to the right preprocessor for a given note id.
 */
function preprocessData(noteId, data) {
  switch (noteId) {
    case 'constraint-ledger':
      return preprocessConstraintLedger(data);
    default:
      return data;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * renderNote(root, noteId, opts)
 *
 * root    — project root (the directory containing .bonfire/)
 * noteId  — id from bonfire-v1.json notes array (e.g. "constraint-ledger")
 * opts    — optional: { run_id, output_dir }
 *
 * Returns { success: true, outputPath } or { success: false, error }
 */
function renderNote(root, noteId, opts) {
  opts = opts || {};

  // Locate .bonfire directory
  const bonfireDir = path.join(root, '.bonfire');
  if (!fs.existsSync(bonfireDir)) {
    return { success: false, error: '.bonfire directory not found at ' + root };
  }

  // Load schema and find note definition
  const schema = loadSchema();
  if (!schema || !Array.isArray(schema.notes)) {
    return { success: false, error: 'Could not load bonfire-v1.json schema' };
  }
  const noteDef = schema.notes.find(n => n.id === noteId);
  if (!noteDef) {
    return { success: false, error: 'Unknown note id: ' + noteId };
  }

  // Resolve source data
  let data = resolveSource(bonfireDir, noteDef.source, opts);
  if (data === null || data === undefined) {
    return { success: false, error: 'Source data not found for note: ' + noteId };
  }

  // Load template
  const templatesDir = path.join(__dirname, '..', '..', 'templates');
  const templatePath = path.join(templatesDir, noteDef.template);
  let templateContent;
  try {
    templateContent = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    return { success: false, error: 'Template not found: ' + templatePath };
  }

  // Preprocess data (note-specific transformations)
  data = preprocessData(noteId, data);

  // Render
  const rendered = renderTemplate(templateContent, data);

  // Determine output directory
  let outputDir;
  if (opts.output_dir) {
    outputDir = path.isAbsolute(opts.output_dir)
      ? opts.output_dir
      : path.join(bonfireDir, opts.output_dir);
  } else if (noteDef.output_dir) {
    // Replace template vars in output_dir
    const resolvedOutputDir = noteDef.output_dir.replace(/\{(\w+)\}/g, (_, key) => opts[key] || key);
    outputDir = path.join(bonfireDir, resolvedOutputDir);
  } else {
    outputDir = path.join(bonfireDir, 'bundle');
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Determine output filename (replace template vars)
  const filename = noteDef.filename.replace(/\{(\w+)\}/g, (_, key) => opts[key] || key);
  const outputPath = path.join(outputDir, filename);

  // Write rendered output
  fs.writeFileSync(outputPath, rendered, 'utf8');

  // Compute SHA256 hash of rendered content
  const hash = crypto.createHash('sha256').update(rendered).digest('hex');

  // Append render log
  const logPath = path.join(bonfireDir, 'logs', 'render.log');
  appendLog(logPath, {
    note_id: noteId,
    filename,
    output_path: outputPath,
    sha256: hash,
    timestamp: timestamp(),
  });

  return { success: true, outputPath };
}

/**
 * renderAll(root, opts)
 *
 * Renders all notes defined in the schema that have available source data.
 * Returns array of per-note results.
 */
function renderAll(root, opts) {
  opts = opts || {};

  const schema = loadSchema();
  if (!schema || !Array.isArray(schema.notes)) {
    return [{ success: false, error: 'Could not load bonfire-v1.json schema' }];
  }

  return schema.notes.map(noteDef => {
    try {
      return Object.assign({ note_id: noteDef.id }, renderNote(root, noteDef.id, opts));
    } catch (err) {
      return { note_id: noteDef.id, success: false, error: err.message };
    }
  });
}

/**
 * renderCheck(root)
 *
 * Check which notes have up-to-date rendered output vs source data.
 * Returns array of { note_id, filename, status } where status is
 * 'ok', 'missing', or 'stale'.
 */
function renderCheck(root) {
  const bonfireDir = path.join(root, '.bonfire');
  const schema = loadSchema();
  if (!schema || !Array.isArray(schema.notes)) {
    return [];
  }

  return schema.notes.map(noteDef => {
    const outputPath = path.join(bonfireDir, 'bundle', noteDef.filename);
    if (!fs.existsSync(outputPath)) {
      return { note_id: noteDef.id, filename: noteDef.filename, status: 'missing' };
    }

    // Simple staleness check: compare mtime of output vs source
    const sourcePath = noteDef.source.split('#')[0].split('+')[0];
    const fullSourcePath = path.join(bonfireDir, sourcePath);
    if (!fs.existsSync(fullSourcePath)) {
      return { note_id: noteDef.id, filename: noteDef.filename, status: 'missing_source' };
    }

    const outputMtime = fs.statSync(outputPath).mtimeMs;
    const sourceMtime = fs.statSync(fullSourcePath).mtimeMs;

    return {
      note_id: noteDef.id,
      filename: noteDef.filename,
      status: sourceMtime > outputMtime ? 'stale' : 'ok',
    };
  });
}

module.exports = { renderTemplate, renderNote, renderAll, renderCheck };
