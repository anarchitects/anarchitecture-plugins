// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it('generates and installs an independent Nx-native library from the packed plugin', () => {
  const root = join(suite.root, 'nx-library');
  const { yarn, yarnConfig } = createInstalledConsumer(root, suite.tarball, {
    workspaces: ['libs/*'],
  });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const rootCompiler = JSON.stringify({
    compilerOptions: {
      module: 'preserve',
      moduleResolution: 'bundler',
      paths: { contracts: ['libs/contracts/src/index.ts'] },
    },
  });
  writeFileSync(join(root, 'tsconfig.base.json'), rootCompiler);
  const before = {
    manifest: read('package.json'),
    nx: read('nx.json'),
    lock: read('yarn.lock'),
    state: read('node_modules/.yarn-state.yml'),
  };
  const generate = [
    'nx',
    'g',
    '@anarchitects/nest:library',
    'users',
    '--directory=libs/users',
    '--no-interactive',
  ];
  yarn([...generate, '--dry-run']);
  expect(existsSync(join(root, 'libs/users'))).toBe(false);
  expect(read('package.json')).toBe(before.manifest);
  expect(read('yarn.lock')).toBe(before.lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(before.state);
  const output = yarn(generate);
  expect(output.match(/Yarn \d+\.\d+\.\d+/g)).toHaveLength(1);
  const project = JSON.parse(
    yarn(['nx', 'show', 'project', 'users', '--json'], undefined, true)
  );
  expect(project).toMatchObject({
    name: 'users',
    root: 'libs/users',
    sourceRoot: 'libs/users/src',
    projectType: 'library',
    metadata: {
      nest: { kind: 'nx-library' },
      js: { packageName: 'users', isInPackageManagerWorkspaces: true },
    },
  });
  const manifest = JSON.parse(read('libs/users/package.json'));
  expect(manifest).toMatchObject({
    name: 'users',
    private: true,
    type: 'module',
    dependencies: { '@nestjs/common': '^12.0.1' },
  });
  expect(manifest.exports['.'].types).toBe('./src/index.ts');
  expect(read('libs/users/src/users.module.ts')).toContain(
    "from '@nestjs/common'"
  );
  expect(read('libs/users/src/index.ts')).toContain("'./users.module.js'");
  expect(existsSync(join(root, 'libs/users/nest-cli.json'))).toBe(false);
  expect(existsSync(join(root, 'nest-cli.json'))).toBe(false);
  expect(read('package.json')).toBe(before.manifest);
  expect(read('nx.json')).toBe(before.nx);
  expect(read('tsconfig.base.json')).toBe(rootCompiler);
  expect(read('.yarnrc.yml')).toBe(yarnConfig);

  // The source-only container adds no build target. This consumer-owned check
  // verifies its local TypeScript config and automatically installed dependencies.
  const config = JSON.parse(read('libs/users/project.json'));
  writeFileSync(
    join(root, 'libs/users/project.json'),
    JSON.stringify({
      ...config,
      targets: {
        check: {
          command: 'tsc --project libs/users/tsconfig.lib.json --noEmit',
        },
      },
    })
  );
  yarn(['nx', 'run', 'users:check', '--skipNxCache']);
  const lock = read('yarn.lock');
  const state = read('node_modules/.yarn-state.yml');
  expect(() => yarn(generate)).toThrow('already exists');
  expect(() =>
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:library',
      'users',
      '--directory=libs/duplicate',
      '--no-interactive',
    ])
  ).toThrow('already exists');
  expect(existsSync(join(root, 'libs/duplicate'))).toBe(false);
  const skipped = yarn([
    'nx',
    'g',
    '@anarchitects/nest:lib',
    '@acme/support',
    '--directory=services/support',
    '--skipInstall',
    '--no-interactive',
  ]);
  expect(skipped.match(/Yarn \d+\.\d+\.\d+/g) ?? []).toHaveLength(0);
  expect(JSON.parse(read('services/support/package.json')).name).toBe(
    '@acme/support'
  );
  expect(JSON.parse(read('package.json')).workspaces).toEqual([
    'libs/*',
    'services/support',
  ]);
  expect(read('yarn.lock')).toBe(lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(state);
}, 240_000);
