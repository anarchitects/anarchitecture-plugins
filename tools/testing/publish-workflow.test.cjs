const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { parse } = require('yaml');

const workflow = parse(readFileSync('.github/workflows/publish.yml', 'utf8'));
const release = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
const steps = workflow.jobs.publish.steps;
const resolve = steps.find((step) => step.id === 'tag');
const validate = steps.find((step) => step.id === 'publication');
const tagExpression = '${{ inputs.tag || github.event.release.tag_name }}';

function resolveTag(tag) {
  const directory = mkdtempSync(join(tmpdir(), 'publish-workflow-'));
  const output = join(directory, 'output');
  try {
    const result = spawnSync(
      'bash',
      ['-e', '-o', 'pipefail', '-c', resolve.run],
      {
        env: {
          ...process.env,
          GITHUB_REF_NAME: 'main',
          RELEASE_TAG: tag,
          GITHUB_OUTPUT: output,
        },
        encoding: 'utf8',
      }
    );
    return {
      ...result,
      outputs:
        result.status === 0
          ? Object.fromEntries(
              readFileSync(output, 'utf8')
                .trim()
                .split('\n')
                .map((line) => line.split('='))
            )
          : {},
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// Execute the workflow's actual validation body with local project/registry
// fixtures. No GitHub release or registry is mutated by these tests.
function checkPublication({
  projectName = 'nx-js',
  version = '0.2.0',
  pkg = { name: '@anarchitects/nx-js', version: '0.2.0' },
  project = {
    name: projectName,
    root: 'packages/js',
    targets: { 'nx-release-publish': {} },
  },
  registry = { status: 1, stdout: '{"error":{"code":"E404"}}' },
} = {}) {
  let output = '';
  const calls = [];
  const script = validate.run.match(/^node <<'NODE'\n([\s\S]*)\nNODE\s*$/)[1];
  const modules = {
    'node:child_process': {
      execFileSync(command, args) {
        calls.push([command, ...args]);
        if (project instanceof Error) throw project;
        return JSON.stringify(project);
      },
      spawnSync(command, args) {
        calls.push([command, ...args]);
        return registry;
      },
    },
    'node:fs': {
      readFileSync(path) {
        assert.equal(path, join(project.root, 'package.json'));
        return JSON.stringify(pkg);
      },
      appendFileSync(path, text) {
        assert.equal(path, 'test-output');
        output += text;
      },
    },
  };
  runInNewContext(script, {
    require: (name) => modules[name] || require(name),
    process: {
      env: {
        RELEASE_PROJECT: projectName,
        RELEASE_VERSION: version,
        GITHUB_OUTPUT: 'test-output',
      },
    },
    console: {
      log() {
        // Keep fixture output separate from the Node test report.
      },
    },
  });
  return { output, calls };
}

test('published releases and manual recovery share the tag and concurrency key', () => {
  assert.deepEqual(workflow.on.release.types, ['published']);
  assert.equal(workflow.on.push, undefined);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.tag, {
    description: 'Existing release tag to publish, for example nx-js@0.2.0',
    required: true,
    type: 'string',
  });
  assert.equal(resolve.env.RELEASE_TAG, tagExpression);
  assert.equal(workflow.concurrency.group, `publish-${tagExpression}`);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(
    steps.find((step) => step.uses?.startsWith('actions/checkout@')).with.ref,
    '${{ steps.tag.outputs.ref }}'
  );
});

test('six release events resolve six distinct projects, versions and tag refs', () => {
  const tags = [
    'governance-extension-nx@0.2.0',
    'governance-adapter-nx@0.3.0',
    'nx-governance@0.13.0',
    'nx-typeorm@0.6.0',
    'nx-nest@0.1.0',
    'nx-js@0.2.0',
  ];
  for (const tag of tags) {
    const result = resolveTag(tag);
    assert.equal(result.status, 0, result.stderr);
    const [project, version] = tag.split('@');
    assert.deepEqual(result.outputs, {
      ref: `refs/tags/${tag}`,
      project,
      version,
    });
    assert.equal(
      checkPublication({
        projectName: project,
        version,
        pkg: { name: `@anarchitects/${project}`, version },
      }).output,
      'published=false\n'
    );
  }
});

test('manual recovery checks out the tagged revision instead of the dispatch branch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'publish-checkout-'));
  function git(...args) {
    const result = spawnSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Workflow test',
        GIT_AUTHOR_EMAIL: 'workflow@example.invalid',
        GIT_COMMITTER_NAME: 'Workflow test',
        GIT_COMMITTER_EMAIL: 'workflow@example.invalid',
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  try {
    git('init', '--initial-branch=main');
    git(
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--allow-empty',
      '-m',
      'Release'
    );
    const released = git('rev-parse', 'HEAD');
    git('-c', 'tag.gpgsign=false', 'tag', '-a', 'nx-js@0.2.0', '-m', 'Release');
    git(
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--allow-empty',
      '-m',
      'Later main'
    );
    assert.notEqual(git('rev-parse', 'HEAD'), released);
    // A similarly named branch must not shadow the release tag.
    git('branch', 'nx-js@0.2.0');
    git('checkout', '--detach', resolveTag('nx-js@0.2.0').outputs.ref);
    assert.equal(git('rev-parse', 'HEAD'), released);
    const missing = spawnSync(
      'git',
      ['checkout', '--detach', 'refs/tags/missing@1.0.0'],
      {
        cwd: directory,
        encoding: 'utf8',
      }
    );
    assert.notEqual(missing.status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('accepts SemVer prereleases and build metadata without changing the tag', () => {
  for (const version of ['1.2.3-beta.1', '1.2.3+build.1']) {
    assert.equal(resolveTag(`nx-js@${version}`).outputs.version, version);
    assert.equal(
      checkPublication({
        version,
        pkg: { name: '@anarchitects/nx-js', version },
      }).output,
      'published=false\n'
    );
  }
});

for (const tag of [
  '',
  'main',
  '1.2.3',
  '@1.2.3',
  'nx-js@',
  'nx-js@latest',
  'nx-js@1.2.3\ninjected=true',
  '$(exit 0)@1.2.3',
  '--all@1.2.3',
  'nx-*@1.2.3',
  'nx-js,nx-nest@1.2.3',
]) {
  test(`rejects malformed tag ${JSON.stringify(tag)}`, () => {
    assert.notEqual(resolveTag(tag).status, 0);
  });
}

test('rejects invalid SemVer, missing projects, private packages and version mismatches', () => {
  assert.throws(() => checkPublication({ version: '01.2.3' }), /valid SemVer/);
  assert.throws(
    () => checkPublication({ project: new Error('Unknown project') }),
    /Unknown project/
  );
  assert.throws(
    () => checkPublication({ project: { name: 'other' } }),
    /publishable Nx project/
  );
  assert.throws(
    () => checkPublication({ project: { name: 'nx-js', targets: {} } }),
    /publishable Nx project/
  );
  for (const pkg of [
    { name: '@anarchitects/nx-js', version: '0.1.0' },
    { name: '@anarchitects/nx-js', version: '0.2.0', private: true },
  ]) {
    assert.throws(() => checkPublication({ pkg }), /public package version/);
  }
});

test('already-published recovery only reads npm and skips publication without moving dist-tags', () => {
  const result = checkPublication({
    registry: { status: 0, stdout: '"0.2.0"' },
  });
  assert.equal(result.output, 'published=true\n');
  assert.deepEqual(
    result.calls.map((args) => Array.from(args)),
    [
      ['yarn', 'nx', 'show', 'project', 'nx-js', '--json'],
      [
        'npm',
        'view',
        '@anarchitects/nx-js@0.2.0',
        'version',
        '--json',
        '--registry=https://registry.npmjs.org/',
      ],
    ]
  );
  for (const name of [
    'Build project',
    'Typecheck project',
    'Test project',
    'Publish project',
  ]) {
    assert.equal(
      steps.find((step) => step.name === name).if,
      "steps.publication.outputs.published == 'false'"
    );
  }
});

test('registry failures and unexpected metadata do not authorize publication', () => {
  for (const registry of [
    { status: 1, stdout: '{"error":{"code":"E401"}}' },
    { status: 1, stdout: '{"error":{"code":"E503"}}' },
    { status: 1, stdout: '', stderr: 'network error' },
    { status: 0, stdout: '"0.3.0"' },
    { status: 0, stdout: '' },
    { status: 0, stdout: 'not json' },
    { status: null, signal: 'SIGTERM', stdout: '{"error":{"code":"E404"}}' },
    { error: new Error('npm unavailable') },
  ]) {
    assert.throws(() => checkPublication({ registry }));
  }
});

test('retains GitHub App release handoff, validation and npm OIDC publishing', () => {
  const releaseStep = release.jobs.release.steps.find(
    (step) => step.name === 'Run Nx release'
  );
  assert.equal(
    releaseStep.env.GITHUB_TOKEN,
    '${{ steps.app-token.outputs.token }}'
  );
  assert.match(releaseStep.run, /--skip-publish/);
  assert.equal(workflow.permissions['id-token'], 'write');
  assert.equal(workflow.permissions.contents, 'read');
  const publish = steps.find((step) => step.name === 'Publish project');
  assert.equal(
    publish.run,
    'yarn nx release publish --projects "${{ steps.tag.outputs.project }}" --yes'
  );
  assert.equal(publish.env.NPM_CONFIG_PROVENANCE, true);
  assert.equal(
    steps.find((step) => step.name === 'Install dependencies').run,
    'yarn install --immutable'
  );
});
