# Assertion 3c Implementation Plan — State-Machine Coherence Closure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 3 state-machine coherence drift sites (findings #1, #7, #11) surfaced by 2nd dogfood (bilibili-clean 2026-05-08) by (a) defaulting `challenged_claim` entries to `PROPOSED` so the existing auto-transition path restores the CHALLENGED invariant; (b) enhancing `truth-annotate` FROZEN-gate error with a literal `truth-update` CLI hint for operator-facing actionability; (c) replacing `stateInitCodeSteps` sequential rename with literal `unit.id` preserve plus format-regex validation.

**Architecture:** Two small code-side edits (`bin/lib/truth-surface.cjs` for #1+#7, `bin/lib/state.cjs` for #11) plus one new acceptance test file (`tests/test-state-machine-coherence.js`). No schema change. No new dependency. Conservative-plus mandate: declarative status-default + error-message UX + literal ID preserve; no agent contract / no replay-side / no annotate-vs-update merge.

**Tech Stack:** CommonJS Node.js, `node:test` + `node:assert/strict`, `child_process.execFileSync` for CLI exercise per existing `tests/test-truth-cli.js` pattern. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-12-bonfire-assertion-3c-design.md` (v0.1 amended-frozen at HEAD `636db0b`).

**Empirical anchor:** `docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/` (2nd dogfood; findings #1, #7, #11). Finding #1 also reproduced independently in `docs/superpowers/evidence/2026-05-04-gto-trainer-v0.1-dogfood-findings/` finding #4 — 2-archive validation.

---

## Execution Sequence

**T1 serial → T2 serial → T3 serial** per Lesson 1 (prefer serial dispatch by default to avoid git race; parallel only when ROI is substantial).

| Task | Mode | Reason |
|---|---|---|
| T1 (truth-surface.cjs) | Sequential | Foundation; covers 2 mechanism sites in single file. T3 predicates 1-3 exercise this file's behavior. |
| T2 (state.cjs) | Sequential after T1 | Independent file but small scope (~15 LOC); parallel ROI not worth git-race risk for 2-task batch. T3 predicates 4-6 exercise this file's behavior. |
| T3 (acceptance test) | Sequential after T2 | New test file ~150 LOC; predicates span both T1 and T2 — must land after both code changes. |

**Lesson carry-forwards:**
- **Lesson 4 (architect-substitute)**: each task includes a "literal-quote anchor" sub-step naming the exact lines + condition strings the implementer MUST preserve verbatim. Memory-vs-code divergence already caught finding #6 misclassification during pre-plan reconnaissance — same discipline applies to mechanism edits.
- **Lesson 1 (git race)**: serial dispatch only; no `git add .` / `-A`; each task commits with explicit per-file `git add <path>`.
- **Lesson 5/7 (architect-substitute close)**: after each task, architect cross-check via `git diff HEAD~1 HEAD -- <file>` mirrors spec §5.x lines verbatim before marking complete.

---

## File Structure

| File | Role | 3c change |
|---|---|---|
| `bin/lib/truth-surface.cjs` | Truth-surface ledger CLI implementation (replay, propose, update, freeze, annotate) | §5.1: line 27 `challenged_claim: 'CHALLENGED'` → `'PROPOSED'` (1 line); §5.2: line 349 annotate FROZEN-gate error enhanced with literal `truth-update` CLI hint (~5 lines) |
| `bin/lib/state.cjs` | Pipeline state-machine (init, advance, init-code-steps) | §5.3: `stateInitCodeSteps` (lines 620-622 + 629-631) — sequential rename replaced with literal `unit.id` preserve + ASCII format regex + invalid-id fail-loud; `current_step` hardcoded `'unit-1'` replaced with `units[0].id` (preserving load-bearing condition clause) |
| `tests/test-state-machine-coherence.js` | Acceptance test (NEW) | Implement spec §7 predicates 1-6 as `node:test` cases using `child_process.execFileSync` for CLI exercise + direct `stateInitCodeSteps` invocation for #11 fixtures |

---

## Task 1: `truth-surface.cjs` — challenged_claim PROPOSED default + annotate error hint

**Files:**
- Modify: `bin/lib/truth-surface.cjs` (2 sites: line 27 + line 349)

**Spec ref:** §5.1 (#1 fix — challenged_claim PROPOSED default), §5.2 (#7 fix — truth-annotate error enhancement). §4 mandate scope. §7 predicates 1, 2, 3.

**Literal-quote anchors (Lesson 4 — implementer MUST preserve verbatim):**
1. §5.1 change is **single-line at line 27 only**. Auto-transition logic at lines 150-152 MUST NOT be touched — it is the existing mechanism this fix relies on.
2. §5.2 error message MUST contain the literal substring `truth-update` (the CLI name) AND a concrete example invocation containing `--field evidence_refs --value`. Generic phrasing like "use the appropriate CLI" is a spec violation per §5.2 binding contract.

- [ ] **Step 1.1: Locate and verify line 27 + line 349 anchors**

Run:
```bash
grep -n "challenged_claim:" bin/lib/truth-surface.cjs
grep -n "must be FROZEN" bin/lib/truth-surface.cjs
```

Expected:
```
27:  challenged_claim:   'CHALLENGED',
349:    throw new Error(`annotate: entry "${id}" must be FROZEN (current status: "${entry.status}")`);
```

If line numbers differ, the file shifted since spec freeze — verify the line content matches spec §5.1 and §5.2 verbatim before editing. Do NOT trust plan literal numbers (Lesson 4 dispatch discipline).

- [ ] **Step 1.2: Write the failing test (deferred — see Task 3)**

Test cases for §7 predicates 1, 2, 3 land in Task 3 (`tests/test-state-machine-coherence.js`). T1 commit produces the mechanism change; T3 commit produces the predicates that exercise it. Justification: T1+T2+T3 are within a single dialectic-ratified plan, so the customary TDD red-green-refactor cycle is amortized across the plan rather than enforced per-task. Existing `tests/test-truth-cli.js` regression suite stays green throughout (verified in Step 1.5).

- [ ] **Step 1.3: Apply §5.1 fix — line 27 single-line change**

Edit `bin/lib/truth-surface.cjs` line 27:

```diff
   confirmed_fact:     'PROPOSED',
   frozen_constraint:  'PROPOSED',
-  challenged_claim:   'CHALLENGED',
+  challenged_claim:   'PROPOSED',
   discarded_option:   'DISCARDED',
```

Do NOT modify any other line in the `CATEGORY_INITIAL_STATUS` table. Do NOT modify the auto-transition logic at lines 150-152 (which reads `if (field === 'challenged_by' && entry.challenged_by.length > 0 && entry.status === 'PROPOSED')`). The auto-transition is exactly what makes this change work: `challenged_claim` entries now start PROPOSED, and the first `truth-update --field challenged_by --value <id>` will fire the existing PROPOSED → CHALLENGED transition.

- [ ] **Step 1.4: Apply §5.2 fix — line 349 error enhancement**

Edit `bin/lib/truth-surface.cjs` line 349. Current:

```javascript
  if (entry.status !== 'FROZEN') {
    throw new Error(`annotate: entry "${id}" must be FROZEN (current status: "${entry.status}")`);
  }
```

Replace with:

```javascript
  if (entry.status !== 'FROZEN') {
    throw new Error(
      `truth-annotate: entry "${id}" must be FROZEN (current status: "${entry.status}"). ` +
      `Hint: For PROPOSED/CHALLENGED entries, use truth-update to add evidence: ` +
      `bonfire truth-update --id ${id} --field evidence_refs --value <ref-id>`
    );
  }
```

The error message MUST contain:
- The literal CLI name `truth-update` (not "the update CLI" or similar paraphrase).
- A literal example invocation containing `--field evidence_refs --value` (not generic "use appropriate flags").
- The entry ID interpolated via `${id}` (not a placeholder like `<entry-id>`).

This wording is the §5.2 binding contract.

- [ ] **Step 1.5: Run full test suite to verify no regression**

Run: `node --test tests/*.js | tail -10`

Expected: all existing tests PASS (~315 baseline). Contract changes (§5.1 default; §5.2 error wording) have indeterminate downstream consumers — narrow regression suites would miss downstream test assertions hardcoding the old contract.

If any test fails:
- **Stale assertion of old contract (e.g., test asserts `status === 'CHALLENGED'` for fresh `challenged_claim`)**: surface to architect via DONE_WITH_CONCERNS with the failing test name + assertion line + actual-vs-expected. Do NOT fix silently — architect adjudicates whether the alignment is in-scope fold-in for this task or a separate commit.
- **Truly unrelated regression**: investigate before proceeding. Report BLOCKED if cause is unclear.

Do not modify any test to match new error wording or new default — that adjudication is the architect's, not the implementer's.

- [ ] **Step 1.6: Architect cross-check anchors**

Architect-side verification before commit:

```bash
git diff bin/lib/truth-surface.cjs | grep -E "^[-+] *challenged_claim:"
git diff bin/lib/truth-surface.cjs | grep -E "^\+.*truth-update.*--field evidence_refs --value"
```

Expected:
- First grep shows exactly two lines: `-  challenged_claim:   'CHALLENGED',` and `+  challenged_claim:   'PROPOSED',`.
- Second grep shows at least one matching line containing both `truth-update` and `--field evidence_refs --value` literal substrings.

If either grep returns unexpected output, the implementer drifted from §5.1/§5.2 verbatim wording. Fix before commit.

- [ ] **Step 1.7: Commit**

```bash
git add bin/lib/truth-surface.cjs
git commit -m "$(cat <<'EOF'
feat(3c): challenged_claim PROPOSED default + truth-annotate error hint

§5.1 #1 fix: challenged_claim initial status PROPOSED (was CHALLENGED);
auto-transition at line 150-152 restores CHALLENGED on first challenged_by
populate, unifying with other categories' state-machine invariant.

§5.2 #7 fix: truth-annotate FROZEN-gate error enhanced with literal
truth-update CLI hint for operator-facing actionability (UX-discovery
reframe per Stage 1 Q3 ground-truth grep).

Spec: docs/superpowers/specs/2026-05-12-bonfire-assertion-3c-design.md
Evidence: docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/
  (findings #1 + #7); finding #1 also reproduced in 2026-05-04 gto-trainer
  finding #4 (2-archive validation).
EOF
)"
```

---

## Task 2: `state.cjs` — stateInitCodeSteps literal unit.id preserve

**Files:**
- Modify: `bin/lib/state.cjs` (single function `stateInitCodeSteps`, lines 620-622 + 629-631)

**Spec ref:** §5.3 (#11 fix — stateInitCodeSteps literal unit.id preserve). §4 mandate scope. §7 predicates 4, 5, 6.

**Literal-quote anchors (Lesson 4 — implementer MUST preserve verbatim):**
1. The current_step initialization condition at line 629 — `(!state.current_step || !state.current_step.startsWith('unit-'))` — is **load-bearing** for pre→code pipeline transition (when `state.current_step` is `'stage-a'` or another non-`unit-` value, this clause enables the transition to first unit). It MUST be preserved verbatim; ONLY the assigned value (`'unit-1'`) changes to `units[0].id`.
2. The format regex `/^unit-[\w.-]+$/` MUST NOT include the `/u` flag. ASCII-only support is the deliberate v0.1 scope per spec §5.3 + DQ-2 deferral. Adding `/u` would silently extend support to Unicode identifiers without spec amendment.
3. `\w` in regex source code MUST be written `\w` (single backslash). The error message string MAY contain `\\w` (escaped) for stderr display, but the regex itself uses single backslash.

- [ ] **Step 2.1: Locate and verify the function anchor**

Run:
```bash
grep -n "^function stateInitCodeSteps" bin/lib/state.cjs
grep -nF 'unit-${i + 1}' bin/lib/state.cjs
grep -n "state.current_step = 'unit-1'" bin/lib/state.cjs
```

Expected:
```
600:function stateInitCodeSteps(args) {
621:    const stepName = `unit-${i + 1}`;
630:    state.current_step = 'unit-1';
```

If line numbers differ, the file shifted — verify the function body matches spec §5.3 verbatim before editing.

- [ ] **Step 2.2: Apply §5.3 fix — literal unit.id preserve + format regex**

Edit `bin/lib/state.cjs`. The `for` loop at lines 620-623 currently reads:

```javascript
  for (let i = 0; i < units.length; i++) {
    const stepName = `unit-${i + 1}`;
    steps[stepName] = { status: 'pending', pipeline: 'code' };
  }
```

Replace with:

```javascript
  for (let i = 0; i < units.length; i++) {
    const unitId = units[i].id;
    if (!unitId || !/^unit-[\w.-]+$/.test(unitId)) {
      exitError(`stateInitCodeSteps: unit at index ${i} has invalid id="${unitId}"; ` +
                `expected format unit-[\\w.-]+`, [], 3);
    }
    const stepName = unitId;
    steps[stepName] = { status: 'pending', pipeline: 'code' };
  }
```

Required properties of this edit:
- Regex literal `/^unit-[\w.-]+$/` (no `/u` flag — ASCII only is v0.1 scope).
- Error message contains literal substrings `invalid id` and `unit-[\w.-]+` (the latter escaped as `\\w` inside the JS string).
- `exitError` is called with exit code `3` (matches existing failure convention 3 lines above at line 615 `exitError('compile-output.json missing handoff.implementation_units', [], 3)`).
- `unitId` variable name is local; no module-level constants extracted.

- [ ] **Step 2.3: Apply §5.3 fix — current_step literal preserve**

The block at lines 628-631 currently reads:

```javascript
  // Set current_step to first unit if not set
  if (units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))) {
    state.current_step = 'unit-1';
  }
```

Replace ONLY the assigned value (line 630), preserving the entire condition verbatim:

```javascript
  // Set current_step to first unit if not set
  if (units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))) {
    state.current_step = units[0].id;
  }
```

Required properties of this edit:
- The condition `units.length > 0 && (!state.current_step || !state.current_step.startsWith('unit-'))` is preserved character-for-character. The `!state.current_step.startsWith('unit-')` clause is what allows transition from `'stage-a'` (pre/plan-stage value) to the first code unit; dropping it would regress the pre→code pipeline progression.
- The comment line `// Set current_step to first unit if not set` is preserved.
- ONLY `'unit-1'` → `units[0].id` changes. No new helper function. No additional validation (the regex check in Step 2.2 already gated `units[0].id`).

- [ ] **Step 2.4: Run full test suite to verify no regression**

Run: `node --test tests/*.js | tail -10`

Expected: all existing tests PASS (baseline from post-T1 close). Existing fixtures use sequential `unit-1`, `unit-2`, ... IDs (matching what the OLD code generated), so they will still match the NEW behavior (which preserves whatever `unit.id` is supplied — and existing fixtures supply `unit-1`, `unit-2` literally).

If any test fails:
- **Fixture with invalid unit.id (e.g., `undefined`, `null`, unusual chars failing `/^unit-[\w.-]+$/`)**: surface to architect via DONE_WITH_CONCERNS with the failing test name + fixture file + actual id value. Do NOT modify production code (the regex is the binding contract) or silently rewrite fixtures.
- **Stale assertion of old sequential-rename behavior**: surface to architect via DONE_WITH_CONCERNS for adjudication (architect decides if test alignment is in-scope fold-in or separate commit).
- **Truly unrelated regression**: investigate before proceeding. Report BLOCKED if cause is unclear.

- [ ] **Step 2.5: Architect cross-check anchors**

```bash
git diff bin/lib/state.cjs | grep -F 'unit-[\w.-]+'
git diff bin/lib/state.cjs | grep -E "startsWith\('unit-'\)"
git diff bin/lib/state.cjs | grep -F 'state.current_step = units[0].id'
```

Expected:
- First grep (fixed-string match for the regex literal `unit-[\w.-]+`) returns at least one `+` line — both the regex test and the error message contain this literal substring.
- Second grep returns BOTH the `-` (deleted) AND `+` (added/preserved) version of the condition — confirming the condition was carried through, not dropped. If only `-` appears, the implementer dropped the load-bearing clause.
- Third grep (fixed-string match) returns at least one `+` line for the new `state.current_step = units[0].id` assignment.

If second grep shows only the deletion, STOP — the load-bearing condition was dropped. Reinsert per Step 2.3 verbatim before commit.

- [ ] **Step 2.6: Commit**

```bash
git add bin/lib/state.cjs
git commit -m "$(cat <<'EOF'
feat(3c): stateInitCodeSteps literal unit.id preserve + format regex

§5.3 #11 fix: replace sequential rename (`unit-${i+1}`) with literal
`units[i].id` preserve; gate by ASCII format regex `unit-[\w.-]+` with
fail-loud on invalid id. Operator-facing `unit-1.5`, `unit-foo_bar`, etc.
now survive into state.steps keys.

current_step initialization: hardcoded `'unit-1'` → `units[0].id`;
load-bearing condition `(!state.current_step ||
!state.current_step.startsWith('unit-'))` preserved verbatim to
maintain pre→code pipeline transition semantics.

Non-Latin script ids (e.g., `unit-α-1`) deferred to spec DQ-2.

Spec: docs/superpowers/specs/2026-05-12-bonfire-assertion-3c-design.md
Evidence: docs/superpowers/evidence/2026-05-08-bilibili-danmaku-clean/
  (finding #11).
EOF
)"
```

---

## Task 3: Acceptance test — `tests/test-state-machine-coherence.js`

**Files:**
- Create: `tests/test-state-machine-coherence.js`

**Spec ref:** §7 acceptance criteria (predicates 1-6). §4 mandate scope.

**Test pattern:** Mirror `tests/test-truth-cli.js` — `node:test` + `node:assert/strict` + `child_process.execFileSync` against tmpdir bonfire instances. For predicates 4-6 (#11), invoke `stateInitCodeSteps` via the CLI dispatcher (`state-init-code-steps` subcommand) against a fixture `plan/compile-output.json` written into the tmpdir.

**Literal-quote anchors (Lesson 4 — implementer MUST preserve verbatim):**
1. Predicate 3 (truth-annotate error hint) MUST assert that stderr contains the literal substring `truth-update` AND the literal substring `--field evidence_refs --value` (matching §5.2 binding contract).
2. Predicate 4 (unit.id literal preserve) MUST use fixture `[{id: "unit-1"}, {id: "unit-1.5"}, {id: "unit-2"}]` and assert keys `'unit-1'`, `'unit-1.5'`, `'unit-2'` (NOT sequential `unit-1/2/3`).
3. Predicate 5 (unit.id format reject) MUST use fixture `[{id: "unit-foo bar"}]` (literal space character) and assert stderr contains `invalid id` AND `unit-[\\w.-]+`.

- [ ] **Step 3.1: Locate CLI dispatcher entry for state-init-code-steps**

Run: `grep -n "state-init-code-steps\|stateInitCodeSteps" bin/bonfire-tools.cjs`

Expected: a `case 'state-init-code-steps':` or similar dispatch line. Note the exact subcommand name (with hyphens) — Step 3.3 will invoke it via `execFileSync('node', [CLI, '<subcommand>'], ...)`.

If the subcommand name differs from `state-init-code-steps`, use the actual subcommand throughout Steps 3.6, 3.7, 3.8 (predicates 4, 5, 6).

- [ ] **Step 3.2: Create test file scaffold**

Create `tests/test-state-machine-coherence.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-3c-test-'));
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], { encoding: 'utf8', cwd: dir });
  return dir;
}

function readSnapshot(dir) {
  const snapPath = path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json');
  return JSON.parse(fs.readFileSync(snapPath, 'utf8'));
}

function writeCompileOutput(dir, units) {
  const planDir = path.join(dir, '.bonfire', 'plan');
  fs.mkdirSync(planDir, { recursive: true });
  const compileOutput = {
    handoff: { implementation_units: units },
  };
  fs.writeFileSync(path.join(planDir, 'compile-output.json'), JSON.stringify(compileOutput));
}

// ===== Predicates 1-3: truth-surface.cjs (T1 changes) =====

// [predicates below — see Steps 3.3-3.5]

// ===== Predicates 4-6: state.cjs (T2 changes) =====

// [predicates below — see Steps 3.6-3.8]
```

Note: `writeCompileOutput` writes `.bonfire/plan/compile-output.json` matching the path `bin/lib/state.cjs:606` reads from (`path.join(root, 'plan', 'compile-output.json')` where `root` is `.bonfire`). Verify the path resolution by reading the `getRoot()` helper if uncertain.

Verify via:
```bash
grep -n "'plan'" bin/lib/state.cjs | head -3
grep -n "function getRoot" bin/lib/state.cjs
```

Adjust `writeCompileOutput` path accordingly if `getRoot()` does not return `.bonfire` relative to the project root.

- [ ] **Step 3.3: Predicate 1 — challenged_claim PROPOSED default + auto-transition first-fire**

Append to test file:

```javascript
test('3c #1: challenged_claim created PROPOSED, auto-transitions on first challenged_by', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CC-001', '--category', 'challenged_claim',
    '--content', 'Some questionable claim', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });

  let snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'PROPOSED',
    'challenged_claim must default to PROPOSED (§5.1)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, [],
    'newly proposed entry has empty challenged_by');

  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-1'],
    { encoding: 'utf8', cwd: dir });

  snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED',
    'auto-transition fires on first non-empty challenged_by (§5.1 line 150-152)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, ['CHALLENGER-1']);

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.4: Predicate 2 — auto-transition non-repeat**

Append:

```javascript
test('3c #1: second challenged_by append does not re-trigger transition', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'CC-001', '--category', 'challenged_claim',
    '--content', 'test', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-1'],
    { encoding: 'utf8', cwd: dir });

  let snapshot = readSnapshot(dir);
  const updatedAtAfterFirst = snapshot.entries['CC-001'].updated_at;
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED');

  execFileSync('node', [CLI, 'truth-update',
    '--id', 'CC-001', '--field', 'challenged_by', '--value', 'CHALLENGER-2'],
    { encoding: 'utf8', cwd: dir });

  snapshot = readSnapshot(dir);
  assert.equal(snapshot.entries['CC-001'].status, 'CHALLENGED',
    'status stays CHALLENGED on second challenged_by append (no re-transition)');
  assert.deepEqual(snapshot.entries['CC-001'].challenged_by, ['CHALLENGER-1', 'CHALLENGER-2']);

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.5: Predicate 3 — truth-annotate error hint contains literal CLI name**

Append:

```javascript
test('3c #7: truth-annotate on PROPOSED entry errors with truth-update CLI hint', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'truth-propose',
    '--id', 'RG-001', '--category', 'retained_goal',
    '--content', 'test goal', '--rationale', 'test', '--source', 'stage-a'],
    { encoding: 'utf8', cwd: dir });

  let error = null;
  try {
    execFileSync('node', [CLI, 'truth-annotate',
      '--id', 'RG-001', '--field', 'evidence_refs', '--value', 'REF-1'],
      { encoding: 'utf8', cwd: dir });
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'truth-annotate on PROPOSED entry must exit non-zero');
  const stderr = (error.stderr || '') + (error.stdout || '');
  assert.match(stderr, /truth-update/,
    'error must contain literal CLI name "truth-update" (§5.2 binding contract)');
  assert.match(stderr, /--field evidence_refs --value/,
    'error must contain literal example invocation (§5.2 binding contract)');
  assert.match(stderr, /RG-001/,
    'error must reference the entry ID');

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.6: Predicate 4 — unit.id literal preserve**

Append:

```javascript
test('3c #11: stateInitCodeSteps preserves literal unit.id (no sequential rename)', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-1' },
    { id: 'unit-1.5' },
    { id: 'unit-2' },
  ]);

  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });

  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.ok(state.steps['unit-1'], 'unit-1 step key preserved');
  assert.ok(state.steps['unit-1.5'], 'unit-1.5 step key preserved (was lost via sequential rename pre-3c)');
  assert.ok(state.steps['unit-2'], 'unit-2 step key preserved');
  assert.equal(Object.keys(state.steps).filter(k => k.startsWith('unit-')).length, 3,
    'exactly 3 unit- steps, no sequential rename ghosts');

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.7: Predicate 5 — unit.id format reject**

Append:

```javascript
test('3c #11: stateInitCodeSteps fail-louds on invalid unit.id (space character)', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-foo bar' },
  ]);

  let error = null;
  try {
    execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'invalid unit.id must exit non-zero');
  // exitError routes through exitJSON which JSON.stringify-encodes to stdout
  // (not stderr); JSON encoding doubles the backslash so the production string
  // `unit-[\w.-]+` appears in output as bytes `unit-[\\w.-]+` (two literal
  // backslashes). The regex below escapes accordingly: 4 backslashes in source
  // → 2 backslashes in pattern → matches the 2-backslash substring in output.
  // Local variable named `stderr` for brevity but captures stdout+stderr.
  const stderr = (error.stderr || '') + (error.stdout || '');
  assert.match(stderr, /invalid id/, 'error must contain "invalid id"');
  assert.match(stderr, /unit-\[\\\\w\.-\]\+/,
    'error must surface the expected format regex unit-[\\w.-]+ (post-JSON-encode bytes)');

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.8: Predicate 6 — current_step literal preserve from pre/plan-stage value**

Append:

```javascript
test('3c #11: stateInitCodeSteps transitions current_step from stage-a to units[0].id', () => {
  const dir = makeTmpDir();
  writeCompileOutput(dir, [
    { id: 'unit-1.5' },
    { id: 'unit-2' },
  ]);

  const statePath = path.join(dir, '.bonfire', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.current_step = 'stage-a';
  fs.writeFileSync(statePath, JSON.stringify(state));

  execFileSync('node', [CLI, 'state-init-code-steps'], { encoding: 'utf8', cwd: dir });

  const stateAfter = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(stateAfter.current_step, 'unit-1.5',
    'current_step transitions to units[0].id (literal preserve, not hardcoded unit-1)');

  fs.rmSync(dir, { recursive: true });
});
```

- [ ] **Step 3.9: Run new test file**

Run: `node --test tests/test-state-machine-coherence.js`

Expected: all 6 tests PASS. If predicates fail:
- Predicates 1-3 failure: Task 1 (truth-surface.cjs) edits regressed or wording drifted. Re-verify §5.1 + §5.2 anchors.
- Predicates 4-6 failure: Task 2 (state.cjs) edits regressed. Re-verify §5.3 anchors (literal id preserve, regex literal without `/u`, current_step condition preserved).
- Predicate 5 stderr regex mismatch: most likely the `\\w` escaping in the production error message differs from the test pattern. Verify Step 2.2 error message contains literal `unit-[\\w.-]+` after JS string escaping (which yields stderr substring `unit-[\w.-]+`).

- [ ] **Step 3.10: Run full test suite to verify no regression across the codebase**

Run: `node --test tests/*.js`

Expected: all tests PASS (315 + 6 new = 321, or similar count — verify against current `wc -l tests/*.js` baseline).

If any non-3c test fails:
- Most likely cause: a fixture in `tests/fixtures/` supplies `implementation_units` with an id NOT matching `/^unit-[\w.-]+$/` (e.g., `null`, missing id, or unusual character). Fix the fixture per Step 2.4 guidance.
- Less likely: a test asserts exact wording of the truth-annotate error and now fails due to §5.2 enhancement. If so, update the test to match the new wording (this is acceptable — the new wording is the binding contract per §5.2).

- [ ] **Step 3.11: Architect cross-check predicate anchors**

Verify the binding-contract predicates are present and worded correctly:

```bash
grep -n "truth-update" tests/test-state-machine-coherence.js
grep -n "unit-1.5" tests/test-state-machine-coherence.js
grep -n "invalid id" tests/test-state-machine-coherence.js
```

Expected:
- First grep: at least 2 matches (predicate 3 assertion and one CLI usage).
- Second grep: at least 3 matches (predicates 4 + 6 fixtures and assertions).
- Third grep: at least 1 match (predicate 5 assertion).

If any expected match is absent, the predicate drifted from §7 binding contract. Restore per Step 3.5 / 3.6 / 3.7 / 3.8 verbatim.

- [ ] **Step 3.12: Commit**

```bash
git add tests/test-state-machine-coherence.js
git commit -m "$(cat <<'EOF'
test(3c): acceptance criteria — 6 state-machine coherence predicates

Implements §7 predicates 1-6 against truth-surface.cjs and state.cjs
changes from prior 3c commits:
- predicates 1+2: challenged_claim PROPOSED default + auto-transition
  first-fire + no-repeat (§5.1)
- predicate 3: truth-annotate error hint contains literal truth-update
  CLI name and example invocation (§5.2)
- predicates 4+5: stateInitCodeSteps literal unit.id preserve +
  format regex fail-loud on invalid id (§5.3)
- predicate 6: current_step transition from non-unit prefix value
  (e.g., stage-a) to units[0].id (§5.3 load-bearing condition preserved)

Test pattern mirrors tests/test-truth-cli.js — node:test +
node:assert/strict + child_process.execFileSync against tmpdir
bonfire instances.

Spec: docs/superpowers/specs/2026-05-12-bonfire-assertion-3c-design.md
EOF
)"
```

---

## Self-Review

After all 3 tasks complete, the architect verifies:

**1. Spec coverage:**
- §5.1 → Task 1 Step 1.3 ✓
- §5.2 → Task 1 Step 1.4 ✓
- §5.3 (`for` loop) → Task 2 Step 2.2 ✓
- §5.3 (current_step) → Task 2 Step 2.3 ✓
- §7 predicate 1 → Task 3 Step 3.3 ✓
- §7 predicate 2 → Task 3 Step 3.4 ✓
- §7 predicate 3 → Task 3 Step 3.5 ✓
- §7 predicate 4 → Task 3 Step 3.6 ✓
- §7 predicate 5 → Task 3 Step 3.7 ✓
- §7 predicate 6 → Task 3 Step 3.8 ✓

All 3 mechanism sections + all 6 acceptance predicates covered.

**2. Out-of-scope guard (§4):**
- Agent-dispatch fail-loud (finding #6) — NOT touched. No task modifies skills/plan/SKILL.md or agent dispatcher code.
- truth-annotate vs truth-update mechanism merge — NOT touched. Both CLIs preserved with distinct event-types per Assertion 1 contract.
- truth-annotate FROZEN gate loosening — NOT touched. The gate is preserved; only the error wording is enhanced.
- challenged_claim category rename / NO_FREEZE_CATEGORIES restructure — NOT touched.
- Replay-loop fail-loud at `truth-surface.cjs:138` — NOT touched. The `if (!entry) continue` is preserved (correct behavior for archive replay).

**3. Anti-pattern scan:**
- No placeholders, TODOs, or "fill in details" anywhere.
- All code blocks contain literal content the implementer types verbatim.
- All exact line numbers verified against HEAD `636db0b`.

**4. Type / wording consistency:**
- `truth-update` CLI name: spec §5.2 binding contract → Task 1 Step 1.4 enhanced error → Task 3 Step 3.5 predicate 3 assertion. All three use the literal string.
- `unit-[\w.-]+` regex: spec §5.3 → Task 2 Step 2.2 regex + error → Task 3 Step 3.7 predicate 5 assertion. All three use the same character class.
- `units[0].id`: spec §5.3 → Task 2 Step 2.3 assignment → Task 3 Step 3.8 predicate 6 assertion. All three use literal-preserve semantics.

**5. Sequencing audit:**
- T1 produces truth-surface.cjs changes; T3 predicates 1-3 depend on them ✓
- T2 produces state.cjs changes; T3 predicates 4-6 depend on them ✓
- T3 lands last; full test suite verified at Step 3.10 ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-bonfire-assertion-3c-implementation.md`.

**Recommended execution: subagent-driven-development.**

Per Lesson 1 (serial-by-default), dispatch T1 → T2 → T3 sequentially. Each task:
1. Implementer subagent receives full task text + literal-quote anchors + spec section references.
2. Spec compliance review verifies the change matches §5.x verbatim (architect cross-check anchors at Step N.5 / N.6).
3. Code quality review verifies test pattern, error wording, no unrelated changes.
4. Architect ratifies before moving to next task.

**Total estimated LOC:**
- T1: ~6 LOC (1 line + 5 lines)
- T2: ~10 LOC (`for` loop body + condition value)
- T3: ~170 LOC (test file, 6 predicates + scaffold)
- **Grand total: ~186 LOC across 3 files**

**Time estimate (subagent-driven serial):** ~20-30 min per task × 3 = ~60-90 min total.

Awaits architect dispatch authorization.
