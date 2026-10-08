// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it('installs library-owned resource dependencies once and immediately builds and tests REST CRUD', () => {
  const root = join(suite.root, 'nx-library-resources');
  const { yarn, yarnConfig } = createInstalledConsumer(root, suite.tarball, {
    workspaces: ['libs/*'],
  });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const write = (file: string, value: unknown) =>
    writeFileSync(join(root, file), JSON.stringify(value));
  const installs = (output: string) =>
    output.match(/Yarn \d+\.\d+\.\d+/g) ?? [];
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:library',
    'users',
    '--directory=libs/users',
    '--no-interactive',
  ]);
  // Consumer-owned test tooling is installed before resource generation. No
  // mapped-types dependency or manual install follows the resource command.
  yarn([
    'workspace',
    'users',
    'add',
    '-D',
    '@nestjs/testing@12.0.1',
    '@nestjs/core@12.0.1',
    'vitest@4.0.18',
    '@types/node@20.19.9',
  ]);
  write('libs/users/tsconfig.test.json', {
    extends: './tsconfig.json',
    compilerOptions: {
      rootDir: 'src',
      outDir: 'test-output',
      composite: false,
      declaration: false,
      types: ['vitest/globals', 'node'],
    },
    include: ['src/**/*.ts'],
    exclude: [],
  });
  writeFileSync(
    join(root, 'libs/users/vitest.config.mts'),
    "export default {test:{globals:true,environment:'node',include:['test-output/**/*.spec.js']}};\n"
  );
  write('libs/users/project.json', {
    ...JSON.parse(read('libs/users/project.json')),
    targets: {
      build: {
        command: 'tsc --project tsconfig.lib.json',
        options: { cwd: 'libs/users' },
      },
      test: {
        command:
          'tsc --project tsconfig.test.json && vitest run --config vitest.config.mts',
        options: { cwd: 'libs/users' },
      },
    },
  });
  const generate = (name: string, project = 'users', flags: string[] = []) =>
    yarn([
      'nx',
      'g',
      '@anarchitects/nest:resource',
      name,
      `--project=${project}`,
      '--type=rest',
      '--crud',
      '--no-interactive',
      ...flags,
    ]);
  const before = {
    root: read('package.json'),
    local: read('libs/users/package.json'),
    module: read('libs/users/src/users.module.ts'),
    lock: read('yarn.lock'),
    state: read('node_modules/.yarn-state.yml'),
  };
  expect(installs(generate('users', 'users', ['--dry-run']))).toHaveLength(0);
  expect(read('libs/users/package.json')).toBe(before.local);
  expect(read('libs/users/src/users.module.ts')).toBe(before.module);
  expect(read('yarn.lock')).toBe(before.lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(before.state);
  expect(existsSync(join(root, 'libs/users/src/users'))).toBe(false);
  expect(installs(generate('users'))).toHaveLength(1);
  expect(
    JSON.parse(read('libs/users/package.json')).dependencies[
      '@nestjs/mapped-types'
    ]
  ).toBe('*');
  expect(read('package.json')).toBe(before.root);
  expect(read('libs/users/src/users.module.ts')).toContain(
    'UsersModule as UsersResourceModule'
  );
  expect(read('libs/users/src/users/dto/update-user.dto.ts')).toContain(
    '@nestjs/mapped-types'
  );
  // Both generated controller/service specs execute against real Nest testing.
  const output = yarn([
    'nx',
    'run-many',
    '-p',
    'users',
    '-t',
    'build,test',
    '--parallel=1',
    '--skipNxCache',
    '--outputStyle=static',
  ]);
  expect(output).toMatch(/2 passed/);
  expect(
    existsSync(join(root, 'libs/users/dist/users/dto/update-user.dto.js'))
  ).toBe(true);
  expect(installs(generate('posts'))).toHaveLength(0);
  const lock = read('yarn.lock');
  const state = read('node_modules/.yarn-state.yml');
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:library',
    'deferred',
    '--directory=libs/deferred',
    '--skipInstall',
    '--no-interactive',
  ]);
  expect(
    installs(generate('items', 'deferred', ['--skipInstall']))
  ).toHaveLength(0);
  expect(
    JSON.parse(read('libs/deferred/package.json')).dependencies[
      '@nestjs/mapped-types'
    ]
  ).toBe('*');
  expect(read('yarn.lock')).toBe(lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(state);
  expect(read('package.json')).toBe(before.root);
  expect(read('.yarnrc.yml')).toBe(yarnConfig);
  expect(existsSync(join(root, 'libs/users/nest-cli.json'))).toBe(false);
}, 240_000);
