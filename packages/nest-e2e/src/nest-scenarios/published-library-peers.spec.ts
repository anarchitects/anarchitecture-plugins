// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { consumerEnvironment } from '../consumer-environment';
import { fixtures } from '../fixtures';
import {
  dependencies,
  nx,
  snapshotFiles,
  usePackedPlugin,
  write,
} from '../packed-plugin';

const libraryName = '@fixture/published-nest-library';
const libraryPath = 'libs/published-nest-library';

/** Original, precompiled library fixture; no native Nest templates are copied. */
function writeLibrary(root: string, peers: string) {
  write(root, `${libraryPath}/package.json`, {
    name: libraryName,
    version: '1.0.0',
    type: 'commonjs',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    },
    files: ['dist'],
    peerDependencies: { '@nestjs/common': peers, '@nestjs/core': peers },
  });
  write(root, `${libraryPath}/project.json`, {
    name: 'published-nest-library',
    targets: {
      build: {
        executor: 'nx:run-commands',
        cache: true,
        inputs: [
          '{projectRoot}/src/**/*.ts',
          '{projectRoot}/tsconfig.lib.json',
          '{projectRoot}/package.json',
          '{workspaceRoot}/yarn.lock',
          { runtime: 'node --version' },
        ],
        outputs: ['{projectRoot}/dist'],
        options: {
          command: 'tsc -p tsconfig.lib.json',
          cwd: libraryPath,
        },
      },
    },
  });
  write(root, `${libraryPath}/tsconfig.lib.json`, {
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
      rootDir: 'src',
      outDir: 'dist',
      declaration: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      skipLibCheck: true,
      types: ['node'],
    },
    include: ['src/**/*.ts'],
  });
  write(
    root,
    `${libraryPath}/src/index.ts`,
    `import { Injectable, Module } from '@nestjs/common';
@Injectable()
export class GreetingService {
  message(): string { return 'published library on Nest 12'; }
}
@Module({ providers: [GreetingService], exports: [GreetingService] })
export class LibraryModule {}
`
  );
}

function packLibrary(root: string): string {
  nx(root, ['run', 'published-nest-library:build', '--output-style=static']);
  const [pack] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', root],
      {
        cwd: join(root, libraryPath),
        env: {
          ...consumerEnvironment(root),
          npm_config_cache: join(root, '.npm'),
        },
        encoding: 'utf8',
        timeout: 30_000,
      }
    )
  );
  expect(pack.files.map((file: { path: string }) => file.path).sort()).toEqual([
    'dist/index.d.ts',
    'dist/index.js',
    'package.json',
  ]);
  const installed = join(root, 'node_modules', libraryName);
  mkdirSync(installed, { recursive: true });
  execFileSync('tar', [
    '-xzf',
    join(root, pack.filename),
    '-C',
    installed,
    '--strip-components=1',
  ]);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  manifest.dependencies[libraryName] = `file:./${pack.filename}`;
  write(root, 'package.json', manifest);
  expect(readFileSync(join(installed, 'package.json'), 'utf8')).toBe(
    readFileSync(join(root, libraryPath, 'package.json'), 'utf8')
  );
  return installed;
}

function assertRuntime(root: string) {
  write(
    root,
    'consumer.cjs',
    `require('reflect-metadata');
const { readFileSync, existsSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { LibraryModule, GreetingService } = require('${libraryName}');
function installedVersion(name) {
  // Some Nest exports do not expose package.json as a public subpath.
  try { return require(name + '/package.json').version; } catch {}
  let directory = dirname(require.resolve(name));
  while (dirname(directory) !== directory) {
    const path = join(directory, 'package.json');
    if (existsSync(path)) {
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      if (manifest.name === name) return manifest.version;
    }
    directory = dirname(directory);
  }
  throw new Error('Cannot read resolved version of ' + name);
}
async function run() {
  const app = await NestFactory.createApplicationContext(LibraryModule, { logger: false });
  try {
    console.log(JSON.stringify({
      message: app.get(GreetingService).message(),
      versions: Object.fromEntries(['@nestjs/cli', '@nestjs/common', '@nestjs/core'].map(
        name => [name, installedVersion(name)]
      )),
    }));
  } finally { await app.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
`
  );
  const result = JSON.parse(
    execFileSync(process.execPath, ['consumer.cjs'], {
      cwd: root,
      env: consumerEnvironment(root),
      encoding: 'utf8',
      timeout: 30_000,
    })
  );
  expect(result).toEqual({
    message: 'published library on Nest 12',
    versions: {
      '@nestjs/cli': dependencies['@nestjs/cli'],
      '@nestjs/common': dependencies['@nestjs/common'],
      '@nestjs/core': dependencies['@nestjs/core'],
    },
  });
  for (const version of Object.values(result.versions))
    expect(version).toMatch(/^12\.\d+\.\d+$/);
}

describe('published library peers: current init rejection (#593)', () => {
  const suite = usePackedPlugin();

  it.each(['^11 || ^12', '^11.0.0 || ^12.0.0', '^12.0.0'])(
    'loads a packed library with %s peers on Nest 12 before testing init',
    (peers) => {
      const root = suite.createWorkspace({
        ...fixtures[0],
        name: `published-peers-${peers.replace(/\W/g, '-')}`,
      });
      try {
        writeLibrary(root, peers);
        const installed = packLibrary(root);
        assertRuntime(root);
        const libraryBefore = snapshotFiles(join(root, libraryPath));
        const installedBefore = snapshotFiles(installed);
        const paths = [
          'package.json',
          'yarn.lock',
          'consumer.cjs',
          ...Object.keys(fixtures[0].files),
        ];
        const before = paths.map((path) =>
          readFileSync(join(root, path), 'utf8')
        );
        const nxBefore = readFileSync(join(root, 'nx.json'), 'utf8');
        const init = [
          'generate',
          '@anarchitects/nest:init',
          '--no-interactive',
        ];

        if (peers === '^12.0.0') {
          nx(root, init);
          expect(
            JSON.parse(readFileSync(join(root, 'nx.json'), 'utf8')).plugins
          ).toContain('@anarchitects/nest/plugin');
          const registered = readFileSync(join(root, 'nx.json'), 'utf8');
          nx(root, init);
          expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(registered);
        } else {
          // Characterization only: #594 must replace rejection with acceptance.
          // Both dry-run and normal init must fail for the peer, without edits.
          for (const args of [[...init, '--dry-run'], init]) {
            expect(() => nx(root, args)).toThrow(
              `${libraryPath}/package.json (peerDependencies): @nestjs/common@${peers} is not a stable Nest v12 range`
            );
            expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(nxBefore);
          }
        }

        expect(
          paths.map((path) => readFileSync(join(root, path), 'utf8'))
        ).toEqual(before);
        expect(snapshotFiles(join(root, libraryPath))).toEqual(libraryBefore);
        expect(snapshotFiles(installed)).toEqual(installedBefore);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
