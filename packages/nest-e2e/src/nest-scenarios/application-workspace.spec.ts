// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it('registers a fresh Yarn application and runs its native package scripts', () => {
  const root = join(suite.root, 'workspace-registration');
  const { yarn, yarnConfig } = createInstalledConsumer(root, suite.tarball, {});
  const manifestPath = join(root, 'package.json');
  const before = readFileSync(manifestPath, 'utf8');
  const lock = readFileSync(join(root, 'yarn.lock'), 'utf8');
  const generate = [
    'nx',
    'g',
    '@anarchitects/nest:application',
    'api',
    '--directory=packages/api',
    '--packageManager=yarn',
    '--skipInstall',
    '--no-interactive',
  ];
  yarn([...generate, '--dry-run']);
  expect(readFileSync(manifestPath, 'utf8')).toBe(before);
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
  expect(existsSync(join(root, 'packages/api'))).toBe(false);
  yarn(generate);
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
  expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toEqual({
    ...JSON.parse(before),
    workspaces: ['packages/api'],
  });
  const registered = readFileSync(manifestPath, 'utf8');
  yarn(generate);
  expect(readFileSync(manifestPath, 'utf8')).toBe(registered);
  expect(readFileSync(join(root, 'yarn.lock'), 'utf8')).toBe(lock);
  yarn(['install']);
  const project = JSON.parse(
    yarn(['nx', 'show', 'project', 'api', '--json'], undefined, true)
  );
  expect(project.metadata.js.isInPackageManagerWorkspaces).toBe(true);
  const nativeManifest = readFileSync(
    join(root, 'packages/api/package.json'),
    'utf8'
  );
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
  expect(readFileSync(join(root, 'packages/api/package.json'), 'utf8')).toBe(
    nativeManifest
  );
  expect(readFileSync(join(root, '.yarnrc.yml'), 'utf8')).toBe(yarnConfig);
}, 360_000);
