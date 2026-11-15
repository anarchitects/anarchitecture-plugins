// SPDX-License-Identifier: MIT
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { consumerLanes } from './packed-library-consumer';
import { consumerEnvironment } from './consumer-environment';
import { createInstalledConsumer } from './installed-consumer';
import { usePackedPlugin } from './packed-plugin';
import { assertHttp } from './rspack-consumer';

const adapters = {
  node: 'NodeAdapter',
  express: 'ExpressAdapter',
  fastify: 'FastifyAdapter',
} as const;
type Platform = keyof typeof adapters;
const platforms = Object.keys(adapters) as Platform[];

/** One scenario body for every adapter, module format and installed toolchain. */
export function httpConsumerMatrix(
  laneName: keyof typeof consumerLanes,
  manager: 'yarn' | 'npm' = 'yarn'
) {
  const lane = consumerLanes[laneName];
  const suite = usePackedPlugin();
  let node: string;
  let npmBinDirectory: string | undefined;
  beforeAll(() => {
    node = execFileSync(
      'npm',
      [
        'exec',
        '--yes',
        `--package=node@${lane.node}`,
        '--',
        'node',
        '-p',
        'process.execPath',
      ],
      {
        cwd: suite.root,
        env: consumerEnvironment(suite.root),
        encoding: 'utf8',
        timeout: 180_000,
      }
    ).trim();
    expect(execFileSync(node, ['--version'], { encoding: 'utf8' }).trim()).toBe(
      `v${lane.node}`
    );
    if (manager === 'npm') {
      // Pin the CLI too: a Node installation's bundled npm differs across CI hosts.
      npmBinDirectory = execFileSync(
        'npm',
        [
          'exec',
          '--yes',
          '--package=npm@11.19.1',
          '--',
          'node',
          '-p',
          `
        const fs=require('node:fs'),p=require('node:path');
        process.env.PATH.split(p.delimiter).find(dir=>fs.existsSync(p.resolve(dir,'../npm/bin/npm-cli.js')))
      `,
        ],
        {
          cwd: suite.root,
          env: consumerEnvironment(suite.root),
          encoding: 'utf8',
          timeout: 180_000,
        }
      ).trim();
      if (!npmBinDirectory || npmBinDirectory === 'undefined')
        throw new Error('Cannot locate pinned npm executable');
    }
  }, 240_000);

  it.each(
    platforms.flatMap((platform) =>
      ['esm', 'cjs'].map((type) => ({ platform, type }))
    )
  )(
    `${laneName}/${manager}: runs $platform $type applications and mixed members`,
    async ({ platform, type }) => {
      const root = join(
        suite.root,
        `${laneName}-${manager}-${platform}-${type}`
      );
      const {
        yarn: run,
        env,
        lockName,
      } = createInstalledConsumer(root, suite.tarball, {
        node,
        nx: lane.nx,
        cli: '12.0.13',
        manager,
        npmBinDirectory,
        resolutionLock: join(
          __dirname,
          'consumer-locks',
          manager === 'yarn'
            ? 'http-yarn.lock'
            : `http-npm-${platform}-${type}.json`
        ),
      });
      const json = (path: string) =>
        JSON.parse(readFileSync(join(root, path), 'utf8'));
      const write = (path: string, data: unknown) => {
        writeFileSync(
          join(root, path),
          typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'
        );
      };
      expect(
        run(['node', '-p', 'process.version'], undefined, true).trim()
      ).toBe(`v${lane.node}`);
      const versionCommand =
        manager === 'yarn'
          ? (['corepack', ['yarn', '--version']] as const)
          : (['npm', ['--version']] as const);
      expect(
        execFileSync(versionCommand[0], [...versionCommand[1]], {
          cwd: root,
          env,
          encoding: 'utf8',
        }).trim()
      ).toBe(manager === 'yarn' ? '4.17.0' : '11.19.1');
      write('nx.json', {
        plugins: ['@anarchitects/nest/plugin'],
        generators: {
          '@anarchitects/nest:application': {
            platform: platforms[(platforms.indexOf(platform) + 1) % 3],
          },
        },
      });
      const observe = laneName === 'node24';
      const generate = [
        'nx',
        'g',
        '@anarchitects/nest:application',
        'api',
        '--directory=packages/api',
        `--type=${type}`,
        `--platform=${platform}`,
        `--packageManager=${manager}`,
        ...(observe ? ['--observe'] : []),
        '--skipInstall',
        '--no-interactive',
      ];
      const initialLock = readFileSync(join(root, lockName), 'utf8');
      run([...generate, '--dry-run']);
      expect(readFileSync(join(root, lockName), 'utf8')).toBe(initialLock);
      run(generate);
      run(['install']);
      const generated = readFileSync(
        join(root, 'packages/api/src/main.ts'),
        'utf8'
      );
      expect(generated).toContain(`new ${adapters[platform]}()`);
      expect(generated.includes('instrument: ObserveInstrument')).toBe(observe);
      run(generate);
      expect(readFileSync(join(root, 'packages/api/src/main.ts'), 'utf8')).toBe(
        generated
      );

      // Exercise an existing root owner as well as nested package owners. Moving
      // the consumer's native app is an explicit fixture setup, not a generator migration.
      let owner = 'packages/api';
      if (laneName === 'node24' && platform === 'fastify' && type === 'esm') {
        const workspace = json('package.json');
        const app = json('packages/api/package.json');
        for (const entry of readdirSync(join(root, owner))) {
          if (entry === 'node_modules' || entry === 'package.json') continue;
          rmSync(join(root, entry), { recursive: true, force: true });
          renameSync(join(root, owner, entry), join(root, entry));
        }
        write('package.json', {
          ...workspace,
          ...app,
          packageManager: workspace.packageManager,
          devDependencies: {
            ...workspace.devDependencies,
            ...app.devDependencies,
          },
        });
        const metadata = json('project.json');
        metadata.sourceRoot = 'src';
        write('project.json', metadata);
        rmSync(join(root, owner), { recursive: true, force: true });
        owner = '';
        run(['install']);
      }
      const at = (file: string) => join(owner, file);
      const read = (file: string) => readFileSync(join(root, at(file)), 'utf8');
      const assertVersions = (selected: Platform[]) => {
        const versions = JSON.parse(
          run(
            [
              'node',
              '-e',
              `
          const {createRequire}=require('node:module'); const {realpathSync}=require('node:fs'); const path=require('node:path');
          const local=createRequire(path.resolve(${JSON.stringify(
            at('package.json')
          )}));
          const names=${JSON.stringify([
            '@nestjs/common',
            '@nestjs/core',
            '@nestjs/testing',
            '@nestjs/platform-express',
            ...selected.map((p) => '@nestjs/platform-' + p),
            '@nestjs/cli',
            '@nestjs/schematics',
            ...(observe ? ['@nestjs/observe'] : []),
            'nx',
            '@nx/devkit',
            'typescript',
          ])};
          console.log(JSON.stringify(Object.fromEntries(names.map(name=>{ const file=local.resolve(name+'/package.json'); if(!realpathSync(file).startsWith(realpathSync(process.cwd())+path.sep)) throw Error('External dependency: '+file); return [name,local(file).version]; }))));
        `,
            ],
            undefined,
            true
          )
        );
        for (const [name, version] of Object.entries(versions))
          expect(version).toBe(
            name === 'nx' || name === '@nx/devkit'
              ? lane.nx
              : name === 'typescript'
              ? '6.0.3'
              : name === '@nestjs/cli' || name === '@nestjs/schematics'
              ? '12.0.13'
              : name === '@nestjs/observe'
              ? '0.3.26'
              : '12.5.0'
          );
        process.stderr.write(
          `[http-matrix] ${JSON.stringify({
            lane: laneName,
            manager,
            node: lane.node,
            type,
            owner: owner || '.',
            observe,
            versions,
          })}\n`
        );
      };
      const identify = (file: string, selected: Platform) => {
        const source = read(file);
        expect(
          source.includes('await app.getHttpAdapter().getInstance().ready();')
        ).toBe(selected === 'fastify');
        write(
          at(file),
          source.replace(
            'await app.init();',
            `await app.init();\n    expect(app.getHttpAdapter().getType()).toBe('${selected}');`
          )
        );
      };
      const verifyRuntimeAdapter = (file: string, selected: Platform) => {
        const source = read(file);
        expect(source.match(/await app\.listen\(/g)).toHaveLength(1);
        write(
          at(file),
          source.replace(
            'await app.listen(',
            `if (app.getHttpAdapter().getType() !== '${selected}') throw new Error('Unexpected HTTP adapter');\n  await app.listen(`
          )
        );
      };
      const test = (members = false) => {
        if (type === 'esm') {
          run(['nx', 'run', 'api:test']);
          run(['nx', 'run', 'api:test:e2e']);
        } else {
          const jest = (args: string[]) => {
            const invoke = () =>
              run(
                [
                  'nx',
                  'exec',
                  '--projects=api',
                  '--',
                  ...(manager === 'yarn'
                    ? ['corepack', 'yarn']
                    : ['npm', 'exec', '--']),
                  'jest',
                  '--runInBand',
                  ...args,
                ],
                '--experimental-vm-modules'
              );
            if (laneName === 'node22') {
              // Jest's require(esm) support needs Node >=24.9. Keep this
              // upstream incompatibility explicit; build/start/lint still run.
              expect(invoke).toThrow(
                /Must use import to load ES Module: .*@nestjs\/testing\/index.js/
              );
              process.stderr.write(
                `[http-matrix-exclusion] ${JSON.stringify({
                  lane: laneName,
                  platform,
                  type,
                  members,
                  test: args.length ? 'http' : 'unit',
                  reason: 'Native CJS Jest cannot require Nest ESM on Node 22',
                })}\n`
              );
            } else invoke();
          };
          jest([]);
          const config = members ? 'http-jest-e2e.json' : 'test/jest-e2e.json';
          if (members)
            write(at(config), {
              ...json(at('apps/api/test/jest-e2e.json')),
              rootDir: '.',
            });
          jest(['--config', config]);
        }
        run(['nx', 'run', 'api:lint']);
      };
      verifyRuntimeAdapter('src/main.ts', platform);
      assertVersions([platform]);
      identify('test/app.e2e-spec.ts', platform);
      run(['nx', 'run', 'api:build']);
      test();
      await assertHttp(root, env, 'api:start', '/', 'Hello World!', manager);
      const originals = {
        main: read('src/main.ts'),
        test: read('test/app.e2e-spec.ts'),
      };
      const member =
        platforms[
          (platforms.indexOf(platform) +
            Object.keys(consumerLanes).indexOf(laneName)) %
            3
        ];
      const config = json('nx.json');
      config.generators = {
        '@anarchitects/nest:sub-app': {
          platform: platforms[(platforms.indexOf(member) + 1) % 3],
        },
      };
      write('nx.json', config);
      mkdirSync(join(root, 'context/caller'), { recursive: true });
      write('context/caller/project.json', {
        name: 'caller',
        generators: {
          '@anarchitects/nest:sub-app': {
            platform:
              type === 'esm'
                ? member
                : platforms[(platforms.indexOf(member) + 2) % 3],
          },
        },
      });
      const add = [
        'nx',
        'g',
        '@anarchitects/nest:app',
        'worker',
        '--project=api',
        ...(type === 'cjs' ? [`--platform=${member}`] : []),
        '--skipInstall',
        '--no-interactive',
      ];
      const previousManifest = read('package.json');
      run(
        [...add, '--dry-run'],
        undefined,
        false,
        join(root, 'context/caller')
      );
      expect(read('package.json')).toBe(previousManifest);
      run(add, undefined, false, join(root, 'context/caller'));
      run(['install']);
      expect(read('apps/api/src/main.ts')).toBe(originals.main);
      expect(read('apps/api/test/app.e2e-spec.ts')).toBe(originals.test);
      expect(read('apps/worker/src/main.ts')).toContain(
        `new ${adapters[member]}()`
      );
      expect(read('apps/worker/src/main.ts')).not.toContain('Observe');
      const next = json(at('package.json'));
      expect(next.dependencies).toMatchObject(
        JSON.parse(previousManifest).dependencies
      );
      assertVersions([platform, member]);
      identify('apps/worker/test/app.e2e-spec.ts', member);
      verifyRuntimeAdapter('apps/worker/src/main.ts', member);
      const unchanged = read('apps/worker/src/main.ts');
      expect(() =>
        run(add, undefined, false, join(root, 'context/caller'))
      ).toThrow(/exists/);
      expect(read('apps/worker/src/main.ts')).toBe(unchanged);
      const bad = {
        ...next,
        dependencies: { ...next.dependencies, '@nestjs/core': '12.3.1' },
      };
      write(at('package.json'), bad);
      expect(() =>
        run([
          'nx',
          'g',
          '@anarchitects/nest:sub-app',
          'invalid',
          '--project=api',
          `--platform=${member}`,
          '--skipInstall',
          '--no-interactive',
        ])
      ).toThrow(/incompatible declaration/);
      expect(json(at('package.json'))).toEqual(bad);
      write(at('package.json'), next);
      const nativeConfig = json('nx.json');
      delete nativeConfig.generators;
      write('nx.json', nativeConfig);
      run([
        'nx',
        'g',
        '@anarchitects/nest:sub-app',
        'native',
        '--project=api',
        '--skipInstall',
        '--no-interactive',
      ]);
      expect(read('apps/native/src/main.ts')).not.toMatch(
        /new (Node|Express|Fastify)Adapter/
      );
      for (const name of ['api-api', 'api-worker']) {
        const project = JSON.parse(
          run(['nx', 'show', 'project', name, '--json'], undefined, true)
        );
        expect(project.targets.build.options.cwd).toBe(owner || '.');
        run(['nx', 'run', name + ':build']);
        await assertHttp(
          root,
          env,
          name + ':start',
          '/',
          'Hello World!',
          manager
        );
      }
      test(true);
      run([
        'nx',
        'g',
        '@anarchitects/nest:resource',
        'orders',
        '--project=api-worker',
        '--type=rest',
        '--crud',
        '--skipInstall',
        '--no-interactive',
      ]);
      run(['install']);
      run(['nx', 'run', 'api-worker:build']);
      await assertHttp(
        root,
        env,
        'api-worker:start',
        '/orders',
        'This action returns all orders',
        manager
      );
    },
    480_000
  );
}
