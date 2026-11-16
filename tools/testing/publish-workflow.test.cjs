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
  const job = release.jobs.release;
  assert.equal(job.environment, 'shared-bot-release');
  assert.equal(
    job.if,
    "github.ref == 'refs/heads/main' && github.run_attempt == 1"
  );
  assert.deepEqual(release.permissions, { contents: 'read' });
  const checkout = job.steps.find((s) =>
    s.uses?.startsWith('actions/checkout@')
  );
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(checkout.with.token, undefined);
  assert.ok(
    job.steps.findIndex((s) => s.id === 'app-token') >
      job.steps.findIndex((s) => s.name === 'Install dependencies')
  );
  assert.equal(release.env.NX_NO_CLOUD, 'true');
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

test('release inputs remain literal shell arguments and cannot supply Nx options', () => {
  const step = release.jobs.release.steps.find(
    (s) => s.name === 'Run Nx release'
  );
  assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./);
  const run = (specifier) =>
    spawnSync(
      'bash',
      [
        '-e',
        '-o',
        'pipefail',
        '-c',
        'yarn() { printf "arg=%s\\n" "$@"; };\n' + step.run,
      ],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          RELEASE_PROJECTS: 'nest; echo injected',
          RELEASE_SPECIFIER: specifier,
          RELEASE_FIRST: 'false',
        },
      }
    );
  const literal = run('$(echo injected)');
  assert.equal(literal.status, 0);
  assert.match(literal.stdout, /arg=--projects=nest; echo injected/);
  assert.match(literal.stdout, /arg=\$\(echo injected\)/);
  assert.notEqual(run('--publish').status, 0);
});

for (const remoteAdvanced of [false, true]) {
  test(`Nx release tracks main without replacing the approved SHA (remote advanced: ${remoteAdvanced})`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-approved-sha-'));
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
    };
    const git = (...args) => {
      const result = spawnSync('git', args, {
        cwd: directory,
        env,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      git('init', '--initial-branch=main');
      git('config', 'user.name', 'Release fixture');
      git('config', 'user.email', 'fixture@example.invalid');
      git('commit', '--allow-empty', '-m', 'chore: approved');
      const approved = git('rev-parse', 'HEAD');
      git('init', '--bare', join(directory, 'origin.git'));
      git('remote', 'add', 'origin', join(directory, 'origin.git'));
      git('push', 'origin', 'main');
      if (remoteAdvanced) {
        git('commit', '--allow-empty', '-m', 'chore: later main');
        git('push', 'origin', 'main');
      }
      const remoteBefore = git('rev-parse', 'origin/main');
      git('checkout', '--detach', approved);
      const step = release.jobs.release.steps.find(
        (s) => s.name === 'Attach approved revision to local main'
      );
      const result = spawnSync('bash', ['-e', '-c', step.run], {
        cwd: directory,
        env: { ...env, GITHUB_SHA: approved },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(git('branch', '--show-current'), 'main');
      assert.equal(git('rev-parse', 'HEAD'), approved);
      assert.equal(
        git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'),
        'origin/main'
      );
      git('commit', '--allow-empty', '-m', 'chore: release version');
      const push = spawnSync('git', ['push'], {
        cwd: directory,
        env,
        encoding: 'utf8',
      });
      if (remoteAdvanced) {
        assert.notEqual(push.status, 0);
        assert.match(push.stderr, /non-fast-forward|fetch first/);
      } else {
        assert.equal(push.status, 0, push.stderr);
      }
      assert.equal(
        git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0],
        remoteAdvanced ? remoteBefore : git('rev-parse', 'HEAD')
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
