// SPDX-License-Identifier: MIT
import type { ProjectGraph } from '@nx/devkit';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { consumerEnvironment } from './consumer-environment';
import { fixtures } from './fixtures';
import {
  assertStarts,
  nx,
  packageRoot,
  snapshotFiles,
  usePackedPlugin,
  write,
} from './packed-plugin';

const library = '@fixture/published';
const libraryRoot = 'libs/published';
const owner = 'packages/api';
type BuildStyle = 'tsc' | 'custom';

/** Existing publishable packages are original fixtures, not generator defaults. */
function writeLibrary(root: string, style: BuildStyle) {
  const entry = (name: string) =>
    style === 'tsc'
      ? { types: `./dist/${name}.d.ts`, default: `./dist/${name}.js` }
      : {
          import: {
            types: `./output/esm/${name}.d.ts`,
            default: `./output/esm/${name}.js`,
          },
          require: {
            types: `./output/cjs/${name}.d.ts`,
            default: `./output/cjs/${name}.js`,
          },
        };
  write(root, `${libraryRoot}/package.json`, {
    name: library,
    version: '0.0.1',
    type: 'commonjs',
    exports: { '.': entry('index'), './secondary': entry('secondary') },
    files: [style === 'tsc' ? 'dist' : 'output'],
    peerDependencies: {
      '@nestjs/common': '^11 || ^12',
      '@nestjs/core': '^11 || ^12',
    },
  });
  write(root, `${libraryRoot}/tsconfig.lib.json`, {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      rootDir: 'src',
      outDir: style === 'tsc' ? 'dist' : 'output/cjs',
      declaration: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      skipLibCheck: true,
      types: [],
    },
    include: ['src/**/*.ts'],
  });
  write(
    root,
    `${libraryRoot}/src/secondary.ts`,
    "export const message = (): string => 'Nest v12 fixture';\n"
  );
  write(
    root,
    `${libraryRoot}/src/index.ts`,
    `import { Injectable, Module } from '@nestjs/common';
import { message } from './secondary.js';
@Injectable()
export class PublishedService { value(): string { return message(); } }
@Module({ providers: [PublishedService], exports: [PublishedService] })
export class PublishedModule {}
`
  );
  if (style === 'custom') {
    write(root, `${libraryRoot}/tsconfig.esm.json`, {
      extends: './tsconfig.lib.json',
      compilerOptions: {
        module: 'ES2022',
        moduleResolution: 'Bundler',
        outDir: 'output/esm',
      },
    });
    write(
      root,
      `${libraryRoot}/build.cjs`,
      `const { execFileSync } = require('node:child_process');
const { writeFileSync, rmSync } = require('node:fs');
rmSync('output', { recursive: true, force: true });
for (const config of ['tsconfig.lib.json', 'tsconfig.esm.json']) {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
}
writeFileSync('output/esm/package.json', JSON.stringify({ type: 'module' }));
writeFileSync('output/cjs/package.json', JSON.stringify({ type: 'commonjs' }));
`
    );
  }
  write(root, `${libraryRoot}/project.json`, {
    name: library,
    projectType: 'library',
    sourceRoot: `${libraryRoot}/src`,
    targets: {
      build: {
        executor: style === 'tsc' ? '@nx/js:tsc' : 'nx:run-commands',
        cache: true,
        inputs: [
          'production',
          '^production',
          '{workspaceRoot}/yarn.lock',
          { runtime: 'node --version' },
        ],
        outputs: [
          style === 'tsc' ? '{projectRoot}/dist' : '{projectRoot}/output',
        ],
        options:
          style === 'tsc'
            ? {
                main: `${libraryRoot}/src/index.ts`,
                rootDir: `${libraryRoot}/src`,
                tsConfig: `${libraryRoot}/tsconfig.lib.json`,
                outputPath: `${libraryRoot}/dist`,
                generatePackageJson: false,
              }
            : { command: 'node build.cjs', cwd: libraryRoot },
      },
      'nx-release-publish': {
        executor: '@nx/js:release-publish',
        cache: false,
        options: { packageRoot: libraryRoot },
      },
    },
  });
}

