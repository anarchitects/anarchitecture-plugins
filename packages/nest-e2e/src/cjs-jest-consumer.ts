// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

/** Exercise package-manager resolution, not the linked dependency fixtures. */
export function assertCjsJestConsumer(root: string, tarball: string) {
  mkdirSync(root, { recursive: true });
  const repository = resolve(__dirname, '../../..');
  const { packageManager } = JSON.parse(
    readFileSync(join(repository, 'package.json'), 'utf8')
  );
  const env: NodeJS.ProcessEnv = {
    // Start a separate Nx invocation: inherited NX_TASK_* makes `nx exec`
    // assume it is already inside the outer E2E target and skip project cwd.
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('NX_'))
    ),
    CI: 'true',
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    NX_INTERACTIVE: 'false',
    NX_TUI: 'false',
    FORCE_COLOR: '0',
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
    NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
  };
  // The outer Jest target has ts-node settings for its own .cts config. They
  // must not alter the native consumer's TypeScript/Jest configuration.
  delete env.TS_NODE_COMPILER_OPTIONS;
  delete env.NODE_OPTIONS;
  delete env.NODE_ENV;

  function yarn(args: string[], nodeOptions?: string) {
    const result = spawnSync('yarn', args, {
      cwd: root,
      env: { ...env, ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}) },
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = stripVTControlCharacters(
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        `yarn ${args.join(' ')} failed (${result.status ?? result.signal}):\n${
          result.error?.message ?? ''
        }\n${output}`
      );
    }
    return output;
  }

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'cjs-consumer',
      private: true,
      packageManager,
      workspaces: ['packages/*'],
      devDependencies: {
        '@anarchitects/nest': `file:${tarball}`,
        '@nestjs/cli': '12.0.0',
        '@nx/devkit': '23.2.0',
        nx: '23.2.0',
        typescript: '6.0.3',
      },
    })
  );
  writeFileSync(join(root, 'nx.json'), JSON.stringify({ plugins: [] }));
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.nx\n');
  const yarnConfig = 'nodeLinker: node-modules\nenableScripts: false\n';
  writeFileSync(join(root, '.yarnrc.yml'), yarnConfig);
  yarn(['install']);
  yarn(['nx', 'g', '@anarchitects/nest:init', '--no-interactive']);
  const generate = [
    'nx',
    'g',
    '@anarchitects/nest:application',
    'legacy-api',
    '--directory=packages/legacy-api',
    '--type=cjs',
    '--packageManager=yarn',
    '--no-interactive',
  ];
  const app = join(root, 'packages/legacy-api');
  const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
  yarn([...generate, '--dry-run']);
  expect(existsSync(app)).toBe(false);
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
  yarn(generate);
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
  expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
  const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
  const nativeFiles = Object.fromEntries(
    [
      'jest.config.ts',
      'tsconfig.json',
      'src/app.controller.spec.ts',
      'test/app.e2e-spec.ts',
      'test/jest-e2e.json',
    ].map((file) => [file, readFileSync(join(app, file), 'utf8')])
  );
  yarn(['install']);

  // The default Yarn layout reproduces #533 using an actual installed tarball.
  expect(existsSync(join(root, 'node_modules/jest/bin/jest.js'))).toBe(true);
  expect(existsSync(join(app, 'node_modules/jest/bin/jest.js'))).toBe(false);
  for (const target of ['test', 'test:e2e']) {
    expect(() => yarn(['nx', 'run', `legacy-api:${target}`])).toThrow(
      /Cannot find module .*legacy-api\/node_modules\/jest\/bin\/jest\.js/
    );
  }

  // Explicit consumer invocation preserves default hoisting and native configs.
  for (const args of [
    [],
    ['--config', './test/jest-e2e.json'],
    ['--coverage'],
  ]) {
    const output = yarn(
      [
        'nx',
        'exec',
        '--projects=legacy-api',
        '--',
        'yarn',
        'jest',
        '--runInBand',
        ...args,
      ],
      '--experimental-vm-modules'
    );
    expect(output).toMatch(/Test Suites:\s+1 passed/);
    expect(output).toMatch(/Tests:\s+1 passed/);
  }

  // Optional consumer-owned policy: keep dependencies local to this package,
  // without changing other workspaces or modifying any native test script.
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({
      ...manifest,
      installConfig: { hoistingLimits: 'workspaces' },
    })
  );
  yarn(['install']);
  expect(existsSync(join(app, 'node_modules/jest/bin/jest.js'))).toBe(true);
  expect(existsSync(join(app, 'node_modules/.bin/jest'))).toBe(true);
  for (const target of ['test', 'test:e2e', 'test:cov']) {
    const output = yarn([
      'nx',
      'run',
      `legacy-api:${target}`,
      '--output-style=static',
    ]);
    expect(output).toMatch(/Test Suites:\s+1 passed/);
    expect(output).toMatch(/Tests:\s+1 passed/);
  }
  expect(
    JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).scripts
  ).toEqual(manifest.scripts);
  expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
  for (const [file, content] of Object.entries(nativeFiles)) {
    expect(readFileSync(join(app, file), 'utf8')).toBe(content);
  }
}
