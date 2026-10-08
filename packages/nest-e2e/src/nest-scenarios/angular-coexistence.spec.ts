// SPDX-License-Identifier: MIT
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createInstalledConsumer } from '../installed-consumer';
import { usePackedPlugin, write } from '../packed-plugin';
import { assertHttp } from '../rspack-consumer';
import {
  sourceConsumerRspackConfig,
  sourceConsumerVitestConfig,
} from '../source-consumer-config';

const suite = usePackedPlugin();
it('keeps Angular and shared contracts green alongside both Nest library models', async () => {
  const root = join(suite.root, 'angular-coexistence');
  const { yarn, env } = createInstalledConsumer(root, suite.tarball, {
    workspaces: ['apps/*', 'libs/*', 'packages/*'],
  });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  const json = (file: string) => JSON.parse(read(file));
  const generate = (generator: string, ...args: string[]) => {
    const command = ['nx', 'g', generator, ...args, '--no-interactive'];
    const lock = read('yarn.lock');
    yarn([...command, '--dry-run']);
    expect(read('yarn.lock')).toBe(lock);
    return yarn(command);
  };
  const installs = (output: string) =>
    output.match(/Yarn \d+\.\d+\.\d+/g) ?? [];
  yarn(['add', '-D', '@nx/angular@23.2.0']);
  generate(
    '@nx/angular:application',
    'apps/web',
    '--name=web',
    '--minimal',
    '--bundler=esbuild',
    '--unitTestRunner=vitest-angular',
    '--e2eTestRunner=none',
    '--linter=eslint',
    '--routing=false',
    '--ssr=false',
    '--style=css'
  );
  generate(
    '@nx/js:library',
    'libs/contracts',
    '--name=contracts',
    '--importPath=@acme/contracts',
    '--bundler=none',
    '--unitTestRunner=none',
    '--linter=none',
    '--useProjectJson=false'
  );
  // Give the generic, non-buildable library an explicit workspace entrypoint.
  write(root, 'libs/contracts/package.json', {
    ...json('libs/contracts/package.json'),
    type: 'module',
    exports: { '.': './src/index.ts' },
  });
  write(
    root,
    'libs/contracts/src/index.ts',
    "export const usersMessage = 'Shared workspace users';\n"
  );
  write(root, 'apps/web/package.json', { name: 'web', private: true });
  yarn(['workspace', 'web', 'add', '@acme/contracts@workspace:*']);
  const appFile = 'apps/web/src/app/app.ts';
  write(
    root,
    appFile,
    "import { usersMessage } from '@acme/contracts';\n" +
      read(appFile).replace(
        'export class App {',
        'export class App { readonly usersMessage = usersMessage;'
      )
  );
  write(
    root,
    'apps/web/src/app/app.html',
    read('apps/web/src/app/app.html') + '\n<p>{{ usersMessage }}</p>\n'
  );
  write(
    root,
    'apps/web/src/app/contracts.spec.ts',
    `
import { TestBed } from '@angular/core/testing';
import { App } from './app';
it('renders the shared workspace contract', async () => {
  await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  expect(fixture.nativeElement.querySelector('p')?.textContent).toBe('Shared workspace users');
});
`
  );
  const webChecks = () =>
    yarn([
      'nx',
      'run-many',
      '-p',
      'web',
      '-t',
      'build,test,lint',
      '--parallel=1',
      '--skipNxCache',
      '--outputStyle=static',
    ]);
  const web = JSON.parse(
    yarn(['nx', 'show', 'project', 'web', '--json'], undefined, true)
  );
  for (const target of ['build', 'test', 'lint'])
    expect(web.targets[target]).toBeDefined();
  webChecks();

  const snapshot = (directory: string): Record<string, string> =>
    Object.fromEntries(
      readdirSync(join(root, directory), { withFileTypes: true }).flatMap(
        (entry) => {
          if (['node_modules', 'dist', '.angular'].includes(entry.name))
            return [];
          const path = `${directory}/${entry.name}`;
          return entry.isDirectory()
            ? Object.entries(snapshot(path))
            : [[path, read(path)]];
        }
      )
    );
  const protectedFiles = {
    ...snapshot('apps/web'),
    ...snapshot('libs/contracts'),
  };
  const base = json('tsconfig.base.json');
  const workspaceGlobs = json('package.json').workspaces;
  const rootDependencies = json('package.json').dependencies;
  const angularTooling = () =>
    Object.fromEntries(
      Object.entries(json('package.json').devDependencies).filter(
        ([name]) =>
          name.startsWith('@angular/') ||
          name === '@nx/angular' ||
          name === 'typescript'
      )
    );
  const originalAngularTooling = angularTooling();
  expect(base.compilerOptions.paths['@acme/contracts']).toEqual([
    './libs/contracts/src/index.ts',
  ]);

  expect(
    installs(
      generate('@anarchitects/nest:library', 'users', '--directory=libs/users')
    )
  ).toHaveLength(1);
  expect(json('package.json').workspaces).toEqual(workspaceGlobs);
  expect(existsSync(join(root, 'node_modules/users/src/index.ts'))).toBe(true);
  expect(json('tsconfig.base.json')).toEqual({
    ...base,
    compilerOptions: {
      ...base.compilerOptions,
      paths: {
        ...base.compilerOptions.paths,
        users: ['./libs/users/src/index.ts'],
      },
    },
  });
  const linkedBase = read('tsconfig.base.json');
  expect(json('libs/users/tsconfig.json').extends).toBe(
    '../../tsconfig.base.json'
  );
  generate('@anarchitects/nest:service', 'audit', '--project=users');
  expect(
    installs(
      generate(
        '@anarchitects/nest:resource',
        'users',
        '--project=users',
        '--type=rest',
        '--crud'
      )
    )
  ).toHaveLength(1);
  expect(
    json('libs/users/package.json').dependencies['@nestjs/mapped-types']
  ).toBe('*');
  expect(
    existsSync(join(root, 'node_modules/@nestjs/mapped-types/package.json'))
  ).toBe(true);
  expect(
    installs(
      generate(
        '@anarchitects/nest:application',
        'api',
        '--directory=packages/api',
        '--type=esm',
        '--packageManager=yarn'
      )
    )
  ).toHaveLength(1);
  expect(
    installs(
      generate('@anarchitects/nest:library', 'internal', '--project=api')
    )
  ).toHaveLength(1);
  // Every Nest generator above runs its deferred install itself. The following
  // package commands express consumer relationships and optional test tooling.
  yarn(['workspace', 'users', 'add', '@acme/contracts@workspace:*']);
  yarn(['workspace', 'api', 'add', 'users@workspace:*']);
  yarn([
    'nx',
    'g',
    '@anarchitects/nest:init',
    '--buildTargetName=compile',
    '--startTargetName=serve',
    '--no-interactive',
  ]);
  write(
    root,
    'packages/api/src/app.module.ts',
    read('packages/api/src/app.module.ts')
      .replace(
        'import { Module }',
        "import { UsersModule } from 'users';\nimport { Module }"
      )
      .replace('imports: []', 'imports: [UsersModule]')
  );
  const serviceFile = 'libs/users/src/users/users.service.ts';
  write(
    root,
    serviceFile,
    "import { usersMessage } from '@acme/contracts';\n" +
      read(serviceFile).replace(
        /(['"`])This action returns all users\1/,
        'usersMessage'
      )
  );
  // Native library generation installs Rspack/SWC tooling for this owner.
  write(
    root,
    'packages/api/rspack.config.cjs',
    sourceConsumerRspackConfig(['users', '@acme/contracts'])
  );
  yarn([
    'workspace',
    'users',
    'add',
    '-D',
    '@nestjs/testing@12.1.2',
    '@nestjs/core@12.1.2',
    'vitest@4.1.11',
    '@swc/core@1.16.13',
    'unplugin-swc@2.0.0',
  ]);
  write(root, 'libs/users/vitest.config.ts', sourceConsumerVitestConfig);
  write(root, 'libs/users/project.json', {
    ...json('libs/users/project.json'),
    targets: {
      check: {
        command: 'tsc --project tsconfig.lib.json --noEmit',
        options: { cwd: 'libs/users' },
      },
      test: { command: 'vitest run', options: { cwd: 'libs/users' } },
    },
  });
  expect(json('package.json').dependencies).toEqual(rootDependencies);
  expect(angularTooling()).toEqual(originalAngularTooling);
  expect(json('packages/api/package.json').dependencies.users).toBe(
    'workspace:*'
  );
  expect(json('libs/users/package.json').dependencies['@acme/contracts']).toBe(
    'workspace:*'
  );
  expect(
    json('libs/users/package.json').dependencies['@nestjs/common']
  ).toBeDefined();
  expect(json('packages/api/nest-cli.json').projects.internal.type).toBe(
    'library'
  );
  expect(json('packages/api/nest-cli.json').projects.users).toBeUndefined();
  expect(existsSync(join(root, 'libs/users/nest-cli.json'))).toBe(false);
  expect(read('tsconfig.base.json')).toBe(linkedBase);
  for (const [file, contents] of Object.entries(protectedFiles))
    expect(read(file)).toBe(contents);

  const graphFile = join(root, 'graph.json');
  yarn(['nx', 'graph', '--file', graphFile]);
  const { graph } = json('graph.json');
  for (const [source, target] of [
    ['api', 'users'],
    ['users', 'contracts'],
    ['web', 'contracts'],
  ]) {
    expect(graph.dependencies[source]).toContainEqual(
      expect.objectContaining({ target, type: 'static' })
    );
  }
  expect(graph.dependencies.web).not.toContainEqual(
    expect.objectContaining({ target: 'users' })
  );
  expect(graph.nodes.users.data.metadata.nest.kind).toBe('nx-library');
  expect(graph.nodes['api-internal'].data.root).toBe(
    'packages/api/libs/internal'
  );
  rmSync(graphFile);
  webChecks();
  yarn([
    'nx',
    'run-many',
    '-p',
    'users',
    '-t',
    'check,test',
    '--parallel=1',
    '--skipNxCache',
    '--outputStyle=static',
  ]);
  yarn([
    'nx',
    'run-many',
    '-p',
    'api,api-internal',
    '-t',
    'compile,test,lint',
    '--parallel=1',
    '--skipNxCache',
    '--outputStyle=static',
  ]);
  await assertHttp(root, env, 'api:serve', '/users', 'Shared workspace users');
}, 360_000);
