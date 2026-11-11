// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { consumerEnvironment } from '../consumer-environment';
import { fixtures } from '../fixtures';
import {
  dependencies,
  nx,
  packageRoot,
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

describe('published library peers with a selected Nest 12 host', () => {
  const suite = usePackedPlugin();

  it.each(['^11 || ^12', '^11.0.0 || ^12.0.0', '>=11 <13', '^12.0.0'])(
    'loads a packed library with %s peers on Nest 12 before testing init',
    (peers) => {
      const root = suite.createWorkspace({
        ...fixtures[0],
        name: `published-peers-${peers.replace(/\W/g, '-')}`,
      });
      try {
        writeLibrary(root, peers);
        if (peers === '>=11 <13') {
          // Exercise an actual project-local layout as well as root hoisting.
          mkdirSync(join(root, 'libs/node_modules/@nestjs'), {
            recursive: true,
          });
          for (const name of ['@nestjs/common', '@nestjs/core'])
            symlinkSync(
              packageRoot(name),
              join(root, 'libs/node_modules', name),
              'junction'
            );
        }
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

        nx(root, [...init, '--dry-run']);
        expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(nxBefore);
        nx(root, init);
        expect(
          JSON.parse(readFileSync(join(root, 'nx.json'), 'utf8')).plugins
        ).toContain('@anarchitects/nest/plugin');
        const registered = readFileSync(join(root, 'nx.json'), 'utf8');
        nx(root, init);
        expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(registered);

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

  it('initializes a publishable root retaining dual peers and stable v12 development dependencies', () => {
    const root = suite.createWorkspace({
      ...fixtures[0],
      name: 'publishable-root',
    });
    try {
      const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8')
      );
      write(root, 'package.json', {
        ...manifest,
        private: false,
        devDependencies: manifest.dependencies,
        dependencies: {},
        peerDependencies: {
          '@nestjs/common': '^11 || ^12',
          '@nestjs/core': '^11 || ^12',
        },
      });
      const before = readFileSync(join(root, 'package.json'), 'utf8');
      const init = ['generate', '@anarchitects/nest:init', '--no-interactive'];
      nx(root, init);
      const registered = readFileSync(join(root, 'nx.json'), 'utf8');
      expect(JSON.parse(registered).plugins).toContain(
        '@anarchitects/nest/plugin'
      );
      nx(root, init);
      expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(registered);
      expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    { label: 'nested-v11', version: '11.1.0', diagnostic: 'installed 11.1.0' },
    { label: 'nested-v10', version: '10.4.0', diagnostic: 'installed 10.4.0' },
    { label: 'nested-v13', version: '13.0.0', diagnostic: 'installed 13.0.0' },
    {
      label: 'nested-prerelease',
      version: '12.1.2-beta.1',
      diagnostic: 'installed 12.1.2-beta.1',
    },
    {
      label: 'peer-excludes-host',
      peers: '^11 || >=12.2 <13',
      diagnostic: 'installed 12.1.2',
    },
    {
      label: 'unsupported-peers',
      peers: '^10 || ^12',
      diagnostic: 'not a supported library peer range',
    },
    {
      label: 'missing-install',
      missing: true,
      diagnostic: 'no installed package could be resolved',
    },
    {
      label: 'conflicting-declaration',
      conflicting: true,
      diagnostic: '(dependencies): @nestjs/common@^11',
    },
  ])(
    'rejects $label before normal or dry-run mutation',
    ({ label, version, peers, missing, conflicting, diagnostic }) => {
      const root = suite.createWorkspace({ ...fixtures[0], name: label });
      try {
        writeLibrary(root, peers ?? '^11 || ^12');
        if (version)
          write(
            root,
            `${libraryPath}/node_modules/@nestjs/common/package.json`,
            {
              name: '@nestjs/common',
              version,
            }
          );
        if (missing) rmSync(join(root, 'node_modules/@nestjs/common'));
        if (conflicting) {
          const manifest = JSON.parse(
            readFileSync(join(root, libraryPath, 'package.json'), 'utf8')
          );
          manifest.dependencies = { '@nestjs/common': '^11' };
          write(root, `${libraryPath}/package.json`, manifest);
        }
        const before = snapshotFiles(join(root, libraryPath));
        const nxBefore = readFileSync(join(root, 'nx.json'), 'utf8');
        const packageBefore = readFileSync(join(root, 'package.json'), 'utf8');
        for (const extra of [['--dry-run'], []]) {
          expect(() =>
            nx(root, [
              'generate',
              '@anarchitects/nest:init',
              '--no-interactive',
              ...extra,
            ])
          ).toThrow(diagnostic);
          expect(readFileSync(join(root, 'nx.json'), 'utf8')).toBe(nxBefore);
          expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(
            packageBefore
          );
          expect(snapshotFiles(join(root, libraryPath))).toEqual(before);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
