import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { verifyTypeormAstDependencies } from './typeorm-ast-dependencies.mjs';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const packageRoot = join(workspaceRoot, 'packages/typeorm');
const temporary = mkdtempSync(join(tmpdir(), 'nx-typeorm-package-'));

try {
  const [artifact] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: packageRoot,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: join(temporary, 'npm-cache') },
    })
  );
  const archive = join(temporary, artifact.filename);
  const packedPaths = new Set(artifact.files.map(({ path }) => path));
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8')
  );
  const packedManifest = JSON.parse(
    execFileSync('tar', ['-xOf', archive, 'package/package.json'], {
      encoding: 'utf8',
    })
  );
  assert.deepEqual(packedManifest.dependencies, manifest.dependencies);
  assert.deepEqual(packedManifest.peerDependencies, manifest.peerDependencies);
  console.log(
    `Packed candidate ${artifact.name}@${artifact.version}: ${artifact.integrity}`
  );
  assert.equal(artifact.name, manifest.name);
  assert(
    packedPaths.has(manifest.main),
    `Missing built entry: ${manifest.main}`
  );

  for (const [name, sourceRoot] of [
    ['LICENSE', workspaceRoot],
    ['NOTICE', workspaceRoot],
    ['README.md', packageRoot],
  ]) {
    assert(
      packedPaths.has(name),
      `Missing package/${name} in ${artifact.filename}`
    );
    const packed = execFileSync('tar', ['-xOf', archive, `package/${name}`]);
    assert.deepEqual(
      packed,
      readFileSync(join(sourceRoot, name)),
      `Packed ${name} differs from its source`
    );
  }
  console.log(
    `Verified LICENSE, NOTICE, and README.md in ${artifact.filename}`
  );
  verifyScaffoldPreview(archive, temporary);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

// An offline packed consumer: use the installed toolchain, but resolve the
// plugin from its extracted archive, never from workspace source conditions.
function verifyScaffoldPreview(archive, temporary) {
  const consumer = join(temporary, 'consumer');
  const modules = join(consumer, 'node_modules');
  const nxBin = JSON.parse(
    readFileSync(join(workspaceRoot, 'node_modules/nx/package.json'), 'utf8')
  ).bin.nx;
  const plugin = join(modules, '@anarchitects/nx-typeorm');
  const projectRoot = 'apps/blueprint/api';
  mkdirSync(plugin, { recursive: true });
  execFileSync('tar', ['-xf', archive, '--strip-components=1', '-C', plugin]);
  for (const dependency of ['nx', '@nx', 'typeorm', 'ts-morph', 'tslib']) {
    symlinkSync(
      join(workspaceRoot, 'node_modules', dependency),
      join(modules, dependency),
      'dir'
    );
  }
  verifyTypeormAstDependencies(plugin);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'scaffold-consumer',
      private: true,
      dependencies: { '@anarchitects/nx-typeorm': '0.0.0' },
    })
  );
  writeFileSync(join(consumer, 'nx.json'), '{}');
  mkdirSync(join(consumer, projectRoot), { recursive: true });
  writeFileSync(
    join(consumer, projectRoot, 'project.json'),
    JSON.stringify({
      name: 'blueprint-api',
      root: projectRoot,
      projectType: 'application',
    })
  );
  writeFileSync(
    join(consumer, projectRoot, 'preserved.txt'),
    'consumer-owned content\n'
  );

  const cases = [
    [
      'migration-create',
      'tooling-probe',
      ['--timestamp=1795219200000'],
      'tools/typeorm/migrations/1795219200000-tooling-probe.ts',
      'export class ToolingProbe1795219200000',
    ],
    [
      'migration',
      'esm-probe',
      ['--timestamp=1795219200001', '--outputJs', '--esm'],
      'tools/typeorm/migrations/1795219200001-esm-probe.js',
      'export class EsmProbe1795219200001',
    ],
    [
      'migration-create',
      'cjs-probe',
      ['--timestamp=1795219200002', '--outputJs'],
      'tools/typeorm/migrations/1795219200002-cjs-probe.js',
      'module.exports = class CjsProbe1795219200002',
    ],
    [
      'entity',
      'user profile',
      [],
      'src/entities/user-profile.entity.ts',
      'export class UserProfileEntity',
    ],
    [
      'subscriber-create',
      'user subscriber',
      [],
      'src/subscribers/user-subscriber.subscriber.ts',
      'export class UserSubscriber',
    ],
  ];
  for (const [generator, name, flags, relativePath, expectedClass] of cases) {
    const args = [
      'g',
      `@anarchitects/nx-typeorm:${generator}`,
      '--project=blueprint-api',
      `--name=${name}`,
      ...flags,
      '--no-interactive',
    ];
    const before = snapshotConsumer(consumer);
    const preview = runNx([...args, '--dry-run']);
    assert.equal(preview.status, 0, preview.stdout + preview.stderr);
    assert.match(preview.stdout, /CREATE/);
    assert(preview.stdout.includes(relativePath), preview.stdout);
    assert.deepEqual(
      snapshotConsumer(consumer),
      before,
      `${generator} dry-run changed files`
    );

    const creation = runNx(args);
    assert.equal(creation.status, 0, creation.stdout + creation.stderr);
    const file = join(consumer, projectRoot, relativePath);
    assert(readFileSync(file, 'utf8').includes(expectedClass));
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// consumer edits\n`);
    const after = snapshotConsumer(consumer);
    for (const duplicateArgs of [args, [...args, '--dry-run']]) {
      const duplicate = runNx(duplicateArgs);
      assert.notEqual(
        duplicate.status,
        0,
        'Existing files must not be overwritten'
      );
      assert.match(duplicate.stdout + duplicate.stderr, /already exists/);
      assert.deepEqual(snapshotConsumer(consumer), after);
    }
  }
  console.log(
    'Verified packed Nx scaffold previews, creation and existing-file safety.'
  );

  function runNx(args) {
    return spawnSync(process.execPath, [join(modules, 'nx', nxBin), ...args], {
      cwd: consumer,
      encoding: 'utf8',
      timeout: 60000,
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        NX_NO_CLOUD: 'true',
        NX_ISOLATE_PLUGINS: 'false',
        NX_INTERACTIVE: 'false',
        NX_CACHE_DIRECTORY: join(temporary, 'nx-cache'),
        NX_WORKSPACE_DATA_DIRECTORY: join(temporary, 'nx-data'),
      },
    });
  }
}

function snapshotConsumer(root, prefix = '') {
  const result = {};
  for (const entry of readdirSync(join(root, prefix), {
    withFileTypes: true,
  })) {
    if (!prefix && entry.name === 'node_modules') continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory())
      Object.assign(result, snapshotConsumer(root, path));
    else result[path] = readFileSync(join(root, path)).toString('base64');
  }
  return result;
}
