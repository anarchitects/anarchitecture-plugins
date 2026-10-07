// SPDX-License-Identifier: MIT
import type { ProjectConfiguration } from '@nx/devkit';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
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
import { delimiter, dirname, join, resolve } from 'node:path';
import { fixtures, type NestFixture } from './fixtures';
import { standardSchemaFixture } from './standard-schema-fixture';

const e2eRoot = resolve(__dirname, '..');
const pluginRoot = resolve(e2eRoot, '../nest');
const dependencies: Record<string, string> = JSON.parse(
  readFileSync(join(e2eRoot, 'package.json'), 'utf8')
).devDependencies;
const nxBin = require.resolve('nx/bin/nx.js');
let suiteRoot: string;
let tarball: string;

function packageRoot(name: string, from = e2eRoot): string {
  try {
    return dirname(require.resolve(`${name}/package.json`, { paths: [from] }));
  } catch {
    let directory = dirname(require.resolve(name, { paths: [from] }));
    while (dirname(directory) !== directory) {
      const manifest = join(directory, 'package.json');
      if (
        existsSync(manifest) &&
        JSON.parse(readFileSync(manifest, 'utf8')).name === name
      )
        return directory;
      directory = dirname(directory);
    }
    throw new Error(`Cannot locate installed package ${name}`);
  }
}

function write(root: string, path: string, value: unknown) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  );
}

function environment(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${join(root, 'node_modules/.bin')}${delimiter}${process.env.PATH}`,
    NX_DAEMON: 'false',
    NX_ISOLATE_PLUGINS: 'false',
    NX_NO_CLOUD: 'true',
    NX_INTERACTIVE: 'false',
    NX_TUI: 'false',
    FORCE_COLOR: '0',
    NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
    NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
  };
}

function nx(root: string, args: string[]) {
  try {
    return execFileSync(process.execPath, [nxBin, ...args], {
      cwd: root,
      env: environment(root),
      encoding: 'utf8',
      timeout: 60_000,
      stdio: 'pipe',
    });
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`
    );
  }
}

function createWorkspace(fixture: NestFixture) {
  const root = join(suiteRoot, fixture.name);
  mkdirSync(root, { recursive: true });
  const installedPackage = join(root, 'node_modules/@anarchitects/nest');
  mkdirSync(installedPackage, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    tarball,
    '-C',
    installedPackage,
    '--strip-components=1',
  ]);
  const pluginDependencies = JSON.parse(
    readFileSync(join(installedPackage, 'package.json'), 'utf8')
  ).dependencies;
  const fixtureDependencies = Object.fromEntries(
    Object.entries(dependencies).filter(
      ([name]) => name !== '@anarchitects/nest'
    )
  );
  for (const name of Object.keys({
    ...fixtureDependencies,
    ...pluginDependencies,
    '@types/node': '*',
  })) {
    const destination = join(root, 'node_modules', name);
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(
      packageRoot(name, name in pluginDependencies ? pluginRoot : e2eRoot),
      destination,
      'junction'
    );
  }
  mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
  symlinkSync(
    require.resolve('@nestjs/cli/bin/nest.js'),
    join(root, 'node_modules/.bin/nest')
  );
  symlinkSync(
    require.resolve('typescript/bin/tsc'),
    join(root, 'node_modules/.bin/tsc')
  );
  write(root, 'package.json', {
    name: fixture.root === '.' ? fixture.name : 'fixture-workspace',
    private: true,
    type: fixture.moduleType,
    dependencies: fixtureDependencies,
  });
  if (fixture.root !== '.')
    write(root, `${fixture.root}/package.json`, {
      name: fixture.name,
      private: true,
      type: fixture.moduleType,
    });
  write(root, 'nx.json', {
    plugins: [],
    namedInputs: { default: ['{projectRoot}/**/*'], production: ['default'] },
  });
  // Nx uses the real dependency lock to create external nodes for task hashing.
  // Dependencies are linked from this same immutable workspace install.
  write(
    root,
    'yarn.lock',
    readFileSync(resolve(e2eRoot, '../../yarn.lock'), 'utf8')
  );
  for (const [path, value] of Object.entries(fixture.files))
    write(root, path, value);
  // These configurations must not cause this plugin to infer unrelated targets.
  write(root, join(fixture.root, 'jest.config.cjs'), 'module.exports = {};\n');
  write(root, join(fixture.root, 'eslint.config.mjs'), 'export default [];\n');
  write(root, '.gitignore', 'node_modules\n.nx\ndist\nartifacts\n');
  return root;
}

