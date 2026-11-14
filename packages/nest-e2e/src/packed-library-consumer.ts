// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { consumerEnvironment } from './consumer-environment';
import { fixtures } from './fixtures';
import { snapshotFiles, usePackedPlugin, write } from './packed-plugin';
import { writePublishableLibrary } from './published-build-consumer';

/** Samples, not a Cartesian certification of the package's semver ranges. */
export const consumerLanes = {
  node22: { node: '22.22.3', nx: '23.2.0' },
  node24: { node: '24.21.0', nx: '24.0.1' },
  node26: { node: '26.0.0', nx: '24.0.1' },
} as const;
const library = '@fixture/published';
const repository = resolve(__dirname, '../../..');
const packageManager = JSON.parse(
  readFileSync(join(repository, 'package.json'), 'utf8')
).packageManager;
const framework = {
  '@nestjs/common': '12.1.2',
  '@nestjs/core': '12.1.2',
  'reflect-metadata': '0.2.2',
  rxjs: '7.8.2',
};

function command(
  root: string,
  executable: string,
  args: string[],
  node?: string
) {
  const env = consumerEnvironment(root);
  if (node) env.PATH = `${dirname(node)}${delimiter}${env.PATH}`;
  const started = Date.now();
  process.stderr.write(
    `[packed-consumer] START ${executable} ${args.join(' ')}\n`
  );
  try {
    return stripVTControlCharacters(
      execFileSync(executable, args, {
        cwd: root,
        env: { ...env, CI: 'true' },
        encoding: 'utf8',
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: 'pipe',
      })
    );
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      `${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`
    );
  } finally {
    process.stderr.write(
      `[packed-consumer] END durationMs=${Date.now() - started}\n`
    );
  }
}

/** Excludes package-manager/Nx state, but includes every authored/build file. */
function authoredFiles(root: string) {
  const result: Record<string, string> = {};
  function visit(path: string) {
    for (const entry of readdirSync(join(root, path), {
      withFileTypes: true,
    })) {
      if (['node_modules', '.nx', '.yarn'].includes(entry.name)) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else result[child] = readFileSync(join(root, child)).toString('base64');
    }
  }
  visit('');
  return result;
}

/** Yarn lock blocks have stable registry metadata, independent of local tarballs.
 * Checksums may be added when another OS fetches an optional native package.
 */
function registryRecords(lock: string) {
  const records = new Map<string, string>();
  for (const block of lock.split('\n\n')) {
    const resolution = block.match(
      /^ {2}resolution: "([^"]+@npm:[^"]+)"$/m
    )?.[1];
    if (resolution)
      records.set(
        resolution,
        block
          .slice(block.indexOf('\n') + 1)
          .replace(/^ {2}checksum:.*\n?/m, '')
          .trim()
      );
  }
  return records;
}

function pack(root: string, destination: string, node: string) {
  mkdirSync(destination, { recursive: true });
  const [artifact] = JSON.parse(
    command(
      root,
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
      node
    )
  );
  const files = artifact.files.map((file: { path: string }) => file.path);
  expect(files).toEqual(
    expect.arrayContaining([
      'package.json',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/secondary.js',
      'dist/secondary.d.ts',
    ])
  );
  expect(
    files.some(
      (path: string) => path.startsWith('src/') || path.includes('node_modules')
    )
  ).toBe(false);
  return join(destination, artifact.filename);
}

