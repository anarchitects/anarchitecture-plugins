// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';

const suite = usePackedPlugin();
it('registers a fresh Yarn application and runs its native package scripts and public quickstart', async () => {
  const root = join(suite.root, 'workspace-registration');
  const { yarn, env, yarnConfig } = createInstalledConsumer(
    root,
    suite.tarball,
    {}
  );
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

  // Exercise the public README quickstart after the unmodified native scripts.
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:init',
    '--buildTargetName=compile',
    '--startTargetName=serve',
    '--no-interactive',
  ]);
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:resource',
    'orders',
    '--project=api',
    '--type=rest',
    '--crud',
    '--no-interactive',
  ]);
  yarn(['nx', 'run', 'api:test']);
  yarn(['nx', 'run', 'api:compile']);
  const configured = JSON.parse(
    yarn(['nx', 'show', 'project', 'api', '--json'], undefined, true)
  );
  expect(configured.targets.compile.cache).toBe(true);
  expect(configured.targets.serve.continuous).toBe(true);
  await assertHttp(
    root,
    env,
    'api:serve',
    '/orders',
    'This action returns all orders'
  );
}, 360_000);