function pack(root: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  const [result] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', destination],
      {
        cwd: join(root, libraryRoot),
        env: {
          ...consumerEnvironment(root),
          npm_config_cache: join(root, '.npm'),
        },
        encoding: 'utf8',
        timeout: 30_000,
      }
    )
  );
  const files: string[] = result.files.map(
    (file: { path: string }) => file.path
  );
  expect(files).toContain('package.json');
  expect(files.some((file) => file.startsWith('src/'))).toBe(false);
  expect(files.some((file) => file.includes('node_modules'))).toBe(false);
  const installed = join(destination, 'node_modules', library);
  rmSync(installed, { recursive: true, force: true });
  mkdirSync(installed, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    join(destination, result.filename),
    '-C',
    installed,
    '--strip-components=1',
  ]);
  return installed;
}

/** A sibling consumer has only the tarball and framework links, never Nx. */
function assertPackedConsumer(
  root: string,
  destination: string,
  expected: string
) {
  const installed = pack(root, destination);
  for (const name of [
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
  ]) {
    const target = join(destination, 'node_modules', name);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) symlinkSync(packageRoot(name), target, 'junction');
  }
  for (const extension of ['cjs', 'mjs']) {
    const imports =
      extension === 'cjs'
        ? `require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { PublishedModule, PublishedService } = require('${library}');
const { message } = require('${library}/secondary');`
        : `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PublishedModule, PublishedService } from '${library}';
import { message } from '${library}/secondary';`;
    write(
      destination,
      `consumer.${extension}`,
      `${imports}
async function run() {
  const app = await NestFactory.createApplicationContext(PublishedModule, { logger: false });
  try { console.log(JSON.stringify([app.get(PublishedService).value(), message()])); }
  finally { await app.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
`
    );
    const output = execFileSync(process.execPath, [`consumer.${extension}`], {
      cwd: destination,
      env: consumerEnvironment(destination),
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(JSON.parse(output)).toEqual([expected, expected]);
    write(
      destination,
      `types.${extension === 'cjs' ? 'cts' : 'mts'}`,
      `import { PublishedService } from '${library}';
import { message } from '${library}/secondary';
const text: string = new PublishedService().value() + message();
void text;
// @ts-expect-error public declaration must preserve string return type
const invalid: number = message();
void invalid;
`
    );
  }
  write(destination, 'tsconfig.json', {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
    include: ['types.cts', 'types.mts'],
  });
  // Run type validation through an existing Nx task in the build workspace.
  nx(root, ['run', 'packed-types:check', '--output-style=static']);
  const manifest = JSON.parse(
    readFileSync(join(installed, 'package.json'), 'utf8')
  );
  for (const section of [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ])
    expect(
      Object.keys(manifest[section] ?? {}).some(
        (name) =>
          name === 'nx' ||
          name.startsWith('@nx/') ||
          name.startsWith('@anarchitects/')
      )
    ).toBe(false);
  const resolveNx = execFileSync(
    process.execPath,
    [
      '-e',
      "try { require.resolve('nx'); process.exit(1); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }",
    ],
    {
      cwd: destination,
      env: consumerEnvironment(destination),
      encoding: 'utf8',
      timeout: 10_000,
    }
  );
  expect(resolveNx).toBe('');
  return snapshotFiles(installed);
}

export function publishedBuildScenario(style: BuildStyle) {
  const suite = usePackedPlugin();
  it(`preserves ${style} publication while native owners and members build compiled dependencies`, async () => {
    const native = fixtures[3];
    const root = suite.createWorkspace({
      ...native,
      name: 'api',
      root: owner,
      moduleType: style === 'tsc' ? 'commonjs' : 'module',
      files: Object.fromEntries(
        Object.entries(native.files).map(([path, value]) => [
          `${owner}/${path}`,
          value,
        ])
      ),
    });
    const consumer = join(suite.root, `packed-${style}`);
    const read = (path: string) => readFileSync(join(root, path), 'utf8');
    const json = (path: string) => JSON.parse(read(path));
    const graph = (): ProjectGraph => {
      nx(root, ['graph', '--file', join(root, '.nx/graph.json')]);
      return json('.nx/graph.json').graph;
    };
    const build = (target = 'api:build') =>
      nx(root, ['run', target, '--output-style=static']);
    try {
      writeLibrary(root, style);
      write(root, '.gitignore', read('.gitignore') + 'output\n.npm\n');
      write(root, 'package.json', {
        ...json('package.json'),
        workspaces: ['packages/*', 'libs/*'],
      });
      write(root, `${owner}/package.json`, {
        ...json(`${owner}/package.json`),
        dependencies: { [library]: '0.0.1' },
      });
      // Controlled linked-install fixture, mirroring the existing harness. The
      // independent consumer below loads an extracted tarball, not this link.
      mkdirSync(join(root, 'node_modules/@fixture'), { recursive: true });
      symlinkSync(
        join(root, libraryRoot),
        join(root, 'node_modules', library),
        'junction'
      );
      write(root, `${owner}/apps/api/project.json`, {
        name: 'api-app',
        projectType: 'application',
      });
      write(root, `${owner}/libs/shared/project.json`, {
        name: 'api-internal',
        projectType: 'library',
      });
      write(root, `${owner}/libs/shared/tsconfig.lib.json`, {
        ...json(`${owner}/libs/shared/tsconfig.lib.json`),
        compilerOptions: { rootDir: '../..' },
      });
      write(
        root,
        `${owner}/apps/api/src/app.module.ts`,
        `import { Controller, Get, Module } from '@nestjs/common';
import { PublishedModule, PublishedService } from '${library}';
import { message } from '${library}/secondary';
@Controller()
class AppController {
  constructor(private readonly service: PublishedService) {}
  @Get() hello() {
    if (this.service.value() !== message()) throw new Error('Mismatched exports');
    return { message: this.service.value() };
  }
}
@Module({ imports: [PublishedModule], controllers: [AppController] })
export class AppModule {}
`
      );
      write(root, 'tools/packed-types/project.json', {
        name: 'packed-types',
        targets: {
          check: {
            command: `tsc -p ${JSON.stringify(
              join(consumer, 'tsconfig.json')
            )}`,
            cache: false,
          },
        },
      });
      const beforeGraph = graph();
      build(`${library}:build`);
      const packedBefore = assertPackedConsumer(
        root,
        consumer,
        'Nest v12 fixture'
      );
      const libraryBefore = snapshotFiles(join(root, libraryRoot));
      const ownerBefore = snapshotFiles(join(root, owner));
      const rootBefore = [read('package.json'), read('yarn.lock')];
      const init = ['g', '@anarchitects/nest:init', '--no-interactive'];
      const nxBefore = read('nx.json');
      nx(root, [...init, '--dry-run']);
      expect(read('nx.json')).toBe(nxBefore);
      nx(root, init);
      const initialized = read('nx.json');
      nx(root, init);
      expect(read('nx.json')).toBe(initialized);
      expect(snapshotFiles(join(root, libraryRoot))).toEqual(libraryBefore);
      expect(snapshotFiles(join(root, owner))).toEqual(ownerBefore);
      expect([read('package.json'), read('yarn.lock')]).toEqual(rootBefore);
      const after = graph();
      expect(after.nodes[library].data.targets).toEqual(
        beforeGraph.nodes[library].data.targets
      );
      expect(after.nodes[library].data.targets?.start).toBeUndefined();
      expect(existsSync(join(root, libraryRoot, 'nest-cli.json'))).toBe(false);
      for (const name of ['api', 'api-app', 'api-internal']) {
        expect(after.nodes[name].data.targets?.build).toMatchObject({
          cache: true,
          dependsOn: ['^build'],
          inputs: expect.arrayContaining(['^production']),
        });
      }
      expect(after.nodes['api-internal'].data.targets?.start).toBeUndefined();
      expect(after.nodes['api-app'].data.targets?.start).toMatchObject({
        continuous: true,
        cache: false,
      });
      expect(after.dependencies['api-app']).toContainEqual(
        expect.objectContaining({ target: library, type: 'static' })
      );
      expect(after.dependencies.api).toContainEqual(
        expect.objectContaining({ target: library, type: 'static' })
      );

      // Prove the task edge schedules/restores the compiled library first.
      nx(root, [
        'run',
        'api-app:build',
        '--graph',
        join(root, '.nx/tasks.json'),
      ]);
      expect(
        json('.nx/tasks.json').tasks.dependencies['api-app:build']
      ).toContainEqual({ id: `${library}:build` });
      const output = style === 'tsc' ? 'dist' : 'output';
      rmSync(join(root, libraryRoot, output), { recursive: true });
      build('api-app:build');
      const memberOutput = snapshotFiles(join(root, owner, 'dist'));
      expect(Object.keys(memberOutput)).toContain('apps/api/src/main.js');
      build('api-internal:build');
      build();
      await assertStarts(root, 'api-app:start');
      await assertStarts(root, 'api:start');
      nx(root, [
        'run',
        `${library}:build`,
        '--skipNxCache',
        '--output-style=static',
      ]);
      expect(assertPackedConsumer(root, consumer, 'Nest v12 fixture')).toEqual(
        packedBefore
      );
      rmSync(join(root, owner, 'dist'), { recursive: true });
      rmSync(join(root, libraryRoot, output), { recursive: true });
      expect(build('api-app:build')).toMatch(/api-app:build\s+\[local cache/);
      expect(snapshotFiles(join(root, libraryRoot))).toEqual(libraryBefore);
      expect(snapshotFiles(join(root, owner, 'dist'))).toEqual(memberOutput);

      write(
        root,
        `${libraryRoot}/src/secondary.ts`,
        "export const message = (): string => 'updated published library';\n"
      );
      expect(build('api-app:build')).not.toMatch(
        /api-app:build\s+\[local cache/
      );
      assertPackedConsumer(root, consumer, 'updated published library');
      await assertStarts(root, 'api-app:start', 'updated published library');
      // Configuration edits must also invalidate the consumer's dependency input.
      write(root, `${libraryRoot}/tsconfig.lib.json`, {
        ...json(`${libraryRoot}/tsconfig.lib.json`),
        compilerOptions: {
          ...json(`${libraryRoot}/tsconfig.lib.json`).compilerOptions,
          removeComments: true,
        },
      });
      expect(build('api-app:build')).not.toMatch(
        /api-app:build\s+\[local cache/
      );
      // Renamed Nest targets deliberately retain the documented ^compile
      // default. Consumers of precompiled packages explicitly connect ^build.
      const memberPath = `${owner}/apps/api/project.json`;
      write(root, memberPath, {
        ...json(memberPath),
        targets: { compile: { dependsOn: ['^build'] } },
      });
      nx(root, [
        ...init,
        '--buildTargetName=compile',
        '--startTargetName=serve',
      ]);
      const renamed = graph();
      expect(renamed.nodes[library].data.targets).toEqual(
        beforeGraph.nodes[library].data.targets
      );
      expect(renamed.nodes['api-app'].data.targets?.compile).toMatchObject({
        dependsOn: ['^build'],
        cache: true,
        inputs: expect.arrayContaining(['^production']),
      });
      expect(renamed.nodes['api-app'].data.targets?.build).toBeUndefined();
      rmSync(join(root, libraryRoot, output), { recursive: true });
      build('api-app:compile');
      assertPackedConsumer(root, consumer, 'updated published library');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);
}
