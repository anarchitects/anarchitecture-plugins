// SPDX-License-Identifier: MIT
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

describe('published Nest plugin', () => {
  const packageRoot = resolve(__dirname, '..');
  let consumerRoot: string;
  let installedPackage: string;
  let packedFiles: string[];

  beforeAll(() => {
    consumerRoot = mkdtempSync(join(tmpdir(), 'nx-nest-package-'));
    installedPackage = join(consumerRoot, 'node_modules/@anarchitects/nest');
    mkdirSync(installedPackage, { recursive: true });

    const [pack] = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          '--json',
          '--ignore-scripts',
          '--pack-destination',
          consumerRoot,
        ],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          env: { ...process.env, npm_config_cache: join(consumerRoot, '.npm') },
        }
      )
    );
    packedFiles = pack.files.map((file: { path: string }) => file.path);
    execFileSync('tar', [
      '-xzf',
      join(consumerRoot, pack.filename),
      '-C',
      installedPackage,
      '--strip-components=1',
    ]);

    // Supply the installed package's dependencies/peers without a network install.
    const manifest = JSON.parse(
      readFileSync(join(installedPackage, 'package.json'), 'utf8')
    );
    for (const dependency of Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...Object.fromEntries(
        [
          '@nx/vitest',
          '@swc/core',
          'unplugin-swc',
          'vite',
          'vitest',
          'vite-tsconfig-paths',
        ].map((name) => [name, '*'])
      ),
    })) {
      const destination = join(consumerRoot, 'node_modules', dependency);
      mkdirSync(dirname(destination), { recursive: true });
      symlinkSync(
        ['unplugin-swc', 'vite-tsconfig-paths'].includes(dependency)
          ? resolve(dirname(require.resolve(dependency)), '..')
          : dirname(require.resolve(`${dependency}/package.json`)),
        destination,
        'junction'
      );
    }
  }, 30_000);

  afterAll(() => {
    if (consumerRoot) rmSync(consumerRoot, { recursive: true, force: true });
  });

  it('runs the stable Nest v12 CLI baseline', () => {
    const version = execFileSync(
      process.execPath,
      [require.resolve('@nestjs/cli/bin/nest.js'), '--version'],
      { cwd: packageRoot, encoding: 'utf8' }
    );
    expect(version.trim()).toBe('12.0.0');
  });

  it('aligns the Node contract with its stable schematic runtime', () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    );
    const native = require('@nestjs/schematics/package.json');
    expect(native.version).toBe('12.0.6');
    expect(native.type).toBe('module');
    expect(manifest.engines.node).toBe(native.engines.node);
    expect(manifest.dependencies['@nestjs/schematics']).toBe(native.version);
    expect(manifest.dependencies.typescript).toBe('>=6.0.0 <7');
  });

  it('runs the compiled generation adapter from the packed artifact', () => {
    const result = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing');
      const { runNestSchematic } = require('./node_modules/@anarchitects/nest/dist/generation-adapter/run-nest-schematic.js');
      (async () => {
        const tree = createTreeWithEmptyWorkspace();
        await runNestSchematic(tree, { schematic: 'class', options: { name: 'packed', sourceRoot: 'src', spec: false } });
        console.log(tree.read('src/packed.ts', 'utf8'));
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `,
      ],
      { cwd: consumerRoot, encoding: 'utf8', timeout: 30_000 }
    );
    expect(result.trim()).toBe('export class Packed {}');
  });

  it('ships every public runtime and type export, documentation, and MIT license', () => {
    const manifest = JSON.parse(
      readFileSync(join(installedPackage, 'package.json'), 'utf8')
    );
    for (const entrypoint of ['.', './plugin']) {
      for (const condition of ['types', 'import', 'default']) {
        expect(
          existsSync(
            join(installedPackage, manifest.exports[entrypoint][condition])
          )
        ).toBe(true);
      }
    }
    expect(manifest.license).toBe('MIT');
    const collection = JSON.parse(
      readFileSync(join(installedPackage, manifest.generators), 'utf8')
    );
    for (const name of [
      'init',
      'application',
      'configuration',
      'sub-app',
      'library',
      'resource',
      'class',
      'interface',
      'module',
      'provider',
      'service',
      'controller',
      'decorator',
      'filter',
      'gateway',
      'guard',
      'interceptor',
      'middleware',
      'pipe',
      'resolver',
    ]) {
      const generator = collection.generators[name];
      expect(
        existsSync(join(installedPackage, `${generator.factory}.js`))
      ).toBe(true);
      expect(existsSync(join(installedPackage, generator.schema))).toBe(true);
    }
    expect(readFileSync(join(installedPackage, 'LICENSE'), 'utf8')).toContain(
      'MIT License'
    );
    expect(packedFiles).toEqual(
      expect.arrayContaining(['package.json', 'README.md', 'LICENSE'])
    );
    expect(
      packedFiles.some((file) =>
        /(?:\.spec\.|\.tsbuildinfo$|^src\/)/.test(file)
      )
    ).toBe(false);
  });

  it('documents the complete native collection and aliases while excluding migration schematics', () => {
    const published = JSON.parse(
      readFileSync(join(installedPackage, 'generators.json'), 'utf8')
    ).generators;
    const nativeRoot = dirname(
      require.resolve('@nestjs/schematics/package.json')
    );
    const native = JSON.parse(
      readFileSync(join(nativeRoot, 'dist/collection.json'), 'utf8')
    ).schematics as Record<string, { aliases?: string[] }>;
    const expected = Object.keys(native).filter((name) => name !== 'upgrade');
    expect(Object.keys(published).sort()).toEqual(['init', ...expected].sort());
    const readme = readFileSync(join(installedPackage, 'README.md'), 'utf8');
    const documented = new Map(
      readme
        .split('\n')
        .filter((line) => line.startsWith('|'))
        .map((line) => {
          const cells = line
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim().replace(/`/g, ''));
          return [cells[0], cells[1]];
        })
    );
    for (const name of expected) {
      const aliases = native[name].aliases ?? [];
      expect(published[name].aliases ?? []).toEqual(aliases);
      expect(documented.get(name)).toBe(aliases.join(', ') || '—');
    }
    expect(published.upgrade).toBeUndefined();
    expect(published.update).toBeUndefined();
    expect(readme).toContain('issues/508');
  });

  it.each([
    {
      generator: 'library',
      selectors: [],
      error: 'Choose exactly one library owner',
    },
    {
      generator: 'lib',
      selectors: ['--project=api', '--directory=libs/users'],
      error: 'mutually exclusive',
    },
    {
      generator: 'library',
      selectors: ['--directory=libs/users', '--rootDir=modules'],
      error: 'only supported with --project',
    },
    {
      generator: 'lib',
      selectors: ['--directory=libs/users'],
      error:
        'Nx-native library generation with --directory is not available yet',
    },
  ])(
    'validates packed $generator ownership before dry-run writes: $selectors',
    ({ generator, selectors, error }) => {
      const workspace = mkdtempSync(
        join(tmpdir(), 'nx-nest-library-contract-')
      );
      try {
        symlinkSync(
          join(consumerRoot, 'node_modules'),
          join(workspace, 'node_modules'),
          'junction'
        );
        const manifest = JSON.stringify({ name: 'consumer', private: true });
        writeFileSync(join(workspace, 'package.json'), manifest);
        writeFileSync(join(workspace, 'nx.json'), '{}');
        const result = spawnSync(
          process.execPath,
          [
            require.resolve('nx/bin/nx.js'),
            'g',
            `@anarchitects/nest:${generator}`,
            'users',
            ...selectors,
            '--skipInstall',
            '--dry-run',
            '--no-interactive',
          ],
          {
            cwd: workspace,
            encoding: 'utf8',
            timeout: 30_000,
            env: {
              ...process.env,
              NX_DAEMON: 'false',
              NX_ISOLATE_PLUGINS: 'false',
              NX_NO_CLOUD: 'true',
            },
          }
        );
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(`${result.stdout}\n${result.stderr}`).toContain(error);
        expect(readFileSync(join(workspace, 'package.json'), 'utf8')).toBe(
          manifest
        );
        expect(readFileSync(join(workspace, 'nx.json'), 'utf8')).toBe('{}');
        expect(existsSync(join(workspace, 'libs'))).toBe(false);
        expect(existsSync(join(workspace, 'nest-cli.json'))).toBe(false);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  );

  it.each([
    {
      root: '.',
      selector: [],
      language: 'ts',
      generator: 'configuration',
      manifest: 'package.json',
    },
    {
      root: '.',
      selector: [],
      language: 'js',
      generator: 'config',
      manifest: 'package.json',
    },
    {
      root: 'services/api',
      selector: ['--directory=services/api'],
      language: 'ts',
      generator: 'config',
      manifest: 'package.json',
    },
    {
      root: 'services/api',
      selector: ['--project=api'],
      language: 'js',
      generator: 'configuration',
      manifest: 'project.json',
    },
  ])(
    'generates safe discoverable configuration through packed $generator at $root ($language, $manifest)',
    ({ root, selector, language, generator, manifest }) => {
      const workspace = mkdtempSync(join(tmpdir(), 'nx-nest-configuration-'));
      try {
        symlinkSync(
          join(consumerRoot, 'node_modules'),
          join(workspace, 'node_modules'),
          'junction'
        );
        writeFileSync(
          join(workspace, 'package.json'),
          JSON.stringify({ name: 'consumer', private: true })
        );
        writeFileSync(join(workspace, 'nx.json'), '{}');
        writeFileSync(join(workspace, '.gitignore'), 'node_modules\n.nx\n');
        if (root !== '.') {
          mkdirSync(join(workspace, root), { recursive: true });
          writeFileSync(
            join(workspace, root, manifest),
            JSON.stringify({ name: 'api' })
          );
        }
        const nx = (...args: string[]) =>
          execFileSync(
            process.execPath,
            [
              require.resolve('nx/bin/nx.js'),
              ...args,
              ...(['g', 'generate'].includes(args[0]) &&
              args[1]?.startsWith('@anarchitects/nest:') &&
              !['init', 'configuration', 'config'].includes(
                args[1].split(':')[1]
              )
                ? ['--skipInstall=true']
                : []),
            ],
            {
              cwd: workspace,
              encoding: 'utf8',
              timeout: 30_000,
              stdio: 'pipe',
              env: {
                ...process.env,
                NODE_OPTIONS: '',
                NX_DAEMON: 'false',
                NX_ISOLATE_PLUGINS: 'false',
                NX_NO_CLOUD: 'true',
              },
            }
          );
        const args = [
          'generate',
          '@anarchitects/nest:' + generator,
          ...selector,
          '--language=' + language,
          '--no-interactive',
        ];
        nx(...args, '--dry-run');
        const configPath = join(workspace, root, 'nest-cli.json');
        expect(existsSync(configPath)).toBe(false);
        expect(readFileSync(join(workspace, 'nx.json'), 'utf8')).toBe('{}');
        nx(...args);
        const generated = readFileSync(configPath, 'utf8');
        expect(JSON.parse(generated)).toEqual({
          $schema: 'https://json.schemastore.org/nest-cli',
          collection: '@nestjs/schematics',
          sourceRoot: 'src',
          ...(language === 'js' ? { language: 'js' } : {}),
        });
        nx(...args);
        expect(readFileSync(configPath, 'utf8')).toBe(generated);
        const project = JSON.parse(
          nx('show', 'project', root === '.' ? 'consumer' : 'api', '--json')
        );
        expect(project.root).toBe(root);
        expect(project.targets.build.options).toEqual({
          command: 'nest build',
          cwd: root,
        });
        expect(project.targets.start.options).toEqual({
          command: 'nest start',
          cwd: root,
        });
        expect(project.targets.build.cache).toBe(true);
        expect(project.targets.build.outputs).toEqual(['{projectRoot}/dist']);
        expect(project.metadata.technologies).toContain('nest');
        const custom = generated.replace('"src"', '"custom"');
        writeFileSync(configPath, custom);
        const nxBefore = readFileSync(join(workspace, 'nx.json'), 'utf8');
        expect(() => nx(...args, '--force')).toThrow();
        expect(readFileSync(configPath, 'utf8')).toBe(custom);
        expect(readFileSync(join(workspace, 'nx.json'), 'utf8')).toBe(nxBefore);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    },
    90_000
  );

  it.each(['esm', 'cjs'])(
    'generates and discovers a native %s application through the packed Nx generator',
    (type) => {
      const workspace = mkdtempSync(join(tmpdir(), 'nx-nest-application-'));
      try {
        symlinkSync(
          join(consumerRoot, 'node_modules'),
          join(workspace, 'node_modules'),
          'junction'
        );
        const rootManifest = JSON.stringify({
          name: 'consumer',
          private: true,
        });
        writeFileSync(join(workspace, 'package.json'), rootManifest);
        writeFileSync(join(workspace, 'nx.json'), '{}');
        writeFileSync(join(workspace, '.gitignore'), 'node_modules\n.nx\n');
        const nx = (...args: string[]) =>
          execFileSync(
            process.execPath,
            [
              require.resolve('nx/bin/nx.js'),
              ...args,
              ...(['g', 'generate'].includes(args[0]) &&
              args[1]?.startsWith('@anarchitects/nest:') &&
              !['init', 'configuration', 'config'].includes(
                args[1].split(':')[1]
              )
                ? ['--skipInstall=true']
                : []),
            ],
            {
              cwd: workspace,
              encoding: 'utf8',
              timeout: 30_000,
              env: {
                ...process.env,
                NODE_OPTIONS: '',
                NX_DAEMON: 'false',
                NX_ISOLATE_PLUGINS: 'false',
                NX_NO_CLOUD: 'true',
              },
              stdio: 'pipe',
            }
          );
        const args = [
          'generate',
          '@anarchitects/nest:application',
          'api',
          '--directory=apps/api',
          `--type=${type}`,
          '--no-interactive',
        ];
        nx(...args, '--dry-run');
        expect(existsSync(join(workspace, 'apps'))).toBe(false);
        expect(readFileSync(join(workspace, 'nx.json'), 'utf8')).toBe('{}');
        expect(readFileSync(join(workspace, 'package.json'), 'utf8')).toBe(
          rootManifest
        );
        nx(...args);
        expect(
          JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'))
        ).toEqual({ ...JSON.parse(rootManifest), workspaces: ['apps/api'] });
        for (const file of [
          'yarn.lock',
          'package-lock.json',
          'pnpm-lock.yaml',
          '.git',
        ]) {
          expect(existsSync(join(workspace, file))).toBe(false);
        }
        const native = JSON.parse(
          readFileSync(join(workspace, 'apps/api/package.json'), 'utf8')
        );
        expect(native.type).toBe(type === 'esm' ? 'module' : undefined);
        expect(native.scripts.test).toContain(
          type === 'esm' ? 'vitest' : 'jest'
        );
        const project = JSON.parse(nx('show', 'project', 'api', '--json'));
        expect(project).toMatchObject({
          name: 'api',
          root: 'apps/api',
          projectType: 'application',
          sourceRoot: 'apps/api/src',
        });
        // Native package scripts intentionally retain Nx's normal precedence.
        expect(project.targets.build).toMatchObject({
          executor: 'nx:run-script',
          options: { script: 'build' },
        });
        expect(project.targets.start).toMatchObject({
          executor: 'nx:run-script',
          options: { script: 'start' },
        });
        expect(project.metadata.technologies).toContain('nest');
        // Distinct names expose the inferred targets alongside native scripts.
        writeFileSync(
          join(workspace, 'nx.json'),
          JSON.stringify({
            plugins: [
              {
                plugin: '@anarchitects/nest/plugin',
                options: {
                  buildTargetName: 'compile',
                  startTargetName: 'serve',
                },
              },
            ],
          })
        );
        const renamed = JSON.parse(nx('show', 'project', 'api', '--json'));
        expect(renamed.targets.compile).toMatchObject({
          options: { command: 'nest build', cwd: 'apps/api' },
          cache: true,
        });
        expect(renamed.targets.serve).toMatchObject({
          options: { command: 'nest start', cwd: 'apps/api' },
          cache: false,
          continuous: true,
        });
        const configPath = join(workspace, 'apps/api/nest-cli.json');
        const beforeMember = readFileSync(configPath, 'utf8');
        const subApp = [
          'generate',
          '@anarchitects/nest:app',
          'worker',
          '--project=api',
          '--no-interactive',
        ];
        nx(...subApp, '--dry-run');
        expect(readFileSync(configPath, 'utf8')).toBe(beforeMember);
        expect(existsSync(join(workspace, 'apps/api/apps'))).toBe(false);
        nx(...subApp);
        nx(
          'generate',
          '@anarchitects/nest:lib',
          'shared',
          '--project=api',
          '--prefix=@domain',
          '--no-interactive'
        );
        expect(
          JSON.parse(nx('show', 'project', 'api', '--json')).targets.compile
            .inputs
        ).toContain('{workspaceRoot}/apps/api/**/*');
        for (const [name, root, kind] of [
          ['api-api', 'apps/api/apps/api', 'application'],
          ['api-worker', 'apps/api/apps/worker', 'application'],
          ['api-shared', 'apps/api/libs/shared', 'library'],
        ]) {
          const member = JSON.parse(nx('show', 'project', name, '--json'));
          expect(member).toMatchObject({
            name,
            root,
            projectType: kind,
            sourceRoot: `${root}/src`,
          });
          expect(member.targets.compile).toMatchObject({
            options: {
              command: `nest build '${name.slice(4)}'`,
              cwd: 'apps/api',
            },
            cache: true,
            outputs: [
              `{workspaceRoot}/apps/api/dist/${
                kind === 'library' ? 'libs' : 'apps'
              }/${name.slice(4)}`,
            ],
          });
          if (kind === 'library') expect(member.targets.serve).toBeUndefined();
          else
            expect(member.targets.serve).toMatchObject({
              options: {
                command: `nest start '${name.slice(4)}'`,
                cwd: 'apps/api',
              },
              continuous: true,
            });
          expect(member.targets.build).toBeUndefined();
        }
        // Explicit Nx overrides continue to win over native-member inference.
        const memberPath = join(workspace, 'apps/api/apps/worker/project.json');
        const memberConfig = JSON.parse(readFileSync(memberPath, 'utf8'));
        memberConfig.targets = {
          compile: { command: 'echo custom', cache: false },
        };
        writeFileSync(memberPath, JSON.stringify(memberConfig));
        expect(
          JSON.parse(nx('show', 'project', 'api-worker', '--json')).targets
            .compile
        ).toMatchObject({ options: { command: 'echo custom' }, cache: false });
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        config.projects.worker.generateOptions = {
          spec: { resource: false },
          flat: true,
          specFileSuffix: 'check',
        };
        writeFileSync(configPath, JSON.stringify(config));
        const modulePath = join(
          workspace,
          'apps/api/apps/worker/src/worker.module.ts'
        );
        const ownerManifest = join(workspace, 'apps/api/package.json');
        const moduleBefore = readFileSync(modulePath, 'utf8');
        const manifestBefore = readFileSync(ownerManifest, 'utf8');
        const resourceArgs = [
          'generate',
          '@anarchitects/nest:res',
          'users',
          '--project=api-worker',
          '--path=features',
          '--crud=false',
          '--no-interactive',
        ];
        nx(...resourceArgs, '--dry-run');
        expect(readFileSync(modulePath, 'utf8')).toBe(moduleBefore);
        expect(readFileSync(ownerManifest, 'utf8')).toBe(manifestBefore);
        expect(
          existsSync(join(workspace, 'apps/api/apps/worker/src/features'))
        ).toBe(false);
        nx(...resourceArgs);
        expect(
          existsSync(
            join(
              workspace,
              'apps/api/apps/worker/src/features/users.controller.ts'
            )
          )
        ).toBe(true);
        expect(
          existsSync(
            join(
              workspace,
              'apps/api/apps/worker/src/features/users.controller.check.ts'
            )
          )
        ).toBe(false);
        expect(readFileSync(modulePath, 'utf8')).toContain(
          `./features/users.module${type === 'esm' ? '.js' : ''}`
        );
        nx(
          'generate',
          '@anarchitects/nest:resource',
          'orders',
          '--project=api-worker',
          '--spec=true',
          '--specFileSuffix=unit',
          '--skipImport=true',
          '--crud=false',
          '--no-interactive'
        );
        expect(
          existsSync(
            join(
              workspace,
              'apps/api/apps/worker/src/orders.controller.unit.ts'
            )
          )
        ).toBe(true);
        expect(
          JSON.parse(readFileSync(ownerManifest, 'utf8')).dependencies[
            '@nestjs/mapped-types'
          ]
        ).toBe('*');
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    },
    90_000
  );

  it.each(['esm', 'cjs'])(
    'runs packed artifact generators and aliases in %s',
    (mode) => {
      const workspace = mkdtempSync(join(tmpdir(), 'nx-nest-structural-'));
      try {
        symlinkSync(
          join(consumerRoot, 'node_modules'),
          join(workspace, 'node_modules'),
          'junction'
        );
        writeFileSync(
          join(workspace, 'package.json'),
          JSON.stringify({ name: 'consumer', private: true })
        );
        writeFileSync(join(workspace, 'nx.json'), '{}');
        writeFileSync(join(workspace, '.gitignore'), 'node_modules\n.nx\n');
        const nx = (...args: string[]) =>
          execFileSync(
            process.execPath,
            [
              require.resolve('nx/bin/nx.js'),
              ...args,
              ...(['g', 'generate'].includes(args[0]) &&
              args[1]?.startsWith('@anarchitects/nest:') &&
              !['init', 'configuration', 'config'].includes(
                args[1].split(':')[1]
              )
                ? ['--skipInstall=true']
                : []),
            ],
            {
              cwd: workspace,
              encoding: 'utf8',
              timeout: 30_000,
              stdio: 'pipe',
              env: {
                ...process.env,
                NODE_OPTIONS: '',
                NX_DAEMON: 'false',
                NX_ISOLATE_PLUGINS: 'false',
                NX_NO_CLOUD: 'true',
              },
            }
          );
        nx(
          'generate',
          '@anarchitects/nest:application',
          'api',
          '--directory=apps/api',
          `--type=${mode}`,
          '--no-interactive'
        );
        const modulePath = join(workspace, 'apps/api/src/app.module.ts');
        const beforeModule = readFileSync(modulePath, 'utf8');
        nx(
          'generate',
          '@anarchitects/nest:resolver',
          'preview',
          '--project=api',
          '--dry-run',
          '--no-interactive'
        );
        expect(readFileSync(modulePath, 'utf8')).toBe(beforeModule);
        expect(existsSync(join(workspace, 'apps/api/src/preview'))).toBe(false);
        for (const [name, alias, file] of [
          ['decorator', 'd', 'artifact-decorator.decorator.ts'],
          ['filter', 'f', 'artifact-filter.filter.ts'],
          ['gateway', 'ga', 'artifact-gateway.gateway.ts'],
          ['guard', 'gu', 'artifact-guard.guard.ts'],
          ['interceptor', 'itc', 'artifact-interceptor.interceptor.ts'],
          ['middleware', 'mi', 'artifact-middleware.middleware.ts'],
          ['pipe', 'pi', 'artifact-pipe.pipe.ts'],
          ['resolver', 'r', 'artifact-resolver/artifact-resolver.resolver.ts'],
          ['class', 'cl', 'artifact-class.ts'],
          ['interface', 'itf', 'artifact-interface.interface.ts'],
          ['module', 'mo', 'artifact-module/artifact-module.module.ts'],
          ['provider', 'pr', 'artifact-provider.ts'],
          ['service', 's', 'artifact-service/artifact-service.service.ts'],
          [
            'controller',
            'co',
            'artifact-controller/artifact-controller.controller.ts',
          ],
        ]) {
          nx(
            'generate',
            `@anarchitects/nest:${mode === 'esm' ? name : alias}`,
            `artifact-${name}`,
            '--project=api',
            '--no-interactive'
          );
          expect(existsSync(join(workspace, 'apps/api/src', file))).toBe(true);
        }
        for (const name of ['provider', 'service', 'gateway', 'resolver']) {
          const before = readFileSync(modulePath, 'utf8');
          nx(
            'generate',
            `@anarchitects/nest:${name}`,
            `isolated-${name}`,
            '--project=api',
            '--skipImport=true',
            '--spec=false',
            '--no-interactive'
          );
          expect(readFileSync(modulePath, 'utf8')).toBe(before);
        }
        const configPath = join(workspace, 'apps/api/nest-cli.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        config.generateOptions = {
          spec: { service: false },
          flat: true,
          specFileSuffix: 'check',
        };
        writeFileSync(configPath, JSON.stringify(config));
        nx(
          'generate',
          '@anarchitects/nest:s',
          'configured',
          '--project=api',
          '--no-interactive'
        );
        expect(
          existsSync(join(workspace, 'apps/api/src/configured.service.ts'))
        ).toBe(true);
        expect(
          existsSync(
            join(workspace, 'apps/api/src/configured.service.check.ts')
          )
        ).toBe(false);
        nx(
          'generate',
          '@anarchitects/nest:service',
          'explicit',
          '--project=api',
          '--spec=true',
          '--no-interactive'
        );
        expect(
          existsSync(join(workspace, 'apps/api/src/explicit.service.check.ts'))
        ).toBe(true);
        expect(readFileSync(modulePath, 'utf8')).toContain(
          `./configured.service${mode === 'esm' ? '.js' : ''}`
        );
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    },
    90_000
  );

  it.each(['commonjs', 'module'])(
    'loads public exports from a standalone %s consumer',
    (mode) => {
      const script =
        mode === 'commonjs'
          ? `const { name } = require('@anarchitects/nest');
         const plugin = require('@anarchitects/nest/plugin');
         const manifest = require('@anarchitects/nest/package.json');`
          : `import { name } from '@anarchitects/nest';
         import * as plugin from '@anarchitects/nest/plugin';
         import { createRequire } from 'node:module';
         const manifest = createRequire(import.meta.url)('@anarchitects/nest/package.json');`;

      const output = execFileSync(
        process.execPath,
        [
          `--input-type=${mode}`,
          '-e',
          `${script}
       console.log(JSON.stringify([name, plugin.name, manifest.name]));`,
        ],
        { cwd: consumerRoot, encoding: 'utf8' }
      );
      expect(JSON.parse(output)).toEqual([
        '@anarchitects/nest/plugin',
        '@anarchitects/nest/plugin',
        '@anarchitects/nest',
      ]);
    }
  );

  it.each([
    ['build', 'start'],
    ['compile', 'serve'],
  ])(
    'infers %s and %s through Nx and preserves explicit targets',
    (buildTargetName, startTargetName) => {
      const fixtures = {
        'package.json': {
          name: 'consumer',
          private: true,
          workspaces: ['apps/*'],
        },
        'nx.json': {
          plugins: [
            {
              plugin: '@anarchitects/nest/plugin',
              options: { buildTargetName, startTargetName },
            },
          ],
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['default'],
          },
          targetDefaults: {
            [startTargetName]: {
              metadata: { description: 'Workspace start default' },
            },
            [buildTargetName]: {
              metadata: { description: 'Workspace build default' },
            },
          },
        },
        'nest-cli.json': { sourceRoot: 'src' },
        'tsconfig.json': { files: [], references: [{ path: './apps/api' }] },
        'apps/api/package.json': { name: '@consumer/api' },
        'apps/api/nest-cli.json': {
          sourceRoot: 'src',
          compilerOptions: { tsConfigPath: 'configs/build.json' },
        },
        'apps/api/configs/build.json': {
          extends: '../../../config/build-base.json',
        },
        'config/build-base.json': {
          compilerOptions: { outDir: '../build/api' },
        },
        'services/worker/project.json': {
          name: 'worker',
          targets: {
            check: { command: 'echo check' },
            [startTargetName]: {
              command: 'echo custom start',
              continuous: false,
              metadata: { description: 'Explicit worker start' },
            },
            [buildTargetName]: {
              command: 'echo custom build',
              cache: false,
              outputs: ['{projectRoot}/custom-dist'],
              metadata: { description: 'Explicit worker build' },
            },
          },
        },
        'services/worker/nest-cli.json': {},
        'apps/web/package.json': { name: '@consumer/web' },
        'tools/nest-cli.json': {},
      };
      for (const [path, value] of Object.entries(fixtures)) {
        mkdirSync(dirname(join(consumerRoot, path)), { recursive: true });
        writeFileSync(join(consumerRoot, path), JSON.stringify(value));
      }

      const graphFile = join(consumerRoot, 'graph.json');
      execFileSync(
        process.execPath,
        [require.resolve('nx/bin/nx.js'), 'graph', '--file', graphFile],
        {
          cwd: consumerRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            NX_DAEMON: 'false',
            NX_ISOLATE_PLUGINS: 'false',
            NX_NO_CLOUD: 'true',
          },
          stdio: 'pipe',
        }
      );
      const { nodes } = JSON.parse(readFileSync(graphFile, 'utf8')).graph;
      expect(Object.keys(nodes).sort()).toEqual([
        '@consumer/api',
        '@consumer/web',
        'consumer',
        'worker',
      ]);
      for (const name of ['consumer', '@consumer/api', 'worker']) {
        expect(nodes[name].data.metadata.technologies).toContain('nest');
        for (const target of ['test', 'lint']) {
          expect(nodes[name].data.targets[target]).toBeUndefined();
        }
        if (buildTargetName !== 'build')
          expect(nodes[name].data.targets.build).toBeUndefined();
        if (startTargetName !== 'start')
          expect(nodes[name].data.targets.start).toBeUndefined();
      }
      for (const name of ['consumer', '@consumer/api']) {
        const startTarget = nodes[name].data.targets[startTargetName];
        expect(startTarget).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest start', cwd: nodes[name].data.root },
          continuous: true,
          cache: false,
          metadata: {
            description: 'Workspace start default',
            technologies: ['nest'],
          },
        });
        for (const property of ['inputs', 'outputs', 'dependsOn']) {
          expect(startTarget[property]).toBeUndefined();
        }
        expect(nodes[name].data.targets[buildTargetName]).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest build', cwd: nodes[name].data.root },
          cache: true,
          dependsOn: [`^${buildTargetName}`],
          inputs: expect.arrayContaining([
            'production',
            '^production',
            { externalDependencies: ['@nestjs/cli'] },
            '{workspaceRoot}/tsconfig.json',
            '{workspaceRoot}/tsconfig.base.json',
          ]),
          outputs:
            name === 'consumer'
              ? ['{projectRoot}/dist']
              : ['{workspaceRoot}/build/api'],
          metadata: {
            description: 'Workspace build default',
            technologies: ['nest'],
          },
        });
      }
      expect(
        nodes['@consumer/api'].data.targets[buildTargetName].inputs
      ).toEqual(
        expect.arrayContaining([
          '{workspaceRoot}/apps/api/configs/build.json',
          '{workspaceRoot}/config/build-base.json',
        ])
      );
      expect(nodes.worker.data.targets[buildTargetName]).toMatchObject({
        options: { command: 'echo custom build' },
        cache: false,
        outputs: ['{projectRoot}/custom-dist'],
        metadata: { description: 'Explicit worker build' },
      });
      expect(nodes.worker.data.targets[startTargetName]).toMatchObject({
        options: { command: 'echo custom start' },
        continuous: false,
        metadata: { description: 'Explicit worker start' },
      });
      // A replacement command can replace inferred settings rather than merge them.
      expect(nodes.worker.data.targets[startTargetName].cache).not.toBe(true);
      expect(nodes['@consumer/api'].data.root).toBe('apps/api');
      expect(nodes.worker.data.targets.check.options.command).toBe(
        'echo check'
      );
      expect(
        nodes['@consumer/web'].data.metadata?.technologies ?? []
      ).not.toContain('nest');
      expect(
        nodes['@consumer/web'].data.targets[buildTargetName]
      ).toBeUndefined();
      expect(
        nodes['@consumer/web'].data.targets[startTargetName]
      ).toBeUndefined();
    },
    30_000
  );

  it('matches the directory emitted by stable Nest CLI for an inherited external outDir', () => {
    const fixtureFiles = {
      'demo/package.json': { name: 'demo' },
      'demo/nest-cli.json': {
        sourceRoot: 'src',
        compilerOptions: {
          builder: 'tsc',
          tsConfigPath: 'config/tsconfig.build.json',
        },
      },
      'demo/config/tsconfig.build.json': {
        extends: '../../shared-config.json',
        compilerOptions: { rootDir: '../src' },
        include: ['../src/**/*.ts'],
      },
      'shared-config.json': {
        compilerOptions: {
          outDir: './build/demo',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ES2022',
          types: [],
          skipLibCheck: true,
        },
      },
    };
    for (const [path, value] of Object.entries(fixtureFiles)) {
      mkdirSync(dirname(join(consumerRoot, path)), { recursive: true });
      writeFileSync(join(consumerRoot, path), JSON.stringify(value));
    }
    mkdirSync(join(consumerRoot, 'demo/src'));
    writeFileSync(
      join(consumerRoot, 'demo/src/main.ts'),
      'export const answer = 42;\n'
    );
    const inferred = execFileSync(
      process.execPath,
      [
        '-e',
        `
      const { createNodes } = require('@anarchitects/nest/plugin');
      createNodes[1](['demo/nest-cli.json'], undefined, { workspaceRoot: process.cwd(), nxJsonConfiguration: {} })
        .then(result => console.log(JSON.stringify(result[0][1].projects.demo.targets.build.outputs)));
    `,
      ],
      { cwd: consumerRoot, encoding: 'utf8' }
    );
    expect(JSON.parse(inferred)).toEqual(['{workspaceRoot}/build/demo']);
    execFileSync(
      process.execPath,
      [require.resolve('@nestjs/cli/bin/nest.js'), 'build'],
      { cwd: join(consumerRoot, 'demo'), encoding: 'utf8', stdio: 'pipe' }
    );
    expect(
      readFileSync(join(consumerRoot, 'build/demo/main.js'), 'utf8')
    ).toContain('42');
  }, 30_000);
});
