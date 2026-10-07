// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it('installs native and tooling dependencies once through the Nx lifecycle', () => {
  const root = join(suite.root, 'automatic-installs');
  const { yarn, yarnConfig } = createInstalledConsumer(root, suite.tarball, {});
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  const generate = (name: string, ...args: string[]) => {
    const command = [
      'nx',
      'g',
      `@anarchitects/nest:${name}`,
      ...args,
      '--no-interactive',
    ];
    const lock = read('yarn.lock');
    const state = read('node_modules/.yarn-state.yml');
    yarn([...command, '--dry-run']);
    expect(read('yarn.lock')).toBe(lock);
    expect(read('node_modules/.yarn-state.yml')).toBe(state);
    return yarn(command);
  };
  const installs = (output: string) =>
    output.match(/Yarn \d+\.\d+\.\d+/g) ?? [];
  expect(
    installs(generate('application', 'api', '--directory=packages/api'))
  ).toHaveLength(1);
  expect(
    installs(generate('application', 'api', '--directory=packages/api'))
  ).toHaveLength(0);
  expect(
    installs(
      generate(
        'resource',
        'users',
        '--project=api',
        '--type=rest',
        '--crud=true'
      )
    )
  ).toHaveLength(1);
  expect(
    JSON.parse(read('packages/api/package.json')).dependencies[
      '@nestjs/mapped-types'
    ]
  ).toBe('*');
  expect(
    JSON.parse(read('package.json')).dependencies?.['@nestjs/mapped-types']
  ).toBeUndefined();
  expect(
    existsSync(join(root, 'node_modules/@nestjs/mapped-types/package.json'))
  ).toBe(true);
  // No manual install occurs between either generator and these native tasks.
  yarn([
    'nx',
    'run-many',
    '-t',
    'build',
    'test',
    'test:e2e',
    'lint',
    '-p',
    'api',
    '--skipNxCache',
    '--parallel=1',
    '--output-style=static',
  ]);
  expect(
    installs(
      generate(
        'resource',
        'posts',
        '--project=api',
        '--type=rest',
        '--crud=true'
      )
    )
  ).toHaveLength(0);
  expect(installs(generate('service', 'audit', '--project=api'))).toHaveLength(
    0
  );
  // Rspack, SWC, and Nx Vitest additions share one install callback.
  expect(installs(generate('sub-app', 'worker', '--project=api'))).toHaveLength(
    1
  );
  expect(installs(generate('library', 'shared', '--project=api'))).toHaveLength(
    0
  );
  const lock = read('yarn.lock');
  const state = read('node_modules/.yarn-state.yml');
  expect(
    installs(
      generate(
        'application',
        'deferred',
        '--directory=packages/deferred',
        '--skipInstall'
      )
    )
  ).toHaveLength(0);
  expect(
    installs(
      generate(
        'resource',
        'items',
        '--project=deferred',
        '--type=rest',
        '--crud=true',
        '--skipInstall'
      )
    )
  ).toHaveLength(0);
  expect(
    JSON.parse(read('packages/deferred/package.json')).dependencies[
      '@nestjs/mapped-types'
    ]
  ).toBe('*');
  expect(read('yarn.lock')).toBe(lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(state);
  expect(read('.yarnrc.yml')).toBe(yarnConfig);
}, 360_000);
