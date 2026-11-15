// SPDX-License-Identifier: MIT
// Read installed packages; write only to the supplied disposable audit directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

async function audit(root) {
  const requireFixture = createRequire(path.join(root, 'package.json'));
  assert.equal(
    requireFixture('./package.json').private,
    true,
    'Use a disposable private fixture.'
  );
  const packageInfo = (name) => requireFixture(name + '/package.json');
  const versions = Object.fromEntries(
    [
      'common',
      'core',
      'testing',
      'platform-node',
      'platform-express',
      'platform-fastify',
      'schematics',
      'cli',
    ].map((name) => [name, packageInfo('@nestjs/' + name).version])
  );
  assert.equal(
    new Set(
      [
        'common',
        'core',
        'testing',
        'platform-node',
        'platform-express',
        'platform-fastify',
      ].map((name) => versions[name])
    ).size,
    1
  );
  const requireSchematic = createRequire(
    requireFixture.resolve('@nestjs/schematics/package.json')
  );
  const { SchematicTestRunner, UnitTestTree } = requireSchematic(
    '@angular-devkit/schematics/testing'
  );
  const { Tree, HostTree, HostSink } = requireSchematic(
    '@angular-devkit/schematics'
  );
  const { virtualFs, normalize } = requireSchematic('@angular-devkit/core');
  const { lastValueFrom } = requireFixture('rxjs');
  const runOnCommitted = async (name, options, tree) => {
    const host = new virtualFs.SimpleMemoryHost();
    const sync = new virtualFs.SyncDelegateHost(host);
    for (const file of tree.files)
      sync.write(normalize(file), Uint8Array.from(tree.read(file)).buffer);
    const output = await runner.runSchematic(name, options, new HostTree(host));
    await lastValueFrom(new HostSink(host).commit(output));
    return new UnitTestTree(new HostTree(host));
  };
  const runner = new SchematicTestRunner(
    '@nestjs/schematics',
    requireFixture.resolve('@nestjs/schematics/dist/collection.json')
  );
  const generated = [];
  for (const type of ['esm', 'cjs'])
    for (const observe of [false, true]) {
      const destination = path.join(
        root,
        'generated',
        type + (observe ? '-observe' : '')
      );
      assert.ok(
        !fs.existsSync(destination),
        'Use a fresh audit directory; existing results are never overwritten.'
      );
      fs.mkdirSync(destination, { recursive: true });
      process.chdir(destination);
      // The first execution is an in-memory preview: no install/tasks or workspace writes.
      let tree = await runner.runSchematic(
        'application',
        { name: 'api', directory: '.', type, observe },
        Tree.empty()
      );
      assert.ok(tree.exists('/src/main.ts'));
      const main = tree.readContent('/src/main.ts');
      const httpTest = tree.readContent('/test/app.e2e-spec.ts');
      const manifest = JSON.parse(tree.readContent('/package.json'));
      let written = new Set();
      const write = () => {
        const next = new Set(tree.files);
        for (const file of written)
          if (!next.has(file)) fs.unlinkSync(path.join(destination, file));
        for (const file of next) {
          const dest = path.join(destination, file);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, tree.read(file));
        }
        written = next;
      };
      write(); // Native member generation reads the owner's package.json from cwd.
      tree = await runOnCommitted('sub-app', { name: 'worker' }, tree);
      assert.equal(tree.readContent('/apps/api/src/main.ts'), main);
      assert.equal(
        tree.readContent('/apps/api/test/app.e2e-spec.ts'),
        httpTest
      );
      assert.equal(tree.exists('/src/main.ts'), false);
      const memberMain = tree.readContent('/apps/worker/src/main.ts');
      tree = await runOnCommitted(
        'resource',
        { name: 'orders', project: 'worker', type: 'rest', crud: true },
        tree
      );
      write();
      const sources = tree.files
        .filter((file) => /orders.*\.ts$/.test(file))
        .sort();
      const sourceHash = createHash('sha256')
        .update(sources.map((file) => tree.readContent(file)).join('\n'))
        .digest('hex');
      generated.push({
        type,
        observe,
        main,
        httpTest,
        memberMain,
        memberTsconfig: JSON.parse(
          tree.readContent('/apps/worker/tsconfig.app.json')
        ),
        dependencies: manifest.dependencies,
        devDependencies: manifest.devDependencies,
        sharedResourceSha256: sourceHash,
        resourceFiles: sources.length,
        nativeOwnerPreservation: 'pass',
        files: tree.files.length,
      });
    }
  process.chdir(root);
  const probe = fs.readFileSync(path.join(__dirname, 'probe.cts'));
  fs.writeFileSync(path.join(root, 'probe.cts'), probe);
  fs.writeFileSync(path.join(root, 'probe.mts'), probe);
  execFileSync(
    process.execPath,
    [
      requireFixture.resolve('typescript/bin/tsc'),
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2023',
      '--experimentalDecorators',
      '--emitDecoratorMetadata',
      '--esModuleInterop',
      '--strict',
      '--skipLibCheck',
      '--outDir',
      'probe-output',
      'probe.cts',
      'probe.mts',
    ],
    { cwd: root, stdio: 'inherit' }
  );
  const runtime = Object.fromEntries(
    ['cjs', 'mjs'].map((extension) => [
      extension,
      JSON.parse(
        execFileSync(
          process.execPath,
          [path.join(root, 'probe-output/probe.' + extension)],
          { cwd: root, encoding: 'utf8', timeout: 60000 }
        )
      ),
    ])
  );
  const result = { node: process.version, versions, generated, runtime };
  fs.writeFileSync(
    path.join(root, 'audit-results.json'),
    JSON.stringify(result, null, 2) + '\n'
  );
  console.log(
    JSON.stringify(
      { root, versions, generationCases: generated.length, runtime },
      null,
      2
    )
  );
}

const initialCwd = process.cwd();
assert.ok(
  process.argv[2],
  'Usage: audit.cjs /absolute/disposable/installed-fixture'
);
audit(path.resolve(process.argv[2]))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.chdir(initialCwd));
