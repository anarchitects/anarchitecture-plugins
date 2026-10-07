// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
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
    })) {
      const destination = join(consumerRoot, 'node_modules', dependency);
      mkdirSync(dirname(destination), { recursive: true });
      symlinkSync(
        dirname(require.resolve(`${dependency}/package.json`)),
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
