// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from './installed-consumer';

/** Exercise package-manager resolution, not the linked dependency fixtures. */
export function assertCjsJestConsumer(root: string, tarball: string) {
  const { yarn, yarnConfig } = createInstalledConsumer(root, tarball);
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
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).not.toBe(lock);
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
