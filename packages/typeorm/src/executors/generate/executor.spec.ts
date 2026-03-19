import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import runGenerate from './executor.js';
import { spawn } from '../../utils/spawn.js';

jest.mock('../../utils/spawn.js', () => ({
  spawn: jest.fn(),
}));

describe('generate executor', () => {
  let context: ExecutorContext;
  let tempDir: string;
  let spawnMock: jest.MockedFunction<typeof spawn>;
  let getPmSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnMock = jest.mocked(spawn);
    spawnMock.mockResolvedValue(0);

    tempDir = mkdtempSync(join(tmpdir(), 'nx-typeorm-generate-'));
    ensureRunnerPackage(tempDir, 'typeorm-ts-node-commonjs');
    ensureRunnerPackage(tempDir, 'typeorm-ts-node-esm');

    context = {
      root: tempDir,
      cwd: tempDir,
      projectName: 'api',
      targetName: 'generate',
      configurationName: undefined,
      projectsConfigurations: {
        version: 2,
        projects: {
          api: {
            root: 'apps/api',
            projectType: 'application',
          },
        },
      },
    } as unknown as ExecutorContext;

    const pmCommands = {
      exec: 'pnpm exec',
    } as ReturnType<typeof devkit.getPackageManagerCommand>;

    getPmSpy = jest
      .spyOn(devkit, 'getPackageManagerCommand')
      .mockReturnValue(pmCommands);
  });

  afterEach(() => {
    getPmSpy.mockRestore();
    jest.clearAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('invokes typeorm generate with normalized options', async () => {
    const outputPath = join(tempDir, 'migrations');

    const result = await runGenerate(
      {
        name: 'Initial Migration',
        dataSource: 'tools/typeorm/datasource.ts',
        outputPath,
        driftCheck: true,
        args: ['--foo'],
      },
      context
    );

    expect(result).toEqual({ success: true });
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe('pnpm');
    expect(args).toEqual([
      'exec',
      'typeorm-ts-node-commonjs',
      'migration:generate',
      join(outputPath, 'Initial-Migration'),
      '-d',
      'apps/api/tools/typeorm/datasource.ts',
      '--pretty',
      '--check',
      '--foo',
    ]);
    expect(options).toMatchObject({ cwd: tempDir });
  });

  it('throws when migration name is missing', async () => {
    await expect(
      runGenerate(
        {
          name: '  ',
          dataSource: 'tools/typeorm/datasource.ts',
          outputPath: join(tempDir, 'migrations'),
        },
        context
      )
    ).rejects.toThrow('Provide a migration name via the name option.');

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('supports explicit check option', async () => {
    await runGenerate(
      {
        name: 'Validate Drift',
        dataSource: 'tools/typeorm/datasource.ts',
        outputPath: join(tempDir, 'migrations'),
        check: true,
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args).toContain('--check');
  });

  it('uses ESM runner for module projects', async () => {
    mkdirSync(join(tempDir, 'apps/api'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    await runGenerate(
      {
        name: 'Esm Migration',
        dataSource: 'tools/typeorm/datasource.ts',
        outputPath: join(tempDir, 'migrations'),
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args[1]).toBe('typeorm-ts-node-esm');
  });

  it('honors explicit moduleSystem override', async () => {
    mkdirSync(join(tempDir, 'apps/api'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps/api/package.json'),
      `${JSON.stringify({ type: 'module' }, null, 2)}\n`
    );

    await runGenerate(
      {
        name: 'Forced Commonjs',
        dataSource: 'tools/typeorm/datasource.ts',
        outputPath: join(tempDir, 'migrations'),
        moduleSystem: 'commonjs',
      },
      context
    );

    const [, args] = spawnMock.mock.calls[0];
    expect(args[1]).toBe('typeorm-ts-node-commonjs');
  });
});

function ensureRunnerPackage(workspaceRoot: string, packageName: string) {
  const packageDirectory = join(workspaceRoot, 'node_modules', packageName);
  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(
    join(packageDirectory, 'package.json'),
    `${JSON.stringify({ name: packageName, version: '0.0.0-test' }, null, 2)}\n`
  );
}
