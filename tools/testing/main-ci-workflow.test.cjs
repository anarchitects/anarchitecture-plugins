const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { parse } = require('yaml');

const workflow = parse(readFileSync('.github/workflows/main.yml', 'utf8'));
const selection = workflow.jobs.checks.steps.find((step) => step.id === 'e2e');
const runE2e = workflow.jobs.e2e.steps.find(
  (step) => step.name === 'Run E2E project'
);
const gate = workflow.jobs['main-ci'].steps[0];

// Exercise the actual workflow scripts. Nx supplies the project graph; this
// workflow only turns its affected project names into isolated runner jobs.
function selectProjects(response) {
  let output = '';
  const script = selection.run.match(/^node <<'NODE'\n([\s\S]*)\nNODE\s*$/)[1];
  runInNewContext(script, {
    require(name) {
      if (name === 'node:child_process') {
        return {
          execFileSync(command, args) {
            assert.equal(command, 'yarn');
            assert.deepEqual(Array.from(args), [
              'nx',
              'show',
              'projects',
              '--affected',
              '--withTarget=e2e',
              '--json',
            ]);
            if (response instanceof Error) throw response;
            return response;
          },
        };
      }
      if (name === 'node:fs') {
        return { appendFileSync: (_path, text) => (output += text) };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    process: { env: { GITHUB_OUTPUT: 'output' } },
    console: { log() {} },
  });
  return Object.fromEntries(
    output
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator),
          JSON.parse(line.slice(separator + 1)),
        ];
      })
  );
}

test('affected Nest work is partitioned; all other selected projects run once', () => {
  const { matrix, count } = selectProjects(
    JSON.stringify([
      'nx-typeorm-e2e',
      'nx-nest-e2e',
      'nx-governance-e2e',
      'nx-js-e2e',
    ])
  );
  assert.equal(count, 7);
  assert.deepEqual(
    matrix.include.filter((row) => row.project === 'nx-nest-e2e'),
    [
      { project: 'nx-nest-e2e', shard: '1/4' },
      { project: 'nx-nest-e2e', shard: '2/4' },
      { project: 'nx-nest-e2e', shard: '3/4' },
      { project: 'nx-nest-e2e', shard: '4/4' },
    ]
  );
  assert.deepEqual(
    matrix.include.filter((row) => row.project !== 'nx-nest-e2e'),
    [
      { project: 'nx-governance-e2e', shard: '' },
      { project: 'nx-js-e2e', shard: '' },
      { project: 'nx-typeorm-e2e', shard: '' },
    ]
  );
});

test('empty selection schedules nothing; new E2E projects are not omitted', () => {
  assert.deepEqual(selectProjects('[]'), { matrix: { include: [] }, count: 0 });
  assert.deepEqual(selectProjects('["future-e2e"]'), {
    matrix: { include: [{ project: 'future-e2e', shard: '' }] },
    count: 1,
  });
});

test('invalid or failed Nx selection cannot become an empty success', () => {
  for (const response of [
    'not JSON',
    '{}',
    '[null]',
    '[""]',
    new Error('invalid base'),
  ]) {
    assert.throws(() => selectProjects(response));
  }
});

function gateStatus(checks, e2e, count) {
  return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', gate.run], {
    env: {
      ...process.env,
      CHECKS_RESULT: checks,
      E2E_RESULT: e2e,
      E2E_COUNT: count,
    },
    encoding: 'utf8',
  }).status;
}

test('required main-ci gate accepts completed work or an intentional empty selection', () => {
  assert.deepEqual(workflow.jobs['main-ci'].needs, ['checks', 'e2e']);
  assert.equal(workflow.jobs['main-ci'].if, 'always()');
  assert.equal(gateStatus('success', 'success', '6'), 0);
  assert.equal(gateStatus('success', 'skipped', '0'), 0);
});

test('required main-ci gate rejects failed, cancelled or missing scheduled work', () => {
  for (const status of ['failure', 'cancelled', 'skipped', '']) {
    assert.notEqual(gateStatus(status, 'success', '6'), 0);
    assert.notEqual(gateStatus('success', status, '6'), 0);
  }
  assert.notEqual(gateStatus('success', 'skipped', ''), 0);
  assert.notEqual(gateStatus('success', 'success', ''), 0);
  assert.notEqual(gateStatus('success', 'failure', '0'), 0);
});

test('runner forwards shard arguments through Nx and propagates test failure', () => {
  const directory = mkdtempSync(join(tmpdir(), 'main-ci-workflow-'));
  const argsFile = join(directory, 'args.json');
  try {
    writeFileSync(
      join(directory, 'yarn'),
      `#!/usr/bin/env node
require('node:fs').writeFileSync(process.env.PROBE_ARGS, JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.PROBE_EXIT));
`,
      { mode: 0o755 }
    );
    for (const command of ['df', 'vmstat']) {
      writeFileSync(join(directory, command), '#!/bin/sh\nexit 0\n', {
        mode: 0o755,
      });
    }
    for (const [project, shard, code] of [
      ['nx-nest-e2e', '2/4', 0],
      ['nx-typeorm-e2e', '', 0],
      ['nx-nest-e2e', '1/4', 1],
    ]) {
      const result = spawnSync(
        'bash',
        ['-e', '-o', 'pipefail', '-c', runE2e.run],
        {
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            E2E_PROJECT: project,
            E2E_SHARD: shard,
            PROBE_ARGS: argsFile,
            PROBE_EXIT: String(code),
          },
          encoding: 'utf8',
        }
      );
      assert.equal(result.status, code, result.stderr);
      assert.deepEqual(JSON.parse(readFileSync(argsFile, 'utf8')), [
        'nx',
        'run',
        `${project}:e2e`,
        ...(shard ? [`--shard=${shard}`] : []),
        '--outputStyle=stream',
      ]);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
