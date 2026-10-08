// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin } from '../packed-plugin';

const suite = usePackedPlugin();
it('generates native artifacts inside an installed Nx-native Nest library', () => {
  const root = join(suite.root, 'nx-library-artifacts');
  const { yarn } = createInstalledConsumer(root, suite.tarball, {
    workspaces: ['libs/*'],
  });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const exists = (file: string) => existsSync(join(root, file));
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:library',
    '@acme/users',
    '--directory=libs/users',
    '--no-interactive',
  ]);
  const rootModule = read('libs/users/src/users.module.ts');
  const manifest = read('libs/users/package.json');
  const lock = read('yarn.lock');
  const installState = read('node_modules/.yarn-state.yml');
  const generate = (schematic: string, name: string, options: string[] = []) =>
    yarn([
      'nx',
      'g',
      `@anarchitects/nest:${schematic}`,
      name,
      '--project=@acme/users',
      '--no-interactive',
      ...options,
    ]);
  generate('service', 'preview', ['--dry-run']);
  expect(exists('libs/users/src/preview')).toBe(false);
  expect(read('libs/users/src/users.module.ts')).toBe(rootModule);
  generate('module', 'feature');
  expect(read('libs/users/src/users.module.ts')).toContain(
    "'./feature/feature.module.js'"
  );
  const registeredRoot = read('libs/users/src/users.module.ts');
  generate('service', 'orders', [
    '--path=feature',
    '--flat',
    '--specFileSuffix=unit',
    '--format',
  ]);
  expect(read('libs/users/src/feature/feature.module.ts')).toContain(
    "'./orders.service.js'"
  );
  expect(read('libs/users/src/feature/orders.service.unit.ts')).toContain(
    "'./orders.service.js'"
  );
  expect(read('libs/users/src/users.module.ts')).toBe(registeredRoot);
  const featureModule = read('libs/users/src/feature/feature.module.ts');
  writeFileSync(
    join(root, 'libs/users/src/feature/conflict.service.ts'),
    'user-owned content'
  );
  expect(() =>
    generate('service', 'conflict', ['--path=feature', '--flat'])
  ).toThrow();
  expect(read('libs/users/src/feature/feature.module.ts')).toBe(featureModule);
  expect(read('libs/users/src/feature/conflict.service.ts')).toBe(
    'user-owned content'
  );
  expect(exists('libs/users/src/feature/conflict.service.spec.ts')).toBe(false);
  expect(() =>
    generate('controller', 'outside', ['--sourceRoot=../other'])
  ).toThrow();
  expect(exists('libs/other')).toBe(false);

  for (const schematic of [
    'controller',
    'provider',
    'class',
    'interface',
    'decorator',
    'filter',
    'gateway',
    'guard',
    'interceptor',
    'middleware',
    'pipe',
    'resolver',
  ]) {
    const name = `example-${schematic}`;
    const noSpec = ['interface', 'decorator'].includes(schematic)
      ? []
      : ['--spec=false'];
    generate(schematic, name, ['--flat', ...noSpec]);
    const suffix = ['class', 'provider'].includes(schematic)
      ? ''
      : `.${schematic}`;
    expect(exists(`libs/users/src/${name}${suffix}.ts`)).toBe(true);
    expect(exists(`libs/users/src/${name}${suffix}.spec.ts`)).toBe(false);
    if (['controller', 'provider', 'gateway', 'resolver'].includes(schematic))
      expect(read('libs/users/src/users.module.ts')).toContain(
        `'./${name}${suffix}.js'`
      );
  }
  const beforeSkip = read('libs/users/src/users.module.ts');
  generate('service', 'detached', ['--flat', '--spec=false', '--skipImport']);
  expect(read('libs/users/src/users.module.ts')).toBe(beforeSkip);
  expect(read('libs/users/package.json')).toBe(manifest);
  expect(read('yarn.lock')).toBe(lock);
  expect(read('node_modules/.yarn-state.yml')).toBe(installState);
  expect(exists('libs/users/nest-cli.json')).toBe(false);
  expect(exists('nest-cli.json')).toBe(false);
}, 240_000);
