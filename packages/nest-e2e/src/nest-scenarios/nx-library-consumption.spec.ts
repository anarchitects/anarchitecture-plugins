// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin, write } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';

const suite = usePackedPlugin();
it('consumes a source-only workspace library through package identity, graph inputs, and runtime', async () => {
  const root = join(suite.root, 'nx-library-consumption');
  const { yarn, env } = createInstalledConsumer(root, suite.tarball, {
    workspaces: ['packages/*', 'libs/*'],
  });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const json = (file: string) => JSON.parse(read(file));
  const rootManifest = read('package.json');
  const generate = (schematic: string, ...args: string[]) => {
    const command = [
      'nx',
      'g',
      `@anarchitects/nest:${schematic}`,
      ...args,
      '--no-interactive',
    ];
    yarn([...command, '--dry-run']);
    yarn(command);
  };
  generate('library', '@acme/users', '--directory=libs/users');
  generate(
    'resource',
    'users',
    '--project=@acme/users',
    '--type=rest',
    '--crud'
  );
  generate(
    'application',
    'api',
    '--directory=packages/api',
    '--type=esm',
    '--packageManager=yarn'
  );
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:init',
    '--buildTargetName=compile',
    '--startTargetName=serve',
    '--no-interactive',
  ]);

  // Consumers declare the relationship with the package manager. No root path
  // alias, Nest CLI registration, or implicitDependencies manufactures the edge.
  yarn(['workspace', 'api', 'add', '@acme/users@workspace:*']);
  expect(json('packages/api/package.json').dependencies['@acme/users']).toBe(
    'workspace:*'
  );
  expect(existsSync(join(root, 'node_modules/@acme/users/src/index.ts'))).toBe(
    true
  );
  expect(json('libs/users/package.json').exports['.'].import).toBe(
    './src/index.ts'
  );
  expect(existsSync(join(root, 'tsconfig.base.json'))).toBe(false);
  writeFileSync(
    join(root, 'packages/api/src/app.module.ts'),
    read('packages/api/src/app.module.ts')
      .replace(
        'import { Module }',
        "import { UsersModule } from '@acme/users';\nimport { Module }"
      )
      .replace('imports: []', 'imports: [UsersModule]')
  );

  // Source-only packages need a TS-aware consumer. Keep compiler/test setup
  // explicit and local to the consuming packages rather than changing exports.
  yarn([
    'workspace',
    'api',
    'add',
    '-D',
    '@rspack/core@2.1.10',
    'webpack-node-externals@3.0.0',
    'tsconfig-paths-webpack-plugin@4.2.0',
    '@swc/core@1.16.13',
    'unplugin-swc@2.0.0',
  ]);
  yarn([
    'workspace',
    '@acme/users',
    'add',
    '-D',
    '@nestjs/testing@12.1.2',
    '@nestjs/core@12.1.2',
    'vitest@4.1.11',
    '@swc/core@1.16.13',
    'unplugin-swc@2.0.0',
  ]);
  const nest = json('packages/api/nest-cli.json');
  nest.compilerOptions.builder = {
    type: 'rspack',
    options: { configPath: 'rspack.config.cjs' },
  };
  write(root, 'packages/api/nest-cli.json', nest);
  write(
    root,
    'packages/api/rspack.config.cjs',
    `
const { builtinModules } = require('node:module');
const { resolve } = require('node:path');
const nodeExternals = require('webpack-node-externals');
module.exports = (options) => ({
  ...options,
  // Replace the default externalizer too: it must not externalize source-only
  // workspace packages before the allowlist below can take effect.
  externals: [
    nodeExternals({
      modulesDir: resolve(__dirname, 'node_modules'),
      additionalModuleDirs: [resolve(__dirname, '../../node_modules')],
      allowlist: ['@acme/users'],
      importType: 'module',
    }),
    ({ request }, callback) => {
      const bare = request?.replace(/^node:/, '');
      return bare && builtinModules.includes(bare)
        ? callback(null, 'module ' + request) : callback();
    },
  ],
});
`
  );
  const vitestConfig = `
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
export default defineConfig({
  plugins: [swc.vite({
    tsconfigFile: false, swcrc: false, module: { type: 'es6' },
    jsc: { parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true } },
  })],
  test: { globals: true, environment: 'node', reporters: ['verbose'], include: ['src/**/*.spec.ts'] },
});
`;
  write(root, 'packages/api/vitest.config.ts', vitestConfig);
  write(root, 'libs/users/vitest.config.ts', vitestConfig);
  write(root, 'libs/users/.gitignore', 'dist\n*.tsbuildinfo\n');
  write(root, 'libs/users/project.json', {
    ...json('libs/users/project.json'),
    targets: {
      compile: {
        command: 'tsc --project tsconfig.lib.json',
        options: { cwd: 'libs/users' },
        cache: true,
        inputs: ['default'],
        outputs: ['{projectRoot}/dist'],
      },
      test: { command: 'vitest run', options: { cwd: 'libs/users' } },
    },
  });
  write(
    root,
    'packages/api/src/library.spec.ts',
    `
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module.js';
it('imports the workspace library and registers its HTTP controller', async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch((await app.getUrl()) + '/users');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('This action returns all users');
  } finally { await app.close(); }
});
`
  );

  expect(read('package.json')).toBe(rootManifest);
  const graphFile = join(root, 'graph.json');
  yarn(['nx', 'graph', '--file', graphFile]);
  const { graph } = json('graph.json');
  expect(graph.nodes['@acme/users'].data.root).toBe('libs/users');
  expect(graph.dependencies.api).toContainEqual(
    expect.objectContaining({ target: '@acme/users', type: 'static' })
  );
  expect(graph.nodes.api.data.targets.compile).toMatchObject({
    cache: true,
    dependsOn: ['^compile'],
    inputs: expect.arrayContaining(['^default']),
  });
  rmSync(graphFile);
  const tests = yarn([
    'nx',
    'run-many',
    '-p',
    'api,@acme/users',
    '-t',
    'test',
    '--parallel=1',
    '--skipNxCache',
    '--outputStyle=static',
  ]);
  expect(tests).toMatch(/2 passed/); // generated library resource specs
  expect(tests).toContain('library.spec.ts');

  const build = () =>
    yarn(['nx', 'run', 'api:compile', '--outputStyle=static']);
  build(); // also builds the dependency through ^compile
  expect(existsSync(join(root, 'libs/users/dist/index.js'))).toBe(true);
  const bundle = read('packages/api/dist/main.js');
  rmSync(join(root, 'packages/api/dist'), { recursive: true });
  expect(build()).toMatch(/api:compile\s+\[local cache/);
  expect(read('packages/api/dist/main.js')).toBe(bundle);
  await assertHttp(
    root,
    env,
    'api:serve',
    '/users',
    'This action returns all users'
  );

  const appModule = read('packages/api/src/app.module.ts');
  const serviceFile = 'libs/users/src/users/users.service.ts';
  write(
    root,
    serviceFile,
    read(serviceFile).replace(
      'This action returns all users',
      'Updated workspace users'
    )
  );
  const rebuilt = build();
  expect(rebuilt).not.toMatch(/api:compile\s+\[local cache/);
  expect(read('packages/api/dist/main.js')).not.toBe(bundle);
  expect(read('packages/api/dist/main.js')).toContain(
    'Updated workspace users'
  );
  expect(read('packages/api/src/app.module.ts')).toBe(appModule);
  await assertHttp(root, env, 'api:serve', '/users', 'Updated workspace users');
  expect(json('packages/api/nest-cli.json').projects).toBeUndefined();
  expect(existsSync(join(root, 'libs/users/nest-cli.json'))).toBe(false);

  // Native nested libraries can coexist without taking ownership of users.
  const libraryManifest = read('libs/users/package.json');
  generate('library', 'internal', '--project=api');
  expect(json('packages/api/nest-cli.json').projects.internal.type).toBe(
    'library'
  );
  expect(json('packages/api/nest-cli.json').projects.users).toBeUndefined();
  expect(read('libs/users/package.json')).toBe(libraryManifest);
  yarn(['nx', 'run', 'api-internal:compile', '--outputStyle=static']);
  await assertHttp(root, env, 'api:serve', '/users', 'Updated workspace users');
}, 360_000);