export function packedLibraryConsumerScenario(
  laneName: keyof typeof consumerLanes
) {
  const lane = consumerLanes[laneName];
  const suite = usePackedPlugin();
  let node: string;
  let tarball: string;
  const nx = (root: string, ...args: string[]) =>
    command(
      root,
      node,
      [
        join(
          root,
          'node_modules/nx',
          json(root, 'node_modules/nx/package.json').bin.nx
        ),
        ...args,
      ],
      node
    );
  const resolutionLock = readFileSync(
    join(__dirname, 'consumer-locks/yarn.lock'),
    'utf8'
  );
  const expectedRegistry = registryRecords(resolutionLock);
  function install(root: string) {
    // Only local workspace/tarball entries are generated per run. Registry
    // metadata must stay within the checked-in fixture, including transitives.
    write(root, 'yarn.lock', resolutionLock);
    const output = command(
      root,
      'corepack',
      ['yarn', 'install', '--no-immutable'],
      node
    );
    expect(output).not.toMatch(/YN0060|YN0002/);
    const actual = registryRecords(
      readFileSync(join(root, 'yarn.lock'), 'utf8')
    );
    expect(actual.size).toBeGreaterThan(0);
    for (const [resolution, metadata] of actual) {
      expect({ resolution, metadata }).toEqual({
        resolution,
        metadata: expectedRegistry.get(resolution),
      });
    }
    command(root, 'corepack', ['yarn', 'install', '--immutable'], node);
  }
  const init = (root: string, ...args: string[]) =>
    nx(root, 'g', '@anarchitects/nest:init', '--no-interactive', ...args);
  const json = (root: string, path: string) =>
    JSON.parse(readFileSync(join(root, path), 'utf8'));

  function prepare(root: string, manifest: Record<string, unknown>) {
    write(root, 'package.json', {
      name: 'packed-consumer',
      private: true,
      packageManager,
      ...manifest,
      devDependencies: {
        ...framework,
        '@anarchitects/nest': `file:${suite.tarball}`,
        '@nestjs/cli': '12.0.0',
        '@nestjs/platform-express': '12.1.2',
        '@nx/devkit': lane.nx,
        '@nx/js': lane.nx,
        nx: lane.nx,
        typescript: '6.0.3',
        '@types/node': '20.19.9',
      },
    });
    write(root, 'nx.json', {
      plugins: [],
      namedInputs: { default: ['{projectRoot}/**/*'], production: ['default'] },
    });
    write(
      root,
      '.yarnrc.yml',
      'nodeLinker: node-modules\nenableScripts: false\n'
    );
    write(root, '.gitignore', 'node_modules\n.nx\n.yarn\ndist\n');
    install(root);
    expect(command(root, node, ['--version'], node).trim()).toBe(
      `v${lane.node}`
    );
    for (const [name, version] of Object.entries({
      nx: lane.nx,
      '@nx/devkit': lane.nx,
      '@nestjs/cli': '12.0.0',
      typescript: '6.0.3',
      ...framework,
    })) {
      expect(json(root, `node_modules/${name}/package.json`).version).toBe(
        version
      );
      expect(
        realpathSync(join(root, 'node_modules', name)).startsWith(
          realpathSync(root)
        )
      ).toBe(true);
    }
    // Record exact tested runtime/tool versions in CI output, never infer them.
    process.stderr.write(
      `[packed-consumer] ${JSON.stringify({
        lane: laneName,
        node: lane.node,
        nx: lane.nx,
        typescript: '6.0.3',
        packageManager,
      })}\n`
    );
  }

  function adopt(root: string, build: string) {
    const project = build.split(':')[0];
    const targets = JSON.parse(
      nx(root, 'show', 'project', project, '--json')
    ).targets;
    nx(root, 'run', build, '--output-style=static');
    const before = authoredFiles(root);
    init(root, '--dry-run');
    expect(authoredFiles(root)).toEqual(before);
    init(root);
    expect(json(root, 'nx.json').plugins).toContain(
      '@anarchitects/nest/plugin'
    );
    const registered = authoredFiles(root);
    expect({ ...registered, 'nx.json': before['nx.json'] }).toEqual(before);
    init(root);
    expect(authoredFiles(root)).toEqual(registered);
    expect(
      JSON.parse(nx(root, 'show', 'project', project, '--json')).targets
    ).toEqual(targets);
    nx(root, 'run', build, '--skipNxCache', '--output-style=static');
    expect(authoredFiles(root)).toEqual(registered);
  }

  beforeAll(() => {
    // The npm Node package selects the current platform's exact official binary.
    // Its installation is separate from all consumer framework/tool graphs.
    node = command(suite.root, 'npm', [
      'exec',
      '--yes',
      `--package=node@${lane.node}`,
      '--',
      'node',
      '-p',
      'process.execPath',
    ]).trim();
    expect(command(suite.root, node, ['--version']).trim()).toBe(
      `v${lane.node}`
    );
    const root = join(suite.root, 'standalone');
    writePublishableLibrary(root, 'tsc', '.');
    prepare(root, { ...json(root, 'package.json'), private: false });
    nx(root, 'run', `${library}:build`, '--output-style=static');
    tarball = pack(root, join(suite.root, 'artifacts'), node);
  }, 240_000);

  it('adopts an existing standalone publishable root and installs its packed exports in a clean consumer', () => {
    const root = join(suite.root, 'standalone');
    // prepare preserves the actual publishable root's dual-major peers/exports.
    adopt(root, `${library}:build`);
    const consumer = join(suite.root, 'runtime');
    write(consumer, 'package.json', {
      name: 'runtime-consumer',
      private: true,
      packageManager,
      dependencies: { ...framework, [library]: `file:${tarball}` },
      devDependencies: { typescript: '6.0.3' },
    });
    write(
      consumer,
      '.yarnrc.yml',
      'nodeLinker: node-modules\nenableScripts: false\n'
    );
    install(consumer);
    const installed = join(consumer, 'node_modules', library);
    expect(realpathSync(installed)).toBe(
      join(realpathSync(consumer), 'node_modules', library)
    );
    expect(
      json(consumer, `node_modules/${library}/package.json`).peerDependencies
    ).toEqual({ '@nestjs/common': '^11 || ^12', '@nestjs/core': '^11 || ^12' });
    for (const extension of ['cjs', 'mjs']) {
      write(
        consumer,
        `consumer.${extension}`,
        `${
          extension === 'cjs'
            ? `require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { PublishedModule, PublishedService } = require('${library}');
const { message } = require('${library}/secondary');`
            : `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PublishedModule, PublishedService } from '${library}';
import { message } from '${library}/secondary';`
        }
async function main() {
  const app = await NestFactory.createApplicationContext(PublishedModule, { logger: false });
  try { console.log(JSON.stringify([app.get(PublishedService).value(), message()])); }
  finally { await app.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
`
      );
      expect(
        JSON.parse(command(consumer, node, [`consumer.${extension}`], node))
      ).toEqual(['Nest v12 fixture', 'Nest v12 fixture']);
      write(
        consumer,
        `types.${extension === 'cjs' ? 'cts' : 'mts'}`,
        `import { PublishedService } from '${library}';
import { message } from '${library}/secondary';
const text: string = new PublishedService().value() + message();
void text;
// @ts-expect-error exported declaration must retain its string return type
const invalid: number = message();
void invalid;
`
      );
    }
    write(consumer, 'tsconfig.json', {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['types.cts', 'types.mts'],
    });
    // Keep build orchestration outside the runtime-only consumer.
    write(root, 'tools/types/project.json', {
      name: 'packed-types',
      targets: {
        check: {
          command: `${JSON.stringify(node)} ${JSON.stringify(
            join(consumer, 'node_modules/typescript/bin/tsc')
          )} -p ${JSON.stringify(join(consumer, 'tsconfig.json'))}`,
          cache: false,
        },
      },
    });
    nx(root, 'run', 'packed-types:check', '--output-style=static');
    expect(
      command(
        consumer,
        node,
        [
          '-e',
          "try { require.resolve('nx'); process.exit(1); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }",
        ],
        node
      )
    ).toBe('');
    expect(snapshotFiles(installed)).toEqual(
      Object.fromEntries(
        Object.entries(authoredFiles(root)).filter(
          ([path]) => path === 'package.json' || path.startsWith('dist/')
        )
      )
    );
    // Adopt tooling in the same standalone consumer only after proving the
    // packed library runs without Nx. The artifact stays a normal dependency.
    const packedBefore = snapshotFiles(installed);
    prepare(consumer, {
      ...json(consumer, 'package.json'),
      peerDependencies: {
        '@nestjs/common': '^11 || ^12',
        '@nestjs/core': '^11 || ^12',
      },
      nx: {
        name: 'standalone-host',
        targets: { check: { command: 'tsc -p tsconfig.json', cache: false } },
      },
    });
    adopt(consumer, 'standalone-host:check');
    expect(snapshotFiles(installed)).toEqual(packedBefore);
  }, 480_000);

  it('preserves an existing library build beside native Nest owner and member tasks in a fresh mixed monorepo', () => {
    const root = join(suite.root, 'mixed');
    writePublishableLibrary(root, 'tsc');
    const native = fixtures[3];
    for (const [path, value] of Object.entries(native.files))
      write(root, `packages/api/${path}`, value);
    write(root, 'packages/api/package.json', {
      name: 'api',
      private: true,
      type: 'commonjs',
      dependencies: {
        [library]: `file:${tarball}`,
        ...framework,
        '@nestjs/platform-express': '12.1.2',
      },
    });
    write(root, 'packages/api/apps/api/project.json', { name: 'api-app' });
    write(root, 'packages/api/libs/shared/project.json', {
      name: 'api-internal',
    });
    write(root, 'packages/api/libs/shared/tsconfig.lib.json', {
      extends: '../../tsconfig.json',
      compilerOptions: { rootDir: '../..' },
      include: ['src/**/*.ts'],
    });
    write(
      root,
      'packages/api/apps/api/src/app.module.ts',
      `import { Controller, Get, Module } from '@nestjs/common';
import { PublishedModule, PublishedService } from '${library}';
@Controller() class AppController {
  constructor(private readonly service: PublishedService) {}
  @Get() hello() { return { message: this.service.value() }; }
}
@Module({ imports: [PublishedModule], controllers: [AppController] })
export class AppModule {}
`
    );
    prepare(root, { workspaces: ['packages/*', 'libs/*'] });
    const beforeTargets = json(root, 'libs/published/project.json').targets;
    adopt(root, `${library}:build`);
    expect(
      JSON.parse(nx(root, 'show', 'project', library, '--json')).targets.build
    ).toMatchObject(beforeTargets.build);
    for (const project of ['api', 'api-app', 'api-internal'])
      nx(root, 'run', `${project}:build`, '--output-style=static');
    const appPackage = command(
      root,
      node,
      [
        '-e',
        "console.log(require.resolve('@fixture/published', { paths: ['./packages/api'] }))",
      ],
      node
    ).trim();
    expect(appPackage).toContain('node_modules');
    expect(realpathSync(appPackage)).not.toContain(
      join(root, 'libs/published')
    );
    // A one-shot native start still goes through the inferred Nest start target.
    // Closing the application context avoids fixed ports/background daemons.
    write(
      root,
      'packages/api/apps/api/src/main.ts',
      `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PublishedService } from '${library}';
async function main() {
 const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
 try { console.log('PACKED_RESULT=' + app.get(PublishedService).value()); }
 finally { await app.close(); }
}
void main();
`
    );
    for (const project of ['api', 'api-app'])
      expect(
        nx(root, 'run', `${project}:start`, '--output-style=static')
      ).toContain('PACKED_RESULT=Nest v12 fixture');

    if (laneName === 'node24') {
      const manifestPath = 'libs/published/package.json';
      const original = json(root, manifestPath);
      const reject = (diagnostic: RegExp) => {
        const before = authoredFiles(root);
        const installed = snapshotFiles(dirname(dirname(appPackage)));
        const installState = readFileSync(
          join(root, 'node_modules/.yarn-state.yml'),
          'utf8'
        );
        for (const args of [['--dry-run'], []]) {
          expect(() => init(root, ...args)).toThrow(diagnostic);
          expect(authoredFiles(root)).toEqual(before);
          expect(snapshotFiles(dirname(dirname(appPackage)))).toEqual(
            installed
          );
          expect(
            readFileSync(join(root, 'node_modules/.yarn-state.yml'), 'utf8')
          ).toBe(installState);
        }
      };
      for (const peers of [
        '^10 || ^12',
        '^11',
        '^12 || ^13',
        '*',
        '^11 || >=12.2 <13',
      ]) {
        write(root, manifestPath, {
          ...original,
          peerDependencies: { '@nestjs/common': peers, '@nestjs/core': peers },
        });
        reject(/libs\/published\/package.json.*@nestjs\/common/s);
      }
      write(root, manifestPath, original);
      const common = join(root, 'node_modules/@nestjs/common');
      renameSync(common, `${common}.saved`);
      try {
        reject(/no installed package could be resolved/);
      } finally {
        renameSync(`${common}.saved`, common);
      }
      // Damaged nearer evidence must not silently fall back to healthy root v12.
      write(
        root,
        'libs/published/node_modules/@nestjs/common/package.json',
        '{ broken'
      );
      reject(
        /Cannot read installed @nestjs\/common.*Repair the workspace install/s
      );
      rmSync(join(root, 'libs/published/node_modules'), {
        recursive: true,
        force: true,
      });
      // Install a real older framework into an isolated nested package, then
      // expose that installation as nearer evidence without editing its bytes.
      const older = join(suite.root, 'older');
      write(older, 'package.json', {
        name: 'older-host',
        private: true,
        packageManager,
        dependencies: {
          '@nestjs/common': '11.1.0',
          'reflect-metadata': '0.2.2',
          rxjs: '7.8.2',
        },
      });
      write(
        older,
        '.yarnrc.yml',
        'nodeLinker: node-modules\nenableScripts: false\n'
      );
      install(older);
      renameSync(
        join(older, 'node_modules'),
        join(root, 'libs/published/node_modules')
      );
      expect(
        json(root, 'libs/published/node_modules/@nestjs/common/package.json')
          .version
      ).toBe('11.1.0');
      reject(/installed 11.1.0/);
      renameSync(common, `${common}.saved`);
      renameSync(
        join(root, 'libs/published/node_modules/@nestjs/common'),
        common
      );
      try {
        reject(/package.json.*installed 11.1.0/s);
      } finally {
        renameSync(
          common,
          join(root, 'libs/published/node_modules/@nestjs/common')
        );
        renameSync(`${common}.saved`, common);
      }
      rmSync(join(root, 'libs/published/node_modules'), { recursive: true });
      expect(existsSync(common)).toBe(true);
    }
  }, 480_000);
}