async function stop(child: ChildProcess) {
  const signal = (value: NodeJS.Signals) => {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      } else if (child.pid) process.kill(-child.pid, value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  signal('SIGTERM');
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done) => {
    const timer = setTimeout(() => {
      signal('SIGKILL');
      done();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timer);
      done();
    });
  });
}

async function assertStarts(root: string, target: string) {
  const child = spawn(
    process.execPath,
    [nxBin, 'run', target, '--outputStyle=stream'],
    {
      cwd: root,
      env: environment(root),
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let output = '';
  try {
    const url = await new Promise<string>((accept, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Startup timed out:\n${output}`)),
        45_000
      );
      const capture = (data: Buffer) => {
        output += data.toString();
        const match = output.match(/NEST_E2E_URL=(http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timer);
          accept(match[1]);
        }
      };
      child.stdout?.on('data', capture);
      child.stderr?.on('data', capture);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timer);
        reject(new Error(`Start exited (${code ?? signal}):\n${output}`));
      });
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Nest v12 fixture' });
    expect(child.exitCode).toBeNull();
  } finally {
    await stop(child);
  }
}

describe('packed Nest plugin with stable v12 applications', () => {
  beforeAll(() => {
    suiteRoot = mkdtempSync(join(tmpdir(), 'nx-nest-e2e-'));
    const [pack] = JSON.parse(
      execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', suiteRoot],
        {
          cwd: pluginRoot,
          encoding: 'utf8',
          env: { ...process.env, npm_config_cache: join(suiteRoot, '.npm') },
          timeout: 30_000,
        }
      )
    );
    tarball = join(suiteRoot, pack.filename);
  });
  afterAll(() => {
    if (suiteRoot) rmSync(suiteRoot, { recursive: true, force: true });
  });

  it('uses pinned stable Nest v12 application and CLI packages', () => {
    for (const name of [
      '@nestjs/cli',
      '@nestjs/common',
      '@nestjs/core',
      '@nestjs/platform-express',
      '@nestjs/microservices',
      '@nestjs/swagger',
    ]) {
      const version = JSON.parse(
        readFileSync(join(packageRoot(name), 'package.json'), 'utf8')
      ).version;
      expect(version).toMatch(/^12\.\d+\.\d+$/);
      expect(version).toBe(dependencies[name]);
    }
  });

  it.each(fixtures)(
    '$name: discovers, builds, restores outputs, and starts',
    async (fixture) => {
      const root = createWorkspace(fixture);
      try {
        const buildName = fixture.buildTargetName ?? 'build';
        const startName = fixture.startTargetName ?? 'start';
        const initArgs = [
          'generate',
          '@anarchitects/nest:init',
          '--no-interactive',
        ];
        if (fixture.buildTargetName)
          initArgs.push(`--buildTargetName=${buildName}`);
        if (fixture.startTargetName)
          initArgs.push(`--startTargetName=${startName}`);
        const manifest = readFileSync(join(root, 'package.json'), 'utf8');
        const nestConfig = readFileSync(
          join(root, fixture.root, 'nest-cli.json'),
          'utf8'
        );
        nx(root, initArgs);
        const initialized = readFileSync(join(root, 'nx.json'), 'utf8');
        nx(root, initArgs);
        expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(initialized);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(manifest);
        expect(
          readFileSync(join(root, fixture.root, 'nest-cli.json'), 'utf8')
        ).toBe(nestConfig);
        const graphFile = join(root, 'graph.json');
        nx(root, ['graph', '--file', graphFile]);
        const nodes: Record<string, { data: ProjectConfiguration }> =
          JSON.parse(readFileSync(graphFile, 'utf8')).graph.nodes;
        const nestProjects = Object.values(nodes).filter(({ data }) =>
          data.metadata?.technologies?.includes('nest')
        );
        expect(nestProjects.map(({ data }) => data.root)).toEqual([
          fixture.root,
        ]);
        const project = nodes[fixture.name].data;
        const targets = project.targets ?? {};
        expect(Object.keys(targets).sort()).toEqual(
          [buildName, startName].sort()
        );
        expect(targets[buildName]).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest build', cwd: fixture.root },
          cache: true,
          dependsOn: [`^${buildName}`],
          outputs: [fixture.output],
          metadata: { technologies: ['nest'] },
        });
        if (fixture.configInputs)
          expect(targets[buildName].inputs).toEqual(
            expect.arrayContaining(fixture.configInputs)
          );
        expect(targets[startName]).toMatchObject({
          executor: 'nx:run-commands',
          options: { command: 'nest start', cwd: fixture.root },
          continuous: true,
          cache: false,
          metadata: { technologies: ['nest'] },
        });
        for (const key of ['inputs', 'outputs', 'dependsOn'])
          expect(
            targets[startName][key as keyof (typeof targets)[string]]
          ).toBeUndefined();
        rmSync(graphFile);
        nx(root, [
          'run',
          `${fixture.name}:${buildName}`,
          '--outputStyle=static',
        ]);
        const emittedPath = join(root, fixture.emittedMain);
        expect(existsSync(emittedPath)).toBe(true);
        const emitted = readFileSync(emittedPath, 'utf8');
        expect(emitted).toMatch(
          fixture.moduleType === 'module' ? /import\s/ : /require\(/
        );
        const outputPath = fixture.output
          .replace('{projectRoot}', join(root, fixture.root))
          .replace('{workspaceRoot}', root);
        rmSync(outputPath, { recursive: true, force: true });
        const cached = nx(root, [
          'run',
          `${fixture.name}:${buildName}`,
          '--outputStyle=static',
        ]);
        expect(cached).toMatch(
          /\[local cache\]|read the output from the cache/
        );
        expect(readFileSync(emittedPath, 'utf8')).toBe(emitted);
        await assertStarts(root, `${fixture.name}:${startName}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it.each(['esm', 'cjs'])(
    'runs Standard Schema HTTP, TCP, serialization, and OpenAPI with native %s resources',
    (mode) => {
      const root = createWorkspace({
        ...fixtures[0],
        name: `standard-schema-${mode}`,
        files: {},
      });
      try {
        nx(root, [
          'generate',
          '@anarchitects/nest:application',
          'backend',
          '--directory=services/backend',
          ...(mode === 'cjs' ? ['--type=cjs'] : []),
          '--no-interactive',
        ]);
        const owner = join(root, 'services/backend');
        const manifest = JSON.parse(
          readFileSync(join(owner, 'package.json'), 'utf8')
        );
        manifest.dependencies['@nestjs/swagger'] =
          dependencies['@nestjs/swagger'];
        manifest.dependencies['@nestjs/microservices'] =
          dependencies['@nestjs/microservices'];
        write(owner, 'package.json', manifest);
        for (const [name, type] of [
          ['users', 'rest'],
          ['events', 'microservice'],
        ])
          nx(root, [
            'generate',
            '@anarchitects/nest:resource',
            name,
            '--project=backend',
            '--type=' + type,
            '--crud=true',
            '--spec=false',
            '--no-interactive',
          ]);
        const nativeFiles = [
          'src/app.module.ts',
          'src/main.ts',
          'src/users/users.controller.ts',
          'src/users/users.service.ts',
          'src/users/dto/update-user.dto.ts',
          'src/events/events.controller.ts',
          'src/events/events.service.ts',
          'tsconfig.json',
          'nest-cli.json',
          'package.json',
        ];
        const before = nativeFiles.map(
          (path) => [path, readFileSync(join(owner, path), 'utf8')] as const
        );
        // Consumer-owned code uses generated services/modules without rewriting
        // native sources, toolchain config, or installing a schema vendor.
        write(owner, 'src/compatibility.ts', standardSchemaFixture);
        write(owner, 'tsconfig.compatibility.json', {
          extends: './tsconfig.json',
          compilerOptions: {
            rootDir: 'src',
            outDir: 'dist-compatibility',
            types: ['node'],
            incremental: false,
          },
          include: ['src/**/*.ts'],
          exclude: ['src/**/*.spec.ts'],
        });
        const project = JSON.parse(
          readFileSync(join(owner, 'project.json'), 'utf8')
        );
        project.targets = {
          ...project.targets,
          'verify-standard-schema': {
            executor: 'nx:run-commands',
            options: {
              command: 'tsc -p tsconfig.compatibility.json',
              cwd: 'services/backend',
            },
          },
        };
        write(owner, 'project.json', project);
        nx(root, [
          'run',
          'backend:verify-standard-schema',
          '--outputStyle=static',
        ]);
        const output = execFileSync(
          process.execPath,
          [join(owner, 'dist-compatibility/compatibility.js')],
          {
            cwd: owner,
            env: environment(root),
            encoding: 'utf8',
            timeout: 30_000,
            stdio: 'pipe',
          }
        );
        expect(output).toContain('STANDARD_SCHEMA_COMPATIBILITY_OK');
        for (const [path, contents] of before)
          expect(readFileSync(join(owner, path), 'utf8')).toBe(contents);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it.each(['module', 'commonjs'] as const)(
    'builds an existing %s application after native configuration generation',
    async (moduleType) => {
      const fixture = {
        ...fixtures[0],
        name: `configuration-${moduleType}`,
        moduleType,
      };
      const root = createWorkspace(fixture);
      try {
        rmSync(join(root, 'nest-cli.json'));
        nx(root, ['generate', '@anarchitects/nest:config', '--no-interactive']);
        const config = JSON.parse(
          readFileSync(join(root, 'nest-cli.json'), 'utf8')
        );
        expect(config).toEqual({
          $schema: 'https://json.schemastore.org/nest-cli',
          collection: '@nestjs/schematics',
          sourceRoot: 'src',
        });
        const project = JSON.parse(
          nx(root, ['show', 'project', fixture.name, '--json'])
        );
        expect(project.targets.build.options).toEqual({
          command: 'nest build',
          cwd: '.',
        });
        expect(project.targets.start.options).toEqual({
          command: 'nest start',
          cwd: '.',
        });
        nx(root, ['run', `${fixture.name}:build`, '--outputStyle=static']);
        expect(existsSync(join(root, fixture.emittedMain))).toBe(true);
        await assertStarts(root, `${fixture.name}:start`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it.each(['esm', 'cjs'])(
    'builds generated native %s members with resources and cross-cutting artifacts',
    (type) => {
      const root = createWorkspace({
        ...fixtures[0],
        name: `generated-${type}`,
        files: {},
      });
      try {
        nx(root, [
          'generate',
          '@anarchitects/nest:application',
          'backend',
          '--directory=services/backend',
          `--type=${type}`,
          '--no-interactive',
        ]);
        nx(root, [
          'generate',
          '@anarchitects/nest:sub-app',
          'worker',
          '--project=backend',
          '--no-interactive',
        ]);
        nx(root, [
          'generate',
          '@anarchitects/nest:library',
          'shared',
          '--project=backend',
          '--prefix=@domain',
          '--no-interactive',
        ]);
        for (const member of ['worker', 'shared']) {
          nx(root, [
            'generate',
            '@anarchitects/nest:resource',
            'users',
            `--project=backend-${member}`,
            '--crud=false',
            '--spec=false',
            '--no-interactive',
          ]);
          for (const [schematic, name] of [
            ['class', 'model'],
            ['interface', 'contract'],
            ['module', 'feature'],
            ['provider', 'cache'],
            ['service', 'logic'],
            ['controller', 'health'],
            ['decorator', 'roles'],
            ['filter', 'errors'],
            ['guard', 'access'],
            ['interceptor', 'logging'],
            ['middleware', 'request'],
            ['pipe', 'validation'],
          ]) {
            const args = [
              'generate',
              `@anarchitects/nest:${schematic}`,
              name,
              `--project=backend-${member}`,
              '--no-interactive',
            ];
            if (!['interface', 'module', 'decorator'].includes(schematic))
              args.push('--spec=false');
            nx(root, args);
          }
        }
        // Model dependencies installed for this native Nest package. Its default
        // Rspack externals discovery reads node_modules from the package cwd.
        symlinkSync(
          join(root, 'node_modules'),
          join(root, 'services/backend/node_modules'),
          'junction'
        );
        for (const [name, directory] of [
          ['worker', 'apps'],
          ['shared', 'libs'],
        ]) {
          const project = JSON.parse(
            nx(root, ['show', 'project', `backend-${name}`, '--json'])
          );
          expect(project.targets.build.options).toEqual({
            command: `nest build '${name}'`,
            cwd: 'services/backend',
          });
          if (name === 'shared') expect(project.targets.start).toBeUndefined();
          nx(root, ['run', `backend-${name}:build`, '--outputStyle=static']);
          const output = join(root, 'services/backend/dist', directory, name);
          expect(
            existsSync(join(output, name === 'worker' ? 'main.js' : 'index.js'))
          ).toBe(true);
          rmSync(output, { recursive: true, force: true });
          expect(
            nx(root, ['run', `backend-${name}:build`, '--outputStyle=static'])
          ).toMatch(/\[local cache\]|read the output from the cache/);
          expect(
            existsSync(join(output, name === 'worker' ? 'main.js' : 'index.js'))
          ).toBe(true);
        }
        const config = JSON.parse(
          readFileSync(join(root, 'services/backend/nest-cli.json'), 'utf8')
        );
        expect(config.projects.worker.root).toBe('apps/worker');
        expect(config.projects.shared.root).toBe('libs/shared');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('rejects an incompatible declared framework without partial registration', () => {
    const root = createWorkspace(fixtures[0]);
    try {
      const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
      );
      manifest.dependencies['@nestjs/common'] = '^11.0.0';
      write(root, 'package.json', manifest);
      const before = readFileSync(join(root, 'nx.json'), 'utf8');
      expect(() =>
        nx(root, ['generate', '@anarchitects/nest:init', '--no-interactive'])
      ).toThrow('@nestjs/common@^11.0.0');
      expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
