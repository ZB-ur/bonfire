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
    // Skip markdown headers (lines starting with ##, or marked **...**)
    if (line.startsWith('**') && line.endsWith('**')) continue;
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
  /\bfor each\s+\w+\s+(produce|provide|give|return|emit|write|output)\b/i,
  /\bgive\s+\w+\s+for every\b/i,
  /\bwrite out every\b/i,
  /\bone per\s+\w+\b/i,  // e.g. "one per category" — enumeration by another name
];

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
};
