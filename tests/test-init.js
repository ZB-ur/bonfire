const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLI = path.join(__dirname, '..', 'bin', 'bonfire-tools.cjs');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bonfire-test-'));
}

test('init creates .bonfire/ with correct structure', () => {
  const dir = makeTmpDir();
  const stdout = execFileSync('node', [CLI, 'init', '--request', 'Add OAuth2 auth', '--project-root', dir], {
    encoding: 'utf8',
    cwd: dir
  });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);

  assert.ok(fs.existsSync(path.join(dir, '.bonfire')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'truth-surface')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'plan')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'bundle')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'runs')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'logs')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive')));

  const state = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'state.json'), 'utf8'));
  assert.equal(state.version, 1);
  assert.equal(state.pipeline_stage, 'pre');
  assert.equal(state.current_step, 'stage-a');
  assert.equal(state.steps['stage-a'].status, 'pending');
  assert.equal(state.pending_reentry, null);
  assert.equal(state.reentry.depth, 0);
  assert.equal(state.reentry.max_depth, 2);

  const caseJson = JSON.parse(fs.readFileSync(path.join(dir, '.bonfire', 'case.json'), 'utf8'));
  assert.equal(caseJson.bundle_version, 1);
  assert.equal(caseJson.source_request, 'Add OAuth2 auth');
  assert.equal(caseJson.project_paths.root, dir);
  assert.equal(caseJson.stages.preprocess, null);
  assert.equal(caseJson.stages.divergence, null);

  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-history.jsonl')));
  const snapshot = JSON.parse(fs.readFileSync(
    path.join(dir, '.bonfire', 'truth-surface', 'constraint-ledger-snapshot.json'), 'utf8'
  ));
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.event_count, 0);
  assert.deepStrictEqual(snapshot.entries, {});

  fs.rmSync(dir, { recursive: true });
});

test('init fails if .bonfire/ already exists', () => {
  const dir = makeTmpDir();
  fs.mkdirSync(path.join(dir, '.bonfire'));
  fs.writeFileSync(path.join(dir, '.bonfire', 'state.json'), '{}');
  try {
    execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
      encoding: 'utf8',
      cwd: dir
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 1);
    const result = JSON.parse(err.stdout);
    assert.match(result.error, /already exists/i);
  }
  fs.rmSync(dir, { recursive: true });
});

test('init fails without --request', () => {
  const dir = makeTmpDir();
  try {
    execFileSync('node', [CLI, 'init', '--project-root', dir], {
      encoding: 'utf8',
      cwd: dir
    });
    assert.fail('should have exited non-zero');
  } catch (err) {
    assert.equal(err.status, 2);
  }
  fs.rmSync(dir, { recursive: true });
});

test('archive moves case to archive directory', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });

  fs.writeFileSync(path.join(dir, '.bonfire', 'plan', 'test-marker.json'), '{}');

  const stdout = execFileSync('node', [CLI, 'archive', '--name', 'test-case'], {
    encoding: 'utf8', cwd: dir
  });
  const result = JSON.parse(stdout);
  assert.equal(result.success, true);

  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'state.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'case.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'archive', 'test-case', 'plan', 'test-marker.json')));

  assert.ok(!fs.existsSync(path.join(dir, '.bonfire', 'state.json')));
  assert.ok(!fs.existsSync(path.join(dir, '.bonfire', 'case.json')));
  assert.ok(fs.existsSync(path.join(dir, '.bonfire', 'plan')));
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.bonfire', 'plan')), []);

  fs.rmSync(dir, { recursive: true });
});

test('archive-list returns empty when no archives', () => {
  const dir = makeTmpDir();
  execFileSync('node', [CLI, 'init', '--request', 'test', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  const stdout = execFileSync('node', [CLI, 'archive-list'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.deepStrictEqual(result.archives, []);
  fs.rmSync(dir, { recursive: true });
});

test('archive-list returns archived cases sorted', () => {
  const dir = makeTmpDir();

  execFileSync('node', [CLI, 'init', '--request', 'first', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  execFileSync('node', [CLI, 'archive', '--name', 'beta-case'], { encoding: 'utf8', cwd: dir });
  execFileSync('node', [CLI, 'init', '--request', 'second', '--project-root', dir], {
    encoding: 'utf8', cwd: dir
  });
  execFileSync('node', [CLI, 'archive', '--name', 'alpha-case'], { encoding: 'utf8', cwd: dir });

  const stdout = execFileSync('node', [CLI, 'archive-list'], { encoding: 'utf8', cwd: dir });
  const result = JSON.parse(stdout);
  assert.deepStrictEqual(result.archives, ['alpha-case', 'beta-case']);

  fs.rmSync(dir, { recursive: true });
});
