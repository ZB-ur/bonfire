'use strict';

const fs = require('fs');
const path = require('path');
const { writeAtomic, timestamp, exitJSON, exitError } = require('./utils.cjs');

function init(args) {
  const request = args.request;
  const projectRoot = args['project-root'] || process.cwd();

  if (!request) {
    process.stderr.write('Usage: bonfire-tools.cjs init --request <text> [--project-root <path>]\n');
    process.exit(2);
  }

  const bonfireDir = path.join(projectRoot, '.bonfire');
  if (fs.existsSync(path.join(bonfireDir, 'state.json'))) {
    exitError('.bonfire/ already exists. Archive the current case first.', [bonfireDir]);
  }

  const dirs = ['', 'truth-surface', 'plan', 'bundle', 'runs', 'logs', 'archive'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(bonfireDir, dir), { recursive: true });
  }

  const now = timestamp();

  const state = {
    version: 1,
    created_at: now,
    updated_at: now,
    pipeline_stage: 'pre',
    current_step: 'stage-a',
    steps: {
      'stage-a': { status: 'pending' }
    },
    approval: {
      stage_a_approved: false,
      stage_a_approved_at: null
    },
    reentry: {
      depth: 0,
      max_depth: 2,
      history: []
    },
    pending_reentry: null,
    runs: {
      current_run_id: null,
      completed_runs: []
    }
  };
  writeAtomic(path.join(bonfireDir, 'state.json'), state);

  const caseData = {
    bundle_version: 1,
    title: null,
    created_at: now,
    source_request: request,
    project_paths: { root: projectRoot },
    stages: {
      preprocess: null,
      divergence: null,
      requirements: null,
      critique: null,
      closure: null,
      probes: null,
      red_blue: null,
      review: null,
      compile_for_code: null
    }
  };
  writeAtomic(path.join(bonfireDir, 'case.json'), caseData);

  const emptySnapshot = {
    version: 1,
    replayed_at: now,
    event_count: 0,
    entries: {},
    by_status: {
      proposed: [],
      challenged: [],
      frozen: [],
      superseded: [],
      open: [],
      discarded: []
    },
    by_category: {
      retained_goal: [],
      confirmed_fact: [],
      frozen_constraint: [],
      challenged_claim: [],
      discarded_option: [],
      high_impact_risk: [],
      dependency_chain: [],
      acceptance_semantic: []
    }
  };
  writeAtomic(path.join(bonfireDir, 'truth-surface', 'constraint-ledger-snapshot.json'), emptySnapshot);
  fs.writeFileSync(path.join(bonfireDir, 'truth-surface', 'constraint-ledger-history.jsonl'), '');
  fs.writeFileSync(path.join(bonfireDir, 'truth-surface', 'constraint-ledger.md'),
    '# Constraint Ledger\n\n_No entries yet._\n');

  exitJSON({ success: true, path: bonfireDir, created_at: now });
}

function archive(args) {
  const name = args.name;
  if (!name) {
    process.stderr.write('Usage: bonfire-tools.cjs archive --name <name>\n');
    process.exit(2);
  }

  const bonfireDir = path.join(process.cwd(), '.bonfire');
  if (!fs.existsSync(bonfireDir)) {
    exitError('.bonfire/ does not exist', []);
  }

  const archiveDir = path.join(bonfireDir, 'archive', name);
  if (fs.existsSync(archiveDir)) {
    exitError(`Archive "${name}" already exists`, [archiveDir]);
  }

  fs.mkdirSync(archiveDir, { recursive: true });

  const entries = fs.readdirSync(bonfireDir);
  for (const entry of entries) {
    if (entry === 'archive') continue;
    const src = path.join(bonfireDir, entry);
    const dst = path.join(archiveDir, entry);
    fs.renameSync(src, dst);
  }

  const dirs = ['truth-surface', 'plan', 'bundle', 'runs', 'logs'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(bonfireDir, dir), { recursive: true });
  }

  exitJSON({ success: true, archived_to: archiveDir });
}

function archiveList(args) {
  const archiveDir = path.join(process.cwd(), '.bonfire', 'archive');
  if (!fs.existsSync(archiveDir)) {
    exitJSON({ archives: [] });
    return;
  }

  const entries = fs.readdirSync(archiveDir)
    .filter(e => fs.statSync(path.join(archiveDir, e)).isDirectory())
    .sort();

  exitJSON({ archives: entries });
}

module.exports = { init, archive, archiveList };
