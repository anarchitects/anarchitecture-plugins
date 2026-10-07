// SPDX-License-Identifier: MIT
import type { CreateNodesContext } from '@nx/devkit';
import * as childProcess from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createNodes, createNodesV2 } from './plugin';

describe('Nest project discovery', () => {
  let workspaceRoot: string;
  let context: CreateNodesContext;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nest-discovery-'));
    context = Object.freeze({
      workspaceRoot,
      nxJsonConfiguration: Object.freeze({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function write(path: string, value: unknown = {}) {
    const absolutePath = join(workspaceRoot, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, JSON.stringify(value));
  }

  function expectedProject(root: string) {
    return {
      projects: {
        [root]: {
          root,
          metadata: { technologies: ['nest'] },
          targets: {
            start: {
              command: 'nest start',
              options: { cwd: root },
              continuous: true,
              cache: false,
              metadata: {
                technologies: ['nest'],
                description: 'Start the Nest project.',
              },
            },
            build: {
              command: 'nest build',
              options: { cwd: root },
              cache: true,
              dependsOn: ['^build'],
              inputs: [
                'default',
                '^default',
                { externalDependencies: ['@nestjs/cli'] },
                '{workspaceRoot}/tsconfig.json',
                '{workspaceRoot}/tsconfig.base.json',
              ],
              outputs: ['{projectRoot}/dist'],
              metadata: {
                technologies: ['nest'],
                description: 'Build the Nest project.',
              },
            },
          },
        },
      },
    };
  }

  it.each(['package.json', 'project.json'])(
    'detects a root app with %s',
    async (manifest) => {
      write('nest-cli.json', { sourceRoot: 'src' });
      write(manifest, { name: 'root-api' });

      expect(
        await createNodesV2[1](['nest-cli.json'], undefined, context)
      ).toEqual([['nest-cli.json', expectedProject('.')]]);
    }
  );

  it.each([
    {},
    {
      sourceRoot: 'custom/source',
      compilerOptions: { tsConfigPath: 'tsconfig.custom.json' },
    },
    {
      monorepo: true,
      root: 'apps/api',
      projects: {
        api: { root: 'apps/api', type: 'application' },
        shared: { root: 'libs/shared', type: 'library' },
      },
    },
  ])('uses the config directory for nested config %j', async (config) => {
    write('services/backend/nest-cli.json', config);
    write('services/backend/package.json', {
      name: '@example/backend',
      type: 'module',
    });
    write('services/backend/project.json', {
      name: 'explicit-name',
      targets: { test: { command: 'existing-test' } },
    });

    expect(
      await createNodesV2[1](['services/backend/nest-cli.json'], {}, context)
    ).toEqual([
      ['services/backend/nest-cli.json', expectedProject('services/backend')],
    ]);
  });

  it('ignores configs without a sibling manifest, even when a parent has one', async () => {
    write('package.json', { name: 'workspace' });
    write('tools/nest-cli.json');
    mkdirSync(join(workspaceRoot, 'tools/project.json'));

    expect(
      await createNodesV2[1](
        ['tools/nest-cli.json', 'removed/nest-cli.json'],
        undefined,
        context
      )
    ).toEqual([]);
  });

  it('uses custom target names without mutating options or adding other targets', async () => {
    write('apps/api/nest-cli.json');
    write('apps/api/package.json', {
      name: 'api',
      nx: { namedInputs: { production: ['default'] } },
    });
    const options = Object.freeze({
      buildTargetName: 'compile',
      startTargetName: 'serve',
    });

    const result = await createNodesV2[1](
      ['apps/api/nest-cli.json'],
      options,
      context
    );
    const targets = result[0][1].projects?.['apps/api'].targets;
    expect(Object.keys(targets ?? {})).toEqual(['compile', 'serve']);
    expect(targets?.serve).toEqual(
      expectedProject('apps/api').projects['apps/api'].targets.start
    );
    expect(targets?.compile).toMatchObject({
      command: 'nest build',
      options: { cwd: 'apps/api' },
      cache: true,
      dependsOn: ['^compile'],
      inputs: [
        'production',
        '^production',
        { externalDependencies: ['@nestjs/cli'] },
        '{workspaceRoot}/tsconfig.json',
        '{workspaceRoot}/tsconfig.base.json',
      ],
    });
    expect(options).toEqual({
      buildTargetName: 'compile',
      startTargetName: 'serve',
    });
  });

  it.each([
    [{ startTargetName: 'serve' }, ['build', 'serve']],
    [{ buildTargetName: 'compile' }, ['compile', 'start']],
  ] as const)(
    'defaults target names independently with %j',
    async (options, names) => {
      write('nest-cli.json');
      write('package.json', { name: 'api' });
      const result = await createNodes[1](['nest-cli.json'], options, context);
      expect(Object.keys(result[0][1].projects?.['.'].targets ?? {})).toEqual(
        names
      );
    }
  );

  it.each([
    { buildTargetName: 'start' },
    { startTargetName: 'build' },
    { buildTargetName: 'run', startTargetName: 'run' },
  ])('rejects colliding target names %j', async (options) => {
    write('nest-cli.json');
    write('package.json', { name: 'api' });
    await expect(
      createNodes[1](['nest-cli.json'], options, context)
    ).rejects.toMatchObject({
      errors: [
        [
          'nest-cli.json',
          expect.objectContaining({
            message:
              'Nest plugin buildTargetName and startTargetName must be different.',
          }),
        ],
      ],
    });
  });

  it.each(['', '  '])(
    'rejects an invalid startTargetName %j during inference',
    async (startTargetName) => {
      write('nest-cli.json');
      write('package.json', { name: 'api' });
      await expect(
        createNodes[1](['nest-cli.json'], { startTargetName }, context)
      ).rejects.toMatchObject({
        errors: [
          [
            'nest-cli.json',
            expect.objectContaining({
              message:
                'Nest plugin startTargetName must be a non-empty string.',
            }),
          ],
        ],
      });
    }
  );

  it('ignores non-Nest files and an empty discovery list', async () => {
    write('apps/web/package.json', { name: 'web' });
    write('apps/web/tsconfig.json');

    expect(createNodesV2[0]).toBe('**/nest-cli.json');
    expect(createNodes).toBe(createNodesV2);
    expect(
      await createNodesV2[1](['apps/web/tsconfig.json'], undefined, context)
    ).toEqual([]);
    expect(await createNodesV2[1]([], undefined, context)).toEqual([]);
  });

  it('is deterministic, leaves files and inputs unchanged, and executes no processes', async () => {
    const processSpies = [
      jest.spyOn(childProcess, 'exec'),
      jest.spyOn(childProcess, 'execSync'),
      jest.spyOn(childProcess, 'execFile'),
      jest.spyOn(childProcess, 'execFileSync'),
      jest.spyOn(childProcess, 'spawn'),
      jest.spyOn(childProcess, 'spawnSync'),
      jest.spyOn(childProcess, 'fork'),
    ];
    for (const spy of processSpies)
      spy.mockImplementation(() => {
        throw new Error('Discovery must not execute processes');
      });
    write('nest-cli.json');
    write('package.json', { name: 'root' });
    write('apps/api/nest-cli.json');
    write('apps/api/project.json', { name: 'api' });
    const files = Object.freeze(['nest-cli.json', 'apps/api/nest-cli.json']);
    const options = Object.freeze({});
    const snapshot = () =>
      readdirSync(workspaceRoot, { recursive: true, withFileTypes: true }).map(
        (entry) => [
          join(entry.parentPath, entry.name),
          entry.isFile()
            ? readFileSync(join(entry.parentPath, entry.name), 'utf8')
            : null,
        ]
      );
    const before = snapshot();
    const cwd = process.cwd();

    const first = await createNodesV2[1](files, options, context);
    const second = await createNodesV2[1](
      [...files].reverse(),
      options,
      context
    );

    expect(first).toEqual(second);
    expect(first).toEqual([
      ['apps/api/nest-cli.json', expectedProject('apps/api')],
      ['nest-cli.json', expectedProject('.')],
    ]);
    expect(snapshot()).toEqual(before);
    expect(process.cwd()).toBe(cwd);
    for (const spy of processSpies) expect(spy).not.toHaveBeenCalled();
  });
});
