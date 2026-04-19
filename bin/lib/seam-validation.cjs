'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Format whitelist — loaded from references/stage-j-format-whitelist.md
// ---------------------------------------------------------------------------

const WHITELIST_PATH = path.join(__dirname, '..', '..', 'references', 'stage-j-format-whitelist.md');

let _whitelistCache = null;

function loadFormatWhitelist() {
  if (_whitelistCache) return _whitelistCache;
  const source = fs.readFileSync(WHITELIST_PATH, 'utf8');
  const set = new Set();
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('---')) continue;
    // Skip any prose line that begins with a bold label (e.g. `**Purpose:** ...`)
    // or a backticked code reference — these are documentation, not whitelist
    // content. The original `startsWith('**') && endsWith('**')` check missed
    // lines with trailing punctuation (period, colon), leaking prose tokens
    // like "words", "tokens", "logical", "group" into the whitelist.
    if (line.startsWith('**')) continue;
    if (line.startsWith('`')) continue;
    // Each whitespace-separated token becomes an entry
    for (const token of line.split(/\s+/)) {
      if (token && !token.startsWith('#')) {
        set.add(token.toLowerCase());
      }
    }
  }
  _whitelistCache = set;
  return set;
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

// Split on whitespace and ASCII punctuation EXCEPT hyphens inside identifiers.
// Preserves CON-014, stage-j, hand-strength as single tokens.
// Preserves CJK runs as single whole-string tokens (NOT per-character) —
// matches spec §6.4 "tokenized by whitespace/punctuation boundaries and compared
// literally". Per-char tokenization would let enumerations of individual chars
// authorize arbitrary recombinations.
// Lowercases latin runs.
function extractSubstantiveTokens(text) {
  if (typeof text !== 'string') return [];
  const boundaryRegex = /[\s.,;:!?()\[\]{}"'`]/;
  const tokens = [];
  let buffer = '';
  const flush = () => {
    if (buffer.length === 0) return;
    // Latin gets lowercased; CJK is case-insensitive already. A run with mixed
    // CJK + latin is lowercased wholesale (JS toLowerCase leaves CJK unchanged).
    tokens.push(buffer.toLowerCase());
    buffer = '';
  };
  for (const ch of text) {
    if (boundaryRegex.test(ch)) {
      flush();
    } else {
      buffer += ch;
    }
  }
  flush();
  return tokens;
}

// ---------------------------------------------------------------------------
// Lemmatization — latin only
// ---------------------------------------------------------------------------

function lemmatizeToken(token) {
  if (typeof token !== 'string') return token;
  if (token.length < 4) return token;  // don't munge short tokens
  if (isCJKToken(token)) return token;  // no CJK lemmatization
  // Preserve identifiers like con-014, stage-j
  if (/-\d/.test(token) || /-[a-z]$/.test(token)) return token;
  // Drop trailing 'ing' (>=4 chars remain)
  if (token.endsWith('ing') && token.length >= 6) return token.slice(0, -3);
  // Drop trailing 'd' when preceded by 'e' (e.g., placed -> place). Keeping
  // the stem-final 'e' matches common English e-drop inflection.
  if (token.endsWith('ed') && token.length >= 5) return token.slice(0, -1);
  // Drop trailing 'es'
  if (token.endsWith('es') && token.length >= 5) return token.slice(0, -2);
  // Drop trailing 's'
  if (token.endsWith('s') && token.length >= 4) return token.slice(0, -1);
  return token;
}

// ---------------------------------------------------------------------------
// CJK detection
// ---------------------------------------------------------------------------

function isCJKToken(token) {
  if (typeof token !== 'string') return false;
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(token);
}

// ---------------------------------------------------------------------------
// Verb blacklist — conditions containing any of these verbs fail Layer 1
// ---------------------------------------------------------------------------

const VERB_BLACKLIST = new Set([
  'enumerate', 'enumerated', 'enumerates', 'enumerating',
  'classify', 'classified', 'classifies', 'classifying',
  'categorize', 'categorized', 'categorizes', 'categorizing',
  'partition', 'partitioned', 'partitions', 'partitioning',
  'define', 'defined', 'defines', 'defining',
  'specify', 'specified', 'specifies', 'specifying',
  'list',  // as verb — noun use "list of" is caught by surrounding tokens
  'rank', 'ranked', 'ranks', 'ranking',
  'distinguish', 'distinguished', 'distinguishes', 'distinguishing',
  'decompose', 'decomposed', 'decomposes', 'decomposing',
]);

// ---------------------------------------------------------------------------
// Paraphrase patterns — multi-word regexes that catch blacklisted intent
// dressed up in language that avoids the single-word verb set. Per spec §6.2
// "Also reject common paraphrases: 'document each', 'for each … produce',
// 'give … for every'." Extend conservatively: every new pattern must be
// grounded in an adversarial fixture, never speculation.
// ---------------------------------------------------------------------------

const PARAPHRASE_PATTERNS = [
  /\bdocument each\b/i,
  /\bfor each\s+(?:\w+\s+){1,5}(produce|provide|give|return|emit|write|output)\b/i,
  /\bgive\s+\w+\s+for every\b/i,
  /\bwrite out every\b/i,
  /\bone per\s+\w+\b/i,  // e.g. "one per category" — enumeration by another name
];

// ---------------------------------------------------------------------------
// validateHConditions — Layer 1 entry check
// ---------------------------------------------------------------------------

function buildFrozenTokenVocabulary(snapshot) {
  // Aggregate all substantive tokens from FROZEN ledger entries + the ledger id set.
  const tokens = new Set();
  const frozenIds = new Set();
  const entries = (snapshot && snapshot.entries) || {};
  for (const [id, entry] of Object.entries(entries)) {
    if (entry && entry.status === 'FROZEN') {
      frozenIds.add(id.toLowerCase());
      const contentTokens = extractSubstantiveTokens(entry.content || '');
      for (const t of contentTokens) {
        // Record both the raw token (for CJK literal match) and the lemma.
        tokens.add(t);
        tokens.add(lemmatizeToken(t));
      }
    }
  }
  return { tokens, frozenIds };
}

function validateHConditions(verdict, snapshot) {
  const violations = [];

  if (!verdict || verdict.verdict !== 'approved_with_conditions') {
    return { valid: true, violations };
  }

  const conditions = Array.isArray(verdict.conditions) ? verdict.conditions : [];

  if (conditions.length === 0) {
    violations.push({
      index: null,
      reason: 'verdict is approved_with_conditions but conditions array is empty — use verdict: "approved" instead',
    });
    return { valid: false, violations };
  }

  const whitelist = loadFormatWhitelist();
  const { tokens: frozenTokens, frozenIds } = buildFrozenTokenVocabulary(snapshot);

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const text = cond && cond.text ? String(cond.text) : '';
    const condTokens = extractSubstantiveTokens(text);

    // Rule 1.5: paraphrase patterns — multi-word regexes that catch dodges
    // of the single-word verb blacklist. Scanned BEFORE verb blacklist so
    // that paraphrase-caught conditions get the specific paraphrase reason.
    let paraphraseHit = false;
    for (const pat of PARAPHRASE_PATTERNS) {
      if (pat.test(text)) {
        violations.push({
          index: i,
          reason: `condition text matches blacklisted paraphrase pattern "${pat.source}" — use rejected + appropriate conflict_type instead`,
        });
        paraphraseHit = true;
        break;
      }
    }
    if (paraphraseHit) continue;  // skip further rules for this condition; one violation per condition is enough

    // Rule 2: verb blacklist
    let verbHit = false;
    for (const token of condTokens) {
      if (VERB_BLACKLIST.has(token)) {
        violations.push({
          index: i,
          reason: `condition text contains blacklisted verb "${token}" — use rejected + appropriate conflict_type instead`,
        });
        verbHit = true;
        break;  // one violation per condition is enough
      }
    }
    if (verbHit) continue;

    // Rule 1: token coverage
    for (const rawToken of condTokens) {
      const token = lemmatizeToken(rawToken);
      if (whitelist.has(token)) continue;
      if (whitelist.has(rawToken)) continue;
      if (frozenTokens.has(token)) continue;
      if (frozenTokens.has(rawToken)) continue;
      if (frozenIds.has(rawToken) || frozenIds.has(token)) continue;
      // CJK tokens must be exact-match in frozenTokens (no lemmatization)
      if (isCJKToken(rawToken) && frozenTokens.has(rawToken)) continue;
      violations.push({
        index: i,
        reason: `orphan substantive token "${rawToken}" not in FROZEN ledger or format whitelist`,
      });
      // Don't break — we want to report all orphan tokens per condition
    }
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// compareTokens — Layer 2b core (per-slot token overlap)
// ---------------------------------------------------------------------------

function compareTokens(slotTokens, sourceText) {
  const whitelist = loadFormatWhitelist();
  const sourceTokens = extractSubstantiveTokens(sourceText || '');
  const sourceSet = new Set();
  for (const t of sourceTokens) {
    sourceSet.add(lemmatizeToken(t));
    sourceSet.add(t);  // also keep raw for CJK exact-match
  }

  const orphans = [];
  for (const raw of slotTokens) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (whitelist.has(raw)) continue;
    const lemma = lemmatizeToken(raw);
    if (whitelist.has(lemma)) continue;
    if (isCJKToken(raw)) {
      // CJK: literal match only, no lemmatization
      if (sourceSet.has(raw)) continue;
      orphans.push(raw);
      continue;
    }
    if (sourceSet.has(lemma) || sourceSet.has(raw)) continue;
    orphans.push(raw);
  }
  return orphans;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadFormatWhitelist,
  extractSubstantiveTokens,
  lemmatizeToken,
  isCJKToken,
  VERB_BLACKLIST,
  PARAPHRASE_PATTERNS,
  validateHConditions,
  compareTokens,
};
