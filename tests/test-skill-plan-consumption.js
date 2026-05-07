'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'plan', 'SKILL.md');

test('skills/plan/SKILL.md step 45 consumes reentry_request signal', () => {
  // Anchor: step 45 body — from "45." line through next numbered step or
  // section break. Step renumbering will fail this test loudly (good signal:
  // anchor needs updating, not silent acceptance of drift).
  const md = fs.readFileSync(SKILL_PATH, 'utf8');
  const m = md.match(/^45\.\s+[\s\S]*?(?=^46\.|\n\n## |\Z)/m);
  assert.ok(m, 'step 45 not found in SKILL.md (was the step renumbered?)');
  const step45 = m[0];

  assert.ok(
    step45.includes('reentry_request'),
    'step 45 missing reentry_request handling — skill must consume the signal J-Compile emits'
  );
  assert.ok(
    step45.includes('conflict_type'),
    'step 45 missing conflict_type extraction — must dispatch state-reentry on J-declared conflict_type'
  );
  assert.ok(
    step45.includes('handoff_incomplete'),
    'step 45 lost handoff_incomplete fallback — errors-mode failures must still route'
  );
});
